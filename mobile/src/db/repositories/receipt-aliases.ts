import { and, eq, isNull } from "drizzle-orm";

import { receiptAliases } from "../schema";
import { trackInsert, trackUpdate } from "../outbox";
import type { Db } from "../types";

/**
 * Store-specific receipt aliases (tech.mobile.md "Receipt Processing"):
 * confirmed matches are learned so "NEST MILK 1L" on one store's receipts
 * resolves to the same product next time. Matching prefers the
 * store-specific alias, then the store-independent one.
 */

export function learnAlias(
  db: Db,
  input: { storeId: string | null; alias: string; productId: string },
): void {
  const normalized = input.alias.trim().toLowerCase();
  if (normalized === "") {
    return;
  }
  const conditions = [eq(receiptAliases.alias, normalized), isNull(receiptAliases.deletedAt)];
  if (input.storeId === null) {
    conditions.push(isNull(receiptAliases.storeId));
  } else {
    conditions.push(eq(receiptAliases.storeId, input.storeId));
  }
  const existing = db
    .select()
    .from(receiptAliases)
    .where(and(...conditions))
    .limit(1)
    .get();

  if (existing === undefined) {
    trackInsert(db, receiptAliases, {
      storeId: input.storeId,
      alias: normalized,
      productId: input.productId,
    });
    return;
  }
  if (existing.productId !== input.productId) {
    // Most recent confirmation wins.
    trackUpdate(db, receiptAliases, existing.id, { productId: input.productId });
  }
}

export function findProductIdByAlias(
  db: Db,
  alias: string,
  storeId: string | null,
): string | null {
  const normalized = alias.trim().toLowerCase();
  if (normalized === "") {
    return null;
  }
  const match = (scope: "store" | "global") =>
    db
      .select()
      .from(receiptAliases)
      .where(
        and(
          eq(receiptAliases.alias, normalized),
          isNull(receiptAliases.deletedAt),
          scope === "store"
            ? eq(receiptAliases.storeId, storeId ?? "")
            : isNull(receiptAliases.storeId),
        ),
      )
      .limit(1)
      .get();

  const scoped = storeId !== null ? match("store") : undefined;
  return (scoped ?? match("global"))?.productId ?? null;
}
