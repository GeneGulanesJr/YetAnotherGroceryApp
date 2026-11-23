# yaga logo: colour and background research (money + grocery)

Date: 2026-11-23. Research and report only: no logos were drawn and no other files were edited. Builds on `ph-color-research.md` (cited below as "PH report"), whose brand hexes and sources are reused.

**Method.** New brand hexes were sampled by me on 2026-11-23 from each brand's own favicon or logo file (script `mg_sample.py`), or read from the fill colours of the brand's logo SVG on Wikimedia Commons / Wikipedia. Commons SVGs are community redraws, so treat those as close but not official. ΔE00 is CIEDE2000; my implementation (`mg_lib.py`) passes the Sharma–Wu–Dalal 2005 test pairs 1, 7, 17 and 25 to 0.001. WCAG contrast uses the 2.x relative-luminance formula. All numbers come from `mg_palettes.py` and `mg_busy.py` in the base path (`python3 -I`). Thresholds used: ΔE00 < 10 = likely collision, 10–20 = close, > 20 = clear. Text ≥ 4.5:1, graphics and large text ≥ 3:1.

**One structural point that drives everything below.** In the die-cut sticker, the letters never touch the ground. The letters (ink) sit on the sticker edge, and the edge is wrapped in the ink outline and hard shadow, which are what touch the ground. So:

- legibility under glare = **ink on edge** (the letters against the sticker);
- the silhouette = **outline on ground** (ink on ground);
- edge on ground does not need 3:1, because the outline already provides the boundary (WCAG 1.4.11 asks for one adjacent boundary at 3:1, and the outline is it). The approved d2 runs white edge on pink at only 1.27:1 and reads fine for exactly this reason.

That is why a mid-tone colour field is possible at all (direction B), and why light grounds still give the strongest glare result.

---

## 1. Which colours signal "money" and which signal "groceries"

### 1.1 Examples (hexes sampled unless marked)

| Brand (category) | Colours | Hex | What the combination signals |
|---|---|---|---|
| **Wise** (money transfer) | lime + forest green | icon #86EA5B / #083400 (sampled); third-party lists give #9FE870 / #163300 | "Modern money, not a bank". Wise's 2023 rebrand was literally "Goodbye blue, hello green", to be "deliberately different" from fintech blue ([Wise blog](https://wise.com/gb/blog/a-brand-for-everywhere-wise-unveils-bold-new-look), [B&T](https://www.bandt.com.au/?p=1449454)) |
| **Robinhood** (investing) | neon lime + black | #CCFF00 + #000000 (favicon) | Same lime-and-black fintech code, pushed to neon |
| **Cash App** (payments) | bright green + white | #00D632 (third-party only: [brandpalettes](https://brandpalettes.com/cash-app-colors/), [designpieces](https://www.designpieces.com/palette/block-color-palette-hex-and-rgb/)) | Classic "green = cash" (US greenback) |
| **YNAB** (budgeting) | blurple | #545BFE (icon) | Budgeting brands have left green: calm, "planner", not cash |
| **Monarch Money** (budgeting) | orange | #F5640F (icon) | Warm and friendly, not cash |
| **Rocket Money** (budgeting) | crimson-magenta | ~#B8295A (icon) | Same: no money hue |
| **Monzo** (bank) | coral + lime + teal + blue | #FF4F40, #BBF42E, #48D3B2, #0088A6 (favicon) | Playful multi-colour "card" stripes; the coral is the one people remember |
| **Instacart** (grocery) | leaf green + carrot orange | #09AC09 + #FF7008 (favicon) | Produce. Its own words: a palette "grounded in food… 'Kale' green to 'Turmeric' yellow to 'Guava' pink… a nod to our grocery roots" ([Instacart, 22 Mar 2022](https://company.instacart.com/updates/carrot-evolution-a-new-brand-identity)) |
| **Whole Foods** (grocery) | leaf green | #7BBB43 (favicon) | Fresh, natural |
| **Weee!** (Asian grocery, US) | sky blue | #009DCF (icon) | Grocery does not have to be green |
| **Grab / GrabMart** (PH delivery) | green | #00B14F | PH report §1 |
| **Puregold** (PH grocery) | very dark green + gold | #052C24 + #8C6414 (Commons SVG; matches the PH report's ~#01281F + ~#8D640C) | "Supermarket + value" in PH |
| **Robinsons Supermarket** (PH grocery) | **red** + green apple | #DB1E04 (logo), #EC1B24 + #73B744 (favicon) | New finding: the logo is mainly red, with green only in the apple. The PH report listed it as green |
| **Landbank** (PH bank) | green + gold | #1CB14D + #FDC14F (Commons SVG); favicon #71BE43 | "Government bank, farmers" |
| **BDO** (largest PH bank) | navy + golden yellow | #0B2972 + #FFB20C (Commons SVG) | Bank and trust, with a gold accent |
| **Mercury Drug** (PH pharmacy) | red + near-black | #EE1C25 + #2B2728 (Wikipedia SVG); site logo #DE0020 | Pharmacy red |
| **WalterMart** (PH grocery) | red + blue | #DD214E + #1B80C3 (icon) | — |
| **Alfamart PH** (convenience) | blue | #1756C2 (favicon) | — |
| **GoTyme** (PH digital bank) | cyan + charcoal | #00F4F9 + #2C2D39 (favicon) | — |

### 1.2 What signals what

- **Money, globally.** Green, from the US greenback, is still the code for cash and P2P apps (Cash App, Robinhood). The current code for "modern money" is **lime + very dark green or black** (Wise, Robinhood). Budgeting apps specifically have moved away from green (YNAB blurple, Monarch orange, Rocket Money crimson), so green is not needed to say "budget".
- **Money, in the Philippines.** Peso money is **not green-coded**. Every note is a different colour (polymer series: ₱50 red, ₱100 violet, ₱500 yellow, ₱1000 blue, per [Wikipedia](https://en.wikipedia.org/wiki/First_Philippine_Polymer_Banknote_Series)), and the coins are mostly silver. All NGC coins are nickel-plated steel except the ₱20, which has a "bronze-plated steel outer ring" ([Wikipedia NGC](https://en.wikipedia.org/wiki/New_Generation_Currency_Series)). The PH report already found "green = money" weakly supported locally. **Inference:** in the PH the strongest money cues are *forms*, not a hue: the ₱ sign, coin rims, banknote line work (guilloche) and receipt paper. The approved wordmark already carries the coin, receipt and tag forms, so its palette has to support them, not carry them alone.
- **Groceries / fresh food.** Leaf green (Instacart, Whole Foods, Grab), often paired with a produce warm (Instacart's carrot orange). In the PH, supermarket identity is spread out: green + gold (Puregold), red (Robinsons, WalterMart), blue (SM, Alfamart). **Green is the one hue that says both money and groceries globally**, which is why the brief keeps coming back to it. In the PH it is also the most crowded hue.
- **Gold / brass** says "coin / value / premium" (BDO, Landbank and Puregold all use it as an accent). **Cream / paper** says receipt, banknote paper and the sari-sari supot, and no PH brand owns it (PH report §2).

---

## 2. Can green + gold or green + cream avoid PH collisions?

### 2.1 ΔE00 grid (rows = PH brands, columns = candidate colours)

"g" = the untested drafts `g-*.png` (ground #0F4D3A, ink #0B2A20, gold #F2B705). A, B and C are the directions in §4.

| PH brand | g ground #0F4D3A | g ink #0B2A20 | g gold #F2B705 | A ink #0F4D3A | A brass #C8963E | B jade #1E8F86 | C lime #E3F08A | cream #FAF3E1 |
|---|---|---|---|---|---|---|---|---|
| Grab #00B14F | 37.2 | 46.9 | 38.9 | 37.2 | 36.7 | 22.7 | 26.8 | 34.5 |
| Maya #2FF29E | 54.1 | 73.3 | 40.5 | 54.1 | 41.7 | 30.4 | 21.8 | 27.8 |
| **Puregold green #052C24** | **11.1** | **1.8** | 69.2 | 11.1 | 53.6 | 32.6 | 77.5 | 77.4 |
| Puregold gold #8C6414 | 34.0 | 36.8 | 29.3 | 34.0 | 18.9 | 37.1 | 41.2 | 42.7 |
| Robinsons apple #73B744 | 43.2 | 52.3 | 30.8 | 43.2 | 29.7 | 27.9 | 19.2 | 29.9 |
| GCash #007CFF | 44.1 | 46.7 | 65.5 | 44.1 | 56.5 | 34.4 | 69.7 | 49.3 |
| BDO navy #0B2972 | 35.4 | 30.9 | 81.6 | 35.4 | 65.6 | 43.6 | 90.4 | 77.3 |
| **BDO gold #FFB20C** | 60.6 | 70.1 | **4.8** | 60.6 | 12.0 | 46.4 | 25.8 | 26.9 |
| Landbank green #1CB14D | 37.4 | 47.1 | 38.4 | 37.4 | 36.1 | 23.1 | 26.3 | 34.2 |
| **Landbank gold #FDC14F** | 60.2 | 73.1 | **5.1** | 60.2 | 12.5 | 44.6 | 21.0 | 22.9 |
| Landbank favicon #71BE43 | 45.6 | 54.9 | 31.4 | 45.6 | 30.9 | 29.0 | 18.5 | 29.7 |
| SM Markets #0030FF | 42.7 | 41.5 | 80.3 | 42.7 | 68.2 | 42.7 | 89.3 | 65.0 |
| Mercury Drug #EE1C25 | 59.5 | 56.0 | 45.1 | 59.5 | 34.9 | 59.2 | 61.7 | 46.2 |
| 7-Eleven green #147350 | 12.9 | 24.1 | 47.5 | 12.9 | 40.3 | 14.8 | 44.0 | 46.9 |
| PH flag / LP yellow #FCD116 | 61.5 | 77.3 | **7.4** | 61.5 | 18.1 | 45.5 | 16.9 | 24.9 |

(Savemore is not in the grid: its site still redirects to an ad stub. SM Markets #0030FF stands in for it. Also: g leaf #2E8B57 vs Grab dark 5.4; g pattern tone #1A6B52 vs 7-Eleven green 3.9.)

### 2.2 Verdict

- **Dark green + gold = Puregold**, a PH grocery chain in the same category. The g-drafts' ink is ΔE 1.8 from Puregold green (identical), their ground is 11.1 from it, and their gold is 4.8 and 5.1 from the BDO and Landbank golds. Individual ΔE numbers understate this: the **pairing** (dark-green field with gold) is Puregold's whole identity. **Do not ship the g-drafts' palette.**
- **Saturated mid green** (Grab #00B14F, Landbank #1CB14D, 7-Eleven #147350) is taken. Any leaf green between them is under ΔE 15 from at least one of them.
- **Where green is still open:**
  1. **Green as ink on a cream field.** The field decides the first impression, and cream is ≥ 22.9 from every PH brand. A bottle green (#0F4D3A) is 11.1 from Puregold and 12.9 from 7-Eleven: close, but it reads differently because it is not the field.
  2. **Blue-green jade/teal around hue 180°** (#1E8F86) keeps ≥ 14.8 from every PH brand (nearest: 7-Eleven green). My grid search over hue 60–200° found the largest open gap at this hue for mid-tone fields (best min ΔE about 21–22, at a more cyan teal).
  3. **Pale lime** (#E3F08A) is ≥ 16.9 from every PH brand. Its global neighbours are Robinhood (11.1) and Wise (11.2).
- **Gold has to be brass, not yellow.** Bright golds (#F2B705-type) sit within ΔE 5 of BDO and Landbank and within 7.4 of the flag / LP yellow. A darker, less saturated brass (#C8963E: L* 65, C* 53, vs flag yellow L* 85, C* 84) is 12.0 / 12.5 from BDO / Landbank gold and 18.1 from flag yellow. It also matches the one gold-coloured object in Filipinos' pockets, the bronze ring of the ₱20 coin.

### 2.3 The political-yellow problem (evidence, not assumption)

**What the sources support:**
- Yellow has been the Aquino / Liberal Party colour since 1983–86. After 2016 critics turned it into the slur "dilawan", and under Duterte "yellow" was a code word for the LP (PH report §3; [Reportr explainer, Feb 2022](https://www.reportr.world/amp/news/explainer-red-for-bongbong-marcos-pink-for-leni-robredo-yellow-aquino-political-colors-a4833-20220223); [Interaksyon](https://interaksyon.philstar.com/breaking-news/2018/05/16/126899/can-you-paint-with-all-the-colors-of-politics/)).
- The colour was toxic enough that candidates fled it. In 2019 the opposition slate filed in blue, green and white ([Inquirer, "where's 'dilawan' at COC filing?"](https://newsinfo.inquirer.net/1044338/yellow-no-longer-sole-opposition-color-in-2019-polls)), and Otso Diretso candidates "hit 'yellow' label" ([PDI via PressReader](https://www.pressreader.com/philippines/philippine-daily-inquirer-1109/20190416/281513637543747)). Robredo "shunned yellow" for pink in 2022 (PH report §3).
- 2025: the Aquino–Pangilinan "KiBam" campaign used **pink and green**, not yellow ([ABS-CBN, Nov 2024](https://abs-cbn.com/news/2024/11/9/kiko-pangilinan-bam-aquino-launch-kibam-grassroots-campaign-1621), [Wikipedia KiBam](https://en.wikipedia.org/wiki/KiBam)). An Inquirer business column says the "Yellow" brand "reemerged, but with a modern twist" in 2025 ([Inquirer Business](https://business.inquirer.net/525639/decoding-the-2025-elections); quoted from the search snippet, since the page refused my fetch).
- Money link: the NGC ₱500 note is yellow and showed Ninoy and Cory Aquino. The 2024 polymer ₱500 is still yellow but shows the Visayan spotted deer instead ([Wikipedia ₱500](https://en.wikipedia.org/wiki/Philippine_five_hundred_peso_note), [Wikipedia polymer series](https://en.wikipedia.org/wiki/First_Philippine_Polymer_Banknote_Series), [Inquirer](https://newsinfo.inquirer.net/2017156/new-peso-bills-focus-on-ph-fauna-heroes-leaders-gone/amp)). So **yellow + peso-bill imagery** carries the most direct Aquino association.

**What I could not find:** any PH consumer brand boycotted or attacked *because of its colour*. The PH brand boycotts I found were about owners' or CEOs' political statements (Colourette 2020, Delimondo; [Marketech APAC](https://marketech-apac.com/local-makeup-brand-in-ph-gains-backlash-for-ceos-political-remark/), [Coconuts](https://coconuts.co/manila/news/filipino-netizens-demanding-boycott-corned-beef-brand)). Large brands carry yellow or gold accents without any reported partisan reading: BDO (#FFB20C), Landbank (#FDC14F), Puregold (#8C6414), Jollibee (red + yellow). That is absence of evidence, not proof of safety.

**Conclusion.** Not safe by default; the risk is manageable:
- (a) Never use yellow as the field or the dominant colour.
- (b) Use **brass / bronze** (L* ≤ 70, C* ≤ 60, hue near 80°, ΔE ≥ 15 from #FCD116), not lemon or sunflower yellow.
- (c) Keep it to small details (coin rim, tag hole).
- (d) Never pair yellow with ribbon shapes or with a yellow ₱500-style bill.
- (e) Never pair green with pink (KiBam 2025, Robredo–Pangilinan 2022). The "no pink" rule already covers this.

The g-drafts' #F2B705 fails (b): 7.4 from flag yellow and 3.6 from the ₱500 yellow.

---

## 3. Backgrounds that work behind a sticker wordmark, on the icon and on the splash

### 3.1 Platform facts that decide the answer

- **Android 12+ system splash:** "The window background consists of a single opaque color", plus the icon (240×240 dp inside a 160 dp circle with an icon background, or 288 dp inside 192 dp without one) ([Android splash docs](https://developer.android.com/develop/ui/views/launch/splash-screen)). Expo maps this to `backgroundColor` + `image` + `imageWidth`, with a separate `dark` block ([Expo docs](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/)). **So the splash cannot show a pattern.** It is the ground colour plus the "y". A pattern can appear only in an in-app animated screen after the system splash.
- **Adaptive icon:** foreground and background layers, each 108×108 dp. The OEM mask clips the outer 18 dp, and only the inner **66 dp safe zone** is never clipped. The layers move for parallax ([Android adaptive icons](https://developer.android.com/develop/ui/views/launch/icon_design_adaptive)). Expo accepts `backgroundColor` or `backgroundImage`, plus `monochromeImage` for themed icons. At 256 px for 108 dp, the safe zone is about 156 px. A background pattern must survive an arbitrary crop and shift, so only **uniform, edge-to-edge repeats or plain fields** are safe there; anything placed at one spot may be masked off.
- **Play Store icon:** 512 px full bleed; Google applies the corner mask and shadow itself ([Play icon spec](https://developer.android.com/google-play/resources/icon-design-specifications)).
- **Fine line work and cheap screens:** guilloche is made of "subtle thin lines" designed to break up under resampling, and moiré is the visible failure ([arXiv survey 1910.08993](https://arxiv.org/pdf/1910.08993)). A 720 px-wide background scaled down to a 720p LCD, or to a 256 px icon, resamples it. **Inference:** keep guilloche strokes ≥ 2 px and line spacing ≥ 8 px at 720 px width, and drop the line work entirely at icon size.

### 3.2 Why the earlier backgrounds failed (measured)

`mg_busy.py` measures the border strips outside the wordmark: the share of pixels on an edge, the distinct colours covering ≥ 2 % of the area, and the strongest background shape against the ground.

| Render | Edge density | Colours ≥ 2 % | Strongest background shape vs ground | What went wrong |
|---|---|---|---|---|
| f-ube-strip | 1.8 % | 3 | orange strip **5.58:1**, ΔE **71.6** | A second full-saturation field (orange) as loud as the logo, plus dashes, perforation and slashes |
| f-ube-coin | 2.4 % | 3 | grey coin faces **6.11:1**, ΔE 57.7 | Giant cropped coins at text-level contrast, light grey against purple |
| f-ube-label | 1.3 % | 2 | orange label **4.76:1**, ΔE 69.3 | A second "sticker" behind the sticker; the ₱20 and slashes compete with the tag in the "a" |
| g-clean | 0.6 % | 2 | gold coin **5.41:1**, ΔE 59.3 | Same mistake with one object: a coin as loud as the word, half hidden behind it |
| g-note | **25.0 %** | **6** | gold guilloche **3.34:1**, ΔE 43.1 | Money texture done loud: saturated gold rosette plus a double frame |
| g-pattern | 4.7 % | 2 | icons **1.50:1**, ΔE **9.4** | The calmest, but six different icons, randomly rotated, read as doodle wallpaper |

**Hypothesis check: "they failed because they were busy and literal, not because of the objects."** Partly supported.
- Every rejected or weak background put a second shape at **4.8–6.1:1 and ΔE 58–72 against the ground**. That is text-level contrast, so the background competed with the wordmark for attention.
- The objects themselves (coins, tags, sachets) are on topic. The user's second complaint, "this is money and grocery related", cannot be about the objects, which *were* money and grocery. It points at the **ube + orange colour** not reading as money or grocery.
- So two failures stacked: loud, literal backgrounds, and an off-category palette.
- *Not verifiable without asking the user:* whether a quiet version of the same objects would have passed.

### 3.3 Ranking of background styles for this logo

1. **Plain field.** Always works, and is mandatory for the system splash. It works on the icon. Weakness: no extra "money" cue.
2. **Tone-on-tone single motif, regular repeat** (coin rings, dots). Pattern tone at **ΔE 3–6 and contrast ≤ 1.25:1** against the ground. It survives cropping and parallax on the adaptive icon. Keep one motif, no rotation, no randomness.
3. **One oversized, cropped tone-on-tone motif** (a single guilloche rosette or coin ring, ≥ 60 % of the canvas height, bleeding off one edge). The most "designed" look and the strongest money cue at full size. On the icon it reduces to plain, or to an arc.
4. **Multi-icon wallpaper** (g-pattern). Avoid: busy and literal even at low contrast.
5. **Literal object scene** (f-*, g-clean). Rejected.

Rule of thumb for every direction: the background must stay **below ΔE 6 and 1.25:1** from the ground, so that the only element above 3:1 is the sticker.

---

## 4. Three directions

The roles follow the brief. "Ink" = letters + outline + hard shadow. "Detail accent" = coin rim, lens glass and glint, tag hole (these are white in d2). Over and under budget always come with a shape and a word, never colour alone (WCAG 1.4.1; 5.17 % of Filipino males are colour-blind, PH report §4):
- **Over budget:** the **IOU slip** (torn-edge slip) + **▲** + "Lampas ₱120".
- **Under budget:** the **peso bills / coin stack** + **✓** + "₱450 natira".

### Direction A: "Sukli Resibo" (bottle-green ink on receipt cream, brass coin details)

| Role | Hex |
|---|---|
| Ground | `#FAF3E1` receipt cream |
| Ink (letters, outline, shadow) | `#0F4D3A` bottle green |
| Sticker edge | `#FFFFFF` |
| Detail accent (coin rim, lens, tag hole) | `#C8963E` brass (the ₱20's bronze ring) |
| Pattern tone | `#F0E6C8` |
| Dark-mode ground | `#121816` (dark-mode shadow tone `#26332D`) |
| Over budget (light / dark) | `#B8251C` / `#FF8A7A` + IOU slip + ▲ "Lampas" |
| Under budget (light / dark) | `#0B4A30` / `#6FD39B` + bills/coins + ✓ "natira" |

**Background (720×420).** Plain cream field with **one guilloche rosette**, centred at (610, 380), so roughly the lower-right third shows and the rest bleeds off the bottom and right edges:
- 9 concentric rings with base radii 150, 168, … 294 px (18 px apart);
- each ring's radius varies by r + 6·sin(24θ + k·0.4), where k is the ring index;
- stroke 2.5 px, no fill, colour `#F0E6C8` at full opacity (ΔE 4.9, 1.13:1);
- the wordmark sits left of centre, so the rosette peeks out above and to the right of the final "a".

Nothing else.
- **256 px icon:** plain `#FAF3E1` tile and the receipt "y" in `#0F4D3A`. The y is ≤ 156 px tall inside the safe zone, its edge white, the torn tail kept. No rosette, because 2.5 px lines become sub-pixel and moiré. Optional: three rings at 6 px stroke as an arc in the lower-right corner, but only as a static Play Store asset, never as the adaptive background (the mask may crop it).
- **Splash:** system splash `#FAF3E1` + y; dark `#121816` + y with white edge. Any in-app follow-up screen may draw the rosette in.

**Rationale:**
- Cream + green + brass is the banknote / receipt / coin triad: paper money, sukli (change) and the resibo the y's tail is torn from.
- In the PH, money is signalled by forms, not a hue (§1.2). The guilloche is the one money form the wordmark lacks, and it is rendered at whisper level, the opposite of g-note.
- Green ink keeps the global money-and-fresh cue (§1.1) without putting green on the field, where every PH green brand lives (§2.2).

**Collisions (ΔE00):**
- Ground: ≥ 22.9 from every PH brand (nearest Landbank gold 22.9, ₱500 24.5, flag yellow 24.9).
- Ink: Puregold green **11.1** and 7-Eleven green **12.9** (close), Grab dark 24.5.
- Brass: BDO gold 12.0, Landbank gold 12.5 (close), flag yellow 18.1, Puregold gold 18.9.
- Dark ground: Puregold green 12.5, GoTyme ink 12.6 (near-blacks cannot be owned; the field is what people read).

**Contrast:**

| Pair | Ratio | Needs |
|---|---|---|
| ink / ground (silhouette) | **8.85:1** | 3:1 ✓ (and 4.5 ✓) |
| ink / edge (letters) | **9.80:1** | 4.5 ✓ |
| edge / ground | 1.11:1 | n/a: the outline is the boundary (as in d2, 1.27) |
| accent / ink | 3.68:1 | 3:1 ✓ |
| pattern / ground | 1.13:1, ΔE 4.9 | ≤ 1.25 by design ✓ |
| over / ground | 5.72:1 | 4.5 ✓ |
| under / ground | 9.32:1 | 4.5 ✓ |
| dark: over / under on `#121816` | 7.85 / 9.82:1 | 4.5 ✓ |

- Over vs under: ΔE 54.4; deutan 23.4, protan 8.5; luminance ratio 1.63. In dark mode: deutan 8.4, protan 11.9, luminance ratio 1.25 (weak for colour-blind users, so the ▲/✓ glyphs and words carry it).

**Dark mode:**
- The white edge on `#121816` is **17.98:1**, so the sticker shape is carried by the edge.
- The green outline (1.83:1) fades into the ground, which is fine.
- Recolour the hard shadow to `#26332D` (1.36:1 on the ground, 13.18:1 against the edge) so the offset still reads as a faint lift.

### Direction B: "Jade Palengke" (jade field, cream sticker, lime details)

| Role | Hex |
|---|---|
| Ground | `#1E8F86` jade |
| Ink | `#0A1412` green-black |
| Sticker edge | `#FFF6DC` cream |
| Detail accent | `#E3F08A` pale lime |
| Pattern tone | `#1A8178` |
| Dark-mode ground | `#0F2226` (shadow tone `#1F4A47`) |
| Over budget | `#B8251C` **chip** with white label + IOU slip + ▲ "Lampas"; dark text colour `#FF8A7A` |
| Under budget | `#0B4A30` **chip** with white label + bills/coins + ✓ "natira"; dark text colour `#6FD39B` |

**Background (720×420).** **Coin-ring repeat**, tone-on-tone:
- rings of outer radius 14 px, stroke 5 px, in `#1A8178` on `#1E8F86` (ΔE 5.1, 1.20:1);
- a 56 px grid with alternate rows shifted 28 px (half-drop);
- the first ring centre at (0, 0), so the pattern runs off all four edges with no visible start;
- no rotation, no second motif.

The sticker's hard shadow sits on top of the rings; nothing is masked around the word.
- **256 px icon:** adaptive background = the same repeat, rings r 10 px, stroke 4 px, grid 40 px, edge to edge (uniform, so masks and parallax are harmless). Foreground = cream-edged ink "y". Fallback: plain `#1E8F86`.
- **Splash:** system splash `#1E8F86` + y with its cream edge (cream on jade 3.65:1); dark `#0F2226`.

**Rationale:**
- The boldest home-screen presence of the three: a saturated field, like Grab or GCash tiles, but on the one open green (§2.2: about 15 ΔE from the nearest PH brand).
- Jade and lime on dark ink is the Wise / Monzo "modern money" code (§1.1). The coin-ring repeat adds the money form, and the palengke (wet-market) green adds fresh food.
- Trade-off: the field is mid-tone, so the silhouette is the weakest of the three (4.75:1, still ≥ 4.5).

**Collisions (ΔE00):**
- Ground: 7-Eleven green **14.8** (close), Grab dark 19.1, Grab 22.7, Landbank 23.1, Maya 30.4.
- Pattern tone: 7-Eleven green 11.3 (close).
- Ink: Puregold green 12.4.
- Lime: flag yellow 16.9; Wise 11.2, Robinhood 11.1 (global only).
- Dark ground: Puregold green **10.2** (just above the collision line; it reads as a dark teal, not Puregold's field, but keep it neutral rather than greener).

**Contrast:**

| Pair | Ratio | Needs |
|---|---|---|
| ink / ground (silhouette) | **4.75:1** | 3:1 ✓ |
| ink / edge (letters) | **17.36:1** | 4.5 ✓ |
| edge / ground | 3.65:1 | 3:1 ✓ |
| accent / ink | 15.24:1 | 3:1 ✓ |
| pattern / ground | 1.20:1, ΔE 5.1 | ✓ |
| over / ground | 1.61:1 ✗ | use chips |
| under / ground | 2.62:1 ✗ | use chips |
| white on over chip / under chip | 6.33 / 10.31:1 | 4.5 ✓ |

- Over and under fail as plain text on the jade field, so they must be **filled chips** on jade (or plain text on a cream app surface). **In-app screens should use a cream surface, with jade for the brand moments only.**
- Over vs under: same as A (deutan 23.4, protan 8.5).

**Dark mode:**
- The cream edge on `#0F2226` is **15.24:1**.
- The ink outline (1.14:1) disappears into the ground.
- Shadow becomes `#1F4A47` (1.67:1 on the ground, 9.15:1 against the edge).

### Direction C: "Kalamansi" (pale lime field, green-black ink, punched-through details)

| Role | Hex |
|---|---|
| Ground | `#E3F08A` pale lime |
| Ink | `#14170F` olive-black |
| Sticker edge | `#FFFFFF` |
| Detail accent | `#E3F08A`: the ground colour, so the coin rim, lens and tag hole look **punched through** the sticker |
| Pattern tone | `#CEE06A` |
| Dark-mode ground | `#14170F` (shadow tone `#2E3520`) |
| Over budget (light / dark) | `#B8251C` / `#FF8A7A` + IOU slip + ▲ "Lampas" |
| Under budget (light / dark) | `#0B4A30` / `#6FD39B` + bills/coins + ✓ "natira" |

**Background (720×420).** Plain lime field with **one oversized "coin-and-citrus" ring**, centred at (560, 210):
- outer radius 250 px, inner radius 196 px, filled `#CEE06A` (ΔE 4.5, 1.18:1);
- 12 radial gaps, 6 px wide, cut through the band, so it reads both as a reeded coin edge and as calamansi segments;
- the right ~15 % bleeds off the canvas, and the wordmark covers the ring's left half.

Nothing else.
- **256 px icon:** plain `#E3F08A` tile, white-edged ink "y". At most, an adaptive background with the same ring scaled to radius 1.2× the tile, so only a corner arc shows; plain is safer.
- **Splash:** system splash `#E3F08A` + y; dark `#14170F` + y with white edge.

**Rationale:**
- Lime + near-black is today's money-app code (Robinhood #CCFF00, Wise #9FE870).
- A pale citrus lime also reads as produce: calamansi, pechay, the green of a market stall.
- The most open colour in the PH set (nearest PH brand ΔE 16.9) and the highest glare margin (14.75:1 silhouette, 18.12:1 letters).
- The coin/citrus ring gives a single motif with a double meaning instead of literal objects.

**Collisions (ΔE00):**
- Ground: flag / LP yellow **16.9**, Landbank favicon green 18.5, ₱500 18.6, Robinsons apple 19.2 (all close, none colliding).
- Globally: Robinhood **11.1**, Wise **11.2** (close; Wise is used in the PH for remittances).
- Pattern: Wise 9.7, Robinhood 10.2.
- Ink and dark ground: Puregold green 13.1.
- Risk: a lime this pale can drift toward yellow on warm-tinted budget LCDs. Do not push it any yellower than hue 110° (it sits at 112°).

**Contrast:**

| Pair | Ratio | Needs |
|---|---|---|
| ink / ground (silhouette) | **14.75:1** | ✓ |
| ink / edge (letters) | **18.12:1** | ✓ |
| edge / ground | 1.23:1 | n/a: outline is the boundary |
| accent / ink | 14.75:1 | ✓ |
| pattern / ground | 1.18:1, ΔE 4.5 | ✓ |
| over / ground | 5.15:1 | ✓ |
| under / ground | 8.40:1 | ✓ |
| dark: over / under on `#14170F` | 7.91 / 9.89:1 | ✓ |

**Dark mode:**
- The white edge on `#14170F` is **18.12:1**.
- The ink outline equals the ground (1.00:1), so the edge alone carries the shape.
- The punched-through details stay lime, a nice continuity.
- Shadow becomes `#2E3520` (1.42:1 on the ground, 12.76:1 against the edge).

### Side-by-side

| | A Sukli Resibo | B Jade Palengke | C Kalamansi |
|---|---|---|---|
| Money cue | strongest (banknote line work, brass coin, receipt) | coin repeat + fintech jade/lime | fintech lime/black + coin ring |
| Grocery cue | green ink | palengke green field | citrus/produce lime |
| Silhouette ink/ground | 8.85 | 4.75 | 14.75 |
| Letters ink/edge | 9.80 | 17.36 | 18.12 |
| Nearest PH brand (field) | 22.9 | 14.8 | 16.9 |
| Home-screen boldness | quiet (cream tile) | loudest | bright |
| Main risk | ink 11.1 from Puregold green | 7-Eleven green 14.8; over/under need chips | Robinhood/Wise 11; yellow drift on warm LCDs |

---

## 5. Recommendation

**A, "Sukli Resibo"**:
1. **It reads as money in Philippine terms.** PH money is multi-coloured paper and silver/bronze coins, not green (§1.2). Receipt cream, a ₱20-bronze brass and a quiet guilloche speak that language, and the green ink adds the global money-and-fresh cue.
2. **It best fixes what went wrong before.** The field is calm, the only element above 1.25:1 is the sticker, there are no literal objects, and the palette is on category. It also avoids the Puregold trap (green field + gold) by keeping green off the field and gold down to brass details.
3. **Glare and cheap LCDs.** A light ground with 8.85:1 silhouette and 9.80:1 letters. The splash is a single light colour, which Android requires anyway.
4. **Low political exposure.** No yellow field, and the brass is ΔE 18.1 from the flag / LP yellow.
5. **The sticker form carries the "bold and playful".** Chunky letters and the hard shadow do that job, so the palette does not have to.

Its weak spot is a quieter home-screen tile. If the user wants more punch, **C "Kalamansi"** is the runner-up: open in the PH, the highest contrast, and the same structure. Test both as real 48 dp launcher icons among GCash, Grab, Shopee and Lazada icons before choosing. B is the bold option, but it has the weakest silhouette and needs a separate cream surface for in-app text.

---

## Could not verify

- Official hex values for any brand. Mine come from favicons and logo files on the brands' own sites, and from Commons/Wikipedia SVG redraws (BDO, Landbank, Puregold, Mercury Drug, flag/LP yellow), so treat them as close readings. Cash App #00D632 comes only from third-party sites (cash.app returned 403). Landbank's favicon (#71BE43) differs from its Commons logo green (#1CB14D); both were checked.
- Savemore's own colours (the site redirects to an ad stub) and BDO's live site (connection refused); BDO comes from the Commons SVG only.
- The ₱500 polymer yellow hex. `#F2C230` is the PH report's UI approximation, not a BSP value.
- The exact Liberal Party campaign yellow; I used the PH flag yellow #FCD116 from the LP logo SVG as the proxy.
- Any PH consumer brand attacked for its colour (none found; absence of evidence). The Inquirer pages (2019, 2025 elections, polymer notes) refused automated fetches, so those points rest on search snippets. The Reportr explainer URL returned 404 when fetched; its points are taken from the search summary.
- Whether a quiet version of the rejected coin/tag/sachet objects would have pleased the user (§3.2 hypothesis; needs a user check).
- How the pale lime (C) and cream (A) render on actual Transsion LCDs under supermarket light. Test on a real ₱6–10k phone.
- Whether jade #1E8F86 reads as "green" or "teal" to PH shoppers (no PH colour-naming data).

## Sources

- Wise: https://wise.com/gb/blog/a-brand-for-everywhere-wise-unveils-bold-new-look · https://www.bandt.com.au/?p=1449454 · https://www.brandcolorcode.com/color/bright-green · icon sampled from https://wise.com/public-resources/assets/icons/wise-personal/apple_touch_icon.png
- Instacart: https://company.instacart.com/updates/carrot-evolution-a-new-brand-identity · https://www.designweek.co.uk/issues/10-15-october-2022/wolff-olins-rebrand-instacart/ · icon sampled from instacart.com
- Cash App (third-party): https://brandpalettes.com/cash-app-colors/ · https://www.designpieces.com/palette/block-color-palette-hex-and-rgb/
- Sampled favicons/logos (fetched 2026-11-23): robinhood.com, monzo.com, ynab.com, monarchmoney.com, rocketmoney.com, wholefoodsmarket.com, sayweee.com, mercurydrug.com (md-main-logo.png), robinsonssupermarket.com.ph (RSC-Logo.webp, favicon), gotyme.com.ph, alfamart.com.ph, waltermartdelivery.com.ph, landbank.com (favicon)
- Wikimedia logo SVGs: https://upload.wikimedia.org/wikipedia/commons/4/49/BDO_Unibank_%28logo%29.svg · https://upload.wikimedia.org/wikipedia/commons/0/0b/Puregold_logo.svg · commons "Landbank.svg", "GCash_logo.svg", "Maya_logo.svg"; en "Liberal_Party_of_the_Philippines.svg", "Mercury_Drug_logo.svg", "Jollibee_2011_logo.svg"
- Landbank (third-party cross-check): https://whatthelogo.com/logo/landbank-of-the-philippines/109959
- PH money: https://en.wikipedia.org/wiki/First_Philippine_Polymer_Banknote_Series · https://en.wikipedia.org/wiki/New_Generation_Currency_Series · https://en.wikipedia.org/wiki/Philippine_five_hundred_peso_note · https://www.bsp.gov.ph/SitePages/CoinsAndNotes/NewGenerationCurrencyBanknotes.aspx · https://newsinfo.inquirer.net/2017156/new-peso-bills-focus-on-ph-fauna-heroes-leaders-gone/amp
- Political colour: https://www.reportr.world/amp/news/explainer-red-for-bongbong-marcos-pink-for-leni-robredo-yellow-aquino-political-colors-a4833-20220223 · https://newsinfo.inquirer.net/1044338/yellow-no-longer-sole-opposition-color-in-2019-polls · https://www.pressreader.com/philippines/philippine-daily-inquirer-1109/20190416/281513637543747 · https://business.inquirer.net/525639/decoding-the-2025-elections · https://abs-cbn.com/news/2024/11/9/kiko-pangilinan-bam-aquino-launch-kibam-grassroots-campaign-1621 · https://en.wikipedia.org/wiki/KiBam · https://mb.com.ph/2025/1/11/pink-still-in-robredo-endorses-senate-comeback-bids-of-aquino-pangilinan · https://interaksyon.philstar.com/breaking-news/2018/05/16/126899/can-you-paint-with-all-the-colors-of-politics/ · plus the PH report's §3 sources
- Brand boycotts (owner statements, not colour): https://marketech-apac.com/local-makeup-brand-in-ph-gains-backlash-for-ceos-political-remark/ · https://coconuts.co/manila/news/filipino-netizens-demanding-boycott-corned-beef-brand
- Platform: https://developer.android.com/develop/ui/views/launch/splash-screen · https://developer.android.com/develop/ui/views/launch/icon_design_adaptive · https://developer.android.com/google-play/resources/icon-design-specifications · https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/
- Guilloche / moiré: https://arxiv.org/pdf/1910.08993
- WCAG: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html · https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html · https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html
- CIEDE2000 test data: Sharma, Wu & Dalal (2005), "The CIEDE2000 color-difference formula: implementation notes, supplementary test data, and mathematical observations", Color Research & Application 30(1)
- Scripts (base path): `mg_lib.py`, `mg_palettes.py`, `mg_busy.py`, `mg_sample.py`, `mg_try.py`, `mg_explore.py`; downloaded assets in `dl-mg/`
