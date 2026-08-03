import type { Money } from "./money";

/**
 * Analytics read data through a single shared interface so the same dashboard
 * components work on both targets:
 *
 * - `WebApiDataSource` reads from the backend API (online web build)
 * - `DesktopSqliteDataSource` reads from the optional local SQLite replica
 *
 * Platform-specific implementations live behind this interface rather than
 * being scattered across components (see tech.desktop.md, "Desktop Wrapper").
 */

export interface SpendingSummary {
  total: Money;
  tripCount: number;
  averageTrip: Money;
  itemCount: number;
}

export interface SpendingPoint {
  date: string;
  amountMinor: number;
  currency: string;
}

export interface DataSource {
  getSpendingSummary(): Promise<SpendingSummary>;
  getSpendingSeries(rangeDays: number): Promise<SpendingPoint[]>;
}

/**
 * Placeholder data source returning empty results. Replaced by the web and
 * desktop implementations once the backend API client and SQLite replica land.
 */
export class PlaceholderDataSource implements DataSource {
  async getSpendingSummary(): Promise<SpendingSummary> {
    return {
      total: { amountMinor: 0, currency: "USD" },
      tripCount: 0,
      averageTrip: { amountMinor: 0, currency: "USD" },
      itemCount: 0,
    };
  }

  async getSpendingSeries(): Promise<SpendingPoint[]> {
    return [];
  }
}
