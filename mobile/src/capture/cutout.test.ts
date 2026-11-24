import type { CutoutSubject } from "../../modules/item-cutout";
import { pickSubject } from "./cutout";

const image = { width: 1000, height: 1000 };

function subject(x: number, y: number, width: number, height: number, fill = 0.8): CutoutSubject {
  return { uri: `file:///${x}-${y}.png`, x, y, width, height, pixels: width * height * fill, fileWidth: width, fileHeight: height };
}

const priceLine = (x: number, y: number, width = 160, height = 50) => ({ text: "₱89.50", bbox: { x, y, width, height } });

describe("pickSubject", () => {
  it("picks the largest product", () => {
    const bottle = subject(300, 100, 300, 700);
    expect(pickSubject([subject(50, 50, 200, 200), bottle], image, [])).toBe(bottle);
  });

  it("rejects the price tag and keeps the product", () => {
    const product = subject(200, 50, 400, 600);
    const tag = subject(300, 720, 240, 120, 1);
    expect(pickSubject([tag, product], image, [priceLine(330, 750)])).toBe(product);
  });

  it("rejects a tag even when it is the larger subject", () => {
    const tag = subject(200, 300, 600, 300, 1);
    const speck = subject(10, 10, 60, 60);
    expect(pickSubject([tag, speck], image, [priceLine(300, 380, 400, 120)])).toBeNull();
  });

  it("keeps a product wearing a small price sticker", () => {
    const product = subject(200, 100, 500, 800);
    expect(pickSubject([product], image, [priceLine(300, 200, 100, 40)])).toBe(product);
  });

  it("returns null when only a tag is found", () => {
    expect(pickSubject([subject(300, 400, 300, 150, 1)], image, [priceLine(320, 420, 240, 90)])).toBeNull();
  });

  it("returns null with several equally likely products", () => {
    expect(pickSubject([subject(50, 100, 300, 600), subject(500, 100, 290, 600)], image, [])).toBeNull();
  });

  it("returns null for no subject, a speck, or the whole scene", () => {
    expect(pickSubject([], image, [])).toBeNull();
    expect(pickSubject([subject(10, 10, 50, 50)], image, [])).toBeNull();
    expect(pickSubject([subject(0, 0, 1000, 1000, 0.95)], image, [])).toBeNull();
    expect(pickSubject([subject(0, 0, 1000, 1000, 0.6)], image, [])).toBeNull();
  });

  it("accepts an item touching one photo edge", () => {
    const cropped = subject(0, 200, 500, 600);
    expect(pickSubject([cropped], image, [])).toBe(cropped);
  });
});
