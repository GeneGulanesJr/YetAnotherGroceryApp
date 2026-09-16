# YetAnotherGroceryApp — Mobile

The mobile application is the primary data-capture surface for YetAnotherGroceryApp.
It targets Android and iOS, works offline-first, and synchronizes with the shared
backend that the desktop application also reads from.

This package contains the initial scaffold. See [`../tech.mobile.md`](../tech.mobile.md)
for the full technical requirements.

## Stack

- **React Native** + **TypeScript** (strict mode)
- **Expo** (`expo prebuild`) with the New Architecture enabled
- **React Navigation** — native stack + bottom tabs
- **NativeWind** (Tailwind-based styling) with light/dark themes
- **Zustand** for transient UI state
- **TanStack Query** for optional server lookups
- **Drizzle ORM** schema for the local SQLite store (offline-first)
- Money stored as integer minor units (see `src/utils/money.ts`)

## Project structure

```
mobile/
├── App.tsx                  # Providers (query, safe area, gesture, navigation)
├── app.json                 # Expo config + permissions
├── src/
│   ├── navigation/          # Root navigator + bottom-tab navigator
│   ├── screens/             # Shopping, Lists, Capture, Library, History, Settings
│   ├── components/          # Shared UI building blocks
│   ├── theme/               # Design tokens (light/dark)
│   ├── store/               # Zustand stores
│   ├── utils/               # Pure helpers (money parsing/formatting + tests)
│   └── db/                  # Drizzle schema mirroring the backend tables
└── eas.json                 # EAS Build profiles
```

## Primary sections

Shopping · Lists · Capture · Library · History · Settings — matching the flows
described in the technical requirements.

## Scripts

| Script                  | Description                                  |
| ----------------------- | -------------------------------------------- |
| `npm start`             | Start the Expo dev server                    |
| `npm run ios`           | Build/run on iOS (requires a native build)   |
| `npm run android`       | Build/run on Android (requires a native build)|
| `npm run typecheck`     | Run `tsc --noEmit`                           |
| `npm test`              | Run Jest unit tests                          |

## What is implemented

- **Expo SDK 57** (React Native 0.86, React 19, New Architecture) with
  TypeScript strict, ESLint (eslint-config-expo), and GitHub Actions CI
  (typecheck / lint / jest)
- Offline-first SQLite via `expo-sqlite` + Drizzle ORM: WAL, foreign keys,
  versioned migration runner (`PRAGMA user_version`) over drizzle-kit SQL
  embedded by `scripts/embed-migrations.mjs` (`npm run db:generate` then
  `npm run db:embed` after schema changes)
- Outbox tracking (`src/db/outbox.ts`): every insert/update/delete stamps the
  shared sync columns (id, timestamps, `device_id`, `revision`,
  `sync_status`, `field_versions_json`) and appends a `sync_mutations` row;
  deletes are tombstones — the future sync engine only has to drain the outbox
- Repositories for categories (with seeded defaults), stores, barcodes,
  products (search / archive / detail / recent brands), prices, trips
  (duplicate-scan quantity increments, complete/cancel, totals), shopping
  lists (convert-to-trip), and image metadata
- Barcode scanning with **expo-camera** (ML Kit on Android): scan lock +
  resume, torch, manual-entry fallback; GTIN check-digit validation, UPC-E →
  UPC-A expansion, and EAN-13 ↔ UPC-A alias bridging (`src/utils/barcode.ts`)
- Capture flow: scan → known product quick card (last price) or manual product
  capture (name-required form, searchable categories, recent brands, optional
  compressed photo with SHA-256) → price capture (regular/promo/loyalty, tax
  flag) → adds to the active trip and returns to the scanner loop
- **OCR shelf-price capture**: photograph the tag → on-device ML Kit OCR →
  overlay with ranked price candidates (currency-marked decimals, comma
  decimals, marked integers, OCR digit-confusion repair) → confirmed value
  carries raw text + confidence + source image into the price record
- **Receipt verification v1**: photograph the receipt → OCR → classified
  editable lines (product/total/subtotal/tax/discount/payment; header/footer
  by position; quantity parsing) → transactional save with normalized-name
  matching to the trip's purchases → per-line shelf-vs-receipt discrepancy
  and overcharge rollup surfaced in the trip summary and History
- Image pipeline (`src/capture/images.ts`): expo-image-manipulator compression
  + thumbnails, document-directory storage, byte-level SHA-256 — binaries
  never enter SQLite
- Shopping trips persisted in SQLite and reloaded on focus (survive app
  kills), quantity steppers, running totals, complete/cancel
- Lists (checklists with estimates, convert to trip), Library (search, price
  history, unit prices, favorite/archive), History (completed trips),
  Settings (default currency, pending-sync counter)
- Money as integer minor units with ISO currency; unit-price math
  (per 100 g / 100 mL / piece, multi-packs) — all pure utils under test
- 50 tests: outbox semantics, barcode utils, trip lifecycle, app-kill
  persistence on real files, list aggregates, money, unit prices

### Deviation from tech.mobile.md

`react-native-vision-camera` v5 (Nitro rewrite) removed built-in barcode
scanning, so the app uses **expo-camera** for scanning (ML Kit on Android,
SDK-57-aligned, torch support). Revisit alongside the OCR milestone —
`expo-mlkit-ocr` runs on stills and pairs with any camera library.

## Pinned compatible versions

| Package | Version | Notes |
| --- | --- | --- |
| expo | ^57.0.23 | SDK 57, RN 0.86.3, React 19.2.3 |
| expo-camera | ~57.x | Barcode scanning (ML Kit), torch, still capture |
| expo-mlkit-ocr | 0.2.7 | On-device ML Kit text recognition; dev builds only (Expo Go falls back to manual entry) |
| expo-sqlite / drizzle-orm | ~57.x / ^0.45.2 | Same schema runs on better-sqlite3 in jest |
| react-native-reanimated | 4.5.1 | Requires react-native-worklets 0.10.1 (installed) |
| nativewind | 4.2.7 | Tailwind **3.x only** (tailwindcss ^3.4.17) |
| typescript | ~6.0.3 | SDK 57 pin |

## Running on a device (Expo Go, no build required)

The app has no third-party native modules, so it runs directly in Expo Go:

```sh
npx expo start          # phone on the same Wi-Fi
```

In Expo Go choose **"Enter URL manually"** and use `exp://<your-LAN-IP>:8081`
(find the IP with `ip -4 addr show`).

Networking notes learned on-device:

- **Linux firewall**: if connecting times out silently, Metro is likely being
  firewalled — `sudo ufw allow 8081/tcp` (ufw default-deny drops it).
- **Different network / mobile data**: `npx expo start --tunnel` (needs the
  `@expo/ngrok` dev dependency, already installed) publishes an
  `exp://…exp.direct` URL that works from anywhere.
- Device errors (red screens, native crashes) stream into the Metro terminal
  log — keep it visible while testing.
- One statement per `sqlite.execSync()` call — Android's native prepare step
  rejects multi-statement strings.

## Building the APK (EAS)

```sh
cd mobile
npx eas-cli login              # once
npx eas-cli build -p android --profile preview      # installable release APK
npx eas-cli build -p android --profile development  # dev client APK for iteration
```

- Credentials: EAS-managed keystore (generated on first build)
- `preview`/`development` produce `.apk`; `production` produces an `.aab` for
  Play Store
- Project: `genegulanes` under the `genegulanesjrs-team` account
  (id `15bd877b-8763-4ff6-9189-f51a6ec41924`)

### On-device validation checklist (spec)

- [ ] Barcode acquisition feels instant (< 300 ms after focus) for EAN-13/8,
      UPC-A/E; QR ignored unless valid
- [ ] Scan known product → quick card shows last price; capture price → added
      to trip; rescan same product → quantity increments
- [ ] Scan unknown barcode → manual capture (name only required) → price
- [ ] Trip survives force-kill and relaunch (active trip restored)
- [ ] Full airplane-mode pass: scan, capture, complete trip, library/history
      all work offline; pending-change counter grows
- [ ] Record APK size and startup time; track between releases

## Not yet implemented (next milestones)

- Pull/push delta sync engine with last-write-wins conflict resolution
  (outbox is already journaled) and the shared backend
- Background tasks (`expo-task-manager`, `expo-background-task`)
- Store-specific receipt alias learning (v1 matches by normalized names)
- Auth (Clerk) and image upload to object storage
- E2E tests (Detox)
