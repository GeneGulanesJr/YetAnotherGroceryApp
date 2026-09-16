/**
 * Server-side application of pushed mutations (POST /sync/push).
 *
 * Contract highlights (tech.mobile.md "Sync Engine" / "Conflict Resolution"):
 * - Idempotency: every mutation id is applied at most once. Results are
 *   recorded in `sync_mutations_applied` in the same transaction as the
 *   apply; a re-push replays the stored result verbatim.
 * - Authoritative clocks: the server stamps createdAt/updatedAt/deletedAt and
 *   every field version with its own apply time. Client-sent timestamps
 *   (including a far-future mutation.createdAt) are never stored, so device
 *   clock skew cannot influence ordering.
 * - Revision assignment: monotonic per record (prior revision + 1); inserts
 *   start at 1.
 * - LWW per field: mutations apply in `createdAt` order, so the later write
 *   of a field wins; because field versions are server-assigned there are no
 *   ties server-side (the server clock is the tiebreaker by construction).
 * - Tombstones: deletes set deleted_at and never hard-delete. Re-deleting a
 *   tombstone is an accepted no-op; updating a tombstone is rejected.
 * - Conflicts: when a pushed change overwrites a field whose stored value
 *   differs and was last written by a DIFFERENT device, a `sync_conflicts`
 *   audit row records both values, both devices, and both revisions.
 * - The server always owns updatedAt/revision/syncStatus on accepted writes.
 */
import { eq, getTableColumns } from "drizzle-orm";
import type { Table } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";

import { newId } from "../ids.js";
import type { ApiDb } from "../db/client.js";
import { MANAGED_FIELDS, SYNC_TABLES, TIMESTAMP_FIELDS, type SyncTableSpec } from "../db/registry.js";
import { syncConflicts, syncMutationsApplied } from "../db/schema.js";
import type { PushMutationResult, SyncMutationDto, SyncOperation } from "../protocol.js";
import { encodeCursor } from "./cursor.js";

const OPERATIONS: ReadonlySet<string> = new Set<SyncOperation>(["insert", "update", "delete"]);

export class BatchValidationError extends Error {}

interface LedgerRow {
  mutation_id: string;
  accepted: number;
  revision: number;
  updated_at: number;
  error: string | null;
}

/**
 * Applies a push batch and returns per-mutation results plus the head cursor.
 * Malformed batches (bad envelope) throw BatchValidationError -> HTTP 400.
 * Per-mutation problems (unknown table, constraint violations, ...) produce
 * accepted:false results and are ledgered so re-pushes replay them.
 */
export function applyPushBatch(
  db: ApiDb,
  headerDeviceId: string,
  mutations: unknown,
): { results: PushMutationResult[]; cursor: string | null } {
  if (!Array.isArray(mutations)) {
    throw new BatchValidationError("mutations must be an array");
  }
  for (const raw of mutations) {
    assertShape(raw);
  }

  // LWW order is apply order: sort by client mutation time, tie-break by id,
  // so a re-ordered retransmission cannot change the outcome.
  const ordered = [...(mutations as SyncMutationDto[])].sort((a, b) => {
    const byTime = a.createdAt - b.createdAt;
    return byTime !== 0 ? byTime : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const results: PushMutationResult[] = [];
  const seen = new Set<string>();
  for (const mutation of ordered) {
    if (seen.has(mutation.id)) {
      continue; // duplicate id within one batch: first occurrence already applied
    }
    seen.add(mutation.id);
    results.push(applyOrReplay(db, headerDeviceId, mutation));
  }

  return { results, cursor: headCursor(db) };
}

/**
 * Server-authoritative apply clock, strictly increasing across all applies:
 * wall clock when it advances, last+1ms when several mutations land within
 * the same millisecond. Guarantees distinct field versions (no LWW ties
 * server-side) while staying within real time.
 */
let lastAppliedAt = 0;
function authoritativeNow(): number {
  const now = Date.now();
  lastAppliedAt = now > lastAppliedAt ? now : lastAppliedAt + 1;
  return lastAppliedAt;
}

function assertShape(raw: unknown): asserts raw is SyncMutationDto {
  if (typeof raw !== "object" || raw === null) {
    throw new BatchValidationError("each mutation must be an object");
  }
  const mutation = raw as Record<string, unknown>;
  for (const field of ["id", "tableName", "recordId", "operation", "deviceId"] as const) {
    if (typeof mutation[field] !== "string" || (mutation[field] as string) === "") {
      throw new BatchValidationError(`mutation.${field} must be a non-empty string`);
    }
  }
  if (typeof mutation.createdAt !== "number" || !Number.isFinite(mutation.createdAt)) {
    throw new BatchValidationError("mutation.createdAt must be a number");
  }
  if (
    mutation.changedFields !== null &&
    mutation.changedFields !== undefined &&
    !isStringArray(mutation.changedFields)
  ) {
    throw new BatchValidationError("mutation.changedFields must be an array of strings or null");
  }
  if (mutation.payload !== null && mutation.payload !== undefined) {
    if (typeof mutation.payload !== "object" || Array.isArray(mutation.payload)) {
      throw new BatchValidationError("mutation.payload must be an object or null");
    }
  }
  if (mutation.localRevision !== undefined && typeof mutation.localRevision !== "number") {
    throw new BatchValidationError("mutation.localRevision must be a number");
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/** Replays the ledgered result when the mutation was already processed. */
function applyOrReplay(db: ApiDb, headerDeviceId: string, mutation: SyncMutationDto): PushMutationResult {
  const ledgered = db.sqlite
    .prepare(
      `SELECT mutation_id, accepted, revision, updated_at, error
       FROM sync_mutations_applied WHERE mutation_id = ?`,
    )
    .get(mutation.id) as LedgerRow | undefined;
  if (ledgered !== undefined) {
    return {
      mutationId: ledgered.mutation_id,
      accepted: ledgered.accepted === 1,
      revision: ledgered.revision,
      updatedAt: ledgered.updated_at,
      ...(ledgered.error === null ? {} : { error: ledgered.error }),
    };
  }

  const appliedAt = authoritativeNow();
  try {
    // better-sqlite3 native transaction: the drizzle handle below runs on the
    // same connection, so every statement here is inside BEGIN...COMMIT.
    const runInTransaction = db.sqlite.transaction(() => {
      const result = applyMutation(db, mutation, headerDeviceId, appliedAt);
      recordLedger(db, mutation, result, appliedAt);
      return result;
    });
    return runInTransaction() as PushMutationResult;
  } catch (cause) {
    // Constraint/DB failures reject only this mutation; the batch continues.
    const message = cause instanceof Error ? cause.message : "apply failed";
    const result: PushMutationResult = {
      mutationId: mutation.id,
      accepted: false,
      revision: 0,
      updatedAt: appliedAt,
      error: message,
    };
    recordLedger(db, mutation, result, appliedAt);
    return result;
  }
}

function applyMutation(
  db: ApiDb,
  mutation: SyncMutationDto,
  headerDeviceId: string,
  appliedAt: number,
): PushMutationResult {
  const spec = SYNC_TABLES[mutation.tableName];
  if (spec === undefined) {
    return rejected(mutation.id, `unknown table "${mutation.tableName}"`);
  }
  if (!OPERATIONS.has(mutation.operation)) {
    return rejected(mutation.id, `invalid operation "${mutation.operation}"`);
  }
  if (mutation.deviceId !== headerDeviceId) {
    return rejected(mutation.id, "mutation.deviceId does not match authenticated device");
  }

  const existing = loadRecord(db, spec, mutation.recordId);

  if (mutation.operation === "insert") {
    return applyInsert(db, spec, mutation, existing, appliedAt);
  }
  if (existing === undefined) {
    return rejected(mutation.id, "record not found");
  }
  if (mutation.operation === "update") {
    return applyUpdate(db, spec, mutation, existing, appliedAt);
  }
  return applyDelete(db, spec, mutation, existing, appliedAt);
}

// ---------------------------------------------------------------------------
// Per-operation apply
// ---------------------------------------------------------------------------

function applyInsert(
  db: ApiDb,
  spec: SyncTableSpec,
  mutation: SyncMutationDto,
  existing: Record<string, unknown> | undefined,
  appliedAt: number,
): PushMutationResult {
  if (existing !== undefined) {
    return rejected(mutation.id, "record already exists");
  }
  const payload = mutation.payload;
  if (payload === null || payload === undefined) {
    return rejected(mutation.id, "insert requires a payload");
  }
  if (typeof payload["id"] === "string" && payload["id"] !== mutation.recordId) {
    return rejected(mutation.id, "payload.id does not match recordId");
  }

  // Domain fields only; the server owns the sync columns.
  const fields: Record<string, unknown> = {};
  for (const field of spec.domainColumns) {
    if (field in payload) {
      fields[field] = normalizeIncoming(field, spec.columns[field], payload[field]);
    }
  }

  const row: Record<string, unknown> = {
    ...fields,
    id: mutation.recordId,
    createdAt: appliedAt,
    updatedAt: appliedAt,
    deletedAt: null, // inserts are live records; deletes go through "delete"
    deviceId: mutation.deviceId,
    revision: 1,
    syncStatus: "synced",
    fieldVersionsJson: JSON.stringify(initialFieldVersions(spec, appliedAt)),
    serverSeq: nextServerSeq(db),
  };

  db.drizzle.insert(spec.table).values(row as never).run();
  return accepted(mutation.id, row.revision as number, appliedAt);
}

function applyUpdate(
  db: ApiDb,
  spec: SyncTableSpec,
  mutation: SyncMutationDto,
  existing: Record<string, unknown>,
  appliedAt: number,
): PushMutationResult {
  if (existing["deletedAt"] !== null && existing["deletedAt"] !== undefined) {
    return rejected(mutation.id, "record is deleted (tombstone)");
  }
  const requested = mutation.changedFields ?? payloadDomainKeys(mutation.payload);
  const changed = requested.filter(
    (field) => spec.domainColumns.includes(field) && mutation.payload !== null && field in mutation.payload,
  );
  if (changed.length === 0) {
    return rejected(mutation.id, "no changed fields to apply");
  }

  const fieldVersions = parseFieldVersions(existing["fieldVersionsJson"]);
  const revision = (existing["revision"] as number) + 1;
  const values: Record<string, unknown> = {};
  for (const field of changed) {
    const incoming = normalizeIncoming(field, spec.columns[field], mutation.payload?.[field]);
    values[field] = incoming;
    fieldVersions[field] = appliedAt;
    auditConflictIfNeeded(db, spec, mutation, existing, field, incoming, revision, appliedAt);
  }

  db.drizzle
    .update(spec.table)
    .set(
      {
        ...values,
        updatedAt: appliedAt,
        revision,
        syncStatus: "synced",
        deviceId: mutation.deviceId, // last-writer device (prior writer kept in conflicts)
        fieldVersionsJson: JSON.stringify(fieldVersions),
        serverSeq: nextServerSeq(db),
      } as never,
    )
    .where(eq(spec.columns["id"], mutation.recordId))
    .run();
  return accepted(mutation.id, revision, appliedAt);
}

function applyDelete(
  db: ApiDb,
  spec: SyncTableSpec,
  mutation: SyncMutationDto,
  existing: Record<string, unknown>,
  appliedAt: number,
): PushMutationResult {
  const priorDeletedAt = existing["deletedAt"];
  if (priorDeletedAt !== null && priorDeletedAt !== undefined) {
    // Already a tombstone: accepted no-op, nothing changes (still idempotent).
    return accepted(mutation.id, existing["revision"] as number, existing["updatedAt"] as number);
  }

  const revision = (existing["revision"] as number) + 1;
  const fieldVersions = parseFieldVersions(existing["fieldVersionsJson"]);
  fieldVersions["deletedAt"] = appliedAt;
  auditConflictIfNeeded(db, spec, mutation, existing, "deletedAt", appliedAt, revision, appliedAt);

  db.drizzle
    .update(spec.table)
    .set(
      {
        deletedAt: appliedAt,
        updatedAt: appliedAt,
        revision,
        syncStatus: "synced",
        deviceId: mutation.deviceId,
        fieldVersionsJson: JSON.stringify(fieldVersions),
        serverSeq: nextServerSeq(db),
      } as never,
    )
    .where(eq(spec.columns["id"], mutation.recordId))
    .run();
  return accepted(mutation.id, revision, appliedAt);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function accepted(mutationId: string, revision: number, updatedAt: number): PushMutationResult {
  return { mutationId, accepted: true, revision, updatedAt };
}

function rejected(mutationId: string, error: string): PushMutationResult {
  return { mutationId, accepted: false, revision: 0, updatedAt: 0, error };
}

/** Fallback when changedFields is null on an update: use the payload's domain keys. */
function payloadDomainKeys(payload: Record<string, unknown> | null): string[] {
  if (payload === null) {
    return [];
  }
  return Object.keys(payload).filter((key) => !MANAGED_FIELDS.has(key));
}

function loadRecord(
  db: ApiDb,
  spec: SyncTableSpec,
  recordId: string,
): Record<string, unknown> | undefined {
  const row = db.drizzle
    .select()
    .from(spec.table)
    .where(eq(spec.columns["id"], recordId))
    .get() as Record<string, unknown> | undefined;
  return row;
}

/** Global monotonic change counter driving pull cursors (sync_meta.server_seq). */
export function nextServerSeq(db: ApiDb): number {
  const row = db.sqlite
    .prepare(
      `UPDATE sync_meta SET value = CAST(value AS INTEGER) + 1, updated_at = ?
       WHERE key = 'server_seq' RETURNING CAST(value AS INTEGER) AS seq`,
    )
    .get(Date.now()) as { seq: number } | undefined;
  if (row === undefined) {
    throw new Error("server_seq counter missing — run migrations");
  }
  return row.seq;
}

/** Head cursor handed back with push responses (protocol: cursor checkpoint). */
export function headCursor(db: ApiDb): string | null {
  const row = db.sqlite.prepare(`SELECT value FROM sync_meta WHERE key = 'server_seq'`).get() as
    | { value: string | null }
    | undefined;
  const seq = Number(row?.value ?? "0");
  return encodeCursor(Number.isFinite(seq) && seq > 0 ? seq : 0);
}

function initialFieldVersions(spec: SyncTableSpec, appliedAt: number): Record<string, number> {
  // Mirrors the client outbox: every column starts versioned at write time.
  const versions: Record<string, number> = {};
  for (const column of spec.allColumns) {
    if (column !== "serverSeq") {
      versions[column] = appliedAt;
    }
  }
  return versions;
}

export function parseFieldVersions(raw: unknown): Record<string, number> {
  if (typeof raw !== "string" || raw === "") {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      const out: Record<string, number> = {};
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof value === "number") {
          out[key] = value;
        }
      }
      return out;
    }
  } catch {
    // fall through
  }
  return {};
}

/**
 * Coerces wire values to storage values: timestamps accept epoch ms or ISO
 * strings (the client outbox JSON-serializes Date objects to ISO strings);
 * booleans become 0/1 for integer columns.
 */
export function normalizeIncoming(
  field: string,
  column: SQLiteColumn | undefined,
  value: unknown,
): unknown {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }
  const columnType: string = column?.columnType ?? "";
  if (columnType.includes("Integer") && TIMESTAMP_FIELDS.has(field)) {
    return toEpochMs(value);
  }
  return value;
}

function toEpochMs(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  throw new Error(`invalid timestamp value: ${JSON.stringify(value) ?? "undefined"}`);
}

/**
 * Conflict audit: cross-device divergence on a field (stored value differs,
 * prior writer is a different device). "local" side = prior stored state,
 * "remote" side = the incoming mutation that the server accepted.
 */
function auditConflictIfNeeded(
  db: ApiDb,
  spec: SyncTableSpec,
  mutation: SyncMutationDto,
  existing: Record<string, unknown>,
  field: string,
  incoming: unknown,
  newRevision: number,
  appliedAt: number,
): void {
  const prior = existing[field];
  const priorDeviceId = existing["deviceId"];
  if (JSON.stringify(prior ?? null) === JSON.stringify(incoming ?? null)) {
    return;
  }
  if (typeof priorDeviceId === "string" && priorDeviceId === mutation.deviceId) {
    return; // same device rewriting history is an update, not a conflict
  }
  db.drizzle
    .insert(syncConflicts)
    .values({
      id: newId(),
      createdAt: appliedAt,
      tableName: spec.name,
      recordId: mutation.recordId,
      field,
      winningSide: "server", // incoming push became the server-canonical value
      winningValueJson: JSON.stringify(incoming ?? null),
      losingValueJson: JSON.stringify(prior ?? null),
      localRevision: existing["revision"] as number,
      remoteRevision: newRevision,
      localDeviceId: typeof priorDeviceId === "string" ? priorDeviceId : null,
      remoteDeviceId: mutation.deviceId,
    })
    .run();
}

function recordLedger(db: ApiDb, mutation: SyncMutationDto, result: PushMutationResult, appliedAt: number): void {
  db.drizzle
    .insert(syncMutationsApplied)
    .values({
      mutationId: mutation.id,
      deviceId: mutation.deviceId,
      tableName: mutation.tableName,
      recordId: mutation.recordId,
      operation: mutation.operation,
      accepted: result.accepted ? 1 : 0,
      revision: result.revision,
      updatedAt: result.updatedAt,
      error: result.error ?? null,
      appliedAt,
    })
    .run();
}

// Re-exported for pull serialization (single source of column truth).
export function tableColumns(table: Table): Record<string, SQLiteColumn> {
  return getTableColumns(table) as Record<string, SQLiteColumn>;
}
