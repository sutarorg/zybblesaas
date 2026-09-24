# Zybble architecture

This document describes what actually runs in production, why it is split this
way, and what happens when a piece fails. It is written against the code in this
repository (`api/`, `worker/`, `supabase/migrations/`, `src/`), not against an
intention.

---

## 1. The shape of the system

```
                    ┌──────────────────────────────────────────────┐
   browser ───────► │ Vercel: React SPA (static) + api/** (Node 22)│
                    └───────┬───────────────────────────┬──────────┘
                            │ supabase-js               │ https
                            │ (PostgREST + RPC)         │ (checkout, webhooks)
                            ▼                           ▼
                    ┌──────────────────────────────────────────────┐
                    │ Supabase                                     │
                    │  Postgres (source of truth, RLS, SQL funcs)  │
                    │  Auth (email + password, PKCE)               │
                    │  Storage (private `zybble-exports` bucket)   │
                    │  Realtime (postgres_changes fan-out)         │
                    └───────┬──────────────────────────────────────┘
                            │ pgx (long-lived pool, LISTEN-free polling)
                            ▼
                    ┌──────────────────────────────────────────────┐
                    │ Railway: zybble-worker (Go + Chromium)       │
                    │  queue loop · Gosom engine · exports · AI    │
                    └───────┬──────────────────────────────────────┘
                            │ HTTPS
                            ▼
                    Google Maps (via Gosom) · Gemini · Resend
```

Four rules hold the design together:

1. **Postgres is the only source of truth.** Progress, quota, billing state,
   job ownership and lead identity all live in tables and are mutated by SQL
   functions, never by two independent implementations.
2. **The API is thin and synchronous.** Validate → authorize → read/write →
   enqueue → return. Anything that can take minutes is a job.
3. **The worker owns everything expensive and must be crash-safe.** Every job is
   leased, heartbeated and idempotent, and partial results are already committed
   when a worker dies.
4. **No new infrastructure without a measured need.** No Redis, no message
   broker, no Kubernetes, no ClickHouse. The queue is a table
   (`ops.job_queue`) claimed with `FOR UPDATE SKIP LOCKED`.

---

## 2. Components

### 2.1 SPA (`src/`)

React 19 + Vite + TypeScript, hash-routed, routes unchanged from the original
product: `/dashboard`, `/findleads`, `/leads`, `/lead/{slug}`, `/lists`,
`/list/{slug}`, `/searches`, `/search/{slug}`, `/zybbleai`, `/exports`,
`/billing`, `/setting`, `/signin`, `/signup`, `/forgotpassword`,
`/resetpassword`.

- `src/lib/supabase.ts` — browser client (publishable key only, PKCE, session
  persistence in `localStorage`, `detectSessionInUrl` for recovery links).
- `src/lib/api.ts` — one typed wrapper per endpoint, plus `ApiError` carrying the
  server's `code`, `request_id` and details.
- `src/app/session.tsx` — `SessionProvider`: the single place that knows whether
  the user is `loading | signed_out | signed_in | unconfigured`, and the only
  place that calls `supabase.auth`.
- `src/app/hooks.ts` — `useStats`, `useLeads`, `useLead`, `useLists`, `useList`,
  `useSearches`, `useSearch`, `useExports`, `useNotifications`, `usePlans`,
  `useBilling`, `useSettings`, `useTeam`, `useApiKeys`, `useWorkspace`.
- `src/app/engine.tsx` — Realtime subscription helper (`postgres_changes`) used
  for live search progress, with polling as the always-available fallback.
- `src/App.tsx` — `SessionProvider → EngineProvider → ThemeProvider`, plus a
  `RequireSession` gate that renders three honest states: *restoring your
  session*, *backend not configured*, *please sign in*.

The SPA never sees a service-role key, a Gemini key or a Razorpay secret. The
only credentials in the bundle are the Supabase URL and the publishable key,
which are safe precisely because every table is protected by RLS.

### 2.2 API (`api/**`, Vercel Node 22)

Every route is `export default route({...}, handler)` under `api/_routes/`,
dispatched centrally via `api/[...path].ts` and `api/index.ts` through `api/_lib/router.ts`.
This architecture ensures total deployed Serverless Functions stay at 2, well within
Vercel's Hobby plan limit of 12 functions. `route()` from `api/_lib/http.ts` provides:

- method allow-listing (`405` with `Allow`),
- auth modes `none | session | api_key | both` (session = Supabase JWT,
  api_key = `zyb_live_…` hashed and looked up in `public.api_keys`),
- scope checks for API keys and role checks for workspace members,
- per-caller rate limits (`ops.rate_limits`),
- a uniform error envelope `{ error: { code, message, request_id, details? } }`,
- audit logging on mutations.

| Route | Methods | Auth | Scope / role |
| --- | --- | --- | --- |
| `/api/health` | GET | none | platform probe |
| `/api/system` | GET | none | feature flags for the UI (which providers are configured) |
| `/api/me` | GET | both | profile, workspace, plan, entitlements |
| `/api/stats` | GET | both | `searches:read` |
| `/api/geo` | GET | both | `searches:read` |
| `/api/searches` | GET, POST | both | `searches:read` / `searches:write` |
| `/api/searches/{slug}` | GET, POST, PATCH, DELETE | both | `searches:read` / `searches:write` |
| `/api/leads` | GET | both | `leads:read` |
| `/api/leads/{slug}` | GET, POST | both | `leads:read` / `leads:write` |
| `/api/lists` | GET, POST | both | `lists:read` / `lists:write` |
| `/api/lists/{slug}` | GET, POST, PATCH, DELETE | both | `lists:read` / `lists:write` |
| `/api/exports` | GET, POST | both | `exports:read` / `exports:write` |
| `/api/exports/{slug}` | GET, DELETE | both | `exports:read` / `exports:write` |
| `/api/ai/plan` | POST | both | `searches:write` — **no search quota consumed** |
| `/api/ai/score` | POST | both | `leads:write` |
| `/api/ai/analyze` | POST | both | `leads:write` |
| `/api/ai/list-analysis` | POST | both | `lists:read` |
| `/api/ai/chat` | POST | both | `leads:read` |
| `/api/billing/plans` | GET | none | public pricing |
| `/api/billing/subscription` | GET, POST | both | `searches:read` |
| `/api/billing/checkout` | POST | session | owner/admin |
| `/api/billing/verify` | POST | session | owner/admin |
| `/api/billing/webhook` | POST | none (HMAC verified) | Razorpay |
| `/api/keys` | GET, POST | session | owner/admin |
| `/api/keys/{id}` | PATCH, DELETE, POST | session | owner/admin |
| `/api/settings` | GET, PATCH | session | member (workspace writes need admin) |
| `/api/settings/team` | GET, POST | session | owner/admin |
| `/api/notifications` | GET, PATCH | both | `searches:read` |

Status codes are meaningful and stable: `400` validation, `401` missing/expired
session or bad key, `403` scope/role, `404` not found **within your workspace**,
`405` method, `409` conflict, `429` rate limited, `402` quota or plan limit,
`503 not_configured` when a provider (Gemini/Razorpay/Storage) is not set up,
`502` when a provider fails.

### 2.3 Postgres (Supabase)

33 tables in `public`, 7 in `ops` (operations/infrastructure tables that no user
ever reads directly). Grouped by concern:

- **Identity & tenancy** — `profiles`, `workspaces`, `workspace_members`,
  `workspace_invites`, `workspace_preferences`, `notification_preferences`.
- **Catalogue & billing** — `plans`, `billing_customers`, `subscriptions`,
  `payment_methods`, `payments`, `invoices`, plus `ops.billing_events` for
  webhook de-duplication.
- **Usage & metering** — `usage_counters`, `usage_events`, `ops.quota_warnings`,
  `ops.rate_limits`, `ops.idempotency_keys`.
- **Leads** — `leads` (one canonical row per business, globally deduplicated),
  `lead_emails`, `lead_social_profiles`, `lead_reviews`, `workspace_leads`
  (the per-workspace association that carries the billable unit),
  `lead_ai_analyses`.
- **Searching** — `searches`, `search_inputs` (one row per engine pass, incl.
  grid cells), `search_leads`, `search_events`.
- **Lists & exports** — `lists`, `list_leads`, `exports`.
- **Notifications & audit** — `notifications`, `api_keys`, `audit_logs`.
- **AI** — `ai_conversations`, `ai_messages`, `ai_runs`.
- **Operations** — `ops.job_queue`, `ops.workers`, `ops.system_settings`,
  `public.geo_places` (curated city centroids, so no geocoding API is required).

Notable invariants:

- Every tenant-owned row carries `workspace_id`; RLS policies compare it to the
  caller's memberships through `public.is_workspace_member(workspace_id)`.
- `leads` is global; `workspace_leads` is per tenant. Two customers who find the
  same plumber both get their own association row, and the second one costs less
  to discover — but they never see each other's lists, notes or exports.
- Money is `*_minor` integers plus an explicit `currency`.
- `raw_data jsonb` keeps the original normalised engine payload next to the
  derived columns, so a parsing improvement can be replayed without re-scraping.

### 2.4 Worker (Railway, Go)

`worker/cmd/worker` is a single binary with four responsibilities:

1. **Queue loop** — claims jobs (`ops.queue_claim`), runs them concurrently, and
   heartbeats the lease (`ops.queue_heartbeat`, clamped to at least 30 s).
2. **Health server** — `/health` (DB ping), `/ready` (queue stats), `/metrics`
   (counters), on `PORT_ADDR`/`PORT`.
3. **Maintenance ticker** — enqueues `cleanup` hourly; cleanup reclaims expired
   leases, re-queues searches whose worker died, expires old exports, and prunes
   stale operational rows.
4. **Job handlers** — see §4.

The worker registers itself in `ops.workers` and updates its heartbeat row, so
"is the scraper alive?" is a database query rather than a guess.

---

## 3. The queue

`ops.job_queue` is an ordinary table with the properties a queue needs:

| Column | Purpose |
| --- | --- |
| `job_type` | `scrape`, `export`, `ai_lead_scoring`, `ai_lead_analysis`, `notification`, `cleanup` |
| `payload` | jsonb; job-specific (`{search_id, input_id, seq}`, `{export_id}`, `{lead_ids}`, `{notification_id}`) |
| `priority` | from the plan (`queue_priority`); lower number wins |
| `dedupe_key` | unique partial index while the job is active → enqueueing twice is a no-op |
| `attempts` / `max_attempts` | bounded retries |
| `run_at` | visibility timeout for exponential backoff |
| `lease_owner` / `lease_expires_at` / `heartbeat_at` | lease ownership |

Functions: `ops.queue_enqueue`, `queue_claim` (SKIP LOCKED + `FOR UPDATE`),
`queue_heartbeat`, `queue_complete`, `queue_fail` (backoff
`delay × 2^(attempts-1)` capped at one hour, with jitter), `queue_reclaim_expired`,
`queue_cancel_search`, `queue_stats`.

**Idempotency.** Expensive work must be safe to repeat:

- A `scrape` job carries `search_id` **and** `input_id`. The worker loads exactly
  that engine pass and refuses to run it again if it is already
  `completed | skipped | cancelled` — a redelivered job after a restart is a
  no-op, not a re-scrape.
- Recovery jobs (`cleanup` → `scrape` with `{search_id, reason}` and no
  `input_id`) mean "pick up whatever is still open for this search".
- Lead writes go through `public.lead_upsert`, which deduplicates on place
  identity and returns `(lead_id, created, matched_by)`; a repeated crawl adds
  associations, never duplicate businesses.
- A search is only finalised when **no input is still open**
  (`Store.FinishSearch` checks `status in ('pending','running')`), and only the
  call that actually closed it sends the completion notification.

---

## 4. Job handlers

### 4.1 `scrape` — the Google Maps engine

The worker embeds Gosom (`github.com/gosom/google-maps-scraper`) as a library:
`gmaps.NewGmapJob` seed jobs in standard mode, `gmaps.NewSearchJob` in fast
mode, `scrapemateapp.NewScrapeMateApp` with `WithJS(DisableImages())` in
standard mode and `WithStealth("firefox")` in fast mode.

Per run:

1. Mark the input(s) `running`, increment `search_inputs.attempts`, mark the
   search running, write a `search_events` row (`engine_started`).
2. Start a progress goroutine that renews the lease and publishes progress
   (`search_input_progress`, `search_refresh_progress`) at a throttled cadence,
   and a watcher that cancels the run if the user pauses or cancels the search.
3. Run the engine. A Zybble `scrapemate.ResultWriter` persists every delivered
   place **as it arrives** (flush every 5 rows or 3 s) through
   `public.lead_upsert` + `public.search_register_lead`, which is also where
   counters and usage are recorded. The engine's own status display string
   ("Open", "CLOSED", "Permanently closed", "Geöffnet", …) is normalized to the
   stored enum by `public.normalize_lead_status` before it reaches
   `leads.status`; the verbatim string stays in `raw_data` (migration 0013).
   A place Postgres refuses is counted and skipped — it never discards the rest
   of the batch, and it never ends the run — and is reported in the log, in a
   `persist_failed` event and on the input row.
4. When the run ends, write one honest outcome per input: `completed`,
   `partial` or `failed`, with `places_discovered` / `places_completed` taken
   from engine callbacks (Gosom's completion tracker announces how many places a
   seed job produced; the writer counts what it actually persisted). A run cut
   short by the safety deadline is only marked `failed` when nothing was
   persisted for that input; otherwise it is `partial`. A pass whose places were
   found but not stored is `failed` when none landed, and keeps the reason on
   the row when some did.
5. `FinishSearch` finalises the search **only if nothing else is open**, and the
   closing call writes the in-app notification for the workspace.

Email extraction (when enabled) runs as follow-up jobs after the Maps pass, so
initial results are never blocked by website fetching. Progress for a search
with email extraction enabled weights the crawl at 85 % and enrichment at 15 %,
and only counts enrichment that actually happened (`enriched_count`), so the bar
can never claim work that did not occur.

Standard mode is the default. Fast mode is refused for a location that cannot be
resolved to coordinates, rather than silently degrading.

### 4.2 `export`

Renders CSV or JSON from the real rows of a search, list, filter or the whole
workspace, uploads it to the **private** `zybble-exports` bucket, and stores an
`exports` row. The API only ever hands the browser a short-lived (300 s) signed
URL. Expired files are deleted by `cleanup`; the `exports` row records what was
produced, when, and by whom.

### 4.3 `ai_lead_scoring` / `ai_lead_analysis`

The worker calls Gemini with a JSON response schema, writes the result into
`lead_ai_analyses`, and records an `ai_runs` row with token usage and latency.
Before spending a request it reserves quota with `public.usage_reserve`, keyed by
the cache key, so re-scoring unchanged data does not double-charge.

`ai_lead_scoring` is enqueued by `api/ai/score.ts`; `ai_lead_analysis` is
executed for real whenever such a job reaches the queue, and nothing in `api/`
enqueues one today (the API analyses a single lead synchronously instead).
`tests/api-contract.test.ts` pins both lists, so adding or removing an enqueuer
is a deliberate change rather than a silent drift.

Scraped content is passed to the model inside explicit
`<<<untrusted:label>>> … <<<end>>>` markers with a system instruction that
treats it as evidence only. The model never receives database credentials, the
service-role key, a shell, or worker internals — only a flattened text summary of
one lead's public fields.

### 4.4 `notification`

Reads the notification row, and if `RESEND_API_KEY` + `EMAIL_FROM` are
configured, sends the email and records `emailed_at` **only after the provider
accepts it**. Without a provider it reports `{emailed: false, reason: …}` —
it never claims a message was sent.

### 4.5 `cleanup`

Reclaims expired leases, re-queues searches that lost their worker (so an
interrupted crawl finishes instead of hanging), expires old exports, prunes
rate-limit and idempotency rows, and writes quota warnings.

---

## 5. Authentication, authorization and data access

- **Auth** is Supabase Auth (email + password, PKCE for links). Sign-up honours
  `needsEmailConfirmation`: the UI shows a *check your inbox* state instead of
  pretending the user is signed in. Password recovery is a two-step flow with a
  recovery session, and the reset form is disabled unless that session exists.
- **Workspace membership** is the authorization unit: `owner`, `admin`,
  `member`. Billing and team changes require owner/admin; everything else
  requires membership.
- **Two credential types** for the API: a user session (JWT) or an API key.
  Keys are generated as `zyb_live_<4 hex>_<base64url>`, shown once, and stored
  as `sha256` digests with scopes and an optional expiry. They can be rotated
  and revoked, and every key-authenticated call is rate-limited and audited.
- **RLS everywhere.** Policies are per operation (`USING` for read/update/delete,
  `WITH CHECK` for insert/update), grants are explicit (a missing grant returns
  `42501` before any policy is consulted), and views that aggregate tenant data
  are created with `security_invoker = true` so they cannot bypass RLS.
- **The browser never talks to the database directly for writes.** It uses the
  API for mutations; RLS is the backstop that makes a leaked publishable key
  boring rather than catastrophic.
- **Secrets** live only in Vercel's server environment and Railway's worker
  environment. `SUPABASE_SECRET_KEY`, `GEMINI_API_KEY`, `RAZORPAY_KEY_SECRET`
  and `RAZORPAY_WEBHOOK_SECRET` are never referenced from `src/` (see
  `.env.example`).
- **Audit log** (`public.audit_logs`) records who did what to which object for
  every mutation the API performs, including actor type (`user`, `api_key`,
  `system`), the workspace, and metadata.

---

## 6. Billing

Razorpay Subscriptions (not Stripe, no card data ever touches Zybble):

1. `POST /api/billing/checkout` creates (or reuses) a Razorpay **plan** for the
   Zybble plan code, creates a **subscription** for the workspace, stores it, and
   returns the subscription id plus the public key id, which the SPA passes to
   Razorpay Checkout.
2. `POST /api/billing/verify` confirms the checkout result server-side:
   `HMAC-SHA256(payment_id + "|" + subscription_id, key_secret)`.
3. `POST /api/billing/webhook` receives `subscription.*` and `payment.*` events,
   verifies `X-Razorpay-Signature` over the **raw body**, and de-duplicates on
   `x-razorpay-event-id` (stored in `ops.billing_events`). Only then does it
   update `subscriptions`, `payments`, `invoices` and entitlements.

Entitlements are derived in one place (`public.workspace_entitlements`), so the
API, the worker and the UI all read the same quota, plan and limit values.
Exhausted quota returns `402` with the remaining amount and an upgrade link —
never a silent downgrade, never a fake "queued" state. If the provider is not
configured, `/api/billing/plans` still returns the catalogue and the UI says
billing is unavailable on this deployment instead of offering a broken button.

---

## 7. Realtime and freshness

- Search progress, notifications and export readiness are published through
  Supabase Realtime (`postgres_changes` on the relevant tables, which are added
  to the `supabase_realtime` publication). RLS still applies to each subscriber.
- **Realtime is a delivery mechanism, not the source of truth.** Every view also
  polls (exports every 8 s, stats and notifications every 30 s, leads and lists on
  focus), so a dropped websocket degrades to slower updates rather than a stuck
  screen.
- Counters that change quickly (progress percentage, ETA) are written on a
  throttled cadence by SQL functions, and ETAs are only shown once there are at
  least two completed inputs and real elapsed throughput to extrapolate from.

---

## 8. Failure behaviour

| Failure | What happens |
| --- | --- |
| Worker crashes mid-scrape | Lease expires; `queue_reclaim_expired` (or the next worker's startup reclaim) re-queues the job. Leads already flushed are in Postgres; the input resumes as `partial`. |
| Worker is redeployed | Signals are trapped, in-flight jobs get a grace period (`WORKER_SHUTDOWN_TIMEOUT`), and any job that is still running is reclaimed by lease. |
| Postgres connection is lost | pgx pool reconnects; a job that cannot make progress fails, backs off and retries up to `max_attempts`. |
| A scraped place cannot be stored | `public.lead_upsert` raises (constraint violation, malformed value); the writer logs the place, counts it, keeps the remaining batch, writes a `persist_failed` search event and marks the pass `failed` (nothing stored) or records the loss on the row (some stored). Progress and counters only ever reflect what is really in Postgres. |
| Gemini is down or the key is missing | AI jobs fail with an explicit error, quota reservation is released for retry, and the API returns `503 not_configured` / `502 provider` — no fabricated analysis is written. |
| Razorpay webhook is delayed | The user's subscription state is whatever the database last received; the UI shows the verified state, and `verify` covers the interactive path. Duplicate webhooks are ignored by event id. |
| Card payment is halted | Razorpay sends `subscription.halted`; entitlements fall back to the plan's grace behaviour rather than inventing an active subscription. |
| User cancels a search | `queue_cancel_search` removes queued jobs, open inputs are marked `cancelled`, the running engine is cancelled, and the final status is `cancelled` — partial results stay visible and usable. |
| User pauses a search | Open inputs are returned to `pending` and the search stays resumable; no progress is lost. |
| Storage bucket missing | Export jobs fail with a clear error; the export row is marked failed instead of producing a dead link. |
| Email provider missing | Notifications stay in-app and record `emailed_at = null`; nothing is reported as delivered. |

---

## 9. Deliberate non-goals

- **No Redis, Kafka, RabbitMQ, Kubernetes, Elasticsearch or ClickHouse.** None
  is required by the measured load: one Postgres database, one worker service
  (horizontally scalable via `FOR UPDATE SKIP LOCKED`), and a firewall-friendly
  polling loop.
- **No Google Maps Places/Geocoding API.** The engine is Gosom, and a curated
  `geo_places` table plus optional client coordinates replaces geocoding.
  No `GOOGLE_MAPS_API_KEY` is needed anywhere.
- **No frontend framework migration.** The Vite SPA and its routes are preserved;
  the API is a sibling directory on Vercel.
- **Gosom's own SaaS is not shipped.** `cmd/gmapssaas`, its admin UI, API-key
  system and job tables are not deployed — only the engine packages are used as
  a library.
- **No fabricated anything.** Progress, counts, ETAs, quality scores, email
  verification and billing state are always derived from real rows.
