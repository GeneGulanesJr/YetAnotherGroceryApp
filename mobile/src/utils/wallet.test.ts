import { breakDownCash, layoutStickers, STICKER_DEFAULTS, stickersFit } from "./wallet";

const box = { width: 320, height: 220 };
const { gap, minSide, maxShare } = STICKER_DEFAULTS;

const squares = (costs: number[]) => costs.map((cost) => ({ cost }));
const side = (rect: { width: number }) => rect.width;
const inBox = (r: { x: number; y: number; width: number; height: number }) =>
  r.x >= 0 && r.y >= 0 && r.x + r.width <= box.width && r.y + r.height <= box.height;

describe("layoutStickers", () => {
  it("gives area proportional to cost and fits the box", () => {
    const { stickers, hidden } = layoutStickers(squares([28_500, 12_900, 8_950]), box);
    const sides = stickers.map(side);
    expect(hidden).toBe(0);
    expect(stickersFit(stickers, box, gap)).toBe(true);
    // Unclamped stickers: side² ratio matches the cost ratio (floor rounding aside).
    expect(sides[1] ** 2 / sides[0] ** 2).toBeCloseTo(12_900 / 28_500, 1);
    expect(sides[2] ** 2 / sides[0] ** 2).toBeCloseTo(8_950 / 28_500, 1);
  });

  it("caps one line at the max share of the box", () => {
    const { stickers } = layoutStickers(squares([50_000]), box);
    expect(stickers[0].width ** 2).toBeLessThanOrEqual(maxShare * box.width * box.height);
  });

  it("keeps cheap items at the legible minimum next to an expensive one", () => {
    const { stickers } = layoutStickers(squares([500_000, 100, 100]), box);
    expect(stickers[1].width).toBe(minSide);
    expect(stickers[2].width).toBe(minSide);
    expect(stickersFit(stickers, box, gap)).toBe(true);
  });

  it("shrinks instead of growing, then hides the oldest behind a +more sticker", () => {
    const many = Array.from({ length: 40 }, (_, i) => 1_000 + i * 100);
    const { stickers, more, hidden } = layoutStickers(squares(many), box);
    expect(hidden).toBeGreaterThan(0);
    expect(stickers).toHaveLength(40 - hidden);
    expect(stickers.every((rect) => rect.width >= minSide && rect.height === rect.width)).toBe(true);
    expect(more).toMatchObject({ width: minSide, height: minSide });
    expect(stickersFit([...stickers, more!], box, gap)).toBe(true);
  });

  it("handles an empty cart and a box too small for one sticker", () => {
    expect(layoutStickers([], box)).toEqual({ stickers: [], more: null, hidden: 0 });
    const tiny = { width: 50, height: 50 };
    const { stickers, more, hidden } = layoutStickers(squares([100, 200]), tiny);
    expect(stickers).toEqual([]);
    expect(hidden).toBe(2);
    expect(more).toEqual({ x: 0, y: 0, width: 50, height: 50 });
  });

  it("places squares like the flex-wrap row it replaces, bottom-aligned", () => {
    const { stickers } = layoutStickers(squares([40_000, 10_000, 10_000]), { width: 500, height: 200 });
    expect(stickers[1].x).toBe(stickers[0].width + gap);
    expect(stickers[1].y + stickers[1].height).toBe(stickers[0].y + stickers[0].height);
  });
});

describe("layoutStickers with cutouts", () => {
  const many = (aspect: number) => Array.from({ length: 40 }, () => ({ cost: 5_000, aspect }));
  const squareCount = layoutStickers(squares(Array(40).fill(5_000)), box).stickers.length;

  it.each([["tall", 0.5], ["wide", 2], ["round", 1]])("fits more %s items than square stickers", (_, aspect) => {
    const { stickers, more } = layoutStickers(many(aspect as number), box);
    expect(stickers.length).toBeGreaterThan(squareCount);
    expect([...stickers, more!].every(inBox)).toBe(true);
  });

  it("shapes the sticker to the item and keeps area following cost", () => {
    const { stickers } = layoutStickers(
      [{ cost: 40_000, aspect: 0.7 }, { cost: 10_000, aspect: 1.4 }],
      { width: 400, height: 400 },
    );
    expect(stickers[0].height).toBeGreaterThan(stickers[0].width);
    expect(stickers[1].width).toBeGreaterThan(stickers[1].height);
    const ratio = (stickers[1].width * stickers[1].height) / (stickers[0].width * stickers[0].height);
    expect(ratio).toBeCloseTo(0.25, 1);
  });

  it("clamps extreme shapes", () => {
    const { stickers } = layoutStickers([{ cost: 9_000, aspect: 0.05 }, { cost: 9_000, aspect: 20 }], { width: 400, height: 400 });
    expect(stickers[0].width / stickers[0].height).toBeCloseTo(STICKER_DEFAULTS.minAspect, 1);
    expect(stickers[1].width / stickers[1].height).toBeCloseTo(STICKER_DEFAULTS.maxAspect, 1);
  });

  it("widens a narrow sticker for a long price", () => {
    const { stickers } = layoutStickers(many(0.5).slice(0, 12).map((item) => ({ ...item, minWidth: 90 })), box);
    expect(stickers.every((rect) => rect.width >= 90)).toBe(true);
  });

  it("never overflows and hides only the oldest in a mixed cart", () => {
    const aspects = [undefined, 0.5, 2, 1, 0.7, 1.5];
    for (let n = 1; n <= 60; n += 1) {
      const items = Array.from({ length: n }, (_, i) => ({ cost: 500 + (i * 137) % 9_000, aspect: aspects[i % aspects.length] }));
      const { stickers, more, hidden } = layoutStickers(items, box);
      expect(stickers.length + hidden).toBe(n);
      expect([...stickers, ...(more === null ? [] : [more])].every(inBox)).toBe(true);
      expect(more === null).toBe(hidden === 0);
    }
  });

  it("treats a bad aspect as a square full-photo sticker", () => {
    const { stickers } = layoutStickers([{ cost: 100, aspect: Number.NaN }], box);
    expect(stickers[0].width).toBe(stickers[0].height);
    expect(stickers[0].width).toBeGreaterThanOrEqual(minSide);
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
