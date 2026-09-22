# Zybble backend — final report

Status of the production backend, point by point, with the evidence for each
claim and an explicit list of what has **not** been verified. This report is
deliberately unable to be read as "all green": anything that depends on a live
provider or a Go toolchain is marked as such.

Repository state: branch `arena/01a0c96b-zybblesaas`, HEAD `8e017b8` plus the
worker-verification and documentation commits that follow it. Gates:
`npx tsc -p tsconfig.json --noEmit` clean, `npx tsc -p tsconfig.api.json --noEmit`
clean, `npm test` → 54/54 (migrations, RLS/security, queue, schema contract),
`npm run build` → success.

---

## 1. Authentication is real

Supabase Auth (email + password, PKCE) is the only identity system.
`src/app/session.tsx` is the single source of session truth
(`loading | signed_out | signed_in | unconfigured`); `src/app/auth.tsx` performs
`signInWithPassword`, `signUp`, `resetPasswordForEmail` and
`updateUser({password})`, and shows a real *check your inbox* state when
confirmation is enabled. The reset form refuses to render without a recovery
session. Every server route re-verifies the JWT with `supabase.auth.getUser()` —
never by decoding it locally. `src/App.tsx` gates the shelled routes and renders
honest states for "restoring session" and "backend not configured".

*Evidence:* `src/app/auth.tsx`, `src/app/session.tsx`, `api/_lib/auth.ts`; no
`sessionStorage` demo session or social-login placeholder remains in `src/`.

## 2. Postgres is the source of truth, with RLS

11 migrations, 33 `public` tables and 7 `ops` tables, applied in order and
executed for real by the test suite (PGlite, PostgreSQL 16). Per-operation RLS
policies, explicit grants, `security_invoker` views, `workspace_id` on every
tenant row, money in minor units with a currency, and `leads.raw_data` keeping
the original engine payload beside the normalised columns.

*Evidence:* `supabase/migrations/0001…0011`, `tests/migrations.test.ts`,
`tests/security.test.ts`, `scripts/schema-dump.ts`.

## 3. Realtime delivery with a polling fallback

Search progress, search events, exports and notifications are published to
Supabase Realtime (`postgres_changes`), and RLS still applies per subscriber.
Every live view also polls (8 s / 30 s / on focus), so losing a websocket slows
updates instead of freezing the UI.

*Evidence:* `src/app/engine.tsx`, `src/app/hooks.ts`,
`supabase/migrations/0009_storage_and_realtime.sql`.

## 4. The queue is a Postgres table, not new infrastructure

`ops.job_queue` with `SKIP LOCKED` claiming, leases, heartbeats, bounded
attempts, exponential backoff capped at an hour, per-workspace dedupe keys and
priorities from the plan. No Redis, Kafka, RabbitMQ, Kubernetes, Elasticsearch or
ClickHouse anywhere in the stack.

*Evidence:* migrations `0006`/`0007`; `tests/queue.test.ts` (26 tests) covers
claim ordering, lease expiry, reclaim, backoff and dedupe.

## 5. The worker runs the real Google Maps engine

A Go service on Railway (Docker, Chromium + Playwright) that embeds Gosom
v1.18.1 as a library: standard mode by default (`gmaps.NewGmapJob`), fast mode
only when coordinates resolve, `WithJS(DisableImages())` in standard mode and
stealth Firefox in fast mode. It writes leads progressively through
`public.lead_upsert` + `public.search_register_lead`, so counters, dedupe and
usage are decided in one place. `DISABLE_TELEMETRY=1` is forced in code.

A `scrape` job is **one engine pass** (`search_inputs` row): the worker loads
exactly that pass, refuses to re-run a finished one (idempotent redelivery), and
a search is finalised only when no pass remains open.

*Evidence:* `worker/internal/{config,store,engine,jobs,health,supabase}`,
`worker/Dockerfile`, `railway.toml`; contracts re-verified against the Gosom and
scrapemate sources (RESEARCH.md §2.3, §8 items 10–14).

## 6. AI is Gemini, with real quota accounting and untrusted-content handling

Planning, chat, single-lead analysis, batch scoring and list analysis call
Gemini with JSON response schemas and record an `ai_runs` row with model, tokens
and latency. Scraped text reaches the model only inside explicit untrusted
markers; the model gets no database credentials, no shell and no other tenant's
data. Planning **never** consumes search quota. Quota is reserved atomically
before a request (`usage_reserve`), and the API and worker now share one cache-key
algorithm with per-producer prompt versions, so re-running unchanged work does
not double-charge.

*Evidence:* `api/ai/*`, `api/_lib/{gemini,ai-runs,entitlements}.ts`,
`worker/internal/supabase/gemini.go`, `worker/internal/store/ai.go`,
`worker/internal/jobs/jobs.go`.

## 7. Billing is Razorpay, and Stripe is gone

Plans → Subscriptions → Razorpay Checkout → server-side signature verification,
with webhooks verified over the raw body and de-duplicated on
`x-razorpay-event-id`. Entitlements derive from one SQL function, so API, worker
and UI cannot disagree. `402` responses carry the remaining quota and an upgrade
link. No `stripe` dependency, import or copy exists in the repository, and card
data never touches Zybble.

*Evidence:* `api/billing/*`, `api/_lib/{razorpay,plans,entitlements}.ts`,
`src/lib/razorpay.ts`, `src/app/pages5.tsx`; RESEARCH.md §5.

## 8. Exports are server-side and private

Exports are rendered by the worker for a search, list, filter or the whole
workspace, uploaded to the private `zybble-exports` bucket, and delivered as
300-second signed URLs. Retention is enforced by the cleanup job. The browser
never builds a "real" CSV from in-memory data any more.

*Evidence:* `api/exports/*`, `worker/internal/jobs/jobs.go` (export handler),
migration `0009`.

## 9. Usage, quota and entitlements are computed, never invented

`usage_counters`/`usage_events` are written by SQL functions; entitlements come
from `workspace_entitlements()`; the sidebar meter, plan limits, search
validation and AI quota all read the same values. Progress is derived from real
input state, and an ETA only appears once at least two passes have completed and
there is measured throughput to extrapolate from.

*Evidence:* migrations `0003`/`0007`, `api/_lib/entitlements.ts`,
`src/app/hooks.ts` (`useWorkspace`), `src/app/shell.tsx`.

## 10. API keys are real and scoped

`zyb_live_<4 hex>_<base64url>`, shown once, stored as a SHA-256 digest, with
scopes, optional expiry, rotation and revocation; every key call is rate-limited
and audited. Keys cannot do anything a session with the same scopes could not.

*Evidence:* `api/_lib/auth.ts` (`hashKey`), `api/keys/*`, `tests/security.test.ts`.

## 11. Notifications are delivered or honestly reported

In-app notifications are written through `notify_workspace`; the same function
enqueues a deduped `notification` job for email. Email is sent through Resend
only when `RESEND_API_KEY` + `EMAIL_FROM` are configured, and `emailed_at` is set
only after the provider accepts the message — otherwise the row records
`emailed: false` with the reason.

*Evidence:* `supabase/migrations/0011_notification_email_queue.sql`,
`worker/internal/jobs/{jobs,email}.go`, `api/notifications/index.ts`,
`src/app/shell.tsx` (bell).

## 12. Audit logs cover the mutations

Every API mutation writes an `audit_logs` row with actor type (`user`,
`api_key`, `system`), actor id, workspace, action, target and metadata.

*Evidence:* `api/_lib/audit.ts` and its call sites; migration `0003`.

## 13. Settings are persistent and permission-aware

Profile, workspace, preferences, notification preferences, team (invite, role,
remove, revoke, accept) and API keys all read and write real tables, with
owner/admin required for billing and team changes. `SettingsPage` has eight
tabs, all on live endpoints.

*Evidence:* `api/settings/*`, `api/keys/*`, `src/app/pages5.tsx`.

## 14. Tests exist and run against a real database engine

54 tests: migrations (order, objects, seeds), security (RLS isolation, grants,
API-key hashing, secret boundaries), queue semantics (claim, lease, reclaim,
backoff, dedupe) and a schema contract that checks every table, embedded
relation, RPC name and `p_*` argument the API and worker use, plus the fact that
the Go code only references functions that exist.

*Evidence:* `tests/*`, `vitest.config.ts`, `tests/db/harness.ts`; `npm test` → 54/54.

## 15. Deployment configuration is committed

`vercel.json` (Vite build, Node 22 functions, 60 s duration, security headers),
`railway.toml` (Dockerfile build, healthcheck `/health`, restart policy,
replicas), `worker/Dockerfile` (Chromium + Playwright driver, non-root user,
healthcheck), and a GitHub Actions workflow that runs both typechecks, the
tests, the build and `go mod tidy`/`go vet`/`go build`.

*Evidence:* `vercel.json`, `railway.toml`, `worker/Dockerfile`,
`.github/workflows/ci.yml`.

## 16. Documentation is complete, including the smoke test

`README.md`, `ARCHITECTURE.md`, `DEPLOYMENT.md` (with the end-to-end production
verification checklist in §6), `MIGRATION.md`, `RESEARCH.md` (sources, findings,
discrepancies and decisions D1–D22) and `.env.example` (every variable, grouped
by environment).

## 17. Constraints honoured

- Razorpay only; **no Stripe** anywhere.
- **No `GOOGLE_MAPS_API_KEY`** and no Places/Geocoding dependency: Gosom scrapes
  directly and `geo_places` + optional client coordinates replace geocoding.
- **No new infrastructure** (no Redis/broker/Kubernetes/Elasticsearch/ClickHouse).
- **No Next.js migration**; the Vite SPA and every existing route are preserved.
- Standard mode is the default; fast mode is opt-in and refuses to run without
  coordinates; email extraction never blocks the initial Maps results.
- Engine secrets exist only in the Vercel and Railway environments; no
  `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `RAZORPAY_KEY_SECRET` or
  `RAZORPAY_WEBHOOK_SECRET` is referenced from `src/`, and `vite-env.d.ts`
  documents why the Razorpay key id is not a `VITE_` variable.
- Raw engine payloads are stored in `leads.raw_data` alongside normalised columns.

## 18. Honesty sweep

Every fabricated system was removed from the product: no generated leads, no
randomised progress, no invented ETA, no fake quality scores, no fake email
verification, no fake billing state, no client-side "export". The only synthetic
data left is the landing-page preview, which is labelled *Guided preview* /
*simulated extraction feed* and touches no account. When a provider is
unconfigured, the API returns `503 not_configured` and the UI says so.

## 19. What is *not* verified yet (do these before launch)

1. **The worker has never been compiled.** No Go toolchain existed in the
   environment where it was written, and the Go hosts were unreachable. Its
   dependencies and APIs were verified by reading the Gosom and scrapemate
   sources, and CI will run `go mod tidy && go vet && go build` — but the first
   CI/Railway build is the first real compile. Expect `go.sum` churn.
2. **No live Supabase, Gemini, Razorpay or Storage call has been made.** Every
   provider path is written to fail loudly rather than fake success, but the
   first real checkout, the first real scrape and the first real AI call are
   still ahead.
3. **Browser-level UI verification.** The SPA typechecks, builds and its data
   layer is wired to the real API, but nobody has clicked through every screen
   against a live backend yet. `DEPLOYMENT.md` §6 is the checklist that closes
   this gap — 12 ordered steps, each naming the artefact that proves it worked.
4. **Runtime shapes that TypeScript cannot prove.** Two known ones to watch on
   the first run: `/api/billing/subscription` must serialise
   `current_period_end` (the DB column is `subscriptions.current_end`), and the
   `/lists` → `jobSlug` mapping must return the embedded search slug.

Until those four are done, this is a complete implementation, not a proven
deployment.
