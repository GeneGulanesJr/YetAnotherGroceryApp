/**
 * Fastify application factory: health, sync (device-header guarded), and
 * analytics routes. Kept as a factory so tests drive it with in-memory
 * SQLite through fastify.inject and server.ts stays a thin bootstrap.
 */
import cors from "@fastify/cors";
import fastify, { type FastifyInstance } from "fastify";

import { checkDeviceId, DEVICE_ID_HEADER } from "./auth.js";
import {
  getSpendingByCategory,
  getSpendingByStore,
  getPriceWatch,
  getSpendingSeries,
  getSpendingSummary,
  type AnalyticsFilters,
  type Granularity,
} from "./analytics/queries.js";
import { loadConfig, type Config } from "./config.js";
import type { ApiDb } from "./db/client.js";
import { applyPushBatch, BatchValidationError } from "./sync/apply.js";
import { decodeCursor } from "./sync/cursor.js";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, pullDelta } from "./sync/pull.js";

export interface AppOptions {
  db: ApiDb;
  config: Config;
}

export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const { db, config } = options;
  const app = fastify({ logger: false });

  await app.register(cors, {
    origin: config.allowedOrigin === "" ? true : config.allowedOrigin,
  });

  app.get("/health", async () => ({ status: "ok", time: Date.now() }));

  // Sync routes: device identity placeholder (Clerk JWT TODO — see auth.ts).
  await app.register(
    async function syncRoutes(sync) {
      sync.addHook("preHandler", async (request, reply) => {
        // TODO(auth): verify the Clerk bearer JWT here and bind it to the device
        // id (see AUTH_TODO in auth.ts). Header-only identity until then.
        const deviceId = checkDeviceId(request.headers);
        if (deviceId === null) {
          return reply.code(401).send({ error: `missing ${DEVICE_ID_HEADER} header` });
        }
        request.deviceId = deviceId;
      });

      sync.post("/push", async (request, reply) => {
        const body = request.body as { deviceId?: unknown; mutations?: unknown } | null;
        if (typeof body !== "object" || body === null || typeof body.deviceId !== "string") {
          return reply.code(400).send({ error: "body must be PushBatchRequest with a deviceId" });
        }
        if (body.deviceId !== request.deviceId) {
          return reply.code(403).send({ error: "body deviceId does not match X-Device-Id header" });
        }
        try {
          const { results, cursor } = applyPushBatch(db, request.deviceId, body.mutations);
          return { results, cursor };
        } catch (cause) {
          if (cause instanceof BatchValidationError) {
            return reply.code(400).send({ error: cause.message });
          }
          throw cause;
        }
      });

      sync.get("/pull", async (request, reply) => {
        const query = request.query as { cursor?: string; limit?: string };
        const afterSeq = decodeCursor(query.cursor);
        if (afterSeq === null) {
          return reply.code(400).send({ error: "invalid cursor" });
        }
        const limit = parseLimit(query.limit);
        if (limit === null) {
          return reply.code(400).send({ error: "limit must be an integer between 1 and 500" });
        }
        return pullDelta(db, afterSeq, limit);
      });
    },
    { prefix: "/sync" },
  );

  // Analytics routes: public read-only aggregations (auth TODO in auth.ts).
  const parseFilters = (query: Record<string, unknown>): AnalyticsFilters | string => {
    const filters: AnalyticsFilters = {};
    if (query["rangeDays"] !== undefined) {
      const value = Number(query["rangeDays"]);
      if (!Number.isInteger(value) || value <= 0) {
        return "rangeDays must be a positive integer";
      }
      filters.rangeDays = value;
    }
    if (query["currency"] !== undefined) {
      const value = query["currency"];
      if (typeof value !== "string" || value.trim() === "") {
        return "currency must be a non-empty string";
      }
      filters.currency = value.trim();
    }
    return filters;
  };

  app.get("/analytics/spending-summary", async (request, reply) => {
    const filters = parseFilters(request.query as Record<string, unknown>);
    if (typeof filters === "string") {
      return reply.code(400).send({ error: filters });
    }
    return getSpendingSummary(db, filters);
  });

  app.get("/analytics/spending-series", async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const granularity = query["granularity"];
    if (granularity !== "day" && granularity !== "week" && granularity !== "month") {
      return reply.code(400).send({ error: "granularity must be one of day, week, month" });
    }
    const filters = parseFilters(query);
    if (typeof filters === "string") {
      return reply.code(400).send({ error: filters });
    }
    return getSpendingSeries(db, granularity as Granularity, filters);
  });

  app.get("/analytics/spending-by-store", async (request, reply) => {
    const filters = parseFilters(request.query as Record<string, unknown>);
    if (typeof filters === "string") {
      return reply.code(400).send({ error: filters });
    }
    return getSpendingByStore(db, filters);
  });

  app.get("/analytics/spending-by-category", async (request, reply) => {
    const filters = parseFilters(request.query as Record<string, unknown>);
    if (typeof filters === "string") {
      return reply.code(400).send({ error: filters });
    }
    return getSpendingByCategory(db, filters);
  });

  app.get("/analytics/price-watch", async (request, reply) => {
    const filters = parseFilters(request.query as Record<string, unknown>);
    if (typeof filters === "string") {
      return reply.code(400).send({ error: filters });
    }
    return getPriceWatch(db, filters);
  });

  return app;
}

function parseLimit(raw: string | undefined): number | null {
  if (raw === undefined) {
    return DEFAULT_PAGE_SIZE;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > MAX_PAGE_SIZE) {
    return null;
  }
  return value;
}

export { loadConfig };
