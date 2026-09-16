"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SpendingChart } from "@/components/spending-chart";
import { StatCard } from "@/components/stat-card";
import {
  resolveDataSource,
  type AnalyticsFilters,
  type DataSource,
} from "@/lib/data-source";
import { formatMoney } from "@/lib/money";

const RANGE_OPTIONS = [7, 30, 90, 365] as const;

/**
 * Dashboard reads every value through the shared DataSource (spec: analytics
 * render identically on web-API and desktop-SQLite; the placeholder source
 * produces the same empty states until a backend exists).
 */
export function DashboardView() {
  const [source, setSource] = useState<DataSource | null>(null);
  const [rangeDays, setRangeDays] = useState<number>(30);

  useEffect(() => {
    let alive = true;
    void resolveDataSource().then((resolved) => {
      if (alive) {
        setSource(resolved);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const filters: AnalyticsFilters = { rangeDays };
  const enabled = source !== null;
  const key = (name: string) => [name, source?.kind, rangeDays] as const;

  const summary = useQuery({
    queryKey: key("summary"),
    queryFn: () => source!.getSpendingSummary(filters),
    enabled,
  });
  const series = useQuery({
    queryKey: key("series"),
    queryFn: () => source!.getSpendingSeries("day", filters),
    enabled,
  });
  const byStore = useQuery({
    queryKey: key("by-store"),
    queryFn: () => source!.getSpendingByStore(filters),
    enabled,
  });
  const byCategory = useQuery({
    queryKey: key("by-category"),
    queryFn: () => source!.getSpendingByCategory(filters),
    enabled,
  });
  const priceWatch = useQuery({
    queryKey: key("price-watch"),
    queryFn: () => source!.getPriceWatch(filters),
    enabled,
  });

  const primary = summary.data?.[0] ?? null;
  const isEmpty = primary === null || (primary.totalMinor === 0 && primary.tripCount === 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Spending Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Overview of your grocery spending, trips, and detected savings.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="range" className="text-sm text-muted-foreground">
            Range
          </label>
          <select
            id="range"
            value={rangeDays}
            onChange={(event) => setRangeDays(Number(event.target.value))}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          >
            {RANGE_OPTIONS.map((days) => (
              <option key={days} value={days}>
                {days === 365 ? "1 year" : `${days} days`}
              </option>
            ))}
          </select>
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
            {source?.kind === "desktop-sqlite"
              ? "Local database"
              : source?.kind === "api"
                ? "Backend API"
                : "Not connected"}
          </span>
        </div>
      </div>

      {summary.isError ? (
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">
            Could not load analytics: {(summary.error as Error).message}
          </CardContent>
        </Card>
      ) : isEmpty && !summary.isLoading ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="font-medium">No purchases yet</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Analytics appear once your mobile captures synchronize through the
              shared backend (or after the desktop replica syncs). The app
              stays fully functional in this offline state.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total spent"
              value={summary.isLoading ? "…" : formatMoney({ amountMinor: primary?.totalMinor ?? 0, currency: primary?.currency ?? "PHP" })}
              hint={`Last ${rangeDays} days`}
            />
            <StatCard
              label="Shopping trips"
              value={summary.isLoading ? "…" : String(primary?.tripCount ?? 0)}
              hint={`${primary?.shoppingDays ?? 0} shopping days`}
            />
            <StatCard
              label="Items purchased"
              value={summary.isLoading ? "…" : String(primary?.itemCount ?? 0)}
              hint={`Last ${rangeDays} days`}
            />
            <StatCard
              label="Average trip"
              value={summary.isLoading ? "…" : formatMoney({ amountMinor: primary?.averageTripMinor ?? 0, currency: primary?.currency ?? "PHP" })}
              hint="Per store visit"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Spending over time</CardTitle>
            </CardHeader>
            <CardContent>
              <SpendingChart
                data={(series.data ?? []).map((point) => ({
                  day: point.date,
                  amountMinor: point.amountMinor,
                }))}
                currency={primary?.currency ?? "PHP"}
              />
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <AmountBreakdownCard
              title="Spending by store"
              data={byStore.data ?? []}
              loading={byStore.isLoading}
            />
            <AmountBreakdownCard
              title="Spending by category"
              data={byCategory.data ?? []}
              loading={byCategory.isLoading}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Price watch</CardTitle>
            </CardHeader>
            <CardContent>
              {priceWatch.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (priceWatch.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No price history yet.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 font-medium">Product</th>
                      <th className="py-2 font-medium">Latest</th>
                      <th className="py-2 font-medium">Average</th>
                      <th className="py-2 font-medium">Range</th>
                      <th className="py-2 font-medium">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(priceWatch.data ?? []).map((row) => (
                      <tr key={row.productId} className="border-b last:border-0">
                        <td className="py-2">{row.productName}</td>
                        <td className="py-2">
                          {row.latestMinor === null
                            ? "—"
                            : formatMoney({ amountMinor: row.latestMinor, currency: row.currency })}
                          {row.latestAtLowest ? (
                            <span className="ml-2 text-xs font-medium text-emerald-600">▼ at low</span>
                          ) : row.latestAtHighest ? (
                            <span className="ml-2 text-xs font-medium text-rose-600">▲ at high</span>
                          ) : null}
                        </td>
                        <td className="py-2 text-muted-foreground">
                          {row.averageMinor === null
                            ? "—"
                            : formatMoney({ amountMinor: row.averageMinor, currency: row.currency })}
                        </td>
                        <td className="py-2 text-muted-foreground">
                          {row.lowestMinor === null || row.highestMinor === null
                            ? "—"
                            : `${formatMoney({ amountMinor: row.lowestMinor, currency: row.currency })} – ${formatMoney({ amountMinor: row.highestMinor, currency: row.currency })}`}
                        </td>
                        <td className="py-2">
                          {row.trendPercent === null ? (
                            "—"
                          ) : (
                            <span className={row.trendPercent > 0 ? "text-rose-600" : "text-emerald-600"}>
                              {row.trendPercent > 0 ? "+" : ""}
                              {row.trendPercent}%
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function AmountBreakdownCard({
  title,
  data,
  loading,
}: {
  title: string;
  data: { id: string; name: string; amountMinor: number; currency: string }[];
  loading: boolean;
}) {
  const max = Math.max(...data.map((entry) => entry.amountMinor), 1);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data yet.</p>
        ) : (
          <ul className="space-y-2">
            {data.slice(0, 6).map((entry) => (
              <li key={entry.id}>
                <div className="flex items-center justify-between text-sm">
                  <span>{entry.name}</span>
                  <span className="font-medium">
                    {formatMoney({ amountMinor: entry.amountMinor, currency: entry.currency })}
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-muted">
                  <div
                    className="h-1.5 rounded-full bg-primary"
                    style={{ width: `${Math.max((entry.amountMinor / max) * 100, 2)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
