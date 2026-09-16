import Constants from "expo-constants";

import type { SyncTransport } from "./engine";
import type {
  PullDeltaResponse,
  PushBatchRequest,
  PushBatchResponse,
} from "./protocol";

/**
 * HTTP transport for the sync protocol. The backend base URL comes from
 * app.json `extra.apiBaseUrl` (EAS env overrides possible later); while it
 * is unset the app stays fully offline-first and sync reports
 * "unconfigured" instead of failing.
 */

export function getApiBaseUrl(): string | null {
  const url = (Constants.expoConfig?.extra as { apiBaseUrl?: string | null } | undefined)
    ?.apiBaseUrl;
  return typeof url === "string" && url !== "" ? url.replace(/\/$/, "") : null;
}

/** Bearer token once Clerk auth lands; kept in sync_meta by the auth layer. */
let authToken: string | null = null;
export function setSyncAuthToken(token: string | null): void {
  authToken = token;
}

export function createTransport(): SyncTransport | null {
  const baseUrl = getApiBaseUrl();
  if (baseUrl === null) {
    return null;
  }
  const headers = (): Record<string, string> => ({
    "Content-Type": "application/json",
    ...(authToken === null ? {} : { Authorization: `Bearer ${authToken}` }),
  });

  return {
    async pushBatch(request: PushBatchRequest): Promise<PushBatchResponse> {
      const response = await fetch(`${baseUrl}/sync/push`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(request),
      });
      if (!response.ok) {
        throw new Error(`push failed: HTTP ${response.status}`);
      }
      return (await response.json()) as PushBatchResponse;
    },

    async pullDelta(cursor: string | null): Promise<PullDeltaResponse> {
      const query = cursor === null ? "" : `?cursor=${encodeURIComponent(cursor)}`;
      const response = await fetch(`${baseUrl}/sync/pull${query}`, {
        method: "GET",
        headers: headers(),
      });
      if (!response.ok) {
        throw new Error(`pull failed: HTTP ${response.status}`);
      }
      return (await response.json()) as PullDeltaResponse;
    },
  };
}
