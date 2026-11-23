import { breakDownCash, layoutStickers, STICKER_DEFAULTS, stickersFit } from "./wallet";

const box = { width: 320, height: 220 };
const { gap, minSide, maxShare } = STICKER_DEFAULTS;

describe("layoutStickers", () => {
  it("gives area proportional to cost and fits the box", () => {
    const { sides, hidden } = layoutStickers([28_500, 12_900, 8_950], box);
    expect(hidden).toBe(0);
    expect(stickersFit(sides, box, gap)).toBe(true);
    // Unclamped stickers: side² ratio matches the cost ratio (floor rounding aside).
    expect(sides[1] ** 2 / sides[0] ** 2).toBeCloseTo(12_900 / 28_500, 1);
    expect(sides[2] ** 2 / sides[0] ** 2).toBeCloseTo(8_950 / 28_500, 1);
  });

  it("caps one line at the max share of the box", () => {
    const { sides } = layoutStickers([50_000], box);
    expect(sides[0] ** 2).toBeLessThanOrEqual(maxShare * box.width * box.height);
  });

  it("keeps cheap items at the legible minimum next to an expensive one", () => {
    const { sides } = layoutStickers([500_000, 100, 100], box);
    expect(sides[1]).toBe(minSide);
    expect(sides[2]).toBe(minSide);
    expect(stickersFit(sides, box, gap)).toBe(true);
  });

  it("shrinks instead of growing, then hides the oldest behind a +more sticker", () => {
    const many = Array.from({ length: 40 }, (_, i) => 1_000 + i * 100);
    const { sides, hidden } = layoutStickers(many, box);
    expect(hidden).toBeGreaterThan(0);
    expect(sides).toHaveLength(40 - hidden);
    expect(sides.every((side) => side >= minSide)).toBe(true);
    expect(stickersFit([...sides, minSide], box, gap)).toBe(true);
  });

  it("handles an empty cart and a box too small for one sticker", () => {
    expect(layoutStickers([], box)).toEqual({ sides: [], hidden: 0 });
    expect(layoutStickers([100, 200], { width: 50, height: 50 })).toEqual({ sides: [], hidden: 2 });
  });
});

describe("breakDownCash", () => {
  const pesos = [{ minor: 100_000 }, { minor: 50_000 }, { minor: 2_000 }, { minor: 100 }, { minor: 25 }, { minor: 1 }];

  it("breaks greedily and groups by denomination", () => {
    expect(breakDownCash(254_227, pesos).map(({ piece, count }) => [piece.minor, count])).toEqual([
      [100_000, 2],
      [50_000, 1],
      [2_000, 2],
      [100, 2],
      [25, 1],
      [1, 2],
    ]);
  });

  it("returns nothing for zero or negative amounts", () => {
    expect(breakDownCash(0, pesos)).toEqual([]);
    expect(breakDownCash(-500, pesos)).toEqual([]);
  });
});
