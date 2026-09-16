import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";

import { migrations } from "@/db/migrations";
import type { SqlExecutor } from "@/lib/data-source";

import {
  applyServerRecord,
  camelToSnake,
  getSyncCursor,
  pullOnce,
  snakeToCamel,
  tableColumns,
  type SyncTransport,
} from "./engine";
import type { PullDeltaResponse, SyncRecordDto } from "./protocol";

/**
 * Desktop sync engine integration fixtures (mirrors
 * `lib/data-source.test.ts`): the exact SQL the Tauri plugin executes at
 * runtime runs here against better-sqlite3, over the shared embedded
 * migrations, with the network boundary replaced by a scripted mock.
 */

const T0 = 1_000;
const T1 = 2_000;

function createExecutor(sqlite: Database.Database): SqlExecutor {
  return {
    async select<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      return sqlite.prepare(sql).all(...params) as T[];
    },
    async exec(sql: string): Promise<void> {
      sqlite.exec(sql);
    },
  };
}

/** Scripted pages; every requested cursor is recorded for assertions. */
function pageTransport(
  pages: PullDeltaResponse[],
  seenCursors: (string | null)[] = [],
): SyncTransport {
  let index = 0;
  return {
    async pullDelta(cursor: string | null): Promise<PullDeltaResponse> {
      seenCursors.push(cursor);
      const page = pages[index];
      if (page === undefined) {
        throw new Error(`unexpected pull for cursor ${String(cursor)}`);
      }
      index += 1;
      return page;
    },
  };
}

function productRecord(
  id: string,
  fields: Record<string, unknown>,
  fieldVersions: Record<string, number>,
  revision = 5,
): SyncRecordDto {
  return {
    tableName: "products",
    fields: {
      id,
      createdAt: 500,
      updatedAt: 2_000,
      deletedAt: null,
      deviceId: "remote-device",
      revision,
      syncStatus: "synced",
      fieldVersionsJson: null,
      ...fields,
    },
    fieldVersions,
    revision,
    deleted: false,
  };
}

function count(sqlite: Database.Database, table: string): number {
  const rows = sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).all() as { n: number }[];
  return rows[0].n;
}

function productRow(sqlite: Database.Database, id: string): Record<string, unknown> {
  return sqlite.prepare("SELECT * FROM products WHERE id = ?").get(id) as Record<string, unknown>;
}

describe("camelCase <-> snake_case mapper", () => {
  let sqlite: Database.Database;
  let executor: SqlExecutor;

  beforeEach(async () => {
    sqlite = new Database(":memory:");
    executor = createExecutor(sqlite);
    for (const migration of migrations) {
      for (const statement of migration.statements) {
        await executor.exec(statement);
      }
    }
  });

  it("maps protocol field names to SQL columns and back", () => {
    expect(camelToSnake("name")).toBe("name");
    expect(camelToSnake("isFavorite")).toBe("is_favorite");
    expect(camelToSnake("packageQuantity")).toBe("package_quantity");
    expect(camelToSnake("ocrRawText")).toBe("ocr_raw_text");
    expect(camelToSnake("sha256")).toBe("sha256");

    expect(snakeToCamel("name")).toBe("name");
    expect(snakeToCamel("is_favorite")).toBe("isFavorite");
    expect(snakeToCamel("ocr_raw_text")).toBe("ocrRawText");
    expect(snakeToCamel("sha256")).toBe("sha256");
  });

  it("resolves real column sets from the migrated replica schema", async () => {
    const cache = new Map<string, Set<string>>();
    const columns = await tableColumns(executor, "products", cache);
    expect(columns).toContain("field_versions_json");
    expect(columns).toContain("is_favorite");
    expect(columns).not.toContain("does_not_exist");
    // Cached second call returns the same set.
    expect(await tableColumns(executor, "products", cache)).toEqual(columns);
  });

  it("round-trips local rows through snakeToCamel for the merge", async () => {
    sqlite
      .prepare(
        "INSERT INTO products (id, created_at, updated_at, deleted_at, device_id, revision, sync_status, field_versions_json, name) VALUES ('p1', 1, 1, NULL, 'dev', 1, 'synced', ?, 'Milk')",
      )
      .run(JSON.stringify({ name: T0 }));
    const rows = await executor.select<Record<string, unknown>>(
      "SELECT * FROM products WHERE id = 'p1'",
    );
    const fields: Record<string, unknown> = {};
    for (const [column, value] of Object.entries(rows[0])) {
      fields[snakeToCamel(column)] = value;
    }
    expect(fields["isFavorite"]).toBe(0);
    expect(fields["fieldVersionsJson"]).toBe(JSON.stringify({ name: T0 }));
    expect(fields["syncStatus"]).toBe("synced");
  });
});

describe("desktop sync engine (pull)", () => {
  let sqlite: Database.Database;
  let executor: SqlExecutor;

  beforeEach(async () => {
    sqlite = new Database(":memory:");
    sqlite.pragma("foreign_keys = ON");
    executor = createExecutor(sqlite);
    for (const migration of migrations) {
      for (const statement of migration.statements) {
        await executor.exec(statement);
      }
    }
  });

  it("applies a pulled record as a fresh insert", async () => {
    const transport = pageTransport([
      {
        records: [
          productRecord("remote-1", { name: "Remote Bread" }, { name: T0, updatedAt: T0 }),
        ],
        nextCursor: null,
      },
    ]);

    const result = await pullOnce(executor, transport);

    expect(result).toMatchObject({ status: "ok", pulled: 1, conflicts: 0 });
    const row = productRow(sqlite, "remote-1");
    expect(row["name"]).toBe("Remote Bread");
    expect(row["sync_status"]).toBe("synced");
    expect(row["revision"]).toBe(5);
    expect(row["device_id"]).toBe("remote-device");
    expect(JSON.parse(row["field_versions_json"] as string)).toEqual({ name: T0, updatedAt: T0 });
    // Terminal state: fully caught up (empty cursor normalizes to null).
    expect(await getSyncCursor(executor)).toBeNull();
  });

  it("merges per field with LWW: older server fields lose, newer win, conflicts audited", async () => {
    // Local edit wrote name after the server; the server rewrote brand later.
    sqlite
      .prepare(
        "INSERT INTO products (id, created_at, updated_at, deleted_at, device_id, revision, sync_status, field_versions_json, name, brand) VALUES (?, ?, ?, NULL, ?, ?, 'synced', ?, ?, ?)",
      )
      .run(
        "local-1",
        500,
        500,
        "local-device",
        2,
        JSON.stringify({ name: T1, brand: T0 }),
        "NewerLocalName",
        "LocalBrand",
      );

    const older = productRecord(
      "local-1",
      { name: "ServerOldName", brand: "ServerNewBrand" },
      // Server wrote its name before our local edit, but its brand is newer.
      { name: 500, brand: 3_000 },
      6,
    );

    const result = await pullOnce(
      executor,
      pageTransport([{ records: [older], nextCursor: null }]),
    );

    expect(result).toMatchObject({ status: "ok", pulled: 1, conflicts: 2 });
    const row = productRow(sqlite, "local-1");
    expect(row["name"]).toBe("NewerLocalName"); // local edit survived
    expect(row["brand"]).toBe("ServerNewBrand"); // server field applied
    expect(row["revision"]).toBe(6);
    expect(row["sync_status"]).toBe("synced");
    expect(JSON.parse(row["field_versions_json"] as string)).toEqual({ name: T1, brand: 3_000 });

    const audit = sqlite.prepare("SELECT * FROM sync_conflicts ORDER BY field").all() as Array<
      Record<string, unknown>
    >;
    expect(audit).toHaveLength(2);
    expect(audit[0]).toMatchObject({
      table_name: "products",
      record_id: "local-1",
      field: "brand",
      winning_side: "server",
      winning_value_json: JSON.stringify("ServerNewBrand"),
      losing_value_json: JSON.stringify("LocalBrand"),
      local_revision: 2,
      remote_revision: 6,
      local_device_id: "local-device",
      remote_device_id: "remote-device",
    });
    expect(audit[1]).toMatchObject({
      field: "name",
      winning_side: "local",
      winning_value_json: JSON.stringify("NewerLocalName"),
      losing_value_json: JSON.stringify("ServerOldName"),
    });
  });

  it("persists the cursor across pages, advancing an existing checkpoint", async () => {
    sqlite
      .prepare("INSERT INTO sync_meta (key, value, updated_at) VALUES ('sync_cursor', 'stale', 1)")
      .run();
    const seen: (string | null)[] = [];
    const transport = pageTransport(
      [
        { records: [productRecord("p1", { name: "One" }, { name: T0 })], nextCursor: "page-2" },
        { records: [productRecord("p2", { name: "Two" }, { name: T0 })], nextCursor: "page-3" },
        { records: [], nextCursor: null },
      ],
      seen,
    );

    const result = await pullOnce(executor, transport);

    expect(result).toMatchObject({ status: "ok", pulled: 2, conflicts: 0 });
    expect(seen).toEqual(["stale", "page-2", "page-3"]);
    expect(await getSyncCursor(executor)).toBe("page-3");
    expect(count(sqlite, "products")).toBe(2);
  });

  it("is idempotent: re-pulling the same page neither duplicates nor re-conflicts", async () => {
    const record = productRecord("remote-1", { name: "Remote Bread" }, { name: T0 });
    const first = await pullOnce(
      executor,
      pageTransport([{ records: [record], nextCursor: null }]),
    );
    const second = await pullOnce(
      executor,
      pageTransport([{ records: [record], nextCursor: null }]),
    );

    expect(first).toMatchObject({ status: "ok", pulled: 1, conflicts: 0 });
    expect(second).toMatchObject({ status: "ok", pulled: 1, conflicts: 0 });
    expect(count(sqlite, "products")).toBe(1);
    expect(count(sqlite, "sync_conflicts")).toBe(0);
    expect(productRow(sqlite, "remote-1")["name"]).toBe("Remote Bread");
  });

  it("reports unconfigured and touches nothing without a transport", async () => {
    const result = await pullOnce(executor, null);

    expect(result).toEqual({ status: "unconfigured", pulled: 0, conflicts: 0 });
    expect(count(sqlite, "sync_meta")).toBe(0);
    expect(count(sqlite, "products")).toBe(0);
  });

  it("leaves the cursor untouched when a page fails mid-pass", async () => {
    sqlite
      .prepare("INSERT INTO sync_meta (key, value, updated_at) VALUES ('sync_cursor', 'old', 1)")
      .run();
    const failing: SyncTransport = {
      pullDelta: () => Promise.reject(new Error("offline")),
    };

    const result = await pullOnce(executor, failing);

    expect(result.status).toBe("error");
    expect(result.error).toBe("offline");
    expect(await getSyncCursor(executor)).toBe("old");
  });

  it("skips records for unknown tables without failing the pass", async () => {
    const record = productRecord("ghost", { name: "Ghost" }, { name: T0 });
    record.tableName = "not_a_table";

    const result = await pullOnce(
      executor,
      pageTransport([{ records: [record], nextCursor: null }]),
    );

    expect(result).toMatchObject({ status: "ok", pulled: 1, conflicts: 0 });
    expect(count(sqlite, "products")).toBe(0);
  });

  it("applies tombstones through the same field rule", async () => {
    sqlite
      .prepare(
        "INSERT INTO products (id, created_at, updated_at, deleted_at, device_id, revision, sync_status, field_versions_json, name) VALUES ('alive-1', 1, 1, NULL, 'local-device', 1, 'synced', ?, 'Milk')",
      )
      .run(JSON.stringify({ name: T0, deletedAt: T0 }));

    // Full row state per the protocol: unchanged fields ride along, only
    // deleted_at is newer (its version moved the tombstone forward).
    const tombstone = productRecord(
      "alive-1",
      { name: "Milk", deletedAt: T1 },
      { name: T0, deletedAt: T1 },
      4,
    );
    await applyServerRecord(executor, tombstone, "local-device");

    const row = productRow(sqlite, "alive-1");
    expect(row["deleted_at"]).toBe(T1);
    expect(row["name"]).toBe("Milk");
    expect(count(sqlite, "sync_conflicts")).toBe(1); // deleted_at flip audited
  });
});
