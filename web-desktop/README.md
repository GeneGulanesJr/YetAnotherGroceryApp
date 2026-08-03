# YetAnotherGroceryApp — Web / Desktop

The web and desktop applications are the analytics, reporting, and
data-management surface for YetAnotherGroceryApp. They share a single Next.js
codebase: the **web** build runs on a Node.js runtime, while the **desktop**
build is a static export embedded in a **Tauri 2** webview.

This package contains the initial scaffold. See [`../tech.desktop.md`](../tech.desktop.md)
for the full technical requirements.

## Stack

- **Next.js** (App Router) + **React** + **TypeScript** (strict mode)
- **Tauri 2** for desktop packaging (Windows, macOS, Linux)
- **Tailwind CSS** + **shadcn/ui** (Radix primitives) with light/dark themes
- **TanStack Query** for backend data fetching and caching
- **TanStack Table** for data tables (sorting, filtering, pagination)
- **Recharts** for dashboard charts
- **Zustand** for transient UI state only
- **nuqs** for URL-synced dashboard filters (bookmarkable views)
- **Drizzle ORM** schema (SQLite/libSQL) mirroring the backend + analytics rollups
- **Vitest** for unit/component tests
- Money stored as integer minor units (see `src/lib/money.ts`)

## Web vs. desktop targets

| Target   | Command                   | Runtime                     | Output        |
| -------- | ------------------------- | --------------------------- | ------------- |
| `web`    | `npm run build`           | Next.js on Node.js          | SSR + RSC     |
| `desktop`| `npm run build:desktop`   | Next.js static export       | `out/` → Tauri |

`APP_TARGET=desktop` switches `next.config.mjs` to `output: "export"`, disables
the image optimizer, and enables trailing slashes so routes resolve from the
filesystem inside the Tauri webview. The desktop build must not depend on
Server Actions, runtime Route Handlers, middleware, or ISR (see `tech.desktop.md`).

## Project structure

```
web-desktop/
├── src/
│   ├── app/                 # App Router: layout, dashboard, placeholder routes
│   │   ├── layout.tsx       # Providers (theme, query) + app shell
│   │   ├── globals.css      # Tailwind + shadcn design tokens (light/dark)
│   │   ├── page.tsx         # Spending dashboard (cards + chart)
│   │   └── products|stores|reports|settings/page.tsx
│   ├── components/          # app shell, providers, charts, shadcn ui/*
│   ├── lib/                 # utils, money (parsing/formatting + tests), DataSource
│   ├── theme/               # Design tokens
│   ├── store/               # Zustand (transient UI state)
│   └── db/                  # Drizzle schema mirroring backend + analytics rollups
├── src-tauri/               # Tauri 2 desktop wrapper (Rust)
│   ├── tauri.conf.json      # frontendDist → ../out, native plugins
│   ├── capabilities/        # least-privilege permissions for the main window
│   └── src/                 # plugin registration (sql, fs, dialog)
├── next.config.mjs          # web / desktop (static export) switch
├── tailwind.config.ts
├── components.json          # shadcn/ui config
└── drizzle.config.ts        # migration generation
```

## Primary sections

Dashboard · Products · Stores · Reports · Settings — matching the analytics
surfaces described in the technical requirements.

## Scripts

| Script                | Description                                          |
| --------------------- | ---------------------------------------------------- |
| `npm run dev`         | Start the Next.js dev server                         |
| `npm run build`       | Production web build (Node.js runtime)               |
| `npm run build:desktop` | Static export for Tauri (`APP_TARGET=desktop`)     |
| `npm run start`       | Serve the web production build                       |
| `npm run lint`        | ESLint (next/core-web-vitals)                        |
| `npm run typecheck`   | `tsc --noEmit`                                       |
| `npm test`            | Vitest unit tests                                    |
| `npm run tauri:dev`   | Run the desktop app in the Tauri webview (Rust)      |
| `npm run tauri:build` | Build signed desktop installers (Rust)               |

> Desktop builds require the Rust toolchain and generated app icons
> (`npm run tauri icon <source-image>`).

## What is implemented

- Next.js + TypeScript strict project bootstrapping (App Router)
- Web vs. desktop build switch via `APP_TARGET` (static export for Tauri)
- App shell with sidebar navigation and five primary sections
- Tailwind + shadcn/ui theming with light/dark mode (next-themes)
- TanStack Query and Zustand providers wired up
- Spending dashboard placeholder with summary stat cards + a Recharts chart
- Drizzle schema mirroring the backend tables (`categories`, `images`,
  `stores`, `products`, `product_barcodes`, `prices`, `trips`, `receipts`,
  `receipt_lines`, `purchases`, `shopping_lists`, `shopping_list_items`,
  `sync_mutations`, `sync_meta`), each carrying the shared sync columns
  (`id`, timestamps, `device_id`, `revision`, `sync_status`) plus indexes on
  commonly queried and synchronized fields — so the desktop SQLite replica can
  apply the same delta-sync payloads as mobile
- Desktop analytics rollups (`daily_spending_rollups`,
  `monthly_spending_rollups`, `product_price_rollups`,
  `store_product_price_rollups`, `category_spending_rollups`,
  `receipt_savings_rollups`) maintained in code and rebuildable from canonical
  records, per `tech.desktop.md`
- Money stored as integer minor units with an ISO currency code on every
  monetary record (see `src/lib/money.ts`); image records persist local URI,
  remote object key, thumbnail, MIME, dimensions, size, SHA-256, and upload
  status
- Shared `DataSource` interface so web (API) and desktop (SQLite) targets share
  dashboard components
- Integer-minor-unit money parsing/formatting utilities with unit tests
- Tauri 2 wrapper with `plugin-sql`, `plugin-fs`, and `plugin-dialog` registered
  behind a least-privilege capability

## Not yet implemented (next phases)

- Typed backend API client (`packages/api-client`) and real dashboard data
- Clerk authentication (`@clerk/nextjs`) and protected routes
- Optional local SQLite replica + pull/push delta sync for offline desktop
- Full analytics (product/store/category/price-intelligence/savings)
- TanStack Table data tables, search, and report exports (CSV/Excel/PDF)
- Backend rollup maintenance jobs and migration runner
- Playwright E2E and component tests
