import { getApiBaseUrl } from "@/lib/data-source";

import type { SyncTransport } from "./engine";
import type { PullDeltaResponse } from "./protocol";

/**
 * HTTP transport for the sync pull protocol. The backend base URL comes from
 * `NEXT_PUBLIC_API_BASE_URL` via the shared `getApiBaseUrl()` in
 * `lib/data-source.ts` (one source of truth with the analytics API client —
 * no duplicated environment parsing). While it is unset the app stays fully
 * offline-first and sync reports "unconfigured" instead of failing.
 *
 * TODO(sync-push): add `pushBatch` (POST `/sync/push`) together with the
 * engine's push path once the desktop replica has mutation producers.
 */
export function createFetchTransport(): SyncTransport | null {
  const baseUrl = getApiBaseUrl();
  if (baseUrl === null) {
    return null;
  }

  return {
    async pullDelta(cursor: string | null): Promise<PullDeltaResponse> {
      const query = cursor === null ? "" : `?cursor=${encodeURIComponent(cursor)}`;
      const response = await fetch(`${baseUrl}/sync/pull${query}`, { method: "GET" });
      if (!response.ok) {
        throw new Error(`pull failed: HTTP ${response.status}`);
      }
      return (await response.json()) as PullDeltaResponse;
    },
  };
}
