import {
  barcodeLookupKeys,
  expandUpcE,
  isValidCheckDigit,
  isValidEan13,
  isValidUpcA,
  normalizeBarcode,
} from "./barcode";

describe("barcode utils", () => {
  it("validates EAN-13 check digits", () => {
    // Well-known sample: 5901234123457 (valid EAN-13)
    expect(isValidEan13("5901234123457")).toBe(true);
    expect(isValidEan13("5901234123458")).toBe(false);
    expect(isValidEan13("59012341234")).toBe(false);
  });

  it("validates UPC-A check digits", () => {
    // 036000291452 is a classic valid UPC-A.
    expect(isValidUpcA("036000291452")).toBe(true);
    expect(isValidUpcA("036000291453")).toBe(false);
    expect(isValidCheckDigit("12345670")).toBe(true);
  });

  it("expands UPC-E to UPC-A (middle digits 0-2 pattern)", () => {
    // data 345312 (d6=2) -> 0 34 2 0000 531 + check (computed: 2)
    const expanded = expandUpcE("03453122");
    expect(expanded).not.toBeNull();
    expect(expanded).toMatch(/^03420000531\d$/);
    expect(isValidUpcA(expanded!)).toBe(true);
    // The UPC-E check digit equals the expanded UPC-A check digit.
    expect(expanded![11]).toBe("2");
    // 6- and 7-digit inputs expand identically.
    expect(expandUpcE("345312")).toBe(expanded);
    expect(expandUpcE("3453123")).toBe(expanded);
  });

  it("expands UPC-E with trailing 5-9 pattern", () => {
    // data 123456 (d6=6) -> 0 12345 0000 6 + check
    const expanded = expandUpcE("01234569");
    expect(expanded).toMatch(/^01234500006\d$/);
    expect(isValidUpcA(expanded!)).toBe(true);
  });

  it("rejects unexpandable UPC-E lengths", () => {
    expect(expandUpcE("123")).toBeNull();
    expect(expandUpcE("12345678")).toBeNull();
  });

  it("normalizes scans to canonical storage form", () => {
    expect(normalizeBarcode("5901234123457", "ean-13")).toBe("5901234123457");
    expect(normalizeBarcode(" 036000291452 ", "upc-a")).toBe("036000291452");
    expect(normalizeBarcode("01234569", "upc-e")).toBe(expandUpcE("01234569"));
    expect(normalizeBarcode("https://example.com", "qr")).toBe("https://example.com");
  });

  it("builds lookup keys bridging EAN-13 <-> UPC-A and UPC-E", () => {
    // A UPC-A scan also matches a product stored with leading-zero EAN-13.
    expect(barcodeLookupKeys("036000291452", "upc-a")).toEqual(
      expect.arrayContaining(["036000291452", "0036000291452"]),
    );
    // And the EAN-13 form matches the 12-digit storage.
    expect(barcodeLookupKeys("0036000291452", "ean-13")).toEqual(
      expect.arrayContaining(["0036000291452", "036000291452"]),
    );
    // UPC-E scans resolve to the expanded UPC-A plus the raw digit forms.
    const expanded = expandUpcE("01234569")!;
    const keys = barcodeLookupKeys("01234569", "upc-e");
    expect(keys).toEqual(
      expect.arrayContaining([expanded, "01234569", "1234569"]),
    );
  });
});
