import { createProduct } from "../repositories/products";
import { createStore } from "../repositories/stores";
import {
  addProductToTrip,
  cancelTrip,
  completeTrip,
  getActiveTrip,
  getTripPurchases,
  listTrips,
  removePurchase,
  setPurchaseQuantity,
  startTrip,
  tripTotalMinor,
} from "../repositories/trips";
import { getPendingMutationCount } from "../repositories/meta";
import { createTestDb } from "../test-helpers";
import type { Db } from "../types";

describe("shopping trips", () => {
  let db: Db;

  beforeEach(() => {
    db = createTestDb();
  });

  it("returns the existing active trip instead of starting a second one", () => {
    const first = startTrip(db, { currency: "PHP" });
    const again = startTrip(db, { currency: "PHP" });
    expect(again.id).toBe(first.id);
    expect(getActiveTrip(db)?.id).toBe(first.id);
  });

  it("increments quantity on duplicate scans instead of adding a line", () => {
    const trip = startTrip(db, { currency: "PHP" });
    const milk = createProduct(db, { name: "Milk 1L", barcode: "4800017234567" });

    const first = addProductToTrip(db, {
      tripId: trip.id,
      productId: milk.id,
      currency: "PHP",
      shelfPriceMinor: 12_500,
      barcode: "4800017234567",
    });
    expect(first.duplicate).toBe(false);
    expect(first.purchase.quantity).toBe(1);

    const second = addProductToTrip(db, {
      tripId: trip.id,
      productId: milk.id,
      currency: "PHP",
      shelfPriceMinor: 12_500,
    });
    expect(second.duplicate).toBe(true);
    expect(second.purchase.id).toBe(first.purchase.id);
    expect(second.purchase.quantity).toBe(2);

    const lines = getTripPurchases(db, trip.id);
    expect(lines).toHaveLength(1);
    expect(lines[0].productName).toBe("Milk 1L");
    expect(tripTotalMinor(lines)).toBe(25_000);
  });

  it("supports deliberate separate lines when prices differ is a caller decision (same product still merges)", () => {
    const trip = startTrip(db, { currency: "PHP" });
    const apples = createProduct(db, { name: "Apples" });

    addProductToTrip(db, {
      tripId: trip.id,
      productId: apples.id,
      currency: "PHP",
      shelfPriceMinor: 5_000,
    });
    const higher = addProductToTrip(db, {
      tripId: trip.id,
      productId: apples.id,
      currency: "PHP",
      shelfPriceMinor: 9_000,
    });

    // Duplicate detection wins; the recorded shelf price stays the first one.
    expect(higher.duplicate).toBe(true);
    expect(getTripPurchases(db, trip.id)[0].shelfPriceMinor).toBe(5_000);
  });

  it("adjusts and removes quantities; zero removes the line", () => {
    const trip = startTrip(db, { currency: "PHP" });
    const eggs = createProduct(db, { name: "Eggs" });
    const { purchase } = addProductToTrip(db, {
      tripId: trip.id,
      productId: eggs.id,
      currency: "PHP",
      shelfPriceMinor: 8_000,
    });

    expect(setPurchaseQuantity(db, purchase.id, 3)?.quantity).toBe(3);
    setPurchaseQuantity(db, purchase.id, 0);
    expect(getTripPurchases(db, trip.id)).toHaveLength(0);

    const more = addProductToTrip(db, {
      tripId: trip.id,
      productId: eggs.id,
      currency: "PHP",
      shelfPriceMinor: 8_000,
    });
    removePurchase(db, more.purchase.id);
    expect(getTripPurchases(db, trip.id)).toHaveLength(0);
  });

  it("completes a trip once and reports it in history with totals", () => {
    const store = createStore(db, { name: "Save More" });
    const trip = startTrip(db, { currency: "PHP", storeId: store.id });
    const milk = createProduct(db, { name: "Milk 1L" });
    const bread = createProduct(db, { name: "Bread" });
    addProductToTrip(db, { tripId: trip.id, productId: milk.id, currency: "PHP", shelfPriceMinor: 12_500 });
    addProductToTrip(db, { tripId: trip.id, productId: bread.id, currency: "PHP", shelfPriceMinor: 6_000, quantity: 2 });

    const completed = completeTrip(db, trip.id);
    expect(completed?.status).toBe("completed");
    expect(completed?.endedAt).not.toBeNull();
    // Completing twice is a no-op.
    expect(completeTrip(db, trip.id)).toBeUndefined();
    expect(getActiveTrip(db)).toBeUndefined();

    const history = listTrips(db, { status: "completed" });
    expect(history).toHaveLength(1);
    expect(history[0].storeName).toBe("Save More");
    expect(history[0].purchaseCount).toBe(2);
    expect(history[0].totalMinor).toBe(12_500 + 6_000 * 2);
  });

  it("cancels an active trip", () => {
    const trip = startTrip(db, { currency: "PHP" });
    expect(cancelTrip(db, trip.id)?.status).toBe("cancelled");
    expect(getActiveTrip(db)).toBeUndefined();
  });

  it("writes outbox mutations for every trip operation", () => {
    const before = getPendingMutationCount(db);
    const trip = startTrip(db, { currency: "PHP" });
    const milk = createProduct(db, { name: "Milk 1L" });
    addProductToTrip(db, { tripId: trip.id, productId: milk.id, currency: "PHP", shelfPriceMinor: 1_000 });
    completeTrip(db, trip.id);

    const delta = getPendingMutationCount(db) - before;
    // trip insert + product insert + purchase insert + purchase insert? no:
    // trip + product + purchase + trip update = 4
    expect(delta).toBe(4);
  });
});
