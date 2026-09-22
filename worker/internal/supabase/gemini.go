package supabase

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// Gemini is a thin client for the Generative Language REST API.
//
// The key lives only in the worker/API environment. Model output is validated
// against a JSON schema, and the result is stored with its prompt version,
// input hash and token usage so every AI claim is auditable.
type Gemini struct {
	baseURL string
	apiKey  string
	client  *http.Client
}

func NewGemini(baseURL, apiKey string) *Gemini {
	if baseURL == "" {
		baseURL = "https://generativelanguage.googleapis.com"
	}
	return &Gemini{
		baseURL: strings.TrimRight(baseURL, "/"),
		apiKey:  apiKey,
		client:  &http.Client{Timeout: 120 * time.Second},
	}
}

func (g *Gemini) Configured() bool { return g.apiKey != "" }

type Usage struct {
	PromptTokens    int `json:"promptTokenCount"`
	CandidateTokens int `json:"candidatesTokenCount"`
	TotalTokens     int `json:"totalTokenCount"`
}

type GenerateResult struct {
	Text         string
	Usage        Usage
	ModelVersion string
	Latency      time.Duration
}

type generateRequest struct {
	SystemInstruction struct {
		Parts []struct {
			Text string `json:"text"`
		} `json:"parts"`
	} `json:"systemInstruction"`
	Contents []struct {
		Role  string `json:"role"`
		Parts []struct {
			Text string `json:"text"`
		} `json:"parts"`
	} `json:"contents"`
	GenerationConfig struct {
		Temperature      float64        `json:"temperature,omitempty"`
		MaxOutputTokens  int            `json:"maxOutputTokens,omitempty"`
		ResponseMimeType string         `json:"responseMimeType,omitempty"`
		ResponseSchema   map[string]any `json:"responseSchema,omitempty"`
	} `json:"generationConfig"`
}

type generateResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"content"`
		FinishReason string `json:"finishReason"`
	} `json:"candidates"`
	UsageMetadata Usage  `json:"usageMetadata"`
	ModelVersion  string `json:"modelVersion"`
	PromptFeedback *struct {
		BlockReason string `json:"blockReason"`
	} `json:"promptFeedback"`
}

// GenerateJSON asks the model for strict JSON matching `schema`.
func (g *Gemini) GenerateJSON(ctx context.Context, model, system, prompt string, schema map[string]any, temperature float64, maxTokens int) (*GenerateResult, error) {
	return g.generate(ctx, model, system, prompt, schema, temperature, maxTokens)
}

// GenerateText asks for free-form text (assistant chat).
func (g *Gemini) GenerateText(ctx context.Context, model, system, prompt string, temperature float64, maxTokens int) (*GenerateResult, error) {
	return g.generate(ctx, model, system, prompt, nil, temperature, maxTokens)
}

func (g *Gemini) generate(ctx context.Context, model, system, prompt string, schema map[string]any, temperature float64, maxTokens int) (*GenerateResult, error) {
	if !g.Configured() {
		return nil, fmt.Errorf("GEMINI_API_KEY is not configured — AI jobs cannot run")
	}
	if model == "" {
		model = "gemini-2.5-pro"
	}

	var body generateRequest
	body.SystemInstruction.Parts = []struct {
		Text string `json:"text"`
	}{{Text: system}}
	body.Contents = []struct {
		Role  string `json:"role"`
		Parts []struct {
			Text string `json:"text"`
		} `json:"parts"`
	}{{Role: "user", Parts: []struct {
		Text string `json:"text"`
	}{{Text: prompt}}}}
	body.GenerationConfig.Temperature = temperature
	body.GenerationConfig.MaxOutputTokens = maxTokens
	if schema != nil {
		body.GenerationConfig.ResponseMimeType = "application/json"
		body.GenerationConfig.ResponseSchema = schema
	}

	payload, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}

	url := fmt.Sprintf("%s/v1beta/models/%s:generateContent", g.baseURL, model)
	started := time.Now()
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	request.Header.Set("x-goog-api-key", g.apiKey)
	request.Header.Set("content-type", "application/json")

	response, err := g.client.Do(request)
	if err != nil {
		return nil, fmt.Errorf("gemini request: %w", err)
	}
	defer func() { _ = response.Body.Close() }()

	raw, _ := io.ReadAll(response.Body)
	if response.StatusCode >= 300 {
		return nil, fmt.Errorf("gemini request failed (%d): %s", response.StatusCode, strings.TrimSpace(string(raw)))
	}

	var parsed generateResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, fmt.Errorf("gemini response decode: %w", err)
	}
	if len(parsed.Candidates) == 0 {
		reason := "no candidates returned"
		if parsed.PromptFeedback != nil && parsed.PromptFeedback.BlockReason != "" {
			reason = "blocked by safety filters: " + parsed.PromptFeedback.BlockReason
		}
		return nil, fmt.Errorf("gemini returned no usable answer (%s)", reason)
	}

	text := ""
	for _, part := range parsed.Candidates[0].Content.Parts {
		text += part.Text
	}
	if strings.TrimSpace(text) == "" {
		return nil, fmt.Errorf("gemini returned an empty answer (finish reason: %s)", parsed.Candidates[0].FinishReason)
	}

	return &GenerateResult{
		Text:         text,
		Usage:        parsed.UsageMetadata,
		ModelVersion: parsed.ModelVersion,
		Latency:      time.Since(started),
	}, nil
}

// Untrusted wraps scraped third-party text so the model treats it as evidence,
// never as instructions.
func Untrusted(label, content string) string {
	if content == "" {
		return ""
	}
	const maxChars = 6000
	if len(content) > maxChars {
		content = content[:maxChars] + "…[truncated]"
	}
	return fmt.Sprintf("<<<%s>>>\n%s\n<<<end %s>>>", label, content, label)
}
