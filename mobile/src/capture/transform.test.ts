import {
  boxContains,
  containTransform,
  coverTransform,
  projectBox,
  unprojectPoint,
} from "./transform";

describe("coordinate transforms", () => {
  const image = { width: 4000, height: 3000 };
  const container = { width: 400, height: 400 };

  it("contain letterboxes and centers a wide image", () => {
    const t = containTransform(image, container);
    expect(t.scale).toBeCloseTo(400 / 4000); // 0.1, height-driven? no: width-driven
    // scale = min(400/4000, 400/3000) = 0.1
    expect(t.scale).toBe(0.1);
    expect(t.offsetX).toBe(0);
    expect(t.offsetY).toBeCloseTo(50); // (400 - 3000*0.1) / 2
  });

  it("cover fills the container and crops", () => {
    const t = coverTransform(image, container);
    expect(t.scale).toBeCloseTo(400 / 3000); // max, height-driven
    expect(t.offsetY).toBe(0);
    expect(t.offsetX).toBeCloseTo(-66.667, 2); // (400 - 4000 * 0.1333) / 2
  });

  it("round-trips box projection through a tap point", () => {
    const t = containTransform(image, container);
    const box = { x: 1200, y: 900, width: 800, height: 150 };
    const view = projectBox(box, t);
    expect(view.x).toBeCloseTo(120);
    expect(view.y).toBeCloseTo(140); // 900*0.1 + 50
    expect(view.width).toBeCloseTo(80);

    const tap = unprojectPoint({ x: view.x + 1, y: view.y + 1 }, t);
    expect(boxContains(box, tap)).toBe(true);
    expect(boxContains(box, unprojectPoint({ x: 0, y: 0 }, t))).toBe(false);
  });

  it("degrades to zero scale for degenerate frames", () => {
    const t = containTransform({ width: 0, height: 0 }, container);
    expect(Number.isFinite(t.scale)).toBe(true);
    expect(t.scale).toBe(0);
  });
});
