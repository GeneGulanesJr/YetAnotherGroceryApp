import { guessItemNames } from "./nameParse";

const box = (height: number) => ({ x: 0, y: 0, width: 100, height });

describe("item name from a shelf tag", () => {
  it("keeps the name and drops price, barcode digits and boilerplate", () => {
    expect(
      guessItemNames([
        { text: "SRP" },
        { text: "NESTLE FRESH MILK 1L" },
        { text: "₱89.50" },
        { text: "4 800361 234567" },
        { text: "per 100 mL ₱8.95" },
      ]),
    ).toEqual(["NESTLE FRESH MILK 1L"]);
  });

  it("strips a price printed on the same line as the name", () => {
    expect(guessItemNames([{ text: "Bear Brand 300g ₱85.00" }])).toEqual(["Bear Brand 300g"]);
  });

  it("ranks bigger print first, then top to bottom", () => {
    const names = guessItemNames([
      { text: "Del Monte", bbox: box(20) },
      { text: "PINEAPPLE JUICE 1L", bbox: box(48) },
      { text: "Sweetened", bbox: box(20) },
    ]);
    expect(names).toEqual(["PINEAPPLE JUICE 1L", "Del Monte", "Sweetened"]);
  });

  it("returns nothing for a tag with no readable name", () => {
    expect(guessItemNames([{ text: "₱12.50" }, { text: "12/11/26" }, { text: "PHP" }])).toEqual([]);
  });
});
