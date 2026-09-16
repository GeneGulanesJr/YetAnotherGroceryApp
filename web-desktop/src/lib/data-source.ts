import { migrations } from "@/db/migrations";

/**
 * Analytics read data through a single shared interface so the same dashboard
 * components work on both targets (tech.desktop.md, "Desktop Wrapper"):
 *
 * - `ApiDataSource` reads from the backend API (online web build, or desktop
 *   with the local replica disabled)
 * - `DesktopSqliteDataSource` reads from the local SQLite replica through
 *   Tauri's SQL plugin (aggregations computed in SQL per the spec)
 * - `PlaceholderDataSource` returns empty results while no backend exists,
 *   so the UI always renders real empty/loading states
 *
 * Platform selection lives in `resolveDataSource`, never in components.
 * Money is integer minor units; currencies are never mixed — every result
 * row carries its currency.
 */

export interface AnalyticsFilters {
  /** Rolling window in days; undefined = all time. */
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
  /** latest vs previous observation, percent; null when < 2 points. */
  trendPercent: number | null;
  latestAtLowest: boolean;
  latestAtHighest: boolean;
}

export interface DataSource {
  readonly kind: "placeholder" | "api" | "desktop-sqlite";
  getSpendingSummary(filters?: AnalyticsFilters): Promise<SpendingSummary[]>;
  getSpendingSeries(granularity: "day" | "week" | "month", filters?: AnalyticsFilters): Promise<SpendingPoint[]>;
  getSpendingByStore(filters?: AnalyticsFilters): Promise<NamedAmount[]>;
  getSpendingByCategory(filters?: AnalyticsFilters): Promise<NamedAmount[]>;
  getPriceWatch(filters?: AnalyticsFilters): Promise<PriceWatchRow[]>;
}

/** Empty results — the pre-backend state. */
export class PlaceholderDataSource implements DataSource {
  readonly kind = "placeholder" as const;

  async getSpendingSummary(_filters?: AnalyticsFilters): Promise<SpendingSummary[]> {
    return [];
  }
  async getSpendingSeries(
    _granularity: "day" | "week" | "month",
    _filters?: AnalyticsFilters,
  ): Promise<SpendingPoint[]> {
    return [];
  }
  async getSpendingByStore(_filters?: AnalyticsFilters): Promise<NamedAmount[]> {
    return [];
  }
  async getSpendingByCategory(_filters?: AnalyticsFilters): Promise<NamedAmount[]> {
    return [];
  }
  async getPriceWatch(_filters?: AnalyticsFilters): Promise<PriceWatchRow[]> {
    return [];
  }
}

// ---------------------------------------------------------------------------
// API implementation (backend contract; dormant until a base URL is set)
// ---------------------------------------------------------------------------

export function getApiBaseUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_API_BASE_URL;
  return typeof url === "string" && url !== "" ? url.replace(/\/$/, "") : null;
}

export class ApiDataSource implements DataSource {
  readonly kind = "api" as const;

  constructor(private readonly baseUrl: string) {}

  private async getJson<T>(path: string, filters: AnalyticsFilters = {}): Promise<T> {
    const params = new URLSearchParams();
    if (filters.rangeDays !== undefined) {
      params.set("rangeDays", String(filters.rangeDays));
    }
    if (filters.currency !== undefined) {
      params.set("currency", filters.currency);
    }
    const query = params.size > 0 ? `?${params.toString()}` : "";
    const response = await fetch(`${this.baseUrl}${path}${query}`);
    if (!response.ok) {
      throw new Error(`API ${path} failed: HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  }

  async getSpendingSummary(filters?: AnalyticsFilters): Promise<SpendingSummary[]> {
    return this.getJson<SpendingSummary[]>("/analytics/spending-summary", filters);
  }
  async getSpendingSeries(
    granularity: "day" | "week" | "month",
    filters?: AnalyticsFilters,
  ): Promise<SpendingPoint[]> {
    return this.getJson<SpendingPoint[]>(
      `/analytics/spending-series?granularity=${granularity}`,
      filters,
    );
  }
  async getSpendingByStore(filters?: AnalyticsFilters): Promise<NamedAmount[]> {
    return this.getJson<NamedAmount[]>("/analytics/spending-by-store", filters);
  }
  async getSpendingByCategory(filters?: AnalyticsFilters): Promise<NamedAmount[]> {
    return this.getJson<NamedAmount[]>("/analytics/spending-by-category", filters);
  }
  async getPriceWatch(filters?: AnalyticsFilters): Promise<PriceWatchRow[]> {
    return this.getJson<PriceWatchRow[]>("/analytics/price-watch", filters);
  }
}

// ---------------------------------------------------------------------------
// Desktop SQLite implementation (Tauri plugin-sql; executor-injected so the
// exact SQL runs against better-sqlite3 in tests)
// ---------------------------------------------------------------------------

export interface SqlExecutor {
  select<T>(sql: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
}

interface SummarySqlRow {
  currency: string;
  total_minor: number;
  trip_count: number;
  shopping_days: number;
  item_count: number;
}

interface SeriesSqlRow {
  bucket: string;
  currency: string;
  total_minor: number;
}

interface NamedSqlRow {
  id: string | null;
  name: string | null;
  currency: string;
  total_minor: number;
}

interface PriceWatchSqlRow {
  product_id: string;
  product_name: string | null;
  currency: string;
  observation_count: number;
  latest_minor: number | null;
  average_minor: number | null;
  lowest_minor: number | null;
  highest_minor: number | null;
  previous_minor: number | null;
}

const DAY_MS = 86_400_000;

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

export class DesktopSqliteDataSource implements DataSource {
  readonly kind = "desktop-sqlite" as const;

  constructor(private readonly executor: SqlExecutor) {}

  /** Applies the shared embedded migrations (same SQL as mobile) exactly once. */
  async initialize(): Promise<void> {
    const rows = await this.executor.select<{ user_version: number }>("PRAGMA user_version");
    const current = rows[0]?.user_version ?? 0;
    for (let index = current; index < migrations.length; index++) {
      for (const statement of migrations[index].statements) {
        await this.executor.exec(statement);
      }
      await this.executor.exec(`PRAGMA user_version = ${index + 1}`);
    }
  }

  async getSpendingSummary(filters: AnalyticsFilters = {}): Promise<SpendingSummary[]> {
    const where = purchasesWhere(filters);
    const rows = await this.executor.select<SummarySqlRow>(
      `SELECT p.currency AS currency,
              SUM(p.shelf_price_minor * p.quantity) AS total_minor,
              COUNT(DISTINCT date(p.purchased_at / 1000, 'unixepoch') || '@' || COALESCE(p.store_id, '-')) AS trip_count,
              COUNT(DISTINCT date(p.purchased_at / 1000, 'unixepoch')) AS shopping_days,
              SUM(p.quantity) AS item_count
       FROM purchases p
       WHERE ${where.sql}
       GROUP BY p.currency`,
      where.params,
    );
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

  async getSpendingSeries(
    granularity: "day" | "week" | "month",
    filters: AnalyticsFilters = {},
  ): Promise<SpendingPoint[]> {
    const format =
      granularity === "month" ? "%Y-%m-01" : granularity === "week" ? "%Y-%W" : "%Y-%m-%d";
    const where = purchasesWhere(filters);
    const rows = await this.executor.select<SeriesSqlRow>(
      `SELECT strftime('${format}', p.purchased_at / 1000, 'unixepoch') AS bucket,
              p.currency AS currency,
              SUM(p.shelf_price_minor * p.quantity) AS total_minor
       FROM purchases p
       WHERE ${where.sql}
       GROUP BY bucket, p.currency
       ORDER BY bucket`,
      where.params,
    );
    return rows.map((row) => ({
      date: row.bucket,
      amountMinor: Number(row.total_minor ?? 0),
      currency: row.currency,
    }));
  }

  private async namedAmounts(
    joinColumn: "p.store_id" | "pr.category_id",
    nameSource: string,
    filters: AnalyticsFilters,
  ): Promise<NamedAmount[]> {
    const where = purchasesWhere(filters);
    const rows = await this.executor.select<NamedSqlRow>(
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
      where.params,
    );
    return rows.map((row) => ({
      id: row.id ?? "unassigned",
      name: row.name ?? (row.id === null ? "No store" : "Uncategorized"),
      amountMinor: Number(row.total_minor ?? 0),
      currency: row.currency,
    }));
  }

  async getSpendingByStore(filters: AnalyticsFilters = {}): Promise<NamedAmount[]> {
    return this.namedAmounts("p.store_id", "s.name", filters);
  }

  async getSpendingByCategory(filters: AnalyticsFilters = {}): Promise<NamedAmount[]> {
    return this.namedAmounts("pr.category_id", "c.name", filters);
  }

  async getPriceWatch(filters: AnalyticsFilters = {}): Promise<PriceWatchRow[]> {
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
    const rows = await this.executor.select<PriceWatchSqlRow>(
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
      params,
    );
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
        row.latest_minor === null || row.previous_minor === null || Number(row.previous_minor) === 0
          ? null
          : Math.round(((Number(row.latest_minor) - Number(row.previous_minor)) / Number(row.previous_minor)) * 1000) / 10,
      latestAtLowest: row.latest_minor !== null && Number(row.latest_minor) === Number(row.lowest_minor),
      latestAtHighest: row.latest_minor !== null && Number(row.latest_minor) === Number(row.highest_minor),
    }));
  }
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

let desktopSourcePromise: Promise<DataSource | null> | null = null;

/** Desktop path: dynamically loads the Tauri SQL plugin and prepares the replica. */
async function loadDesktopSource(): Promise<DataSource | null> {
  try {
    const { default: Database } = await import("@tauri-apps/plugin-sql");
    const db = await Database.load("sqlite:yaga.db");
    const source = new DesktopSqliteDataSource({
      select: (sql, params) => db.select(sql, params),
      exec: (sql) => db.execute(sql).then(() => undefined),
    });
    await source.initialize();
    return source;
  } catch (cause) {
    console.error("Desktop SQLite replica unavailable:", cause);
    return null;
  }
}

/**
 * Platform selection (spec: platform-specific behavior lives behind shared
 * interfaces). Tauri → local SQLite replica; API base URL configured →
 * backend; otherwise placeholder empty states.
 */
export async function resolveDataSource(): Promise<DataSource> {
  if (isTauriRuntime()) {
    desktopSourcePromise ??= loadDesktopSource();
    const source = await desktopSourcePromise;
    if (source !== null) {
      return source;
    }
  }
  const baseUrl = getApiBaseUrl();
  if (baseUrl !== null) {
    return new ApiDataSource(baseUrl);
  }
  return new PlaceholderDataSource();
}
