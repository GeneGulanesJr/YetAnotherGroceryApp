# Yet Another Grocery App — shared backend API

Node + TypeScript service implementing the shared backend described in
`tech.mobile.md` ("Sync Engine", "Conflict Resolution") and `tech.desktop.md`
("Data Access & Sync", "Deployment"):

- **Delta sync** for the mobile/desktop clients: `POST /sync/push` (batched,
  idempotent mutation upload with server-side conflict resolution and revision
  assignment) and `GET /sync/pull` (cursor-paged delta download).
- **Analytics** read endpoints consumed by `ApiDataSource`
  (`web-desktop/src/lib/data-source.ts`), computed in SQL with the exact same
  math as `DesktopSqliteDataSource`.
- Local/file persistence on **better-sqlite3** today, written so the
  **Turso/libSQL** driver is a drop-in swap (see below).

## Run

```sh
npm install
cp .env.example .env   # optional; defaults are fine locally
npm run dev            # http://localhost:8787
```

Other scripts:

```sh
npm test        # vitest (in-memory SQLite, no network)
npm run typecheck
npm run build   # tsc -> dist/
npm start       # node dist/server.js
```

Configuration (`.env`, see `.env.example`): `PORT` (8787), `DATABASE_URL`
(`file:local.db`, bare path, or `:memory:`), `ALLOWED_ORIGIN` (CORS; empty
allows all).

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| GET | `/health` | Liveness probe. |
| POST | `/sync/push` | `PushBatchRequest` in, `PushBatchResponse` out. |
| GET | `/sync/pull?cursor=&limit=` | `PullDeltaResponse` page; `limit` 1–500, default 200. |
| GET | `/analytics/spending-summary?rangeDays=&currency=` | `SpendingSummary[]` |
| GET | `/analytics/spending-series?granularity=day\|week\|month&rangeDays=&currency=` | `SpendingPoint[]` |
| GET | `/analytics/spending-by-store?rangeDays=&currency=` | `NamedAmount[]` |
| GET | `/analytics/spending-by-category?rangeDays=&currency=` | `NamedAmount[]` |
| GET | `/analytics/price-watch?rangeDays=&currency=` | `PriceWatchRow[]` |

**Auth.** `/sync/*` routes require an `X-Device-Id` header (401 without) and
reject a body `deviceId` that differs from it (403).

When `CLERK_SECRET_KEY` is set, protected routes additionally require a valid
`Authorization: Bearer <jwt>` issued by that Clerk instance — sync routes need
both the header and the token; analytics routes need only the token. Without
the key (local dev, tests) the server runs in device-identity-only mode and
analytics stay open. Verification lives in `src/auth.ts`
(`createAuthPreHandler` / `createJwtPreHandler`, Clerk JWKS via
`@clerk/backend`). Remaining work (`AUTH_TODO` in `src/auth.ts`): bind JWT
subjects to device ids via a device-registration table and scope queries by
the authenticated user — the canonical tables are still keyed by `device_id`
and pull is global.

## Protocol summary (wire types in `src/protocol.ts`)

Mirrors `mobile/src/sync/protocol.ts`. Timestamps are UTC epoch ms.

**Push.** The client outbox sends `SyncMutationDto`s: `id`, `tableName`,
`recordId`, `operation` (`insert|update|delete`), `changedFields`, `payload`
(a full row snapshot, camelCase, timestamps as ISO strings or epoch ms),
`deviceId`, `createdAt`, `localRevision`. The server:

- validates per mutation; failures produce `accepted:false` results and never
  abort the batch (whole-envelope malformation is HTTP 400);
- is **idempotent**: every mutation id is applied at most once — results live
  in `sync_mutations_applied` (written in the same transaction as the apply)
  and a re-push replays the stored result verbatim, including rejections;
- owns all clocks: `createdAt`/`updatedAt`/`deletedAt` and every field version
  are stamped with the server apply time (strictly monotonic), so device clock
  skew cannot influence ordering;
- assigns **monotonic per-record revisions** (insert = 1, then +1 per accepted
  write); tombstoned records are updated by nothing but another delete;
- applies **last-write-wins per field**: mutations within/across batches apply
  in `createdAt` order, so the later write of each field wins; field versions
  are server-assigned, hence tie-free server-side ("ties → server clock" by
  construction — the client's `merge.ts` still enforces ties → server);
- **tombstones**: deletes set `deleted_at` and never hard-delete. Re-deleting
  an already-tombstoned record is an accepted no-op; updating a tombstone is
  rejected;
- **audits conflicts** in `sync_conflicts` when a pushed change overwrites a
  field whose stored value differs and was last written by a *different*
  device: both values, both devices, both revisions, conflict timestamp.
  Column naming mirrors the mobile table ("local" = prior stored state,
  "remote" = the incoming push that won);
- returns `results[]` (`mutationId`, `accepted`, `revision`, `updatedAt`,
  `error?`) and a `cursor` checkpoint (head of the change ledger).

**Pull.** `GET /sync/pull?cursor=` returns `SyncRecordDto`s (full canonical
row in camelCase — minus the server-only `serverSeq` — plus `fieldVersions`,
`revision`, `deleted`) changed after the cursor, ordered by global change
sequence, `limit` per page (default 200, max 500). `nextCursor` is an opaque
`base64url("sq1:<seq>")` token, or **null on the last page** — the exact
terminal state `mobile/src/sync/engine.ts` waits for. A missing/empty cursor
means "from the beginning"; malformed cursors are HTTP 400.

### Cursor / change-ledger design

Every applied mutation stamps the canonical row with `server_seq`, drawn from
a single global monotonic counter stored in `sync_meta` (key `server_seq`,
incremented with `UPDATE ... RETURNING`). `server_seq` is an extra column on
each synced table (indexed) and is **not** part of the wire `fields` map —
clients do not have the column, and including it would break the mobile
engine's inserts.

## Database

The canonical schema (`src/db/schema.ts` + DDL in `src/db/migrate.ts`) matches
`mobile/drizzle/0000_init.sql` column-for-column, plus:

- `server_seq integer` + index on each of the 12 synced tables (above),
- `sync_mutations_applied` (idempotency ledger),
- `sync_conflicts` (server-side conflict audit),
- `sync_meta` (global counters).

Migrations run idempotently on every boot (`migrate()`); swap in drizzle-kit
later without touching the wire behavior. Timestamps are plain epoch-ms
integers in the JS layer (same DDL as the mobile `timestamp_ms` columns).

### Switching to Turso/libSQL

The schema, sync logic, and analytics SQL are plain SQLite dialect and work
unchanged on libSQL:

1. `npm i @libsql/client`
2. In `src/db/client.ts`, open with `drizzle-orm/libsql` for `libsql://` /
   `https://` URLs (a guard currently rejects them with these instructions)
   and keep the raw client handle for the ledger counter + analytics SQL
   (`libsql` supports the same prepared-statement surface).
3. `DATABASE_URL=libsql://...` — no other code changes.

No Turso credentials belong in this repository.

## Deployment

Plain **Node.js host** (per `tech.desktop.md`, "Deployment"): `npm ci &&
npm run build && npm start`. The server binds `0.0.0.0:$PORT`, applies
migrations at boot, and shuts down gracefully on SIGINT/SIGTERM.

## Auth TODO

JWT verification is live (see **Auth** above). What remains in `src/auth.ts`
(`AUTH_TODO`): bind the JWT subject to device ids via a device-registration
table, and scope all queries by the authenticated user — the canonical tables
are still keyed by `device_id` and pull is global. No secret material lives
here.
