import { describe, expect, it } from "vitest";

import {
  buildSpendingSeries,
  computePriceStats,
  computeSpendingSummary,
  spendingByStore,
  type PriceObservationRow,
  type PurchaseRow,
} from "./analytics";

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 0, 5, 10, 0); // Mon Jan 5 2026

function purchase(overrides: Partial<PurchaseRow> = {}): PurchaseRow {
  return {
    purchasedAt: T0,
    currency: "PHP",
    quantity: 1,
    shelfPriceMinor: 10_000,
    productId: "p1",
    storeId: "s1",
    ...overrides,
  };
}

describe("spending summary", () => {
  it("totals lines, counts trips and shopping days per currency", () => {
    const rows = [
      purchase({ quantity: 2, shelfPriceMinor: 5_000 }),
      purchase({ purchasedAt: T0 + DAY, storeId: "s1" }),
      purchase({ purchasedAt: T0 + DAY, storeId: "s2" }),
      purchase({ currency: "USD", shelfPriceMinor: 100 }),
    ];
    const summaries = computeSpendingSummary(rows);
    const php = summaries.find((s) => s.currency === "PHP")!;
    expect(php.totalMinor).toBe(30_000);
    expect(php.tripCount).toBe(3); // day+store identity: (d0,s1), (d1,s1), (d1,s2)
    expect(php.shoppingDays).toBe(2);
    expect(php.averageTripMinor).toBe(10_000);
    expect(php.itemCount).toBe(4);
    expect(summaries.find((s) => s.currency === "USD")?.totalMinor).toBe(100);
  });

  it("returns an empty list for empty input", () => {
    expect(computeSpendingSummary([])).toEqual([]);
  });
});

describe("spending series", () => {
  it("buckets daily, weekly (ISO Monday), and monthly in UTC", () => {
    const rows = [
      purchase({ purchasedAt: T0, shelfPriceMinor: 1_000 }),
      purchase({ purchasedAt: T0 + 2 * DAY, shelfPriceMinor: 2_000 }), // Wed, same ISO week
      purchase({ purchasedAt: T0 + 7 * DAY, shelfPriceMinor: 4_000 }), // next Monday
      purchase({ purchasedAt: T0 + 32 * DAY, shelfPriceMinor: 8_000 }), // Feb
    ];
    const daily = buildSpendingSeries(rows, { granularity: "day" });
    expect(daily.map((point) => point.amountMinor)).toEqual([1_000, 2_000, 4_000, 8_000]);

    const weekly = buildSpendingSeries(rows, { granularity: "week" });
    expect(weekly.map((point) => point.amountMinor)).toEqual([3_000, 4_000, 8_000]);

    const monthly = buildSpendingSeries(rows, { granularity: "month" });
    expect(monthly.map((point) => point.amountMinor)).toEqual([7_000, 8_000]);
    expect(monthly[0].date).toBe("2026-01-01");
  });
});

describe("spending by store", () => {
  it("aggregates per store with names and sorts descending", () => {
    const rows = [
      purchase({ storeId: "s1", shelfPriceMinor: 1_000 }),
      purchase({ storeId: "s2", shelfPriceMinor: 3_000 }),
      purchase({ storeId: "s1", shelfPriceMinor: 500, quantity: 2 }),
      purchase({ storeId: null, shelfPriceMinor: 25 }),
    ];
    const byStore = spendingByStore(rows, { s1: "Save More", s2: "Mega Mart" });
    expect(byStore[0]).toEqual({ name: "Mega Mart", amountMinor: 3_000, currency: "PHP" });
    expect(byStore[1]).toEqual({ name: "Save More", amountMinor: 2_000, currency: "PHP" });
    expect(byStore[2].name).toBe("No store");
  });
});

describe("price stats", () => {
  const observations: PriceObservationRow[] = [
    { productId: "p1", currency: "PHP", capturedAt: T0, regularPriceMinor: 10_000 },
    { productId: "p1", currency: "PHP", capturedAt: T0 + DAY, regularPriceMinor: 12_000 },
    { productId: "p1", currency: "PHP", capturedAt: T0 + 2 * DAY, regularPriceMinor: 9_000 },
  ];

  it("computes latest/average/extremes and trend", () => {
    const [stats] = computePriceStats(observations);
    expect(stats).toMatchObject({
      productId: "p1",
      observationCount: 3,
      latestMinor: 9_000,
      averageMinor: 10_333,
      lowestMinor: 9_000,
      highestMinor: 12_000,
      trendPercent: -25,
      latestAtLowest: true,
      latestAtHighest: false,
    });
  });

  it("returns null trend for single observations", () => {
    const [stats] = computePriceStats([observations[0]]);
    expect(stats.trendPercent).toBeNull();
    expect(stats.latestAtLowest).toBe(true);
    expect(stats.latestAtHighest).toBe(true);
  });
});
