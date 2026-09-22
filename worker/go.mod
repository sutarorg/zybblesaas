module github.com/zybble/worker

go 1.27.1

// Dependencies are pinned by the Docker build (`go get ... @v1.18.1`, then
// `go mod tidy`) so the engine version is explicit and reproducible.
require (
	github.com/gosom/google-maps-scraper v1.18.1
	github.com/gosom/scrapemate v1.4.0
	github.com/jackc/pgx/v5 v5.7.2
	github.com/google/uuid v1.6.0
)
