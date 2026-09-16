import { asc, isNull, sql } from "drizzle-orm";
import { stores, type Store } from "../schema";
import { trackDelete, trackInsert, trackUpdate } from "../outbox";
import type { Db } from "../types";

export interface StoreInput {
  name: string;
  branch?: string | null;
  address?: string | null;
}

export function createStore(db: Db, input: StoreInput): Store {
  return trackInsert(db, stores, {
    name: input.name.trim(),
    branch: input.branch?.trim() || null,
    address: input.address?.trim() || null,
    logoImageId: null,
  });
}

export function listStores(db: Db): Store[] {
  return db
    .select()
    .from(stores)
    .where(isNull(stores.deletedAt))
    .orderBy(asc(stores.name), asc(stores.branch))
    .all();
}

export function getStore(db: Db, id: string): Store | undefined {
  return db
    .select()
    .from(stores)
    .where(sql`${stores.id} = ${id} and ${stores.deletedAt} is null`)
    .get();
}

export function findStoreByName(
  db: Db,
  name: string,
  branch?: string,
): Store | undefined {
  const conditions = [sql`lower(${stores.name}) = lower(${name})`, isNull(stores.deletedAt)];
  if (branch !== undefined) {
    conditions.push(sql`lower(coalesce(${stores.branch}, '')) = lower(${branch})`);
  }
  return db
    .select()
    .from(stores)
    .where(sql.join(conditions, sql` and `))
    .get();
}

/** Find-or-create used by "Start Trip" quick entry. */
export function ensureStore(db: Db, input: StoreInput): Store {
  const existing = findStoreByName(db, input.name, input.branch ?? undefined);
  return existing ?? createStore(db, input);
}

export function updateStore(
  db: Db,
  id: string,
  patch: Partial<Pick<Store, "name" | "branch" | "address" | "logoImageId">>,
): Store | undefined {
  return trackUpdate(db, stores, id, patch);
}

/** Soft-deletes the store; historical rows keep referencing it (FK stays valid). */
export function deleteStore(db: Db, id: string): boolean {
  return trackDelete(db, stores, id);
}
