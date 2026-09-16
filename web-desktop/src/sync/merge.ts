/**
 * Field-level last-write-wins merge (spec: "Conflict Resolution"). Verbatim
 * port of `mobile/src/sync/merge.ts` — pure and framework-free on both
 * platforms; the engines apply whatever this decides and audit the outcome.
 *
 * Rule per field: the copy with the newer version timestamp wins; ties go
 * to the server (authoritative clock). No special cases: a pending local
 * edit simply carries newer field timestamps, so it survives until pushed,
 * and the server makes the final call once the mutation is acked.
 */

export interface VersionedRecord {
  fields: Record<string, unknown>;
  fieldVersions: Record<string, number>;
  revision: number;
}

export interface MergeDecision {
  merged: VersionedRecord;
  /** Fields where the two sides disagreed and one side replaced the other. */
  conflicts: FieldConflict[];
}

export interface FieldConflict {
  field: string;
  winningValue: unknown;
  winningSide: "local" | "server";
  losingValue: unknown;
}

export function mergeRecords(local: VersionedRecord, server: VersionedRecord): MergeDecision {
  // Server tombstone with an older local edit on other fields: the edit's
  // timestamps win those fields; deleted_at itself follows the same LWW rule
  // below (no shortcut needed).
  const fields: Record<string, unknown> = { ...local.fields };
  const versions: Record<string, number> = { ...local.fieldVersions };
  const conflicts: FieldConflict[] = [];

  for (const [field, serverVersion] of Object.entries(server.fieldVersions)) {
    if (field in versions) {
      const localVersion = versions[field];
      const differs =
        JSON.stringify(fields[field]) !== JSON.stringify(server.fields[field]);
      // Ties (>=) go to the server clock.
      if (serverVersion >= localVersion) {
        fields[field] = server.fields[field];
        versions[field] = serverVersion;
        if (differs) {
          conflicts.push({
            field,
            winningValue: server.fields[field],
            winningSide: "server",
            losingValue: local.fields[field],
          });
        }
      } else if (differs) {
        conflicts.push({
          field,
          winningValue: local.fields[field],
          winningSide: "local",
          losingValue: server.fields[field],
        });
      }
    } else {
      // Field unknown locally (schema growth): adopt server state.
      fields[field] = server.fields[field];
      versions[field] = serverVersion;
    }
  }

  return {
    merged: { fields, fieldVersions: versions, revision: Math.max(local.revision, server.revision) },
    conflicts,
  };
}
