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
  /** Cutouts have no background to waste, so their area can go below `minSide`². */
  cutoutMinSide: number;
  /** Smallest shaped sticker that still holds a price strip and some of the item. */
  minWidth: number;
  minHeight: number;
  /** Width / height limits, so extreme items do not become slivers. */
  minAspect: number;
  maxAspect: number;
}

export const STICKER_DEFAULTS: StickerOptions = {
  gap: 10,
  minSide: 72,
  maxShare: 0.45,
  cutoutMinSide: 60,
  minWidth: 56,
  minHeight: 56,
  minAspect: 0.62,
  maxAspect: 1.6,
};

export interface StickerItem {
  cost: number;
  /** Width / height of the cutout. Omitted for a square full-photo sticker. */
  aspect?: number;
  /** Width the price label needs, when wider than `minWidth`. */
  minWidth?: number;
}

export interface StickerSize {
  width: number;
  height: number;
}

export interface StickerRect extends StickerSize {
  x: number;
  y: number;
}

/** Row-wrap packing with rows bottom-aligned, like `flex-row flex-wrap items-end` with `gap`. */
function packRows(sizes: readonly StickerSize[], width: number, gap: number): { rects: StickerRect[]; height: number } {
  const rects: StickerRect[] = [];
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  let rowStart = 0;
  const closeRow = (end: number) => {
    for (let i = rowStart; i < end; i += 1) {
      rects[i].y = y + rowHeight - rects[i].height;
    }
  };
  sizes.forEach((size, i) => {
    if (x > 0 && x + gap + size.width > width) {
      closeRow(i);
      y += rowHeight + gap;
      x = 0;
      rowHeight = 0;
      rowStart = i;
    }
    const left = x > 0 ? x + gap : 0;
    rects.push({ x: left, y, ...size });
    x = left + size.width;
    rowHeight = Math.max(rowHeight, size.height);
  });
  closeRow(sizes.length);
  return { rects, height: y + rowHeight };
}

export function stickersFit(sizes: readonly StickerSize[], box: Box, gap: number): boolean {
  return sizes.every((size) => size.width <= box.width) && packRows(sizes, box.width, gap).height <= box.height;
}

/**
 * Sizes stickers for `items` (newest first) so area follows cost and everything
 * fits `box`. Cutouts take the item's shape; other lines stay square. When even
 * the smallest stickers do not fit, the oldest are hidden and `more` is the
 * `minSide` sticker for "+hidden more" (already counted in the fit).
 */
export function layoutStickers(
  items: readonly StickerItem[],
  box: Box,
  options: StickerOptions = STICKER_DEFAULTS,
): { stickers: StickerRect[]; more: StickerRect | null; hidden: number } {
  const { gap, minSide, maxShare, cutoutMinSide, minWidth, minHeight, minAspect, maxAspect } = options;
  const cap = Math.max(minSide, Math.min(box.width, box.height, Math.sqrt(maxShare * box.width * box.height)));
  const withMore = (sizes: StickerSize[], hidden: number) =>
    hidden > 0 ? [...sizes, { width: minSide, height: minSide }] : sizes;

  const sizeAt = (item: StickerItem, k: number): StickerSize => {
    const scaled = Math.floor(k * Math.sqrt(Math.max(item.cost, 0)));
    const aspect = item.aspect ?? 0;
    if (!(aspect > 0)) {
      const side = Math.min(cap, Math.max(minSide, scaled));
      return { width: side, height: side };
    }
    const stretch = Math.sqrt(Math.min(maxAspect, Math.max(minAspect, aspect)));
    const side = Math.min(cap, box.width / stretch, box.height * stretch, Math.max(cutoutMinSide, scaled));
    const grow = Math.max(1, (item.minWidth ?? minWidth) / (side * stretch), (minHeight * stretch) / side);
    return { width: Math.round(side * stretch * grow), height: Math.round((side / stretch) * grow) };
  };

  const smallest = items.map((item) => sizeAt(item, 0));
  let shown = items.length;
  while (shown > 0 && !stickersFit(withMore(smallest.slice(0, shown), items.length - shown), box, gap)) {
    shown -= 1;
  }
  const visible = items.slice(0, shown);
  const hidden = items.length - shown;
  const roots = visible.map((item) => Math.sqrt(Math.max(item.cost, 0)));

  // Largest scale found that still fits; k = 0 always does, so this never overflows.
  let low = 0;
  let high = cap / Math.max(1, Math.min(...roots.filter((root) => root > 0), cap));
  for (let i = 0; i < 40; i += 1) {
    const mid = (low + high) / 2;
    if (stickersFit(withMore(visible.map((item) => sizeAt(item, mid)), hidden), box, gap)) {
      low = mid;
    } else {
      high = mid;
    }
  }
  const { rects } = packRows(withMore(visible.map((item) => sizeAt(item, low)), hidden), box.width, gap);
  const last = rects[shown];
  return {
    stickers: rects.slice(0, shown),
    // Only a box smaller than one sticker needs this clamp.
    more:
      hidden > 0
        ? {
            ...last,
            width: Math.max(0, Math.min(last.width, box.width - last.x)),
            height: Math.max(0, Math.min(last.height, box.height - last.y)),
          }
        : null,
    hidden,
  };
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
