// Package engine drives the Gosom Google Maps scraper.
//
// It has three moving parts, all driven by real engine events:
//
//	Exiter   — implements gosom's exiter.Exiter so Zybble sees exactly how many
//	           places the engine found and finished, per search (§ never fake
//	           progress). It also ends the run when the engine says it is done.
//	Writer   — a scrapemate.ResultWriter that persists every place as it arrives
//	           (small batches, short interval), so leads appear while the search
//	           is still running instead of at the very end.
//	RunScrape— creates one seed job per search input (grid cells included) with
//	           that input's own coordinates, runs the scraper, and reports an
//	           honest per-input outcome back to Postgres.
package engine

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"reflect"
	"sync"
	"time"

	"github.com/gosom/google-maps-scraper/deduper"
	"github.com/gosom/google-maps-scraper/exiter"
	"github.com/gosom/google-maps-scraper/gmaps"
	"github.com/gosom/google-maps-scraper/runner"
	"github.com/gosom/scrapemate"
	"github.com/gosom/scrapemate/scrapemateapp"

	"github.com/zybble/worker/internal/store"
)

// ------------------------------------------------------------------ exiter

// Exiter is Zybble's own exit monitor: like the stock one it cancels the run
// when every seed job and every discovered place has finished, but it also
// publishes the counters that become search progress.
type Exiter struct {
	mu              sync.Mutex
	seedCount       int
	seedCompleted   int
	placesFound     int
	placesCompleted int
	cancel          context.CancelFunc
	doneCh          chan struct{}
	done            bool
	onChange        func(seedCompleted, placesFound, placesCompleted int)
}

var _ exiter.Exiter = (*Exiter)(nil)

func NewExiter(onChange func(seedCompleted, placesFound, placesCompleted int)) *Exiter {
	return &Exiter{
		doneCh:   make(chan struct{}, 1),
		onChange: onChange,
	}
}

func (e *Exiter) SetSeedCount(value int) {
	e.mu.Lock()
	e.seedCount = value
	e.mu.Unlock()
	e.emit()
}

func (e *Exiter) SetCancelFunc(fn context.CancelFunc) {
	e.mu.Lock()
	e.cancel = fn
	e.mu.Unlock()
}

func (e *Exiter) IncrSeedCompleted(value int)   { e.add(value, 0, 0) }
func (e *Exiter) IncrPlacesFound(value int)     { e.add(0, value, 0) }
func (e *Exiter) IncrPlacesCompleted(value int) { e.add(0, 0, value) }

// add applies one engine signal, then checks whether the run is complete.
func (e *Exiter) add(seedDelta, foundDelta, completedDelta int) {
	e.mu.Lock()
	e.seedCompleted += seedDelta
	e.placesFound += foundDelta
	e.placesCompleted += completedDelta

	finished := e.seedCount > 0 && e.seedCompleted >= e.seedCount && e.placesCompleted >= e.placesFound

	var cancel context.CancelFunc
	if finished && !e.done {
		e.done = true
		cancel = e.cancel
	}
	seedCompletedTotal, foundTotal, completedTotal := e.seedCompleted, e.placesFound, e.placesCompleted
	e.mu.Unlock()

	if finished && cancel != nil {
		select {
		case e.doneCh <- struct{}{}:
		default:
		}
		cancel()
	}

	e.emitWith(seedCompletedTotal, foundTotal, completedTotal)
}

func (e *Exiter) emit() {
	e.mu.Lock()
	seedCompleted, found, completed := e.seedCompleted, e.placesFound, e.placesCompleted
	e.mu.Unlock()
	e.emitWith(seedCompleted, found, completed)
}

func (e *Exiter) emitWith(seedCompleted, found, completed int) {
	if e.onChange == nil {
		return
	}
	e.onChange(seedCompleted, found, completed)
}

// Run blocks until the engine reports everything finished, then cancels the run.
// It mirrors the stock exiter's contract for scrapemate.
func (e *Exiter) Run(ctx context.Context) {
	select {
	case <-e.doneCh:
	case <-ctx.Done():
	}
}

// Finished reports whether the engine reached the end of its work (as opposed to
// being cut off by the deadline).
func (e *Exiter) Finished() bool {
	e.mu.Lock()
	defer e.mu.Unlock()
	return e.done
}

func (e *Exiter) Counts() (seedCompleted, placesFound, placesCompleted int) {
	e.mu.Lock()
	defer e.mu.Unlock()
	return e.seedCompleted, e.placesFound, e.placesCompleted
}

// ------------------------------------------------------------------ writer

// bufferedEntry is one place waiting to be written, tagged with the engine
// input (seed job) it belongs to so progress is attributed to the right input.
type bufferedEntry struct {
	inputID string
	entry   *gmaps.Entry
}

// Writer persists engine results while the scrape is running.
type Writer struct {
	store         *store.Store
	searchID      string
	engineVersion string
	log           *slog.Logger

	flushSize     int
	flushInterval time.Duration

	mu          sync.Mutex
	buffer      []bufferedEntry
	lastFlush   time.Time
	delivered   map[string]int // input id -> entries persisted
	saved       int
	firstError  error
	onSaved     func(inputID string, created bool, duplicate bool)
	onInputDone func(inputID string, delivered int)
}

var _ scrapemate.ResultWriter = (*Writer)(nil)

func NewWriter(st *store.Store, searchID, engineVersion string, flushSize int, flushInterval time.Duration, log *slog.Logger) *Writer {
	if flushSize <= 0 {
		flushSize = 5
	}
	if flushInterval <= 0 {
		flushInterval = 3 * time.Second
	}
	return &Writer{
		store:         st,
		searchID:      searchID,
		engineVersion: engineVersion,
		log:           log,
		flushSize:     flushSize,
		flushInterval: flushInterval,
		delivered:     map[string]int{},
		lastFlush:     time.Now(),
	}
}

func (w *Writer) OnSaved(fn func(inputID string, created bool, duplicate bool)) { w.onSaved = fn }
func (w *Writer) OnInputDone(fn func(inputID string, delivered int))            { w.onInputDone = fn }

func (w *Writer) Run(ctx context.Context, in <-chan scrapemate.Result) error {
	ticker := time.NewTicker(w.flushInterval)
	defer ticker.Stop()

	flush := func() {
		if err := w.flush(ctx); err != nil {
			w.log.Error("flush failed", "error", err)
		}
	}

	for {
		select {
		case result, ok := <-in:
			if !ok {
				flush()
				return w.firstError
			}
			entries := entriesOf(result)
			if len(entries) == 0 {
				continue
			}
			// The seed job id is our search_inputs.id; the entry's own id is
			// Google's identifier for the place and is not an input reference.
			inputID := inputIDOf(result)
			w.mu.Lock()
			for _, entry := range entries {
				w.buffer = append(w.buffer, bufferedEntry{inputID: inputID, entry: entry})
			}
			w.mu.Unlock()

			w.mu.Lock()
			shouldFlush := len(w.buffer) >= w.flushSize
			w.mu.Unlock()
			if shouldFlush {
				flush()
			} else if w.onInputDone != nil {
				w.onInputDone(inputID, w.deliveredCount(inputID))
			}
		case <-ticker.C:
			w.mu.Lock()
			due := len(w.buffer) > 0 && time.Since(w.lastFlush) >= w.flushInterval
			w.mu.Unlock()
			if due {
				flush()
			}
		case <-ctx.Done():
			flush()
			return w.firstError
		}
	}
}

func (w *Writer) flush(ctx context.Context) error {
	w.mu.Lock()
	batch := w.buffer
	w.buffer = nil
	w.lastFlush = time.Now()
	w.mu.Unlock()

	if len(batch) == 0 {
		return nil
	}

	for _, item := range batch {
		if err := w.save(ctx, item.inputID, item.entry); err != nil {
			w.mu.Lock()
			if w.firstError == nil {
				w.firstError = err
			}
			w.mu.Unlock()
			return err
		}
	}
	return nil
}

func (w *Writer) save(ctx context.Context, inputID string, entry *gmaps.Entry) error {
	payload, err := PayloadFromEntry(entry)
	if err != nil {
		return err
	}

	lead, err := w.store.UpsertLead(ctx, payload, w.engineVersion)
	if err != nil {
		return err
	}

	// Only a real input id may be persisted in search_leads.input_id — anything
	// else is a provider identifier and would break the foreign key.
	if !looksLikeUUID(inputID) {
		inputID = ""
	}

	var inputPtr *string
	if inputID != "" {
		inputPtr = &inputID
	}

	register, err := w.store.RegisterSearchLead(ctx, w.searchID, lead.LeadID, inputPtr, lead.Created, false, nil)
	if err != nil {
		return err
	}

	w.mu.Lock()
	w.saved++
	if inputID != "" {
		w.delivered[inputID]++
	}
	w.mu.Unlock()

	if w.onSaved != nil {
		w.onSaved(inputID, lead.Created, !register.IsNewAssociation)
	}
	return nil
}

func (w *Writer) deliveredCount(inputID string) int {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.delivered[inputID]
}

// Delivered exposes per-input counts once the run is over.
func (w *Writer) Delivered() map[string]int {
	w.mu.Lock()
	defer w.mu.Unlock()
	out := make(map[string]int, len(w.delivered))
	for key, value := range w.delivered {
		out[key] = value
	}
	return out
}

func (w *Writer) Saved() int {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.saved
}

// entriesOf accepts every shape the engine emits: a single entry, a typed
// slice, or the []any that the writer-managed completion path uses.
func entriesOf(result scrapemate.Result) []*gmaps.Entry {
	if result.Data == nil {
		return nil
	}
	if entry, ok := result.Data.(*gmaps.Entry); ok {
		return []*gmaps.Entry{entry}
	}

	value := reflect.ValueOf(result.Data)
	if value.Kind() != reflect.Slice {
		return nil
	}

	out := make([]*gmaps.Entry, 0, value.Len())
	for index := 0; index < value.Len(); index++ {
		if entry, ok := value.Index(index).Interface().(*gmaps.Entry); ok {
			out = append(out, entry)
		}
	}
	return out
}

// looksLikeUUID reports whether the string is a canonical UUID. It is used to
// keep provider identifiers out of uuid-typed columns.
func looksLikeUUID(value string) bool {
	if len(value) != 36 {
		return false
	}
	for index, char := range value {
		switch index {
		case 8, 13, 18, 23:
			if char != '-' {
				return false
			}
		default:
			isHex := (char >= '0' && char <= '9') || (char >= 'a' && char <= 'f') || (char >= 'A' && char <= 'F')
			if !isHex {
				return false
			}
		}
	}
	return true
}

func inputIDOf(result scrapemate.Result) string {
	if result.Job == nil {
		return ""
	}
	return result.Job.GetID()
}

// ------------------------------------------------------------------ payload

// PayloadFromEntry maps a Gosom entry to the JSON document `public.lead_upsert`
// expects. The untouched engine payload is preserved under `raw_data` so nothing
// the scraper saw is ever lost.
func PayloadFromEntry(entry *gmaps.Entry) (map[string]any, error) {
	raw, err := json.Marshal(entry)
	if err != nil {
		return nil, fmt.Errorf("marshal entry: %w", err)
	}

	payload := map[string]any{
		"business_name": entry.Title,
		"category":      entry.Category,
		"categories":    entry.Categories,
		"website":       entry.WebSite,
		"phone":         entry.Phone,
		"address":       entry.Address,
		"city":          entry.CompleteAddress.City,
		"street":        entry.CompleteAddress.Street,
		"state":         entry.CompleteAddress.State,
		"country":       entry.CompleteAddress.Country,
		"postal_code":   entry.CompleteAddress.PostalCode,
		"complete_address": joinNonEmpty(", ",
			entry.CompleteAddress.Street, entry.CompleteAddress.City,
			entry.CompleteAddress.State, entry.CompleteAddress.PostalCode,
			entry.CompleteAddress.Country),
		"latitude":        entry.Latitude,
		"longitude":       entry.Longtitude,
		"rating":          entry.ReviewRating,
		"review_count":    entry.ReviewCount,
		"status":          entry.Status,
		"open_hours":      entry.OpenHours,
		"popular_times":   entry.PopularTimes,
		"plus_code":       entry.PlusCode,
		"timezone":        entry.Timezone,
		"price_range":     entry.PriceRange,
		"data_id":         entry.DataID,
		"cid":             entry.Cid,
		"place_id":        entry.PlaceID,
		"map_url":         entry.Link,
		"reviews_url":     entry.ReviewsLink,
		"thumbnail_url":   entry.Thumbnail,
		"street_view_url": entry.StreetViewURL,
		"description":     entry.Description,
		"owner_data":      entry.Owner,
		"images":          entry.Images,
		"about":           entry.About,
		"emails":          entry.Emails,
		"raw_data":        json.RawMessage(raw),
		"source":          "google_maps",
		"source_engine":   "gosom",
	}

	if entry.ReviewsPerRating != nil {
		reviews := map[string]int{}
		for rating, count := range entry.ReviewsPerRating {
			reviews[fmt.Sprintf("%d", rating)] = count
		}
		payload["reviews_per_rating"] = reviews
	}

	if len(entry.Reservations) > 0 {
		payload["reservations_url"] = entry.Reservations[0].Link
	}
	if len(entry.OrderOnline) > 0 {
		payload["order_online_url"] = entry.OrderOnline[0].Link
	}
	if entry.Menu.Link != "" {
		payload["menu_url"] = entry.Menu.Link
	}

	if reviews := mapReviews(entry); len(reviews) > 0 {
		payload["reviews"] = reviews
	}

	return payload, nil
}

func mapReviews(entry *gmaps.Entry) []map[string]any {
	source := entry.UserReviews
	if len(entry.UserReviewsExtended) > 0 {
		source = entry.UserReviewsExtended
	}
	out := make([]map[string]any, 0, len(source))
	for _, review := range source {
		item := map[string]any{
			"review_id":       review.ReviewID,
			"author_name":     review.Name,
			"author_url":      review.AuthorURL,
			"rating":          review.Rating,
			"text_original":   review.TextOriginal,
			"text_translated": review.TextTranslated,
			"language":        review.Language,
		}
		if review.PostedAtUnixMicros > 0 {
			// lead_reviews.published_at is timestamptz: send an explicit instant.
			item["published_at"] = time.UnixMicro(review.PostedAtUnixMicros).UTC().Format(time.RFC3339)
		}
		out = append(out, item)
	}
	return out
}

func joinNonEmpty(sep string, values ...string) string {
	out := ""
	for _, value := range values {
		if value == "" {
			continue
		}
		if out != "" {
			out += sep
		}
		out += value
	}
	return out
}

// ------------------------------------------------------------------ runner

type ScrapeOptions struct {
	SearchID         string
	EngineVersion    string
	Language         string
	MaxDepth         int
	EmailExtraction  bool
	ExtraReviews     bool
	FastMode         bool
	Concurrency      int
	Proxies          []string
	BrowserPoolSize  int
	MaxPagesPerBrowser int
	DisablePageReuse bool
	ExitOnInactivity time.Duration
	FlushSize        int
	FlushInterval    time.Duration
	Log              *slog.Logger

	// OnProgressWithDelivered is called on every engine event. The jobs layer
	// throttles database writes; the engine stays cheap.
	OnProgressWithDelivered func(seedCompleted, placesFound, placesCompleted int, delivered map[string]int)
}

type ScrapeResult struct {
	Inputs          map[string]InputOutcome
	Entries         int
	NewLeads        int
	Duplicates      int
	FinishedNaturally bool
}

type InputOutcome struct {
	Discovered int
	Completed  int
	Failed     bool
	Error      string
}

// RunScrape executes one scrape job: it builds a seed job per input, runs the
// engine, and returns per-input outcomes. Nothing here decides billing or
// counters — Postgres functions do that as each lead is registered.
func RunScrape(ctx context.Context, st *store.Store, options ScrapeOptions, inputs []store.Input, onProgress func()) (*ScrapeResult, error) {
	if len(inputs) == 0 {
		return &ScrapeResult{Inputs: map[string]InputOutcome{}}, nil
	}
	if options.Concurrency < 1 {
		options.Concurrency = 1
	}
	if options.MaxDepth <= 0 {
		options.MaxDepth = 10
	}
	if options.Language == "" {
		options.Language = "en"
	}
	if options.Log == nil {
		options.Log = slog.Default()
	}

	log := options.Log

	// The writer persists results as they arrive; the exit monitor reports
	// engine completion. Both feed honest progress.
	writer := NewWriter(st, options.SearchID, options.EngineVersion, options.FlushSize, options.FlushInterval, log)

	found := map[string]int{}
	var foundMu sync.Mutex

	tracker := &completionTracker{
		onSeedDiscovered: func(inputID string, places int) error {
			foundMu.Lock()
			found[inputID] = places
			foundMu.Unlock()
			return nil
		},
	}

	exitMonitor := NewExiter(func(seedCompleted, placesFound, placesCompleted int) {
		if options.OnProgressWithDelivered != nil {
			options.OnProgressWithDelivered(seedCompleted, placesFound, placesCompleted, writer.Delivered())
		}
		if onProgress != nil {
			onProgress()
		}
	})

	dedup := deduper.New()
	jobOpts := []gmaps.GmapJobOptions{
		gmaps.WithDeduper(dedup),
		gmaps.WithExitMonitor(exitMonitor),
		gmaps.WithGmapCompletionTracker(tracker),
	}
	if options.ExtraReviews {
		jobOpts = append(jobOpts, gmaps.WithExtraReviews())
	}

	seedJobs := make([]scrapemate.IJob, 0, len(inputs))
	for _, input := range inputs {
		seedJobs = append(seedJobs, seedJob(input, options, exitMonitor, jobOpts))
	}

	app, err := newScrapeMate(options, writer)
	if err != nil {
		return nil, err
	}
	defer func() { _ = app.Close() }()

	// The engine decides its own deadline from the amount of work, exactly like
	// the reference runners do; it is renewed by the exit monitor when done.
	allowed := len(seedJobs) * 10 * options.MaxDepth / 50
	if allowed < 120 {
		allowed = 120
	}
	budget := time.Duration(allowed) * time.Second

	runCtx, cancel := context.WithTimeout(ctx, budget)
	defer cancel()

	exitMonitor.SetSeedCount(len(seedJobs))
	exitMonitor.SetCancelFunc(cancel)
	go exitMonitor.Run(runCtx)

	log.Info("starting scrape", "search", options.SearchID, "inputs", len(seedJobs), "budget", budget.String())

	startErr := app.Start(runCtx, seedJobs...)
	if startErr != nil && !errors.Is(startErr, context.Canceled) && !errors.Is(startErr, context.DeadlineExceeded) {
		return nil, startErr
	}

	delivered := writer.Delivered()
	result := &ScrapeResult{
		Inputs:            map[string]InputOutcome{},
		Entries:           writer.Saved(),
		FinishedNaturally: exitMonitor.Finished(),
	}

	foundMu.Lock()
	for _, input := range inputs {
		outcome := InputOutcome{
			Discovered: found[input.ID],
			Completed:  delivered[input.ID],
		}
		if !result.FinishedNaturally && outcome.Completed == 0 && outcome.Discovered == 0 {
			outcome.Failed = true
			outcome.Error = "the engine pass did not finish before the time budget ran out"
		}
		if outcome.Discovered < outcome.Completed {
			outcome.Discovered = outcome.Completed
		}
		result.Inputs[input.ID] = outcome
	}
	foundMu.Unlock()

	return result, nil
}

type completionTracker struct {
	onSeedDiscovered func(inputID string, places int) error
}

func (t *completionTracker) SeedDiscovered(inputID string, placesFound int) error {
	if t.onSeedDiscovered == nil {
		return nil
	}
	return t.onSeedDiscovered(inputID, placesFound)
}

func seedJob(input store.Input, options ScrapeOptions, exitMonitor *Exiter, jobOpts []gmaps.GmapJobOptions) scrapemate.IJob {
	coords := ""
	if input.Lat != nil && input.Lon != nil {
		coords = fmt.Sprintf("%f,%f", *input.Lat, *input.Lon)
	}
	zoom := 15
	if input.Zoom != nil {
		zoom = *input.Zoom
	}
	radius := 10000.0
	if input.RadiusM != nil && *input.RadiusM > 0 {
		radius = float64(*input.RadiusM)
	}

	if !options.FastMode {
		return gmaps.NewGmapJob(input.ID, options.Language, input.QueryText, options.MaxDepth, options.EmailExtraction, coords, zoom, jobOpts...)
	}

	// Fast mode talks to the Maps endpoint directly; it needs an explicit
	// location, so inputs without coordinates would produce nothing useful.
	params := gmaps.MapSearchParams{
		Location: gmaps.MapLocation{
			ZoomLvl: float64(zoom),
			Radius:  radius,
		},
		Query:     input.QueryText,
		ViewportW: 1920,
		ViewportH: 450,
		Hl:        options.Language,
	}
	if input.Lat != nil {
		params.Location.Lat = *input.Lat
	}
	if input.Lon != nil {
		params.Location.Lon = *input.Lon
	}

	job := gmaps.NewSearchJob(&params, gmaps.WithSearchJobExitMonitor(exitMonitor))
	job.ID = input.ID
	return job
}

func newScrapeMate(options ScrapeOptions, writer *Writer) (*scrapemateapp.ScrapemateApp, error) {
	cfg := &runner.Config{
		Concurrency:              options.Concurrency,
		MaxDepth:                 options.MaxDepth,
		LangCode:                 options.Language,
		Email:                    options.EmailExtraction,
		ExtraReviews:             options.ExtraReviews,
		FastMode:                 options.FastMode,
		Radius:                   10000,
		ExitOnInactivityDuration: options.ExitOnInactivity,
		DisablePageReuse:         options.DisablePageReuse,
		BrowserPoolSize:          options.BrowserPoolSize,
		MaxPagesPerBrowser:       options.MaxPagesPerBrowser,
		Proxies:                  options.Proxies,
		DisableTelemetry:         true,
	}

	appOptions := []func(*scrapemateapp.Config) error{
		scrapemateapp.WithConcurrency(options.Concurrency),
		scrapemateapp.WithExitOnInactivity(options.ExitOnInactivity),
	}

	if !options.FastMode {
		appOptions = append(appOptions, scrapemateapp.WithJS(scrapemateapp.DisableImages()))
	} else {
		appOptions = append(appOptions, scrapemateapp.WithStealth("firefox"))
	}

	if len(options.Proxies) > 0 {
		appOptions = append(appOptions, scrapemateapp.WithProxies(options.Proxies))
	}

	appOptions = runner.AppendBrowserCapacityOptions(appOptions, cfg)

	if !options.DisablePageReuse {
		appOptions = append(appOptions,
			scrapemateapp.WithPageReuseLimit(2),
			scrapemateapp.WithBrowserReuseLimit(200),
		)
	}

	mateConfig, err := scrapemateapp.NewConfig([]scrapemate.ResultWriter{writer}, appOptions...)
	if err != nil {
		return nil, fmt.Errorf("engine config: %w", err)
	}

	app, err := scrapemateapp.NewScrapeMateApp(mateConfig)
	if err != nil {
		return nil, fmt.Errorf("engine init: %w", err)
	}

	return app, nil
}
