import { describe, expect, it } from "vitest";

import {
  BrowserDownloadExporter,
  minorToDecimal,
  resolveExporter,
  serializeCsv,
  toPriceWatchDataset,
  toSpendingByCategoryDataset,
  toSpendingByStoreDataset,
  toSpendingSeriesDataset,
} from "./export";

describe("serializeCsv", () => {
  it("joins cells with commas and rows with CRLF, using first-row key order", () => {
    expect(
      serializeCsv([
        { date: "2026-01-01", amount: "12.34", currency: "PHP" },
        { date: "2026-01-02", amount: "5.00", currency: "PHP" },
      ]),
    ).toBe("date,amount,currency\r\n2026-01-01,12.34,PHP\r\n2026-01-02,5.00,PHP");
  });

  it("quotes fields containing commas", () => {
    expect(serializeCsv([{ name: "Rice, 5kg", total: 1 }])).toBe(
      'name,total\r\n"Rice, 5kg",1',
    );
  });

  it("escapes embedded quotes by doubling them", () => {
    expect(serializeCsv([{ name: 'He said "hi"', total: 1 }])).toBe(
      'name,total\r\n"He said ""hi""",1',
    );
  });

  it("quotes fields containing newlines", () => {
    expect(serializeCsv([{ name: "line1\nline2", total: 1 }])).toBe(
      'name,total\r\n"line1\nline2",1',
    );
  });

  it("escapes formula-injection cells beginning with = + - @", () => {
    const out = serializeCsv([
      { equals: "=SUM(A1)", plus: "+1", minus: "-1", at: "@cmd" },
    ]);
    expect(out).toBe(
      "equals,plus,minus,at\r\n'=SUM(A1),'+1,'-1,'@cmd",
    );
  });

  it("still quotes cells that both need formula escaping and contain separators", () => {
    expect(serializeCsv([{ formula: "=1,2" }])).toBe('formula\r\n"\'=1,2"');
  });

  it("honors explicit header order and fills missing columns as empty", () => {
    expect(
      serializeCsv([{ b: "2", a: "1" }, { a: "3", c: "9" }], { headers: ["a", "b", "c"] }),
    ).toBe("a,b,c\r\n1,2,\r\n3,,9");
  });

  it("renders null and undefined cells as empty strings", () => {
    expect(serializeCsv([{ a: null, b: undefined, c: 0 }])).toBe("a,b,c\r\n,,0");
  });

  it("returns an empty string for no rows without explicit headers", () => {
    expect(serializeCsv([])).toBe("");
  });
});

describe("minorToDecimal", () => {
  it("converts integer minor units to decimal strings", () => {
    expect(minorToDecimal(12345)).toBe("123.45");
    expect(minorToDecimal(5)).toBe("0.05");
    expect(minorToDecimal(100)).toBe("1.00");
    expect(minorToDecimal(0)).toBe("0.00");
  });

  it("keeps negative amounts negative", () => {
    expect(minorToDecimal(-12345)).toBe("-123.45");
    expect(minorToDecimal(-5)).toBe("-0.05");
  });

  it("rounds fractional minor units instead of dropping cents", () => {
    expect(minorToDecimal(1234.6)).toBe("12.35");
  });
});

describe("dataset helpers", () => {
  it("maps spending series to decimal amounts", () => {
    const out = toSpendingSeriesDataset([
      { date: "2026-01", amountMinor: 12345, currency: "PHP" },
    ]);
    expect(out.filename).toBe("spending-series.csv");
    expect(out.headers).toEqual(["date", "currency", "amount"]);
    expect(out.rows).toEqual([
      { date: "2026-01", currency: "PHP", amount: "123.45" },
    ]);
  });

  it("maps spending by store and by category with stable column names", () => {
    const named = [{ id: "s1", name: "Supermart", amountMinor: 250, currency: "PHP" }];
    const byStore = toSpendingByStoreDataset(named);
    expect(byStore.filename).toBe("spending-by-store.csv");
    expect(byStore.headers).toEqual(["store_id", "store", "currency", "amount"]);
    expect(byStore.rows[0]).toEqual({
      store_id: "s1",
      store: "Supermart",
      currency: "PHP",
      amount: "2.50",
    });

    const byCategory = toSpendingByCategoryDataset([
      { id: "c1", name: "Produce", amountMinor: 19999, currency: "PHP" },
    ]);
    expect(byCategory.filename).toBe("spending-by-category.csv");
    expect(byCategory.headers).toEqual(["category_id", "category", "currency", "amount"]);
    expect(byCategory.rows[0]).toEqual({
      category_id: "c1",
      category: "Produce",
      currency: "PHP",
      amount: "199.99",
    });
  });

  it("maps price watch rows and renders null statistics as empty cells", () => {
    const out = toPriceWatchDataset([
      {
        productId: "p1",
        productName: "Milk, 1L",
        currency: "PHP",
        observationCount: 3,
        latestMinor: 10995,
        averageMinor: 11245,
        lowestMinor: 10500,
        highestMinor: 12000,
        trendPercent: -2.2,
        latestAtLowest: false,
        latestAtHighest: false,
      },
      {
        productId: "p2",
        productName: "=CMD",
        currency: "PHP",
        observationCount: 1,
        latestMinor: null,
        averageMinor: null,
        lowestMinor: null,
        highestMinor: null,
        trendPercent: null,
        latestAtLowest: false,
        latestAtHighest: false,
      },
    ]);
    expect(out.filename).toBe("price-watch.csv");
    expect(out.headers).toEqual([
      "product_id",
      "product",
      "currency",
      "observations",
      "latest",
      "average",
      "lowest",
      "highest",
      "trend_percent",
      "latest_at_lowest",
      "latest_at_highest",
    ]);
    expect(out.rows[0].latest).toBe("109.95");
    // Dataset rows keep raw values; the serializer applies formula escaping.
    expect(out.rows[1]).toMatchObject({
      product: "=CMD",
      latest: "",
      average: "",
      lowest: "",
      highest: "",
      trend_percent: "",
    });
  });
});

describe("serializeCsv exact output", () => {
  it("produces the exact expected CSV for a small fixture", () => {
    const fixture = toSpendingByStoreDataset([
      { id: "s1", name: "Store, A", amountMinor: 12345, currency: "PHP" },
      { id: "s2", name: 'The "Big" Store', amountMinor: 250, currency: "PHP" },
    ]);
    expect(serializeCsv(fixture.rows, { headers: fixture.headers })).toBe(
      [
        "store_id,store,currency,amount",
        's1,"Store, A",PHP,123.45',
        's2,"The ""Big"" Store",PHP,2.50',
      ].join("\r\n"),
    );
  });
});

describe("resolveExporter", () => {
  // jsdom has no __TAURI_INTERNALS__, so the browser exporter must be chosen.
  it("selects the browser download exporter outside Tauri", () => {
    expect(resolveExporter()).toBeInstanceOf(BrowserDownloadExporter);
  });
});
