import { isTauriRuntime, type NamedAmount, type PriceWatchRow, type SpendingPoint } from "@/lib/data-source";

/**
 * CSV serialization + file export (tech.desktop.md, "Reporting & Export" and
 * "Desktop Wrapper").
 *
 * The spec allows "a small shared export utility with proper escaping" instead
 * of a serializer dependency, so this module hand-rolls RFC-4180-style CSV and
 * adds the required spreadsheet-formula-injection defense: any cell whose
 * value starts with `=`, `+`, `-`, or `@` is prefixed with a single quote.
 *
 * Platform-specific file handling lives behind the `FileExporter` interface
 * (`BrowserDownloadExporter` for web downloads, `TauriFilesystemExporter` for
 * the native save dialog + plugin-fs write); selection happens in
 * `resolveExporter`, never in components. Tauri modules are loaded through
 * dynamic imports only, so the web build never executes them.
 */

export interface SerializeCsvOptions {
  /** Explicit column order. Defaults to the first row's key order. */
  headers?: string[];
}

/** Rows use CRLF line endings (RFC 4180; also what spreadsheet apps expect). */
const ROW_SEPARATOR = "\r\n";
const FORMULA_PREFIXES = new Set(["=", "+", "-", "@"]);

function cellToString(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

/** Serializes one cell: quoting, quote doubling, and formula-injection defense. */
function serializeCell(rawValue: unknown): string {
  const value = cellToString(rawValue);
  const needsEscape = FORMULA_PREFIXES.has(value.charAt(0));
  const guarded = needsEscape ? `'${value}` : value;
  if (/[",\r\n]/.test(guarded)) {
    return `"${guarded.replace(/"/g, '""')}"`;
  }
  return guarded;
}

/**
 * Renders rows as CSV. Column order is deterministic: the explicit
 * `options.headers` when given, otherwise the key order of the first row.
 * Later rows missing a column serialize as empty cells.
 */
export function serializeCsv(rows: Record<string, unknown>[], options?: SerializeCsvOptions): string {
  const headers =
    options?.headers ??
    (rows.length > 0 ? Object.keys(rows[0]) : []);
  const lines = [headers.map(serializeCell).join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => serializeCell(row[header])).join(","));
  }
  return lines.join(ROW_SEPARATOR);
}

/** Integer minor units -> decimal string (12345 -> "123.45", -5 -> "-0.05"). */
export function minorToDecimal(minor: number): string {
  const safe = Number.isFinite(minor) ? Math.round(minor) : 0;
  const sign = safe < 0 ? "-" : "";
  const absolute = Math.abs(safe);
  return `${sign}${Math.trunc(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}

/** A ready-to-serialize export bundle produced by the dataset helpers. */
export interface CsvDataset {
  filename: string;
  headers: string[];
  rows: Record<string, unknown>[];
}

function dataset(
  filename: string,
  headers: string[],
  rows: Record<string, unknown>[],
): CsvDataset {
  return { filename, headers, rows };
}

/** Spending over time (one row per date bucket per currency). */
export function toSpendingSeriesDataset(points: SpendingPoint[]): CsvDataset {
  return dataset("spending-series.csv", ["date", "currency", "amount"], points.map((point) => ({
    date: point.date,
    currency: point.currency,
    amount: minorToDecimal(point.amountMinor),
  })));
}

/** Spending grouped by store. */
export function toSpendingByStoreDataset(namedAmounts: NamedAmount[]): CsvDataset {
  return dataset("spending-by-store.csv", ["store_id", "store", "currency", "amount"], namedAmounts.map((entry) => ({
    store_id: entry.id,
    store: entry.name,
    currency: entry.currency,
    amount: minorToDecimal(entry.amountMinor),
  })));
}

/** Spending grouped by product category. */
export function toSpendingByCategoryDataset(namedAmounts: NamedAmount[]): CsvDataset {
  return dataset("spending-by-category.csv", ["category_id", "category", "currency", "amount"], namedAmounts.map((entry) => ({
    category_id: entry.id,
    category: entry.name,
    currency: entry.currency,
    amount: minorToDecimal(entry.amountMinor),
  })));
}

/** Per-product price watch statistics. */
export function toPriceWatchDataset(rows: PriceWatchRow[]): CsvDataset {
  return dataset("price-watch.csv", [
    "product_id",
    "product",
    "currency",
    "observations",
    "latest",
    "average",
    "lowest",
    "highest",
    "trend_percent",
    "latest_at_lowest",
    "latest_at_highest",
  ], rows.map((row) => ({
    product_id: row.productId,
    product: row.productName,
    currency: row.currency,
    observations: row.observationCount,
    latest: row.latestMinor === null ? "" : minorToDecimal(row.latestMinor),
    average: row.averageMinor === null ? "" : minorToDecimal(row.averageMinor),
    lowest: row.lowestMinor === null ? "" : minorToDecimal(row.lowestMinor),
    highest: row.highestMinor === null ? "" : minorToDecimal(row.highestMinor),
    trend_percent: row.trendPercent === null ? "" : String(row.trendPercent),
    latest_at_lowest: row.latestAtLowest ? "true" : "false",
    latest_at_highest: row.latestAtHighest ? "true" : "false",
  })));
}

// ---------------------------------------------------------------------------
// FileExporter (spec: BrowserDownloadExporter / TauriFilesystemExporter)
// ---------------------------------------------------------------------------

export interface FileExporter {
  readonly kind: "browser-download" | "tauri-filesystem";
  /** Writes `contents` to the given filename, asking the user where via the
   * platform mechanism (browser download or native save dialog). */
  exportText(filename: string, contents: string): Promise<void>;
}

/** Web target: normal browser download via Blob + object URL (spec). */
export class BrowserDownloadExporter implements FileExporter {
  readonly kind = "browser-download" as const;

  async exportText(filename: string, contents: string): Promise<void> {
    const blob = new Blob([contents], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    try {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } finally {
      // Revoke after the click has been processed so the download still starts.
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    }
  }
}

/**
 * Desktop target: native save dialog (plugin-dialog) + text write
 * (plugin-fs), restricted to the path the user picked. Both plugins are
 * dynamically imported so the web bundle never loads Tauri modules.
 */
export class TauriFilesystemExporter implements FileExporter {
  readonly kind = "tauri-filesystem" as const;

  async exportText(filename: string, contents: string): Promise<void> {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const path = await save({
      defaultPath: filename,
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });
    if (path === null) {
      return; // User cancelled the dialog.
    }
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    await writeTextFile(path, contents);
  }
}

/** Platform selection, mirroring `resolveDataSource` in data-source.ts. */
export function resolveExporter(): FileExporter {
  return isTauriRuntime() ? new TauriFilesystemExporter() : new BrowserDownloadExporter();
}
