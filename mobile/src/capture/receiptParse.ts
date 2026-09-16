/**
 * Receipt-line parsing per the tech.mobile.md pipeline: OCR text is
 * normalized, classified (product/total/subtotal/…), quantity and price are
 * extracted, and every value stays a candidate until user confirmation.
 */

import type { OcrLine } from "./priceParse";

export type ReceiptLineType =
  | "product"
  | "quantity"
  | "discount"
  | "tax"
  | "subtotal"
  | "total"
  | "payment"
  | "header"
  | "footer"
  | "unknown";

export interface ParsedReceiptLine {
  lineType: ReceiptLineType;
  descriptionRaw: string;
  quantity: number | null;
  /** Unit price in minor units when the line yields one. */
  unitPriceMinor: number | null;
  lineTotalMinor: number | null;
}

// Order matters: specific labels before the generic "total" (SUB-TOTAL
// contains TOTAL).
const KEYWORDS: readonly [RegExp, ReceiptLineType][] = [
  [/\b(sub[- ]?total)\b/i, "subtotal"],
  [/\b(vat|tax|gst)\b/i, "tax"],
  [/\b(discount|savings|promo|less)\b/i, "discount"],
  [/\b(cash|change|visa|mastercard|gcash|maya|card|payment|amt tendered)\b/i, "payment"],
  [/\b(total|amount due|balance due)\b/i, "total"],
];

/** Words that mark header/footer noise rather than product lines. */
const NOISE = /(thank|receipt|invoice|store|supermarket|market|branch|tin|vat reg|serial|cashier|terminal|sir|madam|welcome|customer|www\.|http|points)/i;

/** Trailing price like " 123.45" or ", 1,234.56". */
const TRAILING_PRICE = /(?:^|[\s×x])(?:(\d{1,3}(?:,\d{3})+|\d{1,5})[.,](\d{2}))\s*$/;

/** Leading/mid quantity like "2x", "2 X", "x3". */
const QUANTITY = /(?:^|\s)(\d{1,2})\s*[x×]\s*/i;

export function classifyReceiptLine(rawLine: string | OcrLine): ParsedReceiptLine {
  const text = (typeof rawLine === "string" ? rawLine : rawLine.text).trim();
  const lower = text.toLowerCase();
  const amount = trailingAmount(text);

  // Keyword classes only count when the line actually carries an amount —
  // "SAVE MORE SUPERMARKET" is a header, not a 0-discount.
  for (const [pattern, lineType] of KEYWORDS) {
    if (amount !== null && pattern.test(lower)) {
      return {
        lineType,
        descriptionRaw: text,
        quantity: null,
        unitPriceMinor: amount,
        lineTotalMinor: amount,
      };
    }
  }

  if (NOISE.test(lower)) {
    return {
      lineType: "unknown",
      descriptionRaw: text,
      quantity: null,
      unitPriceMinor: null,
      lineTotalMinor: null,
    };
  }

  if (amount === null) {
    return {
      lineType: "unknown",
      descriptionRaw: text,
      quantity: null,
      unitPriceMinor: null,
      lineTotalMinor: null,
    };
  }

  const quantityMatch = text.match(QUANTITY);
  const quantity = quantityMatch !== null ? Number(quantityMatch[1]) : null;

  return {
    lineType: "product",
    descriptionRaw: text,
    quantity,
    unitPriceMinor:
      quantity !== null && quantity > 0 ? Math.round(amount / quantity) : amount,
    lineTotalMinor: amount,
  };
}

function trailingAmount(text: string): number | null {
  const match = text.match(TRAILING_PRICE);
  if (match === null) {
    return null;
  }
  const major = match[1].replace(/,/g, "");
  return Number(major) * 100 + Number(match[2]);
}

/**
 * Classifies a whole receipt: noise lines before the first product line are
 * headers, after the last one they are footers (matches physical receipt
 * layout better than per-line heuristics).
 */
export function classifyReceiptLines(rawLines: readonly string[]): ParsedReceiptLine[] {  const parsed = rawLines.map((line) => classifyReceiptLine(line));
  const firstProduct = parsed.findIndex((line) => line.lineType === "product");
  const lastProduct =
    parsed.length - 1 - [...parsed].reverse().findIndex((line) => line.lineType === "product");

  return parsed.map((line, index) => {
    if (line.lineType !== "unknown" || !NOISE.test(line.descriptionRaw.toLowerCase())) {
      return line;
    }
    const hasProduct = firstProduct !== -1;
    const beforeProducts = !hasProduct || index < firstProduct;
    const afterProducts = hasProduct && index > lastProduct;
    return {
      ...line,
      lineType: beforeProducts ? "header" : afterProducts ? "footer" : "unknown",
    };
  });
}

/** Removes a trailing amount and quantity markers, leaving the description. */
export function stripAmountAndQuantity(text: string): string {
  return text
    .replace(TRAILING_PRICE, "")
    .replace(QUANTITY, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Normalizes descriptions for alias/product matching (case/punctuation-insensitive). */
export function normalizeDescription(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}
