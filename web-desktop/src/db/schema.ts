import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Shared synchronization columns. The same shape is used by the mobile app,
// the backend, and the optional desktop SQLite replica so the delta-sync
// protocol is consistent across every surface (see tech.desktop.md,
// "Desktop offline data access"). Every synchronized record carries:
// id, created_at, updated_at, deleted_at, device_id, revision, sync_status.
export const syncColumns = {
  id: text("id").primaryKey(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  deviceId: text("device_id").notNull(),
  revision: integer("revision").notNull().default(0),
  syncStatus: text("sync_status", {
    enum: ["pending", "synced", "error"],
  }).notNull(),
};

// The canonical tables below mirror the shared backend / mobile schema so the
// desktop SQLite replica can receive and apply the same delta-sync payloads
// the mobile application produces. Do not diverge these definitions from the
// backend without also updating the shared schema (tech.desktop.md requires
// identical domain models, validation, and API contracts across web/desktop).

export const categories = sqliteTable(
  "categories",
  {
    ...syncColumns,
    name: text("name").notNull(),
    parentId: text("parent_id"),
    defaultUnit: text("default_unit"),
  },
  (table) => ({
    nameIdx: index("categories_name_idx").on(table.name),
    parentIdIdx: index("categories_parent_id_idx").on(table.parentId),
    updatedAtIdx: index("categories_updated_at_idx").on(table.updatedAt),
    deletedAtIdx: index("categories_deleted_at_idx").on(table.deletedAt),
    syncStatusIdx: index("categories_sync_status_idx").on(table.syncStatus),
  }),
);

export const images = sqliteTable(
  "images",
  {
    ...syncColumns,
    localUri: text("local_uri"),
    remoteObjectKey: text("remote_object_key"),
    thumbnailUri: text("thumbnail_uri"),
    mimeType: text("mime_type"),
    width: integer("width"),
    height: integer("height"),
    fileSize: integer("file_size"),
    sha256: text("sha256"),
    uploadStatus: text("upload_status", {
      enum: ["pending", "uploading", "uploaded", "error"],
    }).notNull(),
    capturedAt: integer("captured_at", { mode: "timestamp_ms" }),
  },
  (table) => ({
    sha256Idx: index("images_sha256_idx").on(table.sha256),
    uploadStatusIdx: index("images_upload_status_idx").on(table.uploadStatus),
    updatedAtIdx: index("images_updated_at_idx").on(table.updatedAt),
    deletedAtIdx: index("images_deleted_at_idx").on(table.deletedAt),
    syncStatusIdx: index("images_sync_status_idx").on(table.syncStatus),
  }),
);

export const stores = sqliteTable(
  "stores",
  {
    ...syncColumns,
    name: text("name").notNull(),
    branch: text("branch"),
    address: text("address"),
    logoImageId: text("logo_image_id").references(() => images.id),
  },
  (table) => ({
    updatedAtIdx: index("stores_updated_at_idx").on(table.updatedAt),
    deletedAtIdx: index("stores_deleted_at_idx").on(table.deletedAt),
    syncStatusIdx: index("stores_sync_status_idx").on(table.syncStatus),
  }),
);

export const products = sqliteTable(
  "products",
  {
    ...syncColumns,
    name: text("name").notNull(),
    brand: text("brand"),
    categoryId: text("category_id").references(() => categories.id),
    packageQuantity: integer("package_quantity"),
    packageSize: text("package_size"),
    unit: text("unit"),
    notes: text("notes"),
    photoImageId: text("photo_image_id").references(() => images.id),
    isFavorite: integer("is_favorite").notNull().default(0),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
  },
  (table) => ({
    categoryIdIdx: index("products_category_id_idx").on(table.categoryId),
    nameIdx: index("products_name_idx").on(table.name),
    favoriteIdx: index("products_is_favorite_idx").on(table.isFavorite),
    archivedAtIdx: index("products_archived_at_idx").on(table.archivedAt),
    updatedAtIdx: index("products_updated_at_idx").on(table.updatedAt),
    deletedAtIdx: index("products_deleted_at_idx").on(table.deletedAt),
    syncStatusIdx: index("products_sync_status_idx").on(table.syncStatus),
  }),
);

export const productBarcodes = sqliteTable(
  "product_barcodes",
  {
    ...syncColumns,
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    barcode: text("barcode").notNull(),
  },
  (table) => ({
    barcodeIdx: index("product_barcodes_barcode_idx").on(table.barcode),
    productIdIdx: index("product_barcodes_product_id_idx").on(table.productId),
    updatedAtIdx: index("product_barcodes_updated_at_idx").on(table.updatedAt),
    deletedAtIdx: index("product_barcodes_deleted_at_idx").on(table.deletedAt),
    syncStatusIdx: index("product_barcodes_sync_status_idx").on(table.syncStatus),
  }),
);

export const prices = sqliteTable(
  "prices",
  {
    ...syncColumns,
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    storeId: text("store_id").references(() => stores.id),
    currency: text("currency").notNull(),
    regularPriceMinor: integer("regular_price_minor").notNull(),
    promotionalPriceMinor: integer("promotional_price_minor"),
    loyaltyPriceMinor: integer("loyalty_price_minor"),
    expectedCheckoutPriceMinor: integer("expected_checkout_price_minor"),
    unitPriceMinor: integer("unit_price_minor"),
    unitPriceUnit: text("unit_price_unit"),
    minPromoQuantity: integer("min_promo_quantity"),
    taxIncluded: integer("tax_included"),
    capturedAt: integer("captured_at", { mode: "timestamp_ms" }).notNull(),
    sourceImageId: text("source_image_id").references(() => images.id),
  },
  (table) => ({
    productIdIdx: index("prices_product_id_idx").on(table.productId),
    storeIdIdx: index("prices_store_id_idx").on(table.storeId),
    capturedAtIdx: index("prices_captured_at_idx").on(table.capturedAt),
    updatedAtIdx: index("prices_updated_at_idx").on(table.updatedAt),
    deletedAtIdx: index("prices_deleted_at_idx").on(table.deletedAt),
    syncStatusIdx: index("prices_sync_status_idx").on(table.syncStatus),
  }),
);

export const trips = sqliteTable(
  "trips",
  {
    ...syncColumns,
    storeId: text("store_id").references(() => stores.id),
    status: text("status", {
      enum: ["active", "completed", "cancelled"],
    }).notNull(),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
    endedAt: integer("ended_at", { mode: "timestamp_ms" }),
    currency: text("currency"),
    budgetMinor: integer("budget_minor"),
    notes: text("notes"),
  },
  (table) => ({
    storeIdIdx: index("trips_store_id_idx").on(table.storeId),
    statusIdx: index("trips_status_idx").on(table.status),
    startedAtIdx: index("trips_started_at_idx").on(table.startedAt),
    updatedAtIdx: index("trips_updated_at_idx").on(table.updatedAt),
    deletedAtIdx: index("trips_deleted_at_idx").on(table.deletedAt),
    syncStatusIdx: index("trips_sync_status_idx").on(table.syncStatus),
  }),
);

export const receipts = sqliteTable(
  "receipts",
  {
    ...syncColumns,
    storeId: text("store_id").references(() => stores.id),
    tripId: text("trip_id").references(() => trips.id),
    currency: text("currency").notNull(),
    subtotalMinor: integer("subtotal_minor"),
    totalMinor: integer("total_minor"),
    taxMinor: integer("tax_minor"),
    discountMinor: integer("discount_minor"),
    savingsMinor: integer("savings_minor"),
    overchargeMinor: integer("overcharge_minor"),
    capturedAt: integer("captured_at", { mode: "timestamp_ms" }),
    sourceImageId: text("source_image_id").references(() => images.id),
    rawOcrText: text("raw_ocr_text"),
    verifiedAt: integer("verified_at", { mode: "timestamp_ms" }),
  },
  (table) => ({
    storeIdIdx: index("receipts_store_id_idx").on(table.storeId),
    tripIdIdx: index("receipts_trip_id_idx").on(table.tripId),
    capturedAtIdx: index("receipts_captured_at_idx").on(table.capturedAt),
    updatedAtIdx: index("receipts_updated_at_idx").on(table.updatedAt),
    deletedAtIdx: index("receipts_deleted_at_idx").on(table.deletedAt),
    syncStatusIdx: index("receipts_sync_status_idx").on(table.syncStatus),
  }),
);

export const receiptLines = sqliteTable(
  "receipt_lines",
  {
    ...syncColumns,
    receiptId: text("receipt_id")
      .notNull()
      .references(() => receipts.id),
    productId: text("product_id").references(() => products.id),
    lineNumber: integer("line_number").notNull(),
    lineType: text("line_type", {
      enum: [
        "product",
        "quantity",
        "discount",
        "tax",
        "subtotal",
        "total",
        "payment",
        "header",
        "footer",
        "unknown",
      ],
    }).notNull(),
    descriptionRaw: text("description_raw"),
    descriptionCorrected: text("description_corrected"),
    quantity: integer("quantity"),
    rawUnitPriceMinor: integer("raw_unit_price_minor"),
    rawLineTotalMinor: integer("raw_line_total_minor"),
    unitPriceMinor: integer("unit_price_minor"),
    lineTotalMinor: integer("line_total_minor"),
    confidence: real("confidence"),
    matchedAlias: text("matched_alias"),
  },
  (table) => ({
    receiptIdIdx: index("receipt_lines_receipt_id_idx").on(table.receiptId),
    productIdIdx: index("receipt_lines_product_id_idx").on(table.productId),
    updatedAtIdx: index("receipt_lines_updated_at_idx").on(table.updatedAt),
    deletedAtIdx: index("receipt_lines_deleted_at_idx").on(table.deletedAt),
    syncStatusIdx: index("receipt_lines_sync_status_idx").on(table.syncStatus),
  }),
);

export const purchases = sqliteTable(
  "purchases",
  {
    ...syncColumns,
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    tripId: text("trip_id").references(() => trips.id),
    storeId: text("store_id").references(() => stores.id),
    receiptId: text("receipt_id").references(() => receipts.id),
    receiptLineId: text("receipt_line_id").references(() => receiptLines.id),
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
    purchasedAt: integer("purchased_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    productIdIdx: index("purchases_product_id_idx").on(table.productId),
    tripIdIdx: index("purchases_trip_id_idx").on(table.tripId),
    storeIdIdx: index("purchases_store_id_idx").on(table.storeId),
    receiptIdIdx: index("purchases_receipt_id_idx").on(table.receiptId),
    purchasedAtIdx: index("purchases_purchased_at_idx").on(table.purchasedAt),
    updatedAtIdx: index("purchases_updated_at_idx").on(table.updatedAt),
    deletedAtIdx: index("purchases_deleted_at_idx").on(table.deletedAt),
    syncStatusIdx: index("purchases_sync_status_idx").on(table.syncStatus),
  }),
);

export const shoppingLists = sqliteTable(
  "shopping_lists",
  {
    ...syncColumns,
    name: text("name").notNull(),
    storeId: text("store_id").references(() => stores.id),
    currency: text("currency"),
    estimatedTotalMinor: integer("estimated_total_minor"),
    tripId: text("trip_id").references(() => trips.id),
  },
  (table) => ({
    storeIdIdx: index("shopping_lists_store_id_idx").on(table.storeId),
    updatedAtIdx: index("shopping_lists_updated_at_idx").on(table.updatedAt),
    deletedAtIdx: index("shopping_lists_deleted_at_idx").on(table.deletedAt),
    syncStatusIdx: index("shopping_lists_sync_status_idx").on(table.syncStatus),
  }),
);

export const shoppingListItems = sqliteTable(
  "shopping_list_items",
  {
    ...syncColumns,
    listId: text("list_id")
      .notNull()
      .references(() => shoppingLists.id),
    productId: text("product_id").references(() => products.id),
    name: text("name"),
    quantity: integer("quantity").notNull().default(1),
    unit: text("unit"),
    purchased: integer("purchased").notNull().default(0),
    storeId: text("store_id").references(() => stores.id),
    currency: text("currency"),
    estimatedPriceMinor: integer("estimated_price_minor"),
  },
  (table) => ({
    listIdIdx: index("shopping_list_items_list_id_idx").on(table.listId),
    productIdIdx: index("shopping_list_items_product_id_idx").on(table.productId),
    storeIdIdx: index("shopping_list_items_store_id_idx").on(table.storeId),
    purchasedIdx: index("shopping_list_items_purchased_idx").on(table.purchased),
    updatedAtIdx: index("shopping_list_items_updated_at_idx").on(table.updatedAt),
    deletedAtIdx: index("shopping_list_items_deleted_at_idx").on(table.deletedAt),
    syncStatusIdx: index("shopping_list_items_sync_status_idx").on(table.syncStatus),
  }),
);

// Local mutation queue + sync metadata for the optional desktop SQLite replica.
// Mirrors the mobile definitions so field-level last-write-wins conflict
// resolution and the delta cursor are handled identically on both clients.
export const syncMutations = sqliteTable(
  "sync_mutations",
  {
    id: text("id").primaryKey(),
    tableName: text("table_name").notNull(),
    recordId: text("record_id").notNull(),
    operation: text("operation", {
      enum: ["insert", "update", "delete"],
    }).notNull(),
    changedFieldsJson: text("changed_fields_json"),
    payloadJson: text("payload_json"),
    deviceId: text("device_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    localRevision: integer("local_revision"),
    status: text("status", {
      enum: ["pending", "uploading", "applied", "error", "discarded"],
    }).notNull(),
    lastAttemptAt: integer("last_attempt_at", { mode: "timestamp_ms" }),
    attempts: integer("attempts").notNull().default(0),
    error: text("error"),
  },
  (table) => ({
    statusIdx: index("sync_mutations_status_idx").on(table.status),
    tableNameIdx: index("sync_mutations_table_name_idx").on(table.tableName),
    recordIdIdx: index("sync_mutations_record_id_idx").on(table.recordId),
    createdAtIdx: index("sync_mutations_created_at_idx").on(table.createdAt),
  }),
);

export const syncMeta = sqliteTable("sync_meta", {
  key: text("key").primaryKey(),
  value: text("value"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

// Desktop-only analytics rollups. SQLite/libSQL has no PostgreSQL-style
// materialized views, so common rollups are maintained through application jobs
// or transactional update logic and must be rebuildable from canonical
// purchase, price, trip, and receipt records (see tech.desktop.md,
// "Aggregations"). Each rollup stores the user id, an aggregation key, the
// date/period, currency, calculated values, a source revision/rebuild version,
// and an updated timestamp. Monetary values are integer minor units and must
// not mix currencies.
export const dailySpendingRollups = sqliteTable(
  "daily_spending_rollups",
  {
    userId: text("user_id").notNull(),
    day: text("day").notNull(),
    currency: text("currency").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    tripCount: integer("trip_count").notNull(),
    itemCount: integer("item_count").notNull(),
    sourceRevision: integer("source_revision").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    userIdIdx: index("daily_spending_rollups_user_id_idx").on(table.userId),
    dayIdx: index("daily_spending_rollups_day_idx").on(table.day),
    sourceRevisionIdx: index("daily_spending_rollups_source_revision_idx").on(table.sourceRevision),
  }),
);

export const monthlySpendingRollups = sqliteTable(
  "monthly_spending_rollups",
  {
    userId: text("user_id").notNull(),
    month: text("month").notNull(),
    currency: text("currency").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    tripCount: integer("trip_count").notNull(),
    itemCount: integer("item_count").notNull(),
    sourceRevision: integer("source_revision").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    userIdIdx: index("monthly_spending_rollups_user_id_idx").on(table.userId),
    monthIdx: index("monthly_spending_rollups_month_idx").on(table.month),
  }),
);

export const productPriceRollups = sqliteTable(
  "product_price_rollups",
  {
    userId: text("user_id").notNull(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    currency: text("currency").notNull(),
    latestPriceMinor: integer("latest_price_minor").notNull(),
    lowestPriceMinor: integer("lowest_price_minor").notNull(),
    highestPriceMinor: integer("highest_price_minor").notNull(),
    averagePriceMinor: integer("average_price_minor").notNull(),
    purchaseCount: integer("purchase_count").notNull(),
    lastPurchasedAt: integer("last_purchased_at", { mode: "timestamp_ms" }),
    sourceRevision: integer("source_revision").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    userIdIdx: index("product_price_rollups_user_id_idx").on(table.userId),
    productIdIdx: index("product_price_rollups_product_id_idx").on(table.productId),
  }),
);

export const storeProductPriceRollups = sqliteTable(
  "store_product_price_rollups",
  {
    userId: text("user_id").notNull(),
    storeId: text("store_id")
      .notNull()
      .references(() => stores.id),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    currency: text("currency").notNull(),
    averagePriceMinor: integer("average_price_minor").notNull(),
    latestPriceMinor: integer("latest_price_minor").notNull(),
    purchaseCount: integer("purchase_count").notNull(),
    sourceRevision: integer("source_revision").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    userIdIdx: index("store_product_price_rollups_user_id_idx").on(table.userId),
    storeIdIdx: index("store_product_price_rollups_store_id_idx").on(table.storeId),
    productIdIdx: index("store_product_price_rollups_product_id_idx").on(table.productId),
  }),
);

export const categorySpendingRollups = sqliteTable(
  "category_spending_rollups",
  {
    userId: text("user_id").notNull(),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id),
    period: text("period").notNull(),
    currency: text("currency").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    purchaseCount: integer("purchase_count").notNull(),
    itemCount: integer("item_count").notNull(),
    sourceRevision: integer("source_revision").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    userIdIdx: index("category_spending_rollups_user_id_idx").on(table.userId),
    categoryIdIdx: index("category_spending_rollups_category_id_idx").on(table.categoryId),
    periodIdx: index("category_spending_rollups_period_idx").on(table.period),
  }),
);

export const receiptSavingsRollups = sqliteTable(
  "receipt_savings_rollups",
  {
    userId: text("user_id").notNull(),
    storeId: text("store_id").references(() => stores.id),
    period: text("period").notNull(),
    currency: text("currency").notNull(),
    discrepancyCount: integer("discrepancy_count").notNull(),
    savingsMinor: integer("savings_minor").notNull(),
    overchargeMinor: integer("overcharge_minor").notNull(),
    sourceRevision: integer("source_revision").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    userIdIdx: index("receipt_savings_rollups_user_id_idx").on(table.userId),
    storeIdIdx: index("receipt_savings_rollups_store_id_idx").on(table.storeId),
    periodIdx: index("receipt_savings_rollups_period_idx").on(table.period),
  }),
);

export type Category = typeof categories.$inferSelect;
export type ImageRecord = typeof images.$inferSelect;
export type Store = typeof stores.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ProductBarcode = typeof productBarcodes.$inferSelect;
export type Price = typeof prices.$inferSelect;
export type Trip = typeof trips.$inferSelect;
export type Receipt = typeof receipts.$inferSelect;
export type ReceiptLine = typeof receiptLines.$inferSelect;
export type Purchase = typeof purchases.$inferSelect;
export type ShoppingList = typeof shoppingLists.$inferSelect;
export type ShoppingListItem = typeof shoppingListItems.$inferSelect;
export type SyncMutation = typeof syncMutations.$inferSelect;
export type SyncMeta = typeof syncMeta.$inferSelect;

export type DailySpendingRollup = typeof dailySpendingRollups.$inferSelect;
export type MonthlySpendingRollup = typeof monthlySpendingRollups.$inferSelect;
export type ProductPriceRollup = typeof productPriceRollups.$inferSelect;
export type StoreProductPriceRollup = typeof storeProductPriceRollups.$inferSelect;
export type CategorySpendingRollup = typeof categorySpendingRollups.$inferSelect;
export type ReceiptSavingsRollup = typeof receiptSavingsRollups.$inferSelect;
