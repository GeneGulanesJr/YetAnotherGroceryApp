/**
 * Canonical sync schema (Drizzle, SQLite dialect) — the same tables and
 * snake_case DDL as `mobile/src/db/schema.ts` / `mobile/drizzle/0000_init.sql`,
 * plus the server-side additions documented in README.md:
 *
 * - `server_seq` extra column on every synced table: a global monotonic
 *   change-sequence number (from the `sync_meta` counter) stamped on every
 *   applied mutation. It drives cursor paging for GET /sync/pull and is
 *   intentionally NOT part of the wire `fields` map (clients do not have the
 *   column).
 * - `sync_mutations_applied`: idempotency ledger keyed by mutation id.
 * - `sync_conflicts`: server-side conflict audit trail.
 * - `sync_meta`: key/value storage for the global `server_seq` counter.
 *
 * Timestamps are stored as raw epoch-millisecond integers (plain
 * `integer()` columns, no drizzle Date mapping) — the wire format is epoch ms
 * and the server never needs Date objects. The DDL is byte-compatible with
 * the mobile columns (integer in both cases).
 *
 * Indexes are created by `migrate.ts` (this service does not generate DDL
 * through drizzle-kit), so no index builders are declared here.
 */
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** Columns shared by every synchronized record (canonical sync columns). */
export const syncColumns = {
  id: text("id").primaryKey(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  deletedAt: integer("deleted_at"),
  deviceId: text("device_id").notNull(),
  revision: integer("revision").notNull().default(0),
  syncStatus: text("sync_status").notNull(),
  fieldVersionsJson: text("field_versions_json"),
  /** Server-only: global change-sequence for pull cursors (see README). */
  serverSeq: integer("server_seq"),
};

export const categories = sqliteTable("categories", {
  ...syncColumns,
  name: text("name").notNull(),
  parentId: text("parent_id"),
  defaultUnit: text("default_unit"),
});

export const images = sqliteTable("images", {
  ...syncColumns,
  localUri: text("local_uri"),
  remoteObjectKey: text("remote_object_key"),
  thumbnailUri: text("thumbnail_uri"),
  mimeType: text("mime_type"),
  width: integer("width"),
  height: integer("height"),
  fileSize: integer("file_size"),
  sha256: text("sha256"),
  uploadStatus: text("upload_status").notNull(),
  capturedAt: integer("captured_at"),
});

export const stores = sqliteTable("stores", {
  ...syncColumns,
  name: text("name").notNull(),
  branch: text("branch"),
  address: text("address"),
  logoImageId: text("logo_image_id"),
});

export const products = sqliteTable("products", {
  ...syncColumns,
  name: text("name").notNull(),
  brand: text("brand"),
  categoryId: text("category_id"),
  packageQuantity: integer("package_quantity"),
  packageSize: text("package_size"),
  unit: text("unit"),
  notes: text("notes"),
  photoImageId: text("photo_image_id"),
  isFavorite: integer("is_favorite").notNull().default(0),
  archivedAt: integer("archived_at"),
});

export const productBarcodes = sqliteTable("product_barcodes", {
  ...syncColumns,
  productId: text("product_id").notNull(),
  barcode: text("barcode").notNull(),
});

export const prices = sqliteTable("prices", {
  ...syncColumns,
  productId: text("product_id").notNull(),
  storeId: text("store_id"),
  currency: text("currency").notNull(),
  regularPriceMinor: integer("regular_price_minor").notNull(),
  promotionalPriceMinor: integer("promotional_price_minor"),
  loyaltyPriceMinor: integer("loyalty_price_minor"),
  expectedCheckoutPriceMinor: integer("expected_checkout_price_minor"),
  unitPriceMinor: integer("unit_price_minor"),
  unitPriceUnit: text("unit_price_unit"),
  minPromoQuantity: integer("min_promo_quantity"),
  taxIncluded: integer("tax_included"),
  capturedAt: integer("captured_at").notNull(),
  sourceImageId: text("source_image_id"),
  ocrRawText: text("ocr_raw_text"),
  ocrConfidence: real("ocr_confidence"),
});

export const trips = sqliteTable("trips", {
  ...syncColumns,
  storeId: text("store_id"),
  status: text("status").notNull(),
  startedAt: integer("started_at").notNull(),
  endedAt: integer("ended_at"),
  currency: text("currency"),
  budgetMinor: integer("budget_minor"),
  notes: text("notes"),
});

export const receipts = sqliteTable("receipts", {
  ...syncColumns,
  storeId: text("store_id"),
  tripId: text("trip_id"),
  currency: text("currency").notNull(),
  subtotalMinor: integer("subtotal_minor"),
  totalMinor: integer("total_minor"),
  taxMinor: integer("tax_minor"),
  discountMinor: integer("discount_minor"),
  savingsMinor: integer("savings_minor"),
  overchargeMinor: integer("overcharge_minor"),
  capturedAt: integer("captured_at"),
  sourceImageId: text("source_image_id"),
  rawOcrText: text("raw_ocr_text"),
  verifiedAt: integer("verified_at"),
});

export const receiptLines = sqliteTable("receipt_lines", {
  ...syncColumns,
  receiptId: text("receipt_id").notNull(),
  productId: text("product_id"),
  lineNumber: integer("line_number").notNull(),
  lineType: text("line_type").notNull(),
  descriptionRaw: text("description_raw"),
  descriptionCorrected: text("description_corrected"),
  quantity: integer("quantity"),
  rawUnitPriceMinor: integer("raw_unit_price_minor"),
  rawLineTotalMinor: integer("raw_line_total_minor"),
  unitPriceMinor: integer("unit_price_minor"),
  lineTotalMinor: integer("line_total_minor"),
  confidence: real("confidence"),
  matchedAlias: text("matched_alias"),
});

export const purchases = sqliteTable("purchases", {
  ...syncColumns,
  productId: text("product_id").notNull(),
  tripId: text("trip_id"),
  storeId: text("store_id"),
  receiptId: text("receipt_id"),
  receiptLineId: text("receipt_line_id"),
  currency: text("currency").notNull(),
  quantity: integer("quantity").notNull().default(1),
  barcode: text("barcode"),
  shelfPriceMinor: integer("shelf_price_minor").notNull(),
  unitPriceMinor: integer("unit_price_minor"),
  expectedUnitPriceMinor: integer("expected_unit_price_minor"),
  receiptUnitPriceMinor: integer("receipt_unit_price_minor"),
  receiptLineTotalMinor: integer("receipt_line_total_minor"),
  discountMinor: integer("discount_minor"),
  finalPaidAmountMinor: integer("final_paid_amount_minor"),
  taxAmountMinor: integer("tax_amount_minor"),
  priceDiscrepancyMinor: integer("price_discrepancy_minor"),
  purchasedAt: integer("purchased_at").notNull(),
});

export const shoppingLists = sqliteTable("shopping_lists", {
  ...syncColumns,
  name: text("name").notNull(),
  storeId: text("store_id"),
  currency: text("currency"),
  estimatedTotalMinor: integer("estimated_total_minor"),
  tripId: text("trip_id"),
});

export const shoppingListItems = sqliteTable("shopping_list_items", {
  ...syncColumns,
  listId: text("list_id").notNull(),
  productId: text("product_id"),
  name: text("name"),
  quantity: integer("quantity").notNull().default(1),
  unit: text("unit"),
  purchased: integer("purchased").notNull().default(0),
  storeId: text("store_id"),
  currency: text("currency"),
  estimatedPriceMinor: integer("estimated_price_minor"),
});

// ---------------------------------------------------------------------------
// Server-only tables
// ---------------------------------------------------------------------------

/**
 * Idempotency ledger (spec: "Idempotent mutation processing"). Every pushed
 * mutation id gets exactly one row, written in the same transaction as the
 * apply; a re-push replays the stored result without touching canonical rows.
 */
export const syncMutationsApplied = sqliteTable("sync_mutations_applied", {
  mutationId: text("mutation_id").primaryKey(),
  deviceId: text("device_id").notNull(),
  tableName: text("table_name").notNull(),
  recordId: text("record_id").notNull(),
  operation: text("operation").notNull(),
  accepted: integer("accepted").notNull(),
  revision: integer("revision").notNull(),
  updatedAt: integer("updated_at").notNull(),
  error: text("error"),
  appliedAt: integer("applied_at").notNull(),
});

/**
 * Server-side conflict audit trail (spec: "Conflict Resolution"). Column
 * names mirror the mobile `sync_conflicts` table; on the server "local" means
 * the prior stored state and "remote" means the incoming pushed mutation that
 * overwrote it.
 */
export const syncConflicts = sqliteTable("sync_conflicts", {
  id: text("id").primaryKey(),
  createdAt: integer("created_at").notNull(),
  tableName: text("table_name").notNull(),
  recordId: text("record_id").notNull(),
  field: text("field").notNull(),
  winningSide: text("winning_side").notNull(),
  winningValueJson: text("winning_value_json"),
  losingValueJson: text("losing_value_json"),
  localRevision: integer("local_revision"),
  remoteRevision: integer("remote_revision"),
  localDeviceId: text("local_device_id"),
  remoteDeviceId: text("remote_device_id"),
});

/** Key/value storage; holds the global `server_seq` change counter. */
export const syncMeta = sqliteTable("sync_meta", {
  key: text("key").primaryKey(),
  value: text("value"),
  updatedAt: integer("updated_at").notNull(),
});

export type Category = typeof categories.$inferSelect;
export type Store = typeof stores.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Price = typeof prices.$inferSelect;
export type Purchase = typeof purchases.$inferSelect;
export type SyncMutationApplied = typeof syncMutationsApplied.$inferSelect;
export type SyncConflict = typeof syncConflicts.$inferSelect;
