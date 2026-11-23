# Research: Observability baseline

Phase 0 of `/speckit-plan`. Each entry is a decision the plan depends on. Entries marked
**(check)** are listed in the PR description for Antn.

## R1. Instrumentation: hand-written, no auto-instrumentation **(check)**

- **Decision**: Use the OpenTelemetry API and SDK packages directly. Instrument the three
  places we own: a Fastify plugin (server spans), our `Database.query` wrapper (db spans) and
  the shared outbound client (client spans). No `@opentelemetry/auto-instrumentations-node`,
  no `@opentelemetry/instrumentation-pg`, no `@fastify/otel`.
- **Rationale**: Node runs the TypeScript sources as native ESM via type stripping. Patching
  `pg` and `fastify` under ESM needs `--import` loader hooks (`import-in-the-middle`), which
  add a startup flag to both containers and break in subtle ways. Owning the three choke
  points gives exactly the spans the spec asks for: no spans for health routes (FR-007), no
  parameter values (FR-008), one client layer (FR-012), and no Fastify hook/handler child
  spans cluttering the "request → db → Common Ground" tree the tests assert.
- **Context propagation**: `AsyncLocalStorageContextManager`. The Fastify plugin starts the
  server span in `onRequest` and calls the hook's `done` inside `context.with(...)`, so the
  handler and everything it awaits run with the span active (the same technique
  `@fastify/otel` uses). Works identically under `app.inject()` in tests.
- **Alternatives**: auto-instrumentation (above); `@fastify/otel` alone (adds per-hook spans
  and still leaves pg and fetch to solve); OTel `NodeSDK` (`@opentelemetry/sdk-node`) — it
  wires auto-instrumentation and env-var magic we don't want; we assemble the three
  providers ourselves in ~100 lines.

## R2. SDK packages and versions

- **Decision**: `@opentelemetry/sdk-trace` 3.1.1 (the old `sdk-trace-base` and
  `sdk-trace-node` are deprecated in its favour), `sdk-metrics` 3.1.1, `sdk-logs` 3.1.1,
  `context-async-hooks` 3.1.1, `core` 3.1.1, `resources` 3.1.1, `semantic-conventions`
  1.45.0, `api` 1.10.0, `api-logs` 0.223.0, OTLP/HTTP (protobuf) exporters 0.301.2. Exact
  versions, re-checked against the registry when T001 installs them.
- **Rationale**: OTLP over HTTP needs no gRPC native code in the image; protobuf over HTTP is
  what the collector's `otlp` receiver accepts on 4318.
- **Alternatives**: gRPC exporters (heavier, native deps); JSON over HTTP (larger payloads,
  no benefit).

## R3. Logs: pino stays the logger; OTLP via an in-process bridge

- **Decision**: Keep Fastify's pino logger. Configure it once in
  `packages/telemetry/src/logger.ts`:
  - ISO timestamp `time`, level as a label (`"level":"info"`), `service`, `env`, `msg`.
  - `mixin()` adds `trace_id` and `span_id` from the active span (FR-001).
  - Request logs carry `request_id` (`requestIdLogLabel`), job logs `job_id` and `job_name`
    via child loggers (FR-002).
  - `hooks.logMethod` and `formatters.log` run the redactor and truncator over the message
    and every field before serialisation (FR-005, FR-006).
  - Destination: a small multistream — stdout always, plus (when export is on) a writable
    stream that parses each already-redacted line and emits an OTel `LogRecord` with the
    matching severity, body, attributes and trace context.
- **Rationale**: stdout JSON is required anyway (FR-001, US5); bridging the *serialised*
  line means the exported log can never contain anything stdout didn't. In-process keeps the
  test harness simple (in-memory log exporter).
- **Alternatives**: `pino-opentelemetry-transport` (runs in a worker thread with its own SDK
  instance — a second configuration to keep in sync and hard to assert in tests); collector
  `filelog` receiver reading Docker's json-file logs (needs the Docker socket or host log
  directory mounted, not portable to macOS Docker Desktop).

## R4. Redaction and truncation in one place **(check)**

- **Decision**: `redact(value)` walks objects and strings:
  - Key-based: the field name is split into words at `-`, `_`, `.`, spaces and camelCase
    boundaries (`commonGroundAdminKey` → `common ground admin key`, `X-Api-Key` → `x api key`,
    `PRIVATE_KEY` → `private key`), lower-cased, and the value becomes `"[REDACTED]"` if any word
    is one of `password`, `passwd`, `pass`, `secret`, `token`, `key`, `apikey`, `auth`,
    `authorization`, `cookie`, `session`, `credential`, `credentials`, or if the unsplit name
    contains `password`, `secret` or `token` (catches `accesstoken`, `clientsecret`). So
    `adminKey`, `privateKey`, `accessKey` and `commonGroundAdminKey` are all redacted, while
    `keyboard` or `monkey` are not.
  - Value-based: email addresses, `Bearer …`, `Discogs token=…`, `Basic …`, and URL query
    parameters named like secrets (`?token=…`, `&key=…`, `&code=…`) → `"[REDACTED]"`.
  - Request headers are never logged except an allow-list (`user-agent`, `content-type`,
    `x-request-id`); `authorization` and `cookie` would be redacted anyway.
  - Order: redaction runs first, truncation last, so replacing a value with `[REDACTED]` can't
    push a string back over the limit.
  - `truncate(value)`: strings over 8192 UTF-8 bytes are cut at a character boundary and
    suffixed with `…[truncated]` (FR-006).
- Applied to: log message and fields (R3), span attributes, span event attributes, span
  status messages and recorded exception messages — via the export guard (R5) — and the job
  table's `last_error`.
- **Rationale**: a single implementation, used by both signals, with property-based tests
  (fast-check: for any planted email/token/secret embedded in arbitrary JSON, the output
  never contains it). Over-redaction (a harmless field named `sort_key`) is the accepted
  cost.
- **Alternatives**: pino's path-based `redact` only (can't catch values in free text or
  unknown paths); a collector `transform`/`redaction` processor (contrib only, and secrets
  would still sit in stdout logs).

## R5. Export guard: non-blocking, rate-limited warning **(FR-020)**

- **Decision**: `BatchSpanProcessor`, `BatchLogRecordProcessor` (1 s delay, 2048 queue,
  drop on overflow) and a `PeriodicExportingMetricReader` (5 s interval, 5 s timeout). Each
  exporter is wrapped: spans are redacted/truncated before export; a failed export result
  calls a shared `DropWarning` limiter that writes at most one warning per minute (injected
  clock, unit-tested) straight to stdout, not through the bridged logger (so it cannot loop).
  The OTel `diag` logger is routed to the same limiter at `WARN`.
- When `OTEL_EXPORTER_OTLP_ENDPOINT` is unset, the providers still exist (so trace and span
  IDs appear in logs and tests can attach in-memory exporters) but no exporter is attached.
- **Alternatives**: `SimpleSpanProcessor` (exports synchronously per span — blocks on a down
  collector).

## R6. Metric names: keep the catalog as is **(check)**

- **Decision**: Keep every name in `ci/slo-catalog.json` unchanged. No catalog change in any
  PR of this feature.
- Additional, non-SLO instruments the spec needs (FR-015/016/017) are registered next to the
  catalog ones and follow the same `riviera.area.name` pattern:
  `riviera.http.server.duration`, `riviera.external.duration`, `riviera.jobs.runs`,
  `riviera.jobs.duration`. The plural `jobs` follows the catalog's existing
  `riviera.jobs.failures`, so the family stays consistent even though most other areas are
  singular (`riviera.sync.runs`, `riviera.verdict.requests`). Renaming `jobs` → `job` would be
  purely cosmetic and needs a protected-path PR, so it isn't worth it.
- Request counts come from the duration histograms' `_count` series; no separate request
  counters.
- **Units**: durations and delays in seconds (`s`), `riviera.sync.last_success` as a Unix
  time in seconds, counters with curly-brace annotation units (`{request}`, `{call}`, `{run}`)
  so the Prometheus translation adds only `_total`.

## R7. Metrics into Prometheus: OTLP receiver, no scrape

- **Decision**: Collector → Prometheus over OTLP/HTTP (`/api/v1/otlp/v1/metrics`), Prometheus
  started with `--web.enable-otlp-receiver`, `otlp.promote_resource_attributes:
  [service.name, deployment.environment.name]` and the default
  `UnderscoreEscapingWithSuffixes` translation. So `riviera.verdict.duration` (unit `s`)
  becomes `riviera_verdict_duration_seconds_{bucket,count,sum}` and `riviera.jobs.failures`
  becomes `riviera_jobs_failures_total`.
- The dashboard generator owns this translation in one function with unit tests; the CI
  check (R14) proves it for the http, job and external metrics against the real Prometheus.
- **Alternatives**: collector `prometheus` exporter + Prometheus scrape (one more hop and a
  scrape interval to wait for); `prometheusremotewrite` (deprecated direction for OTLP-native
  Prometheus).

## R8. Collector, Loki, Tempo, Prometheus, Grafana images and healthchecks **(check)**

- **Decision**: core `otel/opentelemetry-collector` distribution (not `-contrib`): it has the
  `otlp` receiver, `memory_limiter` and `batch` processors and the `otlp`/`otlphttp`
  exporters, which is all we need, with a much smaller Trivy surface. Loki 3.x (native OTLP
  ingestion at `/otlp`, `trace_id` as structured metadata), Tempo 2.x (local storage, OTLP
  gRPC in), Prometheus 3.x, Grafana 12+/13. Every image pinned by tag **and** digest at T014,
  latest stable at that time.
- **Healthchecks**: Grafana and Prometheus images have `wget`. The collector image is
  distroless and core has no `health_check` extension, and Loki/Tempo images may lack a
  shell. Where an image has no probe tool, a two-line derived image in `docker/` copies a
  static `busybox` in (`COPY --from=busybox:<tag>-musl@sha256:<digest> …`, pinned by tag and
  digest like every other image) so the healthcheck can
  `busybox wget --spider` the service's own readiness URL (collector: its internal telemetry
  endpoint on :8888; Loki and Tempo: `/ready`). T014 verifies per image and only adds the
  derived image where needed.
- **Alternatives**: `-contrib` collector for the `health_check` extension (≈10× larger,
  more CVEs to fail Trivy); no healthchecks (violates FR-021).

## R9. Enabling export: `make up-observability` sets the endpoint **(check)**

- **Decision**: `.env.example` documents `OTEL_EXPORTER_OTLP_ENDPOINT` but leaves it empty.
  `make up-observability` runs
  `OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318 docker compose --profile observability up --build --detach --wait --wait-timeout 120`
  (fine on the host); `make up-dev` adds the `dev` profile and the sample-flow variables (R17).
  The app services never `depends_on` an observability service, so a port clash only fails
  the observability services (edge case).
- **Rationale**: with the endpoint always set, the plain stack would emit a "telemetry
  dropped" warning every minute forever, which trains everyone to ignore that warning.
- **Alternative**: always set it in `.env.example` (simpler, noisy); a separate
  `compose.observability.yml` override file (works, but the spec and constitution ask for a
  profile).

## R10. Sampling and retention

- **Decision**: `AlwaysOnSampler` (not parent-based), so even a client `traceparent` with the
  sampled flag off is kept locally (FR-023). Tempo and Loki keep 7 days, Prometheus 30 days
  (enough for the 28-day SLO window), all on named volumes removed by `down --volumes`.

## R11. Trivy now scans the observability images (spec clarification Q5, FR-021)

- **Decision**: the CI image scan iterates
  `docker compose --profile dev --profile observability config --images`, so upstream
  observability images go through exactly the same Trivy step as the app's images (same
  severity rule and flags as `.github/workflows/ci.yml` uses today; this feature doesn't change
  them).
- **Risk**: an upstream image with a high or critical finding blocks CI until upstream ships a
  fix or we bump the pin. Accepting that is consistent with the constitution; the alternative
  (excluding them) would be a loosened gate and needs Antn.

## R12. Job queue: Postgres table, `FOR UPDATE SKIP LOCKED`, lease

- **Decision**: one table `job` (data-model.md). Claim:
  `UPDATE job SET status='running', attempt=attempt+1, locked_until=now()+interval '2 minutes' … WHERE id = (SELECT id FROM job WHERE status='queued' AND run_after<=now() ORDER BY run_after, created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`.
  Poll every 500 ms when idle, immediately again after a job. Retry with backoff
  (`run_after = now() + 2^attempt s`) until `max_attempts`, then `failed`.
- **Lease and heartbeat**: while a job runs, the runner extends `locked_until` to now + 2 min
  every 30 s (only while it still owns that attempt), so a long job is never picked up twice.
  Before each claim, a sweep (`FOR UPDATE SKIP LOCKED`) takes `running` jobs whose lease
  expired, i.e. whose worker crashed: the crashed attempt counts as one failed attempt
  (`riviera.jobs.runs{outcome="failed"}` and `riviera.jobs.failures` +1, `last_error =
  'lease expired'`), and the job goes back to `queued` if `attempt < max_attempts`, else to
  `failed`. So a crashed `max_attempts = 1` job is never run a second time. `heartbeat`,
  `complete` and `fail` all take the attempt number and only act while `id`, `attempt` and
  `status = 'running'` still match, so a stalled worker that lost its lease can't overwrite the
  next attempt.
- **Rationale**: the minimum FR-029 asks for, and the shape the Common Ground rate-limited
  queue (sync feature) can extend with a rate limiter and schedules.
- **Alternatives**: pg-boss / graphile-worker (bigger than needed, own schemas and
  migrations, own spans to reconcile); LISTEN/NOTIFY (latency we don't need yet).

## R13. Job traces: producer span, consumer span, retries in the same trace **(check)**

- **Decision**: `enqueue()` called inside a request creates a short `PRODUCER` span
  `job.enqueue <name>` (child of the request span) and stores its `traceparent` in
  `job.origin_traceparent`. Each attempt is a `CONSUMER` span `job.run <name>`:
  - first attempt: a new root span with a **span link** to the producer context (FR-010);
    its own `traceparent` is stored in `job.trace_parent`;
  - later attempts: children of that first-attempt span, also linked to the producer — so
    retries are new spans in the same trace (edge case), and the job trace is navigable to
    the request trace in Tempo's "Links" panel.
  - if the first attempt crashed (its lease expired, R12), its span was never exported, so the
    sweep clears `job.trace_parent`; the next attempt then starts a new root span (still linked
    to the producer) and stores its own context. Retries never hang off a parent that doesn't
    exist in Tempo.
  - no originating request (scheduled jobs): no producer link; the first attempt starts its
    own trace.
- **Failure metric** (spec clarification Q1, FR-016): `riviera.jobs.failures` counts failed **attempts** (once
  each), `riviera.jobs.runs{outcome}` counts every attempt. The sample job's fail mode
  enqueues with `max_attempts = 1`, so US2-4's "goes up by one" holds exactly; retries are
  covered with a test job.
- **Alternatives**: job runs as children of the request span (one huge trace that stays open
  as long as jobs wait; mixes request latency with job latency); a new trace per attempt
  (contradicts the "same trace" edge case).

## R14. FR-033 end-to-end check: a script in the existing `stack` job **(check)**

- **Decision**: `ci/obs-check.ts` (logic in `ci/lib/obs-check.ts`, unit-tested with a fake
  fetch) runs on the runner against 127.0.0.1 ports:
  1. Before any sample data: every SLO dashboard's panel queries return no data (FR-025).
  2. `POST /api/sample/trace` and `POST /api/sample/trace` with `failJob: true`; read
     `traceId` and `jobId` from the responses.
  3. Poll (≤ 30 s, SC-001/002) Tempo `/api/traces/{id}` for the request trace (server, db,
     Common Ground spans) and the job trace (job and Discogs spans, link to the request);
     Loki `query_range` for log lines with that `trace_id`; Prometheus for the http, job,
     external and queue-depth series.
  4. Push sample data for every SLO metric over OTLP (resource
     `service.name=riviera-slo-sample`): two data points per series, the first at 0 (counters)
     or a first observation (histograms), the second with a real increase, at least one export
     interval apart so Prometheus stores both, then assert each SLO dashboard's SLI and budget panels
     now return a value through Grafana's `/api/ds/query` (US3-3).
  5. Grafana `/api/search`: exactly 7 dashboards in the "SLOs" folder with UIDs `slo-<id>`
     from the catalog, plus `overview`.
- The `stack` job becomes: plain stack up → smoke (US5-1) → profile up with endpoint,
  healthy within 120 s (SC-007) → obs-check → latency baseline → `docker compose stop
  otel-collector` → smoke + latency again (US5-2, SC-006) → Trivy over all images.
- **Alternatives**: a separate required job (needs a ruleset change by Antn and duplicates
  the image build); Playwright against Grafana's UI (slow and brittle; the spec asks for the
  stack's query interfaces).

## R15. SC-006 latency comparison method (spec clarification Q4)

- **Decision**: 300 sequential `POST /api/sample/trace` calls with the collector up (after 30
  warm-up calls), then 300 with it stopped; compare p95. Fail if
  `p95_down > max(1.10 × p95_up, p95_up + 5 ms)`, as SC-006 now states.
- **Rationale**: the sample request takes a few milliseconds, so runner noise alone can exceed
  10%; the 5 ms allowance absorbs that while a blocking exporter (hundreds of milliseconds or
  the exporter timeout) still fails the check.

## R16. Mocks, the sample operations and their fixtures **(check)**

- **Decision**: `apps/mocks`, a small Fastify server, own image, behind the compose profile
  `dev` (R17), so it runs in development and CI and never on the host's plain stack:
  - Common Ground: `POST /graphql` answering the `SampleShopConfig` operation
    (`config { shopName }` on the Admin schema) from a recorded fixture. The operation lives
    in `packages/common-ground/operations/admin/SampleShopConfig.graphql`, so codegen validates
    it against `contracts/common-ground/admin.graphql`, and a contract test checks the fixture
    against the generated result type and the schema.
  - Discogs: `GET /releases/:id` from a fixture. There is no Discogs contract in `contracts/`;
    the fixture is validated by a zod schema in the mocks app. Adding a Discogs contract is a
    protected-path change for a later feature (Discogs connect).
  - Control: `POST /_mock/next { service, outcome: "fail" | "rate_limited", times }` makes the
    next N answers fail (500) or 429. Tests and the obs-check use it; the api carries no test
    hooks.
- Config: `COMMON_GROUND_URL` and `DISCOGS_URL` are required when `SAMPLE_FLOWS_ENABLED=true`;
  `loadConfig` refuses any host that is, or ends in, `discogs.com` or the Common Ground API
  host while no live switch exists (FR-013).
- **Alternatives**: mocks inside the api image (ships mock code); WireMock-style generic mock
  container (a Java image, Trivy surface, and fixtures outside our type checks).

## R17. Sample flows and mocks are development/CI only, and fail closed

- **Decision**: nothing in `.env.example` or the default compose stack turns the sample flows
  on. `docker-compose.yml` passes `SAMPLE_FLOWS_ENABLED` (default `false`),
  `DEPLOYMENT_ENVIRONMENT`, `COMMON_GROUND_URL` and `DISCOGS_URL` through from the shell, and the
  `mocks` service sits behind the profile `dev`. `make up-dev` sets
  `SAMPLE_FLOWS_ENABLED=true DEPLOYMENT_ENVIRONMENT=development` and the mock URLs and starts
  `--profile dev --profile observability`; the CI `stack` job does the same with
  `DEPLOYMENT_ENVIRONMENT=ci`. `loadConfig` treats an unset `DEPLOYMENT_ENVIRONMENT` as
  `production` and refuses to start when sample flows are on unless the environment is
  explicitly `development` or `ci`.
- **Rationale**: the sample route is unauthenticated and enqueues jobs. With these defaults a
  host started with `make up` (or with a copied `.env.example`) can't expose it, even once the
  tunnel exists, and mocks never run there (FR-013 asks for them only in development and CI).
- **Alternatives**: flag on in `.env.example` plus a documented "turn it off on the host"
  (fails open, as the reviewer pointed out); a separate override file (the constitution asks
  for profiles).

## R18. Counters start at zero; "no data" comes from counts **(check)**

- **Decision**: at startup the api and worker add 0 to every counter for every combination of its
  closed label values (`zeroInitialise()`), then force-flush the metric reader before they start
  serving or polling. `riviera.queue.depth` reports 0 for every registered job name with no queued
  rows. Dashboards decide "No data recorded yet" (FR-025) with a per-objective `hasData` query
  (total events in the 28-day window > 0), not by a series being absent.
- **Why**: Prometheus's `increase()` needs a sample before the first change. A counter series
  that first appears at 1 loses that first event, which for the checkout `paid_after_mismatch`
  SLO would hide exactly the violation it exists to catch. Zero samples also give FR-014's
  "counters exported from startup, starting at zero" (as clarified in
  ajmjj/riviera-digging-tool#10).
- **Limits**: a histogram can't be zero-initialised without an observation, so the first-ever
  observation of a new histogram series may be missed by `increase()`. With many observations
  this is noise; T014 also turns on Prometheus's created-timestamp zero ingestion for OTLP if the
  pinned version supports it, and documents what it found. `riviera.sync.last_success` is never
  zero-initialised (0 would read as 1970). These instruments are registered at startup and
  exported from their first observation, which is what the clarified FR-014 asks for
  (ajmjj/riviera-digging-tool#10).
- **Alternatives**: rely on Prometheus created-timestamp ingestion alone (version-dependent,
  and not verifiable until T014); PromQL workarounds such as `or` on the raw series (complex
  and easy to get wrong per panel).

## Also decided (no check needed)

- **Request ID header**: `X-Request-Id`; accepted if `^[A-Za-z0-9_-]{1,64}$`, else a fresh
  `crypto.randomUUID()`; echoed on every response (FR-003). Fastify's own `requestIdHeader` is
  turned off because it trusts the header unvalidated; `genReqId` validates instead.
- **Health routes** (spec clarification Q2, FR-007/FR-017): `/healthz` and `/readyz` produce
  no spans, no HTTP metric points and no per-request log lines; a failing check is still
  logged (healthchecks every 3 s would otherwise dominate the overview dashboard and the logs). The DB ping they run produces no span, because db spans
  are only created under an active span (FR-008 "while handling a request or job").
- **Route label**: the Fastify route template (`/sample/trace`), or `unmatched` for 404s.
- **Staff context**: `withStaff(request | job, staffId)` sets `staff_id` on the child logger
  and `riviera.staff_id` on the active span; staff IDs are opaque, `^[A-Za-z0-9_-]{1,64}$`,
  and anything email-shaped is rejected. 002 calls it after authentication; until then the
  tests use `staff_test_0001` (FR-004).
- **SLO window** (spec clarification Q3, FR-024): 28 days rolling; the dashboards' graphs follow the time picker,
  but the SLI and budget stat panels always use the 28-day window.
- **Migrations**: in-house runner (`apps/api/src/migrate.ts`, ~100 lines): numbered
  `NNNN_name.up.sql`/`.down.sql`, each in a transaction, under `pg_advisory_lock`, recorded
  in `schema_migration`. Both api and worker run it at start (idempotent). Alternative
  `node-pg-migrate`: fine, but another dependency and its own CLI conventions for what is
  today one table **(check)**.
- **Grafana access**: anonymous `Viewer` on 127.0.0.1 only; admin password from `.env`
  (`GRAFANA_ADMIN_PASSWORD`), default only in `.env.example`.
- **Spec clarifications**: `/speckit-clarify` ran on 2026-11-23 after this plan was first
  drafted (five questions, recorded in spec.md → Clarifications; a sixth, on FR-014, followed in
  ajmjj/riviera-digging-tool#10, which must merge before this plan). The answers confirmed R13's
  failure counting, the health-route exclusion and the 28-day window, tightened R15 to the
  clarified SC-006 rule and made R11 a spec requirement. The clarified spec goes to Antn
  for approval on its own (Human Checkpoint 2, ajmjj/riviera-digging-tool#8) before this
  plan is reviewed.
