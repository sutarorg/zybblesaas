# Deploying Zybble

This is the production runbook. It assumes you have (or are creating) accounts
on **Supabase**, **Vercel**, **Railway**, **Google AI Studio** and **Razorpay**,
plus a repository fork you can push to.

Everything in this document has been written against the code in this
repository. Where a step depends on a provider dashboard, the exact setting is
named. Where a step cannot be verified without live credentials, it is marked
**(verify on first deploy)**.

`.env.example` is the authoritative list of variables; this document explains
where each one comes from and in what order to do things.

---

## 0. Order of operations

1. Supabase project → schema, auth, storage, realtime. (§1)
2. Razorpay account → keys, plans, webhook. (§2)
3. Gemini API key. (§3)
4. Vercel project → SPA + API + environment variables. (§4)
5. Railway service → worker. (§5)
6. End-to-end verification. (§6)
7. Day-2 operations. (§7)

Nothing in steps 4–5 works before step 1; the API reports
`database.ok: false` with a message telling you exactly that.

---

## 1. Supabase

### 1.1 Create the project

Create the project, choose a region close to your users (and to Railway's
region, to keep database round-trips short), and save the database password.

### 1.2 Apply the migrations

Migrations live in `supabase/migrations/0001…0013` and are applied in order.
Either route works:

```bash
# A. Supabase CLI (recommended, tracks applied migrations)
npx supabase link --project-ref <project-ref>
npx supabase db push

# B. Plain psql against DATABASE_URL (session pooler or direct — whatever you use in Railway)
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0001_extensions_and_helpers.sql
# … and the rest, in filename order
```

What the migrations do, in short:

| Migration | Contents |
| --- | --- |
| `0001` | extensions, helper functions, `updated_at` triggers |
| `0002` | identity & tenancy: profiles, workspaces, members, invites, preferences |
| `0003` | billing & usage: plans, subscriptions, payments, invoices, usage counters |
| `0004` | leads & workspace leads (+ emails, socials, reviews, AI analyses) |
| `0005` | searches, search inputs, search events, lists, exports |
| `0006` | `ops.job_queue`, `ops.workers`, rate limits, idempotency keys |
| `0007` | all SQL functions (queue, progress, usage, notifications, lead upsert, stats) |
| `0008` | RLS policies, grants and the `security_invoker` views |
| `0009` | the private `zybble-exports` bucket + Realtime publication membership |
| `0010` | seed: plans (starter/growth/scale), geo centroids, system defaults |
| `0011` | notification → email queue hand-off |
| `0012` | exposes `public.rate_limit_hit` to PostgREST |
| `0013` | normalizes the engine's status string before it is stored (`public.normalize_lead_status` + updated `lead_upsert`) |

The test suite exercises these migrations against a real PostgreSQL 16 engine
(`npm test`), so a syntax or policy error is caught before it reaches a live
project.

### 1.3 Keys

Two keys matter, and they are **different** keys:

| Where | Variable | Which key |
| --- | --- | --- |
| Vercel build (browser) | `VITE_SUPABASE_PUBLISHABLE_KEY` | publishable / anon |
| Vercel server, Railway | `SUPABASE_SECRET_KEY` | secret / service-role |

Legacy names (`VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) are still
accepted for projects that have not rotated. The secret key bypasses RLS; it
must never be given a `VITE_` prefix.

### 1.4 Auth configuration

In **Authentication → URL Configuration**:

- **Site URL**: `https://your-domain`
- **Redirect URLs**: `https://your-domain/**` (the SPA uses hash routes and
  requests `origin + /#/resetpassword`), plus `http://localhost:5173/**` for
  local work.

In **Authentication → Providers → Email**: keep email + password enabled. If you
enable *Confirm email*, the sign-up screen shows a real "check your inbox" state
(nothing is faked either way). Configure custom SMTP (or Supabase's own mailer)
before inviting real customers.

Password recovery uses PKCE links; `src/lib/supabase.ts` sets
`detectSessionInUrl: true`, and the reset screen refuses to render unless a
recovery session exists.

### 1.5 Storage

Migration `0009` creates the private bucket `zybble-exports` (100 MB per file,
CSV/JSON only) with policies that let the worker write and let authenticated
users read only their own workspace's prefix. Exports are always delivered as
short-lived signed URLs (300 s). No public bucket is created.

### 1.6 Realtime

The same migration adds `searches`, `search_events`, `search_leads`,
`notifications`, `exports` and `leads` to the `supabase_realtime` publication
(idempotently — if the publication does not exist it is created). RLS still
applies to every subscriber. If a table is missing from the publication, the UI
still works: every live view polls as a fallback.

### 1.7 Database connection string for the worker

**Use the Session pooler, not the direct host.** Railway has no outbound IPv6,
and Supabase's direct host (`db.<project-ref>.supabase.co`) is AAAA-only unless
the paid IPv4 add-on is enabled. A direct URL looks correct but fails forever
with `database connection failed … network is unreachable`.

In the Supabase dashboard click **Connect → Session pooler** and copy the
string as-is:

```
postgresql://postgres.<project-ref>:<password>@aws-<index>-<region>.pooler.supabase.com:5432/postgres?sslmode=require
```

Notes that matter:

| Piece | Value | Why |
| --- | --- | --- |
| Host | `aws-<index>-<region>.pooler.supabase.com` | IPv4. Copy from Connect — the index cannot be guessed from the region. |
| Port | `5432` (session) | Session mode keeps prepared statements and long-lived sessions working. |
| User | `postgres.<project-ref>` | Pooler usernames are tenant-qualified; plain `postgres` only works on the direct host. |
| `sslmode` | `require` | Mandatory for Supabase. |

Do **not** use the transaction pooler (`…:6543`): the worker keeps a bounded
long-lived pool, which is the wrong fit for pgbouncer/Supavisor transaction
mode.

If you enable Railway's outbound IPv6 feature flag *and* it can reach your
region's AWS IPv6 range, the direct host can work — but the session pooler is
the path that works with default Railway networking.

---

## 2. Razorpay

1. Create the account and complete KYC.
2. **Enable international/USD payments if you bill in USD.** Zybble's plans are
   priced in USD; a non-activated account can only collect domestic methods, and
   the API surfaces the provider's error instead of pretending the checkout
   succeeded. **(verify on first deploy)**
3. **API keys** (Settings → API Keys): copy the *Key ID* and *Key Secret* into
   Vercel as `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`. Set
   `RAZORPAY_REGION=us` for a US/international account, `in` for India-first.
4. **Plans.** Either let Zybble create them lazily — the first checkout for a
   paid plan creates the Razorpay plan and caches its id in
   `plans.razorpay_plan_id` — or pre-create them in the dashboard and set
   `RAZORPAY_PLAN_GROWTH` / `RAZORPAY_PLAN_SCALE`. Pre-creating is preferred for
   production, because plan ids then exist before the first customer arrives.
   Amounts must match the seeded prices (4900 and 9900 minor units, USD, monthly)
   or the checkout page will show a different price than the pricing page.
5. **Webhook** (Settings → Webhooks):

   | Setting | Value |
   | --- | --- |
   | URL | `https://your-domain/api/billing/webhook` |
   | Secret | generate one; put it in Vercel as `RAZORPAY_WEBHOOK_SECRET` |
   | Events | `subscription.authenticated`, `subscription.activated`, `subscription.charged`, `subscription.updated`, `subscription.pending`, `subscription.halted`, `subscription.cancelled`, `subscription.paused`, `subscription.resumed`, `subscription.completed`, `payment.authorized`, `payment.captured`, `payment.failed` |

   The handler verifies `X-Razorpay-Signature` over the raw request body and
   de-duplicates on `x-razorpay-event-id` (`ops.billing_events`), so retries and
   out-of-order deliveries are safe. `payment.authorized` may arrive before
   `payment.captured`; only captured payments are treated as money received.

---

## 3. Gemini

1. Create an API key in Google AI Studio.
2. Put it in **both** Vercel (for planning/analysis/chat calls the API performs
   inline) and Railway (for the worker's scoring/analysis jobs) as
   `GEMINI_API_KEY`. It is never exposed to the browser.
3. `GEMINI_MODEL` defaults to `gemini-2.5-pro` and `GEMINI_FAST_MODEL` to
   `gemini-2.5-flash`; see `RESEARCH.md` §8 for model availability notes. Both
   are single-variable changes with no code edits.

If the key is absent, `/api/system` reports `features.ai = false`, the AI screens
explain that AI is not configured, and AI requests return `503 not_configured`.
Nothing is simulated.

---

## 4. Vercel

1. Import the repository. Framework preset **Vite**; `vercel.json` already pins
   the build command, output directory, function runtime (`nodejs22.x`,
   `maxDuration: 60`, 1024 MB) and security headers.
2. **Environment variables** (Project → Settings → Environment Variables).
   Production + Preview as appropriate:

   *Browser (build):* `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_PUBLISHABLE_KEY`.

   *Server:* `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `APP_URL`,
   `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_FAST_MODEL`,
   `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`,
   `RAZORPAY_REGION`, `RAZORPAY_PLAN_GROWTH`, `RAZORPAY_PLAN_SCALE`.

   Never add a `VITE_` prefix to a secret: Vite inlines those into the bundle and
   they would be public forever.
3. Deploy, then check:

   ```bash
   curl -s https://your-domain/api/health  | jq   # database + queue + workers
   curl -s https://your-domain/api/system  | jq   # which providers are configured
   ```

   `/api/system` returning `features.billing: true` and `features.ai: true` means
   the keys were picked up. `billingProvider` names the provider that responded
   (`razorpay`), or is `null` when billing is not configured.
4. Add the custom domain, and update Supabase's Site URL/Redirect URLs and the
   Razorpay webhook URL to match it.

---

## 5. Railway (the worker)

1. **New Project → Deploy from GitHub repo**, and point Railway at this
   repository. `railway.toml` (committed) already sets:
   `builder = DOCKERFILE`, `dockerfilePath = worker/Dockerfile`,
   `healthcheckPath = /health`, `healthcheckTimeout = 120`, `numReplicas = 1`,
   `restartPolicyType = ON_FAILURE`.
2. **Variables** — the worker's set from `.env.example`:

   *Required:* `DATABASE_URL` (Supabase **Session pooler** string — see §1.7;
   the direct `db.*.supabase.co` host is IPv6-only and will never connect from
   Railway), `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `APP_URL`, `GEMINI_API_KEY`.
   *Recommended:* `WORKER_ID` (e.g. `worker-1`), `WORKER_PROXIES`,
   `WORKER_CONCURRENCY`, `WORKER_MAX_DEPTH`, `RESEND_API_KEY`, `EMAIL_FROM`.
   *Keep:* `DISABLE_TELEMETRY=1`.

   Railway injects `PORT`; the worker honours it and serves `/health`, `/ready`
   and `/metrics` there.
3. **Resources.** Scraping is memory-hungry (a real Chromium per concurrency
   slot). Start at 2 vCPU / 4 GB with `WORKER_CONCURRENCY=4`, and raise memory
   before you raise concurrency. Keep `WORKER_MAX_CONCURRENT_SCRAPES=1` until
   you have measured a single search's peak usage.
4. **First deploy.** The image installs Chromium and the Playwright driver, so
   the first build takes several minutes. When the healthcheck passes, check
   `GET /ready` for queue stats and confirm the worker row appears:

   ```bash
   curl -s https://<worker-domain>/ready | jq
   ```

   On startup the worker immediately reclaims expired leases and runs one
   `cleanup` pass. Cleanup also reconciles searches whose inputs are all
   terminal, so a crash between completing the last pass and updating the
   parent search cannot leave the website stuck on `queued`.
5. **Scaling out (optional).** Because claiming uses `FOR UPDATE SKIP LOCKED`,
   you can raise `numReplicas` or, better, run two services with disjoint
   `WORKER_JOB_TYPES` (e.g. one `scrape`, one
   `export,ai_lead_scoring,ai_lead_analysis,notification,cleanup`) so a busy
   crawl never delays exports. Nothing else in the system changes.

---

## 6. End-to-end verification (do this before calling it launched)

Run this list against production, with a real account and (for the last two
steps) real payment credentials. Each step names what proves it worked.

0. **API surface before anything else** → `npm run smoke:api` (locally, or
   against the preview URL by pointing the script's `process.cwd()` imports at
   it) must print "every route answered, methods are enforced, anonymous calls
   are refused". With the production environment loaded, the `503` rows above
   should turn into real status codes; anything still `503` names the variable
   that is missing.
1. **Sign-up** → the app shows the real state: signed in, or *check your inbox*
   when confirmation is enabled. No session is invented. *(Authentication →
   Users shows the account.)*
2. **Workspace** → `/api/me` returns a workspace, role and plan; the starter
   plan's quota is visible in the sidebar meter.
3. **AI plan (no quota consumed)** → `/findleads` → describe a niche/city →
   the plan comes back with segments, queries and a preview of inputs; the
   workspace's lead usage is unchanged afterwards. *(Check
   `usage_counters.leads_used`.)*
4. **Approve and run** → the search appears in `/searches` as `queued`, then
   `running`, with real progress and a real event log.
5. **Worker actually works** → `/ready` shows the job running; Railway logs show
   the engine starting; leads appear in `/leads` before the search finishes
   (progressive writes).
6. **Completion** → the search ends as `completed` or `partial` with honest
   counts; one notification arrives in the bell (and by email if Resend is
   configured).
7. **Lead detail** → phone, website, rating and reviews match what Google shows;
   the quality score changes when fields are missing.
8. **List + export** → add leads to a list, export CSV and JSON. The download is
   a signed URL that expires; the file contains exactly the rows you selected,
   and `exports` records the row count.
9. **AI scoring** → score a batch; `ai_runs` records model, tokens and latency;
   scoring the same leads again without changes does not double-charge quota.
10. **Billing** → open `/billing`, start a checkout for Growth, pay in Razorpay
    test mode, and confirm: the checkout succeeded, `subscriptions` is
    `active`, an invoice/payment row exists, and entitlements/quota changed.
    Then replay the webhook from the Razorpay dashboard (or `curl` with a valid
    signature) and confirm it is ignored as a duplicate.
11. **API key** → create a key, call `/api/me` with
    `Authorization: Bearer zyb_live_…`, confirm scopes are enforced (a key
    without `leads:read` gets `403`) and that revoking it returns `401`.
12. **Failure honesty** → unset `GEMINI_API_KEY` in a Preview environment and
    confirm AI screens say *not configured* instead of faking results; cancel a
    running search and confirm it stops and keeps its partial results.

Record anything that behaves differently: the whole point of this list is that a
green order here is the only evidence that counts.

---

## 7. Day-2 operations

- **Health & monitoring**
  - `GET /api/health` → database latency, queue depth, expired leases, worker
    count and newest heartbeat. Point your uptime monitor at it.
  - `GET /ready` (worker) → queue stats; `GET /metrics` → processed/failed
    counters.
  - `ops.system_settings` holds operational defaults you can change without a
    deploy (as opposed to code constants).
- **Logs** — Vercel function logs for the API; Railway logs for the worker
  (structured JSON via `slog`, `worker_id` and `job` on every line).
- **Backups** — enable Supabase point-in-time recovery on the production
  project. The database is the only stateful component; object storage holds
  regenerable exports.
- **Key rotation** — rotate a Supabase secret key or a Razorpay key by adding
  the new value in Vercel/Railway first (both components read the same
  variables), then removing the old one after the next deploy. Rotating
  `RAZORPAY_WEBHOOK_SECRET` requires updating the Razorpay dashboard in the same
  window. User-facing API keys are rotated in-product (`/setting` → API keys →
  rotate), and old keys are revoked by the same request.
- **Upgrading the engine** — bump `GOSOM_VERSION`/`go.mod` and rebuild the
  worker image. The engine version is recorded on every search
  (`searches.engine_version`) and on `lead_upsert` calls, so a behaviour change
  is traceable to the run that produced it.
- **Costs to watch** — Railway memory/CPU (Chromium), Supabase database size and
  egress (exports), Gemini tokens (`ai_runs` records usage per call), Razorpay
  per-transaction fees.

### Known gaps **(verify on first deploy)**

- The worker compiles and vets clean in CI, but has never been *run*: there has
  been no live database, no Chromium session and no Gemini call. Expect the
  first Railway deploy to surface runtime issues (page selectors, browser flags,
  memory) rather than compile issues. CI generates `go.sum` on the runner but
  does not commit it; commit a generated `go.sum` for reproducible builds.
- Razorpay USD recurring requires account activation; the code surfaces the
  provider's error rather than masking it, so the first real checkout is the
  proof.
- Email confirmation and Supabase's built-in SMTP rate limits are noticeable in
  production; configure custom SMTP before onboarding customers.
