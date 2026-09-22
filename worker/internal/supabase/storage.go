// Package supabase holds the small server-side clients the worker needs:
// Storage (for exports) and the Generative Language REST API (for AI jobs).
package supabase

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type Storage struct {
	baseURL string
	key     string
	client  *http.Client
}

func NewStorage(baseURL, serviceKey string) *Storage {
	return &Storage{
		baseURL: strings.TrimRight(baseURL, "/"),
		key:     serviceKey,
		client:  &http.Client{Timeout: 120 * time.Second},
	}
}

func (s *Storage) Configured() bool {
	return s.baseURL != "" && s.key != ""
}

// Upload writes an object and returns its checksum. Objects are written with
// x-upsert so a retried export overwrites its own file instead of duplicating.
func (s *Storage) Upload(ctx context.Context, bucket, path string, content []byte, contentType string) (string, error) {
	if !s.Configured() {
		return "", fmt.Errorf("supabase storage is not configured (SUPABASE_URL / SUPABASE_SECRET_KEY)")
	}

	url := fmt.Sprintf("%s/storage/v1/object/%s/%s", s.baseURL, bucket, path)
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(content))
	if err != nil {
		return "", err
	}
	request.Header.Set("authorization", "Bearer "+s.key)
	request.Header.Set("content-type", contentType)
	request.Header.Set("x-upsert", "true")
	request.Header.Set("cache-control", "max-age=0")

	response, err := s.client.Do(request)
	if err != nil {
		return "", fmt.Errorf("storage upload: %w", err)
	}
	defer func() { _ = response.Body.Close() }()

	if response.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(response.Body, 2048))
		return "", fmt.Errorf("storage upload failed (%d): %s", response.StatusCode, strings.TrimSpace(string(body)))
	}

	sum := sha256.Sum256(content)
	return hex.EncodeToString(sum[:]), nil
}

func (s *Storage) Delete(ctx context.Context, bucket, path string) error {
	if !s.Configured() {
		return fmt.Errorf("supabase storage is not configured")
	}

	url := fmt.Sprintf("%s/storage/v1/object/%s/%s", s.baseURL, bucket, path)
	request, err := http.NewRequestWithContext(ctx, http.MethodDelete, url, nil)
	if err != nil {
		return err
	}
	request.Header.Set("authorization", "Bearer "+s.key)

	response, err := s.client.Do(request)
	if err != nil {
		return err
	}
	defer func() { _ = response.Body.Close() }()

	// A missing object is not an error for cleanup purposes.
	if response.StatusCode >= 300 && response.StatusCode != http.StatusNotFound {
		body, _ := io.ReadAll(io.LimitReader(response.Body, 1024))
		return fmt.Errorf("storage delete failed (%d): %s", response.StatusCode, strings.TrimSpace(string(body)))
	}
	return nil
}
