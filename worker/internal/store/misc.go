package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
)

// AiLimit reads the workspace's included AI runs for the current period from
// the same entitlements function the API uses, so worker and API agree.
func (s *Store) AiLimit(ctx context.Context, workspaceID string) (int, error) {
	var limit int
	err := s.pool.QueryRow(ctx, `
		select coalesce((public.workspace_entitlements($1) -> 'plan' ->> 'ai_runs_per_period')::int, 0)`,
		workspaceID).Scan(&limit)
	if err != nil {
		return 0, fmt.Errorf("ai limit: %w", err)
	}
	return limit, nil
}

func (s *Store) SubscriptionStatus(ctx context.Context, workspaceID string) (string, error) {
	var status string
	err := s.pool.QueryRow(ctx, `
		select status from public.subscriptions
		 where workspace_id = $1
		   and status in ('created', 'pending', 'authenticated', 'active', 'paused', 'halted')
		 order by created_at desc limit 1`, workspaceID).Scan(&status)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	return status, err
}

type Notification struct {
	ID            string
	WorkspaceID   string
	UserID        *string
	Type          string
	Title         string
	Body          *string
	Link          *string
	Severity      string
	EmailSentAt   *string
	PreferencesOK bool
}

// LoadNotification returns the notification plus the recipient's own preference
// decision, so Zybble never emails something the user switched off.
func (s *Store) LoadNotification(ctx context.Context, id string) (*Notification, error) {
	var (
		n             Notification
		body, link    *string
		emailSentAt   *string
		preferenceOK  bool
	)
	err := s.pool.QueryRow(ctx, `
		select n.id, n.workspace_id, n.user_id, n.type, n.title, n.body, n.link, n.severity, n.email_sent_at,
		       coalesce((
				 select case n.type
						  when 'search_completed' then p.search_completed
						  when 'search_failed' then p.search_failed
						  when 'export_ready' then p.export_ready
						  when 'ai_completed' then p.ai_completed
						  when 'quota_warning' then p.quota_warnings
						  else true
						end
				   from public.notification_preferences p
				  where p.workspace_id = n.workspace_id and p.user_id = n.user_id
			   ), true)
		  from public.notifications n
		 where n.id = $1`, id).
		Scan(&n.ID, &n.WorkspaceID, &n.UserID, &n.Type, &n.Title, &body, &link, &n.Severity, &emailSentAt, &preferenceOK)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	n.Body, n.Link, n.EmailSentAt, n.PreferencesOK = body, link, emailSentAt, preferenceOK
	return &n, nil
}

func (s *Store) MarkNotificationEmailed(ctx context.Context, id string) error {
	_, err := s.pool.Exec(ctx, `update public.notifications set email_sent_at = now() where id = $1`, id)
	return err
}

func (s *Store) WorkspaceOwnerEmail(ctx context.Context, workspaceID string) (string, error) {
	var email string
	err := s.pool.QueryRow(ctx, `
		select p.email::text
		  from public.workspace_members m
		  join public.profiles p on p.id = m.user_id
		 where m.workspace_id = $1 and m.role = 'owner' and m.status = 'active'
		 limit 1`, workspaceID).Scan(&email)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	return email, err
}

// SearchSummary is what the completion notification quotes (real numbers only).
func (s *Store) SearchSummary(ctx context.Context, searchID string) (map[string]any, error) {
	var raw []byte
	err := s.pool.QueryRow(ctx, `
		select jsonb_build_object(
			'id', s.slug, 'name', s.name, 'status', s.status,
			'discovered', s.discovered_count, 'unique', s.unique_count, 'duplicates', s.duplicate_count,
			'with_email', s.email_found_count, 'errors', s.error_count,
			'completed_at', s.completed_at, 'started_at', s.started_at
		)
		  from public.searches s where s.id = $1`, searchID).Scan(&raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	out := map[string]any{}
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func (s *Store) PurgeOldEvents(ctx context.Context, olderThanDays int) (int, error) {
	var count int
	err := s.pool.QueryRow(ctx, `
		with deleted as (
			delete from public.search_events
			 where created_at < now() - make_interval(days => $1)
			 returning 1
		)
		select count(*)::int from deleted`, olderThanDays).Scan(&count)
	return count, err
}

func (s *Store) PurgeStaleRateLimits(ctx context.Context, olderThanHours int) (int, error) {
	var count int
	err := s.pool.QueryRow(ctx, `
		with deleted as (
			delete from ops.rate_limits where window_start < now() - make_interval(hours => $1) returning 1
		)
		select count(*)::int from deleted`, olderThanHours).Scan(&count)
	return count, err
}

func (s *Store) PurgeIdempotencyKeys(ctx context.Context) (int, error) {
	var count int
	err := s.pool.QueryRow(ctx, `
		with deleted as (
			delete from ops.idempotency_keys where expires_at < now() returning 1
		)
		select count(*)::int from deleted`).Scan(&count)
	return count, err
}

func (s *Store) PendingJobCount(ctx context.Context) (int, error) {
	var count int
	err := s.pool.QueryRow(ctx, `select count(*)::int from ops.job_queue where status = 'pending'`).Scan(&count)
	return count, err
}

// MarkInputs helps the cancellation path leave the search in a state the UI can
// explain: 'cancelled' when the user cancelled, 'pending' when they paused.
func (s *Store) MarkOpenInputs(ctx context.Context, searchID, status, reason string) (int, error) {
	var count int
	err := s.pool.QueryRow(ctx, `
		with upd as (
			update public.search_inputs
			   set status = $2, last_error = coalesce($3, last_error), finished_at = case when $2 in ('cancelled', 'skipped') then now() else finished_at end
			 where search_id = $1 and status in ('pending', 'running', 'failed')
			 returning 1
		)
		select count(*)::int from upd`, searchID, status, nullIfEmpty(reason)).Scan(&count)
	return count, err
}
