/**
 * Test plumbing: in-memory SQLite + app under test, push/pull helpers that
 * mimic what the mobile sync transport sends, and mutation builders matching
 * the wire DTOs the client outbox produces (full row snapshot payloads with
 * ISO-string timestamps, changedFields for updates/deletes).
 */
import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";

import { buildApp } from "../src/app.js";
import type { Config } from "../src/config.js";
import { openDatabase, type ApiDb } from "../src/db/client.js";
import { migrate } from "../src/db/migrate.js";
import type {
  PullDeltaResponse,
  PushBatchResponse,
  SyncMutationDto,
  SyncRecordDto,
} from "../src/protocol.js";
import { encodeCursor } from "../src/sync/cursor.js";

export type { ApiDb };

export const DEVICE_A = "device-aaaa";
export const DEVICE_B = "device-bbbb";

export function createTestDb(): ApiDb {
  const db = openDatabase(":memory:");
  migrate(db);
  return db;
}

export const testConfig: Config = {
  port: 0,
  databaseUrl: ":memory:",
  allowedOrigin: "",
  clerkSecretKey: "",
};

export async function buildTestApp(db: ApiDb): Promise<FastifyInstance> {
  return buildApp({ db, config: testConfig });
}

let mutationCounter = 0;

/** Wire-shaped mutation with sensible defaults (insert of a product row). */
export function makeMutation(
  overrides: Partial<SyncMutationDto> & { recordId: string },
): SyncMutationDto {
  const { recordId, ...rest } = overrides;
  mutationCounter += 1;
  return {
    id: `mut-${mutationCounter}-${randomUUID()}`,
    tableName: "products",
    recordId,
    operation: "insert",
    changedFields: null,
    payload: {
      id: recordId,
      name: `Product ${mutationCounter}`,
      brand: null,
      categoryId: null,
      packageQuantity: null,
      packageSize: null,
      unit: null,
      notes: null,
      photoImageId: null,
      isFavorite: 0,
      archivedAt: null,
    },
    deviceId: DEVICE_A,
    createdAt: 1_000 + mutationCounter,
    localRevision: 0,
    ...rest,
  };
}

export interface PushOptions {
  /** Header device id; defaults to DEVICE_A. */
  as?: string;
  /** Override body deviceId (defaults to the header value) to test 403s. */
  bodyDeviceId?: string;
}

export async function push(
  app: FastifyInstance,
  mutations: SyncMutationDto[],
  options: PushOptions = {},
): Promise<{ status: number; body: PushBatchResponse | { error: string } }> {
  const as = options.as ?? DEVICE_A;
  const response = await app.inject({
    method: "POST",
    url: "/sync/push",
    headers: { "x-device-id": as },
    payload: { deviceId: options.bodyDeviceId ?? as, mutations },
  });
  return { status: response.statusCode, body: response.json() as PushBatchResponse | { error: string } };
}

export async function pull(
  app: FastifyInstance,
  options: { cursor?: string | null; limit?: number; as?: string } = {},
): Promise<{ status: number; body: PullDeltaResponse | { error: string } }> {
  const query = new URLSearchParams();
  if (options.cursor !== undefined && options.cursor !== null) {
    query.set("cursor", options.cursor);
  }
  if (options.limit !== undefined) {
    query.set("limit", String(options.limit));
  }
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  const response = await app.inject({
    method: "GET",
    url: `/sync/pull${suffix}`,
    headers: { "x-device-id": options.as ?? DEVICE_A },
  });
  return { status: response.statusCode, body: response.json() as PullDeltaResponse | { error: string } };
}

/** Drains every pull page; mirrors the client engine's paging loop. */
export async function pullEverything(app: FastifyInstance, as?: string): Promise<SyncRecordDto[]> {
  const records: SyncRecordDto[] = [];
  let cursor: string | null = null;
  for (;;) {
    const page = await pull(app, { cursor, as });
    if (page.status !== 200) {
      throw new Error(`pull failed: ${JSON.stringify(page.body)}`);
    }
    const delta = page.body as PullDeltaResponse;
    records.push(...delta.records);
    if (delta.nextCursor === null) {
      return records;
    }
    cursor = delta.nextCursor;
  }
}

export { encodeCursor };
