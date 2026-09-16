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
- **Live spending dashboard**: summary stat cards, daily/weekly/monthly
  series chart, spending-by-store and by-category breakdowns, and a price
  watch table (latest/average/range/trend with at-low/at-high flags) — all
  read through the shared `DataSource` with loading, empty, and error states
  and a range filter
- **Analytics read layer** with three interchangeable sources selected in
  one place (`resolveDataSource`):
  - `DesktopSqliteDataSource` — local SQLite replica via Tauri `plugin-sql`,
    aggregations computed in SQL (summary, bucketed series, per-store /
    per-category joins, window-function price statistics); runs the same
    embedded migrations as mobile (`user_version` runner over `drizzle/*.sql`,
    embedded by `scripts/embed-migrations.mjs`); integration-tested against
    better-sqlite3 with the exact same SQL
  - `ApiDataSource` — typed client for the future backend analytics
    endpoints (`NEXT_PUBLIC_API_BASE_URL`, dormant while unset)
  - `PlaceholderDataSource` — empty states before any backend exists
- Domain analytics calculations in `src/domain/analytics.ts` (pure,
  per-currency, integer minor units): spending summaries, ISO-week/day/month
  bucketing, store/category breakdowns, price statistics with trend and
  at-extreme flags
- Drizzle schema mirroring the backend tables, including
  `field_versions_json` on every synced record (parity with mobile restored)
  and analytics rollup tables, per `tech.desktop.md`
- Money stored as integer minor units with an ISO currency code on every
  monetary record (see `src/lib/money.ts`)
- 26 Vitest tests: money utils, domain analytics, desktop SQL source over
  better-sqlite3 fixtures
- Tauri 2 wrapper with `plugin-sql`, `plugin-fs`, and `plugin-dialog` registered
  behind a least-privilege capability
- CI: typecheck, lint, tests, and **both** target builds (web + static
  export) on every PR

## Not yet implemented (next phases)

- The backend itself (analytics endpoints + `/sync/push` + `/sync/pull`);
  `ApiDataSource` documents the contract and is dormant until then
- Clerk authentication (`@clerk/nextjs`) and protected routes
- Desktop write path: delta-sync engine over the local replica (the mobile
  protocol and engine are the reference implementation)
- Rollup maintenance jobs, TanStack Table data tables, search, and report
  exports (CSV/Excel/PDF)
- Playwright E2E and component tests
