# YetAnotherGroceryApp

A personal grocery management application that helps users track purchases,
monitor price history, verify receipt accuracy, and analyze long-term grocery
spending. Built with offline-first support, cloud synchronization, and
personal analytics to help users make smarter shopping decisions.

## Repository layout

| Path | What it is | Status |
| --- | --- | --- |
| `mobile/` | Expo (SDK 57) + React Native app — the data-capture surface | **Working core**: offline SQLite + barcode scanning + trips/lists/library; verified on device via Expo Go |
| `web-desktop/` | Next.js 14 web app + Tauri 2 desktop shell — the analytics surface | Scaffold (placeholder dashboards) |
| `specs.md` | Functional/product specification | Stable |
| `tech.mobile.md` | Mobile technical requirements (+ implementation status) | Source of truth for mobile |
| `tech.desktop.md` | Web/desktop technical requirements | Design only |

The shared backend (delta sync + Turso) is not started; see the sync engine
section of `tech.mobile.md` for the intended protocol. The mobile app already
journals every mutation into a `sync_mutations` outbox, so the future sync
client only has to drain it.

## Quickstart (mobile)

```sh
cd mobile
npm install
npm run typecheck && npm run lint && npm test   # 50 tests, no device needed
npx expo start                                  # then scan with Expo Go
```

The mobile app has no third-party native modules, so it runs directly in
Expo Go — no dev build required. Device testing notes (firewall, tunnel
fallback) live in [`mobile/README.md`](mobile/README.md).

## Milestones

- [x] Expo SDK 57 baseline, CI (typecheck/lint/jest), EAS project linked
- [x] Offline-first database: Drizzle schema, migrations, repositories,
      outbox + tombstones (every write journaled for sync)
- [x] Capture flow: barcode scanning (expo-camera/ML Kit), manual product
      capture, price capture, duplicate-scan handling
- [x] Shopping trips (survive app kills), lists → trips, library, history
- [x] Device-verified via Expo Go
- [ ] Signed APK via EAS Build (config ready; build on demand)
- [ ] OCR price capture (`expo-mlkit-ocr`) with confirmation overlays
- [ ] Receipt processing and price-comparison pipeline
- [ ] Sync engine + shared backend (Turso) with field-level LWW
- [ ] Background tasks, auth (Clerk), Detox E2E
