package main

import (
	"net/http"
	"time"
)

// httpServerClosed mirrors http.ErrServerClosed so the shutdown path can tell a
// clean stop from a real failure.
var httpServerClosed = http.ErrServerClosed

func newHTTPServer(addr string, handler http.Handler) *http.Server {
	return &http.Server{
		Addr:              addr,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
	}
}
