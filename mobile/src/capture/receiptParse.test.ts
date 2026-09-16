import {
  classifyReceiptLine,
  classifyReceiptLines,
  normalizeDescription,
} from "./receiptParse";

describe("receipt line classification", () => {
  it("classifies product lines with quantity and line total", () => {
    const line = classifyReceiptLine("NESTLE FRESH MILK 1L 2x 246.00");
    expect(line).toMatchObject({
      lineType: "product",
      quantity: 2,
      unitPriceMinor: 12_300,
      lineTotalMinor: 24_600,
    });
  });

  it("extracts plain product totals without quantity", () => {
    const line = classifyReceiptLine("DEL MONTE SPAGHETTI 500G   19.50");
    expect(line).toMatchObject({
      lineType: "product",
      quantity: null,
      unitPriceMinor: 1_950,
      lineTotalMinor: 1_950,
    });
  });

  it("handles comma-grouped totals", () => {
    const line = classifyReceiptLine("RICE SINANDOMENG 5KG 1,234.56");
    expect(line.lineTotalMinor).toBe(123_456);
  });

  it("classifies totals, subtotals, tax, discounts, and payment", () => {
    expect(classifyReceiptLine("TOTAL 1,530.25").lineType).toBe("total");
    expect(classifyReceiptLine("SUB-TOTAL 1,600.00").lineType).toBe("subtotal");
    expect(classifyReceiptLine("VAT 12% 190.00").lineType).toBe("tax");
    expect(classifyReceiptLine("DISCOUNT 69.75").lineType).toBe("discount");
    expect(classifyReceiptLine("CASH 2,000.00").lineType).toBe("payment");
  });

  it("marks header/footer noise by position in the receipt", () => {
    const lines = classifyReceiptLines([
      "SAVE MORE SUPERMARKET",
      "NESTLE FRESH MILK 1L 123.00",
      "THANK YOU FOR SHOPPING",
    ]);
    expect(lines[0].lineType).toBe("header");
    expect(lines[1].lineType).toBe("product");
    expect(lines[2].lineType).toBe("footer");
  });

  it("returns unknown for lines without a usable price", () => {
    expect(classifyReceiptLine("PROMO CARD").lineType).toBe("unknown");
  });
});

describe("description normalization", () => {
  it("collapses case and punctuation for matching", () => {
    expect(normalizeDescription("NESTLE Fresh-Milk 1L!")).toBe("nestle fresh milk 1l");
  });
});
