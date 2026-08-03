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
- Minimum OS targets: Android 8.0 (API 26), iOS 16 (required by `expo-mlkit-ocr`).

## Framework & Language

- **React Native** with **TypeScript** (strict mode).
- **Expo** (managed/bare hybrid via `expo prebuild`) for native module access
  (camera, barcode, ML Kit, SQLite) while keeping OTA update capability.
- React Native chosen for shared TypeScript/React knowledge with the web/desktop
  app, large ecosystem of camera/OCR modules, and fast iteration via Expo.

## Core Capture Libraries

All capture (camera, barcode, OCR) goes through a single provider: **Google ML Kit
standalone SDK** (no Firebase). This sidesteps the Firebase ML Kit deprecation
(shutdown June 15, 2027), keeps the dependency surface small, and runs fully
on-device and offline.

| Capability | Library / Service |
| --- | --- |
| Camera + barcode scanning | `react-native-vision-camera` with built-in `codeScanner` (Google ML Kit under the hood) |
| Barcode formats | EAN-13, EAN-8, UPC-A, UPC-E, QR (Google ML Kit Barcode) |
| OCR (shelf-price + receipt) | `expo-mlkit-ocr` — Google ML Kit Text Recognition v2, structured blocks/lines/elements with bounding boxes, on-device, tap-to-capture high-res still |
| Manual product capture | In-app form for unknown barcodes (name, brand, category, package size, unit, optional photo, optional notes) |
| Price parsing | Custom TS parser to normalize currency, units, and line-item totals |

ML Kit models are **bundled** on both platforms (offline-first from first launch).
Acceptable size cost documented in Performance & Storage Targets and Risks.

## Capture Flow

All OCR (shelf-price and receipt) follows the same path:

1. User taps "capture" to grab a high-res still from the camera.
2. `expo-mlkit-ocr` runs on the still and returns structured blocks/lines/elements
   with bounding boxes.
3. The result is rendered with a tap-to-confirm overlay (`<MlkitOcrOverlay>`).
4. User confirms or edits the detected value(s); the raw OCR value and the
   user-corrected value are both stored.

For receipts, the user confirms each line item (product, quantity, price) before
saving.

### Barcode scan → known vs unknown

- Scan barcode → ML Kit (via VisionCamera `codeScanner`) → lookup SQLite.
  - **Found** → existing product → shelf-price capture flow.
  - **Not found** → manual product capture screen → save product → shelf-price
    capture flow.

### Manual product capture

When a barcode scan returns no match in the local SQLite database, the user is
guided through a manual product capture screen:

- Product name (required)
- Brand
- Category
- Package size
- Unit (g, kg, mL, L, pcs, etc.)
- Optional product photo
- Optional personal notes

The barcode (scanned value) is stored as the canonical identifier so future scans
of the same barcode skip the manual step.

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
- Bundled Google ML Kit models (text recognition v2 + barcode) add ~20–40 MB
  to each platform binary; accepted as the cost of offline-first from first
  launch.

## Key Risks & Mitigations

- **OCR accuracy on receipts** → always prompt user to confirm/correct; store
  both raw OCR value and user-corrected value.
- **Duplicate scans** → client-side detection by barcode + recent timestamp to
  offer "increase quantity" instead of new entry.
- **Sync conflicts** → timestamp-based LWW per field with audit trail of
  conflicting revisions.
- **ML Kit version pinning** → use the standalone ML Kit SDK only (no Firebase
  path), pin `expo-mlkit-ocr` and ML Kit Android/iOS coordinate versions
  explicitly to avoid drifting onto the deprecated Firebase ML Kit path
  (shutdown June 15, 2027).
- **ML Kit binary size** → bundled models add ~20–40 MB per platform; monitor
  with EAS Build size budgets and consider unbundled (Play Services) deployment
  if size pressure grows.
- **Manual product capture friction** → unknown barcodes require a form
  (name/brand/category/package size/unit); mitigate with "recently used
  brands/categories" pickers and per-category default units.
