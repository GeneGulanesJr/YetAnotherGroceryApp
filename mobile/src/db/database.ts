import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";
import { newId, setDeviceId } from "./context";
import { ensureDefaultCategories } from "./repositories/categories";
import { getMetaValue, setMetaValue } from "./repositories/meta";
import { runMigrations } from "./migrate";
import * as schema from "./schema";
import type { Db } from "./types";

export const DEFAULT_CURRENCY = "PHP";
export const DEVICE_ID_KEY = "device_id";
export const CURRENCY_KEY = "default_currency";

let instance: Db | null = null;

/**
 * Opens (or returns) the app database: WAL + foreign keys on, migrations
 * applied, device id and defaults bootstrapped. Safe to call repeatedly.
 */
export function getDatabase(): Db {
  if (instance !== null) {
    return instance;
  }

  const sqlite = openDatabaseSync("yaga.db");
  sqlite.execSync("PRAGMA journal_mode = WAL;");
  sqlite.execSync("PRAGMA foreign_keys = ON;");

  const db = drizzle(sqlite, { schema }) as unknown as Db;
  runMigrations(db);
  bootstrap(db);
  instance = db;
  return db;
}

function bootstrap(db: Db): void {
  let deviceId = getMetaValue(db, DEVICE_ID_KEY);
  if (deviceId === null) {
    deviceId = newId();
    setMetaValue(db, DEVICE_ID_KEY, deviceId);
  }
  setDeviceId(deviceId);

  if (getMetaValue(db, CURRENCY_KEY) === null) {
    setMetaValue(db, CURRENCY_KEY, DEFAULT_CURRENCY);
  }

  ensureDefaultCategories(db);
}
