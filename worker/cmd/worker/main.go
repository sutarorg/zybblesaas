// Command worker is Zybble's Railway worker.
//
// Responsibilities:
//   - claim durable jobs from Postgres (ops.job_queue) with leases,
//   - run the Gosom Google Maps engine for scrape jobs, streaming leads to
//     Postgres as they arrive,
//   - render CSV/JSON exports into Supabase Storage,
//   - run AI jobs (lead scoring/analysis) with quota enforced in Postgres,
//   - recover other workers' abandoned jobs and keep the queue tidy.
//
// It never talks to the browser and holds no customer session.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/zybble/worker/internal/config"
	"github.com/zybble/worker/internal/health"
	"github.com/zybble/worker/internal/jobs"
	"github.com/zybble/worker/internal/store"
	"github.com/zybble/worker/internal/supabase"
)

func main() {
	// `--health-check` powers the container HEALTHCHECK without needing curl.
	for _, argument := range os.Args[1:] {
		if argument == "--health-check" || argument == "-health-check" {
			os.Exit(healthCheck())
		}
	}

	if err := run(); err != nil {
		slog.Error("worker exited with error", "error", err)
		os.Exit(1)
	}
}

// healthCheck queries the local health endpoint; 0 means healthy.
func healthCheck() int {
	address := os.Getenv("HEALTH_ADDR")
	if address == "" {
		address = ":8080"
	}
	if strings.HasPrefix(address, ":") {
		address = "127.0.0.1" + address
	}

	client := &http.Client{Timeout: 4 * time.Second}
	response, err := client.Get("http://" + address + "/health")
	if err != nil {
		return 1
	}
	defer func() { _ = response.Body.Close() }()
	if response.StatusCode != http.StatusOK {
		return 1
	}
	return 0
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: logLevel()}))
	slog.SetDefault(logger)

	rootCtx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	st, err := store.Open(rootCtx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer st.Close()

	logger.Info("worker starting",
		"worker_id", cfg.WorkerID,
		"version", cfg.Version,
		"job_types", cfg.JobTypes,
		"concurrency", cfg.Concurrency,
		"fast_mode", cfg.FastMode,
		"email_extraction", cfg.EmailExtraction,
	)

	registration := map[string]any{
		"job_types":     cfg.JobTypes,
		"concurrency":   cfg.Concurrency,
		"max_scrapes":   cfg.MaxConcurrentScrapeJobs,
		"fast_mode":     cfg.FastMode,
		"email":         cfg.EmailExtraction,
		"browsers":      cfg.BrowserPoolSize,
		"page_limit":    cfg.MaxPagesPerBrowser,
	}
	if err := st.RegisterWorker(rootCtx, cfg.WorkerID, cfg.Version, "gosom-1.18.1", registration); err != nil {
		return err
	}

	healthServer := health.New(st, cfg.WorkerID, cfg.Version)
	httpServer := newHTTPServer(cfg.HealthAddr, healthServer.Handler())

	go func() {
		logger.Info("health server listening", "addr", cfg.HealthAddr)
		if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, httpServerClosed) {
			logger.Error("health server stopped", "error", err)
			stop()
		}
	}()

	// Anything left running by a dead worker belongs to us now.
	if reclaimed, failedJobs, err := st.ReclaimExpired(rootCtx, 500); err != nil {
		logger.Warn("startup reclaim failed", "error", err)
	} else if reclaimed > 0 || failedJobs > 0 {
		logger.Info("reclaimed jobs after restart", "reclaimed", reclaimed, "failed", failedJobs)
	}

	storage := supabase.NewStorage(cfg.SupabaseURL, cfg.SupabaseKey)
	gemini := supabase.NewGemini(os.Getenv("GEMINI_BASE_URL"), cfg.GeminiAPIKey)
	runner := jobs.New(cfg, st, storage, gemini, logger)

	// One cleanup pass at boot, then periodically, so expired exports and stale
	// searches are handled even during quiet periods.
	if _, err := runner.Handle(rootCtx, store.Job{Type: "cleanup"}); err != nil {
		logger.Warn("startup cleanup failed", "error", err)
	}

	var (
		workGroup   sync.WaitGroup
		scrapeSlots = make(chan struct{}, max(1, cfg.MaxConcurrentScrapeJobs))
		maintenance = time.NewTicker(cfg.CleanupInterval)
	)
	defer maintenance.Stop()

	go func() {
		for {
			select {
			case <-rootCtx.Done():
				return
			case <-maintenance.C:
				if _, err := st.Enqueue(rootCtx, "cleanup", "", map[string]any{"reason": "scheduled"}, 5, ""); err != nil {
					logger.Warn("could not enqueue scheduled cleanup", "error", err)
				}
			}
		}
	}()

	for {
		select {
		case <-rootCtx.Done():
			logger.Info("shutdown requested — waiting for in-flight jobs")
			done := make(chan struct{})
			go func() { workGroup.Wait(); close(done) }()

			select {
			case <-done:
			case <-time.After(cfg.GracefulShutdownTimeout):
				logger.Warn("shutdown timeout reached — in-flight jobs will be reclaimed by their lease")
			}

			shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			_ = httpServer.Shutdown(shutdownCtx)
			cancel()
			_ = st.WorkerHeartbeat(context.Background(), cfg.WorkerID, "stopped", 0, 0, map[string]any{"processed": healthServer.Processed()})
			return nil
		default:
		}

		jobTypes := cfg.JobTypes
		claimed, err := st.Claim(rootCtx, cfg.WorkerID, jobTypes, cfg.MaxJobsPerPoll, cfg.LeaseSeconds)
		if err != nil {
			logger.Error("claim failed", "error", err)
			if !sleep(rootCtx, 5*time.Second) {
				continue
			}
			continue
		}

		if len(claimed) == 0 {
			_ = st.WorkerHeartbeat(rootCtx, cfg.WorkerID, "idle", 0, 0, nil)
			if !sleep(rootCtx, cfg.PollInterval) {
				continue
			}
			continue
		}

		for _, job := range claimed {
			job := job

			if job.Type == "scrape" {
				select {
				case scrapeSlots <- struct{}{}:
				case <-rootCtx.Done():
					return nil
				}
			}

			workGroup.Add(1)
			healthServer.BeginJob()

			go func() {
				defer healthServer.EndJob()
				defer workGroup.Done()
				if job.Type == "scrape" {
					defer func() { <-scrapeSlots }()
				}

				started := time.Now()
				logger.Info("job started", "id", job.ID, "type", job.Type, "attempt", job.Attempts+1)

				jobCtx, cancel := context.WithCancel(rootCtx)
				defer cancel()

				// Keep the lease renewed for the whole job, not just while the
				// engine reports progress: exports and AI jobs can be quiet.
				leaseDone := make(chan struct{})
				go func() {
					ticker := time.NewTicker(cfg.HeartbeatInterval)
					defer ticker.Stop()
					for {
						select {
						case <-leaseDone:
							return
						case <-jobCtx.Done():
							return
						case <-ticker.C:
							if alive, err := st.Heartbeat(jobCtx, job.ID, cfg.WorkerID, cfg.LeaseSeconds); err != nil {
								logger.Warn("heartbeat failed", "job", job.ID, "error", err)
							} else if !alive {
								logger.Warn("lost lease for job", "job", job.ID)
								cancel()
								return
							}
							_ = st.WorkerHeartbeat(jobCtx, cfg.WorkerID, "running", 1, 0, map[string]any{"job_id": job.ID, "job_type": job.Type})
						}
					}
				}()

				result, handleErr := runner.Handle(jobCtx, job)
				close(leaseDone)

				// Always finish the job with a context that is not cancelled, so
				// a shutdown or lost lease cannot strand a running row.
				finalCtx, finalCancel := context.WithTimeout(context.Background(), 20*time.Second)
				defer finalCancel()

				if handleErr != nil {
					status, failErr := st.Fail(finalCtx, job.ID, cfg.WorkerID, handleErr.Error(), 30)
					if failErr != nil {
						logger.Error("could not record job failure", "job", job.ID, "error", failErr, "cause", handleErr)
					}
					healthServer.RecordFailure()
					logger.Warn("job failed", "id", job.ID, "type", job.Type, "status", status, "duration", time.Since(started).String(), "error", handleErr)
					return
				}

				if _, err := st.Complete(finalCtx, job.ID, cfg.WorkerID, result); err != nil {
					logger.Error("could not complete job", "job", job.ID, "error", err)
				}
				healthServer.RecordSuccess()
				logger.Info("job finished", "id", job.ID, "type", job.Type, "duration", time.Since(started).String(), "result", result)
			}()
		}
	}
}

func sleep(ctx context.Context, duration time.Duration) bool {
	timer := time.NewTimer(duration)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-timer.C:
		return true
	}
}

func logLevel() slog.Level {
	switch os.Getenv("LOG_LEVEL") {
	case "debug":
		return slog.LevelDebug
	case "warn":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}
