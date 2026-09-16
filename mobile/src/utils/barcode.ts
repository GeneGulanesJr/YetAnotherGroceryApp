/**
 * Barcode normalization per tech.mobile.md: scans must be normalized before
 * local lookup and storage. UPC-E expands to its UPC-A equivalent, and
 * UPC-A / EAN-13 (leading zero) aliases are tried on lookup so the same
 * physical product matches regardless of which symbology the scanner read.
 */

export type ScannedFormat = "ean-13" | "ean-8" | "upc-a" | "upc-e" | "qr" | "unknown";

/** Barcode formats expo-camera will be configured to scan. */
export const SCAN_BARCODE_TYPES = ["ean13", "ean8", "upc_a", "upc_e", "qr"] as const;

export function digitsOnly(raw: string): string {
  return (raw ?? "").replace(/\D/g, "");
}

/** GTIN-style check digit validation (EAN-8/UPC-A/EAN-13). */
export function isValidCheckDigit(code: string): boolean {
  if (code.length < 8) {
    return false;
  }
  let sum = 0;
  for (let i = code.length - 2, weight = 3; i >= 0; i--, weight = weight === 3 ? 1 : 3) {
    sum += Number(code[i]) * weight;
  }
  const check = (10 - (sum % 10)) % 10;
  return check === Number(code[code.length - 1]);
}

export function isValidEan13(code: string): boolean {
  return code.length === 13 && isValidCheckDigit(code);
}

export function isValidEan8(code: string): boolean {
  return code.length === 8 && isValidCheckDigit(code);
}

export function isValidUpcA(code: string): boolean {
  return code.length === 12 && isValidCheckDigit(code);
}

/**
 * Expands a UPC-E code to its 12-digit UPC-A equivalent.
 * Accepts 6 digits (check recomputed), 7 (data + check), or 8
 * (number system 0 + data + check). Returns null for other lengths.
 */
export function expandUpcE(code: string): string | null {
  const digits = digitsOnly(code);
  let data: string;
  if (digits.length === 8) {
    if (digits[0] !== "0") {
      return null;
    }
    data = digits.slice(1, 7);
  } else if (digits.length === 7) {
    data = digits.slice(0, 6);
  } else if (digits.length === 6) {
    data = digits;
  } else {
    return null;
  }

  const [d1, d2, d3, d4, d5, d6] = data.split("");
  const last = Number(d6);
  // Number system digit 0 is implicit in UPC-E and restored in the UPC-A form.
  let upcA11: string;
  if (last <= 2) {
    upcA11 = `0${d1}${d2}${d6}0000${d3}${d4}${d5}`;
  } else if (last === 3) {
    upcA11 = `0${d1}${d2}${d3}00000${d4}${d5}`;
  } else if (last === 4) {
    upcA11 = `0${d1}${d2}${d3}${d4}00000${d5}`;
  } else {
    upcA11 = `0${d1}${d2}${d3}${d4}${d5}0000${d6}`;
  }

  // Compute the check digit of the expanded form.
  let sum = 0;
  for (let i = 0, weight = 3; i < 11; i++, weight = weight === 3 ? 1 : 3) {
    sum += Number(upcA11[i]) * weight;
  }
  const check = (10 - (sum % 10)) % 10;
  return `${upcA11}${check}`;
}

export function isProbablyBarcode(raw: string): boolean {
  const digits = digitsOnly(raw);
  return (
    isValidEan13(digits) || isValidEan8(digits) || isValidUpcA(digits) ||
    (digits.length >= 6 && digits.length <= 14)
  );
}

/** Canonical storage form. QR payloads are stored verbatim. */
export function normalizeBarcode(raw: string, format: ScannedFormat): string {
  if (format === "qr") {
    return raw.trim();
  }
  const digits = digitsOnly(raw);
  if (format === "upc-e") {
    return expandUpcE(digits) ?? digits;
  }
  return digits;
}

/** Map expo-camera's barcode type strings to our format names. */
export function formatFromCameraType(type: string): ScannedFormat {
  switch (type) {
    case "ean13":
      return "ean-13";
    case "ean8":
      return "ean-8";
    case "upc_a":
      return "upc-a";
    case "upc_e":
      return "upc-e";
    case "qr":
      return "qr";
    default:
      return "unknown";
  }
}

/**
 * All keys worth trying when resolving a scan against the local database:
 * the normalized form, its EAN-13 (zero-padded) alias, its UPC-A (stripped)
 * alias, and the UPC-E expansion.
 */
export function barcodeLookupKeys(raw: string, format: ScannedFormat): string[] {
  const normalized = normalizeBarcode(raw, format);
  const keys = new Set<string>([normalized]);

  if (format !== "qr") {
    if (normalized.length === 12) {
      keys.add(`0${normalized}`);
    } else if (normalized.length === 13 && normalized.startsWith("0")) {
      keys.add(normalized.slice(1));
    }
    if (format === "upc-e") {
      const digits = digitsOnly(raw);
      keys.add(digits);
      keys.add(digits.length === 8 ? digits.slice(1) : digits);
    }
  }

  return [...keys].filter((key) => key.length > 0);
}
