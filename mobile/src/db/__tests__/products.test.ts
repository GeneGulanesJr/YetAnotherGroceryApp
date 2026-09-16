import { ensureDefaultCategories, listCategories } from "../repositories/categories";
import { findByBarcode } from "../repositories/barcodes";
import {
  archiveProduct,
  createProduct,
  deleteProduct,
  getRecentBrands,
  searchProducts,
  updateProduct,
} from "../repositories/products";
import { recordPrice } from "../repositories/prices";
import { createTestDb } from "../test-helpers";
import type { Db } from "../types";

describe("products repository", () => {
  let db: Db;

  beforeEach(() => {
    db = createTestDb();
  });

  it("creates a product with a barcode and resolves it back by scan", () => {
    const product = createProduct(db, {
      name: "Nestlé Fresh Milk",
      brand: "Nestlé",
      barcode: "4800017234567",
      packageSize: "1",
      unit: "L",
    });

    expect(product.name).toBe("Nestlé Fresh Milk");

    const match = findByBarcode(db, "4800017234567");
    expect(match?.product.id).toBe(product.id);
    expect(match?.product.brand).toBe("Nestlé");

    expect(findByBarcode(db, "0000000000000")).toBeNull();
  });

  it("rejects reassigning a live barcode to another product", () => {
    const a = createProduct(db, { name: "Product A", barcode: "4800017234567" });
    expect(() =>
      createProduct(db, { name: "Product B", barcode: "4800017234567" }),
    ).toThrow(/already assigned/);
    expect(findByBarcode(db, "4800017234567")?.product.id).toBe(a.id);
  });

  it("hides archived and deleted products from search but keeps them by id", () => {
    const milk = createProduct(db, { name: "Oat Milk" });
    const bread = createProduct(db, { name: "Sourdough Bread" });

    archiveProduct(db, bread.id);
    expect(searchProducts(db, "bread")).toHaveLength(0);
    expect(searchProducts(db, "milk")).toHaveLength(1);

    deleteProduct(db, milk.id);
    expect(searchProducts(db, "milk")).toHaveLength(0);
    // Tombstoned barcode no longer resolves.
    expect(findByBarcode(db, "unknown")).toBeNull();
  });

  it("searches name and brand case-insensitively with category and last price", () => {
    ensureDefaultCategories(db);
    const dairy = listCategories(db).find((c) => c.name === "Dairy")!;
    const product = createProduct(db, {
      name: "Fresh Milk",
      brand: "DairyBest",
      categoryId: dairy.id,
    });
    recordPrice(db, {
      productId: product.id,
      currency: "PHP",
      regularPriceMinor: 12_500,
    });

    const results = searchProducts(db, "dairybest");
    expect(results).toHaveLength(1);
    expect(results[0].categoryName).toBe("Dairy");
    expect(results[0].lastPriceMinor).toBe(12_500);
    expect(results[0].lastCurrency).toBe("PHP");
  });

  it("tracks updates and collects recent brands", () => {
    createProduct(db, { name: "Milk", brand: "DairyBest" });
    createProduct(db, { name: "Yogurt", brand: "FarmFresh" });
    const juice = createProduct(db, { name: "Orange Juice", brand: "Tropic" });

    updateProduct(db, juice.id, { brand: "Tropics" });
    expect(getRecentBrands(db)).toContain("Tropics");
    expect(getRecentBrands(db)).not.toContain("Tropic");
  });
});
