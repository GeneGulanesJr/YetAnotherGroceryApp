# Tech Requiremeis the analytics, reporting, and data-management

surface for YetAnotherGroceryApp.

It consumes purchase, price, receipt, product, store, and shopping-trip data
captured by the mobile application through the shared backend and transforms it
into dashboards, product/store/category analytics, price intelligence, savings
insights, search tools, and exportable reports.

---

## Platform Strategy

* **Single shared frontend codebase** targeting both web and desktop.
* Web support:

  * Chrome
  * Edge
  * Firefox
  * Safari
* Desktop support:

  * Windows
  * macOS
  * Linux
* The web and desktop applications use the same backend, domain models,
  validation rules, analytics calculations, and API contracts.
* No duplicate data entry is required between mobile, web, and desktop.
* The web application is primarily online and reads data through the shared
  backend API.
* The desktop application may optionally maintain a local SQLite replica for
  offline analytics, history browsing, reporting, and data management.
* Synchronization uses the same custom pull/push delta protocol as the mobile
  application.
* Timestamp-based last-write-wins conflict resolution is handled by the shared
  synchronization layer.
* All dates are stored in UTC and displayed using the user’s selected timezone.

The web and desktop builds have different runtime capabilities:

* The web build may use Next.js server components, route handlers, and server-side
  rendering when deployed with a Node.js runtime.
* The Tauri desktop build uses a static Next.js export and does not have a
  Next.js or Node.js server at runtime.
* Desktop runtime operations must use:

  * The shared backend API
  * Local SQLite
  * Tauri commands or plugins

Next.js features that require a runtime server must not be required by the
desktop build. Tauri officially treats the frontend as static content, and its
Next.js integration uses `output: "export"`. & Language

* **Next.js** with React
* **TypeScript** with strict mode enabled
* **Next.js App Router**
* **Tauri 2** for desktop packaging
* Shared TypeScript packages with the mobile application

The web build may use:

* React Server Components
* Server-side data fetching
* Route Handlers
* Streaming and loading states
* Server-side authentication checks

The desktop build must use:

* Static export through `output: "export"`
* Client-side data fetching
* Tauri APIs for native functionality
* The shared backend API for remote data
* Local SQLite for optional offline data

The desktop build must not depend on:

* Server Actions
* Runtime Next.js Route Handlers
* Next.js middleware or proxy logic
* Runtime server-side rendering
* Incremental Static Regeneration
* Default Next.js image optimization
* Other features requiring a Next.js server

These features are unavailable or restricted when using a static Next.js export.
kage Structure

Recommended monorepo structure:

```text
apps/
  mobile/
  web/
  desktop/
  api/

packages/
  database/
  domain/
  api-client/
  sync/
  reports/
  validation/
  ui/
  utilities/
```

Shared packages should include:

### `packages/database`

* Drizzle schema definitions
* SQLite/libSQL migrations
* Database types
* Query helpers
* Rollup-table definitions
* Test fixtures

### `packages/domain`

* Price statistics
* Savings calculations
* Unit-price calculations
* Grocery inflation calculations
* Duplicate detection
* Product matching
* Store comparisons
* Category analytics
* Date-range grouping
* Currency and quantity handling

### `packages/api-client`

* Typed backend client
* Request and response types
* Authentication-token handling
* Pagination helpers
* Error normalization

### `packages/sync`

* Delta synchronization types
* Mutation queue models
* Conflict-resolution logic
* Revision and cursor handling
* Tombstone handling

### `packages/reports`

* Report data models
* Report formatting
* CSV and spreadsheet helpers
* PDF report layouts
* Shared report calculations

### `packages/ui`

* Design tokens
* Forms
* Data tables
* Dashboard cards
* Chart wrappers
* Date-range controls
* Empty and loading states

Native Tauri components and commands should remain inside the desktop
application.

## Desktop Wrapper

Use **Tauri 2** for the desktop application.

Tauri is selected because it provides:

* Small application bundles compared with shipping a complete browser runtime
* Lower baseline memory usage
* Native Windows, macOS, and Linux packages
* Native filesystem access
* Local SQLite access
* Native menus, dialogs, notifications, and updater support
* Fine-grained permissions for native functionality

The Next.js desktop build is generated as a static export and embedded in the
Tauri webview.

Example build behavior:

```text
Web build:
Next.js application
    |
Node.js deployment
    |
Server and client rendering available

Desktop build:
Next.js static export
    |
Tauri webview
    |
Backend API + local SQLite + Tauri commands
```

Use separate build configuration or environment variables to distinguish the
two targets.

Example:

```text
APP_TARGET=web
APP_TARGET=desktop
```

Platform-specific behavior must be isolated behind shared interfaces rather
than scattered throughout dashboard components.

Examples:

```text
DataSource
  ├── WebApiDataSource
  └── DesktopSqliteDataSource

FileExporter
  ├── BrowserDownloadExporter
  └── TauriFilesystemExporter
```

## Desktop Native Access

Use official Tauri plugins where appropriate:

* `@tauri-apps/plugin-sql` for local SQLite access
* `@tauri-apps/plugin-fs` for export and backup files
* `@tauri-apps/plugin-dialog` for native file dialogs
* `@tauri-apps/plugin-updater` for desktop updates
* `@tauri-apps/plugin-deep-link` when required by authentication callbacks
* `@tauri-apps/plugin-notification` for optional report or sync notifications

The official Tauri SQL plugin supports SQLite and exposes database access to the
frontend through Tauri’s native layer. sions must follow least-privilege principles.

* Only enable commands required by the application.
* Limit filesystem access to approved application-data and user-selected paths.
* Do not expose unrestricted shell execution.
* Do not load arbitrary remote content into a webview that has native
  permissions.
* Define separate Tauri capability files for native features.

Tauri capabilities determine which windows and webviews may access individual
native commands and plugins. isualization

| Need                                                        | Library                                                    |
| ----------------------------------------------------------- | ---------------------------------------------------------- |
| Standard line, bar, area, and pie charts                    | **Recharts**                                               |
| Complex analytics, heatmaps, and large interactive datasets | **Apache ECharts** through `echarts-for-react`             |
| Tables with sorting, filtering, grouping, and aggregation   | **TanStack Table**                                         |
| Large table and list virtualization                         | **TanStack Virtual**                                       |
| Date manipulation and grouping                              | **date-fns** or **Temporal** through a compatible polyfill |

Begin with Recharts for standard dashboards.

Add Apache ECharts only when a visualization cannot be implemented efficiently
with the standard chart layer. This avoids shipping two large charting systems
for every screen unnecessarily.

All charts should support:

* Accessible labels and summaries
* Tooltips
* Currency formatting
* User-selected date ranges
* Store and category filters
* Empty-data states
* Loading states
* Export-friendly layouts
* Reduced-motion preferences

Analytics screens should provide a table or textual summary for important chart
information rather than relying entirely on visual interpretation.

## Core Analytics

The application should support:

### Spending Dashboard

* Daily spending
* Weekly spending
* Monthly spending
* Yearly spending
* Spending by store
* Spending by category
* Average trip cost
* Average basket size
* Shopping frequency

### Product Analytics

* Purchase history
* Latest price
* Average price
* Lowest price
* Highest price
* Best historical price
* Unit-price history
* Price trend
* Purchase frequency
* Average quantity purchased
* Average time between purchases
* Preferred purchasing store
* Recent price movement

### Store Analytics

* Number of visits
* Total spending
* Average basket cost
* Average basket size
* Average product prices
* Average unit prices
* Most purchased products
* Cheapest store for individual products
* Last visit date
* Receipt discrepancy history

### Category Analytics

* Spending by category
* Purchase frequency
* Average purchase amount
* Category trends over time
* Category price movement
* Percentage of total spending

### Price Intelligence

* Price increases
* Price decreases
* Historical pricing
* Unit-price trends
* Personal grocery inflation
* Seasonal price changes
* Products above their historical average
* Products below their historical average
* Products at historical low prices
* Products at historical high prices

### Receipt and Savings Analytics

* Number of receipt discrepancies
* Missing discounts
* Duplicate charges
* Incorrect quantities
* Total overcharges detected
* Total savings from corrected pricing
* Savings by store
* Savings by month
* Stores with the most discrepancies
* Products most frequently mispriced
* Lifetime savings

All analytics must use the shared domain package so calculations remain
consistent across web, desktop, reports, and future application surfaces.

## Data Access & Sync

The canonical cloud database is **Turso/libSQL**, accessed through the shared
backend API.

The application must not use PostgreSQL-specific schemas or features unless the
project deliberately changes database providers.

Use **Drizzle ORM** with the SQLite/libSQL dialect for:

* Turso queries in the backend
* Local desktop SQLite queries
* Shared schema definitions
* Migrations
* Typed query results

Drizzle officially supports Turso/libSQL through its libSQL integration.
access

The web application should:

* Authenticate through Clerk.
* Request dashboard and report data from the backend API.
* Use server-side requests from Server Components when beneficial.
* Hydrate interactive client components with prefetched data.
* Use client-side requests for filter changes, pagination, and live updates.

The browser must not receive Turso database credentials.

### Desktop online data access

When the local replica is disabled, the desktop application should:

* Authenticate through Clerk.
* Send authenticated requests directly to the shared backend API.
* Cache transient server data through TanStack Query.
* Store only limited non-sensitive preferences locally.

### Desktop offline data access

When the local replica is enabled:

* SQLite is the source of truth for the desktop user interface.
* Remote records are synchronized into the local database.
* Local changes are written to SQLite first.
* Mutations are queued for upload.
* Delta synchronization runs when connectivity is available.
* The interface displays pending changes and the last successful sync time.

The desktop sync engine should follow the same protocol as mobile:

```text
Local mutations
    |
Push mutation batch
    |
Backend validation and revision assignment
    |
Pull changes after sync cursor
    |
Apply remote changes to local SQLite
    |
Update sync cursor
```

Each synchronized record should include:

* `id`
* `created_at`
* `updated_at`
* `deleted_at`
* `device_id`
* `revision`
* `sync_status`

The backend remains responsible for:

* Authentication
* Authorization
* Validation
* Conflict resolution
* Revision assignment
* Delta generation
* Tombstone retention
* Idempotency
* Audit history

## Aggregations

Compute analytics through SQL where practical.

Examples include:

* Daily totals
* Weekly totals
* Monthly totals
* Yearly totals
* Spending by category
* Spending by store
* Average product prices
* Unit-price trends
* Receipt discrepancy totals

For expensive or frequently requested analytics, maintain application-managed
rollup tables such as:

```text
daily_spending_rollups
monthly_spending_rollups
product_price_rollups
store_product_price_rollups
category_spending_rollups
receipt_savings_rollups
```

Because SQLite/libSQL does not use PostgreSQL-style materialized views, common
rollups should be maintained through application jobs or transactional update
logic.

Rollups must be rebuildable from canonical purchase, price, trip, and receipt
records.

Each rollup should store:

* User ID
* Aggregation key
* Date or period
* Currency
* Calculated values
* Source revision or rebuild version
* Updated timestamp

Do not mix monetary values from different currencies unless a documented
currency-conversion process is introduced.

## Client Data and State Management

Use **TanStack Query** for:

* Backend data fetching
* Request caching
* Pagination
* Retry handling
* Background refresh
* Request cancellation
* Cache invalidation

Use **Zustand** only for transient interface state such as:

* Open panels
* Selected chart mode
* Temporary table configuration
* Desktop window-specific state
* Unsaved form state

Use URL state through Next.js search parameters or `nuqs` for:

* Date ranges
* Selected stores
* Selected categories
* Product filters
* Sorting
* Pagination
* Dashboard tabs

URL-based state allows web dashboards to be bookmarked and shared.

Sensitive information and large result sets must not be placed in URLs.

When running inside Tauri, filters should still use a serializable state format
so navigation behavior remains consistent with the web build.

## Authentication

Use **Clerk** for shared account authentication.

### Web

Use `@clerk/nextjs` for:

* Sign-up
* Sign-in
* OAuth
* Session handling
* Protected routes
* Server-side authentication
* Retrieving tokens for backend API calls

Clerk provides App Router support for client and server authentication in
Next.js. The Tauri application must authenticate against the same Clerk account and send
a valid Clerk token to the backend API.

The final desktop authentication flow must be validated during a proof of
concept, including:

* Email/password sign-in
* OAuth sign-in
* Session restoration
* Token renewal
* Sign-out
* Multiple desktop instances
* Deep-link callback handling
* Expired-session behavior

OAuth may require opening the system browser and returning to the application
through a registered deep link.

Authentication tokens must not be stored as plain text in browser
`localStorage`.

Use a secure native credential or encrypted-secret storage integration for
desktop session material.

The backend must verify authentication and authorization for every request.
Client-side route protection is not a security boundary.

## Search

The initial search implementation should use indexed backend queries over:

* Product name
* Barcode
* Brand
* Store
* Category
* Shopping-trip date
* Price range
* Receipt description
* Recently purchased products

Use normalized searchable columns where helpful.

Examples:

* Lowercase product name
* Lowercase brand
* Normalized barcode
* Normalized receipt alias
* Normalized store name

Initial search should support:

* Exact barcode lookup
* Prefix matching
* Partial product-name matching
* Brand filtering
* Store filtering
* Category filtering
* Date ranges
* Price ranges
* Pagination

Optional search upgrades include:

* SQLite/libSQL full-text search after verifying support in the selected
  deployment configuration
* Meilisearch
* Typesense

A separate search service should only be introduced when the database-backed
search no longer meets measured performance or fuzzy-search requirements.

## Reporting & Export

Support reports for:

* Spending history
* Product price history
* Store comparisons
* Category spending
* Shopping trends
* Receipt discrepancies
* Savings
* Grocery inflation
* Complete raw-data exports

### PDF

Use one of the following:

* `@react-pdf/renderer` for deterministic, component-based reports
* Playwright or Puppeteer on the backend for HTML-based reports requiring
  complex dashboard styling

Backend-generated PDFs should use a fixed report-data model rather than loading
the normal authenticated dashboard page inside a headless browser.

The desktop application may:

* Request a PDF from the backend while online
* Generate supported reports locally from synchronized SQLite data when offline
  export is required

### CSV

Use a tested CSV serializer such as `papaparse` or a small shared export utility
with proper escaping.

CSV exports must defend against spreadsheet-formula injection by escaping cells
that begin with characters such as:

```text
=
+
-
@
```

### Excel

Use `exceljs` for `.xlsx` exports that require:

* Multiple worksheets
* Formatted headers
* Currency formats
* Date formats
* Summary worksheets
* Frozen rows
* Filters

Large exports should be generated as streams on the backend rather than loading
the entire workbook into browser memory.

### File handling

The web application should use normal browser downloads.

The Tauri application should use native save dialogs and restrict filesystem
access to the path selected by the user.

## UI / Styling

Use:

* **Tailwind CSS**
* **shadcn/ui**
* Radix UI primitives where appropriate

The design system should provide:

* Light mode
* Dark mode
* Responsive layouts
* Accessible focus states
* Keyboard navigation
* Screen-reader labels
* Consistent currency and date formatting
* Loading skeletons
* Empty states
* Error states
* Offline and synchronization indicators

Dashboards should prioritize desktop and laptop layouts while remaining usable
at tablet widths.

Important analytics must not rely only on color. Use labels, icons, patterns, or
text to communicate positive and negative values.

## Data Tables

Use **TanStack Table** for:

* Sorting
* Filtering
* Column visibility
* Grouping
* Row selection
* Pagination
* Aggregated footers

Use server-side sorting, filtering, and pagination for large datasets.

Use **TanStack Virtual** when displaying long local result sets.

Data-table preferences may be stored locally per device, including:

* Visible columns
* Column order
* Column width
* Default page size
* Sort order

User data and report results must not be stored inside preference storage.

## Testing

Use:

* **Vitest** for unit and domain tests
* **React Testing Library** for component tests
* **Playwright** for browser end-to-end tests
* Rust unit tests for custom Tauri commands
* SQLite integration fixtures for offline desktop behavior

Required unit coverage includes:

* Price statistics
* Unit-price calculations
* Savings calculations
* Grocery inflation
* Date grouping
* Currency formatting
* Duplicate detection
* Rollup generation
* Report transformations
* Export escaping
* Conflict resolution

Required web end-to-end flows include:

* Sign in
* Load dashboard
* Change date range
* Filter by store and category
* View product history
* Generate a report
* Export CSV
* Export Excel
* View receipt discrepancy details

Required desktop flows include:

* Launch installed application
* Sign in
* Open local database
* Synchronize data
* Browse cached analytics offline
* Create an export through a native save dialog
* Recover from an interrupted sync
* Install a signed application update
* Restore the session after restart

Shared analytics tests must use the same fixture data across web, desktop, and
mobile packages.

## Build, CI/CD & Distribution

### Web

* Build the Next.js web target with Node.js runtime support.
* Deploy to:

  * Vercel
  * A Node.js host
  * A compatible container platform
* Run database access and protected aggregations only through trusted server
  environments.

### Desktop

* Build the Next.js static-export target.
* Embed the generated output inside Tauri.
* Produce signed builds for:

  * Windows
  * macOS
  * Linux
* Distribute through:

  * GitHub Releases
  * Project website
  * Optional platform stores

### Desktop updates

Use the Tauri updater for desktop auto-updates.

Update artifacts must be signed. Tauri requires updater signatures and does not
allow signature verification to be disabled. The private signing key must be
backed up securely because losing it can prevent updates to existing
installations. itHub Actions to run:

1. Type checking
2. Linting
3. Unit tests
4. Component tests
5. Database migration validation
6. Web build
7. Desktop static-export build
8. Tauri builds for each operating system
9. Installer smoke tests
10. Artifact signing
11. Release publishing

Use separate runners for Windows, macOS, and Linux desktop builds.

Signing certificates, Clerk keys, Turso credentials, object-storage
credentials, and updater private keys must be stored as protected CI secrets.

## Performance Targets

* Initial dashboard content should appear within approximately 1.5 seconds on a
  typical connection for a normal personal dataset.
* Cached desktop dashboards should open without requiring a network request.
* Common filter changes should update within 300 ms when data is already loaded.
* Large table results must use pagination or virtualization.
* Charts must remain responsive across multi-year purchase histories.
* Expensive analytics should use rollups, caching, or downsampling.
* The interface must not load full-resolution receipt or product images until
  requested.
* Report generation should run outside the interactive request path when it
  exceeds normal response-time limits.
* The desktop application should define and track:

  * Installer size
  * Startup time
  * Idle memory usage
  * Local database query time
  * Synchronization duration
  * Report generation duration

Performance tests should use documented dataset sizes, such as:

```text
Small:
1,000 purchases

Medium:
25,000 purchases

Large:
100,000 purchases
```

## Key Risks & Mitigations

### Different web and desktop runtimes

**Risk:** Code may work in the server-enabled web build but fail in the static
desktop build.

**Mitigation:**

* Maintain explicit web and desktop build targets.
* Prevent desktop components from importing server-only modules.
* Use shared data-source interfaces.
* Run both builds in CI.
* Add lint rules for server-only imports.

### Heavy aggregations

**Risk:** Multi-year histories may make dashboards slow.

**Mitigation:**

* Perform aggregations in SQL.
* Maintain rebuildable rollup tables.
* Cache common date ranges.
* Paginate detailed records.
* Downsample dense chart series.
* Run large exports through background jobs.

### Web and desktop calculation differences

**Risk:** The same metric may produce different values on the backend and local
desktop database.

**Mitigation:**

* Use one shared domain package.
* Use identical test fixtures.
* Version analytics formulas.
* Store currency and timezone explicitly.
* Compare local and backend analytics in integration tests.

### Offline desktop synchronization

**Risk:** Desktop edits may conflict with mobile edits.

**Mitigation:**

* Use the shared delta-sync protocol.
* Use server revisions.
* Use field-level conflict metadata.
* Preserve tombstones.
* Retain a conflict audit trail.
* Display unresolved synchronization errors.

### Desktop authentication

**Risk:** OAuth and session callbacks may behave differently inside a native
webview.

**Mitigation:**

* Complete an authentication proof of concept early.
* Test every supported operating system.
* Use system-browser authentication where required.
* Use registered deep links.
* Store session material securely.
* Provide a recoverable sign-in flow.

### Report fidelity

**Risk:** Browser, operating-system, and font differences may change report
layout.

**Mitigation:**

* Use fixed report models.
* Generate complex reports on the backend.
* Embed or standardize permitted report fonts.
* Test reports using visual regression fixtures.
* Avoid depending on browser print styles for official reports.

### Search scalability

**Risk:** Partial and fuzzy searches may become slow as history grows.

**Mitigation:**

* Normalize indexed search columns.
* Paginate results.
* Measure database search performance.
* Add a dedicated search engine only after a demonstrated need.

### Tauri permissions

**Risk:** Overly broad native permissions may expose the filesystem or operating
system unnecessarily.

**Mitigation:**

* Use Tauri capabilities.
* Grant only required commands.
* Scope filesystem access.
* Avoid unrestricted shell access.
* Review permissions during releases.

### Updater signing keys

**Risk:** Losing or exposing the desktop updater private key may prevent secure
future updates.

**Mitigation:**

* Store the key in a secure secrets manager.
* Maintain an encrypted offline backup.
* Limit CI access.
* Never commit the key to the repository.
* Document the release and recovery process.
