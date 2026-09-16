import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import type * as schema from "./schema";

/**
 * Database handle shared by the app (expo-sqlite) and tests (better-sqlite3).
 * Both drivers extend BaseSQLiteDatabase<"sync", ...>; the run-result type is
 * irrelevant to repository code, so it is erased here and re-cast at the two
 * construction sites.
 */
export type Db = BaseSQLiteDatabase<"sync", unknown, typeof schema>;

/** Transaction handle produced by `db.transaction(...)`. */
export type DbTx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Anything repositories may write through: the db itself or an open transaction. */
export type Executor = Db | DbTx;
