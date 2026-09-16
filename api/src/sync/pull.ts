/**
 * GET /sync/pull — paged delta download from the server_seq ledger.
 *
 * A page merges every synced table's rows with server_seq > cursor, ordered
 * globally by server_seq, and returns at most `limit` SyncRecordDtos.
 * nextCursor is null on the last page (that exact null is what the mobile
 * engine treats as the terminal state). Each table query fetches limit+1 rows
 * which is enough to detect "more pages remain" after the merge.
 */
import { and, asc, gt, isNotNull } from "drizzle-orm";

import type { ApiDb } from "../db/client.js";
import { SYNC_TABLES } from "../db/registry.js";
import type { SyncRecordDto } from "../protocol.js";
import { parseFieldVersions } from "./apply.js";
import { encodeCursor } from "./cursor.js";

export const DEFAULT_PAGE_SIZE = 200;
export const MAX_PAGE_SIZE = 500;

interface StampedRow {
  serverSeq: number;
  specName: string;
  row: Record<string, unknown>;
}

export function pullDelta(
  db: ApiDb,
  afterSeq: number,
  limit: number = DEFAULT_PAGE_SIZE,
): { records: SyncRecordDto[]; nextCursor: string | null } {
  const candidates: StampedRow[] = [];
  for (const spec of Object.values(SYNC_TABLES)) {
    const rows = db.drizzle
      .select()
      .from(spec.table)
      .where(and(isNotNull(spec.columns["serverSeq"]), gt(spec.columns["serverSeq"], afterSeq)))
      .orderBy(asc(spec.columns["serverSeq"]))
      .limit(limit + 1)
      .all() as unknown as Record<string, unknown>[];
    for (const row of rows) {
      candidates.push({ serverSeq: row["serverSeq"] as number, specName: spec.name, row });
    }
  }

  candidates.sort((a, b) => a.serverSeq - b.serverSeq);

  const page = candidates.slice(0, limit);
  const records = page.map((candidate) =>
    serializeRecord(SYNC_TABLES[candidate.specName], candidate.row),
  );
  const nextCursor = candidates.length > limit ? encodeCursor(page[page.length - 1].serverSeq) : null;
  return { records, nextCursor };
}

/** Wire shape: full canonical row (camelCase), minus the server-only serverSeq. */
function serializeRecord(
  spec: (typeof SYNC_TABLES)[string],
  row: Record<string, unknown>,
): SyncRecordDto {
  const fields: Record<string, unknown> = {};
  for (const column of spec.allColumns) {
    if (column !== "serverSeq") {
      fields[column] = row[column] ?? null;
    }
  }
  return {
    tableName: spec.name,
    fields,
    fieldVersions: parseFieldVersions(row["fieldVersionsJson"]),
    revision: row["revision"] as number,
    deleted: row["deletedAt"] !== null && row["deletedAt"] !== undefined,
  };
}
