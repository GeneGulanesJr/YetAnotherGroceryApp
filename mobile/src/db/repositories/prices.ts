import { and, desc, eq, isNull } from "drizzle-orm";
import { prices, type Price } from "../schema";
import { now } from "../context";
import { trackInsert } from "../outbox";
import type { Db } from "../types";

export interface PriceInput {
  productId: string;
  storeId?: string | null;
  currency: string;
  regularPriceMinor: number;
  promotionalPriceMinor?: number | null;
  loyaltyPriceMinor?: number | null;
  expectedCheckoutPriceMinor?: number | null;
  minPromoQuantity?: number | null;
  taxIncluded?: boolean | null;
  sourceImageId?: string | null;
  capturedAt?: Date;
}

export function recordPrice(db: Db, input: PriceInput): Price {
  return trackInsert(db, prices, {
    productId: input.productId,
    storeId: input.storeId ?? null,
    currency: input.currency,
    regularPriceMinor: input.regularPriceMinor,
    promotionalPriceMinor: input.promotionalPriceMinor ?? null,
    loyaltyPriceMinor: input.loyaltyPriceMinor ?? null,
    expectedCheckoutPriceMinor: input.expectedCheckoutPriceMinor ?? null,
    unitPriceMinor: null,
    unitPriceUnit: null,
    minPromoQuantity: input.minPromoQuantity ?? null,
    taxIncluded: input.taxIncluded === null || input.taxIncluded === undefined ? null : (input.taxIncluded ? 1 : 0),
    capturedAt: input.capturedAt ?? now(),
    sourceImageId: input.sourceImageId ?? null,
  });
}

/** Latest shelf-price observation for a product (optionally store-scoped). */
export function latestPriceForProduct(
  db: Db,
  productId: string,
  storeId?: string,
): Price | undefined {
  const conditions = [
    eq(prices.productId, productId),
    isNull(prices.deletedAt),
  ];
  if (storeId !== undefined) {
    conditions.push(eq(prices.storeId, storeId));
  }
  return db
    .select()
    .from(prices)
    .where(and(...conditions))
    .orderBy(desc(prices.capturedAt))
    .limit(1)
    .get();
}

export function priceHistoryForProduct(
  db: Db,
  productId: string,
  limit = 20,
): Price[] {
  return db
    .select()
    .from(prices)
    .where(and(eq(prices.productId, productId), isNull(prices.deletedAt)))
    .orderBy(desc(prices.capturedAt))
    .limit(limit)
    .all();
}
