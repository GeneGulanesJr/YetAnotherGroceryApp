export type Currency = string;

export interface Money {
  amountMinor: number;
  currency: Currency;
}

function parseInt10(value: string): number {
  const parsed = Number.parseInt(value || "0", 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseMoney(input: string, currency: Currency = "USD"): Money {
  const trimmed = (input ?? "").trim();
  const negative = trimmed.startsWith("-") || trimmed.startsWith("(");
  const sanitized = trimmed.replace(/[^\d.,]/g, "");

  if (!sanitized) return { amountMinor: 0, currency };

  const hasDot = sanitized.includes(".");
  const hasComma = sanitized.includes(",");

  let majorStr: string;
  let minorStr: string;

  if (hasDot && hasComma) {
    const lastDot = sanitized.lastIndexOf(".");
    const lastComma = sanitized.lastIndexOf(",");
    if (lastDot > lastComma) {
      majorStr = sanitized.slice(0, lastDot).replace(/,/g, "");
      minorStr = sanitized.slice(lastDot + 1);
    } else {
      majorStr = sanitized.slice(0, lastComma).replace(/\./g, "");
      minorStr = sanitized.slice(lastComma + 1);
    }
  } else if (hasDot) {
    const [left, right = ""] = sanitized.split(".");
    if (right.length <= 2) {
      majorStr = left;
      minorStr = right;
    } else {
      majorStr = sanitized.replace(/\./g, "");
      minorStr = "";
    }
  } else if (hasComma) {
    const [left, right = ""] = sanitized.split(",");
    if (right.length <= 2) {
      majorStr = left;
      minorStr = right;
    } else {
      majorStr = sanitized.replace(/,/g, "");
      minorStr = "";
    }
  } else {
    majorStr = sanitized;
    minorStr = "";
  }

  const major = parseInt10(majorStr);
  const minor = parseInt10(minorStr.padEnd(2, "0").slice(0, 2));
  const amountMinor = (major * 100 + minor) * (negative ? -1 : 1);

  return { amountMinor, currency };
}

export function formatMoney(money: Money, locale = "en-US"): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: money.currency,
    }).format(money.amountMinor / 100);
  } catch {
    return `${(money.amountMinor / 100).toFixed(2)} ${money.currency}`;
  }
}

/**
 * Compact currency formatting for chart axes where full values would overflow.
 * Values are still derived from integer minor units (`amountMinor / 100`).
 */
export function formatMoneyCompact(money: Money, locale = "en-US"): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: money.currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(money.amountMinor / 100);
  } catch {
    return `${(money.amountMinor / 100).toFixed(1)} ${money.currency}`;
  }
}

export function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amountMinor: a.amountMinor + b.amountMinor, currency: a.currency };
}
