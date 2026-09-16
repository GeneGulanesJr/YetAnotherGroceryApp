/**
 * Auth placeholder (spec: the backend owns authentication/authorization).
 *
 * Sync routes require an `X-Device-Id` header identifying the syncing device;
 * the body's `deviceId` must match it. There are no secrets and no real
 * claims yet — see the TODO below for where Clerk JWT verification lands.
 */

export const DEVICE_ID_HEADER = "x-device-id";

declare module "fastify" {
  interface FastifyRequest {
    /** Set by requireDeviceId once the header is validated. */
    deviceId: string;
  }
}

interface DeviceHeaders {
  [header: string]: unknown;
}

/** Extracts and validates the device identity, or returns an error message. */
export function checkDeviceId(headers: DeviceHeaders): string | null {
  const raw = headers[DEVICE_ID_HEADER];
  if (typeof raw !== "string" || raw.trim() === "") {
    return null;
  }
  return raw.trim();
}

export const AUTH_TODO = `
TODO(auth): Clerk JWT verification (tech.mobile.md / tech.desktop.md).
Sync and analytics routes currently trust the X-Device-Id header only.
When Clerk is wired up:
  1. Verify the bearer JWT (Clerk JWKS) in a fastify preHandler hook.
  2. Bind the JWT subject to the device id (device registration table) and
     reject devices that do not belong to the authenticated user.
  3. Scope all queries (sync + analytics) by the authenticated user id.
No secret material lives in this repository.
`.trim();
