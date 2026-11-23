import { palettes, parseThemePreference, resolveTheme } from "./tokens";

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("theme resolution", () => {
  it("follows the system in Automatic", () => {
    expect(resolveTheme("auto", "light")).toBe("palengke");
    expect(resolveTheme("auto", null)).toBe("palengke");
    expect(resolveTheme("auto", "dark")).toBe("jadenight");
  });

  it("lets a pinned theme win over the system", () => {
    expect(resolveTheme("cream", "dark")).toBe("cream");
    expect(resolveTheme("night", "light")).toBe("night");
  });

  it("reads a stored preference, falling back to Automatic", () => {
    expect(parseThemePreference("cream")).toBe("cream");
    expect(parseThemePreference("jadenight")).toBe("jadenight");
    expect(parseThemePreference(null)).toBe("auto");
    expect(parseThemePreference("kami")).toBe("auto");
  });
});

describe.each(Object.entries(palettes))("%s palette", (_name, t) => {
  const pairs: [string, string, string][] = [];
  for (const ground of ["paper", "card", "sand"] as const) {
    for (const text of ["ink", "ink2", "ink3", "brandText", "cautionFg", "under"] as const) {
      pairs.push([`${text} on ${ground}`, t[text], t[ground]]);
    }
  }
  pairs.push(["onBrand on brand", t.onBrand, t.brand], ["cautionFg on cautionBg", t.cautionFg, t.cautionBg]);

  it.each(pairs)("%s is at least 4.5:1", (_label, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
});
