# Zybble

Zybble finds local businesses on Google Maps, enriches them (phone, website,
emails, reviews, socials), scores them, and hands them to a sales team as
lists and exports.

This repository contains the **whole product**: the React SPA, the serverless
API, the Postgres schema with row level security, the background worker that
runs the Google Maps engine, and the infrastructure configuration for Vercel,
Supabase and Railway.

> **Honesty rule.** Nothing in this product fabricates data. There is no fake
> auth, no fake search results, no fake progress, no fake billing state and no
> fake exports. If a provider (Gemini, Razorpay, the storage bucket, the email
> provider) is not configured, the UI says so and the API returns
> `503 not_configured` — it never pretends to have worked. The only synthetic
> data left in the repository is the marketing preview on the landing page,
> which is explicitly labelled *Guided preview* and never touches a real
> account.

## How it is put together

| Piece | Runs on | What it does |
| --- | --- | --- |
| React 19 + Vite + TypeScript SPA (`src/`) | Vercel (static) | The existing Zybble UI, unchanged routes, now bound to the real API |
| API functions (`api/**`) | Vercel (Node 22) | Auth, entitlements, quota, CRUD, billing, exports, API keys, notifications |
| Postgres + Auth + Storage + Realtime (`supabase/migrations`) | Supabase | The single source of truth: schema, RLS, SQL functions, the job queue |
| Go worker (`worker/`) | Railway (Docker) | The Gosom Google Maps engine, exports, AI jobs, email, cleanup |

**Why this split:** Google Maps scraping drives a real headless Chromium for
minutes and must survive restarts, so it cannot run inside a Vercel function
(300 s default, 800 s maximum, 250 MB bundle). Everything expensive is a row in
`ops.job_queue` — a durable, leased, retried table in the same Postgres
database. There is no Redis, no Kafka, no Kubernetes, and none is needed until
measurements say otherwise. See `ARCHITECTURE.md`.

## Repository map

```
api/                     Vercel serverless API (one file per route, `_lib/` for shared code)
src/                     The React SPA (routes are unchanged: /dashboard, /findleads, …)
worker/                  Go worker: queue loop + Gosom engine + writers + health server
supabase/migrations/     Every table, policy, function and seed row (0001 … 0011)
tests/                   Migration, RLS/security, queue and schema-contract tests (PGlite)
scripts/                 Local tooling (schema dump, DB introspection)
ARCHITECTURE.md          Components, data flow, tables, queue, AI, exports, security
DEPLOYMENT.md            Step-by-step production deployment (Supabase, Vercel, Railway, Razorpay)
MIGRATION.md             What changed to turn the demo frontend into this product
RESEARCH.md              Engine/API research, decisions (D1…D19) and documented discrepancies
.env.example             Every environment variable, grouped by where it belongs
```

## Local development

Prerequisites: Node 22+, npm. Docker is optional (only for the worker).

```bash
npm install
cp .env.example .env.local     # fill in VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev                    # SPA at http://localhost:5173
```

The API functions run on Vercel, so `npx vercel dev` gives you the full stack
locally. Point it at the same Supabase project (or a branch database) and run
the migrations once:

```bash
npx supabase link --project-ref <ref>
npx supabase db push           # applies supabase/migrations/*.sql in order
```

### Tests and gates

```bash
npm test                       # vitest: migrations, RLS, queue semantics, API/schema contract
npm run typecheck              # strict TypeScript for the SPA
npx tsc -p tsconfig.api.json --noEmit   # strict TypeScript for the API
npm run build                  # production bundle
npm run smoke:api              # drill every API route with no env configured
```

`npm run smoke:api` imports all 28 route modules and calls them through the real
`route()` wrapper: it checks that unsupported methods return `405` + `Allow`,
that anonymous calls are refused, that malformed bodies produce the error
envelope, that provider-less deployments return `503 not_configured` instead of
fake data, and that no response leaks a secret-shaped value.

CI (`.github/workflows/ci.yml`) runs the SPA typecheck, the API typecheck, the
test suite, the smoke drill and the production build, then builds and vets the
Go worker (`go mod tidy`, `go vet ./...`, `go build ./...`). Both jobs are green
on the current branch; the worker job is the only thing that has ever compiled
`worker/`, so treat a red worker job as a hard stop.

`tests/db/harness.ts` boots a real PostgreSQL 16 engine in-process (PGlite) and
applies the migrations, so the schema, the policies and the queue functions are
executed for real rather than described. Those tests are the reason the
migrations can be trusted before anyone has run them against a live project.

### The worker

```bash
cd worker
go vet ./...
go build ./...
docker build -t zybble-worker .          # includes Chromium + the Playwright driver
docker run --rm --env-file ../.env.local -p 8080:8080 zybble-worker
```

`GET /health` (database ping), `GET /ready` (queue stats) and `GET /metrics`
(counters) are served on `PORT_ADDR` (default `:8080`). Railway's
`healthcheckPath` points at `/health`.

## Plans and quota

Plans live in the `plans` table and are seeded by migration `0010`:

| Code | Price | Leads / month | AI runs / month | Seats | Concurrent searches |
| --- | --- | --- | --- | --- | --- |
| `starter` | $0 | 50 | 0 | 1 | 1 |
| `growth` | $49.00 | 10,000 | 300 | 3 | 2 |
| `scale` | $99.00 | 50,000 | 2,000 | 10 | 4 |

Money is stored in **minor units** with an explicit currency, exactly as
Razorpay expects it. Usage is counted by SQL functions
(`usage_record` / `usage_reserve`) so the API and the worker can never disagree
about what a workspace has spent.

## Documentation

- `ARCHITECTURE.md` — how the pieces fit, the queue contract, the tables, the security model.
- `DEPLOYMENT.md` — the exact production runbook, plus what to check after deploying.
- `MIGRATION.md` — the demo → production changes, endpoint by endpoint.
- `RESEARCH.md` — engine findings, official-doc sources, and every place where the current documentation contradicts the original brief.
