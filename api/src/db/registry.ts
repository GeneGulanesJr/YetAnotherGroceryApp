/**
 * Registry of tables that participate in sync, keyed by wire table name
 * (mirrors `SYNC_TABLES` in mobile/src/sync/engine.ts). Provides the column
 * metadata the sync engine needs: managed (server-owned) fields vs writable
 * domain fields, and which columns are timestamps.
 */
import { getTableColumns, type Table } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";

import * as schema from "./schema.js";

/** Server-owned columns: never taken from a mutation payload. */
export const MANAGED_FIELDS: ReadonlySet<string> = new Set([
  "id",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "deviceId",
  "revision",
  "syncStatus",
  "fieldVersionsJson",
  "serverSeq",
]);

/** Columns the wire carries as epoch ms; ISO strings are coerced on intake. */
export const TIMESTAMP_FIELDS: ReadonlySet<string> = new Set([
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

export interface SyncTableSpec {
  /** Wire name (SyncMutationDto.tableName). */
  name: string;
  table: Table;
  /** All drizzle column keys (camelCase), managed fields included. */
  allColumns: readonly string[];
  /** Writable domain columns: allColumns minus managed fields. */
  domainColumns: readonly string[];
  columns: Record<string, SQLiteColumn>;
}

function buildSpec(name: string, table: Table): SyncTableSpec {
  const columns = getTableColumns(table) as Record<string, SQLiteColumn>;
  const allColumns = Object.keys(columns);
  return {
    name,
    table,
    allColumns,
    domainColumns: allColumns.filter((column) => !MANAGED_FIELDS.has(column)),
    columns,
  };
}

/** Wire table name -> spec, in stable order (pull merges in this order). */
export const SYNC_TABLES: Readonly<Record<string, SyncTableSpec>> = Object.fromEntries(
  (
    [
      ["categories", schema.categories],
      ["images", schema.images],
      ["stores", schema.stores],
      ["products", schema.products],
      ["product_barcodes", schema.productBarcodes],
      ["prices", schema.prices],
      ["trips", schema.trips],
      ["receipts", schema.receipts],
      ["receipt_lines", schema.receiptLines],
      ["purchases", schema.purchases],
      ["shopping_lists", schema.shoppingLists],
      ["shopping_list_items", schema.shoppingListItems],
    ] as const
  ).map(([name, table]) => [name, buildSpec(name, table)]),
);

export const SYNC_TABLE_NAMES: readonly string[] = Object.keys(SYNC_TABLES);
