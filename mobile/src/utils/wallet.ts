/**
 * Pure layout math for the active-run screen: price-sized photo stickers in a
 * fixed box, and the remaining budget as notes and coins.
 */

export interface Box {
  width: number;
  height: number;
}

export interface StickerOptions {
  gap: number;
  /** Smallest side, so the price on the sticker stays legible (>= 12px text). */
  minSide: number;
  /** Largest share of the box area one sticker may take. */
  maxShare: number;
}

export const STICKER_DEFAULTS: StickerOptions = { gap: 10, minSide: 72, maxShare: 0.45 };

/** Row-wrap packing, the same as a `flex-row flex-wrap` container with `gap`. */
export function stickersFit(sides: readonly number[], box: Box, gap: number): boolean {
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  for (const side of sides) {
    if (side > box.width) {
      return false;
    }
    if (x > 0 && x + gap + side > box.width) {
      y += rowHeight + gap;
      x = side;
      rowHeight = side;
    } else {
      x = x > 0 ? x + gap + side : side;
      rowHeight = Math.max(rowHeight, side);
    }
  }
  return y + rowHeight <= box.height;
}

/**
 * Sizes square stickers for `costs` (newest first) so area follows cost
 * (side ∝ √cost) and everything fits `box`. When even the smallest stickers
 * do not fit, the oldest are hidden and the caller shows one more `minSide`
 * sticker for "+hidden more" (already counted in the fit).
 */
export function layoutStickers(
  costs: readonly number[],
  box: Box,
  { gap, minSide, maxShare }: StickerOptions = STICKER_DEFAULTS,
): { sides: number[]; hidden: number } {
  const cap = Math.max(minSide, Math.min(box.width, box.height, Math.sqrt(maxShare * box.width * box.height)));
  const withMore = (sides: number[], hidden: number) => (hidden > 0 ? [...sides, minSide] : sides);

  let shown = costs.length;
  while (shown > 0 && !stickersFit(withMore(Array(shown).fill(minSide), costs.length - shown), box, gap)) {
    shown -= 1;
  }
  const visible = costs.slice(0, shown);
  const hidden = costs.length - shown;
  const roots = visible.map((cost) => Math.sqrt(Math.max(cost, 0)));
  const sidesAt = (k: number) => roots.map((root) => Math.min(cap, Math.max(minSide, Math.floor(k * root))));

  // Largest scale that still fits; sizes only grow with k, so bisection works.
  let low = 0;
  let high = cap / Math.max(1, Math.min(...roots.filter((root) => root > 0), cap));
  for (let i = 0; i < 40; i += 1) {
    const mid = (low + high) / 2;
    if (stickersFit(withMore(sidesAt(mid), hidden), box, gap)) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return { sides: sidesAt(low), hidden };
}

export interface Denomination {
  minor: number;
}

/** Greedy breakdown into the given denominations (largest first), grouped with a count. */
export function breakDownCash<T extends Denomination>(
  amountMinor: number,
  denominations: readonly T[],
): { piece: T; count: number }[] {
  let rest = Math.max(0, Math.round(amountMinor));
  const out: { piece: T; count: number }[] = [];
  for (const piece of denominations) {
    const count = Math.floor(rest / piece.minor);
    if (count > 0) {
      out.push({ piece, count });
      rest -= count * piece.minor;
    }
  }
  return out;
}
