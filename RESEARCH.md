# Zybble — Production Backend Research

**Research date:** 2026-09-22 (all sources re-verified on this date)
**Author:** backend/platform engineering pass on `sutarorg/zybblesaas`

---

## 0. Repositories analyzed (exact revisions)

| Repository | Revision analyzed | Notes |
|---|---|---|
| `sutarorg/zybblesaas` (frontend + backend target) | `2944802d04f294d41b1d0c01828af374e2f47f8b` (branch `main`, commit "Initial Commit"), branch forked for this work: `arena/01a0c96b-zybblesaas` | React 19.2 + Vite 7.3 + TypeScript 5.9 + Tailwind 4, hash-based router, single-page SPA |
| `gosom/google-maps-scraper` (scraping engine) | `549e4b5e61c7103685ef8392f246ebdba783ed03` — tag/version **1.18.1**, committed 2026-09-20 | Go module `github.com/gosom/google-maps-scraper`, `go 1.27.1`, `scrapemate v1.4.0`, playwright-go `v0.6100.0` |

No assumption in this document comes from memory: every claim is backed by a file in one of the two repositories or a documentation page listed in §7.

---

## 1. Frontend architecture findings (`sutarorg/zybblesaas`)

### 1.1 Shape

```
index.html                       → single HTML shell
src/main.tsx                     → React root
src/App.tsx                      → hand-rolled route dispatcher on window.location.hash
src/lib/router.ts                → useRoute(): "#/x/y" → "x/y"; "" → landing page
src/lib/theme.tsx                → ThemeProvider, localStorage "zybble_theme"
src/app/shell.tsx                → AppShell (sidebar/bottom nav), Card, Meter, StatusChip, Modal, EmptyState
src/app/engine.tsx               → FAKE engine (EngineProvider/createJob/toggle/rerun/get)
src/app/data.ts                  → FAKE domain data + fullLead()/pool()/poolFull()/leadCsv()/download()
src/lib/data.ts                  → FAKE lead generator (generateLeads, detectNiche, detectCity) + marketing copy
src/app/pages1..5.tsx            → /dashboard /findleads /leads /lead/{slug} /lists /list/{slug} /searches /search/{slug} /zybbleai /exports /billing /setting
src/app/auth.tsx                 → FAKE auth (sessionStorage "zybble_session")
src/components/*                 → marketing landing sections (keep as-is)
src/pages/*                      → marketing sub-pages (keep as-is)
```

Routing is **hash based** (`#/dashboard`), so no server-side SPA fallback complexity is required — but the routes and slugs (`/lead/{slug}`, `/list/{slug}`, `/search/{slug}`) must be preserved exactly, and the backend must return stable slugs.

### 1.2 Demo systems that must be replaced (verified line-by-line)

| Demo system | Location | Evidence |
|---|---|---|
| Fake auth | `src/app/auth.tsx` | `sessionStorage.setItem("zybble_session", "1")` on submit (L136, L194); Google/GitHub buttons just do `window.location.hash = "#/dashboard"`; copy literally says *"Demo build — any email and password walk right in."* |
| Fake engine | `src/app/engine.tsx` | `setInterval(..., 1400)` mutates job counters with `Math.random()`; `LOG_POOL()` fabricates log lines ("throughput steady at ~104–128 places/min"); `toggle()`/`rerun()` only mutate React state; jobs seeded from `INITIAL_JOBS` |
| Fake leads | `src/lib/data.ts`, `src/app/data.ts` | `generateLeads()` (seeded PRNG), `pool()`, `poolFull()`, `fullLead()`, `findLead()`, `leadSlug(seed, idx)`; 64-record deterministic pools; fabricated hours/popular times/reviews |
| Fake AI | `src/app/pages4.tsx` | `planFor(brief)` regex parser + `setTimeout()` staged "thinking"; brief handed over through `sessionStorage "zybble_brief"` |
| Fake exports | `src/app/data.ts` | `download()` uses `Blob` + `URL.createObjectURL()`; `INITIAL_EXPORTS` static rows |
| Fake billing | `src/app/pages5.tsx`, `src/app/data.ts` | `PAYMENT_CARDS` (Visa 4242 / Mastercard 5544), `INVOICES` static, copy *"billed monthly via Stripe · SCA/3-D Secure enforced"*, *"Card data never touches Zybble servers — tokenized directly by Stripe"* |
| Fake API key | `src/app/pages5.tsx` | `useState("zyb_live_8f3k2md9qj4x7w1h")`, regenerate = random string |
| Fake team / notifications / usage | `src/app/data.ts` | `TEAM`, `NOTIF_DEFAULTS`, `PLAN_USAGE = { plan: "Growth", used: 3214, quota: 10000 }` shown in `AppShell` quota widget |
| Local-only settings | `src/app/pages5.tsx` | profile/notification/privacy toggles mutate component state only |

### 1.3 Contracts the backend must satisfy (from the actual JSX)

* `/findleads` form fields: `niche`, `city`, `radius` (2–25, **labelled km**), `depth` (4/8/10/12/16), `language` (en/de/fr/pt/es/nl), `email` toggle (default **on**), `fastMode` toggle (default off, "up to 21 results per query"), advanced `minRating`, `minReviews`; two modes — manual and AI brief ("Plan with AI" → plan → user approves → run).
* `/leads` uses **bulk selection**, filters, sorting, bulk "add to list", bulk export.
* `/lead/{slug}` shows contact, website, social, location, rating, reviews/hour rows, plus an "AI analysis" action and list membership.
* `/search/{slug}` shows status, progress, counters, an event **log**, and pause/resume/cancel/rerun/export.
* `/billing` shows plan cards (Starter $0/50 leads, Growth $49/10 000, Scale $99/50 000), trial copy ("Start 14-day trial"), invoices, payment methods, cancel/resume.
* `/setting` tabs: `Appearance`, `Profile`, `Notifications`, `Payment methods`, `Team`, `API access`, `Preferences`, `Data & privacy` (workspace export + delete workspace), routed as `#/setting?tab=api`.
* Quota copy: *"only unique enriched leads count — dedupe is on by default"* and *"Growth quota 3214 / 10000"* → must become real metering.
* Export copy: *"Files are kept 30 days"* → retention must be implemented.

---

## 2. Gosom engine architecture findings (commit `549e4b5e`, v1.18.1)

Inspected (not just the README): `main.go`, `runner/runner.go`, `runner/jobs.go`, `runner/databaserunner/databaserunner.go`, `runner/resume/writer.go`, `rqueue/*`, `cmd/gmapssaas/cmdworker/cmd_worker.go`, `scraper/scraper.go`, `scraper/provider.go`, `scraper/centralwriter.go`, `postgres/provider.go`, `postgres/resultwriter.go`, `gmaps/entry.go`, `gmaps/job.go`, `gmaps/searchjob.go`, `gmaps/place.go`, `gmaps/emailjob.go`, `gmaps/multiple.go`, `exiter/exiter.go`, `deduper/*`, `grid/grid.go`, `internal/proxyconfig/proxyconfig.go`, `Dockerfile`, `Dockerfile.saas`, `Makefile`, `skills/google-maps-scraper/**`.

### 2.1 Execution modes

`runner.ParseConfig()` selects a run mode: file, database (`-dsn`), produce-only, install-playwright, web, AWS Lambda. **`runner.Config` is the canonical configuration surface** and includes: `Concurrency`, `MaxDepth`, `LangCode`, `Email`, `GeoCoordinates`, `Zoom`, `Radius` (**meters**, default 10000), `FastMode`, `ExtraReviews`, `DisablePageReuse`, `BrowserPoolSize`, `MaxPagesPerBrowser`, `GridBBox`, `GridCellKm`, `Proxies`, `Resume`, `ExitOnInactivityDuration`.

Defaults verified in code: `-c` = `max(NumCPU/2, 1)`; `-depth 10`; `-zoom 15`; `-radius 10000` metres; `-pages-per-browser 1`; `-grid-cell 1.0` km.

### 2.2 Standard mode vs fast mode (this drives Zybble search semantics)

* **Standard mode** (`cfg.FastMode == false`) → `gmaps.NewGmapJob(...)` in `runner/jobs.go`: a real browser (playwright) opens `google.com/maps/search/...`, scrolls the feed `maxDepth` times, then **one `PlaceJob` per discovered place** fetches the full place payload; if `ExtractEmail` is set, each place spawns `gmaps.EmailExtractJob` which visits the business website and extracts `mailto:`/regex e-mails. This produces the rich `gmaps.Entry` (36+ fields). Results are emitted **per place as they complete** → progressive persistence is possible at the engine level.
* **Fast mode** (`cfg.FastMode == true`) → `gmaps.NewSearchJob(...)`: HTTP (`/search?tbm=map&...&pb=...`) only, `scrapemateapp.WithStealth("firefox")`, entries parsed from the raw protobuf-JSON in `gmaps.ParseSearchResults` — **a reduced field set and no per-place detail**, and it **hard-requires geo coordinates + zoom + radius**: `CreateSeedJobs` returns `"geo coordinates are required in fast mode"` otherwise (`runner/jobs.go`).
* Grid mode → `runner.CreateGridSeedJobs` + `grid.BoundingBox` (`"minLat,minLon,maxLat,maxLon"`), one query per cell, dedupe across cells via the shared deduper. There is an explicit `~120 results per search` limit rationale documented in `grid/grid.go`.

### 2.3 Result pipeline

`scrapemate.ResultWriter` implementations consume `scrapemate.Result{Job, Data}` where `Data` is `*gmaps.Entry` or `[]*gmaps.Entry` (`scraper/centralwriter.go`, `postgres/resultwriter.go`, `runner/resume/writer.go`). Two reference behaviours:

* `postgres.NewResultWriter` batches up to **50 entries or 1 minute** before writing to `results` — good throughput, **bad first-lead latency**.
* `scraper.CentralWriter` buffers *all* entries and flushes only at `MarkDone` — worse for live UX.

Zybble therefore implements **its own** `scrapemate.ResultWriter` that persists progressively (small batches, short time window, transaction per batch) instead of reusing either, while keeping the engine's completion accounting intact (`WriterManagedCompletion`, `exiter.Exiter`, `CompletionTracker`).

### 2.4 Engine completion/exit accounting

* `exiter.New()` → `SetSeedCount`, `SetCancelFunc`, `IncrSeedCompleted/PlacesFound/PlacesCompleted`, `Run(ctx)` cancels the scrape when seeds and places are all accounted for.
* `gmaps.CompletionTracker` (`SeedDiscovered(inputID, placesFound)`) reports per-input discovery — the documented mechanism used by `runner/resume` for append/resume.
* `scraper.Provider` (FIFO bridge) vs `postgres.Provider` (durable `gmaps_jobs` table + gob payloads, batch claim of 10) — the latter is the proven durable-queue pattern we deliberately mirror in Zybble's own schema.
* `-resume` is **file-scrape specific** (`"resume a CLI file scrape by reading existing results and appending missing places"`) and `runner/resume/*` tracks identity sets for CSV/JSONL append. It is *not* a general "resume an interrupted database job" feature → Zybble's pause/rerun is implemented at the Zybble queue + dedupe layer (documented in ARCHITECTURE.md §pause/resume).
* Graceful shutdown: `main.go` traps `SIGINT`/`SIGTERM`, cancels the context, and calls `runnerInstance.Close(ctx)` — the model Zybble's worker follows.
* Browser capacity knobs: `AppendBrowserCapacityOptions` → `WithMaxPagesPerBrowser`, `WithBrowserPoolSize`; page reuse via `WithPageReuseLimit(2)` / `WithBrowserReuseLimit(200)` unless `-disable-page-reuse`.
* Telemetry is disabled with `DISABLE_TELEMETRY=1` (`runner.Telemetry()`), which Zybble sets on the worker.

### 2.5 Proxy handling

`internal/proxyconfig.Resolve(inline, filePath)` accepts `-proxies` (comma separated) **or** `-proxies-file` (one per line, `#` comments), never both (returns `ErrConflict`). Schemes are the standard `socks5/socks5h/http/https` URLs. Credentials live inside the URL → Zybble never logs the array and prefers `-proxies-file` semantics by writing a per-worker temporary file (documented; see ARCHITECTURE.md).

### 2.6 Engine data model

`gmaps.Entry` (json tags): `input_id, link, cid, title, categories, category, address, open_hours (map[string][]string), popular_times (map[string]map[int]int), web_site, phone, plus_code, review_count, review_rating, reviews_per_rating, latitude, longtitude (longitude), status, description, reviews_link, thumbnail, timezone, price_range, data_id, place_id, images, owner, about, street_view_url, reservations, order_online, menu, emails, ...user_reviews / user_reviews_extended`. Zybble stores the **whole** entry in `leads.raw_data JSONB` **and** promotes queryable fields to typed columns (task requirement §30).

### 2.7 What we explicitly do **not** ship

`cmd/gmapssaas` (serve/worker/admin), `rqueue` (River queue + `gmaps_jobs`, `results`, `scrape_results`), `api/*` swagger API, `admin/*`, API-key middleware, and the provisioning wizard are Gosom's own SaaS product. Zybble uses Gosom strictly as a **library** inside its own Go worker; Zybble's own auth/workspaces/billing/leads/queue are entirely separate (§27 of the brief).

---

## 3. Authentication research

* Supabase Auth is the only identity system (no second auth stack). The SPA uses `@supabase/supabase-js` (v2 line) with the **publishable key**; sessions are handled by the client library (`getSession`, `onAuthStateChange`, automatic refresh) and **every server route re-verifies** the access token with `supabase.auth.getUser(jwt)` against the Auth server (never by decoding the JWT locally, never by trusting a client-sent `user_id`).
* Password reset: `resetPasswordForEmail(email, { redirectTo })` → the SPA lands on `#/resetpassword` with a recovery token in the URL fragment; the client calls `exchangeCodeForSession`/`setSession` per current docs and then `updateUser({ password })`. No hand-rolled tokens.
* Email verification: `signUp` returns either a session or a "confirm your e-mail" state depending on project settings; the API is tolerant of both (provisioning is retried idempotently after first successful sign-in).
* OAuth (Google/GitHub buttons already in the UI): wired through `signInWithOAuth({ provider, options: { redirectTo } })`. The buttons only render as "available" if the backend reports the provider as configured (`/api/auth/providers`), otherwise they are visibly disabled — they must never fake success.

## 4. Supabase research

### 4.1 API keys — **discrepancy found (important)**

Source: <https://supabase.com/docs/guides/getting-started/api-keys> (checked 2026-09-22).
The docs state plainly: *"Supabase is deprecating the `anon` and `service_role` keys by the end of 2026. Use the publishable (`sb_publishable_xxx`) and secret (`sb_secret_xxx`) keys instead."*

* Publishable key → browser (maps to `anon`, or `authenticated` once a user JWT is attached).
* Secret key → server only (maps to `service_role`, bypasses RLS).
* Legacy `anon`/`service_role` JWTs continue to work until disabled in the dashboard.

**Consequence:** the brief's env names `VITE_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` are the *legacy* names. Zybble accepts **both** conventions (new preferred) and documents the mapping; see `.env.example` and `docs/DEPLOYMENT.md`.

### 4.2 RLS

Source: <https://supabase.com/docs/guides/database/postgres/row-level-security> (checked 2026-09-22).
Key facts applied: grants are evaluated **before** policies (a missing grant yields `42501` even for a valid policy); *adding policies does not remove default grants*, so Zybble's migrations `revoke` client grants and grant back only what each role needs; `auth.uid()` is the policy primitive; `service_role` bypasses RLS entirely; views bypass RLS by default (so no RLS-sensitive views are exposed).

Design consequence: **the browser talks to the API, not to PostgREST tables.** All privileged reads/writes happen through Vercel routes using the secret key, and RLS is the second layer that still protects data if a publishable key is used directly. RLS policies are written for `authenticated` on every customer table using a `SECURITY DEFINER`-free membership helper.

### 4.3 Realtime

Source: <https://supabase.com/docs/guides/realtime/postgres-changes> (checked 2026-09-22).
Current API: `supabase.channel('...').on('postgres_changes', { event, schema, table, filter: 'col=eq.value' }, cb).subscribe()`; server-side filters (`eq, neq, lt/lte/gt/gte, in, like/ilike, match/imatch, is, isdistinct`, negation with `not.`, AND by comma); tables must be added to the `supabase_realtime` publication (`alter publication supabase_realtime add table ...`); a `postgresChangesFilter()` type-safe helper exists in `@supabase/supabase-js`; **RLS applies to Realtime**: the subscribed user only receives rows their policies allow.

Design consequence: Realtime carries `search_events` (log lines) and `searches` (status/progress) and `notifications`; high-frequency counters are written at a throttled cadence (see §5.3) and the client also polls, because Realtime is a delivery mechanism, not the source of truth.

## 5. Razorpay research

Sources (all checked 2026-09-22): <https://razorpay.com/docs/us/api/payments/subscriptions/>, <https://razorpay.com/docs/us/payments/subscriptions/>, <https://razorpay.com/docs/us/payments/subscriptions/integration-guide>, <https://razorpay.com/docs/us/webhooks/validate-test/>, <https://razorpay.com/docs/webhooks/subscriptions/>, <https://razorpay.com/docs/us/payments/international-payments>.

### 5.1 Subscription model actually used

1. `POST /v1/plans` (created once per Zybble plan, stored as `plans.razorpay_plan_id`; created through the dashboard or API — never hard-coded in source).
2. `POST /v1/subscriptions` (`plan_id`, `total_count`, `quantity`, optional `start_at`/trial, `customer_notify`, `notes` carrying `workspace_id`/`plan_code`).
3. **Standard Checkout** with `subscription_id` → authorisation transaction → client receives `razorpay_payment_id`, `razorpay_subscription_id`, `razorpay_signature`.
4. **Mandatory server-side verification**: `hmac_sha256(razorpay_payment_id + "|" + subscription_id, key_secret)` compared to `razorpay_signature`. The `subscription_id` must come from **our** database, not from the Checkout response.
5. Lifecycle: `POST /v1/subscriptions/:id/cancel` (`cancel_at_cycle_end` supported), `POST /v1/subscriptions/:id/pause`, `POST /v1/subscriptions/:id/resume`, `PATCH /v1/subscriptions/:id`, `GET /v1/subscriptions/:id/invoices`.

### 5.2 Webhooks

* Signature header `X-Razorpay-Signature` = HMAC-SHA256 over the **raw request body** keyed by the webhook secret. Docs are explicit: *"Do not parse or cast the webhook request body"* before verification → the Vercel handler reads `await req.text()` first and verifies before `JSON.parse`.
* Duplicate deliveries are expected; the documented dedupe key is the **`x-razorpay-event-id`** header (unique per event) → `billing_events.provider_event_id UNIQUE`.
* Delivery order is not guaranteed → handlers are written to be order-insensitive (state is always recomputed from the payload's subscription status + timestamps).
* Subscription events to handle: `subscription.authenticated`, `subscription.activated`, `subscription.charged`, `subscription.completed`, `subscription.updated`, `subscription.pending`, `subscription.halted`, `subscription.cancelled`, `subscription.paused`, `subscription.resumed` (the brief's list omits `pending`/`resumed`; both exist in current docs and are handled), plus `payment.captured`/`payment.failed` for ledger rows.
* States documented by Razorpay: `created`, `authenticated`, `active`, `pending`, `halted`, `cancelled`, `completed`, `paused`, `expired`.

### 5.3 USD / international — **discrepancy & risk recorded**

* Razorpay's international-payments page lists Subscriptions as supporting international payments for Indian businesses (Products table: Subscriptions → International Payments **Yes**) and documents `USD` amounts in **minor units** (`$20` → `currency: "USD", amount: 2000`).
* The **US-business** variant of the same page lists only *Payment Gateway (Checkout)* and *Payment Links* for international cards; Subscriptions there is card-recurring and the international table does not list it.
* Therefore: **USD recurring subscriptions are an account-level capability that must be activated on the Zybble merchant account (Subscriptions product + international payments + USD purpose code/settlement).** The API accepting `currency: "USD"` is not evidence that the account can charge it.

Design consequence: all Razorpay calls go through `BillingProvider` with a `RAZORPAY_ENABLED` capability flag and an explicit startup/preflight check (`/api/billing/provider-status`) so the UI can tell the truth ("card checkout not yet enabled on this account") instead of failing at the last step. Money is stored in **minor units (integers)** with `currency CHAR(3)`; no floating point anywhere.

## 6. Vercel & Railway research

* **Vercel functions** (<https://vercel.com/docs/functions/limitations>, checked 2026-09-22): with Fluid compute, default max duration 300 s; Pro/Enterprise up to 800 s (1800 s extended beta); 250 MB uncompressed bundle; full Node.js API coverage; file descriptors capped at 1024 shared per instance. → Requests stay thin (`validate → authorize → read/write → enqueue → return`). Gemini **planning** may run inline (short); anything long-running is a queued job. Browser automation never runs on Vercel.
* **Railway** (config-as-code fields confirmed via current `railway.toml` examples and Railway's own reference: `[build] builder`, `[build] buildCommand`, `[deploy] startCommand`, `[deploy] healthcheckPath`, `[deploy] healthcheckTimeout`, `[deploy] restartPolicyType`, `restartPolicyMaxRetries`): the worker is a long-lived service started from a Dockerfile, with `healthcheckPath = "/health"` as a **deploy gate**, and `restartPolicyType = "ON_FAILURE"` for crash recovery. Railway's health check runs at deploy time, so the worker additionally exposes `/health` for external monitoring and performs its own self-recovery (lease reclamation) on startup.
* The worker image must ship the Playwright/Chromium runtime; Zybble's `Dockerfile.worker` mirrors Gosom's own `Dockerfile` (browser deps + `playwright install chromium --with-deps`, `PLAYWRIGHT_BROWSERS_PATH=/opt/browsers`), because gosom depends on `playwright-go v0.6100.0`.

## 7. Source ledger (what was checked, when)

| Source | Checked | Used for |
|---|---|---|
| `github.com/sutarorg/zybblesaas` @ `2944802` | 2026-09-22 | routes, screens, contracts, demo systems |
| `github.com/gosom/google-maps-scraper` @ `549e4b5e` (v1.18.1) | 2026-09-22 | engine integration, flags, data model, exit/completion, proxies, Docker |
| ai.google.dev/gemini-api/docs/models | 2026-09-22 | model identifiers & deprecations |
| supabase.com/docs/guides/getting-started/api-keys | 2026-09-22 | publishable/secret key migration |
| supabase.com/docs/guides/database/postgres/row-level-security | 2026-09-22 | grants-before-policies, RLS patterns |
| supabase.com/docs/guides/realtime/postgres-changes | 2026-09-22 | Realtime API + filters + publication |
| razorpay.com/docs/us/api/payments/subscriptions | 2026-09-22 | subscription REST surface |
| razorpay.com/docs/us/payments/subscriptions/integration-guide | 2026-09-22 | checkout + signature verification |
| razorpay.com/docs/us/webhooks/validate-test | 2026-09-22 | HMAC signature + `x-razorpay-event-id` idempotency |
| razorpay.com/docs/webhooks/subscriptions | 2026-09-22 | event list + semantics |
| razorpay.com/docs/us/payments/international-payments | 2026-09-22 | USD/minor units, activation caveats |
| vercel.com/docs/functions/limitations | 2026-09-22 | duration/bundle limits |
| Railway config-as-code reference (via current `railway.toml` examples + docs) | 2026-09-22 | healthcheck/restart policy fields |

---

## 8. Discrepancies between the brief and current official documentation

1. **Supabase key names (docs beat prompt).** Brief §173/§174 use `*_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`. Current docs deprecate those by end of 2026. → Implementation accepts `SUPABASE_PUBLISHABLE_KEY`/`SUPABASE_SECRET_KEY` **and** the legacy names; documented in README/DEPLOYMENT.
2. **`gemini-2.5-pro` is no longer the frontier model (still available).** The models page on 2026-09-22 lists Gemini 3.8 Flash as current stable, Gemini 3.1 Pro (preview), and still lists `gemini-2.5-pro` under the 2.5 family (Gemini 2.0 Flash and 3 Pro Preview are shut down). The brief's model remains valid, so `GEMINI_MODEL=gemini-2.5-pro` is the shipped default — configurable in one place, with a deprecations-page link in the README so the model can be swapped without code changes.
3. **Fast mode requires coordinates.** `runner.CreateSeedJobs` refuses fast mode without `geo`+`zoom`. The current `/findleads` UI collects only *"niche"* + *"location"* text and has no geocoder. Because the brief forbids the Google Maps/Geocoding API as a dependency, Zybble ships a `geo_places` table (curated public city/region centroids) + accepts explicit `latitude`/`longitude`; if a location cannot be resolved, **fast mode is refused with an explicit validation error** rather than silently degrading to standard mode (brief §56/§290 honesty rules).
4. **Vercel duration limits.** The brief says "Vercel now supports longer-running functions"; current docs confirm 300 s default / 800 s max (Pro) — this does not change the decision: scraping stays on Railway.
5. **Razorpay USD recurring.** Documented above (§5.3): capability must be activated per account; implemented behind a provider capability check.
6. **Frontend Stripe copy.** `src/app/pages5.tsx` contains Stripe/SCA copy and fake Visa/Mastercard rows; replaced with Razorpay-checkout copy and provider-backed payment metadata (brief §348/§352).
7. **Gosom's own SaaS.** Present in the repo (`cmd/gmapssaas`, `rqueue`, `admin`, `api`, `gmaps_jobs`/`results` tables). Explicitly **not** deployed as Zybble's backend (brief §27); Gosom is consumed as a Go library.
8. **`-resume` scope.** Gosom's resume is file-scrape append mode; pause/rerun semantics are therefore implemented in Zybble's queue (input-level progress + dedupe), and Zybble does **not** claim checkpoint-level resume of a half-finished Google Maps crawl. Search progress is tracked per query input, so a resumed search re-issues only inputs that never reported discovery, and idempotent lead upserts prevent double counting.
9. **Radius units.** Gosom's `-radius` is **metres** while the UI label is **km** → the API contract uses `radius_km` and converts to metres exactly once (documented in `server/services/searchConfig.ts`), avoiding a mixed-unit bug.

---

## 9. Architecture decisions and reasons

| # | Decision | Reason |
|---|---|---|
| D1 | Keep the Vite SPA, add a Vercel `api/` directory (Node runtime) instead of migrating to Next.js | Brief §15/§265: no UI redesign, no framework migration without proving benefit; hash routing needs no SSR |
| D2 | Supabase Postgres is the single source of truth; the queue is a table in the same database | Brief §41/§136/§393: `FOR UPDATE SKIP LOCKED` + leases; no Redis until measured |
| D3 | API layer talks to Postgres through PostgREST (supabase-js, secret key) + SQL RPCs; **no** raw Postgres pool in Vercel | Serverless connection exhaustion; atomic operations (quota reservation, job claim, counter updates) are expressed as SQL functions so they are single round-trips and concurrency-safe |
| D4 | The Railway worker uses **direct pgx with a bounded pool** | Long-lived process; needs `LISTEN`-free but frequent short transactions, `SKIP LOCKED` claims, and batched writes |
| D5 | Go worker embeds Gosom as a library (`gmaps`, `runner.CreateSeedJobs`, `scrapemateapp`) with a Zybble `scrapemate.ResultWriter` | Brief §48: direct integration, no HTTP layer between Zybble and Gosom; a Zybble writer (not `CentralWriter`) is required for progressive persistence and Zybble's own schema |
| D6 | Scraper abstracted behind `ScraperEngine` (Go interface) with `GosomScraperEngine` implementation; API layer never imports engine internals | Brief §28/§395: engine replaceability, and the API layer only ever writes a *job payload* |
| D7 | Globally deduplicated `leads` + `search_leads` association; per-workspace association rows carry the billable unit | Brief §35/§36/§138: one business = one canonical row; workspace isolation lives in association/entitlement rows, never by leaking other workspaces' links |
| D8 | Job types as first-class `job_queue.job_type` values with per-type concurrency loops inside one Railway service | Brief §43/§198/§199: different resources (browser vs API-rate vs DB/IO) |
| D9 | Prompts/plans/quota logic live in TypeScript services; the worker only executes and persists | Keeps Vercel the "control plane" and the worker a "data plane", matching the brief's diagram |
| D10 | Realtime for delivery, polling fallback always available, counters written at a throttled cadence | Brief §23/§24/§373; Realtime is not the source of truth |
| D11 | Money in minor units + explicit `currency`; Razorpay identifiers nullable; `billing_events` dedupe on `x-razorpay-event-id` | Brief §344/§345/§88/§91 |
| D12 | Exports generated by the worker into a **private** Supabase Storage bucket, delivered as short-lived signed URLs; retention enforced by a cleanup job | Brief §80–§83, §178, §311 |
| D13 | Rate limiting + idempotency implemented with Postgres-backed counters/locks (no extra infrastructure) | Brief §167/§166/§391 |
| D14 | Lead quality score is deterministic coverage math computed in SQL/TS from captured fields | Brief §34: no invented values |
| D15 | `geo_places` table + optional client coordinates for fast mode/grid; no Google geocoding dependency | Brief §26/§288 + finding 3 in §8 |
