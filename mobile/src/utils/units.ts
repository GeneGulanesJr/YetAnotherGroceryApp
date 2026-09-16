/**
 * Unit normalization and unit-price math per tech.mobile.md ("Monetary and
 * Quantity Storage"): compatible units must be normalized before unit-price
 * calculations, and money stays in integer minor units throughout.
 */

export type PackageUnit = "g" | "kg" | "mL" | "L" | "pcs" | "pack" | "oz" | "lb";

const OZ_IN_G = 28.349_523_125;
const LB_IN_G = 453.592_37;

export interface NormalizedMeasure {
  /** Base measure: grams for mass, millilitres for volume, pieces for count. */
  base: "g" | "mL" | "pc";
  /** Quantity expressed in the base unit. */
  value: number;
}

export function normalizeMeasure(
  size: number,
  unit: PackageUnit,
): NormalizedMeasure | null {
  if (!Number.isFinite(size) || size <= 0) {
    return null;
  }
  switch (unit) {
    case "g":
      return { base: "g", value: size };
    case "kg":
      return { base: "g", value: size * 1000 };
    case "oz":
      return { base: "g", value: size * OZ_IN_G };
    case "lb":
      return { base: "g", value: size * LB_IN_G };
    case "mL":
      return { base: "mL", value: size };
    case "L":
      return { base: "mL", value: size * 1000 };
    case "pcs":
    case "pack":
      return { base: "pc", value: size };
    default:
      return null;
  }
}

export interface UnitPrice {
  /** Price per 100 g / 100 mL, or per piece, in integer minor units. */
  minorPerDisplayUnit: number;
  /** How much of the product the price refers to (100 for g/mL, 1 for pc). */
  displayQuantity: number;
  baseUnit: "g" | "mL" | "pc";
}

/**
 * Computes the application-calculated unit price for a product given the
 * total paid (minor units), package quantity (multi-packs), and package size.
 * Returns null when the package details are unusable.
 */
export function unitPriceMinor(
  priceMinor: number,
  packageQuantity: number | null | undefined,
  packageSize: string | number | null | undefined,
  unit: PackageUnit | string | null | undefined,
): UnitPrice | null {
  if (!Number.isFinite(priceMinor) || priceMinor <= 0) {
    return null;
  }
  const size =
    typeof packageSize === "number" ? packageSize : Number.parseFloat(packageSize ?? "");
  if (unit === null || unit === undefined || !Number.isFinite(size) || size <= 0) {
    return null;
  }
  const quantity = packageQuantity && packageQuantity > 0 ? packageQuantity : 1;
  const measure = normalizeMeasure(size * quantity, unit as PackageUnit);
  if (measure === null || measure.value <= 0) {
    return null;
  }

  if (measure.base === "pc") {
    return {
      minorPerDisplayUnit: Math.round(priceMinor / measure.value),
      displayQuantity: 1,
      baseUnit: "pc",
    };
  }
  return {
    minorPerDisplayUnit: Math.round((priceMinor * 100) / measure.value),
    displayQuantity: 100,
    baseUnit: measure.base,
  };
}

/** "per 100 g" / "per L" style label for a unit price. */
export function unitPriceBaseLabel(base: "g" | "mL" | "pc"): string {
  switch (base) {
    case "g":
      return "100 g";
    case "mL":
      return "100 mL";
    case "pc":
      return "piece";
  }
}
