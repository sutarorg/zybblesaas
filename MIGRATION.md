# Migration: demo frontend → production product

The original Zybble repository was a convincing front end with no backend: every
"system" in it was simulated in the browser. This document records what was
replaced, endpoint by endpoint and file by file, so the change is reviewable and
reversible rather than mysterious.

Nothing about the UI, the routes or the visual design was redesigned. The
screens are the same; the data behind them is now real.

---

## 1. What the demo did, and what replaced it

| Demo system (file) | What it pretended | What replaced it |
| --- | --- | --- |
| `src/app/auth.tsx` — "any email and password walk right in", Google/GitHub buttons, a `sessionStorage["zybble_session"]` blob | Authentication, sign-up, password reset | Supabase Auth: `signInWithPassword`, `signUp` (with a real *check your inbox* state when confirmation is on), `resetPasswordForEmail` (PKCE), `updateUser({password})` gated on a recovery session. The social buttons were removed rather than faked, because no OAuth provider was configured. |
| `src/lib/data.ts`-style generators (`Mara Okafor`, seeded `generateLeads`, `poolFull`, fake progress timers) | Leads, searches, exports, stats | Real API calls through `src/lib/api.ts`; hook layer in `src/app/hooks.ts` (React state + polling + Realtime). |
| `pages1–4` in-memory arrays and `loadLeadPool()` | 4,000 "leads", AI summaries, quality scores | `public.leads` / `workspace_leads` / `lead_emails` / `lead_reviews` / `lead_ai_analyses` via `/api/leads`, `/api/searches`, `/api/lists`. |
| Fabricated search progress (`setInterval` + `Math.random`) | Scrape progress and ETA | `searches.progress_percent`, `phase`, `search_inputs.places_discovered/completed`, `search_events`, written by the worker from real engine callbacks. ETA appears only when there is measured throughput. |
| `PLAN_USAGE` constants and "3 of 5 searches used" copy | Quota | `public.usage_counters` + `workspace_entitlements()`, surfaced through `useWorkspace()` and the sidebar meter. |
| Stripe copy, fake Visa/Mastercard rows, "Manage billing in Stripe" | Billing | Razorpay Subscriptions: `/api/billing/checkout` → Razorpay Checkout → `/api/billing/verify`, webhooks for state, `payments`/`invoices`/`payment_methods` for history. No Stripe dependency exists anywhere (verified: no `stripe` package, no Stripe copy left in `src/`). |
| Client-side "export" that built a CSV from the in-memory array | Exports | Server-side export jobs (`exports` table, worker rendering, private bucket, 300 s signed URLs). |
| `src/app/pages5.tsx` settings tabs with local state only | Profile, workspace, team, API keys, notifications | `/api/settings`, `/api/settings/team`, `/api/keys`, `/api/notifications` — all backed by RLS-protected tables with audit logging. |

The only synthetic data still present in the repository is the landing-page
preview (`src/components/Demo.tsx`, `src/components/Radar.tsx`). It is
deliberately kept and now labelled for what it is — *Guided preview* and
*simulated extraction feed* — because it is a marketing illustration that never
touches an account, a search, or the database.

---

## 2. Endpoint mapping

| Screen | Old behaviour | New API |
| --- | --- | --- |
| `/signin`, `/signup`, `/forgotpassword`, `/resetpassword` | Any credentials accepted | Supabase Auth (client SDK, PKCE) |
| `/dashboard` | Random counters | `GET /api/stats`, `GET /api/me`, `GET /api/notifications` |
| `/findleads` | Fake plan, fake queue | `POST /api/ai/plan` (planning, **no search quota**), then `POST /api/searches` (approve → run) |
| `/searches`, `/search/{slug}` | Fake rows and a fake progress bar | `GET /api/searches`, `GET/PATCH /api/searches/{slug}` (pause/resume/cancel/rerun), Realtime + polling on `searches`/`search_events` |
| `/leads`, `/lead/{slug}` | Generated pool | `GET /api/leads`, `GET/POST /api/leads/{slug}` (notes, tags, status, scoring, analysis) |
| `/lists`, `/list/{slug}` | Local arrays | `GET/POST /api/lists`, `GET/PATCH/POST/DELETE /api/lists/{slug}` |
| `/exports` | In-browser CSV | `GET/POST /api/exports`, `GET/DELETE /api/exports/{slug}`, signed download URLs |
| `/zybbleai` | Canned replies | `POST /api/ai/chat`, `POST /api/ai/analyze`, `POST /api/ai/score`, `POST /api/ai/list-analysis` |
| `/billing` | Static plan cards + Stripe copy | `GET /api/billing/plans`, `GET/POST /api/billing/subscription`, `POST /api/billing/checkout`, `POST /api/billing/verify` |
| `/setting` | Local-only forms | `GET/PATCH /api/settings`, `POST /api/settings/team`, `/api/keys`, notification preferences |

Request shapes, error codes and the response envelope are documented in
`ARCHITECTURE.md` §2.2 and implemented in `api/_lib/http.ts`.

---

## 3. Frontend changes that were required (and nothing more)

1. **A single client module** (`src/lib/api.ts`) that attaches the Supabase
   session token, understands the error envelope, and exposes one typed function
   per endpoint.
2. **A session provider** (`src/app/session.tsx`) so auth state is not scattered:
   `loading | signed_out | signed_in | unconfigured`.
3. **A route gate** (`RequireSession` in `src/App.tsx`) that renders an honest
   "backend not configured" notice or a sign-in prompt for the shelled routes.
4. **Hooks per resource** replacing module-level fake arrays, with polling
   intervals matched to how fast each resource actually changes.
5. **Deletion of the fake generators** from `src/app/*` (they survive only in the
   landing-page demo, where they are labelled as a simulation).

Routes, layout, navigation, components and styling are untouched, so the
migration cannot regress the interface. The proof is the diff: `src/app/*.tsx`
changed data sources, not markup structure.

---

## 4. Environment migration

The demo needed no configuration at all. Production needs three environments,
described in `.env.example`:

| Environment | Variables |
| --- | --- |
| Vercel (browser) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` |
| Vercel (server) | `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `APP_URL`, `GEMINI_*`, `RAZORPAY_*` |
| Railway (worker) | `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `GEMINI_API_KEY`, `WORKER_*`, optional `RESEND_API_KEY` / `EMAIL_FROM` |

Rules that are enforced by review and by the layout of the code:

- No secret may carry a `VITE_` prefix (Vite would inline it into the bundle).
- `src/` may only import `src/lib/supabase.ts` (publishable key) — never
  `api/_lib/env.ts`.
- The worker and the API read the same provider variables, so a rotating secret
  is a single update in two dashboards, not a code change.

---

## 5. Data migration

There is no legacy production data to migrate: the demo stored everything in
browser memory (and briefly in `sessionStorage`), so there is nothing to import
and no user data to reconcile. What does migrate is **seed data**: migration
`0010` inserts the three plans, the geo centroid table used instead of a
geocoding API, and operational defaults.

If you are upgrading an existing installation of this backend later, the rule is
the one already followed in `supabase/migrations`: append a new numbered
migration, never edit an applied one.

---

## 6. Cutover checklist

1. Apply the migrations to the production Supabase project (§1 of
   `DEPLOYMENT.md`).
2. Set all Vercel and Railway variables.
3. Deploy the API first, then the worker (the API tolerates a missing worker: it
   queues jobs and says so).
4. Verify `/api/health` reports `database.ok: true` and a worker with a recent
   heartbeat.
5. Run the end-to-end checklist in `DEPLOYMENT.md` §6 against a real account.
6. Only then point DNS at the new deployment.

**Backout.** The front end is static and the API is stateless, so the previous
deployment can be re-promoted from Vercel instantly. The database is additive;
there is no destructive migration to undo. Stop the Railway service to halt all
background work immediately (jobs are leased, so nothing is lost — they are
reclaimed when a worker returns).

---

## 7. What deliberately did **not** migrate

- **No framework migration.** The SPA stays Vite + React + TypeScript on Vercel.
- **No Gosom SaaS.** Gosom's own admin UI, API-key product, web server and job
  tables are not deployed; only its engine packages are imported as a library.
- **No Google Maps API dependency.** The engine reaches Google Maps directly, and
  a curated `geo_places` table replaces geocoding, so no
  `GOOGLE_MAPS_API_KEY` exists in any environment.
- **No new infrastructure.** No Redis, Kafka, RabbitMQ, Kubernetes,
  Elasticsearch or ClickHouse — the queue is a Postgres table.
