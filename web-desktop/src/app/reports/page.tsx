"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileExportButton } from "@/components/file-export-button";
import {
  resolveDataSource,
  type AnalyticsFilters,
  type DataSource,
} from "@/lib/data-source";
import {
  toPriceWatchDataset,
  toSpendingByCategoryDataset,
  toSpendingByStoreDataset,
  toSpendingSeriesDataset,
  type CsvDataset,
} from "@/lib/export";

const RANGE_OPTIONS = [7, 30, 90, 365] as const;

type DatasetId = "spending-series" | "spending-by-store" | "spending-by-category" | "price-watch";

const DATASETS: { id: DatasetId; label: string; description: string }[] = [
  {
    id: "spending-series",
    label: "Spending over time",
    description: "One row per date bucket with the total amount spent.",
  },
  {
    id: "spending-by-store",
    label: "Spending by store",
    description: "Totals grouped by store, highest spend first.",
  },
  {
    id: "spending-by-category",
    label: "Spending by category",
    description: "Totals grouped by product category, highest spend first.",
  },
  {
    id: "price-watch",
    label: "Price watch",
    description: "Per-product latest, average, and lowest/highest observed prices.",
  },
];

/** Pulls the chosen dataset through the shared DataSource (spec: platform
 * selection stays inside resolveDataSource; this page never branches). */
async function fetchDataset(
  source: DataSource,
  id: DatasetId,
  filters: AnalyticsFilters,
): Promise<CsvDataset> {
  switch (id) {
    case "spending-series":
      return toSpendingSeriesDataset(await source.getSpendingSeries("day", filters));
    case "spending-by-store":
      return toSpendingByStoreDataset(await source.getSpendingByStore(filters));
    case "spending-by-category":
      return toSpendingByCategoryDataset(await source.getSpendingByCategory(filters));
    case "price-watch":
      return toPriceWatchDataset(await source.getPriceWatch(filters));
  }
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  return String(value);
}

/**
 * Reports surface (tech.desktop.md "Reporting & Export"): CSV exports of the
 * analytics datasets. Data always flows through the shared DataSource, and
 * file handling through the shared FileExporter, so the page works
 * identically on the web build and inside the Tauri desktop shell.
 */
export default function ReportsPage() {
  const [source, setSource] = useState<DataSource | null>(null);
  const [datasetId, setDatasetId] = useState<DatasetId>("spending-series");
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

  const report = useQuery({
    queryKey: ["report", datasetId, source?.kind, rangeDays],
    queryFn: () => fetchDataset(source!, datasetId, filters),
    enabled,
  });

  const dataset = DATASETS.find((entry) => entry.id === datasetId) ?? DATASETS[0];
  const rows = report.data?.rows ?? [];
  const headers = report.data?.headers ?? [];
  const previewRows = rows.slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Reports &amp; Export</h2>
          <p className="text-sm text-muted-foreground">
            Spending history, price history, and raw-data CSV exports.
          </p>
        </div>
        <FileExportButton
          filename={report.data?.filename ?? `${datasetId}.csv`}
          getData={async () => {
            const freshSource = await resolveDataSource();
            return (await fetchDataset(freshSource, datasetId, filters)).rows;
          }}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Available reports</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="dataset" className="text-sm text-muted-foreground">
                Dataset
              </label>
              <select
                id="dataset"
                value={datasetId}
                onChange={(event) => setDatasetId(event.target.value as DatasetId)}
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              >
                {DATASETS.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </select>
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
            </div>
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
              {source?.kind === "desktop-sqlite"
                ? "Local database"
                : source?.kind === "api"
                  ? "Backend API"
                  : "Not connected"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {dataset.description} Exports cover the last {rangeDays} days; money
            columns are decimal amounts derived from integer minor units, and
            cells starting with =, +, -, or @ are escaped against spreadsheet
            formula injection.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preview — {dataset.label}</CardTitle>
        </CardHeader>
        <CardContent>
          {report.isError ? (
            <p className="text-sm text-destructive">
              Could not load report: {(report.error as Error).message}
            </p>
          ) : report.isLoading || !report.isSuccess ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No data for this report in the selected range yet. Analytics
              appear once purchases synchronize through the shared backend.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    {headers.map((header) => (
                      <th key={header} className="py-2 font-medium">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, index) => (
                    <tr key={index} className="border-b last:border-0">
                      {headers.map((header) => (
                        <td key={header} className="py-2 pr-4">
                          {formatCell(row[header])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > previewRows.length ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Showing {previewRows.length} of {rows.length} rows — export for the full dataset.
                </p>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
