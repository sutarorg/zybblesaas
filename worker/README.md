# Zybble worker

The Railway-side half of Zybble. It is the only component that runs the Google
Maps engine, because that work takes minutes and must survive restarts.

- Job source: `ops.job_queue` in Supabase Postgres (durable, leased, retried).
- Engine: Gosom (`github.com/gosom/google-maps-scraper`) as a library.
- Lead persistence: every place is written through `public.lead_upsert` +
  `public.search_register_lead`, so identity, dedupe, counters and billing are
  decided in one place (Postgres), never in two implementations.
- Exports: CSV/JSON rendered here and uploaded to the private `zybble-exports`
  bucket; the API only ever hands out short-lived signed URLs.
- AI: scoring/analysis jobs call Gemini with the same schemas the API uses and
  reserve quota with `public.usage_reserve` before spending a request.

## Environment

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | **Session pooler** string from Supabase Connect (`aws-…pooler.supabase.com:5432`, user `postgres.<ref>`, `sslmode=require`). The direct `db.<ref>.supabase.co` host is IPv6-only and fails on Railway (`network is unreachable`). |
| `SUPABASE_URL` | for exports | Project URL |
| `SUPABASE_SECRET_KEY` | for exports | Server key (or legacy `SUPABASE_SERVICE_ROLE_KEY`) |
| `GEMINI_API_KEY` | for AI jobs | Never exposed to the browser |
| `GEMINI_MODEL` | no | Defaults to `gemini-2.5-pro` |
| `EXPORTS_BUCKET` | no | Defaults to `zybble-exports` |
| `WORKER_JOB_TYPES` | no | Defaults to `scrape,export,ai_lead_scoring,ai_lead_analysis,notification,cleanup` |
| `WORKER_CONCURRENCY` | no | Engine concurrency per scrape job (default 4) |
| `WORKER_PROXIES` | no | Comma-separated proxies; direct connections get rate-limited |
| `RESEND_API_KEY`, `EMAIL_FROM` | no | Enables notification emails; without it the worker reports "not emailed" |

`DISABLE_TELEMETRY=1` is set by the image and forced by the config loader.

## Running

```bash
# build the image (needs network for the module graph on first build)
docker build -t zybble-worker worker

# run locally against a staging database
docker run --rm -e DATABASE_URL="postgres://…" -p 8080:8080 zybble-worker
```

The container exposes `GET /health` (database ping), `GET /ready` (queue stats)
and `GET /metrics` (counters). Railway's `healthcheckPath` points at `/health`.

## What happens when it crashes

1. The job's lease expires (`WORKER_LEASE_SECONDS`, default 300).
2. Any worker (or the cleanup job) runs `ops.queue_reclaim_expired`, which puts
   the job back to `pending` with the attempt counted.
3. On startup the worker reclaims expired leases immediately, and
   `cleanup` re-enqueues searches that lost their worker.

Partial results are already in Postgres because the engine's writer flushes
every few entries/seconds, so a crash never discards scraped leads.
