import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Shared synchronization columns. The same shape is used by the mobile app and
// the optional desktop SQLite replica so the delta-sync protocol is consistent.
export const syncColumns = {
  id: text("id").primaryKey(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  deviceId: text("device_id").notNull(),
  revision: integer("revision").notNull().default(0),
  syncStatus: text("sync_status", { enum: ["pending", "synced", "error"] }).notNull(),
};

export const products = sqliteTable("products", {
  ...syncColumns,
  name: text("name").notNull(),
  brand: text("brand"),
  category: text("category"),
  barcode: text("barcode"),
  packageQuantity: integer("package_quantity"),
  packageSize: text("package_size"),
  unit: text("unit"),
  notes: text("notes"),
});

export const stores = sqliteTable("stores", {
  ...syncColumns,
  name: text("name").notNull(),
  branch: text("branch"),
  address: text("address"),
});

export const purchases = sqliteTable("purchases", {
  ...syncColumns,
  productId: text("product_id")
    .notNull()
    .references(() => products.id),
  storeId: text("store_id").references(() => stores.id),
  tripId: text("trip_id"),
  quantity: integer("quantity").notNull().default(1),
  amountMinor: integer("amount_minor").notNull(),
  currency: text("currency").notNull(),
  purchasedAt: integer("purchased_at", { mode: "timestamp_ms" }).notNull(),
});

// Application-managed rollup for the spending dashboard. SQLite/libSQL has no
// PostgreSQL-style materialized views, so rollups are maintained in code and
// must be rebuildable from canonical purchase records (see tech.desktop.md).
export const dailySpendingRollups = sqliteTable("daily_spending_rollups", {
  userId: text("user_id").notNull(),
  day: text("day").notNull(),
  currency: text("currency").notNull(),
  amountMinor: integer("amount_minor").notNull(),
  tripCount: integer("trip_count").notNull(),
  itemCount: integer("item_count").notNull(),
  sourceRevision: integer("source_revision").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export type Product = typeof products.$inferSelect;
export type Store = typeof stores.$inferSelect;
export type Purchase = typeof purchases.$inferSelect;
export type DailySpendingRollup = typeof dailySpendingRollups.$inferSelect;
