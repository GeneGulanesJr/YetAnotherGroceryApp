import { describe, expect, it } from "vitest";

import { addMoney, formatMoney, parseMoney } from "./money";

describe("parseMoney", () => {
  it("parses simple decimal amounts into minor units", () => {
    expect(parseMoney("12.99")).toEqual({ amountMinor: 1299, currency: "USD" });
  });

  it("strips currency symbols and whitespace", () => {
    expect(parseMoney("$10.99")).toEqual({ amountMinor: 1099, currency: "USD" });
    expect(parseMoney("₱123.45", "PHP")).toEqual({ amountMinor: 12345, currency: "PHP" });
  });

  it("treats whole numbers as major units", () => {
    expect(parseMoney("10")).toEqual({ amountMinor: 1000, currency: "USD" });
  });

  it("pads a single fractional digit", () => {
    expect(parseMoney("12.5")).toEqual({ amountMinor: 1250, currency: "USD" });
  });

  it("handles comma decimal separators", () => {
    expect(parseMoney("12,99")).toEqual({ amountMinor: 1299, currency: "USD" });
  });

  it("handles thousands separators", () => {
    expect(parseMoney("1,234.56")).toEqual({ amountMinor: 123456, currency: "USD" });
    expect(parseMoney("1.234,56")).toEqual({ amountMinor: 123456, currency: "USD" });
    expect(parseMoney("1,000")).toEqual({ amountMinor: 100000, currency: "USD" });
  });

  it("parses negative amounts", () => {
    expect(parseMoney("-5.00")).toEqual({ amountMinor: -500, currency: "USD" });
    expect(parseMoney("(5.00)")).toEqual({ amountMinor: -500, currency: "USD" });
  });

  it("returns zero for empty input", () => {
    expect(parseMoney("")).toEqual({ amountMinor: 0, currency: "USD" });
  });
});

describe("formatMoney", () => {
  it("formats minor units as currency", () => {
    expect(formatMoney({ amountMinor: 1099, currency: "USD" })).toBe("$10.99");
  });

  it("formats whole values", () => {
    expect(formatMoney({ amountMinor: 1000, currency: "USD" })).toBe("$10.00");
  });
});

describe("addMoney", () => {
  it("sums matching currencies", () => {
    expect(
      addMoney({ amountMinor: 1099, currency: "USD" }, { amountMinor: 50, currency: "USD" }),
    ).toEqual({ amountMinor: 1149, currency: "USD" });
  });

  it("throws on mismatched currencies", () => {
    expect(() =>
      addMoney({ amountMinor: 100, currency: "USD" }, { amountMinor: 100, currency: "PHP" }),
    ).toThrow();
  });
});
