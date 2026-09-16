import { and, eq } from "drizzle-orm";
import { products, syncMutations } from "../schema";
import { resetClockForTests, setClockForTests } from "../context";
import { trackDelete, trackInsert, trackUpdate } from "../outbox";
import { createTestDb } from "../test-helpers";
import type { Db } from "../types";

describe("outbox tracking", () => {
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

  it("stamps sync columns and writes an insert mutation", () => {
    const product = trackInsert(db, products, { name: "Milk 1L" });

    expect(product.id).toHaveLength(36);
    expect(product.syncStatus).toBe("pending");
    expect(product.revision).toBe(0);
    expect(product.createdAt.getTime()).toBe(clock.getTime());
    expect(product.deviceId).toBe(product.deviceId);
    expect(product.deviceId).not.toBe("unassigned");

    const mutations = pendingMutations(db);
    expect(mutations).toHaveLength(1);
    expect(mutations[0]).toMatchObject({
      tableName: "products",
      recordId: product.id,
      operation: "insert",
      status: "pending",
    });
    expect(mutations[0].changedFieldsJson).toBeNull();
    const payload = JSON.parse(mutations[0].payloadJson!) as Record<string, unknown>;
    expect(payload["name"]).toBe("Milk 1L");
  });

  it("writes update mutations with changed fields and merges field versions", () => {
    const product = trackInsert(db, products, { name: "Milk 1L", brand: "Dairy" });
    clock = new Date(clock.getTime() + 5_000);

    const updated = trackUpdate(db, products, product.id, { name: "Fresh Milk 1L" });

    expect(updated?.name).toBe("Fresh Milk 1L");
    expect(updated?.updatedAt.getTime()).toBe(clock.getTime());
    expect(updated?.brand).toBe("Dairy");

    const updateMutation = pendingMutations(db).find((m) => m.operation === "update");
    expect(updateMutation).toBeDefined();
    expect(JSON.parse(updateMutation!.changedFieldsJson!)).toEqual(["name"]);

    const versions = JSON.parse(updated?.fieldVersionsJson ?? "{}") as Record<
      string,
      number
    >;
    expect(versions["name"]).toBe(clock.getTime());
    expect(versions["brand"]).toBe(clock.getTime() - 5_000);
  });

  it("soft-deletes (tombstone) instead of dropping rows", () => {
    const product = trackInsert(db, products, { name: "Milk 1L" });
    clock = new Date(clock.getTime() + 10_000);

    const deleted = trackDelete(db, products, product.id);

    expect(deleted).toBe(true);
    // Row still physically present with deleted_at set.
    const row = db.select().from(products).where(eq(products.id, product.id)).get();
    expect(row).toBeDefined();
    expect(row?.deletedAt?.getTime()).toBe(clock.getTime());

    const deleteMutation = pendingMutations(db).find((m) => m.operation === "delete");
    expect(deleteMutation?.recordId).toBe(product.id);

    // A second delete of the same id must not duplicate mutations.
    expect(trackDelete(db, products, product.id)).toBe(false);
    expect(
      pendingMutations(db).filter((m) => m.operation === "delete"),
    ).toHaveLength(1);
  });

  it("ignores managed keys smuggled into an update patch", () => {
    const product = trackInsert(db, products, { name: "Milk 1L" });

    const updated = trackUpdate(db, products, product.id, {
      name: "Attempt",
      // callers must not be able to forge sync metadata
      revision: 99,
      syncStatus: "synced",
    } as never);

    expect(updated?.name).toBe("Attempt");
    expect(updated?.revision).toBe(0);
    expect(updated?.syncStatus).toBe("pending");
  });
});

function pendingMutations(db: Db) {
  return db
    .select()
    .from(syncMutations)
    .where(and(eq(syncMutations.status, "pending")))
    .all();
}
