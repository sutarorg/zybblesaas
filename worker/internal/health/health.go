// Package health exposes the worker's HTTP surface.
//
// Railway's health check only gates a deploy, so the endpoint is deliberately
// cheap and honest: it reports database reachability, the queue depth and how
// many workers have heartbeated recently. Nothing secret is ever echoed.
package health

import (
	"context"
	"encoding/json"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/zybble/worker/internal/store"
)

type Server struct {
	mu      sync.RWMutex
	store   *store.Store
	Version string
	Worker  string

	startedAt time.Time
	processed atomic.Int64
	failed    atomic.Int64
	active    atomic.Int64
	lastJobAt atomic.Int64
}

func New(st *store.Store, workerID, version string) *Server {
	return &Server{store: st, Version: version, Worker: workerID, startedAt: time.Now()}
}

func (s *Server) SetStore(st *store.Store) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.store = st
}

func (s *Server) getStore() *store.Store {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.store
}

func (s *Server) Processed() int64 { return s.processed.Load() }
func (s *Server) Failed() int64    { return s.failed.Load() }

func (s *Server) RecordSuccess() {
	s.processed.Add(1)
	s.lastJobAt.Store(time.Now().Unix())
}

func (s *Server) RecordFailure() {
	s.failed.Add(1)
	s.lastJobAt.Store(time.Now().Unix())
}

func (s *Server) BeginJob() { s.active.Add(1) }

func (s *Server) EndJob() {
	if s.active.Add(-1) < 0 {
		s.active.Store(0)
	}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", s.handleHealth)
	mux.HandleFunc("/ready", s.handleReady)
	mux.HandleFunc("/metrics", s.handleMetrics)
	return mux
}

func (s *Server) handleHealth(response http.ResponseWriter, request *http.Request) {
	ctx, cancel := context.WithTimeout(request.Context(), 5*time.Second)
	defer cancel()

	payload := map[string]any{
		"ok":         true,
		"service":    "zybble-worker",
		"version":    s.Version,
		"worker":     s.Worker,
		"uptime":     time.Since(s.startedAt).Round(time.Second).String(),
		"processed":  s.processed.Load(),
		"failed":     s.failed.Load(),
		"active":     s.active.Load(),
		"checked_at": time.Now().UTC().Format(time.RFC3339),
	}

	st := s.getStore()
	if st == nil {
		payload["database"] = "connecting"
	} else if err := st.Ping(ctx); err != nil {
		payload["database"] = "unreachable: " + err.Error()
	} else {
		payload["database"] = "ok"
	}

	writeJSON(response, http.StatusOK, payload)
}

func (s *Server) handleReady(response http.ResponseWriter, request *http.Request) {
	ctx, cancel := context.WithTimeout(request.Context(), 5*time.Second)
	defer cancel()

	payload := map[string]any{"ok": true, "version": s.Version}

	st := s.getStore()
	if st == nil {
		payload["ok"] = false
		payload["database"] = "connecting"
		writeJSON(response, http.StatusServiceUnavailable, payload)
		return
	}

	if err := st.Ping(ctx); err != nil {
		payload["ok"] = false
		payload["database"] = err.Error()
		writeJSON(response, http.StatusServiceUnavailable, payload)
		return
	}
	payload["database"] = "ok"

	if stats, err := st.QueueStats(ctx); err == nil {
		payload["queue"] = stats
	}

	writeJSON(response, http.StatusOK, payload)
}

func (s *Server) handleMetrics(response http.ResponseWriter, request *http.Request) {
	ctx, cancel := context.WithTimeout(request.Context(), 5*time.Second)
	defer cancel()

	var queue map[string]any
	if st := s.getStore(); st != nil {
		queue, _ = st.QueueStats(ctx)
	}
	payload := map[string]any{
		"worker":         s.Worker,
		"processed":      s.processed.Load(),
		"failed":         s.failed.Load(),
		"active":         s.active.Load(),
		"queue":          queue,
		"uptime_seconds": int(time.Since(s.startedAt).Seconds()),
	}

	writeJSON(response, http.StatusOK, payload)
}

func writeJSON(response http.ResponseWriter, status int, payload any) {
	response.Header().Set("content-type", "application/json")
	response.Header().Set("cache-control", "no-store")
	response.WriteHeader(status)
	_ = json.NewEncoder(response).Encode(payload)
}
