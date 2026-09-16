/**
 * Analytics aggregations (GET /analytics/*) — SQL ported 1:1 from
 * `web-desktop/src/lib/data-source.ts` (DesktopSqliteDataSource), which is the
 * reference implementation the dashboards are built against:
 * - money is integer minor units, never mixed across currencies: every result
 *   row carries its currency;
 * - line total is shelf_price_minor * quantity;
 * - a "trip" is a distinct UTC day + store pair; shoppingDays is distinct UTC
 *   days; averageTripMinor is Math.round(total / trips);
 * - series buckets are SQLite strftime strings in UTC:
 *   day = %Y-%m-%d, week = %Y-%W, month = %Y-%m-01 (Desktop's exact formats);
 * - price-watch windows partition by product (Desktop behavior), latest =
 *   greatest captured_at (id tiebreak DESC), trend = latest vs previous.
 * Filters mirror Desktop: rangeDays is a rolling window on purchased_at
 * (captured_at for price-watch), currency filters rows, deleted rows excluded.
 */
import type { ApiDb } from "../db/client.js";

export type Granularity = "day" | "week" | "month";

export interface AnalyticsFilters {
  rangeDays?: number;
  currency?: string;
}

export interface SpendingSummary {
  currency: string;
  totalMinor: number;
  tripCount: number;
  itemCount: number;
  averageTripMinor: number;
  shoppingDays: number;
}

export interface SpendingPoint {
  date: string;
  amountMinor: number;
  currency: string;
}

export interface NamedAmount {
  id: string;
  name: string;
  amountMinor: number;
  currency: string;
}

export interface PriceWatchRow {
  productId: string;
  productName: string;
  currency: string;
  observationCount: number;
  latestMinor: number | null;
  averageMinor: number | null;
  lowestMinor: number | null;
  highestMinor: number | null;
  trendPercent: number | null;
  latestAtLowest: boolean;
  latestAtHighest: boolean;
}

const DAY_MS = 86_400_000;

const BUCKET_FORMATS: Readonly<Record<Granularity, string>> = {
  day: "%Y-%m-%d",
  week: "%Y-%W",
  month: "%Y-%m-01",
};

interface SummarySqlRow {
  currency: string;
  total_minor: number | null;
  trip_count: number;
  shopping_days: number;
  item_count: number | null;
}

interface SeriesSqlRow {
  bucket: string;
  currency: string;
  total_minor: number | null;
}

interface NamedSqlRow {
  id: string | null;
  name: string | null;
  currency: string;
  total_minor: number | null;
}

interface PriceWatchSqlRow {
  product_id: string;
  product_name: string | null;
  currency: string;
  observation_count: number;
  latest_minor: number | null;
  previous_minor: number | null;
  average_minor: number | null;
  lowest_minor: number | null;
  highest_minor: number | null;
}

/** WHERE clause over purchases — identical to Desktop's purchasesWhere. */
function purchasesWhere(filters: AnalyticsFilters): { sql: string; params: unknown[] } {
  const conditions = ["p.deleted_at IS NULL"];
  const params: unknown[] = [];
  if (filters.rangeDays !== undefined) {
    conditions.push("p.purchased_at >= ?");
    params.push(Date.now() - filters.rangeDays * DAY_MS);
  }
  if (filters.currency !== undefined) {
    conditions.push("p.currency = ?");
    params.push(filters.currency);
  }
  return { sql: conditions.join(" AND "), params };
}

export function getSpendingSummary(db: ApiDb, filters: AnalyticsFilters = {}): SpendingSummary[] {
  const where = purchasesWhere(filters);
  const rows = db.sqlite
    .prepare(
      `SELECT p.currency AS currency,
              SUM(p.shelf_price_minor * p.quantity) AS total_minor,
              COUNT(DISTINCT date(p.purchased_at / 1000, 'unixepoch') || '@' || COALESCE(p.store_id, '-')) AS trip_count,
              COUNT(DISTINCT date(p.purchased_at / 1000, 'unixepoch')) AS shopping_days,
              SUM(p.quantity) AS item_count
       FROM purchases p
       WHERE ${where.sql}
       GROUP BY p.currency
       ORDER BY p.currency`, // deterministic order (Desktop leaves GROUP BY order unspecified)
    )
    .all(...where.params) as SummarySqlRow[];
  return rows.map((row) => ({
    currency: row.currency,
    totalMinor: Number(row.total_minor ?? 0),
    tripCount: Number(row.trip_count ?? 0),
    shoppingDays: Number(row.shopping_days ?? 0),
    itemCount: Number(row.item_count ?? 0),
    averageTripMinor:
      Number(row.trip_count ?? 0) === 0
        ? 0
        : Math.round(Number(row.total_minor ?? 0) / Number(row.trip_count)),
  }));
}

export function getSpendingSeries(
  db: ApiDb,
  granularity: Granularity,
  filters: AnalyticsFilters = {},
): SpendingPoint[] {
  const format = BUCKET_FORMATS[granularity];
  const where = purchasesWhere(filters);
  const rows = db.sqlite
    .prepare(
      `SELECT strftime('${format}', p.purchased_at / 1000, 'unixepoch') AS bucket,
              p.currency AS currency,
              SUM(p.shelf_price_minor * p.quantity) AS total_minor
       FROM purchases p
       WHERE ${where.sql}
       GROUP BY bucket, p.currency
       ORDER BY bucket, p.currency`, // secondary sort: deterministic within a bucket
    )
    .all(...where.params) as SeriesSqlRow[];
  return rows.map((row) => ({
    date: row.bucket,
    amountMinor: Number(row.total_minor ?? 0),
    currency: row.currency,
  }));
}

function namedAmounts(
  db: ApiDb,
  joinColumn: "p.store_id" | "pr.category_id",
  nameSource: string,
  filters: AnalyticsFilters,
): NamedAmount[] {
  const where = purchasesWhere(filters);
  const rows = db.sqlite
    .prepare(
      `SELECT ${joinColumn} AS id,
              ${nameSource} AS name,
              p.currency AS currency,
              SUM(p.shelf_price_minor * p.quantity) AS total_minor
       FROM purchases p
       JOIN products pr ON pr.id = p.product_id
       LEFT JOIN stores s ON s.id = p.store_id
       LEFT JOIN categories c ON c.id = pr.category_id
       WHERE ${where.sql}
       GROUP BY ${joinColumn}, p.currency
       ORDER BY total_minor DESC`,
    )
    .all(...where.params) as NamedSqlRow[];
  return rows.map((row) => ({
    id: row.id ?? "unassigned",
    name: row.name ?? (row.id === null ? "No store" : "Uncategorized"),
    amountMinor: Number(row.total_minor ?? 0),
    currency: row.currency,
  }));
}

export function getSpendingByStore(db: ApiDb, filters: AnalyticsFilters = {}): NamedAmount[] {
  return namedAmounts(db, "p.store_id", "s.name", filters);
}

export function getSpendingByCategory(db: ApiDb, filters: AnalyticsFilters = {}): NamedAmount[] {
  return namedAmounts(db, "pr.category_id", "c.name", filters);
}

export function getPriceWatch(db: ApiDb, filters: AnalyticsFilters = {}): PriceWatchRow[] {
  const conditions = ["pr.deleted_at IS NULL", "p.deleted_at IS NULL"];
  const params: unknown[] = [];
  if (filters.currency !== undefined) {
    conditions.push("p.currency = ?");
    params.push(filters.currency);
  }
  if (filters.rangeDays !== undefined) {
    conditions.push("p.captured_at >= ?");
    params.push(Date.now() - filters.rangeDays * DAY_MS);
  }
  const rows = db.sqlite
    .prepare(
      `SELECT product_id, product_name, currency, observation_count,
              latest_minor, previous_minor, average_minor, lowest_minor, highest_minor
       FROM (
         SELECT p.product_id AS product_id,
                pr.name AS product_name,
                p.currency AS currency,
                COUNT(*) OVER w AS observation_count,
                FIRST_VALUE(p.regular_price_minor) OVER w_desc AS latest_minor,
                LEAD(p.regular_price_minor) OVER w_desc AS previous_minor,
                AVG(p.regular_price_minor) OVER w AS average_minor,
                MIN(p.regular_price_minor) OVER w AS lowest_minor,
                MAX(p.regular_price_minor) OVER w AS highest_minor,
                ROW_NUMBER() OVER w_desc AS rn
         FROM prices p
         JOIN products pr ON pr.id = p.product_id
         WHERE ${conditions.join(" AND ")}
         WINDOW
           w AS (PARTITION BY p.product_id ORDER BY p.captured_at, p.id
                 ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING),
           w_desc AS (PARTITION BY p.product_id ORDER BY p.captured_at DESC, p.id DESC
                      ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)
       )
       WHERE rn = 1
       ORDER BY product_name`,
    )
    .all(...params) as PriceWatchSqlRow[];
  return rows.map((row) => ({
    productId: row.product_id,
    productName: row.product_name ?? row.product_id,
    currency: row.currency,
    observationCount: Number(row.observation_count),
    latestMinor: row.latest_minor === null ? null : Number(row.latest_minor),
    averageMinor: row.average_minor === null ? null : Math.round(Number(row.average_minor)),
    lowestMinor: row.lowest_minor === null ? null : Number(row.lowest_minor),
    highestMinor: row.highest_minor === null ? null : Number(row.highest_minor),
    trendPercent:
      row.latest_minor === null ||
      row.previous_minor === null ||
      Number(row.previous_minor) === 0
        ? null
        : Math.round(((Number(row.latest_minor) - Number(row.previous_minor)) / Number(row.previous_minor)) * 1000) / 10,
    latestAtLowest: row.latest_minor !== null && Number(row.latest_minor) === Number(row.lowest_minor),
    latestAtHighest: row.latest_minor !== null && Number(row.latest_minor) === Number(row.highest_minor),
  }));
}
