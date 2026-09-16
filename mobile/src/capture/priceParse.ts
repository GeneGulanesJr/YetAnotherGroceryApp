/**
 * Parses OCR lines from a shelf-tag photo into price candidates.
 * Everything is integer minor units; confidence reflects how explicit the
 * currency marking and the decimal shape are (spec: OCR values are always
 * candidates, never saved without user confirmation).
 */

import type { Box } from "./transform";

export interface OcrLine {
  text: string;
  bbox?: Box;
}

export interface PriceCandidate {
  minor: number;
  raw: string;
  /** Canonical decimal form, e.g. "123.45". */
  normalized: string;
  confidence: number;
  bbox?: Box;
  /** True for "per 100 g" style unit-price lines. */
  unitPrice: boolean;
}

const CURRENCY_MARKERS = ["₱", "php", "p.", "p$", "$", "€", "£"] as const;

/** Common OCR confusions inside otherwise-numeric tokens. */
function deconfuse(text: string): string {
  return text
    .replace(/[Oo]/g, "0")
    .replace(/[lI|]/g, "1")
    .replace(/[Ss]/g, "5");
}

function toMinor(major: number, minor: string): number {
  return Math.round(major * 100) + Number(minor.padEnd(2, "0").slice(0, 2));
}

/**
 * Extracts price candidates from OCR lines, best-first.
 * Handles currency-marked decimals ("₱123.45"), bare decimals ("123.45"),
 * comma decimals, and marked integers ("P 89"), plus per-unit annotations.
 */
export function parsePriceCandidates(lines: readonly OcrLine[]): PriceCandidate[] {
  const candidates: PriceCandidate[] = [];

  for (const line of lines) {
    const rawText = line.text.trim();
    if (rawText === "") {
      continue;
    }
    const unitPrice = /per\s|\/\s?(100\s?g|100\s?ml|kg|l\b|pc|piece|each)/i.test(rawText);

    // Try the line as-is first (keeps currency context), then de-confused.
    for (const [text, confusionFixed] of [
      [rawText, false],
      [deconfuse(rawText), true],
    ] as const) {
      const lower = text.toLowerCase();
      const marked = CURRENCY_MARKERS.some((marker) => lower.includes(marker));

      // Decimal with explicit marker: ₱123.45 / 123,45€ / P 89.00
      // Lookaround keeps over-long digit runs ("999999999.99") from
      // matching a suffix like "99999.99".
      const decimal = text.match(/(?<!\d)(\d{1,5})[.,](\d{2})(?!\d)/g);
      if (decimal !== null) {
        for (const match of decimal) {
          const [major, minor] = match.split(/[.,]/);
          const value = toMinor(Number(major), minor);
          if (!Number.isFinite(value) || value <= 0 || value > 100_000_000) {
            continue;
          }
          const confidence =
            (marked ? 0.9 : 0.6) - (confusionFixed ? 0.1 : 0) - (unitPrice ? 0.15 : 0);
          candidates.push({
            minor: value,
            raw: rawText,
            normalized: `${major}.${minor}`,
            confidence,
            bbox: line.bbox,
            unitPrice,
          });
        }
        break;
      }

      // Marked integer price: "P89" / "₱ 89"
      const markedInteger = text.match(/(?:₱|php|p\.?)\s?(\d{2,5})\b/i);
      if (markedInteger !== null) {
        const value = Number(markedInteger[1]) * 100;
        if (value > 0 && value <= 100_000_000) {
          candidates.push({
            minor: value,
            raw: rawText,
            normalized: `${markedInteger[1]}.00`,
            confidence: 0.75 - (confusionFixed ? 0.1 : 0) - (unitPrice ? 0.15 : 0),
            bbox: line.bbox,
            unitPrice,
          });
          break;
        }
      }
    }
  }

  return candidates.sort((a, b) => b.confidence - a.confidence);
}

/** Picks the best shelf-price candidate, preferring non-unit prices. */
export function bestShelfPrice(
  lines: readonly OcrLine[],
): PriceCandidate | null {
  const ranked = parsePriceCandidates(lines);
  return ranked.find((c) => !c.unitPrice) ?? ranked[0] ?? null;
}
