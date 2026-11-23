# yaga logo: Jade Palengke (final, 2026-11-23)

Sticker wordmark "yaga" with icons built into the letters: the y's tail is a torn receipt, the first a is a coin, the g holds a camera lens and the last a's stem is a price tag. App icon = the receipt y.

| Role | Hex |
|---|---|
| Ground | `#1E8F86` jade |
| Ink (letters, outline, shadow) | `#0A1412` |
| Sticker edge | `#FFF6DC` cream |
| Details (coin rim, lens glint, tag hole) | `#E3F08A` lime |
| Pattern (coin rings, tone on tone) | `#1A8178` |
| Dark ground / dark shadow | `#0F2226` / `#1F4A47` |

- `h-B-*.svg` and `renders/`: wordmark on its background, plain, dark, app icon; `renders/h-sheet.png` compares it with the two directions that were not picked.
- `app-assets/` (SVG) and `renders/app-assets/` (PNG): the files copied into `mobile/assets`.
- Rebuild: `python3 -I recolor.py` (wordmarks, all three researched directions) and `python3 -I app_assets.py`, then render with the logo-design skill's `render_png.py`.
- Why these colours: `money-grocery-research.md` (builds on `ph-color-research.md`).
