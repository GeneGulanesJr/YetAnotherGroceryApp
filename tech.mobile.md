# Tech Requirements — Mobile Application

The mobile application is the primary data capture surface for YetAnotherGroceryApp.
It must work offline-first during shopping trips, use the device camera for barcode
scanning and OCR, and synchronize accumulated data with a shared backend that the
desktop application also reads from.

---

## Implementation Status (2026-09)

Implemented on the `feat/mobile-core-capture-mvp` branch; verified on a physical
Android device via Expo Go. This section records decisions and deviations; the
requirements below remain the target design.

* **Expo SDK 57** baseline (React Native 0.86, React 19, New Architecture,
  TypeScript ~6.0.3). Pinned compatible versions are documented in
  `mobile/README.md`.
* **Barcode scanning uses `expo-camera`, not `react-native-vision-camera`.**
  VisionCamera v5 (Nitro rewrite) removed the built-in `codeScanner` this
  document assumed, and v4 predates RN 0.86. expo-camera provides ML Kit
  barcode recognition on Android within the officially supported SDK surface.
  Revisit alongside the OCR milestone — `expo-mlkit-ocr` runs on still images
  and pairs with any camera library.
* **Local database is live**: `expo-sqlite` + Drizzle, WAL + foreign keys, a
  versioned migration runner (SQLite `user_version`) over drizzle-kit SQL
  embedded into the bundle (`scripts/embed-migrations.mjs`), so device and
  jest (better-sqlite3 fixtures) execute identical migrations.
* **Outbox implemented from day one**: `src/db/outbox.ts` stamps the sync
  columns and appends a `sync_mutations` row for every insert/update/delete
  (deletes are tombstones), exactly as the sync engine section requires. The
  sync client only has to drain the outbox once the backend exists.
* **Client ids** are v4 UUIDs generated locally (no `uuid` package — its ESM
  build dereferences the global `crypto` object, which Hermes does not
  provide).
* **OCR capture flow is implemented** (`expo-mlkit-ocr` 0.2.7, pinned):
  shelf-tag photo → on-device OCR → tap-to-confirm overlay
  (`OCRTextOverlay`) → ranked price candidates (`priceParse.ts`, tested) →
  price capture stores raw OCR text, confidence, and the source image.
  A tested coordinate-transform layer (`transform.ts`) backs overlay math.
  OCR runs only in development/custom builds — in Expo Go the flow degrades
  to manual entry.
* **Receipt verification v1**: receipt photo → OCR → classified editable
  lines (`receiptParse.ts`: product/total/subtotal/tax/discount/payment,
  header/footer by position, quantity extraction) → transactional save
  (`createReceiptWithLines`) → normalized-name matching against the trip's
  purchases with per-line shelf-vs-receipt discrepancy and overcharge rollup.
* **Sync engine (client side) is implemented** against the protocol below:
  batched outbox push, cursor-based delta pull, exponential backoff with
  attempt gating, idempotent runs, field-level LWW application, and a local
  `sync_conflicts` audit table (migration 0002) — all integration-tested
  against a mock transport (`src/sync/`). The fetch transport activates from
  `app.json` `extra.apiBaseUrl`; while unset, sync reports "unconfigured"
  and the app stays purely offline. Startup + foreground-resume triggers are
  wired; the Settings screen exposes manual "Sync now" with pending counts.
* Still pending from this document: the backend that implements
  `/sync/push` + `/sync/pull` (Turso), background tasks, auth, Detox E2E,
  store-specific receipt aliases learning.

---

## Platform Strategy

* Cross-platform single codebase targeting **Android** and **iOS**.
* Offline-first: all core features such as scanning, price capture, receipt
  verification, shopping lists, summaries, and purchase recording work without
  a network connection.
* All writes are stored locally before synchronization.
* Background sync is attempted when connectivity is available.
* Because operating systems do not guarantee immediate background execution,
  the application must also attempt synchronization:

  * On application startup
  * When returning to the foreground
  * After important writes when online
  * When the user manually selects **Sync now**
* Minimum OS targets:

  * Android 8.0 (API 26)
  * iOS 16, required by `expo-mlkit-ocr`

## Framework & Language

* **React Native** with **TypeScript** in strict mode.
* **Expo** using `expo prebuild` for native module access to the camera, barcode
  scanner, ML Kit, and SQLite.
* **EAS Build** for native application binaries.
* **EAS Update** for compatible JavaScript and asset updates.
* Native dependency, permission, configuration, or ML Kit changes require a new
  native build and cannot be delivered only through an OTA update.

React Native is chosen for shared TypeScript and React knowledge with the
web/desktop application, access to a large ecosystem of camera and OCR modules,
and fast iteration through Expo.

## Core Capture Libraries

All camera, barcode, and OCR capture uses the standalone **Google ML Kit SDK**
without Firebase.

This keeps OCR and barcode recognition fully on-device and available offline
while avoiding dependence on the deprecated Firebase ML Kit integration path.

| Capability                        | Library / Service                                                   |
| --------------------------------- | ------------------------------------------------------------------- |
| Camera                            | `react-native-vision-camera`                                        |
| Barcode scanning                  | VisionCamera built-in `codeScanner`, using Google ML Kit on Android |
| Barcode formats                   | EAN-13, EAN-8, UPC-A, UPC-E, QR                                     |
| OCR for shelf prices and receipts | `expo-mlkit-ocr`, using Google ML Kit Text Recognition v2           |
| Manual product capture            | In-app form for unknown barcodes                                    |
| Price parsing                     | Custom TypeScript parser                                            |
| Receipt parsing                   | Custom receipt normalization and matching pipeline                  |

ML Kit text-recognition models should be bundled where supported so OCR works
offline from the first launch.

The exact application-size increase must be measured during the native proof of
concept rather than assumed. Android and iOS model and framework sizes may
differ.

`expo-mlkit-ocr` is a community native dependency and must be pinned to a tested
version.

Before full implementation, validate the complete capture stack on physical
Android and iOS devices using the selected:

* Expo SDK version
* React Native version
* VisionCamera version
* `expo-mlkit-ocr` version
* ML Kit Android and iOS versions
* New Architecture setting
* EAS release configuration

The proof of concept must verify:

* OCR accuracy
* Structured blocks, lines, and elements
* Bounding-box coordinates
* Overlay alignment
* Image rotation handling
* Large receipt images
* Low-memory Android devices
* Android release builds
* iOS release builds
* Application startup time
* Final binary size

## Capture Flow

All shelf-price and receipt OCR follows the same path:

1. The user taps **Capture** to take a high-resolution still image.
2. `expo-mlkit-ocr` runs locally on the image.
3. OCR returns structured blocks, lines, elements, and bounding boxes.
4. The result is rendered with a tap-to-confirm overlay such as
   `<MlkitOcrOverlay>`.
5. The user confirms or edits the detected values.
6. The application stores:

   * Raw OCR value
   * Normalized value
   * User-corrected value
   * OCR confidence when available
   * Source image metadata
7. Confirmed data is written to local SQLite.
8. Images and records are queued for synchronization.

OCR-derived product, quantity, or monetary values must always be reviewable and
editable before they are permanently saved.

For receipts, the user confirms each detected line item, including product,
quantity, price, discount, and line total, before saving.

### Barcode Scan → Known vs Unknown

* Scan barcode.
* Normalize the barcode value.
* Search the local SQLite database.

If the product is found:

* Display the existing product.
* Show the last purchase date.
* Show the last recorded price.
* Show the saved package size.
* Allow the user to confirm that the barcode still represents the same product.
* Continue to the shelf-price capture flow.

If the product is not found:

* Open the manual product capture screen.
* Save the product locally.
* Associate the scanned barcode with the product.
* Continue to the shelf-price capture flow.

The application should also allow manually created products without barcodes for
produce, bakery products, custom products, and other variable or unlabelled
items.

### Manual Product Capture

When a barcode scan returns no local match, the user is guided through a manual
product capture screen.

Fields include:

* Product name, required
* Brand
* Category
* Package quantity
* Package size
* Unit such as g, kg, mL, L, pcs, pack, oz, or lb
* Optional product photo
* Optional personal notes

The barcode is stored as the product identifier when applicable so later scans of
the same barcode skip the manual step.

To reduce manual-entry friction, the form should provide:

* Recently used brands
* Recently used categories
* Category-specific default units
* Searchable categories
* Suggested package units

Users must also be able to:

* Edit product information
* Replace the product photo
* Change the category
* Archive unused products
* Merge duplicate products

## Image Handling

* Use `expo-image-manipulator` for resizing and compressing shelf, receipt, and
  product photos.
* Store compressed thumbnails by default.
* Keeping original images is opt-in.
* Use `expo-image-picker` for manual image selection.
* Use the current `expo-file-system` `File`, `Directory`, and `Paths` APIs for
  temporary and cached file storage.
* Do not use deprecated `expo-file-system` upload helpers.
* Upload images through `fetch`, `@expo/fetch`, or the selected object-storage
  integration.
* Do not store image binary data directly inside SQLite.

Each image record should store:

* Local URI
* Remote object key
* Thumbnail URI
* MIME type
* Width
* Height
* File size
* SHA-256 hash
* Upload status
* Creation timestamp

The SHA-256 hash may be used to detect duplicate image uploads.

## Local Database — Offline-First

* Use **SQLite** through `expo-sqlite` as the single source of truth on the
  device.
* The schema mirrors the shared backend tables, including:

  * Products
  * Product barcodes
  * Prices
  * Purchases
  * Trips
  * Stores
  * Categories
  * Receipts
  * Receipt lines
  * Shopping lists
  * Shopping-list items
  * Images
  * Sync mutations
* All writes go to SQLite.
* The user interface reads application data from local SQLite.
* Active shopping trips must be persisted after every meaningful change.
* Zustand must not be the only place where active-trip data is stored.

Migrations are managed through a versioned migration runner.

Recommended ORM layer: **Drizzle ORM** because it is TypeScript-native, supports
SQLite and `expo-sqlite`, and allows schema definitions to be shared with other
applications.

Database initialization should:

* Enable foreign-key enforcement.
* Enable WAL mode where supported.
* Create indexes for commonly queried and synchronized fields.
* Use transactions for multi-record operations such as:

  * Completing a shopping trip
  * Confirming a receipt
  * Merging products
  * Applying synchronization batches

Recommended indexes include:

* `barcode`
* `updated_at`
* `deleted_at`
* `product_id`
* `trip_id`
* `store_id`
* `receipt_id`
* `sync_status`

## Monetary and Quantity Storage

Monetary values must not be stored using JavaScript floating-point values.

Store money as integer minor units.

Examples:

```text
₱123.45 → 12345 centavos
$10.99  → 1099 cents
```

Each monetary record must also store its ISO currency code.

Package quantity and physical measurement must be stored separately.

Example:

```text
Package quantity: 6
Size per item: 500
Unit: mL
Total package size: 3000 mL
```

The application must support:

* Single-item products
* Multi-packs
* Weight-based products
* Volume-based products
* Piece-based products
* Variable-weight products

Important quantity calculations should use:

* Scaled integers
* Decimal strings with a decimal arithmetic library
* Another documented fixed-precision strategy

Compatible units should be normalized before calculating unit prices.

## Price Model

The application must distinguish between different price concepts.

Shelf-price observations may include:

* Regular shelf price
* Promotional shelf price
* Loyalty-card price
* Expected checkout price
* Required promotional quantity
* Store-displayed unit price
* Application-calculated unit price
* Currency
* Tax inclusion status
* Product
* Store
* Capture timestamp
* Source image

Completed purchases may include:

* Expected unit price
* Receipt unit price
* Receipt line total
* Quantity purchased
* Discount amount
* Final paid amount
* Tax amount when available
* Price discrepancy amount

Separating these values is required for reliable detection of missing discounts,
incorrect quantities, and checkout price mismatches.

## Receipt Processing

Receipt verification requires more than generic OCR and price parsing.

The processing pipeline is:

```text
Image capture or import
    |
Image preprocessing
    |
OCR extraction
    |
Line normalization
    |
Receipt-line classification
    |
Quantity and price parsing
    |
Product matching
    |
Confidence scoring
    |
User confirmation
    |
Shelf-price comparison
    |
Save verified receipt
```

Image preprocessing may include:

* Rotation correction
* Cropping
* Perspective correction
* Contrast adjustment
* Resizing
* Multi-page receipt ordering

Receipt lines should be classified where possible as:

* Product line
* Quantity line
* Discount line
* Tax line
* Subtotal
* Total
* Payment line
* Header
* Footer
* Unknown

Receipt product descriptions may be abbreviated and may not match saved product
names.

The application should store store-specific receipt aliases so confirmed matches
can improve future receipt matching.

Example:

```text
Receipt alias: "NEST MILK 1L"
Product: Nestlé Fresh Milk 1 Liter
Store: Example Supermarket
```

## Sync Engine

* Use custom **pull/push delta synchronization** between the mobile application
  and the shared backend API over HTTPS.
* The mobile application should communicate with the application backend rather
  than accessing Turso directly.
* The backend is responsible for:

  * Authentication and authorization
  * Validation
  * Delta generation
  * Conflict resolution
  * Revision assignment
  * Tombstone handling
  * Image-upload coordination
* SQLite remains the source of truth for the mobile user interface.
* Turso/libSQL is the shared cloud database behind the backend API.

Managed synchronization systems such as PowerSync or ElectricSQL are not part of
the initial Turso architecture. They may be reconsidered only if the backend
database architecture changes to one they officially support.

Each synchronized record should include:

* `id`
* `created_at`
* `updated_at`
* `deleted_at`
* `device_id`
* `revision`
* `sync_status`

All timestamps must use UTC.

`revision` should be assigned or validated by the server and should be monotonic
for each record.

### Conflict Resolution

The required conflict strategy is timestamp-based last-write-wins.

To support last-write-wins per field, the application should store field-level
modification metadata or synchronize mutations containing only changed fields.

A suggested record structure is:

```text
id
created_at
updated_at
deleted_at
device_id
revision
sync_status
field_versions_json
```

The system must not rely only on the device clock.

The server should validate or assign authoritative synchronization timestamps to
reduce clock-skew issues.

Conflict handling should retain an audit trail containing:

* Local revision
* Remote revision
* Conflicting fields
* Winning values
* Replaced values
* Conflict timestamp
* Originating devices

Deleted records must remain as tombstones until deletion has been synchronized
to relevant devices.

The sync engine should support:

* Batched mutation upload
* Delta download using a server cursor
* Idempotent mutation processing
* Retry with exponential backoff
* Resumable image uploads
* Manual synchronization
* Foreground synchronization indicators
* Last successful sync timestamp
* Per-record sync error reporting

## Background Tasks

Use:

* `expo-task-manager`
* `expo-background-task`

Do not use the deprecated `expo-background-fetch` package.

Background work may attempt:

* Periodic delta synchronization
* Pending image-upload flushing
* Cleanup of uploaded temporary files
* Retry of failed mutations

Background execution is best-effort. Android and iOS decide when deferred tasks
run, and the application must not promise immediate synchronization when a
network connection returns.

Foreground synchronization remains the primary reliable sync path.

## State Management

* Use **Zustand** for transient UI and application state, including:

  * Current scanner state
  * Camera state
  * Active screen state
  * Temporary form input
  * Modal state
  * Running UI selections
* Use **TanStack Query** for optional server-only lookups such as:

  * External barcode enrichment
  * Optional online product information
  * Server health and account status

Local SQLite is the canonical application store.

Important shopping-trip, product, price, receipt, and list data must be persisted
to SQLite rather than held only in Zustand.

## Navigation

Use:

* `@react-navigation/native`
* Native stack navigation
* Bottom-tab navigation

Primary application sections:

* Shopping
* Lists
* Capture
* Library
* History
* Settings

Suggested primary flows:

```text
Shopping
  ├── Start Trip
  ├── Active Trip
  ├── Product Scan
  ├── Price Capture
  ├── Receipt Verification
  └── Trip Summary

Lists
  ├── List Overview
  ├── List Editor
  └── Convert List to Trip

Library
  ├── Products
  ├── Product Details
  ├── Categories
  └── Stores

History
  ├── Previous Trips
  ├── Receipts
  └── Purchases
```

## UI / Styling

Use either:

* **NativeWind**
* **Tamagui**

The selected system should provide:

* Consistent design tokens
* Light and dark themes
* Accessible text sizing
* Reusable form components
* Reusable capture overlays
* Shared visual language with the desktop application

Reusable platform-compatible components may be extracted into:

```text
packages/ui
```

Native camera and OCR components should remain mobile-specific.

## Permissions & Hardware

Required permissions:

* Camera

Optional permissions:

* Photo library
* Notifications

Network access is used for:

* Data synchronization
* Image uploads
* Optional online product enrichment
* Account and authentication operations

The application must remain useful when network access is unavailable.

Permission requests should occur only when the related feature is first used and
must explain why the permission is needed.

## Testing

Use:

* **Jest**
* **React Native Testing Library**
* **Detox**
* SQLite integration fixtures

Required unit and integration coverage includes:

* Price parsing
* Currency normalization
* Unit conversion
* Unit-price calculations
* Receipt-line classification
* Receipt product matching
* Barcode normalization
* Duplicate-scan detection
* Conflict resolution
* Tombstone handling
* Delta synchronization
* Retry behavior
* Database migrations

Required end-to-end flows include:

* Start trip → scan known product → capture price → complete trip
* Scan unknown barcode → create product → capture price
* Add product without barcode
* Detect duplicate scan → increase quantity
* Capture receipt → correct OCR → verify price discrepancy
* Create shopping list → convert to trip
* Complete a trip offline → synchronize later
* Create conflicting changes on two devices → synchronize
* Delete a product or list offline → synchronize tombstone
* Recover an active trip after application termination

Snapshot tests should be limited to stable parsing and rendering output where
they provide meaningful regression protection.

## Build, CI/CD & Distribution

* Use **EAS Build** for Android and iOS binaries.
* Use **EAS Update** for JavaScript and asset updates compatible with the
  installed runtime.
* Use GitHub Actions for:

  * Type checking
  * Linting
  * Unit tests
  * Integration tests
  * Migration validation
  * Build-size checks
* Trigger release builds from version tags or a dedicated release workflow.
* Manage signing credentials through EAS.
* Distribute through:

  * TestFlight for iOS testing
  * Internal Play Store tracks for Android testing
  * Apple App Store
  * Google Play Store

Runtime-version policies must prevent OTA updates from being installed on
incompatible native builds.

## Performance & Storage Targets

* Barcode recognition target: under 300 ms after the barcode is visible and in
  focus on supported devices.
* OCR must always provide a confirmation and edit step.
* Active shopping-trip interactions should not depend on network latency.
* Common local database queries should complete without noticeable UI delay.
* Local database growth target: approximately 1–3 MB per 100 purchases,
  excluding original full-resolution images.
* Original images should be uploaded to object storage and removed from the
  local cache according to user settings.
* Thumbnails may remain cached locally.
* Final Android and iOS binary-size budgets must be measured during the proof of
  concept.
* CI should track binary-size changes between releases.

## Key Risks & Mitigations

### OCR accuracy on receipts

**Risk:** Receipts contain abbreviations, poor printing, folds, shadows, and
complex layouts.

**Mitigation:**

* Always require confirmation.
* Store raw and corrected values.
* Use line classification.
* Learn store-specific receipt aliases.
* Preserve confidence and source information.
* Allow manual line creation and deletion.

### OCR overlay alignment

**Risk:** Bounding boxes may not align after image scaling, rotation, cropping,
or orientation correction.

**Mitigation:**

* Normalize image orientation before OCR.
* Store source image dimensions.
* Implement a tested coordinate transformation layer.
* Validate on physical Android and iOS devices.

### Duplicate scans

**Risk:** A user may scan the same item several times.

**Mitigation:**

* Detect matching barcode scans within the active trip.
* Offer to increase quantity instead of creating a duplicate line.
* Allow the user to intentionally create separate entries when prices differ.

### Sync conflicts

**Risk:** Multiple devices may update the same product or trip while offline.

**Mitigation:**

* Use server revisions.
* Use field-level modification metadata.
* Apply timestamp-based LWW per field.
* Retain an audit trail.
* Do not trust device clocks as authoritative.

### Deleted records returning

**Risk:** A deleted record may reappear after synchronization with an offline
device.

**Mitigation:**

* Use `deleted_at` tombstones.
* Synchronize deletions like other mutations.
* Retain tombstones until synchronization safety conditions are met.

### Background-sync limitations

**Risk:** Android and iOS may delay or skip background work.

**Mitigation:**

* Synchronize at startup and foreground resume.
* Synchronize after important writes when online.
* Provide a manual sync action.
* Display pending-change and last-sync status.
* Treat background tasks only as an optimization.

### ML Kit dependency compatibility

**Risk:** Community modules or ML Kit versions may become incompatible with Expo,
React Native, or the New Architecture.

**Mitigation:**

* Pin all native versions.
* Validate release builds before upgrades.
* Maintain a native proof-of-concept test application.
* Avoid automatic native dependency upgrades.
* Document known compatible version combinations.

### ML Kit binary size

**Risk:** Bundled OCR models and native frameworks increase application size.

**Mitigation:**

* Measure actual binary size on Android and iOS.
* Track size in CI.
* Bundle only required recognition models.
* Evaluate alternative model delivery only if offline-first requirements can
  still be met.

### Manual product capture friction

**Risk:** Unknown products require several manual fields.

**Mitigation:**

* Require only the product name initially.
* Reuse recent brands and categories.
* Provide category defaults.
* Allow later editing.
* Use receipt aliases and product history to improve future recognition.

### Floating-point pricing errors

**Risk:** JavaScript floating-point calculations may produce incorrect totals.

**Mitigation:**

* Store money in integer minor units.
* Use fixed-precision quantity arithmetic.
* Centralize all pricing calculations in tested shared utilities.

### Image storage growth

**Risk:** Shelf and receipt photos may consume excessive local storage.

**Mitigation:**

* Compress images before storage.
* Keep thumbnails by default.
* Make original retention opt-in.
* Upload originals to object storage.
* Remove synchronized temporary files.
* Show storage usage in settings.
