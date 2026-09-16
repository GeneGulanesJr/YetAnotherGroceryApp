import { sql } from "drizzle-orm";
import { migrations } from "./migrations";
import type { Db } from "./types";

/**
 * Versioned migration runner. The applied count is tracked in SQLite's
 * built-in `user_version` header; each migration is applied in a single
 * transaction. Statements come from src/db/migrations.ts (embedded from
 * drizzle/ by scripts/embed-migrations.mjs) so device and test runs execute
 * exactly the same SQL.
 */
export function runMigrations(db: Db): string[] {
  const applied: string[] = [];
  const current = getUserVersion(db);

  for (let index = current; index < migrations.length; index++) {
    const migration = migrations[index];
    db.transaction((tx) => {
      for (const statement of migration.statements) {
        tx.run(sql.raw(statement));
      }
      tx.run(sql.raw(`PRAGMA user_version = ${index + 1}`));
    });
    applied.push(migration.id);
  }

  return applied;
}

function getUserVersion(db: Db): number {
  const row = db.get<{ user_version: number }>(sql`PRAGMA user_version`);
  return row?.user_version ?? 0;
}
