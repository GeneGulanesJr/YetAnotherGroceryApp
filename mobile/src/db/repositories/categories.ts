import { asc, isNull, sql } from "drizzle-orm";
import { categories, type Category } from "../schema";
import { trackInsert } from "../outbox";
import type { Db } from "../types";

const DEFAULT_CATEGORY_NAMES = [
  "Produce",
  "Bakery",
  "Dairy",
  "Meat",
  "Seafood",
  "Pantry",
  "Frozen",
  "Beverages",
  "Snacks",
  "Household",
  "Personal Care",
  "Other",
] as const;

/** Seeds the default categories once; existing rows are never duplicated. */
export function ensureDefaultCategories(db: Db): void {
  const existing = new Set(listCategories(db).map((c) => c.name));
  for (const name of DEFAULT_CATEGORY_NAMES) {
    if (!existing.has(name)) {
      trackInsert(db, categories, { name, parentId: null, defaultUnit: null });
    }
  }
}

export function listCategories(db: Db): Category[] {
  return db
    .select()
    .from(categories)
    .where(isNull(categories.deletedAt))
    .orderBy(asc(categories.name))
    .all();
}

/** Case-insensitive lookup used by the manual capture form. */
export function findCategoryByName(db: Db, name: string): Category | undefined {
  return db
    .select()
    .from(categories)
    .where(
      sql`lower(${categories.name}) = lower(${name}) and ${categories.deletedAt} is null`,
    )
    .get();
}
