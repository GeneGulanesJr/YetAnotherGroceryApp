import { eq } from "drizzle-orm";

import { setClockForTests, resetClockForTests } from "../db/context";
import { products, syncConflicts, syncMutations } from "../db/schema";
import { createProduct, updateProduct } from "../db/repositories/products";
import { createTestDb } from "../db/test-helpers";
import type { Db } from "../db/types";
import { runSync, getSyncCursor, type SyncTransport } from "./engine";
import type { PushBatchRequest, PushBatchResponse, PullDeltaResponse, SyncRecordDto } from "./protocol";

function acceptingTransport(
  pullRecords: SyncRecordDto[] = [],
  overrides: Partial<{ push: (req: PushBatchRequest) => Promise<PushBatchResponse> }> = {},
): SyncTransport {
  return {
    async pushBatch(request: PushBatchRequest): Promise<PushBatchResponse> {
      if (overrides.push !== undefined) {
        return overrides.push(request);
      }
      return {
        results: request.mutations.map((mutation) => ({
          mutationId: mutation.id,
          accepted: true,
          revision: 7,
          updatedAt: 1_000_000,
        })),
        cursor: "cursor-after-push",
      };
    },
    async pullDelta(): Promise<PullDeltaResponse> {
      return { records: pullRecords, nextCursor: null };
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

describe("sync engine", () => {
  let db: Db;
  let clock: Date;

  beforeEach(() => {
    db = createTestDb();
    clock = new Date("2026-01-01T00:00:00.000Z");
    setClockForTests(() => clock);
  });

  afterEach(() => {
    resetClockForTests();
  });

  it("pushes the outbox, marks mutations applied and records synced", async () => {
    const product = createProduct(db, { name: "Milk", barcode: "5901234123457" });
    expect(pendingCount(db)).toBeGreaterThanOrEqual(2); // product + barcode

    const result = await runSync(db, acceptingTransport());

    expect(result.status).toBe("ok");
    expect(result.pushed).toBeGreaterThan(0);
    expect(result.pushFailed).toBe(0);
    expect(pendingCount(db)).toBe(0);

    const row = db.select().from(products).where(eq(products.id, product.id)).get();
    expect(row?.syncStatus).toBe("synced");
    expect(row?.revision).toBe(7);
  });

  it("is idempotent: nothing is re-pushed on a second run", async () => {
    createProduct(db, { name: "Milk" });
    const first = await runSync(db, acceptingTransport());
    expect(first.pushed).toBeGreaterThan(0);

    const second = await runSync(db, acceptingTransport());
    expect(second.pushed).toBe(0);
    expect(second.status).toBe("ok");
  });

  it("reverts to pending with backoff on transport failure", async () => {
    createProduct(db, { name: "Milk" });
    const failing: SyncTransport = {
      pushBatch: () => Promise.reject(new Error("offline")),
      pullDelta: () => Promise.reject(new Error("offline")),
    };

    const result = await runSync(db, failing);
    expect(result.status).toBe("error");
    expect(result.pushFailed).toBeGreaterThan(0);

    const mutations = db.select().from(syncMutations).all();
    expect(mutations.length).toBeGreaterThan(0);
    for (const mutation of mutations) {
      expect(mutation.status).toBe("pending"); // not stuck in uploading
      expect(mutation.attempts).toBe(1);
    }

    // Immediately again: backoff gate holds the batch back.
    const immediate = await runSync(db, acceptingTransport());
    expect(immediate.pushed).toBe(0);
    // After the backoff window, it goes through.
    clock = new Date(clock.getTime() + 61_000);
    const retry = await runSync(db, acceptingTransport());
    expect(retry.pushed).toBeGreaterThan(0);
  });

  it("applies pulled records and stores the cursor", async () => {
    const remote = productRecord(
      "remote-1",
      { name: "Remote Bread", brand: null, categoryId: null, packageQuantity: null, packageSize: null, unit: null, notes: null, photoImageId: null, isFavorite: 0, archivedAt: null },
      { name: 1_000, brand: 1_000, categoryId: 1_000, packageQuantity: 1_000, packageSize: 1_000, unit: 1_000, notes: 1_000, photoImageId: 1_000, isFavorite: 1_000, archivedAt: 1_000 },
    );

    const result = await runSync(db, acceptingTransport([remote]));
    expect(result.pulled).toBe(1);
    const row = db.select().from(products).where(eq(products.id, "remote-1")).get();
    expect(row?.name).toBe("Remote Bread");
    expect(row?.syncStatus).toBe("synced");
    // Terminal state: fully caught up (empty cursor normalizes to null).
    expect(getSyncCursor(db)).toBeNull();
  });

  it("audits field conflicts when local edits win against older server state", async () => {
    const product = createProduct(db, { name: "LocalName" });
    await runSync(db, acceptingTransport()); // drains the create mutations
    updateProduct(db, product.id, { name: "NewerLocalName" });

    const older = productRecord(
      product.id,
      { name: "ServerOldName", brand: null, categoryId: null, packageQuantity: null, packageSize: null, unit: null, notes: null, photoImageId: null, isFavorite: 0, archivedAt: null },
      // Server wrote its name before our local edit.
      { name: 500, brand: 1_000, categoryId: 1_000, packageQuantity: 1_000, packageSize: 1_000, unit: 1_000, notes: 1_000, photoImageId: 1_000, isFavorite: 1_000, archivedAt: 1_000 },
    );
    const result = await runSync(db, acceptingTransport([older]));

    expect(result.conflicts).toBe(1);
    const row = db.select().from(products).where(eq(products.id, product.id)).get();
    expect(row?.name).toBe("NewerLocalName"); // local edit survived

    const audit = db.select().from(syncConflicts).all();
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      tableName: "products",
      recordId: product.id,
      field: "name",
      winningSide: "local",
    });
  });

  it("reports unconfigured without touching the outbox", async () => {
    createProduct(db, { name: "Milk" });
    const before = pendingCount(db);
    const result = await runSync(db, null);
    expect(result.status).toBe("unconfigured");
    expect(pendingCount(db)).toBe(before);
  });
});

function pendingCount(db: Db): number {
  return db.select().from(syncMutations).all().filter((m) => m.status === "pending").length;
}
