import { and, eq, isNull } from "drizzle-orm";
import { productBarcodes, products, type Product, type ProductBarcode } from "../schema";
import { trackInsert } from "../outbox";
import type { Executor } from "../types";

export interface BarcodeMatch {
  product: Product;
  barcodeRecord: ProductBarcode;
}

/** The scan-resolution lookup: barcode -> live product, ignoring tombstones. */
export function findByBarcode(db: Executor, barcode: string): BarcodeMatch | null {
  const row = db
    .select({ barcodeRecord: productBarcodes, product: products })
    .from(productBarcodes)
    .innerJoin(products, eq(products.id, productBarcodes.productId))
    .where(
      and(
        eq(productBarcodes.barcode, barcode),
        isNull(productBarcodes.deletedAt),
        isNull(products.deletedAt),
      ),
    )
    .get();
  return row ?? null;
}

export function listBarcodesForProduct(
  db: Executor,
  productId: string,
): ProductBarcode[] {
  return db
    .select()
    .from(productBarcodes)
    .where(
      and(
        eq(productBarcodes.productId, productId),
        isNull(productBarcodes.deletedAt),
      ),
    )
    .all();
}

/**
 * Associates a barcode with a product. Throws if the barcode is already live
 * for another product — the caller must resolve the conflict first.
 */
export function addBarcodeToProduct(
  db: Executor,
  input: { productId: string; barcode: string },
): ProductBarcode {
  const existing = findByBarcode(db, input.barcode);
  if (existing !== null && existing.product.id !== input.productId) {
    throw new Error(
      `Barcode ${input.barcode} is already assigned to another product`,
    );
  }
  return trackInsert(db, productBarcodes, {
    productId: input.productId,
    barcode: input.barcode,
  });
}
