import { mergeRecords, type VersionedRecord } from "./merge";

function record(
  fields: Record<string, unknown>,
  fieldVersions: Record<string, number>,
  revision = 1,
): VersionedRecord {
  return { fields, fieldVersions, revision };
}

const T0 = 1_000;
const T1 = 2_000;

describe("field-level LWW merge", () => {
  it("takes server fields when the server is newer", () => {
    const local = record({ name: "Milk", brand: "OldBrand" }, { name: T0, brand: T0 });
    const server = record({ name: "Milk", brand: "NewBrand" }, { name: T0, brand: T1 }, 3);

    const { merged, conflicts } = mergeRecords(local, server);
    expect(merged.fields["brand"]).toBe("NewBrand");
    expect(merged.revision).toBe(3);
    expect(conflicts).toEqual([
      { field: "brand", winningValue: "NewBrand", winningSide: "server", losingValue: "OldBrand" },
    ]);
  });

  it("keeps local fields when local is strictly newer", () => {
    const local = record({ name: "LocalName" }, { name: T1 });
    const server = record({ name: "ServerName" }, { name: T0 });

    const { merged, conflicts } = mergeRecords(local, server);
    expect(merged.fields["name"]).toBe("LocalName");
    expect(conflicts[0]).toMatchObject({ winningSide: "local", losingValue: "ServerName" });
  });

  it("gives ties to the authoritative server clock", () => {
    const local = record({ name: "Local" }, { name: T1 });
    const server = record({ name: "Server" }, { name: T1 });

    const { merged } = mergeRecords(local, server);
    expect(merged.fields["name"]).toBe("Server");
  });

  it("merges field-by-field rather than whole-record", () => {
    const local = record({ name: "LocalNew", brand: "LocalOld" }, { name: T1, brand: T0 });
    const server = record({ name: "ServerOld", brand: "ServerNew" }, { name: T0, brand: T1 });

    const { merged } = mergeRecords(local, server);
    expect(merged.fields).toEqual({ name: "LocalNew", brand: "ServerNew" });
  });

  it("adopts unknown fields from the server (schema growth)", () => {
    const local = record({ name: "Milk" }, { name: T0 });
    const server = record({ name: "Milk", newColumn: "x" }, { name: T0, newColumn: T1 });

    const { merged, conflicts } = mergeRecords(local, server);
    expect(merged.fields["newColumn"]).toBe("x");
    expect(conflicts).toHaveLength(0);
  });

  it("applies server tombstones through the same field rule", () => {
    const alive = record({ name: "Milk", deleted_at: null }, { name: T0, deleted_at: T0 });
    const tombstone = record({ name: "Milk", deleted_at: T1 }, { name: T0, deleted_at: T1 });

    expect(mergeRecords(alive, tombstone).merged.fields["deleted_at"]).toBe(T1);
    // A pending local edit carries newer timestamps and survives the pull.
    const editedLocally = record({ name: "LocalEdit", deleted_at: null }, { name: T1 + 1, deleted_at: T0 });
    const decision = mergeRecords(editedLocally, tombstone);
    expect(decision.merged.fields["name"]).toBe("LocalEdit");
    expect(decision.merged.fields["deleted_at"]).toBe(T1);
  });
});
