import { and, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  products,
  purchases,
  stores,
  trips,
  type Purchase,
  type Store,
  type Trip,
} from "../schema";
import { now } from "../context";
import { trackDelete, trackInsert, trackUpdate } from "../outbox";
import type { Db } from "../types";

export interface TripInput {
  storeId?: string | null;
  currency: string;
  budgetMinor?: number | null;
}

/**
 * Returns the active trip if one exists (a device runs one trip at a time),
 * otherwise starts a new one.
 */
export function startTrip(db: Db, input: TripInput): Trip {
  const active = getActiveTrip(db);
  if (active !== undefined) {
    return active;
  }
  return trackInsert(db, trips, {
    storeId: input.storeId ?? null,
    status: "active",
    startedAt: now(),
    endedAt: null,
    currency: input.currency,
    budgetMinor: input.budgetMinor ?? null,
    notes: null,
  });
}

export function getActiveTrip(db: Db): Trip | undefined {
  return db
    .select()
    .from(trips)
    .where(and(eq(trips.status, "active"), isNull(trips.deletedAt)))
    .orderBy(desc(trips.startedAt))
    .limit(1)
    .get();
}

export function completeTrip(db: Db, tripId: string): Trip | undefined {
  const trip = getTrip(db, tripId);
  if (trip === undefined || trip.status !== "active") {
    return undefined;
  }
  return trackUpdate(db, trips, tripId, {
    status: "completed",
    endedAt: now(),
  });
}

export function cancelTrip(db: Db, tripId: string): Trip | undefined {
  const trip = getTrip(db, tripId);
  if (trip === undefined || trip.status !== "active") {
    return undefined;
  }
  return trackUpdate(db, trips, tripId, {
    status: "cancelled",
    endedAt: now(),
  });
}

export function getTrip(db: Db, id: string): Trip | undefined {
  return db
    .select()
    .from(trips)
    .where(and(eq(trips.id, id), isNull(trips.deletedAt)))
    .get();
}

export interface AddToTripInput {
  tripId: string;
  productId: string;
  storeId?: string | null;
  currency: string;
  shelfPriceMinor: number;
  expectedUnitPriceMinor?: number | null;
  quantity?: number;
  barcode?: string | null;
}

export interface AddToTripResult {
  purchase: Purchase;
  /** True when an existing line was found and quantity was incremented (spec: duplicate scans). */
  duplicate: boolean;
}

export function addProductToTrip(db: Db, input: AddToTripInput): AddToTripResult {
  return db.transaction((tx) => {
    const existing = tx
      .select()
      .from(purchases)
      .where(
        and(
          eq(purchases.tripId, input.tripId),
          eq(purchases.productId, input.productId),
          isNull(purchases.receiptId),
          isNull(purchases.deletedAt),
        ),
      )
      .limit(1)
      .get();

    if (existing !== undefined) {
      const updated = trackUpdate(tx, purchases, existing.id, {
        quantity: existing.quantity + (input.quantity ?? 1),
      });
      return { purchase: updated!, duplicate: true };
    }

    const purchase = trackInsert(tx, purchases, {
      productId: input.productId,
      tripId: input.tripId,
      storeId: input.storeId ?? null,
      receiptId: null,
      receiptLineId: null,
      currency: input.currency,
      quantity: input.quantity ?? 1,
      barcode: input.barcode ?? null,
      shelfPriceMinor: input.shelfPriceMinor,
      unitPriceMinor: null,
      expectedUnitPriceMinor: input.expectedUnitPriceMinor ?? null,
      receiptUnitPriceMinor: null,
      receiptLineTotalMinor: null,
      discountMinor: null,
      finalPaidAmountMinor: null,
      taxAmountMinor: null,
      priceDiscrepancyMinor: null,
      purchasedAt: now(),
    });
    return { purchase, duplicate: false };
  });
}

export function setPurchaseQuantity(
  db: Db,
  purchaseId: string,
  quantity: number,
): Purchase | undefined {
  if (quantity <= 0) {
    removePurchase(db, purchaseId);
    return undefined;
  }
  return trackUpdate(db, purchases, purchaseId, { quantity });
}

export function removePurchase(db: Db, purchaseId: string): boolean {
  return trackDelete(db, purchases, purchaseId);
}

export interface TripPurchaseLine
  extends Pick<
    Purchase,
    | "id"
    | "productId"
    | "quantity"
    | "currency"
    | "barcode"
    | "shelfPriceMinor"
    | "expectedUnitPriceMinor"
  > {
  productName: string;
  productBrand: string | null;
  unit: string | null;
  packageSize: string | null;
}

export function getTripPurchases(db: Db, tripId: string): TripPurchaseLine[] {
  return db
    .select({
      purchase: purchases,
      productName: products.name,
      productBrand: products.brand,
      unit: products.unit,
      packageSize: products.packageSize,
    })
    .from(purchases)
    .innerJoin(products, eq(products.id, purchases.productId))
    .where(and(eq(purchases.tripId, tripId), isNull(purchases.deletedAt)))
    .orderBy(purchases.createdAt)
    .all()
    .map((row) => ({
      id: row.purchase.id,
      productId: row.purchase.productId,
      quantity: row.purchase.quantity,
      currency: row.purchase.currency,
      barcode: row.purchase.barcode,
      shelfPriceMinor: row.purchase.shelfPriceMinor,
      expectedUnitPriceMinor: row.purchase.expectedUnitPriceMinor,
      productName: row.productName,
      productBrand: row.productBrand ?? null,
      unit: row.unit ?? null,
      packageSize: row.packageSize ?? null,
    }));
}

/** Running trip total in integer minor units. Pure; safe offline math. */
export function tripTotalMinor(lines: readonly TripPurchaseLine[]): number {
  return lines.reduce((sum, line) => sum + line.shelfPriceMinor * line.quantity, 0);
}

export interface TripSummaryLine extends Trip {
  storeName: string | null;
  purchaseCount: number;
  totalMinor: number;
}

export function listTrips(
  db: Db,
  options: { status?: Trip["status"]; limit?: number } = {},
): TripSummaryLine[] {
  const conditions = [isNull(trips.deletedAt)];
  if (options.status !== undefined) {
    conditions.push(eq(trips.status, options.status));
  }
  const tripRows = db
    .select()
    .from(trips)
    .where(and(...conditions))
    .orderBy(desc(trips.startedAt))
    .limit(options.limit ?? 50)
    .all();
  if (tripRows.length === 0) {
    return [];
  }

  const tripIds = tripRows.map((t) => t.id);
  const aggregates = new Map(
    db
      .select({
        tripId: purchases.tripId,
        purchaseCount: count(),
        totalMinor: sql<number>`coalesce(sum(${purchases.shelfPriceMinor} * ${purchases.quantity}), 0)`,
      })
      .from(purchases)
      .where(and(isNull(purchases.deletedAt), inArray(purchases.tripId, tripIds)))
      .groupBy(purchases.tripId)
      .all()
      .map((row) => [row.tripId, row]),
  );

  const storeIds = [
    ...new Set(tripRows.map((t) => t.storeId).filter((id): id is string => id !== null)),
  ];
  const storeNames = new Map(
    storeIds.length === 0
      ? []
      : db
          .select({ id: stores.id, name: stores.name })
          .from(stores)
          .where(and(inArray(stores.id, storeIds), isNull(stores.deletedAt)))
          .all()
          .map((row) => [row.id, row.name]),
  );

  return tripRows.map((trip) => {
    const aggregate = aggregates.get(trip.id);
    return {
      ...trip,
      storeName: trip.storeId === null ? null : (storeNames.get(trip.storeId) ?? null),
      purchaseCount: aggregate?.purchaseCount ?? 0,
      totalMinor: Number(aggregate?.totalMinor ?? 0),
    };
  });
}

export function getTripStore(db: Db, trip: Trip): Store | undefined {
  if (trip.storeId === null) {
    return undefined;
  }
  return db
    .select()
    .from(stores)
    .where(and(eq(stores.id, trip.storeId), isNull(stores.deletedAt)))
    .get();
}
