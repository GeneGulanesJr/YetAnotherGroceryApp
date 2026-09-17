/**
 * Auth (spec: the backend owns authentication/authorization).
 *
 * Two layers:
 * 1. Device identity — sync routes require an `X-Device-Id` header
 *    identifying the syncing device; push bodies must echo it.
 * 2. Clerk JWT — when CLERK_SECRET_KEY is configured, protected routes also
 *    require a valid `Authorization: Bearer <jwt>` issued by that Clerk
 *    instance; the verified subject lands on `request.userId`.
 *
 * Without a secret key (local dev, tests) the server runs in
 * device-identity-only mode, matching the pre-Clerk wire contract.
 */

import { verifyToken } from "@clerk/backend";
import type { FastifyReply, FastifyRequest } from "fastify";

export const DEVICE_ID_HEADER = "x-device-id";

declare module "fastify" {
  interface FastifyRequest {
    /** Set by the auth preHandler once the device header is validated. */
    deviceId: string;
    /** Clerk JWT subject; only set when Clerk auth is enabled and passes. */
    userId?: string;
  }
}

interface DeviceHeaders {
  [header: string]: unknown;
}

/** Extracts and validates the device identity, or returns null. */
export function checkDeviceId(headers: DeviceHeaders): string | null {
  const raw = headers[DEVICE_ID_HEADER];
  if (typeof raw !== "string" || raw.trim() === "") {
    return null;
  }
  return raw.trim();
}

export type TokenVerifier = (token: string) => Promise<{ sub: string }>;

export interface AuthOptions {
  /** Clerk secret key (sk_test_/sk_live_); empty or unset disables JWT auth. */
  secretKey?: string;
  /** Overridable for tests; defaults to verification against Clerk's JWKS. */
  verify?: TokenVerifier;
}

const clerkVerifier =
  (secretKey: string): TokenVerifier =>
  async (token) => {
    const payload = await verifyToken(token, { secretKey });
    return { sub: payload.sub };
  };

interface ResolvedAuth {
  verify: TokenVerifier;
  enabled: boolean;
}

function resolveAuth(options: AuthOptions): ResolvedAuth {
  return {
    verify: options.verify ?? clerkVerifier(options.secretKey ?? ""),
    enabled: Boolean(options.secretKey),
  };
}

/** Verifies the bearer token when enabled; replies 401 and returns false on failure. */
async function verifyJwt(
  request: FastifyRequest,
  reply: FastifyReply,
  auth: ResolvedAuth,
): Promise<boolean> {
  if (!auth.enabled) {
    return true;
  }
  const header = request.headers.authorization;
  if (typeof header !== "string" || !header.startsWith("Bearer ")) {
    void reply.code(401).send({ error: "missing bearer token" });
    return false;
  }
  try {
    const { sub } = await auth.verify(header.slice("Bearer ".length).trim());
    if (!sub) {
      throw new Error("token has no subject");
    }
    request.userId = sub;
    return true;
  } catch {
    void reply.code(401).send({ error: "invalid bearer token" });
    return false;
  }
}

/**
 * Sync-route auth: device header required, plus the Clerk bearer token when
 * the server is configured with a secret key.
 */
export function createAuthPreHandler(options: AuthOptions = {}) {
  const auth = resolveAuth(options);

  return async function authPreHandler(request: FastifyRequest, reply: FastifyReply) {
    const deviceId = checkDeviceId(request.headers);
    if (deviceId === null) {
      return reply.code(401).send({ error: `missing ${DEVICE_ID_HEADER} header` });
    }
    request.deviceId = deviceId;
    if (!(await verifyJwt(request, reply, auth))) {
      return reply;
    }
  };
}

/**
 * Analytics-route auth: Clerk bearer token when configured, open access when
 * not (device identity is a sync concept, not an analytics one).
 */
export function createJwtPreHandler(options: AuthOptions = {}) {
  const auth = resolveAuth(options);

  return async function jwtPreHandler(request: FastifyRequest, reply: FastifyReply) {
    if (!(await verifyJwt(request, reply, auth))) {
      return reply;
    }
  };
}

export const AUTH_TODO = `
TODO(auth): per-user data scoping (device registration).
JWT verification is live (see createAuthPreHandler); what remains from the
original plan:
  1. Bind the JWT subject to the device id (device registration table) and
     reject devices that do not belong to the authenticated user.
  2. Scope all queries (sync + analytics) by the authenticated user id —
     the canonical tables are still keyed by device_id only, and pull is
     global, so user partitioning needs a schema migration (user_id column
     or user-scoped device keys) before it can be enforced.
No secret material lives in this repository.
`.trim();
