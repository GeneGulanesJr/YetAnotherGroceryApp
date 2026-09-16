/**
 * Analytics endpoint tests against fixture rows, asserting exact minor-unit
 * values and the exact bucket/date formats the Desktop dashboard expects
 * (web-desktop/src/lib/data-source.ts DesktopSqliteDataSource is the
 * reference: day %Y-%m-%d, week %Y-%W, month %Y-%m-01, UTC).
 */
import { describe, expect, it } from "vitest";

import type { NamedAmount, PriceWatchRow, SpendingPoint, SpendingSummary } from "../src/analytics/queries.js";
import { buildTestApp, createTestDb, type ApiDb } from "./helpers.js";

const DAY1 = Date.parse("2026-03-02T10:00:00Z"); // Monday
const DAY1B = Date.parse("2026-03-02T11:00:00Z");
const DAY1C = Date.parse("2026-03-02T12:00:00Z");
const DAY2 = Date.parse("2026-03-03T09:00:00Z");
const DAY3 = Date.parse("2026-03-10T08:00:00Z");

interface TestApp {
  app: Awaited<ReturnType<typeof buildTestApp>>;
  db: ApiDb;
  pu7At: number;
}

/**
 * Canonical-row fixtures:
 * - USD purchases: pu1 (p1@s1, qty2 x 500 = 1000), pu2 (p2@s1, 250),
 *   pu3 (p1@s2, 300), pu5 (p1@s1 on DAY3, 1000), pu6 (deleted, excluded),
 *   pu7 (now-2d, qty2 x 100 = 200) — USD total 2750 over 4 trips / 3 days.
 * - EUR: pu4 (p3, no store, qty3 x 150 = 450).
 */
async function buildFixture(): Promise<TestApp> {
  const db = createTestDb();
  const insertBase = (
    table: string,
    id: string,
    extra: Record<string, string | number | null>,
  ): void => {
    const columns = Object.keys(extra);
    const sql =
      `INSERT INTO ${table} (id, created_at, updated_at, deleted_at, device_id, revision, sync_status, ` +
      `${columns.join(", ")}) VALUES (?, ?, ?, ?, 'fixture', 0, 'synced', ` +
      `${columns.map(() => "?").join(", ")})`;
    db.sqlite
      .prepare(sql)
      .run(id, DAY1, DAY1, null, ...columns.map((column) => extra[column]));
  };

  insertBase("categories", "cat-1", { name: "Drinks", parent_id: null, default_unit: null });
  insertBase("stores", "store-1", { name: "Store One", branch: null, address: null, logo_image_id: null });
  insertBase("stores", "store-2", { name: "Store Two", branch: null, address: null, logo_image_id: null });
  insertBase("products", "prod-1", {
    name: "Alpha Milk", brand: null, category_id: "cat-1", package_quantity: null,
    package_size: null, unit: null, notes: null, photo_image_id: null, is_favorite: 0, archived_at: null,
  });
  insertBase("products", "prod-2", {
    name: "Beta Bread", brand: null, category_id: "cat-1", package_quantity: null,
    package_size: null, unit: null, notes: null, photo_image_id: null, is_favorite: 0, archived_at: null,
  });
  insertBase("products", "prod-3", {
    name: "Gamma Tea", brand: null, category_id: null, package_quantity: null,
    package_size: null, unit: null, notes: null, photo_image_id: null, is_favorite: 0, archived_at: null,
  });
  insertBase("products", "prod-4", {
    name: "Delta Coffee", brand: null, category_id: null, package_quantity: null,
    package_size: null, unit: null, notes: null, photo_image_id: null, is_favorite: 0, archived_at: null,
  });

  const insertPurchase = (
    id: string,
    productId: string,
    storeId: string | null,
    currency: string,
    quantity: number,
    shelfPriceMinor: number,
    purchasedAt: number,
    deleted = false,
  ): void => {
    db.sqlite
      .prepare(
        `INSERT INTO purchases (id, created_at, updated_at, deleted_at, device_id, revision, sync_status,
           product_id, store_id, currency, quantity, shelf_price_minor, purchased_at)
         VALUES (?, ?, ?, ?, 'fixture', 0, 'synced', ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, purchasedAt, purchasedAt, deleted ? purchasedAt : null, productId, storeId, currency, quantity, shelfPriceMinor, purchasedAt);
  };

  insertPurchase("pu-1", "prod-1", "store-1", "USD", 2, 500, DAY1); // 1000
  insertPurchase("pu-2", "prod-2", "store-1", "USD", 1, 250, DAY1B); // 250
  insertPurchase("pu-3", "prod-1", "store-2", "USD", 1, 300, DAY1C); // 300 (second trip, same day)
  insertPurchase("pu-4", "prod-3", null, "EUR", 3, 150, DAY2); // 450
  insertPurchase("pu-5", "prod-1", "store-1", "USD", 1, 1000, DAY3); // 1000
  insertPurchase("pu-6", "prod-2", "store-1", "USD", 5, 100, DAY1B, true); // tombstoned: excluded

  const pu7At = Date.now() - 2 * 86_400_000;
  insertPurchase("pu-7", "prod-2", "store-1", "USD", 2, 100, pu7At); // 200, in-range window row

  const insertPrice = (id: string, productId: string, price: number, capturedAt: number, deleted = false): void => {
    db.sqlite
      .prepare(
        `INSERT INTO prices (id, created_at, updated_at, deleted_at, device_id, revision, sync_status,
           product_id, store_id, currency, regular_price_minor, captured_at)
         VALUES (?, ?, ?, ?, 'fixture', 0, 'synced', ?, NULL, 'USD', ?, ?)`,
      )
      .run(id, capturedAt, capturedAt, deleted ? capturedAt : null, productId, price, capturedAt);
  };

  insertPrice("price-1", "prod-1", 1000, Date.parse("2026-03-01T09:00:00Z"));
  insertPrice("price-2", "prod-1", 900, Date.parse("2026-03-05T09:00:00Z"));
  insertPrice("price-3", "prod-1", 1200, Date.parse("2026-03-09T09:00:00Z"));
  insertPrice("price-4", "prod-2", 250, Date.parse("2026-03-02T09:00:00Z"));
  insertPrice("price-5", "prod-3", 999, Date.parse("2026-03-02T09:00:00Z"), true); // deleted: excluded
  insertPrice("price-6", "prod-2", 300, Date.now() - 86_400_000);
  insertPrice("price-7", "prod-4", 700, Date.parse("2026-03-02T09:00:00Z"));

  const app = await buildTestApp(db);
  return { app, db, pu7At };
}

async function getJson<T>(test: TestApp, path: string): Promise<T> {
  const response = await test.app.inject({ method: "GET", url: path });
  expect(response.statusCode).toBe(200);
  return response.json() as T;
}

describe("analytics API", () => {
  it("aggregates spending summary per currency with exact minor units", async () => {
    const test = await buildFixture();

    const summary = await getJson<SpendingSummary[]>(test, "/analytics/spending-summary");
    expect(summary).toEqual([
      {
        currency: "EUR",
        totalMinor: 450,
        tripCount: 1,
        shoppingDays: 1,
        itemCount: 3,
        averageTripMinor: 450,
      },
      {
        currency: "USD",
        totalMinor: 2750, // 1000 + 250 + 300 + 1000 + 200 (deleted pu-6 excluded)
        tripCount: 4, // day1@store1, day1@store2, day3@store1, pu-7 day@store1
        shoppingDays: 3,
        itemCount: 7,
        averageTripMinor: 688, // Math.round(2750 / 4)
      },
    ]);
  });

  it("applies currency and rangeDays filters", async () => {
    const test = await buildFixture();

    const eur = await getJson<SpendingSummary[]>(test, "/analytics/spending-summary?currency=EUR");
    expect(eur).toEqual([
      { currency: "EUR", totalMinor: 450, tripCount: 1, shoppingDays: 1, itemCount: 3, averageTripMinor: 450 },
    ]);

    // Rolling 7-day window only catches pu-7 (now - 2 days).
    const week = await getJson<SpendingSummary[]>(test, "/analytics/spending-summary?rangeDays=7");
    expect(week).toEqual([
      { currency: "USD", totalMinor: 200, tripCount: 1, shoppingDays: 1, itemCount: 2, averageTripMinor: 200 },
    ]);

    const empty = await getJson<SpendingSummary[]>(test, "/analytics/spending-summary?rangeDays=1");
    expect(empty).toEqual([]);
  });

  it("builds day/week/month series with the Desktop bucket formats (UTC)", async () => {
    const test = await buildFixture();
    const pu7Day = new Date(test.pu7At).toISOString().slice(0, 10);
    const pu7Week = (
      test.db.sqlite.prepare(`SELECT strftime('%Y-%W', ? / 1000, 'unixepoch') AS b`).get(test.pu7At) as { b: string }
    ).b;
    const pu7Month = `${pu7Day.slice(0, 7)}-01`;

    const day = await getJson<SpendingPoint[]>(test, "/analytics/spending-series?granularity=day&currency=USD");
    expect(day).toEqual([
      { date: "2026-03-02", amountMinor: 1550, currency: "USD" },
      { date: "2026-03-10", amountMinor: 1000, currency: "USD" },
      { date: pu7Day, amountMinor: 200, currency: "USD" },
    ]);

    // %Y-%W: 2026-03-02 (Mon) is week 09, 2026-03-10 is week 10.
    const week = await getJson<SpendingPoint[]>(test, "/analytics/spending-series?granularity=week&currency=USD");
    expect(week).toEqual([
      { date: "2026-09", amountMinor: 1550, currency: "USD" },
      { date: "2026-10", amountMinor: 1000, currency: "USD" },
      { date: pu7Week, amountMinor: 200, currency: "USD" },
    ]);

    const month = await getJson<SpendingPoint[]>(test, "/analytics/spending-series?granularity=month");
    expect(month).toEqual([
      { date: "2026-03-01", amountMinor: 450, currency: "EUR" },
      { date: "2026-03-01", amountMinor: 2550, currency: "USD" },
      { date: pu7Month, amountMinor: 200, currency: "USD" },
    ]);

    const bad = await test.app.inject({ method: "GET", url: "/analytics/spending-series?granularity=year" });
    expect(bad.statusCode).toBe(400);
  });

  it("groups spending by store with Desktop id/name fallbacks", async () => {
    const test = await buildFixture();

    const byStore = await getJson<NamedAmount[]>(test, "/analytics/spending-by-store");
    expect(byStore).toEqual([
      { id: "store-1", name: "Store One", amountMinor: 2450, currency: "USD" },
      { id: "unassigned", name: "No store", amountMinor: 450, currency: "EUR" },
      { id: "store-2", name: "Store Two", amountMinor: 300, currency: "USD" },
    ]);
  });

  it("groups spending by category with the Uncategorized fallback", async () => {
    const test = await buildFixture();

    const byCategory = await getJson<NamedAmount[]>(test, "/analytics/spending-by-category");
    // Desktop's shared SQL gives an id-less row the "No store" fallback even
    // on the category query (namedAmounts is shared) — replicated exactly.
    expect(byCategory).toEqual([
      { id: "cat-1", name: "Drinks", amountMinor: 2750, currency: "USD" },
      { id: "unassigned", name: "No store", amountMinor: 450, currency: "EUR" },
    ]);
  });

  it("computes price-watch stats: latest/average/low/high/trend/flags", async () => {
    const test = await buildFixture();

    const watch = await getJson<PriceWatchRow[]>(test, "/analytics/price-watch");
    expect(watch).toEqual([
      {
        productId: "prod-1",
        productName: "Alpha Milk",
        currency: "USD",
        observationCount: 3,
        latestMinor: 1200,
        averageMinor: 1033, // Math.round(3100 / 3)
        lowestMinor: 900,
        highestMinor: 1200,
        trendPercent: 33.3, // (1200 - 900) / 900 = 0.3333 -> 1 decimal
        latestAtLowest: false,
        latestAtHighest: true,
      },
      {
        productId: "prod-2",
        productName: "Beta Bread",
        currency: "USD",
        observationCount: 2,
        latestMinor: 300, // price-6 (now - 1d) is the latest observation
        averageMinor: 275,
        lowestMinor: 250,
        highestMinor: 300,
        trendPercent: 20, // (300 - 250) / 250
        latestAtLowest: false,
        latestAtHighest: true,
      },
      {
        productId: "prod-4",
        productName: "Delta Coffee",
        currency: "USD",
        observationCount: 1,
        latestMinor: 700,
        averageMinor: 700,
        lowestMinor: 700,
        highestMinor: 700,
        trendPercent: null, // < 2 observations
        latestAtLowest: true,
        latestAtHighest: true,
      },
    ]);
    // prod-3 is absent: its only price row is a tombstone.
  });

  it("filters price-watch by currency and rangeDays (captured_at window)", async () => {
    const test = await buildFixture();

    const eur = await getJson<PriceWatchRow[]>(test, "/analytics/price-watch?currency=EUR");
    expect(eur).toEqual([]);

    // Only price-6 (now - 1d) survives the 7-day captured_at window.
    const recent = await getJson<PriceWatchRow[]>(test, "/analytics/price-watch?rangeDays=7");
    expect(recent).toEqual([
      {
        productId: "prod-2",
        productName: "Beta Bread",
        currency: "USD",
        observationCount: 1,
        latestMinor: 300,
        averageMinor: 300,
        lowestMinor: 300,
        highestMinor: 300,
        trendPercent: null,
        latestAtLowest: true,
        latestAtHighest: true,
      },
    ]);
  });

  it("rejects invalid filter values with 400", async () => {
    const test = await buildFixture();
    for (const url of [
      "/analytics/spending-summary?rangeDays=-5",
      "/analytics/spending-summary?rangeDays=abc",
      "/analytics/spending-summary?currency=",
      "/analytics/price-watch?rangeDays=0",
    ]) {
      const response = await test.app.inject({ method: "GET", url });
      expect(response.statusCode, url).toBe(400);
    }
  });
});
