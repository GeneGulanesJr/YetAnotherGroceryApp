import { createStore } from "../repositories/stores";
import { getActiveTrip } from "../repositories/trips";
import {
  addListItem,
  convertListToTrip,
  createList,
  deleteList,
  listItems,
  listLists,
  removeListItem,
  setListItemPurchased,
  setListItemQuantity,
} from "../repositories/lists";
import { createProduct } from "../repositories/products";
import { createTestDb } from "../test-helpers";
import type { Db } from "../types";

describe("shopping lists", () => {
  let db: Db;

  beforeEach(() => {
    db = createTestDb();
  });

  it("creates lists and items, mixing catalog products and free text", () => {
    const store = createStore(db, { name: "Save More" });
    const list = createList(db, { name: "Weekend", storeId: store.id, currency: "PHP" });
    const milk = createProduct(db, { name: "Milk 1L" });

    addListItem(db, { listId: list.id, productId: milk.id, quantity: 2, estimatedPriceMinor: 12_500 });
    addListItem(db, { listId: list.id, name: "Baking paper" });

    const items = listItems(db, list.id);
    expect(items).toHaveLength(2);
    expect(items[0].productName).toBe("Milk 1L");
    expect(items[0].quantity).toBe(2);
    expect(items[1].productName).toBeNull();
    expect(items[1].name).toBe("Baking paper");

    const summaries = listLists(db);
    expect(summaries[0]).toMatchObject({
      name: "Weekend",
      itemCount: 2,
      openCount: 2,
      estimatedTotalMinor: 25_000,
    });
  });

  it("rejects items without a product or free-text name", () => {
    const list = createList(db, { name: "Empty" });
    expect(() => addListItem(db, { listId: list.id })).toThrow(/product or a free-text/);
  });

  it("toggles purchased state and quantities", () => {
    const list = createList(db, { name: "Weekend" });
    const item = addListItem(db, { listId: list.id, name: "Apples" });

    expect(setListItemPurchased(db, item.id, true)?.purchased).toBe(1);
    expect(listLists(db)[0].openCount).toBe(0);

    expect(setListItemQuantity(db, item.id, 4)?.quantity).toBe(4);
    setListItemQuantity(db, item.id, 0);
    expect(listItems(db, list.id)).toHaveLength(0);
  });

  it("converts a list to an active trip inheriting store and currency, once", () => {
    const store = createStore(db, { name: "Save More" });
    const list = createList(db, { name: "Weekly", storeId: store.id, currency: "PHP" });
    addListItem(db, { listId: list.id, name: "Apples" });

    const converted = convertListToTrip(db, list.id);
    expect(converted).not.toBeNull();
    expect(converted!.trip.status).toBe("active");
    expect(converted!.trip.storeId).toBe(store.id);
    expect(converted!.trip.currency).toBe("PHP");
    expect(converted!.list.tripId).toBe(converted!.trip.id);
    expect(getActiveTrip(db)?.id).toBe(converted!.trip.id);

    // A second conversion while a trip is active is rejected.
    const other = createList(db, { name: "Party" });
    expect(() => convertListToTrip(db, other.id)).toThrow(/active trip already exists/);
  });

  it("deleting a list tombstones its items too", () => {
    const list = createList(db, { name: "Temp" });
    const item = addListItem(db, { listId: list.id, name: "Apples" });
    removeListItem(db, item.id);
    expect(listItems(db, list.id)).toHaveLength(0);

    const item2 = addListItem(db, { listId: list.id, name: "Pears" });
    expect(listItems(db, list.id)).toHaveLength(1);
    expect(deleteList(db, list.id)).toBe(true);
    expect(listLists(db)).toHaveLength(0);
    expect(listItems(db, list.id)).toHaveLength(0);
    expect(item2).toBeDefined();
  });
});
