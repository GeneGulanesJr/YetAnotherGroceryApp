import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { newId, setDeviceId } from "./context";
import { runMigrations } from "./migrate";
import * as schema from "./schema";
import type { Db } from "./types";

/**
 * Test-only database factory. Runs the exact same embedded migrations as the
 * app so repositories can be integration-tested in Node (spec: SQLite
 * integration fixtures). Only import from *.test.ts files — this module pulls
 * in better-sqlite3, which must never reach the Metro bundle.
 */

export function createTestDb(): Db {
  return buildDb(new Database(":memory:"));
}

/** Persists to disk; used to assert state survives an "app kill". */
export function createFileTestDb(path: string): Db {
  return buildDb(new Database(path));
}

function buildDb(sqlite: InstanceType<typeof Database>): Db {
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema }) as unknown as Db;
  runMigrations(db);
  setDeviceId(newId());
  return db;
}
