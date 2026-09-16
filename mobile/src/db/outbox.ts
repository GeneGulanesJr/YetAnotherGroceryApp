import {
  eq,
  getTableName,
  type InferInsertModel,
  type InferSelectModel,
  type Table,
} from "drizzle-orm";
import { getTableColumns } from "drizzle-orm";
import { syncMutations } from "./schema";
import { getDeviceId, newId, now } from "./context";
import type { Executor } from "./types";

/**
 * Insert/update/delete that stamp the shared sync columns and append a row to
 * the sync_mutations outbox so the future sync engine can drain it. Callers
 * pass domain fields only; the helpers own id/timestamps/deviceId/revision/
 * syncStatus/fieldVersionsJson. Operations spanning multiple tables must run
 * inside a repository-controlled transaction.
 */

const MANAGED_KEYS = [
  "id",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "deviceId",
  "revision",
  "syncStatus",
  "fieldVersionsJson",
] as const;

export function trackInsert<T extends Table>(
  db: Executor,
  table: T,
  values: InferInsertModel<T>,
): InferSelectModel<T> {
  const timestamp = now();
  const record = {
    ...values,
    id: newId(),
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    deviceId: getDeviceId(),
    revision: 0,
    syncStatus: "pending",
    fieldVersionsJson: initialFieldVersions(table, timestamp),
  } as InferInsertModel<T> & { id: string };

  db.insert(table)
    .values(record as never)
    .run();

  const saved = db
    .select()
    .from(table)
    .where(eq(idColumn(table), record.id))
    .get() as InferSelectModel<T>;

  appendMutation(db, getTableName(table), record.id, "insert", null, saved);
  return saved;
}

export function trackUpdate<T extends Table>(
  db: Executor,
  table: T,
  id: string,
  patch: Partial<InferInsertModel<T>>,
): InferSelectModel<T> | undefined {
  const existing = db
    .select()
    .from(table)
    .where(eq(idColumn(table), id))
    .get() as InferSelectModel<T> | undefined;
  if (existing === undefined) {
    return undefined;
  }

  const cleanPatch = stripManagedKeys(patch);
  const timestamp = now();
  const changedFields = Object.keys(cleanPatch);
  const merged = mergeFieldVersions(
    readFieldVersions(existing),
    changedFields,
    timestamp,
  );

  db.update(table)
    .set({
      ...cleanPatch,
      updatedAt: timestamp,
      syncStatus: "pending",
      fieldVersionsJson: merged,
    } as never)
    .where(eq(idColumn(table), id))
    .run();

  const saved = db
    .select()
    .from(table)
    .where(eq(idColumn(table), id))
    .get() as InferSelectModel<T>;

  appendMutation(db, getTableName(table), id, "update", changedFields, saved);
  return saved;
}

export function trackDelete<T extends Table>(
  db: Executor,
  table: T,
  id: string,
): boolean {
  const existing = db
    .select()
    .from(table)
    .where(eq(idColumn(table), id))
    .get() as InferSelectModel<T> | undefined;
  if (existing === undefined) {
    return false;
  }
  // Already tombstoned: deleting again must not append duplicate mutations.
  if ((existing as Record<string, unknown>)["deletedAt"] !== null) {
    return false;
  }

  const timestamp = now();
  const merged = mergeFieldVersions(
    readFieldVersions(existing),
    ["deletedAt"],
    timestamp,
  );

  db.update(table)
    .set({
      deletedAt: timestamp,
      updatedAt: timestamp,
      syncStatus: "pending",
      fieldVersionsJson: merged,
    } as never)
    .where(eq(idColumn(table), id))
    .run();

  appendMutation(db, getTableName(table), id, "delete", ["deletedAt"], {
    ...existing,
    deletedAt: timestamp,
    updatedAt: timestamp,
  });
  return true;
}

function appendMutation(
  db: Executor,
  tableName: string,
  recordId: string,
  operation: "insert" | "update" | "delete",
  changedFields: string[] | null,
  payload: Record<string, unknown>,
): void {
  db.insert(syncMutations)
    .values({
      id: newId(),
      tableName,
      recordId,
      operation,
      changedFieldsJson: changedFields === null ? null : JSON.stringify(changedFields),
      payloadJson: JSON.stringify(payload),
      deviceId: getDeviceId(),
      createdAt: now(),
      localRevision: 0,
      status: "pending",
    })
    .run();
}

function stripManagedKeys(patch: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (!(MANAGED_KEYS as readonly string[]).includes(key)) {
      clean[key] = value;
    }
  }
  return clean;
}

function idColumn(table: Table) {
  return getTableColumns(table)["id"];
}

function initialFieldVersions(table: Table, timestamp: Date): string {
  const versions: Record<string, number> = {};
  for (const column of Object.keys(getTableColumns(table))) {
    versions[column] = timestamp.getTime();
  }
  return JSON.stringify(versions);
}

function readFieldVersions(record: Record<string, unknown>): string | null {
  const raw = record["fieldVersionsJson"];
  return typeof raw === "string" ? raw : null;
}

function mergeFieldVersions(
  existingJson: string | null,
  changedFields: string[],
  timestamp: Date,
): string {
  const versions: Record<string, number> =
    existingJson === null ? {} : (JSON.parse(existingJson) as Record<string, number>);
  for (const field of changedFields) {
    versions[field] = timestamp.getTime();
  }
  return JSON.stringify(versions);
}
