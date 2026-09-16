/**
 * Domain analytics calculations shared by every surface (tech.desktop.md:
 * "All analytics must use the shared domain package"). Pure functions over
 * canonical rows; money is always integer minor units and currencies are
 * never mixed — every result is segmented per currency.
 */

export interface PurchaseRow {
  /** UTC epoch ms. */
  purchasedAt: number;
  currency: string;
  quantity: number;
  shelfPriceMinor: number;
  /** Line total actually charged per unit of the line (price × quantity is derived). */
  productId: string;
  storeId: string | null;
}

export interface SpendingSummary {
  currency: string;
  totalMinor: number;
  tripCount: number;
  itemCount: number;
  averageTripMinor: number;
  /** Distinct shopping days in range — shopping frequency. */
  shoppingDays: number;
}

export type Granularity = "day" | "week" | "month";

export interface SpendingPoint {
  /** Bucket start as ISO date (UTC). */
  date: string;
  amountMinor: number;
  currency: string;
}

export interface NamedAmount {
  name: string;
  amountMinor: number;
  currency: string;
}

function groupByCurrency<T>(rows: readonly T[], currencyOf: (row: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const list = groups.get(currencyOf(row));
    if (list === undefined) {
      groups.set(currencyOf(row), [row]);
    } else {
      list.push(row);
    }
  }
  return groups;
}

export function computeSpendingSummary(
  purchases: readonly PurchaseRow[],
): SpendingSummary[] {
  return [...groupByCurrency(purchases, (p) => p.currency).entries()].map(
    ([currency, rows]) => {
      const totalMinor = rows.reduce(
        (sum, row) => sum + row.shelfPriceMinor * row.quantity,
        0,
      );
      const tripKeys = new Set(rows.map((row) => tripKeyOf(row.purchasedAt, row.storeId)));
      const dayKeys = new Set(rows.map((row) => dayKeyOf(row.purchasedAt)));
      const itemCount = rows.reduce((sum, row) => sum + row.quantity, 0);
      return {
        currency,
        totalMinor,
        tripCount: tripKeys.size,
        itemCount,
        averageTripMinor: tripKeys.size === 0 ? 0 : Math.round(totalMinor / tripKeys.size),
        shoppingDays: dayKeys.size,
      };
    },
  );
}

/** Trip identity: a store visit on a calendar day (purchases carry no trip id here). */
function tripKeyOf(purchasedAt: number, storeId: string | null): string {
  return `${dayKeyOf(purchasedAt)}@${storeId ?? "-"}`;
}

function dayKeyOf(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10);
}

export function buildSpendingSeries(
  purchases: readonly PurchaseRow[],
  options: { granularity: Granularity },
): SpendingPoint[] {
  const bucketOf = (epochMs: number): string => {
    const date = new Date(epochMs);
    const iso = date.toISOString();
    switch (options.granularity) {
      case "day":
        return iso.slice(0, 10);
      case "week": {
        // ISO week: Monday as bucket start.
        const day = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
        const monday = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - (day - 1));
        return new Date(monday).toISOString().slice(0, 10);
      }
      case "month":
        return iso.slice(0, 7) + "-01";
    }
  };

  const buckets = new Map<string, { currency: string; amountMinor: number }>();
  for (const row of purchases) {
    const key = `${bucketOf(row.purchasedAt)}|${row.currency}`;
    const bucket = buckets.get(key);
    const line = row.shelfPriceMinor * row.quantity;
    if (bucket === undefined) {
      buckets.set(key, { currency: row.currency, amountMinor: line });
    } else {
      bucket.amountMinor += line;
    }
  }

  return [...buckets.entries()]
    .map(([key, bucket]) => ({
      date: key.split("|")[0],
      amountMinor: bucket.amountMinor,
      currency: bucket.currency,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function spendingByStore(
  purchases: readonly PurchaseRow[],
  storeNames: Readonly<Record<string, string>>,
): NamedAmount[] {
  const results: NamedAmount[] = [];
  for (const [currency, rows] of groupByCurrency(purchases, (p) => p.currency)) {
    const perStore = new Map<string, number>();
    for (const row of rows) {
      const key = row.storeId ?? "unassigned";
      perStore.set(key, (perStore.get(key) ?? 0) + row.shelfPriceMinor * row.quantity);
    }
    for (const [storeId, amountMinor] of perStore) {
      results.push({
        name: storeNames[storeId] ?? (storeId === "unassigned" ? "No store" : storeId),
        amountMinor,
        currency,
      });
    }
  }
  return results.sort((a, b) => b.amountMinor - a.amountMinor);
}

export interface PriceStats {
  productId: string;
  currency: string;
  observationCount: number;
  latestMinor: number | null;
  averageMinor: number | null;
  lowestMinor: number | null;
  highestMinor: number | null;
  /** latest vs previous-observation percentage, null when < 2 points. */
  trendPercent: number | null;
  latestAtLowest: boolean;
  latestAtHighest: boolean;
}

export interface PriceObservationRow {
  productId: string;
  currency: string;
  /** UTC epoch ms. */
  capturedAt: number;
  regularPriceMinor: number;
}

/** Per-product price statistics ordered oldest→newest within each product. */
export function computePriceStats(
  observations: readonly PriceObservationRow[],
): PriceStats[] {
  const byProduct = new Map<string, PriceObservationRow[]>();
  for (const row of observations) {
    const list = byProduct.get(row.productId);
    if (list === undefined) {
      byProduct.set(row.productId, [row]);
    } else {
      list.push(row);
    }
  }

  const stats: PriceStats[] = [];
  for (const [productId, rows] of byProduct) {
    const sorted = [...rows].sort((a, b) => a.capturedAt - b.capturedAt);
    const prices = sorted.map((row) => row.regularPriceMinor);
    const latest = prices[prices.length - 1] ?? null;
    const previous = prices.length >= 2 ? prices[prices.length - 2] : null;
    const lowest = prices.length > 0 ? Math.min(...prices) : null;
    const highest = prices.length > 0 ? Math.max(...prices) : null;
    stats.push({
      productId,
      currency: sorted[0].currency,
      observationCount: prices.length,
      latestMinor: latest,
      averageMinor:
        prices.length === 0
          ? null
          : Math.round(prices.reduce((sum, price) => sum + price, 0) / prices.length),
      lowestMinor: lowest,
      highestMinor: highest,
      trendPercent:
        latest === null || previous === null || previous === 0
          ? null
          : Math.round(((latest - previous) / previous) * 1000) / 10,
      latestAtLowest: latest !== null && latest === lowest,
      latestAtHighest: latest !== null && latest === highest,
    });
  }
  return stats.sort((a, b) => a.productId.localeCompare(b.productId));
}
