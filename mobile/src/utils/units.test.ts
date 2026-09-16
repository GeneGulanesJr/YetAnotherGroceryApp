import {
  normalizeMeasure,
  unitPriceBaseLabel,
  unitPriceMinor,
} from "./units";

describe("unit normalization", () => {
  it("normalizes mass units to grams", () => {
    expect(normalizeMeasure(1, "kg")).toEqual({ base: "g", value: 1000 });
    expect(normalizeMeasure(500, "g")).toEqual({ base: "g", value: 500 });
    expect(normalizeMeasure(16, "oz")?.base).toBe("g");
    expect(Math.round(normalizeMeasure(1, "lb")!.value)).toBe(454);
  });

  it("normalizes volume units to millilitres", () => {
    expect(normalizeMeasure(1.5, "L")).toEqual({ base: "mL", value: 1500 });
    expect(normalizeMeasure(330, "mL")).toEqual({ base: "mL", value: 330 });
  });

  it("treats pieces and packs as counts", () => {
    expect(normalizeMeasure(6, "pcs")).toEqual({ base: "pc", value: 6 });
    expect(normalizeMeasure(2, "pack")).toEqual({ base: "pc", value: 2 });
  });

  it("rejects unusable sizes", () => {
    expect(normalizeMeasure(0, "g")).toBeNull();
    expect(normalizeMeasure(-5, "L")).toBeNull();
    expect(normalizeMeasure(Number.NaN, "kg")).toBeNull();
  });
});

describe("unit price", () => {
  it("prices mass per 100 g including multi-packs", () => {
    // 6 × 500 mL packs at 12000 minor total -> per 100 mL
    const milk = unitPriceMinor(12_000, 6, "500", "mL");
    expect(milk).toEqual({ minorPerDisplayUnit: 400, displayQuantity: 100, baseUnit: "mL" });

    // 1 kg flour at 8500 -> 850 per 100 g
    const flour = unitPriceMinor(8_500, null, "1", "kg");
    expect(flour?.minorPerDisplayUnit).toBe(850);
    expect(flour?.baseUnit).toBe("g");
  });

  it("prices count-based products per piece", () => {
    const eggs = unitPriceMinor(8_900, null, 10, "pcs");
    expect(eggs).toEqual({ minorPerDisplayUnit: 890, displayQuantity: 1, baseUnit: "pc" });
    // A 6-pack priced as one package: per piece across the pack.
    const cans = unitPriceMinor(5_400, 6, 1, "pcs");
    expect(cans?.minorPerDisplayUnit).toBe(900);
  });

  it("returns null when package details are missing or invalid", () => {
    expect(unitPriceMinor(1_000, null, null, null)).toBeNull();
    expect(unitPriceMinor(1_000, null, "", "g")).toBeNull();
    expect(unitPriceMinor(0, null, "100", "g")).toBeNull();
    expect(unitPriceMinor(1_000, null, "abc", "g")).toBeNull();
  });

  it("labels base units for display", () => {
    expect(unitPriceBaseLabel("g")).toBe("100 g");
    expect(unitPriceBaseLabel("mL")).toBe("100 mL");
    expect(unitPriceBaseLabel("pc")).toBe("piece");
  });
});
