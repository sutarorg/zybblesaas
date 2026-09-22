# syntax=docker/dockerfile:1
#
# Zybble worker — the Gosom Google Maps engine plus the job runner.
#
# The engine drives a real Chromium in standard mode, so the browser and the
# Playwright driver are installed exactly the way the upstream image does it.

ARG GO_VERSION=1.27.1
ARG PLAYWRIGHT_GO_VERSION=v0.6100.0
ARG GOSOM_VERSION=v1.18.1

# --- Playwright browser + driver -------------------------------------------
FROM golang:${GO_VERSION}-trixie AS playwright-deps
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/browsers
ENV PLAYWRIGHT_DRIVER_PATH=/opt/ms-playwright-go

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && go install github.com/mxschmitt/playwright-go/cmd/playwright@${PLAYWRIGHT_GO_VERSION} \
    && mkdir -p /opt/browsers \
    && playwright install chromium --with-deps

# --- build ------------------------------------------------------------------
FROM golang:${GO_VERSION}-trixie AS builder
ARG GOSOM_VERSION

ENV CGO_ENABLED=0
ENV GOFLAGS=-trimpath

WORKDIR /src

# go.mod pins the engine version; tidy resolves go.sum (network needed once).
COPY go.mod ./
COPY . .

RUN go mod tidy \
 && go build -ldflags "-s -w" -o /out/zybble-worker ./cmd/worker

# --- runtime ----------------------------------------------------------------
FROM debian:trixie-slim AS runtime

ENV PLAYWRIGHT_BROWSERS_PATH=/opt/browsers
ENV PLAYWRIGHT_DRIVER_PATH=/opt/ms-playwright-go
ENV DISABLE_TELEMETRY=1
ENV TZ=UTC

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      libnss3 \
      libnspr4 \
      libatk1.0-0 \
      libatk-bridge2.0-0 \
      libcups2 \
      libdrm2 \
      libdbus-1-3 \
      libxkbcommon0 \
      libatspi2.0-0 \
      libx11-6 \
      libxcomposite1 \
      libxdamage1 \
      libxext6 \
      libxfixes3 \
      libxrandr2 \
      libgbm1 \
      libpango-1.0-0 \
      libcairo2 \
      libasound2 \
      fonts-noto-color-emoji \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY --from=playwright-deps /opt/browsers /opt/browsers
COPY --from=playwright-deps /opt/ms-playwright-go /opt/ms-playwright-go
RUN chmod -R 755 /opt/browsers /opt/ms-playwright-go

WORKDIR /app
COPY --from=builder /out/zybble-worker /usr/local/bin/zybble-worker

RUN useradd --system --create-home --uid 10001 zybble \
 && mkdir -p /app/data \
 && chown -R zybble:zybble /app /opt/browsers
USER zybble

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["zybble-worker", "--health-check"]

ENTRYPOINT ["zybble-worker"]
