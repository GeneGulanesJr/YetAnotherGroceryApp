import Database from "better-sqlite3";
import { afterEach, beforeAll, describe, expect, it } from "vitest";


import {
  DesktopSqliteDataSource,
  PlaceholderDataSource,
  type SqlExecutor,
} from "./data-source";

/**
 * SQLite integration fixtures (spec: "SQLite integration fixtures for
 * offline desktop behavior"). The same SQL the Tauri plugin executes at
 * runtime runs here against better-sqlite3, over the shared embedded
 * migrations.
 */

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 0, 5, 10, 0); // Mon 2026-01-05

function createExecutor(sqlite: Database.Database): SqlExecutor {
  return {
    async select<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      return sqlite.prepare(sql).all(...params) as T[];
    },
    async exec(sql: string): Promise<void> {
      sqlite.exec(sql);
    },
  };
}

describe("DesktopSqliteDataSource", () => {
  let sqlite: Database.Database;
  let source: DesktopSqliteDataSource;

  beforeAll(async () => {
    sqlite = new Database(":memory:");
    sqlite.pragma("foreign_keys = ON");
    source = new DesktopSqliteDataSource(createExecutor(sqlite));
    await source.initialize();

    const insertStore = sqlite.prepare(
      "INSERT INTO stores (id, created_at, updated_at, deleted_at, device_id, revision, sync_status, name) VALUES (?, ?, ?, NULL, 'dev', 0, 'synced', ?)",
    );
    insertStore.run("s1", T0, T0, "Save More");
    insertStore.run("s2", T0, T0, "Mega Mart");

    const insertCategory = sqlite.prepare(
      "INSERT INTO categories (id, created_at, updated_at, deleted_at, device_id, revision, sync_status, name) VALUES (?, ?, ?, NULL, 'dev', 0, 'synced', ?)",
    );
    insertCategory.run("c1", T0, T0, "Dairy");
    insertCategory.run("c2", T0, T0, "Bakery");

    const insertProduct = sqlite.prepare(
      "INSERT INTO products (id, created_at, updated_at, deleted_at, device_id, revision, sync_status, name, category_id) VALUES (?, ?, ?, NULL, 'dev', 0, 'synced', ?, ?)",
    );
    insertProduct.run("p1", T0, T0, "Milk 1L", "c1");
    insertProduct.run("p2", T0, T0, "Bread", "c2");

    const insertPurchase = sqlite.prepare(
      "INSERT INTO purchases (id, created_at, updated_at, deleted_at, device_id, revision, sync_status, product_id, store_id, currency, quantity, shelf_price_minor, purchased_at) VALUES (?, ?, ?, NULL, 'dev', 0, 'synced', ?, ?, ?, ?, ?, ?)",
    );
    insertPurchase.run("pu1", T0, T0, "p1", "s1", "PHP", 2, 5_000, T0);
    insertPurchase.run("pu2", T0, T0, "p2", "s1", "PHP", 1, 2_000, T0);
    insertPurchase.run("pu3", T0, T0, "p1", "s2", "PHP", 1, 6_000, T0 + DAY);
    insertPurchase.run("pu4", T0, T0, "p2", "s2", "PHP", 3, 1_500, T0 + DAY);

    const insertPrice = sqlite.prepare(
      "INSERT INTO prices (id, created_at, updated_at, deleted_at, device_id, revision, sync_status, product_id, currency, regular_price_minor, captured_at) VALUES (?, ?, ?, NULL, 'dev', 0, 'synced', ?, 'PHP', ?, ?)",
    );
    insertPrice.run("pr1", T0, T0, "p1", 10_000, T0);
    insertPrice.run("pr2", T0, T0, "p1", 12_000, T0 + DAY);
    insertPrice.run("pr3", T0, T0, "p1", 9_000, T0 + 2 * DAY);
    insertPrice.run("pr4", T0, T0, "p2", 2_000, T0);
  });

  afterEach(() => {
    // nothing persistent across tests; single shared fixture db
  });

  it("applies the shared migrations exactly once", async () => {
    const rows = await sqlite
      .prepare("SELECT user_version AS version FROM pragma_user_version")
      .all() as { version: number }[];
    expect(rows[0].version).toBe(4);
    await expect(source.initialize()).resolves.toBeUndefined();
  });

  it("computes the spending summary in SQL", async () => {
    const summaries = await source.getSpendingSummary({ currency: "PHP" });
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      currency: "PHP",
      totalMinor: 10_000 + 2_000 + 6_000 + 4_500,
      tripCount: 2,
      shoppingDays: 2,
      itemCount: 7,
      averageTripMinor: 11_250,
    });
  });

  it("buckets the daily spending series", async () => {
    const series = await source.getSpendingSeries("day", { currency: "PHP" });
    expect(series).toEqual([
      { date: "2026-01-05", amountMinor: 12_000, currency: "PHP" },
      { date: "2026-01-06", amountMinor: 10_500, currency: "PHP" },
    ]);
  });

  it("aggregates by store and category with names", async () => {
    const byStore = await source.getSpendingByStore({ currency: "PHP" });
    expect(byStore).toEqual([
      { id: "s1", name: "Save More", amountMinor: 12_000, currency: "PHP" },
      { id: "s2", name: "Mega Mart", amountMinor: 10_500, currency: "PHP" },
    ]);

    const byCategory = await source.getSpendingByCategory({ currency: "PHP" });
    expect(byCategory).toEqual([
      { id: "c1", name: "Dairy", amountMinor: 16_000, currency: "PHP" },
      { id: "c2", name: "Bakery", amountMinor: 6_500, currency: "PHP" },
    ]);
  });

  it("computes price watch stats with window functions", async () => {
    const watch = await source.getPriceWatch({ currency: "PHP" });
    const milk = watch.find((row) => row.productId === "p1")!;
    expect(milk).toMatchObject({
      productName: "Milk 1L",
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
});

describe("PlaceholderDataSource", () => {
  it("returns empty analytics", async () => {
    const source = new PlaceholderDataSource();
    expect(await source.getSpendingSummary()).toEqual([]);
    expect(await source.getSpendingSeries("day")).toEqual([]);
    expect(await source.getPriceWatch()).toEqual([]);
  });
});
