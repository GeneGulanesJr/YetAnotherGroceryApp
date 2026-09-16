/**
 * Database connection factory. Local/file mode runs on better-sqlite3 (same
 * SQLite dialect and DDL as the clients); libSQL/Turso is a drop-in swap
 * documented in README.md ("Switching to Turso/libSQL") — the schema, queries,
 * and sync logic are driver-agnostic Drizzle/SQLite.
 */
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema.js";

export interface ApiDb {
  /** Raw driver handle: used for ledger counters and analytics SQL. */
  sqlite: Database.Database;
  drizzle: BetterSQLite3Database<typeof schema>;
}

/**
 * Opens the database for `DATABASE_URL`. Supported today: `file:path`,
 * bare paths, and `:memory:`. `libsql://` / `https://` URLs are rejected with
 * a pointer to the documented driver swap (TODO(auth-adjacent infra): install
 * @libsql/client + drizzle-orm/libsql to enable).
 */
export function openDatabase(databaseUrl: string): ApiDb {
  if (/^(libsql|wss|https):/i.test(databaseUrl)) {
    throw new Error(
      `Remote DATABASE_URL "${databaseUrl}" requires the libSQL driver swap ` +
        "(README.md → 'Switching to Turso/libSQL'): run `npm i @libsql/client`, " +
        "open with drizzle-orm/libsql, and remove this guard. " +
        "Local mode keeps better-sqlite3.",
    );
  }
  const path = databaseUrl.startsWith("file:") ? databaseUrl.slice("file:".length) : databaseUrl;
  const sqlite = new Database(path === "" ? "local.db" : path);
  if (path !== ":memory:") {
    sqlite.pragma("journal_mode = WAL");
  }
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  return { sqlite, drizzle: drizzle(sqlite, { schema }) };
}
