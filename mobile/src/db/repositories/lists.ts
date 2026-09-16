import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  products,
  shoppingListItems,
  shoppingLists,
  trips,
  type ShoppingList,
  type ShoppingListItem,
  type Trip,
} from "../schema";
import { now } from "../context";
import { trackDelete, trackInsert, trackUpdate } from "../outbox";
import { getActiveTrip } from "./trips";
import type { Db } from "../types";

export interface ListInput {
  name: string;
  storeId?: string | null;
  currency?: string | null;
}

export function createList(db: Db, input: ListInput): ShoppingList {
  return trackInsert(db, shoppingLists, {
    name: input.name.trim(),
    storeId: input.storeId ?? null,
    currency: input.currency ?? null,
    estimatedTotalMinor: null,
    tripId: null,
  });
}

export function renameList(db: Db, id: string, name: string): ShoppingList | undefined {
  return trackUpdate(db, shoppingLists, id, { name: name.trim() });
}

export function deleteList(db: Db, id: string): boolean {
  const list = getList(db, id);
  if (list === undefined) {
    return false;
  }
  return db.transaction((tx) => {
    for (const item of listItems(db, id)) {
      trackDelete(tx, shoppingListItems, item.id);
    }
    return trackDelete(tx, shoppingLists, id);
  });
}

export function getList(db: Db, id: string): ShoppingList | undefined {
  return db
    .select()
    .from(shoppingLists)
    .where(and(eq(shoppingLists.id, id), isNull(shoppingLists.deletedAt)))
    .get();
}

export interface ListItemInput {
  listId: string;
  productId?: string | null;
  name?: string | null;
  quantity?: number;
  unit?: string | null;
  estimatedPriceMinor?: number | null;
  currency?: string | null;
}

export function addListItem(db: Db, input: ListItemInput): ShoppingListItem {
  if (
    (input.productId === null || input.productId === undefined) &&
    (input.name === null || input.name === undefined || input.name.trim() === "")
  ) {
    throw new Error("List item needs a product or a free-text name");
  }
  return trackInsert(db, shoppingListItems, {
    listId: input.listId,
    productId: input.productId ?? null,
    name: input.name?.trim() || null,
    quantity: input.quantity ?? 1,
    unit: input.unit ?? null,
    purchased: 0,
    storeId: null,
    currency: input.currency ?? null,
    estimatedPriceMinor: input.estimatedPriceMinor ?? null,
  });
}

export function removeListItem(db: Db, itemId: string): boolean {
  return trackDelete(db, shoppingListItems, itemId);
}

export function setListItemQuantity(
  db: Db,
  itemId: string,
  quantity: number,
): ShoppingListItem | undefined {
  if (quantity <= 0) {
    removeListItem(db, itemId);
    return undefined;
  }
  return trackUpdate(db, shoppingListItems, itemId, { quantity });
}

export function setListItemPurchased(
  db: Db,
  itemId: string,
  purchased: boolean,
): ShoppingListItem | undefined {
  return trackUpdate(db, shoppingListItems, itemId, { purchased: purchased ? 1 : 0 });
}

export interface ListItemLine extends ShoppingListItem {
  productName: string | null;
}

export function listItems(db: Db, listId: string): ListItemLine[] {
  return db
    .select({ item: shoppingListItems, productName: products.name })
    .from(shoppingListItems)
    .leftJoin(products, eq(products.id, shoppingListItems.productId))
    .where(
      and(eq(shoppingListItems.listId, listId), isNull(shoppingListItems.deletedAt)),
    )
    .orderBy(asc(shoppingListItems.createdAt))
    .all()
    .map((row) => ({ ...row.item, productName: row.productName ?? null }));
}

export interface ListSummaryLine extends ShoppingList {
  itemCount: number;
  openCount: number;
  estimatedTotalMinor: number;
}

export function listLists(db: Db): ListSummaryLine[] {
  const listRows = db
    .select()
    .from(shoppingLists)
    .where(isNull(shoppingLists.deletedAt))
    .orderBy(desc(shoppingLists.updatedAt))
    .all();
  if (listRows.length === 0) {
    return [];
  }

  const listIds = listRows.map((l) => l.id);
  const aggregates = new Map(
    db
      .select({
        listId: shoppingListItems.listId,
        itemCount: count(),
        openCount: sql<number>`sum(case when ${shoppingListItems.purchased} = 0 then 1 else 0 end)`,
        estimatedTotalMinor: sql<number>`coalesce(sum(coalesce(${shoppingListItems.estimatedPriceMinor}, 0) * ${shoppingListItems.quantity}), 0)`,
      })
      .from(shoppingListItems)
      .where(
        and(
          isNull(shoppingListItems.deletedAt),
          inArray(shoppingListItems.listId, listIds),
        ),
      )
      .groupBy(shoppingListItems.listId)
      .all()
      .map((row) => [row.listId, row]),
  );

  return listRows.map((list) => {
    const aggregate = aggregates.get(list.id);
    return {
      ...list,
      itemCount: aggregate?.itemCount ?? 0,
      openCount: Number(aggregate?.openCount ?? 0),
      estimatedTotalMinor: Number(aggregate?.estimatedTotalMinor ?? 0),
    };
  });
}

/**
 * Converts a list into a shopping trip: the trip inherits the list's store
 * and currency, and the list is linked to the trip. Items stay as a
 * checklist; purchases are recorded by scanning during the trip.
 */
export function convertListToTrip(
  db: Db,
  listId: string,
): { trip: Trip; list: ShoppingList } | null {
  const list = getList(db, listId);
  if (list === undefined) {
    return null;
  }
  if (getActiveTrip(db) !== undefined) {
    throw new Error("An active trip already exists; complete or cancel it first");
  }
  return db.transaction((tx) => {
    const trip = trackInsert(tx, trips, {
      storeId: list.storeId,
      status: "active",
      startedAt: now(),
      endedAt: null,
      currency: list.currency,
      budgetMinor: null,
      notes: null,
    });
    const updated = trackUpdate(tx, shoppingLists, listId, { tripId: trip.id });
    return { trip, list: updated! };
  });
}
