# Tech Requirements — Web / Desktop Application

The web/desktop application is the analytics, reporting, and data-management
surface for YetAnotherGroceryApp. It consumes the purchase, price, and trip data
captured on mobile (via the shared synced database) and turns it into dashboards,
product/store/category analytics, price intelligence, savings insights, and
exportable reports.

---

## Platform Strategy

- **Single codebase** delivering both a web app and a native desktop app.
- Web: modern evergreen browsers (Chrome, Edge, Firefox, Safari).
- Desktop: Windows, macOS, Linux via a thin native wrapper.
- Reads from the same synced data store as the mobile app — no duplicate data
  entry. Timestamp-based conflict resolution is handled at the sync layer.

## Framework & Language

- **Next.js** (React) with **TypeScript** (strict mode).
- App Router, server components for heavy aggregations where a Node backend is
  used; client components for interactive dashboards.
- Shared TypeScript packages with the mobile app:
  - `packages/db` — Drizzle schema + migrations (SQLite/Postgres compatible).
  - `packages/ui` — reusable chart and form components.
  - `packages/domain` — analytics/business logic (price stats, savings calc,
    duplicate detection).

## Desktop Wrapper

- **Tauri** (Rust-based) for the desktop build — small binaries, low memory,
  native webview, and direct local filesystem/SQLite access for a true
  offline-capable desktop experience.
- Tauri preferred over Electron for bundle size, memory footprint, and security
  posture. The same Next.js static export is embedded inside the Tauri webview.
- Optional: local desktop instance can run its own SQLite replica and sync like
  mobile, enabling a fully offline desktop app.

## Charts & Visualization

| Need | Library |
| --- | --- |
| Standard charts (line, bar, area, pie) | **Recharts** |
| Complex/interactive analytics, heatmaps, large datasets | **Apache ECharts** (`echarts-for-react`) |
| Date/time axes (spending trends, price history) | Recharts time scale or ECharts |
| Tables with sorting/filtering/aggregation | **TanStack Table** |

## Data Access & Sync

- Primary data source: the synced database (Postgres on the backend; optional
  local SQLite replica on desktop).
- **Drizzle ORM** for typed queries; shared schema with mobile.
- Aggregations (daily/weekly/monthly/yearly spending, unit-price trends, store
  comparisons) computed via SQL where possible, cached at the API edge.
- **TanStack Query** for server-state caching, refetching, and pagination on
  the client.

## State Management

- **Zustand** for client UI state (filters, selected date range, theme).
- **TanStack Query** for all server data.
- URL state (via `nuqs` or Next.js searchParams) for shareable, bookmarkable
  dashboard filters and date ranges.

## Reporting & Export

- **Reports** (spending, price history, store comparisons, savings): generated
  server-side and exported to **PDF** via `@react-pdf/renderer` or **Puppeteer**
  for richly styled reports.
- **CSV/Excel** export via `papaparse` / `exceljs` for raw data dumps.
- Scheduled/periodic report generation optional via a backend job queue.

## Search

- Local filtered search over products, barcodes, brands, stores, categories,
  trips, and price ranges via TanStack Table + server-side filters.
- Optional full-text search upgrade: **Postgres full-text search** (tsvector) or
  **Meilisearch**/**Typesense** if fuzzy product/brand search is needed at scale.

## Backend (Shared with Mobile)

- **Node.js** API (Fastify or NestJS) exposing the sync protocol and read APIs
  for dashboards.
- **PostgreSQL** as the canonical cloud store.
- Object storage (e.g. S3-compatible) for original shelf/receipt/product images;
  DB stores only references + compressed thumbnails.
- Auth: per-user accounts (email/password or OAuth); one or more devices per
  user. Desktop and mobile both authenticate as the same user.

## UI / Styling

- **Tailwind CSS** (NativeWind counterpart on mobile) for a consistent design
  language across surfaces.
- **shadcn/ui** (Radix-based) primitives for accessible components.
- Dark mode + responsive layouts; dashboards designed for large screens, with
  graceful degradation to tablet widths.

## Testing

- **Vitest** for unit/domain logic (price stats, savings calculations, duplicate
  detection, inflation metrics).
- **React Testing Library** for component tests.
- **Playwright** for end-to-end dashboard/report/export flows across browsers.
- Visual regression optional via Playwright snapshots.

## Build, CI/CD & Distribution

- Web: deploy Next.js to a Node host or edge platform (Vercel/self-hosted).
- Desktop: Tauri builds per OS, code-signed, distributed via GitHub Releases and
  auto-update (Tauri updater).
- CI: GitHub Actions — typecheck, lint, test → build web → build Tauri per OS →
  publish.

## Performance Targets

- Dashboard initial load with aggregated data < 1.5 s on a typical connection.
- Chart rendering smooth for multi-year datasets via downsampling and
  memoization.
- Large result sets paginated or virtualized (`@tanstack/react-virtual`).

## Key Risks & Mitigations

- **Heavy aggregations on large histories** → pre-aggregate / materialize common
  rollups (daily/weekly/monthly) and cache.
- **Cross-platform data consistency** → single shared schema + shared domain
  package so analytics logic is identical across web and desktop.
- **Report fidelity** → server-side PDF rendering ensures consistent output
  regardless of the client browser/OS.
- **Offline desktop use** → optional local SQLite replica + sync, mirroring the
  mobile offline-first model.
