// Package store is the worker's only database boundary.
//
// Everything business-critical (lead identity, dedupe, billing, counters,
// progress) is implemented as a Postgres function so that the API, the worker
// and the tests all run the same logic. This file deliberately contains no
// business rules of its own — it calls those functions and reports what the
// database says.
package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Store struct {
	pool *pgxpool.Pool
}

func Open(ctx context.Context, dsn string) (*Store, error) {
	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("parse DATABASE_URL: %w", err)
	}
	config.MaxConns = 8
	config.MinConns = 1
	config.MaxConnIdleTime = 5 * time.Minute
	config.HealthCheckPeriod = 30 * time.Second

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("connect: %w", err)
	}

	pingCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping: %w", err)
	}

	return &Store{pool: pool}, nil
}

func (s *Store) Close() { s.pool.Close() }

func (s *Store) Ping(ctx context.Context) error { return s.pool.Ping(ctx) }

// ---------------------------------------------------------------- queue

type Job struct {
	ID          string
	Type        string
	WorkspaceID *string
	Priority    int
	Attempts    int
	MaxAttempts int
	Payload     map[string]any
	CreatedAt   time.Time
}

func (s *Store) Claim(ctx context.Context, workerID string, jobTypes []string, maxJobs, leaseSeconds int) ([]Job, error) {
	rows, err := s.pool.Query(ctx,
		`select id, job_type, workspace_id, priority, attempts, max_attempts, payload, created_at
		   from ops.queue_claim($1, $2, $3, $4)`,
		workerID, jobTypes, maxJobs, leaseSeconds)
	if err != nil {
		return nil, fmt.Errorf("queue_claim: %w", err)
	}
	defer rows.Close()

	var jobs []Job
	for rows.Next() {
		var (
			job     Job
			payload []byte
		)
		if err := rows.Scan(&job.ID, &job.Type, &job.WorkspaceID, &job.Priority, &job.Attempts, &job.MaxAttempts, &payload, &job.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan job: %w", err)
		}
		if len(payload) > 0 {
			if err := json.Unmarshal(payload, &job.Payload); err != nil {
				return nil, fmt.Errorf("decode payload: %w", err)
			}
		}
		jobs = append(jobs, job)
	}

	return jobs, rows.Err()
}

func (s *Store) Heartbeat(ctx context.Context, jobID, workerID string, leaseSeconds int) (bool, error) {
	var ok bool
	if err := s.pool.QueryRow(ctx, `select ops.queue_heartbeat($1, $2, $3)`, jobID, workerID, leaseSeconds).Scan(&ok); err != nil {
		return false, fmt.Errorf("queue_heartbeat: %w", err)
	}
	return ok, nil
}

func (s *Store) Complete(ctx context.Context, jobID, workerID string, result map[string]any) (bool, error) {
	payload, err := json.Marshal(result)
	if err != nil {
		return false, err
	}
	var ok bool
	if err := s.pool.QueryRow(ctx, `select ops.queue_complete($1, $2, $3::jsonb)`, jobID, workerID, string(payload)).Scan(&ok); err != nil {
		return false, fmt.Errorf("queue_complete: %w", err)
	}
	return ok, nil
}

func (s *Store) Fail(ctx context.Context, jobID, workerID, message string, retryDelaySeconds int) (string, error) {
	var status string
	if err := s.pool.QueryRow(ctx, `select ops.queue_fail($1, $2, $3, $4)`, jobID, workerID, message, retryDelaySeconds).Scan(&status); err != nil {
		return "", fmt.Errorf("queue_fail: %w", err)
	}
	return status, nil
}

func (s *Store) ReclaimExpired(ctx context.Context, limit int) (int, int, error) {
	var reclaimed, failed int
	if err := s.pool.QueryRow(ctx, `select reclaimed, failed from ops.queue_reclaim_expired($1)`, limit).Scan(&reclaimed, &failed); err != nil {
		return 0, 0, fmt.Errorf("queue_reclaim_expired: %w", err)
	}
	return reclaimed, failed, nil
}

func (s *Store) CancelSearchJobs(ctx context.Context, searchID string, jobTypes []string) (int, error) {
	var count int
	if err := s.pool.QueryRow(ctx, `select ops.queue_cancel_search($1, $2)`, searchID, jobTypes).Scan(&count); err != nil {
		return 0, fmt.Errorf("queue_cancel_search: %w", err)
	}
	return count, nil
}

func (s *Store) QueueStats(ctx context.Context) (map[string]any, error) {
	var raw []byte
	if err := s.pool.QueryRow(ctx, `select ops.queue_stats()`).Scan(&raw); err != nil {
		return nil, err
	}
	out := map[string]any{}
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// ---------------------------------------------------------------- workers

func (s *Store) RegisterWorker(ctx context.Context, workerID, version, engineVersion string, concurrency map[string]any) error {
	payload, err := json.Marshal(concurrency)
	if err != nil {
		return err
	}
	_, err = s.pool.Exec(ctx, `select ops.worker_register($1, $2, $3, $4, $5, $6::jsonb)`,
		workerID, version, nullIfEmpty(engineVersion), hostname(), region(), string(payload))
	return err
}

func (s *Store) WorkerHeartbeat(ctx context.Context, workerID, status string, activeJobs, queuedJobs int, metadata map[string]any) error {
	payload, err := json.Marshal(metadata)
	if err != nil {
		return err
	}
	_, err = s.pool.Exec(ctx, `select ops.worker_heartbeat($1, $2, $3, $4, $5::jsonb)`,
		workerID, status, activeJobs, queuedJobs, string(payload))
	return err
}

// ---------------------------------------------------------------- searches

type Search struct {
	ID              string
	WorkspaceID     string
	Slug            string
	Name            string
	Query           string
	Location        *string
	Language        string
	Status          string
	Phase           string
	Source          string
	SearchConfig    map[string]any
	RequestedCount  int
	WorkerID        *string
	RerunOf         *string
	CreatedAt       time.Time
	StartedAt       *time.Time
	ProgressPercent int
}

func (s *Store) LoadSearch(ctx context.Context, searchID string) (*Search, error) {
	var (
		search      Search
		configBytes []byte
	)
	err := s.pool.QueryRow(ctx, `
		select id, workspace_id, slug, name, query, location, language, status, phase, source,
		       search_config, requested_count, worker_id, rerun_of, created_at, started_at, progress_percent
		  from public.searches
		 where id = $1`, searchID).
		Scan(&search.ID, &search.WorkspaceID, &search.Slug, &search.Name, &search.Query, &search.Location, &search.Language,
			&search.Status, &search.Phase, &search.Source, &configBytes, &search.RequestedCount, &search.WorkerID,
			&search.RerunOf, &search.CreatedAt, &search.StartedAt, &search.ProgressPercent)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("load search: %w", err)
	}
	if len(configBytes) > 0 {
		_ = json.Unmarshal(configBytes, &search.SearchConfig)
	}
	return &search, nil
}

type Input struct {
	ID          string
	Seq         int
	QueryText   string
	Lat         *float64
	Lon         *float64
	Zoom        *int
	RadiusM     *int
	GridCell    *string
	Status      string
	Discovered  int
	Completed   int
	Attempts    int
	LastError   *string
}

// PendingInputs returns the inputs that still need engine work, in sequence
// order. Completed inputs are skipped, which is what makes a rerun/resume cheap.
func (s *Store) PendingInputs(ctx context.Context, searchID string) ([]Input, error) {
	rows, err := s.pool.Query(ctx, `
		select id, seq, query_text, geo_lat, geo_lon, zoom, radius_m, grid_cell, status,
		       places_discovered, places_completed, attempts, last_error
		  from public.search_inputs
		 where search_id = $1
		   and status in ('pending', 'running', 'failed')
		 order by seq asc`, searchID)
	if err != nil {
		return nil, fmt.Errorf("load inputs: %w", err)
	}
	defer rows.Close()

	var inputs []Input
	for rows.Next() {
		var input Input
		if err := rows.Scan(&input.ID, &input.Seq, &input.QueryText, &input.Lat, &input.Lon, &input.Zoom,
			&input.RadiusM, &input.GridCell, &input.Status, &input.Discovered, &input.Completed,
			&input.Attempts, &input.LastError); err != nil {
			return nil, err
		}
		inputs = append(inputs, input)
	}
	return inputs, rows.Err()
}

func (s *Store) CountInputs(ctx context.Context, searchID string) (total int, done int, err error) {
	err = s.pool.QueryRow(ctx, `
		select count(*)::int,
		       count(*) filter (where status in ('completed', 'failed', 'skipped', 'cancelled'))::int
		  from public.search_inputs where search_id = $1`, searchID).Scan(&total, &done)
	return
}

func (s *Store) MarkSearchRunning(ctx context.Context, searchID, workerID, engineVersion string) error {
	_, err := s.pool.Exec(ctx, `
		update public.searches
		   set status = case when status in ('queued', 'draft', 'paused') then 'running' else status end,
		       phase = 'scraping',
		       worker_id = $2,
		       engine_version = coalesce($3, engine_version),
		       started_at = coalesce(started_at, now()),
		       paused_at = null,
		       last_progress_at = now()
		 where id = $1 and status not in ('cancelled')`, searchID, workerID, nullIfEmpty(engineVersion))
	return err
}

func (s *Store) SetSearchPhase(ctx context.Context, searchID, phase string) error {
	_, err := s.pool.Exec(ctx, `update public.searches set phase = $2 where id = $1 and status <> 'cancelled'`, searchID, phase)
	return err
}

// FinishSearch derives the terminal status from the real input outcome.
func (s *Store) FinishSearch(ctx context.Context, searchID string) (string, error) {
	var status string
	err := s.pool.QueryRow(ctx, `
		with state as (
			select
				count(*)::int as total,
				count(*) filter (where status = 'completed')::int as completed,
				count(*) filter (where status = 'failed')::int as failed,
				count(*) filter (where status in ('pending', 'running'))::int as open
			  from public.search_inputs where search_id = $1
		)
		update public.searches s
		   set status = case
				 when s.status = 'cancelled' then 'cancelled'
				 when state.completed = 0 and state.failed > 0 then 'failed'
				 when state.failed > 0 then 'partial'
				 else 'completed'
			   end,
		       phase = case when state.failed > 0 and state.completed = 0 then 'failed' else 'done' end,
		       progress_percent = case when state.failed > 0 and state.completed = 0 then progress_percent else 100 end,
		       completed_at = now(),
		       failed_at = case when state.failed > 0 and state.completed = 0 then now() else failed_at end,
		       eta_seconds = 0,
		       error_message = case
				 when state.completed = 0 and state.failed > 0 then 'Every engine pass failed — see the search log for the errors'
				 else error_message
			   end
		  from state
		 where s.id = $1
		 returning s.status`, searchID).Scan(&status)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", fmt.Errorf("search %s not found", searchID)
	}
	return status, err
}

func (s *Store) SearchStatus(ctx context.Context, searchID string) (string, error) {
	var status string
	if err := s.pool.QueryRow(ctx, `select status from public.searches where id = $1`, searchID).Scan(&status); err != nil {
		return "", err
	}
	return status, nil
}

func (s *Store) InputProgress(ctx context.Context, searchID, inputID, status string, discovered, completed *int, errText *string) error {
	_, err := s.pool.Exec(ctx,
		`select public.search_input_progress($1, $2, $3, $4, $5, $6)`,
		searchID, inputID, status, discovered, completed, errText)
	return err
}

func (s *Store) RefreshProgress(ctx context.Context, searchID string, minIntervalSeconds int, force bool) error {
	_, err := s.pool.Exec(ctx, `select public.search_refresh_progress($1, $2, $3)`, searchID, minIntervalSeconds, force)
	return err
}

func (s *Store) Event(ctx context.Context, searchID, eventType, level, message string, metadata map[string]any) error {
	payload, err := json.Marshal(metadata)
	if err != nil {
		return err
	}
	_, err = s.pool.Exec(ctx, `select public.search_event($1, $2, $3, $4, $5::jsonb)`, searchID, eventType, message, level, string(payload))
	return err
}

// ---------------------------------------------------------------- leads

type LeadResult struct {
	LeadID    string
	Created   bool
	MatchedBy string
}

func (s *Store) UpsertLead(ctx context.Context, payload map[string]any, engineVersion string) (*LeadResult, error) {
	raw, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	var result LeadResult
	err = s.pool.QueryRow(ctx,
		`select lead_id, created, matched_by from public.lead_upsert($1::jsonb, $2)`,
		string(raw), nullIfEmpty(engineVersion)).
		Scan(&result.LeadID, &result.Created, &result.MatchedBy)
	if err != nil {
		return nil, fmt.Errorf("lead_upsert: %w", err)
	}
	return &result, nil
}

type RegisterResult struct {
	IsNewAssociation bool
	IsWorkspaceNew   bool
	UniqueCount      int
	DuplicateCount   int
	FilteredCount    int
	WorkspaceID      string
}

func (s *Store) RegisterSearchLead(ctx context.Context, searchID, leadID string, inputID *string, isNewLead, filtered bool, reasons []string) (*RegisterResult, error) {
	var result RegisterResult
	err := s.pool.QueryRow(ctx,
		`select is_new_association, is_workspace_new, unique_count, duplicate_count, filtered_count, out_workspace_id
		   from public.search_register_lead($1, $2, $3, $4, $5, $6)`,
		searchID, leadID, inputID, isNewLead, filtered, reasons).
		Scan(&result.IsNewAssociation, &result.IsWorkspaceNew, &result.UniqueCount, &result.DuplicateCount, &result.FilteredCount, &result.WorkspaceID)
	if err != nil {
		return nil, fmt.Errorf("search_register_lead: %w", err)
	}
	return &result, nil
}

func (s *Store) Notify(ctx context.Context, workspaceID, notificationType, title, body, link, severity string, metadata map[string]any) error {
	payload, err := json.Marshal(metadata)
	if err != nil {
		return err
	}
	_, err = s.pool.Exec(ctx, `select public.notify_workspace($1, $2, $3, $4, $5, $6, null, $7::jsonb)`,
		workspaceID, notificationType, title, body, link, severity, string(payload))
	return err
}

// ---------------------------------------------------------------- exports

type ExportJob struct {
	ID           string
	WorkspaceID  string
	Slug         string
	Name         string
	Format       string
	SourceType   string
	SourceID     *string
	Filters      map[string]any
	Columns      []string
	Status       string
	RetentionEnd *time.Time
}

func (s *Store) LoadExport(ctx context.Context, exportID string) (*ExportJob, error) {
	var (
		job     ExportJob
		filters []byte
		columns []byte
	)
	err := s.pool.QueryRow(ctx, `
		select id, workspace_id, slug, name, format, source_type, source_id, filters, columns, status, expires_at
		  from public.exports where id = $1`, exportID).
		Scan(&job.ID, &job.WorkspaceID, &job.Slug, &job.Name, &job.Format, &job.SourceType, &job.SourceID,
			&filters, &columns, &job.Status, &job.RetentionEnd)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	_ = json.Unmarshal(filters, &job.Filters)
	_ = json.Unmarshal(columns, &job.Columns)
	return &job, nil
}

type ExportLead struct {
	Slug          string
	BusinessName  string
	Category      *string
	EmailPrimary  *string
	Phone         *string
	Website       *string
	Address       *string
	City          *string
	State         *string
	Country       *string
	PostalCode    *string
	Rating        *float64
	ReviewCount   int
	QualityScore  int
	MapURL        *string
	Latitude      *float64
	Longitude     *float64
	FirstSeenAt   time.Time
	Emails        *string
	Status        *string
	PriceRange    *string
	OpenHours     []byte
	RawData       []byte
}

// ExportLeads reads the rows for an export from canonical tables, honouring the
// export's own filter document. Email lists are aggregated so an export has one
// row per business (the shape every CRM import expects).
func (s *Store) ExportLeads(ctx context.Context, job *ExportJob, limit int) ([]ExportLead, error) {
	query := `
		select l.slug, l.business_name, l.category, l.email_primary, l.phone, l.website,
		       l.address, l.city, l.state, l.country, l.postal_code, l.rating, l.review_count,
		       l.quality_score, l.map_url, l.latitude, l.longitude, wl.first_seen_at, l.status, l.price_range,
		       l.open_hours, l.raw_data,
		       (select string_agg(e.email::text, ', ' order by e.is_primary desc, e.email) from public.lead_emails e where e.lead_id = l.id) as emails
		  from public.workspace_leads wl
		  join public.leads l on l.id = wl.lead_id
		 where wl.workspace_id = $1`

	args := []any{job.WorkspaceID}
	next := 2

	switch job.SourceType {
	case "search":
		if job.SourceID != nil {
			query += fmt.Sprintf(` and exists (select 1 from public.search_leads sl where sl.search_id = $%d and sl.lead_id = l.id)`, next)
			args = append(args, *job.SourceID)
			next++
		}
	case "list":
		if job.SourceID != nil {
			query += fmt.Sprintf(` and exists (select 1 from public.list_leads ll where ll.list_id = $%d and ll.lead_id = l.id)`, next)
			args = append(args, *job.SourceID)
			next++
		}
	}

	if value, ok := job.Filters["has_email"].(bool); ok && value {
		query += ` and l.email_primary is not null`
	}
	if value, ok := job.Filters["has_phone"].(bool); ok && value {
		query += ` and l.phone is not null`
	}
	if value, ok := job.Filters["city"].(string); ok && value != "" {
		query += fmt.Sprintf(` and l.city ilike $%d`, next)
		args = append(args, "%"+value+"%")
		next++
	}
	if value, ok := job.Filters["country"].(string); ok && value != "" {
		query += fmt.Sprintf(` and l.country_code = upper($%d)`, next)
		args = append(args, value)
		next++
	}
	if value, ok := job.Filters["min_rating"].(float64); ok && value > 0 {
		query += fmt.Sprintf(` and l.rating >= $%d`, next)
		args = append(args, value)
		next++
	}

	query += ` order by wl.first_seen_at desc`
	if limit > 0 {
		query += fmt.Sprintf(` limit $%d`, next)
		args = append(args, limit)
	}

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("export query: %w", err)
	}
	defer rows.Close()

	var out []ExportLead
	for rows.Next() {
		var lead ExportLead
		if err := rows.Scan(&lead.Slug, &lead.BusinessName, &lead.Category, &lead.EmailPrimary, &lead.Phone, &lead.Website,
			&lead.Address, &lead.City, &lead.State, &lead.Country, &lead.PostalCode, &lead.Rating, &lead.ReviewCount,
			&lead.QualityScore, &lead.MapURL, &lead.Latitude, &lead.Longitude, &lead.FirstSeenAt, &lead.Status,
			&lead.PriceRange, &lead.OpenHours, &lead.RawData, &lead.Emails); err != nil {
			return nil, err
		}
		out = append(out, lead)
	}
	return out, rows.Err()
}

func (s *Store) MarkExportGenerating(ctx context.Context, exportID string) error {
	_, err := s.pool.Exec(ctx, `
		update public.exports
		   set status = 'generating', completed_at = null, error_message = null
		 where id = $1 and status <> 'ready'`, exportID)
	return err
}

func (s *Store) FinishExport(ctx context.Context, exportID, bucket, path, checksum string, rows, bytes int, expiresAt time.Time) error {
	_, err := s.pool.Exec(ctx, `
		update public.exports
		   set status = 'ready', storage_bucket = $2, storage_path = $3, checksum = $4,
		       row_count = $5, byte_size = $6, expires_at = $7, completed_at = now(), error_message = null
		 where id = $1`, exportID, bucket, path, checksum, rows, bytes, expiresAt)
	return err
}

func (s *Store) FailExport(ctx context.Context, exportID, message string) error {
	_, err := s.pool.Exec(ctx, `update public.exports set status = 'failed', error_message = left($2, 500) where id = $1`, exportID, message)
	return err
}

// ---------------------------------------------------------------- maintenance

// RequeueStaleSearches finds searches whose jobs vanished (worker died before
// finishing) and asks for a fresh scrape job. This is the recovery path that
// keeps "expensive jobs survive restarts" true.
func (s *Store) RequeueStaleSearches(ctx context.Context, olderThanMinutes int) ([]string, error) {
	rows, err := s.pool.Query(ctx, `
		select s.id
		  from public.searches s
		 where s.status in ('running', 'enriching')
		   and s.deleted_at is null
		   and coalesce(s.last_progress_at, s.started_at, s.created_at) < now() - make_interval(mins => $1)
		   and not exists (
			   select 1 from ops.job_queue j
				where j.job_type = 'scrape'
				  and j.payload ->> 'search_id' = s.id::text
				  and j.status in ('pending', 'running')
		   )
		 limit 25`, olderThanMinutes)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

func (s *Store) Enqueue(ctx context.Context, jobType, workspaceID string, payload map[string]any, priority int, dedupeKey string) (string, error) {
	raw, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	var id *uuid.UUID
	err = s.pool.QueryRow(ctx,
		`select ops.queue_enqueue($1, $2::jsonb, $3, $4, $5, now(), 3, 'worker')`,
		jobType, string(raw), nullIfEmpty(workspaceID), priority, nullIfEmpty(dedupeKey)).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("queue_enqueue: %w", err)
	}
	if id == nil {
		return "", nil
	}
	return id.String(), nil
}

func (s *Store) ExpireExports(ctx context.Context, limit int) (int, error) {
	var count int
	err := s.pool.QueryRow(ctx, `
		with target as (
			select e.id, e.storage_bucket, e.storage_path
			  from public.exports e
			 where e.status = 'ready' and e.expires_at is not null and e.expires_at < now()
			 limit $1
		)
		update public.exports e
		   set status = 'expired', deleted_at = now()
		  from target
		 where e.id = target.id
		 returning 1`, limit).Scan(&count)
	if err == pgx.ErrNoRows {
		return 0, nil
	}
	return count, err
}

func (s *Store) ExpiredExportObjects(ctx context.Context, limit int) ([]string, error) {
	rows, err := s.pool.Query(ctx, `
		select storage_path from public.exports
		 where status = 'expired' and storage_path is not null
		 order by updated_at asc
		 limit $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var paths []string
	for rows.Next() {
		var path string
		if err := rows.Scan(&path); err != nil {
			return nil, err
		}
		paths = append(paths, path)
	}
	return paths, rows.Err()
}

func (s *Store) ClearExportObject(ctx context.Context, exportID string) error {
	_, err := s.pool.Exec(ctx, `update public.exports set storage_path = null, storage_bucket = null where id = $1`, exportID)
	return err
}

func (s *Store) MarkExportDeleted(ctx context.Context, path string) error {
	_, err := s.pool.Exec(ctx, `update public.exports set storage_path = null, storage_bucket = null where storage_path = $1`, path)
	return err
}

// ---------------------------------------------------------------- helpers

func hostname() *string {
	name, err := os.Hostname()
	if err != nil || name == "" {
		return nil
	}
	return &name
}

func region() *string {
	if value := os.Getenv("RAILWAY_REGION"); value != "" {
		return &value
	}
	if value := os.Getenv("FLY_REGION"); value != "" {
		return &value
	}
	return nullIfEmpty(os.Getenv("WORKER_REGION"))
}

func nullIfEmpty(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}
