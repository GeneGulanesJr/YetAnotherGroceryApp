import { and, desc, eq, isNull, like, or, sql } from "drizzle-orm";
import {
  categories,
  prices,
  productBarcodes,
  products,
  type Category,
  type Price,
  type Product,
} from "../schema";
import { now } from "../context";
import { trackDelete, trackInsert, trackUpdate } from "../outbox";
import { listBarcodesForProduct, addBarcodeToProduct } from "./barcodes";
import type { Db } from "../types";

export interface ProductInput {
  name: string;
  brand?: string | null;
  categoryId?: string | null;
  packageQuantity?: number | null;
  packageSize?: string | null;
  unit?: string | null;
  notes?: string | null;
  barcode?: string | null;
  photoImageId?: string | null;
}

export interface ProductUpdate {
  name?: string;
  brand?: string | null;
  categoryId?: string | null;
  packageQuantity?: number | null;
  packageSize?: string | null;
  unit?: string | null;
  notes?: string | null;
  isFavorite?: 0 | 1;
}

export function createProduct(db: Db, input: ProductInput): Product {
  return db.transaction((tx) => {
    const product = trackInsert(tx, products, {
      name: input.name.trim(),
      brand: input.brand?.trim() || null,
      categoryId: input.categoryId ?? null,
      packageQuantity: input.packageQuantity ?? null,
      packageSize: input.packageSize?.trim() || null,
      unit: input.unit ?? null,
      notes: input.notes?.trim() || null,
      photoImageId: input.photoImageId ?? null,
      isFavorite: 0,
    });
    if (input.barcode !== null && input.barcode !== undefined && input.barcode !== "") {
      addBarcodeToProduct(tx, {
        productId: product.id,
        barcode: input.barcode,
      });
    }
    return product;
  });
}

export function getProduct(db: Db, id: string): Product | undefined {
  return db
    .select()
    .from(products)
    .where(and(eq(products.id, id), isNull(products.deletedAt)))
    .get();
}

export interface ProductListItem extends Product {
  categoryName: string | null;
  lastPriceMinor: number | null;
  lastCurrency: string | null;
}

/** Library search: not deleted, not archived, name or brand contains query. */
export function searchProducts(
  db: Db,
  query: string,
  options: { limit?: number; favoritesOnly?: boolean } = {},
): ProductListItem[] {
  const limit = options.limit ?? 50;
  const trimmed = query.trim();
  const conditions = [isNull(products.deletedAt), isNull(products.archivedAt)];
  if (trimmed !== "") {
    const pattern = `%${trimmed.toLowerCase()}%`;
    conditions.push(
      or(
        like(sql`lower(${products.name})`, pattern),
        like(sql`lower(coalesce(${products.brand}, ''))`, pattern),
      )!,
    );
  }
  if (options.favoritesOnly === true) {
    conditions.push(eq(products.isFavorite, 1));
  }

  const lastPrice = db
    .select({
      productId: prices.productId,
      regularPriceMinor: prices.regularPriceMinor,
      currency: prices.currency,
      capturedAt: prices.capturedAt,
      rn: sql<number>`row_number() over (partition by ${prices.productId} order by ${prices.capturedAt} desc)`.as(
        "rn",
      ),
    })
    .from(prices)
    .where(isNull(prices.deletedAt))
    .as("last_price");

  return db
    .select({
      product: products,
      categoryName: categories.name,
      lastPriceMinor: lastPrice.regularPriceMinor,
      lastCurrency: lastPrice.currency,
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(
      lastPrice,
      and(eq(lastPrice.productId, products.id), eq(lastPrice.rn, 1)),
    )
    .where(and(...conditions))
    .orderBy(products.name)
    .limit(limit)
    .all()
    .map((row) => ({
      ...row.product,
      categoryName: row.categoryName ?? null,
      lastPriceMinor: row.lastPriceMinor ?? null,
      lastCurrency: row.lastCurrency ?? null,
    }));
}

export function updateProduct(
  db: Db,
  id: string,
  patch: ProductUpdate,
): Product | undefined {
  return trackUpdate(db, products, id, patch);
}

export function archiveProduct(db: Db, id: string): Product | undefined {
  return trackUpdate(db, products, id, { archivedAt: now() });
}

export function unarchiveProduct(db: Db, id: string): Product | undefined {
  return trackUpdate(db, products, id, { archivedAt: null });
}

/** Tombstones the product and its barcode rows; prices/purchases stay for history. */
export function deleteProduct(db: Db, id: string): boolean {
  const product = getProduct(db, id);
  if (product === undefined) {
    return false;
  }
  return db.transaction((tx) => {
    for (const barcode of listBarcodesForProduct(db, id)) {
      trackDelete(tx, productBarcodes, barcode.id);
    }
    return trackDelete(tx, products, id);
  });
}

export function getRecentBrands(db: Db, limit = 10): string[] {
  const rows = db
    .selectDistinct({ brand: products.brand })
    .from(products)
    .where(and(isNull(products.deletedAt), isNotNullable(products.brand)))
    .orderBy(desc(products.updatedAt))
    .limit(limit)
    .all();
  return rows
    .map((r) => r.brand)
    .filter((b): b is string => typeof b === "string");
}

export interface ProductDetail {
  product: Product;
  category: Category | null;
  barcodes: string[];
  lastPrice: Price | null;
}

export function getProductDetail(db: Db, id: string): ProductDetail | null {
  const product = getProduct(db, id);
  if (product === undefined) {
    return null;
  }
  const category =
    product.categoryId === null
      ? null
      : (db
          .select()
          .from(categories)
          .where(eq(categories.id, product.categoryId))
          .get() ?? null);
  const barcodes = listBarcodesForProduct(db, id).map((b) => b.barcode);
  const lastPrice =
    db
      .select()
      .from(prices)
      .where(and(eq(prices.productId, id), isNull(prices.deletedAt)))
      .orderBy(desc(prices.capturedAt))
      .limit(1)
      .get() ?? null;
  return { product, category, barcodes, lastPrice };
}

function isNotNullable(column: Parameters<typeof isNull>[0]) {
  return sql`${column} is not null`;
}
