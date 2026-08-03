# Tech Requirements — Mobile Application

The mobile application is the primary data capture surface for YetAnotherGroceryApp.
It must work offline-first during shopping trips, use the device camera for barcode
scanning and OCR, and synchronize accumulated data with a shared backend that the
desktop application also reads from.

---

## Platform Strategy

- Cross-platform single codebase targeting **Android** and **iOS**.
- Offline-first: all features (scanning, price capture, receipt verification,
  shopping lists, summaries) work without a network connection.
- Background sync when connectivity returns.
- Minimum OS targets: Android 8.0 (API 26), iOS 13.

## Framework & Language

- **React Native** with **TypeScript** (strict mode).
- **Expo** (managed/bare hybrid via `expo prebuild`) for native module access
  (camera, barcode, ML Kit, SQLite) while keeping OTA update capability.
- React Native chosen for shared TypeScript/React knowledge with the web/desktop
  app, large ecosystem of camera/OCR modules, and fast iteration via Expo.

## Core Capture Libraries

| Capability | Library / Service |
| --- | --- |
| Camera + barcode scanning | `expo-camera` with built-in barcode detection, plus `react-native-vision-camera` when fine-grained control is needed |
| Barcode formats | EAN-13, EAN-8, UPC-A, UPC-E, QR (via ML Kit / VisionCamera barcode plugin) |
| Shelf-price OCR (on-device) | **Google ML Kit Text Recognition v2** (`@react-native-ml-kit/text-recognition`) — fast, free, offline |
| Receipt OCR | ML Kit first pass for line items; optional cloud fallback (**Google Cloud Vision** `DOCUMENT_TEXT_DETECTION`) for long, dense receipts |
| Price parsing | Custom TS parser to normalize currency, units, and line-item totals |

## Image Handling

- `expo-image-manipulator` for resizing/compressing shelf and receipt photos.
- Store only compressed thumbnails by default; keep originals opt-in per product.
- `expo-image-picker` for manual photo selection and product library photos.
- `expo-file-system` for cached file storage before sync upload.

## Local Database (Offline-First)

- **SQLite** via `expo-sqlite` as the single source of truth on-device.
- Schema mirrors the shared backend tables (products, prices, purchases, trips,
  stores, categories, receipts, list items).
- All writes go to SQLite; the UI reads only from local SQLite.
- Migrations managed with a versioned migration runner (e.g. custom wrapper or
  `drizzle-orm` migrations).

Recommended ORM layer: **Drizzle ORM** (TypeScript-native, SQLite dialect, works
with `expo-sqlite`, and schema can be shared with the desktop build).

## Sync Engine

- **Pull/push delta sync** against the shared backend over HTTPS.
- Conflict resolution: **timestamp-based (last-write-wins)** per field, as
  required by the specs.
- Each record carries `created_at`, `updated_at`, `deleted_at`, `device_id`,
  and `revision` fields.
- Queue-based upload for images (shelf photos, receipts, product photos) with
  retry/backoff via `expo-task-manager` + `expo-background-fetch`.
- Candidate managed sync layer: **PowerSync** or **ElectricSQL** if a managed
  Postgres→SQLite sync is preferred over a custom engine.

## State Management

- **Zustand** for UI/app state (current trip, cart, budget, scanner state).
- **TanStack Query (React Query)** for any non-local, server-only lookups
  (e.g. optional product database enrichment, barcode lookups).
- Local SQLite is the canonical store; Zustand holds transient session state
  (active shopping trip, running totals).

## Navigation

- **React Navigation** (`@react-navigation/native` + native-stack + bottom-tabs).
- Main flows: Shopping (active trip), Lists, Library, Capture (scanner),
  History, Settings.

## UI / Styling

- **NativeWind** (Tailwind for React Native) or **Tamagui** for a consistent,
  themeable design system shared with the web app where possible.
- Reusable component library extracted into a shared package (`packages/ui`)
  consumed by both mobile and desktop.

## Background Tasks

- `expo-task-manager` and `expo-background-fetch` for:
  - Periodic background sync.
  - Pending image upload flush.
- Foreground sync indicators in the UI.

## Testing

- **Jest** + **React Native Testing Library** for unit/component tests.
- Integration tests against an in-memory SQLite fixture.
- **Detox** for end-to-end flows (scan → capture price → verify receipt).
- Snapshot tests for receipt/price parsing logic.

## Build, CI/CD & Distribution

- **EAS Build** for native binaries; **EAS Update** for OTA JS bundles.
- CI: GitHub Actions workflow running typecheck, lint, tests, then EAS build on
  tag push.
- Code signing via EAS credentials.
- Distribution: TestFlight (iOS), internal + Play Store tracks (Android).

## Permissions & Hardware

- Camera (required for barcode + shelf/receipt capture).
- Photo library (optional product/receipt import).
- Notifications (optional sync/price-alert reminders).
- Network access for sync only.

## Performance & Storage Targets

- Scanner latency < 300 ms from focus to recognition.
- OCR confirm step always allows user edit before persisting.
- Local DB expected to grow ~1–3 MB per 100 purchases incl. thumbnails;
  original images offloaded to object storage after sync.

## Key Risks & Mitigations

- **OCR accuracy on receipts** → always prompt user to confirm/correct; store
  both raw OCR value and user-corrected value.
- **Duplicate scans** → client-side detection by barcode + recent timestamp to
  offer "increase quantity" instead of new entry.
- **Sync conflicts** → timestamp-based LWW per field with audit trail of
  conflicting revisions.
