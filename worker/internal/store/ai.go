package store

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5"
)

// LeadContext is the (real) evidence an AI job is allowed to see. Nothing else
// from the database is exposed to the model: no ids, no keys, no other tenants.
type LeadContext struct {
	ID             string
	WorkspaceID    string
	BusinessName   string
	Category       string
	City           string
	State          string
	Country        string
	Website        string
	Phone          string
	EmailPrimary   string
	Emails         []string
	Rating         float64
	HasRating      bool
	ReviewCount    int
	QualityScore   int
	Description    string
	Status         string
	PriceRange     string
	SocialCount    int
	ReviewsSnippet string
	// EmailCount and ReviewSample participate in the analysis cache key. They
	// mirror what the API samples when it builds the same key: at most 10 emails
	// and at most 5 reviews.
	EmailCount   int
	ReviewSample int
}

func (s *Store) LeadContext(ctx context.Context, leadID, workspaceID string) (*LeadContext, error) {
	var (
		lead       LeadContext
		rating     *float64
		category   *string
		city       *string
		state      *string
		country    *string
		website    *string
		phone      *string
		email      *string
		descript   *string
		priceRange *string
	)
	err := s.pool.QueryRow(ctx, `
		select l.id, wl.workspace_id, l.business_name, l.category, l.city, l.state, l.country, l.website,
		       l.phone, l.email_primary, l.rating, l.review_count, l.quality_score, l.description, l.status,
		       l.price_range,
		       (select count(*) from public.lead_social_profiles sp where sp.lead_id = l.id),
		       coalesce((
		         select string_agg(left(coalesce(r.text_original, ''), 160), ' | ' order by r.published_at desc)
		           from (select text_original, published_at from public.lead_reviews where lead_id = l.id
		                  order by published_at desc limit 5) r
		       ), ''),
		       coalesce((select array_agg(e.email::text order by e.is_primary desc, e.email) from public.lead_emails e where e.lead_id = l.id), '{}'),
		       least((select count(*) from public.lead_emails e where e.lead_id = l.id), 10),
		       least((select count(*) from public.lead_reviews r where r.lead_id = l.id), 5)
		  from public.leads l
		  join public.workspace_leads wl on wl.lead_id = l.id and wl.workspace_id = $2
		 where l.id = $1 and l.deleted_at is null`, leadID, workspaceID).
		Scan(&lead.ID, &lead.WorkspaceID, &lead.BusinessName, &category, &city, &state, &country, &website,
			&phone, &email, &rating, &lead.ReviewCount, &lead.QualityScore, &descript, &lead.Status,
			&priceRange, &lead.SocialCount, &lead.ReviewsSnippet, &lead.Emails,
			&lead.EmailCount, &lead.ReviewSample)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("lead context: %w", err)
	}

	lead.Category = deref(category)
	lead.City = deref(city)
	lead.State = deref(state)
	lead.Country = deref(country)
	lead.Website = deref(website)
	lead.Phone = deref(phone)
	lead.EmailPrimary = deref(email)
	lead.Description = deref(descript)
	lead.PriceRange = deref(priceRange)
	if rating != nil {
		lead.Rating = *rating
		lead.HasRating = true
	}
	return &lead, nil
}

// WorkspaceOfLead is used to refuse work on leads the workspace cannot see.
func (s *Store) WorkspaceOfLead(ctx context.Context, leadID string) (string, bool, error) {
	var workspaceID string
	err := s.pool.QueryRow(ctx, `select workspace_id from public.workspace_leads where lead_id = $1 limit 1`, leadID).Scan(&workspaceID)
	if err == pgx.ErrNoRows {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return workspaceID, true, nil
}

func (s *Store) LeadsInList(ctx context.Context, listID string, limit int) ([]string, error) {
	rows, err := s.pool.Query(ctx, `select lead_id from public.list_leads where list_id = $1 limit $2`, listID, limit)
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

func (s *Store) ListWorkspace(ctx context.Context, listID string) (string, string, error) {
	var (
		workspaceID string
		name        string
	)
	err := s.pool.QueryRow(ctx, `select workspace_id, name from public.lists where id = $1 and deleted_at is null`, listID).Scan(&workspaceID, &name)
	if err == pgx.ErrNoRows {
		return "", "", nil
	}
	return workspaceID, name, err
}

// AnalysisInputHash is the canonical Zybble analysis cache key, byte-for-byte
// the same algorithm as the API's `inputHash` helper
// (api/_lib/ai-runs.ts): sha256 over the JSON array of the parts, hex, first 40
// characters. Any change here must be mirrored there and in the prompt version.
func AnalysisInputHash(parts ...any) string {
	var buf bytes.Buffer
	encoder := json.NewEncoder(&buf)
	// Node's JSON.stringify does not escape <, > or &; Go's default marshaler
	// does. Disabling it here is what keeps the two byte-identical.
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(parts); err != nil {
		// Only reachable for types JSON cannot encode; those must never be used
		// as hash parts, so fall back to a value that cannot match anything.
		return ""
	}
	payload := bytes.TrimRight(buf.Bytes(), "\n")
	sum := sha256.Sum256(payload)
	return hex.EncodeToString(sum[:])[:40]
}

type Analysis struct {
	Summary       string
	Fit           string
	Score         int
	Reasons       []string
	Opportunities []string
	Risks         []string
	OutreachAngle string
}

func (s *Store) SaveAnalysis(
	ctx context.Context,
	workspaceID, leadID, inputHash, promptVersion, model, status string,
	analysis *Analysis,
	usage map[string]any,
	latencyMS int,
	errorMessage string,
) error {
	usageJSON, _ := json.Marshal(usage)
	reasons, _ := json.Marshal(orEmpty(analysis, func(a *Analysis) []string { return a.Reasons }))
	opportunities, _ := json.Marshal(orEmpty(analysis, func(a *Analysis) []string { return a.Opportunities }))
	risks, _ := json.Marshal(orEmpty(analysis, func(a *Analysis) []string { return a.Risks }))

	var (
		summary, fit, outreach any
		score                  any
	)
	if analysis != nil {
		summary, fit, outreach = analysis.Summary, analysis.Fit, analysis.OutreachAngle
		score = analysis.Score
	}

	_, err := s.pool.Exec(ctx, `
		insert into public.lead_ai_analyses
			(workspace_id, lead_id, input_hash, prompt_version, model, status, summary, fit, score,
			 reasons, opportunities, risks, outreach_angle, usage, latency_ms, error_message, analyzed_at)
		values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb, $13, $14::jsonb, $15, $16, now())
		on conflict (workspace_id, lead_id, input_hash, model, prompt_version) do update
		   set status = excluded.status,
		       summary = excluded.summary,
		       fit = excluded.fit,
		       score = excluded.score,
		       reasons = excluded.reasons,
		       opportunities = excluded.opportunities,
		       risks = excluded.risks,
		       outreach_angle = excluded.outreach_angle,
		       usage = excluded.usage,
		       latency_ms = excluded.latency_ms,
		       error_message = excluded.error_message,
		       analyzed_at = now()`,
		workspaceID, leadID, inputHash, promptVersion, model, status, summary, fit, score,
		string(reasons), string(opportunities), string(risks), outreach, string(usageJSON), latencyMS, nullIfEmpty(errorMessage))
	if err != nil {
		return fmt.Errorf("save analysis: %w", err)
	}

	if status == "ready" {
		_, _ = s.pool.Exec(ctx, `update public.leads set ai_analyzed_at = now() where id = $1`, leadID)
	}
	return nil
}

func (s *Store) StartAiRun(ctx context.Context, workspaceID, task, model, promptVersion, inputHash string, leadID, listID *string) (string, error) {
	var id string
	err := s.pool.QueryRow(ctx, `
		insert into public.ai_runs (workspace_id, task, status, model, prompt_version, input_hash, lead_id, list_id, started_at)
		values ($1, $2, 'running', $3, $4, $5, $6, $7, now())
		returning id`, workspaceID, task, model, promptVersion, inputHash, leadID, listID).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("start ai run: %w", err)
	}
	return id, nil
}

func (s *Store) FinishAiRun(ctx context.Context, runID, status, errorMessage string, result map[string]any, usage map[string]any, latencyMS int) error {
	resultJSON, _ := json.Marshal(result)
	usageJSON, _ := json.Marshal(usage)
	_, err := s.pool.Exec(ctx, `
		update public.ai_runs
		   set status = $2,
		       error_message = $3,
		       result = $4::jsonb,
		       input_tokens = nullif($5::jsonb ->> 'promptTokenCount', '')::int,
		       output_tokens = nullif($5::jsonb ->> 'candidatesTokenCount', '')::int,
		       total_tokens = nullif($5::jsonb ->> 'totalTokenCount', '')::int,
		       latency_ms = $6,
		       finished_at = now()
		 where id = $1`,
		runID, status, nullIfEmpty(errorMessage), string(resultJSON), string(usageJSON), latencyMS)
	return err
}

// ReserveAiRun spends one AI credit atomically. It returns false when the plan
// has no runs left, so the worker stops instead of overspending.
func (s *Store) ReserveAiRun(ctx context.Context, workspaceID string, limit int, dedupeKey, refType, refID string) (bool, error) {
	var allowed bool
	var refIDPtr *string
	if refID != "" {
		refIDPtr = &refID
	}
	err := s.pool.QueryRow(ctx,
		`select public.usage_reserve($1, 'ai_run', $2, 1, $3, $4, $5, '{}'::jsonb)`,
		workspaceID, limit, dedupeKey, refType, refIDPtr).Scan(&allowed)
	if err != nil {
		return false, fmt.Errorf("usage_reserve: %w", err)
	}
	return allowed, nil
}

func (s *Store) RecordUsage(ctx context.Context, workspaceID, kind, dedupeKey, refType, refID string) (bool, error) {
	var refIDPtr *string
	if refID != "" {
		refIDPtr = &refID
	}
	var recorded bool
	err := s.pool.QueryRow(ctx,
		`select public.usage_record($1, $2, 1, $3, $4, $5, '{}'::jsonb)`,
		workspaceID, kind, dedupeKey, refType, refIDPtr).Scan(&recorded)
	if err != nil {
		return false, fmt.Errorf("usage_record: %w", err)
	}
	return recorded, nil
}

func (s *Store) AiUsageRemaining(ctx context.Context, workspaceID string, limit int) (int, error) {
	var used int
	err := s.pool.QueryRow(ctx, `
		select coalesce((
			select ai_runs from public.usage_counters
			 where workspace_id = $1 and period_start = public.usage_period_start(now())
		), 0)`, workspaceID).Scan(&used)
	if err != nil {
		return 0, err
	}
	remaining := limit - used
	if remaining < 0 {
		remaining = 0
	}
	return remaining, nil
}

func deref(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func orEmpty(analysis *Analysis, pick func(*Analysis) []string) []string {
	if analysis == nil {
		return []string{}
	}
	out := pick(analysis)
	if out == nil {
		return []string{}
	}
	return out
}
