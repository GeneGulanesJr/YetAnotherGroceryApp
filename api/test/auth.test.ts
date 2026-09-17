/**
 * Auth behavior: device-identity-only mode (no secret key) and Clerk JWT
 * mode, driven through a stub verifier so no network or real Clerk instance
 * is needed. Route-level coverage of the legacy mode lives in sync.test.ts
 * and analytics.test.ts.
 */
import { describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import type { Config } from "../src/config.js";
import { createTestDb } from "./helpers.js";

const clerkConfig: Config = {
  port: 0,
  databaseUrl: ":memory:",
  allowedOrigin: "",
  clerkSecretKey: "sk_test_clerk_mode",
};

function stubVerifier(expected: string) {
  return async (token: string) => {
    if (token !== expected) {
      throw new Error("bad token");
    }
    return { sub: "user_2abc" };
  };
}

describe("auth: device-identity-only mode (no CLERK_SECRET_KEY)", () => {
  it("serves sync routes with only the device header", async () => {
    const db = createTestDb();
    const app = await buildApp({ db, config: { ...clerkConfig, clerkSecretKey: "" } });
    const response = await app.inject({ method: "GET", url: "/sync/pull", headers: { "x-device-id": "d1" } });
    expect(response.statusCode).toBe(200);
    await app.close();
  });

  it("keeps analytics open without any identity headers", async () => {
    const db = createTestDb();
    const app = await buildApp({ db, config: { ...clerkConfig, clerkSecretKey: "" } });
    const response = await app.inject({ method: "GET", url: "/analytics/spending-summary" });
    expect(response.statusCode).toBe(200);
    await app.close();
  });
});

describe("auth: Clerk JWT mode", () => {
  async function buildWithStub() {
    const db = createTestDb();
    const app = await buildApp({
      db,
      config: clerkConfig,
      auth: { secretKey: clerkConfig.clerkSecretKey, verify: stubVerifier("good-token") },
    });
    return app;
  }

  it("rejects sync routes without a bearer token (401)", async () => {
    const app = await buildWithStub();
    const response = await app.inject({ method: "GET", url: "/sync/pull", headers: { "x-device-id": "d1" } });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "missing bearer token" });
    await app.close();
  });

  it("rejects analytics routes without a bearer token (401)", async () => {
    const app = await buildWithStub();
    const response = await app.inject({ method: "GET", url: "/analytics/spending-summary" });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "missing bearer token" });
    await app.close();
  });

  it("rejects invalid bearer tokens (401)", async () => {
    const app = await buildWithStub();
    const response = await app.inject({
      method: "GET",
      url: "/sync/pull",
      headers: { "x-device-id": "d1", authorization: "Bearer wrong-token" },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "invalid bearer token" });
    await app.close();
  });

  it("accepts a valid token on sync and analytics routes", async () => {
    const app = await buildWithStub();
    const headers = { "x-device-id": "d1", authorization: "Bearer good-token" };
    const sync = await app.inject({ method: "GET", url: "/sync/pull", headers });
    expect(sync.statusCode).toBe(200);
    const analytics = await app.inject({ method: "GET", url: "/analytics/spending-summary", headers });
    expect(analytics.statusCode).toBe(200);
    await app.close();
  });

  it("keeps /health open without a token", async () => {
    const app = await buildWithStub();
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    await app.close();
  });
});
