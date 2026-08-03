import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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

export const prices = sqliteTable("prices", {
  ...syncColumns,
  productId: text("product_id")
    .notNull()
    .references(() => products.id),
  storeId: text("store_id"),
  amountMinor: integer("amount_minor").notNull(),
  currency: text("currency").notNull(),
  capturedAt: integer("captured_at", { mode: "timestamp_ms" }).notNull(),
});

export const stores = sqliteTable("stores", {
  ...syncColumns,
  name: text("name").notNull(),
  branch: text("branch"),
  address: text("address"),
});

export type Product = typeof products.$inferSelect;
export type Price = typeof prices.$inferSelect;
export type Store = typeof stores.$inferSelect;
