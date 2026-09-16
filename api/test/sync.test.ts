/**
 * Sync engine tests: the contract mobile/src/sync/engine.ts is built against.
 * Exercises the HTTP surface with fastify.inject over in-memory SQLite —
 * push/pull round trip, idempotency, field LWW, tombstones, conflict audit,
 * cursor paging, and auth placeholder behavior.
 */
import { describe, expect, it } from "vitest";

import { decodeCursor, encodeCursor } from "../src/sync/cursor.js";
import {
  buildTestApp,
  createTestDb,
  DEVICE_A,
  DEVICE_B,
  makeMutation,
  pull,
  pullEverything,
  push,
} from "./helpers.js";

describe("sync API", () => {
  it("answers health checks", async () => {
    const app = await buildTestApp(createTestDb());
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ok" });
  });

  it("rejects sync requests without the X-Device-Id header (401)", async () => {
    const app = await buildTestApp(createTestDb());
    const pushResponse = await app.inject({
      method: "POST",
      url: "/sync/push",
      payload: { deviceId: DEVICE_A, mutations: [] },
    });
    expect(pushResponse.statusCode).toBe(401);
    const pullResponse = await app.inject({ method: "GET", url: "/sync/pull" });
    expect(pullResponse.statusCode).toBe(401);
  });

  it("rejects a body deviceId that differs from the header (403)", async () => {
    const app = await buildTestApp(createTestDb());
    const { status, body } = await push(app, [], { bodyDeviceId: "spoofed-device" });
    expect(status).toBe(403);
    expect(body).toMatchObject({ error: expect.stringContaining("does not match") });
  });

  it("applies an insert, stamps server-owned sync columns, and round-trips through pull", async () => {
    const db = createTestDb();
    const app = await buildTestApp(db);
    const mutation = makeMutation({
      recordId: "prod-1",
      payload: {
        id: "prod-1",
        name: "Milk",
        brand: "Nestle",
        categoryId: null,
        packageQuantity: null,
        packageSize: null,
        unit: null,
        notes: null,
        photoImageId: null,
        isFavorite: 0,
        archivedAt: null,
      },
    });

    const before = Date.now();
    const { status, body } = await push(app, [mutation]);
    expect(status).toBe(200);
    const result = (body as Extract<typeof body, { results?: unknown }>).results[0];
    expect(result).toMatchObject({ mutationId: mutation.id, accepted: true, revision: 1 });
    expect(result?.updatedAt).toBeGreaterThanOrEqual(before);

    // Canonical row: server-owned values, not the client's envelope values.
    const row = db.sqlite
      .prepare(
        `SELECT created_at, updated_at, deleted_at, device_id, revision, sync_status, server_seq
         FROM products WHERE id = 'prod-1'`,
      )
      .get() as Record<string, unknown>;
    expect(row).toMatchObject({
      device_id: DEVICE_A,
      revision: 1,
      sync_status: "synced",
      deleted_at: null,
      server_seq: 1,
    });
    expect(row["created_at"]).toBe(result?.updatedAt);

    // Push response cursor points at the new head.
    expect(decodeCursor((body as Extract<typeof body, { cursor?: unknown }>).cursor)).toBe(1);

    // Another device pulls the record as a SyncRecordDto.
    const pulled = await pullEverything(app, DEVICE_B);
    expect(pulled).toHaveLength(1);
    const record = pulled[0];
    expect(record.tableName).toBe("products");
    expect(record.revision).toBe(1);
    expect(record.deleted).toBe(false);
    expect(record.fields).toMatchObject({ id: "prod-1", name: "Milk", brand: "Nestle" });
    expect("serverSeq" in record.fields).toBe(false); // server-only column stays off the wire
    expect(typeof record.fields["createdAt"]).toBe("number");
    expect(record.fieldVersions["name"]).toBeGreaterThan(0);
    expect(record.fieldVersions["updatedAt"]).toBe(result?.updatedAt);
    const versions = Object.values(record.fieldVersions);
    expect(new Set(versions).size).toBe(1); // insert versions every field at apply time
  });

  it("is idempotent: re-pushing a mutation replays the stored result without double-apply", async () => {
    const db = createTestDb();
    const app = await buildTestApp(db);
    const mutation = makeMutation({ recordId: "prod-1" });

    const first = await push(app, [mutation]);
    expect(first.status).toBe(200);
    const second = await push(app, [mutation]);
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body); // verbatim replay

    const counts = db.sqlite
      .prepare(
        `SELECT (SELECT COUNT(*) FROM products) AS rows,
                (SELECT COUNT(*) FROM sync_mutations_applied) AS ledger,
                (SELECT revision FROM products WHERE id = 'prod-1') AS revision`,
      )
      .get() as { rows: number; ledger: number; revision: number };
    expect(counts).toMatchObject({ rows: 1, ledger: 1, revision: 1 });
  });

  it("applies mutations in createdAt order regardless of batch order (field LWW)", async () => {
    const db = createTestDb();
    const app = await buildTestApp(db);

    const insert = makeMutation({
      recordId: "prod-1",
      createdAt: 1_000,
      payload: { name: "Milk", brand: "OldBrand", categoryId: null, isFavorite: 0 },
    });
    const renameByB = makeMutation({
      id: "mut-rename",
      recordId: "prod-1",
      operation: "update",
      changedFields: ["name"],
      payload: { name: "Renamed by B" },
      deviceId: DEVICE_B,
      createdAt: 2_000,
    });
    const rebrandByA = makeMutation({
      id: "mut-rebrand",
      recordId: "prod-1",
      operation: "update",
      changedFields: ["brand"],
      payload: { brand: "NewBrand" },
      createdAt: 3_000,
    });

    // Each device pushes its own outbox batch; A's arrives deliberately out
    // of order, and B's rename lands afterwards — the server must apply in
    // client mutation-time order (insert, rebrand, then rename).
    const first = await push(app, [rebrandByA, insert]);
    const results = (first.body as Extract<typeof first.body, { results?: unknown }>).results;
    expect(results.map((result) => result.mutationId)).toEqual([insert.id, rebrandByA.id]);
    expect(results.every((result) => result.accepted)).toBe(true);

    const second = await push(app, [renameByB], { as: DEVICE_B });
    const renameResult = (second.body as Extract<typeof second.body, { results?: unknown }>).results[0];
    expect(renameResult?.accepted).toBe(true);

    const pulled = await pullEverything(app);
    const record = pulled.find((candidate) => candidate.fields["id"] === "prod-1");
    expect(record?.fields).toMatchObject({ name: "Renamed by B", brand: "NewBrand" });
    expect(record?.revision).toBe(3);
    // Per-field versions: the later-applied write is strictly newer, so a
    // pulling client's LWW merge converges on exactly this state.
    expect(record?.fieldVersions["name"]).toBeGreaterThan(record?.fieldVersions["brand"] ?? 0);
    // Fields the updates never touched keep their insert-time version.
    expect(record?.fieldVersions["isFavorite"]).toBeLessThan(record?.fieldVersions["brand"] ?? 0);
  });

  it("ignores client clocks: a far-future mutation.createdAt is never stored", async () => {
    const db = createTestDb();
    const app = await buildTestApp(db);
    const year3000 = 32_503_680_000_000;
    const mutation = makeMutation({ recordId: "prod-1", createdAt: year3000 });

    const { body } = await push(app, [mutation]);
    const result = (body as Extract<typeof body, { results?: unknown }>).results[0];
    const before = Date.now();
    expect(result?.updatedAt).toBeLessThan(year3000);
    expect(result?.updatedAt).toBeGreaterThanOrEqual(before - 5_000);

    const row = db.sqlite
      .prepare(`SELECT created_at, updated_at, field_versions_json FROM products WHERE id = 'prod-1'`)
      .get() as { created_at: number; updated_at: number; field_versions_json: string };
    expect(row.updated_at).toBe(result?.updatedAt);
    const versions = JSON.parse(row.field_versions_json) as Record<string, number>;
    for (const version of Object.values(versions)) {
      expect(version).toBeLessThan(year3000); // server clock everywhere
    }
  });

  it("tombstones: delete keeps the row, pull reports deleted, re-delete is a no-op, updates are rejected", async () => {
    const db = createTestDb();
    const app = await buildTestApp(db);
    await push(app, [makeMutation({ recordId: "prod-1" })]);

    const before = Date.now();
    const del = makeMutation({
      id: "mut-del-1",
      recordId: "prod-1",
      operation: "delete",
      changedFields: ["deletedAt"],
      payload: null,
      createdAt: 5_000,
    });
    const { body } = await push(app, [del]);
    const result = (body as Extract<typeof body, { results?: unknown }>).results[0];
    expect(result).toMatchObject({ accepted: true, revision: 2 });
    expect(result?.updatedAt).toBeGreaterThanOrEqual(before);

    // Tombstone row survives (never hard-deleted).
    const row = db.sqlite
      .prepare(`SELECT deleted_at, revision FROM products WHERE id = 'prod-1'`)
      .get() as { deleted_at: number; revision: number };
    expect(row.deleted_at).toBe(result?.updatedAt);
    expect(row.revision).toBe(2);

    // Pull delivers the tombstone with deleted=true and the deletedAt value.
    const pulled = await pullEverything(app);
    const record = pulled.find((candidate) => candidate.fields["id"] === "prod-1");
    expect(record?.deleted).toBe(true);
    expect(record?.fields["deletedAt"]).toBe(row.deleted_at);
    expect(record?.revision).toBe(2);

    // Re-delete with a NEW mutation id: accepted no-op, nothing changes.
    const reDel = makeMutation({
      id: "mut-del-2",
      recordId: "prod-1",
      operation: "delete",
      changedFields: ["deletedAt"],
      payload: null,
      createdAt: 6_000,
    });
    const again = await push(app, [reDel]);
    const againResult = (again.body as Extract<typeof body, { results?: unknown }>).results[0];
    expect(againResult).toEqual({ mutationId: reDel.id, accepted: true, revision: 2, updatedAt: row.deleted_at });
    expect(
      (db.sqlite.prepare(`SELECT revision FROM products WHERE id = 'prod-1'`).get() as { revision: number }).revision,
    ).toBe(2);

    // Update of a tombstone is rejected (and the rejection is ledgered).
    const revive = makeMutation({
      id: "mut-revive",
      recordId: "prod-1",
      operation: "update",
      changedFields: ["name"],
      payload: { name: "Zombie" },
      createdAt: 7_000,
    });
    const revived = await push(app, [revive]);
    const revivedResult = (revived.body as Extract<typeof body, { results?: unknown }>).results[0];
    expect(revivedResult.accepted).toBe(false);
    expect(revivedResult.error).toContain("tombstone");
  });

  it("rejects invalid mutations per-mutation without failing the rest of the batch", async () => {
    const db = createTestDb();
    const app = await buildTestApp(db);

    const unknownTable = makeMutation({ id: "mut-bad-table", recordId: "x-1", tableName: "not_a_table" });
    const valid = makeMutation({ id: "mut-good", recordId: "prod-1", payload: { name: "Milk" } });
    const duplicate = makeMutation({
      id: "mut-dup",
      recordId: "prod-1",
      payload: { name: "Clone" },
      createdAt: 2_000,
    });
    const missingRequired = makeMutation({
      id: "mut-missing",
      recordId: "prod-2",
      payload: { brand: "no name column value" }, // products.name NOT NULL violated
      createdAt: 3_000,
    });

    const { body } = await push(app, [unknownTable, valid, duplicate, missingRequired]);
    const results = (body as Extract<typeof body, { results?: unknown }>).results;
    expect(results.map((result) => result.accepted)).toEqual([false, true, false, false]);
    expect(results[0]?.error).toContain("unknown table");
    expect(results[2]?.error).toContain("already exists");
    expect(results[3]?.error).toBeTruthy();

    expect(
      (db.sqlite.prepare(`SELECT COUNT(*) AS n FROM products`).get() as { n: number }).n,
    ).toBe(1);
    expect(
      (db.sqlite.prepare(`SELECT COUNT(*) AS n FROM sync_mutations_applied`).get() as { n: number }).n,
    ).toBe(4); // rejections are ledgered too, so re-pushes replay them
  });

  it("pages pull deltas by cursor and only serves records after the cursor", async () => {
    const db = createTestDb();
    const app = await buildTestApp(db);

    const mutations = Array.from({ length: 25 }, (_, index) =>
      makeMutation({ recordId: `prod-${String(index + 1).padStart(2, "0")}`, createdAt: index + 1 }),
    );
    const { body } = await push(app, mutations);
    expect((body as Extract<typeof body, { results?: unknown }>).results.every((r) => r.accepted)).toBe(true);

    const page1 = await pull(app, { limit: 10 });
    expect(page1.status).toBe(200);
    let delta = page1.body as Extract<typeof page1.body, { records?: unknown }>;
    expect(delta.records).toHaveLength(10);
    expect(delta.records.map((record) => record.fields["id"])).toEqual(
      Array.from({ length: 10 }, (_, index) => `prod-${String(index + 1).padStart(2, "0")}`),
    );
    const cursor1 = delta.nextCursor;
    expect(cursor1).not.toBeNull();
    expect(decodeCursor(cursor1)).toBe(10);

    const page2 = await pull(app, { cursor: cursor1 ?? "", limit: 10 });
    delta = page2.body as typeof delta;
    expect(delta.records).toHaveLength(10);
    expect(decodeCursor(delta.nextCursor)).toBe(20);

    const page3 = await pull(app, { cursor: delta.nextCursor ?? "", limit: 10 });
    delta = page3.body as typeof delta;
    expect(delta.records).toHaveLength(5); // last page
    expect(delta.nextCursor).toBeNull(); // terminal state the client engine waits for

    // Incremental: only changes after the cursor come back.
    const after = await push(app, [
      makeMutation({ recordId: "prod-26", createdAt: 100 }),
      makeMutation({ recordId: "prod-27", createdAt: 101 }),
    ]);
    const afterCursor = (after.body as Extract<typeof body, { cursor?: unknown }>).cursor ?? "";
    const incremental = await pull(app, { cursor: encodeCursor(25), limit: 10 });
    delta = incremental.body as typeof delta;
    expect(delta.records.map((record) => record.fields["id"])).toEqual(["prod-26", "prod-27"]);
    expect(delta.nextCursor).toBeNull();

    // A pulled-empty cursor checkpoint yields an empty first page.
    const caught = await pull(app, { cursor: afterCursor, limit: 10 });
    expect((caught.body as typeof delta).records).toEqual([]);

    // Malformed cursors are rejected outright.
    const bad = await pull(app, { cursor: "garbage!!!", limit: 10 });
    expect(bad.status).toBe(400);
  });

  it("audits cross-device conflicts and skips same-device rewrites", async () => {
    const db = createTestDb();
    const app = await buildTestApp(db);

    await push(app, [
      makeMutation({
        recordId: "prod-1",
        createdAt: 1_000,
        payload: { name: "Product 1", brand: null, categoryId: null, isFavorite: 0 },
      }),
    ]); // A creates, name "Product 1"

    const renameByB = makeMutation({
      id: "mut-b1",
      recordId: "prod-1",
      operation: "update",
      changedFields: ["name"],
      payload: { name: "B Wins" },
      deviceId: DEVICE_B,
      createdAt: 2_000,
    });
    await push(app, [renameByB], { as: DEVICE_B });

    const renameBackByA = makeMutation({
      id: "mut-a1",
      recordId: "prod-1",
      operation: "update",
      changedFields: ["name"],
      payload: { name: "A Wins Back" },
      createdAt: 3_000,
    });
    await push(app, [renameBackByA]);

    const sameDeviceAgain = makeMutation({
      id: "mut-a2",
      recordId: "prod-1",
      operation: "update",
      changedFields: ["name"],
      payload: { name: "A Again" },
      createdAt: 4_000,
    });
    await push(app, [sameDeviceAgain]);

    const conflicts = db.sqlite
      .prepare(`SELECT field, winning_side, winning_value_json, losing_value_json,
                       local_revision, remote_revision, local_device_id, remote_device_id
                FROM sync_conflicts ORDER BY created_at, id`)
      .all() as Array<Record<string, unknown>>;
    expect(conflicts).toHaveLength(2); // B over A, then A over B; A-over-A is not a conflict
    expect(conflicts[0]).toMatchObject({
      field: "name",
      winning_side: "server",
      winning_value_json: JSON.stringify("B Wins"),
      losing_value_json: JSON.stringify("Product 1"),
      local_revision: 1,
      remote_revision: 2,
      local_device_id: DEVICE_A,
      remote_device_id: DEVICE_B,
    });
    expect(conflicts[1]).toMatchObject({
      winning_value_json: JSON.stringify("A Wins Back"),
      losing_value_json: JSON.stringify("B Wins"),
      local_device_id: DEVICE_B,
      remote_device_id: DEVICE_A,
    });

    // Canonical state follows the last accepted write.
    const name = (
      db.sqlite.prepare(`SELECT name FROM products WHERE id = 'prod-1'`).get() as { name: string }
    ).name;
    expect(name).toBe("A Again");
  });

  it("starts with an empty pull page on a fresh database", async () => {
    const app = await buildTestApp(createTestDb());
    const page = await pull(app);
    expect(page.status).toBe(200);
    expect(page.body).toEqual({ records: [], nextCursor: null });
  });
});
