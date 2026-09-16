import { bestShelfPrice, parsePriceCandidates } from "./priceParse";

describe("price parsing from OCR lines", () => {
  it("extracts currency-marked decimals with the highest confidence", () => {
    const candidates = parsePriceCandidates([
      { text: "NESTLE FRESH MILK" },
      { text: "₱123.45" },
      { text: "per 100 mL" },
    ]);
    expect(candidates[0]).toMatchObject({ minor: 12345, normalized: "123.45", confidence: 0.9 });
    expect(candidates[0].unitPrice).toBe(false);
  });

  it("prefers the non-unit price when only unit lines are marked", () => {
    const best = bestShelfPrice([
      { text: "SAVINGS" },
      { text: "₱12.50 per 100 g" },
      { text: "89.95" },
    ]);
    // The bare decimal wins over the marked unit price.
    expect(best).toMatchObject({ minor: 8995, unitPrice: false });
  });

  it("handles comma decimals and marked integers", () => {
    const candidates = parsePriceCandidates([
      { text: "123,45" },
      { text: "P89" },
    ]);
    const byMinor = new Map(candidates.map((c) => [c.minor, c]));
    expect(byMinor.get(12345)?.confidence).toBe(0.6);
    expect(byMinor.get(8900)?.normalized).toBe("89.00");
  });

  it("repairs common OCR digit confusions", () => {
    const candidates = parsePriceCandidates([{ text: "₱l23.4O" }]);
    expect(candidates[0]).toMatchObject({ minor: 12340, normalized: "123.40" });
    expect(candidates[0].confidence).toBeLessThan(0.9);
  });

  it("ignores junk lines and out-of-range values", () => {
    expect(
      parsePriceCandidates([
        { text: "PROMO!!! NOW ONLY" },
        { text: "₱99999.99" },
        { text: "" },
      ]),
    ).toEqual([
      expect.objectContaining({ minor: 9_999_999, confidence: 0.9 }),
    ]);
    // More than 5 integer digits is never a shelf price.
    expect(parsePriceCandidates([{ text: "₱999999.99" }])).toHaveLength(0);
    expect(parsePriceCandidates([{ text: "₱999999999.99" }])).toHaveLength(0);
  });

  it("keeps bounding boxes so the overlay can highlight the source", () => {
    const bbox = { x: 10, y: 20, width: 30, height: 40 };
    const [candidate] = parsePriceCandidates([{ text: "₱55.00", bbox }]);
    expect(candidate.bbox).toEqual(bbox);
  });
});
