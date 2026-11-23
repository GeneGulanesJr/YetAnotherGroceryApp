import type { OcrLine } from "./priceParse";

/**
 * Item-name suggestions from a shelf-tag photo. Tags carry barcode, price and
 * the item name, so the name is the text left once prices, digit runs and tag
 * boilerplate are removed; bigger print ranks first. Suggestions only: the
 * user edits and confirms the name before anything is saved.
 */

// Prices ("₱89.50", "P 89", "89.50") and long digit runs (barcode numbers, dates).
const NOISE = /(₱|php|p\.?)\s?\d+([.,]\d{2})?|\d+[.,]\d{2}|\d[\d\s/-]{5,}\d/gi;
const BOILERPLATE =
  /\b(srp|price|php|peso|pesos|per|each|ea|save|sale|promo|only|regular|reg|was|now|net\s?wt|exp|best\s?before|sku|item\s?code|barcode|vat|inc|incl)\b/gi;
const LETTER = /[a-zà-ÿñ]/gi;

export function guessItemNames(lines: readonly OcrLine[], max = 3): string[] {
  const scored: { name: string; height: number; order: number }[] = [];
  const seen = new Set<string>();
  lines.forEach((line, order) => {
    const name = line.text.replace(NOISE, " ").replace(/\s+/g, " ").trim().replace(/^[^\p{L}\d]+|[^\p{L}\d)]+$/gu, "");
    const meaningful = name.replace(BOILERPLATE, "").match(LETTER)?.length ?? 0;
    const letters = name.match(LETTER)?.length ?? 0;
    const visible = name.replace(/\s/g, "").length;
    const key = name.toLowerCase();
    if (meaningful < 3 || letters / Math.max(visible, 1) < 0.5 || /^per\b|\//i.test(name) || seen.has(key)) {
      return;
    }
    seen.add(key);
    scored.push({ name, height: line.bbox?.height ?? 0, order });
  });
  return scored
    .sort((a, b) => b.height - a.height || a.order - b.order)
    .slice(0, max)
    .map((s) => s.name);
}
