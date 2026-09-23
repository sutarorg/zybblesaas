// Package config holds the worker's environment contract.
//
// Rule: nothing secret is ever logged, and a missing required value stops the
// worker at boot instead of letting it run half-configured.
package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	// Supabase Postgres. The worker connects straight to Postgres with the
	// service role: it is a server-side component, never shipped to a browser.
	DatabaseURL string

	// Supabase Storage (exports) — REST endpoint + service key.
	SupabaseURL     string
	SupabaseKey     string
	ExportsBucket   string
	AppURL          string
	GeminiAPIKey    string
	GeminiModel     string
	EmbeddingsModel string

	WorkerID string
	Version  string

	// Engine
	Concurrency              int
	MaxDepth                 int
	FastMode                 bool
	EmailExtraction          bool
	ExtraReviews             bool
	Language                 string
	Proxies                  []string
	BrowserPoolSize          int
	MaxPagesPerBrowser       int
	DisablePageReuse         bool
	ExitOnInactivity         time.Duration
	JobTypes                 []string
	MaxJobsPerPoll           int
	LeaseSeconds             int
	HeartbeatInterval        time.Duration
	PollInterval             time.Duration
	GracefulShutdownTimeout  time.Duration
	HealthAddr               string
	ProgressThrottle         time.Duration
	LeadFlushInterval        time.Duration
	LeadFlushSize            int
	MaxConcurrentScrapeJobs  int
	CleanupInterval          time.Duration
	DisableTelemetryOnEngine bool
}

func Load() (*Config, error) {
	cfg := &Config{
		DatabaseURL:             firstEnv("DATABASE_URL", "SUPABASE_DB_URL", "SUPABASE_DATABASE_URL"),
		SupabaseURL:             firstEnv("SUPABASE_URL"),
		SupabaseKey:             firstEnv("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"),
		ExportsBucket:           envOr("EXPORTS_BUCKET", "zybble-exports"),
		AppURL:                  envOr("APP_URL", "https://zybble.com"),
		GeminiAPIKey:            firstEnv("GEMINI_API_KEY"),
		GeminiModel:             envOr("GEMINI_MODEL", "gemini-2.5-pro"),
		EmbeddingsModel:         envOr("GEMINI_EMBEDDINGS_MODEL", "gemini-embedding-001"),
		WorkerID:                envOr("WORKER_ID", defaultWorkerID()),
		Version:                 envOr("WORKER_VERSION", "1.0.0"),
		Concurrency:             envInt("WORKER_CONCURRENCY", 4),
		MaxDepth:                envInt("WORKER_MAX_DEPTH", 10),
		FastMode:                envBool("WORKER_FAST_MODE", false),
		EmailExtraction:         envBool("WORKER_EMAIL_EXTRACTION", true),
		ExtraReviews:            envBool("WORKER_EXTRA_REVIEWS", false),
		Language:                envOr("WORKER_LANGUAGE", "en"),
		Proxies:                 splitList(firstEnv("WORKER_PROXIES", "PROXIES")),
		BrowserPoolSize:         envInt("WORKER_BROWSER_POOL_SIZE", 0),
		MaxPagesPerBrowser:      envInt("WORKER_MAX_PAGES_PER_BROWSER", 0),
		DisablePageReuse:        envBool("WORKER_DISABLE_PAGE_REUSE", false),
		ExitOnInactivity:        envDuration("WORKER_EXIT_ON_INACTIVITY", 3*time.Minute),
		JobTypes:                splitList(envOr("WORKER_JOB_TYPES", "scrape,export,ai_lead_scoring,ai_lead_analysis,notification,cleanup")),
		MaxJobsPerPoll:          envInt("WORKER_MAX_JOBS_PER_POLL", 1),
		LeaseSeconds:            envInt("WORKER_LEASE_SECONDS", 300),
		HeartbeatInterval:       envDuration("WORKER_HEARTBEAT_INTERVAL", 15*time.Second),
		PollInterval:            envDuration("WORKER_POLL_INTERVAL", time.Second),
		GracefulShutdownTimeout: envDuration("WORKER_SHUTDOWN_TIMEOUT", 90*time.Second),
		HealthAddr:              envOr("PORT_ADDR", ":8080"),
		ProgressThrottle:        envDuration("WORKER_PROGRESS_THROTTLE", 2*time.Second),
		LeadFlushInterval:       envDuration("WORKER_LEAD_FLUSH_INTERVAL", 3*time.Second),
		LeadFlushSize:           envInt("WORKER_LEAD_FLUSH_SIZE", 5),
		MaxConcurrentScrapeJobs: envInt("WORKER_MAX_CONCURRENT_SCRAPES", 1),
		CleanupInterval:         envDuration("WORKER_CLEANUP_INTERVAL", time.Hour),
	}

	if port := os.Getenv("PORT"); port != "" && os.Getenv("PORT_ADDR") == "" {
		if !strings.HasPrefix(port, ":") {
			cfg.HealthAddr = ":" + port
		} else {
			cfg.HealthAddr = port
		}
	}

	if cfg.DatabaseURL == "" {
		fmt.Println("[worker] WARNING: DATABASE_URL is not set — worker will idle on health check until configured")
	}

	if cfg.SupabaseURL == "" || cfg.SupabaseKey == "" {
		fmt.Println("[worker] WARNING: SUPABASE_URL / SUPABASE_SECRET_KEY are not set — export jobs will fail instead of writing files")
	}

	if cfg.GeminiAPIKey == "" {
		fmt.Println("[worker] WARNING: GEMINI_API_KEY is not set — AI jobs will fail fast with a clear error")
	}

	if len(cfg.Proxies) == 0 {
		fmt.Println("[worker] no proxies configured (direct connections; Google may rate-limit heavy days)")
	}

	if cfg.Concurrency < 1 {
		cfg.Concurrency = 1
	}

	// Telemetry stays off unless the operator explicitly opts in.
	if os.Getenv("DISABLE_TELEMETRY") == "" {
		_ = os.Setenv("DISABLE_TELEMETRY", "1")
	}

	cfg.DisableTelemetryOnEngine = os.Getenv("DISABLE_TELEMETRY") != "0"

	return cfg, nil
}

func defaultWorkerID() string {
	host, err := os.Hostname()
	if err != nil || host == "" {
		host = "worker"
	}
	return fmt.Sprintf("%s-%d", host, os.Getpid())
}

func firstEnv(names ...string) string {
	for _, name := range names {
		if value := strings.TrimSpace(os.Getenv(name)); value != "" {
			return value
		}
	}
	return ""
}

func envOr(name, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(name)); value != "" {
		return value
	}
	return fallback
}

func envInt(name string, fallback int) int {
	raw := strings.TrimSpace(os.Getenv(name))
	if raw == "" {
		return fallback
	}
	value, err := strconv.Atoi(raw)
	if err != nil {
		fmt.Printf("[worker] %s=%q is not a number — using %d\n", name, raw, fallback)
		return fallback
	}
	return value
}

func envBool(name string, fallback bool) bool {
	raw := strings.TrimSpace(strings.ToLower(os.Getenv(name)))
	if raw == "" {
		return fallback
	}
	return raw == "1" || raw == "true" || raw == "yes" || raw == "on"
}

func envDuration(name string, fallback time.Duration) time.Duration {
	raw := strings.TrimSpace(os.Getenv(name))
	if raw == "" {
		return fallback
	}
	if value, err := time.ParseDuration(raw); err == nil {
		return value
	}
	if seconds, err := strconv.Atoi(raw); err == nil {
		return time.Duration(seconds) * time.Second
	}
	fmt.Printf("[worker] %s=%q is not a duration — using %s\n", name, raw, fallback)
	return fallback
}

func splitList(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}
