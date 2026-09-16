import { eq } from "drizzle-orm";

import { purchases, receiptAliases } from "../schema";
import { createProduct, updateProduct } from "../repositories/products";
import { createReceiptWithLines, listReceipts } from "../repositories/receipts";
import { addProductToTrip, startTrip } from "../repositories/trips";
import { createStore } from "../repositories/stores";
import { createTestDb } from "../test-helpers";
import type { Db } from "../types";

describe("receipts", () => {
  let db: Db;

  beforeEach(() => {
    db = createTestDb();
  });

  it("saves receipt + lines transactionally with computed totals", () => {
    const receipt = createReceiptWithLines(db, {
      tripId: null,
      storeId: null,
      currency: "PHP",
      lines: [
        { lineType: "product", descriptionRaw: "MILK 123.00", descriptionCorrected: "Milk", quantity: 1, unitPriceMinor: 12_300, lineTotalMinor: 12_300 },
        { lineType: "product", descriptionRaw: "BREAD 2x 50.00", descriptionCorrected: "Bread", quantity: 2, unitPriceMinor: 2_500, lineTotalMinor: 5_000 },
        { lineType: "tax", descriptionRaw: "VAT 20.00", descriptionCorrected: null, quantity: null, unitPriceMinor: 2_000, lineTotalMinor: 2_000 },
        { lineType: "total", descriptionRaw: "TOTAL 173.00", descriptionCorrected: null, quantity: null, unitPriceMinor: 17_300, lineTotalMinor: 17_300 },
      ],
    });

    expect(receipt.subtotalMinor).toBe(17_300);
    expect(receipt.totalMinor).toBe(17_300);
    expect(receipt.taxMinor).toBe(2_000);
    expect(receipt.verifiedAt).not.toBeNull();
    expect(listReceipts(db)[0].lineCount).toBe(4);
  });

  it("matches receipt lines to trip purchases and records discrepancies", () => {
    const trip = startTrip(db, { currency: "PHP" });
    const milk = createProduct(db, { name: "Nestle Fresh Milk 1L" });
    addProductToTrip(db, {
      tripId: trip.id,
      productId: milk.id,
      currency: "PHP",
      shelfPriceMinor: 12_000, // shelf said 120.00
    });

    const receipt = createReceiptWithLines(db, {
      tripId: trip.id,
      storeId: null,
      currency: "PHP",
      lines: [
        {
          lineType: "product",
          descriptionRaw: "NESTLE FRESH MILK 1L 125.00",
          descriptionCorrected: null,
          quantity: 1,
          unitPriceMinor: 12_500, // receipt charged 125.00
          lineTotalMinor: 12_500,
        },
      ],
    });

    // Overcharge of 5.00 recorded on both the receipt and the purchase.
    expect(receipt.overchargeMinor).toBe(500);

    const row = db
      .select()
      .from(purchases)
      .where(eq(purchases.tripId, trip.id))
      .get();
    expect(row?.receiptId).toBe(receipt.id);
    expect(row?.receiptUnitPriceMinor).toBe(12_500);
    expect(row?.priceDiscrepancyMinor).toBe(500);
  });

  it("does not match ambiguous descriptions", () => {
    const trip = startTrip(db, { currency: "PHP" });
    const a = createProduct(db, { name: "Milk Chocolate Bar" });
    const b = createProduct(db, { name: "Milk Candy" });
    addProductToTrip(db, { tripId: trip.id, productId: a.id, currency: "PHP", shelfPriceMinor: 1_000 });
    addProductToTrip(db, { tripId: trip.id, productId: b.id, currency: "PHP", shelfPriceMinor: 1_000 });

    const receipt = createReceiptWithLines(db, {
      tripId: trip.id,
      storeId: null,
      currency: "PHP",
      lines: [
        { lineType: "product", descriptionRaw: "MILK 10.00", descriptionCorrected: null, quantity: 1, unitPriceMinor: 1_000, lineTotalMinor: 1_000 },
      ],
    });

    expect(receipt.overchargeMinor).toBeNull();
  });

  it("learns store aliases and resolves them when containment no longer matches", () => {
    const store = createStore(db, { name: "Save More" });
    const milk = createProduct(db, { name: "Nestle Fresh Milk" });

    // Trip 1: containment matches ("...fresh milk 1l" contains the product
    // name), and the exact receipt description is learned as an alias.
    const trip1 = startTrip(db, { currency: "PHP", storeId: store.id });
    addProductToTrip(db, { tripId: trip1.id, productId: milk.id, currency: "PHP", shelfPriceMinor: 12_000 });
    createReceiptWithLines(db, {
      tripId: trip1.id,
      storeId: store.id,
      currency: "PHP",
      lines: [
        { lineType: "product", descriptionRaw: "NESTLE FRESH MILK 1L 120.00", descriptionCorrected: null, quantity: 1, unitPriceMinor: 12_000, lineTotalMinor: 12_000 },
      ],
    });
    expect(
      db.select().from(receiptAliases).all().map((a) => a.alias),
    ).toContain("nestle fresh milk 1l");

    // The user renames the product; the next receipt prints the same
    // receipt-string, which no longer containment-matches the new name.
    updateProduct(db, milk.id, { name: "Selected Dairy Milk 1 Liter" });
    const trip2 = startTrip(db, { currency: "PHP", storeId: store.id });
    addProductToTrip(db, { tripId: trip2.id, productId: milk.id, currency: "PHP", shelfPriceMinor: 12_000 });
    const receipt2 = createReceiptWithLines(db, {
      tripId: trip2.id,
      storeId: store.id,
      currency: "PHP",
      lines: [
        { lineType: "product", descriptionRaw: "NESTLE FRESH MILK 1L 125.00", descriptionCorrected: null, quantity: 1, unitPriceMinor: 12_500, lineTotalMinor: 12_500 },
      ],
    });

    // Alias resolution still tied the line to the milk purchase: +5.00 over.
    expect(receipt2.overchargeMinor).toBe(500);
  });
});
