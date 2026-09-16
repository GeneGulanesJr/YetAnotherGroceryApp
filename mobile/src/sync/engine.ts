import { asc, eq, getTableColumns, inArray } from "drizzle-orm";
import type { Table } from "drizzle-orm";

import { newId, now } from "../db/context";
import { getMetaValue, setMetaValue } from "../db/repositories/meta";
import { syncConflicts, syncMutations } from "../db/schema";
import * as schema from "../db/schema";
import type { Db } from "../db/types";
import { mergeRecords, type VersionedRecord } from "./merge";
import type {
  PullDeltaResponse,
  PushBatchResponse,
  PushMutationResult,
  SyncMutationDto,
  SyncRecordDto,
} from "./protocol";

/** Injectable network boundary — the fetch implementation lives in transport.ts. */
export interface SyncTransport {
  pushBatch(request: {
    deviceId: string;
    mutations: SyncMutationDto[];
  }): Promise<PushBatchResponse>;
  pullDelta(cursor: string | null): Promise<PullDeltaResponse>;
}

export interface SyncRunResult {
  status: "ok" | "partial" | "error" | "unconfigured";
  pushed: number;
  pushFailed: number;
  pulled: number;
  conflicts: number;
  error?: string;
}

export const CURSOR_KEY = "sync_cursor";
const PUSH_BATCH_SIZE = 100;
const TIMESTAMP_COLUMNS = new Set([
  "createdAt",
  "updatedAt",
  "deletedAt",
  "capturedAt",
  "startedAt",
  "endedAt",
  "purchasedAt",
  "verifiedAt",
  "archivedAt",
]);

/** Exponential backoff: 30s * 2^attempts, capped at 1h. */
function backoffMs(attempts: number): number {
  return Math.min(30_000 * 2 ** attempts, 3_600_000);
}

/** Drizzle tables that participate in sync, by wire table name. */
const SYNC_TABLES: Readonly<Record<string, Table>> = {
  categories: schema.categories,
  images: schema.images,
  stores: schema.stores,
  products: schema.products,
  product_barcodes: schema.productBarcodes,
  prices: schema.prices,
  trips: schema.trips,
  receipts: schema.receipts,
  receipt_lines: schema.receiptLines,
  purchases: schema.purchases,
  shopping_lists: schema.shoppingLists,
  shopping_list_items: schema.shoppingListItems,
};

/**
 * One full sync pass: push pending outbox mutations in batches, then pull
 * deltas from the server cursor and apply them with field-level LWW,
 * auditing conflicts. Idempotent, retriable, and safe to run offline —
 * transport errors leave the outbox pending with backoff.
 */
export async function runSync(db: Db, transport: SyncTransport | null): Promise<SyncRunResult> {
  if (transport === null) {
    return { status: "unconfigured", pushed: 0, pushFailed: 0, pulled: 0, conflicts: 0 };
  }

  const deviceId = getMetaValue(db, "device_id");
  if (deviceId === null) {
    return {
      status: "error", pushed: 0, pushFailed: 0, pulled: 0, conflicts: 0,
      error: "device id not initialized",
    };
  }

  let pushed = 0;
  let pushFailed = 0;
  let pulled = 0;
  let conflicts = 0;
  const errors: string[] = [];

  // ---- Phase 1: push -------------------------------------------------
  for (;;) {
    const pending = db
      .select()
      .from(syncMutations)
      .where(eq(syncMutations.status, "pending"))
      .orderBy(asc(syncMutations.createdAt))
      .limit(PUSH_BATCH_SIZE)
      .all();

    // Backoff gate: mutations that failed recently wait before retrying.
    const batch = pending.filter((mutation) =>
      mutation.attempts === 0 || mutation.lastAttemptAt === null
        ? true
        : now().getTime() - mutation.lastAttemptAt.getTime() >= backoffMs(mutation.attempts),
    );
    if (batch.length === 0) {
      break;
    }

    const dtos: SyncMutationDto[] = batch.map((mutation) => ({
      id: mutation.id,
      tableName: mutation.tableName,
      recordId: mutation.recordId,
      operation: mutation.operation,
      changedFields:
        mutation.changedFieldsJson === null
          ? null
          : (JSON.parse(mutation.changedFieldsJson) as string[]),
      payload:
        mutation.payloadJson === null
          ? null
          : (JSON.parse(mutation.payloadJson) as Record<string, unknown>),
      deviceId: mutation.deviceId,
      createdAt: mutation.createdAt.getTime(),
      localRevision: mutation.localRevision ?? 0,
    }));

    db.update(syncMutations)
      .set({ status: "uploading" })
      .where(
        inArray(
          syncMutations.id,
          batch.map((m) => m.id),
        ),
      )
      .run();

    let response: PushBatchResponse;
    try {
      response = await transport.pushBatch({ deviceId, mutations: dtos });
    } catch (cause) {
      pushFailed += batch.length;
      revertToPending(
        db,
        batch.map((m) => ({ id: m.id, attempts: m.attempts })),
        cause,
      );
      errors.push(cause instanceof Error ? cause.message : "push failed");
      break;
    }

    const byMutationId = new Map(response.results.map((result) => [result.mutationId, result]));
    for (const mutation of batch) {
      const result = byMutationId.get(mutation.id);
      if (result === undefined) {
        pushFailed += 1;
        revertToPending(db, [{ id: mutation.id, attempts: mutation.attempts }], new Error("missing server result"));
        continue;
      }
      if (result.accepted) {
        pushed += 1;
        db.update(syncMutations)
          .set({ status: "applied", attempts: mutation.attempts + 1, lastAttemptAt: now(), error: null })
          .where(eq(syncMutations.id, mutation.id))
          .run();
        markRecordSynced(db, mutation.tableName, mutation.recordId, result);
      } else {
        pushFailed += 1;
        db.update(syncMutations)
          .set({
            status: "error",
            attempts: mutation.attempts + 1,
            lastAttemptAt: now(),
            error: result.error ?? "rejected",
          })
          .where(eq(syncMutations.id, mutation.id))
          .run();
      }
    }
  }

  // ---- Phase 2: pull -------------------------------------------------
  try {
    let cursor = getMetaValue(db, CURSOR_KEY);
    const empty = cursor === null || cursor === "";
    for (;;) {
      const page: PullDeltaResponse = await transport.pullDelta(empty ? null : cursor);
      for (const record of page.records) {
        conflicts += applyServerRecord(db, record, deviceId);
        pulled += 1;
      }
      if (page.nextCursor === null) {
        break;
      }
      cursor = page.nextCursor;
    }
    setMetaValue(db, CURSOR_KEY, cursor ?? "");
  } catch (cause) {
    errors.push(cause instanceof Error ? cause.message : "pull failed");
  }

  const status: SyncRunResult["status"] =
    errors.length === 0 ? "ok" : pushed > 0 || pulled > 0 ? "partial" : "error";
  return { status, pushed, pushFailed, pulled, conflicts, error: errors[0] };
}

function revertToPending(
  db: Db,
  mutations: readonly { id: string; attempts: number }[],
  cause: unknown,
): void {
  if (mutations.length === 0) {
    return;
  }
  const message = cause instanceof Error ? cause.message : "network error";
  for (const mutation of mutations) {
    // attempts + lastAttemptAt drive the exponential backoff on retry.
    db.update(syncMutations)
      .set({ status: "pending", attempts: mutation.attempts + 1, lastAttemptAt: now(), error: message })
      .where(eq(syncMutations.id, mutation.id))
      .run();
  }
}

function markRecordSynced(
  db: Db,
  tableName: string,
  recordId: string,
  result: PushMutationResult,
): void {
  const table = SYNC_TABLES[tableName];
  if (table === undefined) {
    return;
  }
  db.update(table)
    .set({
      syncStatus: "synced",
      revision: result.revision,
      updatedAt: new Date(result.updatedAt),
    } as never)
    .where(eq(getTableColumns(table)["id"], recordId))
    .run();
}

/**
 * Applies one server record: insert, field-merge, or tombstone — always
 * through the LWW merge, with conflicts audited. Returns the number of
 * conflicting fields recorded.
 */
function applyServerRecord(db: Db, record: SyncRecordDto, localDeviceId: string): number {
  const table = SYNC_TABLES[record.tableName];
  if (table === undefined) {
    return 0;
  }
  const idColumn = getTableColumns(table)["id"];
  const existing = db
    .select()
    .from(table)
    .where(eq(idColumn, record.fields["id"] as string))
    .get() as Record<string, unknown> | undefined;

  const local: VersionedRecord = {
    fields: existing ?? {},
    fieldVersions:
      existing === undefined || existing["fieldVersionsJson"] === null
        ? {}
        : (JSON.parse(existing["fieldVersionsJson"] as string) as Record<string, number>),
    revision: (existing?.["revision"] as number | undefined) ?? 0,
  };
  const server: VersionedRecord = {
    fields: record.fields,
    fieldVersions: record.fieldVersions,
    revision: record.revision,
  };

  const decision = mergeRecords(local, server);
  // Start from the full server row: the merge only carries fields listed in
  // the server's version map, so sync columns (id, timestamps, …) must come
  // from somewhere on fresh inserts. For existing rows the merged view
  // already contains the full local row and simply overrides it.
  const merged: Record<string, unknown> = { ...record.fields, ...decision.merged.fields };
  merged["revision"] = decision.merged.revision;
  merged["syncStatus"] = "synced";
  merged["fieldVersionsJson"] = JSON.stringify(decision.merged.fieldVersions);
  merged["deviceId"] = existing?.["deviceId"] ?? record.fields["deviceId"] ?? localDeviceId;
  const prepared = datesFromNumbers(merged);

  if (existing === undefined) {
    prepared["createdAt"] ??= now();
    prepared["updatedAt"] ??= now();
    db.insert(table).values(prepared as never).run();
  } else {
    db.update(table)
      .set(prepared as never)
      .where(eq(idColumn, record.fields["id"] as string))
      .run();
  }

  for (const conflict of decision.conflicts) {
    db.insert(syncConflicts)
      .values({
        id: newId(),
        createdAt: now(),
        tableName: record.tableName,
        recordId: record.fields["id"] as string,
        field: conflict.field,
        winningSide: conflict.winningSide,
        winningValueJson: JSON.stringify(conflict.winningValue ?? null),
        losingValueJson: JSON.stringify(conflict.losingValue ?? null),
        localRevision: local.revision,
        remoteRevision: record.revision,
        localDeviceId: (existing?.["deviceId"] as string | undefined) ?? localDeviceId,
        remoteDeviceId: (record.fields["deviceId"] as string | undefined) ?? null,
      })
      .run();
  }
  return decision.conflicts.length;
}

/** drizzle timestamp_ms columns expect Date objects, not epoch numbers. */
function datesFromNumbers(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...fields };
  for (const key of Object.keys(out)) {
    if (TIMESTAMP_COLUMNS.has(key) && typeof out[key] === "number") {
      out[key] = new Date(out[key] as number);
    }
  }
  return out;
}

export function getSyncCursor(db: Db): string | null {
  const value = getMetaValue(db, CURSOR_KEY);
  return value === null || value === "" ? null : value;
}
