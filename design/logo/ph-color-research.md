# yaga: colour research for the Philippine market

Date: 2026-11-23. Scope: research only. No repository files were edited and nothing was published.

**Method.** Most hex values below were **sampled by me from each brand's own website** (favicon or logo files, the `theme-color` meta tag, or the colours used most in its homepage CSS), fetched on 2026-11-23. That makes them first-hand readings of what each brand serves today. They are not official brand-guide values, and none of these companies publishes one that I could find. Third-party colour sites are cited only where they agree with the sampled value. Contrast uses the WCAG 2.x relative-luminance formula. Colour difference is CIEDE2000 (ΔE00): roughly 1–2 is barely noticeable, under about 5 reads as "the same colour" at a glance, and over about 15 reads as clearly different. Colour-blind simulation uses the Machado 2009 matrices at full severity.

---

## 1. Competitive landscape (what a Filipino shopper sees every week)

| Brand | Main colour(s) | Hex | Source / confidence |
|---|---|---|---|
| **foodpanda** | hot pink | **#FF2B85** (app icon and logo). The web UI also uses #E21B70 and #C21760, with light tints #FFEBEB and #FFDDDD | Sampled from foodpanda.ph favicon (`micro-assets.foodora.com/favicons/fp/android-chrome-192x192.png`) and homepage CSS. The older #D70F64 is still listed on brandcolorcode.com / brandpalettes.com but is not the colour the site serves now. Pink since 2017, chosen "to stand out" where orange was common; refreshed in 2021 with the pink kept ([marketing-interactive](https://www.marketing-interactive.com/foodpanda-serves-up-colourful-brand-refresh-and-new-visuals), [marketing-interactive 2017](https://www.marketing-interactive.com/foodpanda-undergoes-global-rebrand-from-orange-to-pink)) |
| **Lazada** | pink-magenta → orange → blue gradient, pale-pink heart | web UI orange **#F57224**, pink **#F93782**; heart tint **~#FDDCEB** | Sampled from lazada.com.ph favicon and CSS. High confidence on the hues |
| **Shopee / ShopeePay** | orange | **#EE4D2D** | Sampled from the shopee.ph favicon; matches [brandpalettes](https://brandpalettes.com/shopee-color-codes/) |
| **GCash** | bright blue + navy | **#007CFF** (icon), web #1972F9, navy #0A2757 / #002CB8 | Sampled from the gcash.com favicon and CSS. The agency says the palette moved "from deep blue into a vibrant array" of blues ([Serious Studio](https://serious-studio.com/project/gcash-technology-finance-branding-design)) |
| **Maya** | neon mint green on black | **#2FF29E** (favicon), web #75EEA5 | Sampled from maya.ph (favicon file is literally "Mint-OnBlackBG") |
| **Grab / GrabMart** | green | **#00B14F** (dark #008E3F) | Sampled from grab.com favicon and CSS |
| **SM Markets** (SM Supermarket / Hypermarket / Savemore online) | electric blue | **#0030FF** | smmarkets.ph `theme-color` meta tag and app icon |
| **Puregold** | very dark green + gold | **~#01281F** + **~#8D640C** | Sampled from the logo PNG on puregold.com.ph. Approximate (small logo file) |
| **7-Eleven PH** | red / orange / green stripes | **#EC0F2A**, **#FF6C00**, **#147350** | Sampled from the 7-eleven.com.ph site icon |
| **MerryMart** | sky blue | **~#01AEF0** | Sampled from merrymart.com.ph logo |
| **S&R** | navy | **~#1B3664** | Sampled from the snrshopping.com logo |
| **Robinsons Supermarket** | green (apple) | no hex found | Green apple logo since 1985 ([Philstar](https://philstar.com/lifestyle/food-and-leisure/2015/09/02/1495196/robinsons-supermarket-celebrates-30-fresh-years)). Its "green tags" mark healthy products in store |
| **Savemore, Waltermart, Landers** | not verified | — | Sites blocked automated fetches (Cloudflare challenge or a redirect stub). The Landers favicon shows green circles, which may or may not be the logo. **Unverified** |
| Budget / expense apps used in PH | Money Lover, Money Manager (Realbyte), Monefy, Lista PH, Tipid, PocketClear, GoodBudget | not sampled | Named in PH roundups ([Inquirer Tech](https://technology.inquirer.net/136768/the-best-finance-apps-in-the-philippines), [Moneymax](https://www.moneymax.ph/lifestyle/blog/budget-apps), [PocketClear](https://pocketclear.app/blog/expense-tracker-philippines.html)). None owns a colour a shopper would notice; I did not sample their hex values |

## 2. Crowded vs open colour territories

| Territory | Who is there | Verdict |
|---|---|---|
| **Blue** (bright to navy) | GCash, SM Markets, MerryMart, S&R | **Crowded.** Reads as "wallet / bank / SM" |
| **Green** (mint to dark) | Grab, Maya, Puregold, Robinsons, 7-Eleven stripe | **Crowded.** Reads as "supermarket / wallet / delivery". Green was also Sara Duterte's colour in 2022 |
| **Orange / red-orange** | Shopee, Lazada, 7-Eleven | **Crowded.** Reads as "e-commerce sale" |
| **Hot pink / magenta** | foodpanda (owns it), Lazada gradient | **Crowded.** Reads as "food delivery". Also politically coded since 2022 (see §3) |
| **Red** | 7-Eleven, Marcos campaign colour | Use only for the over-budget state, never as the brand colour |
| **Yellow** | Aquino / Liberal Party, ₱500 note | Avoid as the brand colour |
| **Purple / ube** | nobody in this set. Closest neighbours are S&R navy (ΔE 15.8) and the ₱100 note mauve (ΔE 20) | **Open**, with a strong PH-specific story (ube) |
| **Warm paper neutrals** (receipt off-white, kraft brown) | nobody | **Open.** These suit the sticker / receipt / sari-sari motifs |
| **Teal (blue-green, dark)** | nobody exactly. Nearest is the 7-Eleven green (ΔE 13.7) | Mostly open; works as a secondary colour |

## 3. Cultural and practical colour meaning in the PH (only what sources support)

- **Pink is a political colour since 2022.** Leni Robredo's 2022 campaign was built on hot pink ("Kakampink"), chosen to break from Liberal Party yellow ([Inquirer](https://newsinfo.inquirer.net/1499061/shunning-yellow-robredo-turns-to-pink-the-color-of-protest-activism), [SCMP](https://www.scmp.com/week-asia/politics/article/3157383/could-colour-pink-swing-philippine-presidential-election-leni), [The Diplomat](https://thediplomat.com/2022/03/introducing-the-colors-of-the-philippine-election)). Sara Duterte's 2022 rally line "hindi kami… pink at yellow" shows the colours were openly partisan ([Manila Bulletin](https://mb.com.ph/2022/04/25/uniteam-underscores-call-for-colorless-politics-in-taguig-grand-rally/)). Manila Bulletin coverage of the 2025 campaign still describes **red, yellow, pink and green** as the campaign colours ([via Magzter](https://www.magzter.com/hi/stories/newspaper/Manila-Bulletin/A-CALL-FOR-UNITY-TO-SAFEGUARD-EVERY-FILIPINO-VOTE)). *Not verified:* whether a pastel-pink grocery app would actually read as partisan in 2026. foodpanda is pink without obvious backlash, so the risk is a perception risk, not a certainty.
- **Yellow** = Aquino family / Liberal Party since 1983–86, later turned into the insult "dilawan" by critics ([Inquirer](https://newsinfo.inquirer.net/1233338/lp-launches-yellow-ribbon-campaign-on-34th-edsa-anniversary/amp), [Philstar/Interaksyon](https://interaksyon.philstar.com/breaking-news/2018/05/16/126899/can-you-paint-with-all-the-colors-of-politics/)).
- **Red / green** = Marcos / Duterte in 2022 ([The Diplomat](https://thediplomat.com/2022/03/introducing-the-colors-of-the-philippine-election)). Red is also the luck and prosperity colour in Chinese-Filipino practice (ang pao, Lunar New Year) ([Inquirer Lifestyle](https://lifestyle.inquirer.net/105384/ang-pao-guide)). Using red and green for the over/under states is fine. Using either as the brand colour adds a political or cultural layer.
- **Green = money** is weakly supported in PH sources (lifestyle pieces disagree). Green = health is supported in grocery: Robinsons' DOST-FNRI "green tags" mark healthy items. Do not lean on "green means money" as a rationale.
- **Purple / ube** is widely described as a marker of Filipino food identity ([Vera Files](https://verafiles.org/articles/know-your-philippine-ube-history-culture-and-identity), [Inquirer Lifestyle](https://lifestyle.inquirer.net/572259/ube-now-worlds-next-matcha/), [Khaleej Times/AFP 2026](https://www.khaleejtimes.com/world/asia/purple-reign-philippines-seeks-to-keep-grip-on-ube-throne-3)). I found no source tying purple to a PH party or campaign.
- **"Sale" colours in PH retail:** I found **no source** for a customary sale-tag colour. DTI rules cover that price tags must exist and that the lowest of shelf, tag or scanned price prevails, not their colour ([DTI brochure](https://esigaw.dti.gov.ph/wp-content/uploads/2023/04/Price-Tag-Brochure.pdf), [Interaksyon](https://interaksyon.philstar.com/trends-spotlights/2025/12/16/306362/holiday-sales-prompt-reminders-price-tag-laws/)). The orange of Shopee and Lazada is the closest thing to a "sale" association, and that is my inference.
- **Cheap vs trustworthy:** no PH-specific study found. Unsupported, so not claimed.

## 4. Practical constraints

- **Devices.** Transsion (Infinix, Tecno, itel) holds about 33–40% of PH smartphone shipments in 2025 (Canalys / IDC / Omdia via [Telecomlead](https://telecomlead.com/smart-phone/philippines-smartphone-market-share-2025-transsion-dominates-budget-segment-as-xiaomi-samsung-vivo-and-oppo-battle-on-pricing-and-consumer-trust-124696), [Unbox](https://unbox.ph/gadget/transsion-top-brand-philippines-2025/)). The sub-₱11,500 tier is the majority of sales. Assume LCD panels with modest peak brightness. Pastel-on-pastel and mid-tone pairs wash out first.
- **Glare.** Ambient light lifts black levels: a 300:1 LCD can fall below 2:1 in direct sun ([patent US7853288](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/7853288)). GSMArena measured early phones at about 2–3.3 sunlight contrast ([GSMArena](https://www.gsmarena.com/gsmarena_labs_announces_sunlit_legibility_display_test-news-4105.php)). In practice, aim well above 4.5:1 for the hero number (≥ 10:1 is easy with near-black ink on a light background) and keep the 2px ink outlines.
- **Supermarket light.** Fresh-meat cases often use warm, red-rich light (2,800–3,500 K) ([Penn State guide](https://animalscience.psu.edu/outreach/programs/meat/pdf/lightguidefinal.pdf), [Philips](https://lighting.philips.co.uk/systems/themes/meat-discoloration)). Light reflected off a glossy screen in that light pushes colours toward pink or red, which is one more reason not to depend on red-vs-pink or pink-vs-orange distinctions. *Inference:* I found no study of phone legibility under retail light specifically.
- **Dark mode.** No representative PH data. The Android Authority reader poll gives 81.9% (self-selected enthusiasts, [AA](https://www.androidauthority.com/dark-mode-poll-results-1090716/)). NN/g found roughly a third each for dark, light and both ([NN/g](https://nngroup.com/articles/dark-mode-users-issues)). Keep light as the in-store default and ship a proper dark theme.
- **Colour blindness.** 5.17% of Filipino male high-schoolers (n = 1,258), mostly deutan, i.e. red-green ([PJO 2010](https://paojournal.com/index.php/pjo/article/view/294)). Over and under must differ by glyph and word (WCAG 1.4.1) and preferably also by lightness and hue axis.
- **WCAG:** 4.5:1 for body text (1.4.3), 3:1 for large text and for UI component boundaries (1.4.11).

### Audit of the current themes (computed)

| Theme | ink/bg | muted/bg | over/bg | under/bg | button text/button | button/bg | over vs under for a deutan viewer (ΔE00) |
|---|---|---|---|---|---|---|---|
| Bubblegum | 14.05 | 7.37 | 5.25 | 5.17 | 17.40 | 13.56 | **5.1** (and luminance ratio 1.02: same lightness) |
| Cream | 15.95 | n/a | 6.18 | 4.98 | 5.59 (ink on pink) | **2.85** (pink button on cream fails 3:1; the 2px ink outline rescues it) | **3.5** (near-identical for deutans) |
| Night market | 18.05 | n/a | 6.50 | 11.01 | 6.23 | 6.23 | 8.8 |

All the text passes. The weak point is over vs under: for red-green colour-blind users the colours alone are nearly indistinguishable in Bubblegum and Cream. The ▲/✓ + word rule is therefore mandatory, not optional.

**Peso note labels.** Ink #1E1433 on ₱100 #8E6BB0 = 4.06 and on ₱50 #D2383C = 3.63, both under 4.5. Labels on those two notes need to be large bold text (≥ 14pt bold, where 3:1 applies) or white (white on ₱50 = 4.80, on ₱100 = 4.30). Ink on ₱1000 = 5.02, ₱500 = 10.42, ₱200 = 5.37 all pass.

## 5. Does the current pink collide with foodpanda?

**Yes for the saturated pinks, no for the Bubblegum background on its own.**

| Our colour | vs foodpanda #FF2B85 | vs Lazada pink #F93782 | Verdict |
|---|---|---|---|
| Cream button **#FF4F8B** | **ΔE 4.1** | **ΔE 3.8** | **Bad collision.** It reads as foodpanda's pink at a glance |
| Night button **#FF5C9A** | **ΔE 6.2** | ΔE 6.1 | **Strong collision.** Same family, slightly lighter |
| Bubblegum bg **#FFD9EA** | ΔE 32.3 (6.5 vs foodpanda's own #FFDDDD tint) | **ΔE 1.5 vs Lazada's heart tint #FDDCEB** | Not foodpanda's core colour, but practically identical to Lazada's pale pink |
| Over **#B3124F** | ΔE 18.4 (4.3 vs foodpanda's dark web pink #C21760) | — | Crimson-pink. Too close to foodpanda's darker shade, and pinkish-red confuses "over" with "brand" |

In context: foodpanda's pink is on riders, bags and app icons on every PH street, and Lazada is pink-magenta. A pink-led grocery app would be read as "a foodpanda/pandamart thing" (pandamart is foodpanda's own grocery service: same category, same pink). On top of that comes the 2022 "Kakampink" political coding. **Recommendation: retire hot pink as the brand / primary colour.** If Bubblegum stays as an optional theme, keep its buttons in ink (as they are today) and move "over" off pink-crimson.

## 6. Palette directions

Each palette gives tokens with their roles, and every contrast number below was computed. The "over" and "under" states always ship with ▲ / ✓ plus a word (e.g. "▲ Lampas ₱120", "✓ ₱450 left").

### A. "Ube Resibo" (recommended)

Receipt-paper off-white, ube-violet primary, price-gun orange accent.

| Role | Hex |
|---|---|
| Background | `#FFF7E8` |
| Ink (incl. hero "₱X left") | `#1E1433` |
| Muted text | `#5E5470` |
| Primary button / its text | `#5A2D82` / `#FFFFFF` |
| Accent (stickers, price-gun label; ink text on it) | `#FF9F1C` |
| Over budget | `#9A1F15` |
| Under budget | `#0B6E4F` |

- **Rationale:** ube purple is the one big colour territory no PH wallet, delivery app or supermarket owns, and it carries a Filipino food-identity story. The receipt-paper background ties to the sticker / IOU-slip motif.
- **What it avoids:** the nearest PH brand colours are S&R navy (ΔE 15.8) and SM blue (17.6). The orange accent sits ΔE 15.3 from Lazada, 15.4 from 7-Eleven, 27 from Shopee and 14.6 from the ₱500 note. Pink, yellow, blue and green are kept out of the brand colours.
- **Contrast:** ink/bg **16.39** · muted/bg **6.62** · white on button **9.85** · button vs bg **9.25** · ink on accent **8.50** · over/bg **7.64** · under/bg **5.87**. Accent vs bg is 1.93, so accent fills always carry the 2px ink outline, which provides the 3:1 boundary.
- **Over vs under:** ΔE 55.7. For colour-blind viewers it stays **16.3** (deutan) and **15.1** (protan), and the luminance ratio is 1.30, so they also differ in greyscale.
- **Dark companion "Ube Night":** bg `#16121F`, ink `#F7F2E8`, muted `#B9B0CC`, button `#C9A7F0` with text `#16121F`, accent `#FF9A3D` with text `#16121F`, over `#FF8A7A`, under `#5FD49B`. Contrast: ink **16.50** · muted **8.90** · button text **9.00** · accent text **8.72** · over **8.04** · under **9.98** · deutan ΔE 9.0.

### B. "Sari-sari Kraft"

Brown-paper (supot) background, ink primary, deep tingi-teal accent.

| Role | Hex |
|---|---|
| Background | `#F4E6CC` |
| Ink | `#2B1B10` |
| Muted text | `#6B4F36` |
| Primary button / its text | `#2B1B10` / `#FFF4DC` |
| Accent (light text on it) | `#0B6B6A` |
| Over budget | `#8A1A14` |
| Under budget | `#1D6B2F` |

- **Rationale:** leans on the sari-sari "tingi" logo direction and the brown paper bag, a neutral no PH brand owns.
- **What it avoids:** the teal is ΔE 13.7 from the 7-Eleven green. The kraft background is ΔE 21 from the ₱500 note. No pink, blue or orange.
- **Contrast:** ink/bg **13.45** · muted **6.09** · button text **15.17** · button vs bg **13.45** · text on accent **5.78** · accent vs bg **5.12** · over **7.61** · under **5.33**.
- **Weakness:** the deutan ΔE between over and under is only **6.8** (luminance ratio 1.43), so it leans harder on the glyphs. A tan background is also slightly duller under warm store light and on dim LCDs than the off-white of A.

### C. "Bubblegum, de-panda'd" (least change)

Keep a pale pink background, but take hot pink out of buttons and accents.

| Role | Hex |
|---|---|
| Background | `#FFE4EF` |
| Ink | `#2B0A1E` |
| Muted text | `#6B3352` |
| Primary button / its text | `#2B0A1E` / `#FFE4EF` |
| Accent (ink text on it) | `#FF9F1C` |
| Over budget | `#9A1F15` |
| Under budget | `#0B6E4F` |

- **Rationale:** keeps the playful identity users may already know, while removing the foodpanda-pink buttons and the pink-crimson "over".
- **What it still collides with:** the background is ΔE 2.7 from Lazada's heart tint and 5.0 from foodpanda's tint, and pink stays politically coded.
- **Contrast:** ink **15.11** · muted **7.92** · button text **15.11** · button vs bg **15.11** · ink on accent **8.78** · over **6.82** · under **5.24** · deutan ΔE 16.3.
- **Best kept as an optional theme, not the brand.**

### Recommendation

**Use A, "Ube Resibo", for the brand and the default in-store theme, with "Ube Night" as dark mode.**

- It is the only direction whose brand colour sits in open PH territory with a positive local meaning.
- It has the best colour-blind separation of the over/under states.
- Its near-black-on-off-white hero number holds up best under glare and on budget LCDs.

B is a good alternative if the logo goes the sari-sari route. C works as a user-selectable theme only.

For the logo directions:

- **Price-gun label:** use `#FF9F1C` rather than a red-orange.
- **11-sided ₱20 coin:** keep it bronze or nickel on the ube or paper background.

## Could not verify

- Official hex values for any of these brands. Mine are sampled from their live sites, and Puregold, MerryMart and S&R come from small logo files, so treat them as approximate.
- Savemore, Waltermart and Landers colours (sites blocked automated access).
- Robinsons Supermarket hex.
- The current hex values of the budget apps.
- Any PH-specific source on sale-tag colours, on "cheap vs trustworthy" colours, or on whether pink reads as partisan in a consumer app in 2026.
- PH dark-mode usage.
- Phone legibility under supermarket light.
- BSP's official note colours. Only ₱1000 blue and ₱100 mauve/violet were confirmed in sources found.

## Sources

- foodpanda: https://www.marketing-interactive.com/foodpanda-serves-up-colourful-brand-refresh-and-new-visuals · https://www.marketing-interactive.com/foodpanda-undergoes-global-rebrand-from-orange-to-pink · https://www.brandcolorcode.com/foodpanda · https://brandpalettes.com/foodpanda-color-codes/
- Shopee: https://brandpalettes.com/shopee-color-codes/
- GCash: https://serious-studio.com/project/gcash-technology-finance-branding-design
- Robinsons: https://philstar.com/lifestyle/food-and-leisure/2015/09/02/1495196/robinsons-supermarket-celebrates-30-fresh-years
- Sampled sites: foodpanda.ph, lazada.com.ph, shopee.ph, gcash.com, maya.ph, grab.com/ph, smmarkets.ph, puregold.com.ph, 7-eleven.com.ph, merrymart.com.ph, snrshopping.com (fetched 2026-11-23)
- Politics: https://thediplomat.com/2022/03/introducing-the-colors-of-the-philippine-election · https://newsinfo.inquirer.net/1499061/shunning-yellow-robredo-turns-to-pink-the-color-of-protest-activism · https://www.scmp.com/week-asia/politics/article/3157383/could-colour-pink-swing-philippine-presidential-election-leni · https://mb.com.ph/2022/04/25/uniteam-underscores-call-for-colorless-politics-in-taguig-grand-rally/ · https://newsinfo.inquirer.net/1233338/lp-launches-yellow-ribbon-campaign-on-34th-edsa-anniversary/amp · https://interaksyon.philstar.com/breaking-news/2018/05/16/126899/can-you-paint-with-all-the-colors-of-politics/ · https://www.magzter.com/hi/stories/newspaper/Manila-Bulletin/A-CALL-FOR-UNITY-TO-SAFEGUARD-EVERY-FILIPINO-VOTE
- Culture: https://lifestyle.inquirer.net/105384/ang-pao-guide · https://verafiles.org/articles/know-your-philippine-ube-history-culture-and-identity · https://lifestyle.inquirer.net/572259/ube-now-worlds-next-matcha/ · https://www.khaleejtimes.com/world/asia/purple-reign-philippines-seeks-to-keep-grip-on-ube-throne-3
- Retail rules: https://esigaw.dti.gov.ph/wp-content/uploads/2023/04/Price-Tag-Brochure.pdf · https://interaksyon.philstar.com/trends-spotlights/2025/12/16/306362/holiday-sales-prompt-reminders-price-tag-laws/
- Devices: https://telecomlead.com/smart-phone/philippines-smartphone-market-share-2025-transsion-dominates-budget-segment-as-xiaomi-samsung-vivo-and-oppo-battle-on-pricing-and-consumer-trust-124696 · https://unbox.ph/gadget/transsion-top-brand-philippines-2025/
- Glare: https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/7853288 · https://www.gsmarena.com/gsmarena_labs_announces_sunlit_legibility_display_test-news-4105.php
- Lighting: https://animalscience.psu.edu/outreach/programs/meat/pdf/lightguidefinal.pdf · https://lighting.philips.co.uk/systems/themes/meat-discoloration
- Dark mode: https://www.androidauthority.com/dark-mode-poll-results-1090716/ · https://nngroup.com/articles/dark-mode-users-issues
- Colour vision: https://paojournal.com/index.php/pjo/article/view/294
- Budget apps: https://technology.inquirer.net/136768/the-best-finance-apps-in-the-philippines · https://www.moneymax.ph/lifestyle/blog/budget-apps · https://pocketclear.app/blog/expense-tracker-philippines.html
- Banknotes: https://newsinfo.inquirer.net/734420/p100-or-p1000-color-altered · https://www.philstar.com/the-freeman/cebu-business/2016/01/31/1548518/bsp-start-releasing-darker-p100-bill
- WCAG: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html · https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html · https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html
