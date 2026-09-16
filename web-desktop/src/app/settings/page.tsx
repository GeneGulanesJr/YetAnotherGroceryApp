"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DesktopSqliteDataSource,
  getApiBaseUrl,
  isTauriRuntime,
  type SqlExecutor,
} from "@/lib/data-source";
import { pullOnce, type PullResult } from "@/sync/engine";
import { createFetchTransport } from "@/sync/transport";

/**
 * Settings shell (desktop wrapper spec). The synchronization panel drives the
 * desktop SQLite replica's pull engine through the shared fetch transport;
 * the replica itself only exists inside the Tauri runtime, so the web build
 * reports why a local sync is unavailable instead of failing.
 */

async function pullIntoReplica(): Promise<PullResult> {
  const transport = createFetchTransport();
  if (transport === null) {
    return { status: "unconfigured", pulled: 0, conflicts: 0 };
  }
  if (!isTauriRuntime()) {
    return {
      status: "error",
      pulled: 0,
      conflicts: 0,
      error:
        "the offline replica lives inside the desktop app — run the Tauri build to sync locally",
    };
  }
  const { default: Database } = await import("@tauri-apps/plugin-sql");
  const db = await Database.load("sqlite:yaga.db");
  const executor: SqlExecutor = {
    select: (sql, params) => db.select(sql, params),
    exec: (sql) => db.execute(sql).then(() => undefined),
  };
  // Ensure the replica schema (sync tables included) exists before pulling.
  await new DesktopSqliteDataSource(executor).initialize();
  return pullOnce(executor, transport);
}

function resultText(result: PullResult): string {
  switch (result.status) {
    case "unconfigured":
      return "No backend configured — set NEXT_PUBLIC_API_BASE_URL to enable synchronization.";
    case "ok":
      return `Pulled ${result.pulled} ${result.pulled === 1 ? "record" : "records"}; ${
        result.conflicts
      } field ${result.conflicts === 1 ? "conflict" : "conflicts"} audited.`;
    case "error":
      return `Sync failed: ${result.error ?? "unknown error"}`;
  }
}

export default function SettingsPage() {
  const baseUrl = getApiBaseUrl();
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<PullResult | null>(null);

  async function handleSyncNow(): Promise<void> {
    setSyncing(true);
    try {
      setResult(await pullIntoReplica());
    } catch (cause) {
      setResult({
        status: "error",
        pulled: 0,
        conflicts: 0,
        error: cause instanceof Error ? cause.message : "sync failed",
      });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Account, synchronization, currency, timezone, and data-management preferences.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Synchronization</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Backend:{" "}
            {baseUrl === null ? (
              <span>not configured</span>
            ) : (
              <span className="text-foreground">{baseUrl}</span>
            )}
          </p>
          <p>
            The desktop app keeps a local SQLite replica in sync through delta
            pulls with field-level last-write-wins conflict resolution; the web
            build reads backend data directly.
          </p>
          <div className="flex items-center gap-3">
            <Button onClick={handleSyncNow} disabled={syncing || baseUrl === null}>
              {syncing ? "Syncing…" : "Sync now"}
            </Button>
            {result !== null && (
              <p
                role="status"
                aria-live="polite"
                className={result.status === "error" ? "text-destructive" : undefined}
              >
                {resultText(result)}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>Account, offline-replica toggle, currency/timezone, backup &amp; restore land here.</p>
        </CardContent>
      </Card>
    </div>
  );
}
