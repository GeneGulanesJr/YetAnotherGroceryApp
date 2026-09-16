import { count, eq } from "drizzle-orm";
import { syncMeta, syncMutations } from "../schema";
import { now } from "../context";
import type { Db } from "../types";

export function getMetaValue(db: Db, key: string): string | null {
  return (
    db.select().from(syncMeta).where(eq(syncMeta.key, key)).get()?.value ?? null
  );
}

export function setMetaValue(db: Db, key: string, value: string): void {
  const existing = db
    .select()
    .from(syncMeta)
    .where(eq(syncMeta.key, key))
    .get();
  if (existing === undefined) {
    db.insert(syncMeta).values({ key, value, updatedAt: now() }).run();
  } else {
    db.update(syncMeta)
      .set({ value, updatedAt: now() })
      .where(eq(syncMeta.key, key))
      .run();
  }
}

export function getDefaultCurrency(db: Db): string {
  return getMetaValue(db, "default_currency") ?? "PHP";
}

export function setDefaultCurrency(db: Db, currency: string): void {
  setMetaValue(db, "default_currency", currency);
}

/** Pending outbox size — drives the "pending changes" sync indicator. */
export function getPendingMutationCount(db: Db): number {
  const row = db
    .select({ value: count() })
    .from(syncMutations)
    .where(eq(syncMutations.status, "pending"))
    .get();
  return row?.value ?? 0;
}
