/**
 * Bridge between Clerk's React session and the non-React API clients
 * (`ApiDataSource`, sync transport). `ApiAuthBridge` registers Clerk's
 * `getToken` on mount; the fetch clients call `getApiAuthToken()` so every
 * backend request carries the signed-in user's JWT.
 */

type TokenGetter = () => Promise<string | null>;

let tokenGetter: TokenGetter | null = null;

export function setApiTokenGetter(getter: TokenGetter | null): void {
  tokenGetter = getter;
}

/** Signed-in user's Clerk session JWT, or null when signed out/unavailable. */
export async function getApiAuthToken(): Promise<string | null> {
  if (tokenGetter === null) {
    return null;
  }
  try {
    return await tokenGetter();
  } catch {
    return null;
  }
}
