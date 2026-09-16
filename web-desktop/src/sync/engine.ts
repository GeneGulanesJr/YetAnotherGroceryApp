/**
 * Desktop pull-side sync engine (tech.mobile.md "Sync Engine", ported from
 * `mobile/src/sync/engine.ts` onto the desktop's raw-SQL `SqlExecutor`
 * abstraction — tech.desktop.md "Desktop offline data access").
 *
 * Pull: `pullOnce` pages `transport.pullDelta(cursor)` until the server ends
 * the pass (`nextCursor: null`), applying every record through
 * `applyServerRecord` (INSERT for new ids, field-level LWW merge against the
 * existing row's `field_versions_json` for known ids) and auditing
 * conflicting fields into `sync_conflicts`. The delta cursor is persisted in
 * `sync_meta` under `sync_cursor` and only advances after a fully successful
 * pass, so a transport failure mid-pass leaves the previous cursor in place
 * and the next run replays the pages idempotently (re-applying an
 * already-applied record is a no-op: equal field versions never conflict).
 *
 * Push: TODO(sync-push) — the desktop replica has no mutation producers yet
 * (the desktop surface is analytics-only), so there is no outbox
 * (`sync_mutations`) to drain and nothing to enqueue. `pushOnce` below is an
 * explicit stub; when producers land, mirror the mobile engine's phase 1
 * (100-mutation batches, per-mutation results, 30s * 2^attempts backoff) and
 * add `pushBatch` to `SyncTransport` plus a `POST /sync/push` call in
 * transport.ts.
 *
 * No drizzle at this layer: the replica is read/written through Tauri's SQL
 * plugin at runtime (better-sqlite3 in tests), so protocol records arrive
 * with camelCase keys and are mapped to the snake_case SQL columns. Drizzle's
 * `timestamp_ms` columns are plain epoch-ms integers in raw SQL, so numbers
 * stay numbers end to end (no Date conversion at the SQL level).
 */

import type { SqlExecutor } from "@/lib/data-source";

import { mergeRecords, type VersionedRecord } from "./merge";
import type { PullDeltaResponse, SyncRecordDto } from "./protocol";

/** Injectable network boundary — the fetch implementation lives in transport.ts. */
export interface SyncTransport {
  pullDelta(cursor: string | null): Promise<PullDeltaResponse>;
  // TODO(sync-push): add `pushBatch(request: PushBatchRequest): Promise<PushBatchResponse>`
  // together with the engine's push path (see the module docs above).
}

export interface PullResult {
  status: "ok" | "error" | "unconfigured";
  pulled: number;
  conflicts: number;
  error?: string;
}

export const CURSOR_KEY = "sync_cursor";
const DEVICE_ID_KEY = "device_id";

/**
 * Wire table names -> replica SQL table names (both snake_case; the map is
 * the sync whitelist — unknown tableNames are skipped, mirroring the mobile
 * engine). Includes `receipt_aliases` (shared migration 0003), which the
 * mobile engine's map has not picked up yet.
 */
const SYNC_TABLES: Readonly<Record<string, string>> = {
  categories: "categories",
  images: "images",
  stores: "stores",
  products: "products",
  product_barcodes: "product_barcodes",
  prices: "prices",
  trips: "trips",
  receipts: "receipts",
  receipt_lines: "receipt_lines",
  purchases: "purchases",
  shopping_lists: "shopping_lists",
  shopping_list_items: "shopping_list_items",
  receipt_aliases: "receipt_aliases",
};

// ---------------------------------------------------------------------------
// camelCase (protocol) <-> snake_case (SQL) mapping
// ---------------------------------------------------------------------------

/** Protocol fields use drizzle's camelCase names; replica SQL columns are snake_case. */
export function camelToSnake(field: string): string {
  return field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export function snakeToCamel(column: string): string {
  return column.replace(/_([a-z0-9])/g, (_match, char: string) => char.toUpperCase());
}

/**
 * Column names of a replica table via the table-valued `pragma_table_info` —
 * a plain parameterized SELECT, so it runs identically under Tauri's sqlx and
 * better-sqlite3. `sqlTable` must come from the SYNC_TABLES whitelist.
 */
export async function tableColumns(
  executor: SqlExecutor,
  sqlTable: string,
  cache?: Map<string, Set<string>>,
): Promise<Set<string>> {
  const cached = cache?.get(sqlTable);
  if (cached !== undefined) {
    return cached;
  }
  const rows = await executor.select<{ name: string }>(
    "SELECT name FROM pragma_table_info(?)",
    [sqlTable],
  );
  const columns = new Set(rows.map((row) => row.name));
  cache?.set(sqlTable, columns);
  return columns;
}

// ---------------------------------------------------------------------------
// SQL helpers
// ---------------------------------------------------------------------------

/**
 * The shared `SqlExecutor` only exposes a parameterless `exec`, and
 * `INSERT ... RETURNING` through `select` is not portable to the Tauri
 * runtime (sqlx ships there without SQLite RETURNING support), so writes
 * inline their values as SQL literals. Only four value shapes cross the wire
 * (the protocol is drizzle-shaped scalar columns), and doubling `'` is the
 * complete escaping rule for SQLite string literals. Identifiers are never
 * user input: table names come from the SYNC_TABLES whitelist and column
 * names from `pragma_table_info`.
 */
function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) {
    return "NULL";
  }
  switch (typeof value) {
    case "number":
      if (!Number.isFinite(value)) {
        throw new Error(`cannot encode non-finite number as SQL literal: ${value}`);
      }
      return String(value);
    case "boolean":
      return value ? "1" : "0";
    case "string":
      return `'${value.replace(/'/g, "''")}'`;
    default:
      // Defensive: nested structures are encoded as JSON text.
      return sqlLiteral(JSON.stringify(value));
  }
}

async function getMetaValue(executor: SqlExecutor, key: string): Promise<string | null> {
  const rows = await executor.select<{ value: string | null }>(
    "SELECT value FROM sync_meta WHERE key = ?",
    [key],
  );
  const value = rows[0]?.value ?? null;
  return value === null || value === "" ? null : value;
}

async function setMetaValue(executor: SqlExecutor, key: string, value: string): Promise<void> {
  await executor.exec(
    `INSERT INTO sync_meta (key, value, updated_at)
     VALUES (${sqlLiteral(key)}, ${sqlLiteral(value)}, ${Date.now()})
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  );
}

let idCounter = 0;

/** Id for local audit rows. Not a crypto UUID on purpose: the webview crypto
 * surface varies across platforms and tests run under jsdom; monotonic local
 * ids only need to be unique within this replica. */
function newId(): string {
  idCounter += 1;
  return `sync-${Date.now().toString(36)}-${idCounter.toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// Apply (server record -> replica row)
// ---------------------------------------------------------------------------

/** Local row (snake_case SQL keys) -> camelCase versioned record for the merge. */
function toLocalRecord(row: Record<string, unknown>): VersionedRecord {
  const fields: Record<string, unknown> = {};
  for (const [column, value] of Object.entries(row)) {
    fields[snakeToCamel(column)] = value;
  }
  const versionsJson = row["field_versions_json"];
  const fieldVersions =
    typeof versionsJson === "string" && versionsJson !== ""
      ? (JSON.parse(versionsJson) as Record<string, number>)
      : {};
  return {
    fields,
    fieldVersions,
    revision: typeof row["revision"] === "number" ? row["revision"] : 0,
  };
}

/**
 * Applies one server record: insert, field-merge, or tombstone — always
 * through the LWW merge, with conflicting fields audited into
 * `sync_conflicts`. Returns the number of conflicting fields recorded.
 */
export async function applyServerRecord(
  executor: SqlExecutor,
  record: SyncRecordDto,
  localDeviceId: string,
  columnsCache?: Map<string, Set<string>>,
): Promise<number> {
  const sqlTable = SYNC_TABLES[record.tableName];
  if (sqlTable === undefined) {
    return 0;
  }
  const recordId = record.fields["id"] as string;
  const columns = await tableColumns(executor, sqlTable, columnsCache);

  const existingRows = await executor.select<Record<string, unknown>>(
    `SELECT * FROM ${sqlTable} WHERE id = ?`,
    [recordId],
  );
  const existing = existingRows[0];

  const local: VersionedRecord =
    existing === undefined ? { fields: {}, fieldVersions: {}, revision: 0 } : toLocalRecord(existing);
  const server: VersionedRecord = {
    fields: record.fields,
    fieldVersions: record.fieldVersions,
    revision: record.revision,
  };

  const decision = mergeRecords(local, server);

  // Start from the full server row: the merge only carries fields listed in
  // the server's version map, so sync columns (id, timestamps, ...) must come
  // from somewhere on fresh inserts. For existing rows the merged view
  // already contains the full local row and simply overrides it.
  const mergedWire: Record<string, unknown> = { ...record.fields, ...decision.merged.fields };
  mergedWire["revision"] = decision.merged.revision;
  mergedWire["syncStatus"] = "synced";
  mergedWire["fieldVersionsJson"] = JSON.stringify(decision.merged.fieldVersions);
  mergedWire["deviceId"] =
    (existing?.["device_id"] as string | undefined) ?? record.fields["deviceId"] ?? localDeviceId;

  // camelCase wire fields -> snake_case columns, keeping only real columns so
  // schema drift on either side degrades gracefully instead of failing.
  // `undefined` values (a field versioned by the server but absent from its
  // field map — protocol violation) are skipped rather than written as NULL.
  const row: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(mergedWire)) {
    if (value === undefined) {
      continue;
    }
    const column = camelToSnake(field);
    if (columns.has(column)) {
      row[column] = value;
    }
  }
  row["created_at"] ??= Date.now();
  row["updated_at"] ??= Date.now();

  if (existing === undefined) {
    const columnsSql = Object.keys(row).join(", ");
    const valuesSql = Object.values(row)
      .map(sqlLiteral)
      .join(", ");
    await executor.exec(`INSERT INTO ${sqlTable} (${columnsSql}) VALUES (${valuesSql})`);
  } else {
    const assignments = Object.keys(row)
      .filter((column) => column !== "id")
      .map((column) => `${column} = ${sqlLiteral(row[column])}`)
      .join(", ");
    await executor.exec(`UPDATE ${sqlTable} SET ${assignments} WHERE id = ${sqlLiteral(recordId)}`);
  }

  const localDeviceForAudit =
    (existing?.["device_id"] as string | undefined) ?? localDeviceId;
  for (const conflict of decision.conflicts) {
    await executor.exec(
      `INSERT INTO sync_conflicts (
         id, created_at, table_name, record_id, field, winning_side,
         winning_value_json, losing_value_json, local_revision, remote_revision,
         local_device_id, remote_device_id
       ) VALUES (
         ${sqlLiteral(newId())}, ${Date.now()}, ${sqlLiteral(record.tableName)},
         ${sqlLiteral(recordId)}, ${sqlLiteral(conflict.field)}, ${sqlLiteral(conflict.winningSide)},
         ${sqlLiteral(JSON.stringify(conflict.winningValue ?? null))},
         ${sqlLiteral(JSON.stringify(conflict.losingValue ?? null))},
         ${local.revision}, ${record.revision},
         ${sqlLiteral(localDeviceForAudit)},
         ${sqlLiteral((record.fields["deviceId"] as string | undefined) ?? null)}
       )`,
    );
  }
  return decision.conflicts.length;
}

// ---------------------------------------------------------------------------
// Pull pass
// ---------------------------------------------------------------------------

export interface PullOptions {
  /** Overrides the replica `device_id` used for conflict audit attribution. */
  deviceId?: string;
}

/**
 * One full pull pass: page the server delta from the persisted cursor and
 * apply each record with field-level LWW. Idempotent and retriable — the
 * cursor only advances on a fully successful pass. Pass `transport: null`
 * when no backend is configured (reports "unconfigured", touches nothing).
 */
export async function pullOnce(
  executor: SqlExecutor,
  transport: SyncTransport | null,
  options: PullOptions = {},
): Promise<PullResult> {
  if (transport === null) {
    return { status: "unconfigured", pulled: 0, conflicts: 0 };
  }
  const localDeviceId =
    options.deviceId ?? (await getMetaValue(executor, DEVICE_ID_KEY)) ?? "desktop";

  const columnsCache = new Map<string, Set<string>>();
  let cursor = await getMetaValue(executor, CURSOR_KEY);
  const freshStart = cursor === null;
  let pulled = 0;
  let conflicts = 0;
  try {
    for (;;) {
      const page: PullDeltaResponse = await transport.pullDelta(freshStart ? null : cursor);
      for (const record of page.records) {
        conflicts += await applyServerRecord(executor, record, localDeviceId, columnsCache);
        pulled += 1;
      }
      if (page.nextCursor === null) {
        break;
      }
      cursor = page.nextCursor;
    }
  } catch (cause) {
    // Cursor not persisted: the next run replays the pass idempotently.
    return {
      status: "error",
      pulled,
      conflicts,
      error: cause instanceof Error ? cause.message : "pull failed",
    };
  }
  // Terminal state (nextCursor: null) stores "" which getSyncCursor normalizes
  // back to null — the replica is fully caught up.
  await setMetaValue(executor, CURSOR_KEY, cursor ?? "");
  return { status: "ok", pulled, conflicts };
}

/** The persisted pull cursor, or null when the replica is fully caught up. */
export async function getSyncCursor(executor: SqlExecutor): Promise<string | null> {
  return getMetaValue(executor, CURSOR_KEY);
}

// ---------------------------------------------------------------------------
// Push pass (stub)
// ---------------------------------------------------------------------------

export interface PushResult {
  pushed: number;
  failed: number;
}

/**
 * TODO(sync-push): desktop stub. The SQLite replica has no mutation producers
 * yet, so there is no outbox to drain and nothing to push. When producers
 * land, port the mobile engine's push phase (batched `sync_mutations` drain,
 * per-mutation accept/reject results, 30s * 2^attempts backoff, and marking
 * merged records `synced` with the server-assigned revision).
 */
export async function pushOnce(
  _executor: SqlExecutor,
  _transport: SyncTransport,
): Promise<PushResult> {
  throw new Error(
    "desktop push sync is not implemented yet: the SQLite replica has no mutation producers",
  );
}
