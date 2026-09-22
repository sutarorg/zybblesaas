package jobs

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

func getenv(name string) string { return strings.TrimSpace(os.Getenv(name)) }

// sendEmail delivers a notification through Resend when the deployment has
// configured it. Without a provider the caller reports "not emailed" instead of
// pretending the mail went out.
func sendEmail(ctx context.Context, apiKey, from, to, subject string, body *string, link *string) error {
	text := ""
	if body != nil {
		text = *body
	}
	if link != nil && *link != "" {
		text += "\n\n" + *link
	}
	if strings.TrimSpace(text) == "" {
		text = subject
	}

	payload := map[string]any{
		"from":    from,
		"to":      []string{to},
		"subject": subject,
		"text":    text,
	}

	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(raw))
	if err != nil {
		return err
	}
	request.Header.Set("authorization", "Bearer "+apiKey)
	request.Header.Set("content-type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	response, err := client.Do(request)
	if err != nil {
		return fmt.Errorf("email provider request: %w", err)
	}
	defer func() { _ = response.Body.Close() }()

	if response.StatusCode >= 300 {
		detail, _ := io.ReadAll(io.LimitReader(response.Body, 1024))
		return fmt.Errorf("email provider rejected the message (%d): %s", response.StatusCode, strings.TrimSpace(string(detail)))
	}
	return nil
}
