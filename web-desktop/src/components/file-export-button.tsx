"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { resolveExporter, serializeCsv } from "@/lib/export";

export interface FileExportButtonProps {
  /** Suggested download/save filename, e.g. "spending-by-store.csv". */
  filename: string;
  /** Fetches the rows to export at click time (fresh data, not cached UI state). */
  getData: () => Promise<Record<string, unknown>[]>;
  label?: string;
}

type ExportState = "idle" | "working" | "error";

/**
 * Shared export trigger used by report surfaces. Serializes the fetched rows
 * to CSV and hands the result to the platform FileExporter (browser download
 * on web, native save dialog + plugin-fs inside Tauri) — spec: platform
 * behavior stays behind the shared interface, never in the component.
 */
export function FileExportButton({ filename, getData, label = "Export CSV" }: FileExportButtonProps) {
  const [state, setState] = useState<ExportState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleClick(): Promise<void> {
    setState("working");
    setErrorMessage(null);
    try {
      const rows = await getData();
      const csv = serializeCsv(rows);
      await resolveExporter().exportText(filename, csv);
      setState("idle");
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : "Export failed.");
      setState("error");
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" onClick={() => void handleClick()} disabled={state === "working"}>
        {state === "working" ? "Exporting…" : label}
      </Button>
      {state === "error" && errorMessage !== null ? (
        <p role="alert" className="max-w-xs text-right text-xs text-destructive">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
