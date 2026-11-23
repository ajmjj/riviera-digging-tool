---
description: "Task list for 001 Observability baseline"
---

# Tasks: Observability baseline

**Input**: Design documents from `specs/001-observability-baseline/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Required. The constitution (Principle IV) and FR-030…FR-033 make tests part of every
task: each task writes its tests first or together with its code, in the same PR, and names
requirements as `001/FR-###` in the test titles.

**One task = one PR** (constitution V): each task is sized to ≤ ~400 changed lines, excluding
`pnpm-lock.yaml`, generated code/dashboards and fixtures. The estimate is given as `~N lines`.
Every PR lists its task ID and FRs (`.github/pull_request_template.md`).

**fr-trace and `needs-human`**: until T024 merges, not every FR has a test, so every task PR
T001–T023 needs Antn's `approved-exception` for the untested-FR part of the check. A PR that asks
for an exception MUST carry `needs-human` (constitution II, Labels), so **every task PR T001–T023
is labelled `needs-human`**, and the human gate then also needs Antn's `human-approved` after its
last commit. Say both in each PR description. T024 is the first PR that must pass `fr-trace` with
no exception; it is still `needs-human` because it touches protected paths.

**Protected paths**: T001, T023 and T024 also touch `ci/protected-paths.json` paths; their PR
descriptions say which and why. No other task may touch a protected path; if one turns out to
need it, split that change into its own PR.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can be worked on in parallel with the other [P] tasks of the same phase once its
  listed dependencies have merged (disjoint files).
- **[Story]**: US1…US5 from spec.md.

---

## Phase 1: Setup

**Purpose**: the two new workspaces exist and the SLO registry makes `ci/slo-check.ts` real.

- [X] T001 Scaffold `packages/telemetry` (`@riviera/telemetry`) and `apps/mocks` (`@riviera/mocks`): `package.json` each, `tsconfig.json` each (protected), `knip.json` workspace entries (protected), `ci/typecheck.ts` projects for both workspaces (protected), `ci/scope.json` `entrypoints` += `apps/mocks/src/main.ts`, `packages/telemetry/src/dashboards/write.ts` (protected; the PR states that these thin entrypoints are thereby excluded from coverage, a possible loosening for Antn to judge); install **no new runtime or test dependencies here**: each package is added, at the exact version in plan.md Technical Context, by the task that first imports it (`fast-check` in T002; `@opentelemetry/api` and `sdk-metrics` in T003; the other OpenTelemetry packages in T004; `pino` as an explicit dependency in T005; `yaml` in T014), so knip passes on every PR without loosening `knip.json`. No Vitest or ESLint configuration change is needed either: `vitest.config.ts` already includes `apps/*/test` and `packages/*/test`, and ESLint's project service picks up each workspace `tsconfig.json`; `docker/api.Dockerfile` copies the telemetry package. Implement the registry `packages/telemetry/src/slo-metrics.ts` per data-model.md §3 (`InstrumentDef.name`, `.kind`, `.unit`, `.labels`, `.buckets`, `.slo`) with every instrument in contracts/telemetry.md#metrics and `SLO_METRIC_NAMES` derived from it, no runtime imports. Tests `packages/telemetry/test/slo-metrics.test.ts`: `SLO_METRIC_NAMES` (the names of the catalog instruments only, i.e. those with `slo` or `minimum` set; the four service instruments of R6 are in the registry but not in this list) equals `requiredMetrics(ci/slo-catalog.json)` exactly; bucket at each latency threshold; no forbidden label names; every registry entry is well-formed (kind, unit, closed labels). The export assertions live in T003 (instruments) and T016 (the real startup path), see "What exported means" below. **FR-014, FR-018** · `needs-human` · ~300 lines

**Checkpoint**: `node ci/slo-check.ts` reports all catalog metrics registered (SC-004).

**What "exported" means (FR-014, SC-004)**: research R18. At startup every counter is
initialised to 0 for each combination of its closed label values and the metric reader is
force-flushed before the api or worker starts serving, so every catalog counter is really
exported from the first moment and Prometheus has a 0 sample before the first event (otherwise
`increase()` would drop that first event). Histograms and `riviera.sync.last_success` can't be
zero-initialised and are exported from their first observation. "No data recorded yet" (FR-025)
is decided by event counts over the window, not by missing series. T003's test runs `createInstruments()` and
`zeroInitialise()` on an in-memory reader and checks every catalog counter is exported with value
0, then records one value through each histogram and gauge and checks those arrive too. T016's
test checks the real api/worker startup path flushes those zeros before it starts listening.
Histograms and `riviera.sync.last_success` are exported from their first observation, as the
clarified FR-014 states (ajmjj/riviera-digging-tool#10); the `001/FR-014` tests check exactly that.

---

## Phase 2: Foundational (blocks every story)

- [X] T002 [P] Redaction and truncation in `packages/telemetry/src/redact.ts` and `packages/telemetry/src/truncate.ts` per research R4 (key patterns, value patterns incl. emails, `Bearer`, `Discogs token=`, secret-named query params; 8192-byte limit with `…[truncated]` at a character boundary). Tests `packages/telemetry/test/redact.test.ts` with fast-check properties: a planted email/token/secret embedded anywhere in arbitrary JSON never survives, including values stored under camelCase, PascalCase, snake_case, kebab-case and UPPER_CASE secret names (`adminKey`, `commonGroundAdminKey`, `privateKey`, `accessKey`, `X-Api-Key`, `CLIENT_SECRET`); example tests that `keyboard`/`monkey` stay unredacted; redaction runs before truncation and the output is ≤ limit + marker even when redaction lengthens a value; non-sensitive data unchanged. Depends on T001. **FR-005, FR-006** · ~280 lines Adds `fast-check` (exact version, dev).
- [X] T003 [P] Typed recorders `createInstruments(meter)` in `packages/telemetry/src/instruments.ts` from the T001 registry: label parameters typed as the closed unions of data-model.md §3 `InstrumentDef.labels`, histogram views with `InstrumentDef.buckets`, observable gauge helper for `riviera.queue.depth` and `riviera.sync.last_success`, and `zeroInitialise()` that adds 0 to every counter for every combination of its closed label values (R18). Tests `packages/telemetry/test/instruments.test.ts` (in-memory reader): each recorder emits the contract name, unit and labels; an out-of-set label is a type error and a runtime rejection; after `zeroInitialise()` every counter/label combination is exported with value 0 and a later `add(1)` exports 1. Depends on T001. **FR-015, FR-016, FR-017, FR-018** · ~300 lines Adds `@opentelemetry/api` and `@opentelemetry/sdk-metrics` (exact versions).
- [X] T004 SDK bootstrap `packages/telemetry/src/sdk.ts` (resource per data-model.md §5, `AlwaysOnSampler`, W3C propagator, `AsyncLocalStorageContextManager`, OTLP/HTTP exporters only when an endpoint is given, batch processors and 5 s metric reader per R5, `shutdown()` with 2 s timeout), `packages/telemetry/src/export-guard.ts` (span redaction/truncation at export using T002; `DropWarning` limiter, one warning per minute, injected clock; `diag` routed to it) and the test harness `packages/telemetry/src/testing.ts` (in-memory span, metric and log exporters). Tests `packages/telemetry/test/sdk.test.ts`, `export-guard.test.ts`: no exporter when endpoint unset; failed exports warn once per minute; exported span attributes, events and status are redacted; sampler keeps a parent with sampled=0. Depends on T002. **FR-005, FR-019, FR-020, FR-023** · ~380 lines Adds the remaining OpenTelemetry packages of plan.md Technical Context (exact versions).
- [ ] T005 Structured logger `packages/telemetry/src/logger.ts` per research R3 and contracts/telemetry.md#logs: pino options (ISO `time`, label `level`, `service`, `env`, `msg`), `mixin` adding `trace_id`/`span_id`, redaction and truncation via `hooks.logMethod` and `formatters.log`, multistream to stdout plus the OTLP log bridge. Tests `packages/telemetry/test/logger.test.ts`: each line validates against `contracts/log-line.schema.json` (FR-001), carries trace/span IDs inside a span, is redacted and truncated, and the bridged OTLP record has the same body, severity and trace context. Switch `apps/api/src/app.ts` to these options. Depends on T002, T004. **FR-001, FR-005, FR-006** · ~350 lines Adds `pino` as an explicit dependency of `@riviera/telemetry` (same exact version Fastify bundles).
- [X] T006 [P] Config in `apps/api/src/config.ts`: `OTEL_EXPORTER_OTLP_ENDPOINT` (optional URL), `DEPLOYMENT_ENVIRONMENT` (`development` \| `ci` \| `production`; unset means `production`, so it fails closed), `SAMPLE_FLOWS_ENABLED` (default `false`), `COMMON_GROUND_URL` and `DISCOGS_URL` (required when sample flows are on; refuse `discogs.com`, its subdomains and the Common Ground API host per R16); refuse to start with `SAMPLE_FLOWS_ENABLED=true` unless `DEPLOYMENT_ENVIRONMENT` is **explicitly** `development` or `ci` (R17), so the unauthenticated sample route can never be live on the host behind the tunnel; `.env.example` documents every variable but sets none of the sample-flow ones (they come from `make up-dev` and CI, R17), leaves the endpoint empty per R9, and adds `GRAFANA_PORT` and `GRAFANA_ADMIN_PASSWORD`. Tests cover: unset environment + flag on → startup error; `production` + flag on → error; `development`/`ci` + flag on → ok. Tests in `apps/api/test/config.test.ts`. **FR-013, FR-019, FR-027** · ~200 lines
- [X] T007 [P] Migration runner `apps/api/src/migrate.ts` (numbered `.up.sql`/`.down.sql`, one transaction each, `pg_advisory_lock`, `schema_migration` table per data-model.md §2) and `apps/api/migrations/0001_job.up.sql`/`0001_job.down.sql` creating table `job` with every column, CHECK and the partial index of data-model.md §2 (`Job.id`, `Job.name`, `Job.payload`, `Job.status`, `Job.attempt`, `Job.max_attempts`, `Job.run_after`, `Job.locked_until`, `Job.origin_traceparent`, `Job.trace_parent`, `Job.staff_id`, `Job.last_error`, timestamps); `docker/api.Dockerfile` copies `apps/api/migrations`; api and worker run migrations at start from the tested `apps/api/src/startup.ts` (`main.ts` only calls it). Tests `apps/api/test/integration/migrate.int.test.ts`: every migration runs up, down and up again; concurrent runs don't conflict; CHECKs reject bad `status`/`max_attempts`/`staff_id`. **FR-029** · ~250 lines
- [ ] T008 Queue repository `apps/api/src/jobs/queue.ts` per research R12/R13 and the state transitions in data-model.md §2: `enqueue(name, payload, { maxAttempts, staffId })` creates the `job.enqueue` PRODUCER span and stores `Job.origin_traceparent`; `claim()` with `FOR UPDATE SKIP LOCKED` and the `Job.locked_until` lease, `heartbeat(id, attempt)`, and the expired-lease sweep of R12 (crashed attempt counted as failed; requeued only while `Job.attempt < Job.max_attempts`, else `failed`; clears `Job.trace_parent` when the crashed attempt is the one that set it, R13); `complete(id, attempt)` and `fail(id, attempt, error)`, both conditional on `id AND attempt AND status = 'running'` so a stalled worker whose lease was swept can't overwrite a newer attempt or record a second run (retry with `Job.run_after` backoff until `Job.max_attempts`, redacted `Job.last_error`); `queuedCounts()` for the depth gauge; job name registry with zod payload schemas validating `Job.name` and `Job.payload`. `staffId` is validated like `withStaff` (data-model.md §2 `Job.staff_id`, same rule as §1 `RequestContext.staffId`), and the CHECK `staff_id ~ '^[A-Za-z0-9_-]{1,64}$'` (shipped in T007's `0001_job` with the other data-model §2 CHECKs; T008 only tests it, it never edits an applied migration) backs that up, so an email can never reach a job row or a job log line. Tests `apps/api/test/integration/queue.int.test.ts`: every transition, two concurrent claimers never get the same job, an expired lease with attempts left is requeued and one with none left is marked `failed` without running again (both counted once as failed attempts), a heartbeat keeps a long job's lease, a stale worker's `complete`/`fail` after its lease was swept and the job re-claimed changes nothing and records no metric, producer span exists and its context is stored; without an active span `origin_traceparent` is null; an email-shaped `staffId` is rejected by `enqueue` and by the CHECK. Depends on T004, T007. **FR-004, FR-010, FR-029** · ~380 lines

**Checkpoint**: telemetry package, config, migrations and queue are in place; stories can start.

---

## Phase 3: User Story 1 — Follow one request end to end (P1) 🎯 MVP

**Goal**: the sample request is visible in Grafana as one trace (server → db, Common Ground,
enqueue), linked to its logs and request metrics.

**Independent test**: quickstart.md §2–3; automated by T016 (FR-030) and, against the stack, T023.

- [ ] T009 [US1] Request context `apps/api/src/http/request-context.ts`: `genReqId` validating `X-Request-Id` per data-model.md §1 `RequestContext.requestId` (Fastify `requestIdHeader` off), `X-Request-Id` on every response, `requestIdLogLabel: "request_id"`, and `withStaff(target, staffId)` validating `RequestContext.staffId` (rejects email-shaped values) and setting `staff_id` on the child logger and `riviera.staff_id` on the active span. Health routes log no per-request lines, but a failing health check (e.g. `/readyz` with the database unreachable) writes one warn line. Tests `apps/api/test/request-context.test.ts` via `app.inject()`: valid header echoed; missing, too long, control characters or invalid characters → generated UUID, never logged as sent; every log line of a request has its `request_id`; `withStaff` with `staff_test_0001`; `/healthz` and `/readyz` write no lines when healthy and one warn line when `/readyz` fails (`001/FR-007`). Depends on T005. **FR-002, FR-003, FR-004, FR-007** · ~250 lines
- [ ] T010 [US1] Fastify telemetry plugin `apps/api/src/http/telemetry-plugin.ts` per research R1 and contracts/telemetry.md#spans: SERVER span started in `onRequest` with `context.with(…, done)`, continued from a valid `traceparent`, named by route template (`RequestContext.route`, `unmatched` for 404s), status and duration recorded in `onResponse`, ERROR on 5xx; `riviera.http.server.duration` with `route`, `method`, `status_class`; no span and no metric for `/healthz`, `/readyz`. Tests `apps/api/test/telemetry-plugin.test.ts` with the T004 harness: span name/attributes, route template not raw path, valid/malformed/missing `traceparent`, health excluded, metric labels bounded (404 flood → one `unmatched` series). Depends on T003, T004, T009. **FR-007, FR-011, FR-017, FR-018** · ~350 lines
- [X] T011 [P] [US1] Traced queries in `apps/api/src/db.ts`: `query(summary, text, params)` creates a CLIENT span `db {operation}` with `db.system.name`, `db.operation.name`, `db.query.summary`, never parameter values, ERROR on failure, and **no span without an active parent** (so `/readyz` pings stay span-free). Tests `apps/api/test/integration/db.int.test.ts` (extend) and a unit test with a fake pool. Depends on T004. **FR-008** · ~180 lines
- [X] T012 [P] [US1] Mocks app per contracts/mocks.md: `apps/mocks/src/{server.ts,common-ground.ts,discogs.ts,control.ts,main.ts}`, fixtures `apps/mocks/fixtures/common-ground/SampleShopConfig.json`, `apps/mocks/fixtures/discogs/release-249504.json`; operation `packages/common-ground/operations/admin/SampleShopConfig.graphql` with `pnpm codegen` output committed; `docker/mocks.Dockerfile`; `mocks` service in `docker-compose.yml` behind the compose profile `dev` (R17; healthcheck, not published), so it never runs on the host's plain stack. Tests `apps/mocks/test/*.test.ts`: each route, `_mock/next` fail and 429 with `Retry-After`, reset, fixture contract test against the generated `SampleShopConfigQuery` type and the Discogs zod schema. Depends on T001. **FR-013** · ~380 lines (fixtures and generated code excluded)
- [ ] T013 [US1] Shared outbound client `apps/api/src/external/client.ts` (timeout, CLIENT span `{service} {operation}` with the attributes of contracts/telemetry.md#spans, `riviera.external.rate_limited` on 429, no bodies recorded, ERROR on failure; `riviera.external.calls` and `riviera.external.duration` by `service`, `operation`, `outcome`) and the two thin clients `apps/api/src/external/common-ground.ts` (`sampleShopConfig()` using the generated type) and `apps/api/src/external/discogs.ts` (`release(id)`). Tests `apps/api/test/external-client.test.ts` with a fake fetch: success, 500 → `failed`, 429 → `rate_limited` distinct from `failed`, timeout, `Authorization` never in attributes. Depends on T003, T004, T006, T012. **FR-012, FR-015** · ~330 lines
- [X] T014 [P] [US1] Compose profile `observability` in `docker-compose.yml` and config under `observability/` (`otel-collector.yaml`, `loki.yaml`, `tempo.yaml`, `prometheus.yaml`) per research R7, R8, R10: core collector (OTLP in; memory_limiter, batch; Loki `/otlp`, Tempo OTLP, Prometheus OTLP out), every image pinned by tag and digest, healthchecks (derived `docker/*.Dockerfile` with static busybox, its source image pinned by tag and digest, only where an image lacks a probe), ports bound to `127.0.0.1` only, no `depends_on` from app services, retention per R10, named volumes; `Makefile` targets `up-observability` (sets `OTEL_EXPORTER_OTLP_ENDPOINT` per R9), `up-dev` (profiles `dev` + `observability` with the sample-flow variables of R17) and `down-observability`. Tests `apps/api/test/compose.test.ts` (reads YAML with `yaml`): profile name, every observability service has a healthcheck, every published port starts with `127.0.0.1:`, no app service depends on an observability service, `mocks` is only in profile `dev`, the api/worker sample-flow variables default to off/empty in compose, collector pipelines cover traces, metrics and logs, no sampling processor. Depends on T001. **FR-021, FR-023** · ~380 lines Adds `yaml` (exact version, dev).
- [X] T015 [US1] Grafana provisioning `observability/grafana/provisioning/datasources/datasources.yaml` (uids `prometheus`, `loki`, `tempo`; Tempo `tracesToLogsV2` by trace ID, `tracesToMetrics` with the http and job queries; Loki derived field from structured metadata `trace_id` → Tempo) and `observability/grafana/provisioning/dashboards/dashboards.yaml` (folders "SLOs" and "Service"), Grafana service in the profile (anonymous Viewer, admin password from `.env`, 127.0.0.1:`${GRAFANA_PORT:-3300}`). Tests `apps/api/test/grafana-provisioning.test.ts`: the three links exist and point at the right uids; no manual setup needed. Depends on T014. **FR-022** · ~220 lines
- [ ] T016 [US1] Sample request `apps/api/src/sample/routes.ts` per contracts/http.md (`POST /sample/trace`, registered only when `SAMPLE_FLOWS_ENABLED`): db count, Common Ground `sampleShopConfig()`, `enqueue("sample.discogs_release", …)`, `202` body with `requestId`, `traceId`, `jobId`; `502` without enqueue on Common Ground failure. Wire telemetry, plugin, db, clients and queue in `apps/api/src/app.ts` and the tested `apps/api/src/startup.ts` (`startApi()`/`startWorker()`; `main.ts` stays a one-line call) (`zeroInitialise()` and a metric force-flush before `listen`, R18; test `apps/api/test/integration/startup.int.test.ts`: migrations, then zero initialisation and flush, then listen, in that order, and every catalog counter reaches the in-memory exporter as 0 before the first request is served); api env in `docker-compose.yml` as passthroughs that default to off/empty (`SAMPLE_FLOWS_ENABLED: ${SAMPLE_FLOWS_ENABLED:-false}`, mock URLs, `DEPLOYMENT_ENVIRONMENT`, endpoint), set only by `make up-dev` and CI (R17). Tests `apps/api/test/integration/sample-request.int.test.ts` (real Postgres, fake mocks fetch, in-memory exporters): span tree server → `db SELECT`, `common_ground SampleShopConfig`, `job.enqueue`; one log line with `request_id` and `trace_id`; HTTP and external metric points moved; route absent when the flag is off. Depends on T008, T010, T011, T013. **FR-027, FR-030** · ~350 lines

**Checkpoint**: US1 works end to end with `make up-dev` (quickstart §3; the overview
panels of US1-4 arrive with T020).

---

## Phase 4: User Story 2 — Follow one background job end to end (P1)

**Goal**: the sample job runs in the worker, traced (job → Discogs), linked to the request, with
job logs and job metrics.

**Independent test**: quickstart.md §4; automated by T018 (FR-031) and T023.

- [ ] T017 [US2] Job runner `apps/api/src/jobs/runner.ts` per research R13 and contracts/telemetry.md: poll loop (500 ms idle) on `claim()`, with a 30 s heartbeat while a job runs; CONSUMER span `job.run {name}` (attempt 1 root with link to `Job.origin_traceparent`, storing `Job.trace_parent`; later attempts children of it, also linked) with `riviera.job.*` attributes and ERROR on failure; child logger with `job_id`, `job_name`, `attempt`, `staff_id` (from `Job.staff_id`); `riviera.jobs.runs`, `riviera.jobs.duration`, `riviera.jobs.failures` (once per failed attempt); `riviera.queue.depth` observable from `queuedCounts()` registered in both api and worker, reporting 0 for every registered job name with no queued rows; graceful stop on SIGTERM. Tests `apps/api/test/integration/runner.int.test.ts` with a test job: success, failure then retry (same trace, new span, failures +1 each), no-origin job starts its own trace, a retry after a crashed first attempt starts a new root (linked to the producer) instead of an orphan child, depth gauge values, including 0 for a job name once its queue drains. Depends on T003, T005, T008. **FR-002, FR-009, FR-010, FR-016** · ~380 lines
- [ ] T018 [US2] Sample job `apps/api/src/sample/job.ts` (`sample.discogs_release`: Discogs `release(id)`, then throws on purpose when `fail` is set; enqueued with `max_attempts = 1` in fail mode) and worker wiring in `apps/api/src/startup.ts` (`startWorker()`) and `docker-compose.yml` (worker env). Tests `apps/api/test/integration/sample-job.int.test.ts`: request → job end to end with in-memory exporters: job span tree (`job.run` → `discogs GET /releases/{id}`), link to the enqueuing request's producer span, log lines with `job_id`, `job_name`, `trace_id`, job metrics; fail mode: error span, one error log line with `job_id`, `riviera.jobs.failures` +1. Depends on T013, T016, T017. **FR-028, FR-031** · ~280 lines

**Checkpoint**: US1 and US2 both work end to end (quickstart §3–4).

---

## Phase 5: User Story 4 — Telemetry never leaks personal data or secrets (P1)

**Goal**: across real requests and jobs, no planted secret reaches stdout, exported logs or spans.

**Independent test**: quickstart.md §6; automated by T019.

- [ ] T019 [US4] End-to-end redaction suite `apps/api/test/integration/redaction.int.test.ts`: sample requests and jobs whose headers (`Authorization: Bearer …`, `Cookie`), body, query string (`?token=…`), job payload, staff context and thrown error messages contain planted emails, tokens, cookies and secret-named fields; captures stdout and the in-memory span and log exporters and asserts zero occurrences (SC-005), redaction markers present, only `staff_test_0001` as staff identity. Build the planted secret-shaped values at runtime (e.g. by joining parts) so no secret-shaped literal is committed and gitleaks stays green without an allowlist change. Fix any leak found in the owning module in the same PR. Depends on T016, T018. **FR-004, FR-005, FR-032** · ~250 lines

---

## Phase 6: User Story 3 — See every SLO on its own dashboard (P2)

**Goal**: seven SLO dashboards and one service overview, generated, provisioned, "No data
recorded yet" until data exists.

**Independent test**: quickstart.md §5; automated by T021 (generation) and T023 (provisioned,
empty, then filled).

- [ ] T020 [US3] Dashboard builders `packages/telemetry/src/dashboards/build.ts` (panel/stat/timeseries helpers, OTel→Prometheus name translation per R7 with unit tests, `noValue: "No data recorded yet"`) and the thin CLI `packages/telemetry/src/dashboards/write.ts` (`make dashboards`); generate `observability/grafana/dashboards/service/overview.json` (its own directory: the "Service" provider of T015 scans its path recursively, so it can't be the parent of `slo/`): request rate, errors and latency per route; job runs, failures and queue depth (`max by (job_name)`); Common Ground and Discogs calls by outcome. Tests `packages/telemetry/test/dashboards-overview.test.ts`: panels present, every query names only registered metrics, committed JSON equals generator output. Depends on T003, T015. **FR-026** · ~330 lines (generated JSON excluded)
- [ ] T021 [US3] SLO dashboards: `packages/telemetry/src/dashboards/slo-queries.ts` (per data-model.md §4 `SloDashboard.id`, `.objectives`, `.budget`, `.noData`; SLIs of contracts/telemetry.md#slis over 28 days) and generation of `observability/grafana/dashboards/slo/<id>.json` (UID `slo-<id>`, title = catalog `name`, target, SLI, remaining budget, graph). Tests `packages/telemetry/test/dashboards-slo.test.ts`: ids equal catalog ids (exactly seven), every queried metric is in that SLO's catalog `metrics`, every stat panel has the no-data text, budget formula on worked examples, including the 100%-target rule (count 0 → 100%, count ≥ 1 → 0%, never NaN or ±Inf), a counter series that goes 0 → 1 (the first event is counted, R18), and the data rule (no events in the window → "No data recorded yet"; paid checkouts with zero mismatches → 100%), committed JSON equals generator output. Depends on T020. **FR-024, FR-025** · ~350 lines (generated JSON excluded)

**Checkpoint**: Grafana shows the "SLOs" folder with seven dashboards and the overview (SC-003).

---

## Phase 7: User Story 5 — Telemetry problems never break the tool (P2)

**Goal**: without the profile, or with the collector down, the tool behaves normally.

**Independent test**: quickstart.md §7; automated by T022 and, against the stack, T024.

- [ ] T022 [US5] Resilience tests `apps/api/test/integration/telemetry-resilience.int.test.ts`: real OTLP exporters pointed at a closed 127.0.0.1 port; 200 sample requests and jobs all succeed, request latency is not held by export, at most one drop warning per minute (fake clock), shutdown completes within its timeout; with no endpoint, JSON logs still go to stdout and no exporter is created. Add a "Observability" section to `README.md` linking quickstart.md. Depends on T016, T018. **FR-019, FR-020** · ~220 lines

---

## Phase 8: Polish & CI end-to-end check

- [ ] T023 End-to-end observability check per research R14: `ci/lib/obs-check.ts` (Tempo trace lookup and span-tree assertions, Loki query by `trace_id`, Prometheus series checks, Grafana `/api/search` and `/api/ds/query`, SLO sample emission over OTLP as two points per series with an increase between them, at least one export interval apart (R14 step 4), 30 s polling), `ci/obs-check.ts` (thin CLI; `--emit-slo-samples`) and `ci/test/obs-check.test.ts` with a fake fetch for each step and each failure message. Depends on T018, T021. **FR-033** · `needs-human` (ci/) · ~400 lines
- [ ] T024 Wire the check into the `stack` job of `.github/workflows/ci.yml` per R14/R15: plain stack + smoke (US5-1); `--profile dev --profile observability` up with the endpoint and the sample-flow variables of R17 (`DEPLOYMENT_ENVIRONMENT=ci`) within `composeStartupSeconds` (SC-007); `node ci/obs-check.ts`; latency baseline; `docker compose stop otel-collector`; smoke and latency again (SC-006); Trivy over `docker compose --profile dev --profile observability config --images` (R11); `docker compose --profile dev --profile observability down --volumes`. Add `ci/lib/latency.ts` with `ci/test/latency.test.ts` (p95 and the SC-006 rule: ≤ max(1.10 × baseline, baseline + 5 ms)) and update the `ci/slo-check.ts` header comment. This is the last task: `fr-trace` must pass with no exception. Depends on T022, T023. **FR-021, FR-033** · `needs-human` (.github/, ci/) · ~250 lines

---

## Requirement coverage

| FR | Tasks | FR | Tasks | FR | Tasks |
|---|---|---|---|---|---|
| FR-001 | T005 | FR-012 | T013 | FR-023 | T004, T014 |
| FR-002 | T009, T017 | FR-013 | T006, T012 | FR-024 | T021 |
| FR-003 | T009 | FR-014 | T001 | FR-025 | T021 |
| FR-004 | T008, T009, T019 | FR-015 | T003, T013 | FR-026 | T020 |
| FR-005 | T002, T004, T005, T019 | FR-016 | T003, T017 | FR-027 | T006, T016 |
| FR-006 | T002, T005 | FR-017 | T003, T010 | FR-028 | T018 |
| FR-007 | T009, T010 | FR-018 | T001, T003, T010 | FR-029 | T007, T008 |
| FR-008 | T011 | FR-019 | T004, T006, T022 | FR-030 | T016 |
| FR-009 | T017 | FR-020 | T004, T022 | FR-031 | T018 |
| FR-010 | T008, T017 | FR-021 | T014, T024 | FR-032 | T002, T019 |
| FR-011 | T010 | FR-022 | T015 | FR-033 | T023, T024 |

Success criteria: SC-001/002 → T023 (30 s polling); SC-003 → T015, T020, T021, T023; SC-004 →
T001; SC-005 → T019; SC-006 → T024; SC-007 → T024.

---

## Dependencies & execution order

```text
T001 ─┬─ T002 ─ T004 ─┬─ T005 ─ T009 ─ T010 ─┐
      │               ├─ T011 ───────────────┤
      ├─ T003 ────────┼──────────────────────┼─ T016 ─┐
      │        T007 ──┴─ T008 ───────────────┤        ├─ T018 ─┬─ T019
      ├─ T006 ─┐                             │        │        ├─ T022 ─┐
      ├─ T012 ─┴──────── T013 ───────────────┘        │        │        ├─ T024
      │   T003 + T005 + T008 ──── T017 ───────────────┘        │        │
      └─ T014 ─ T015 ─ T020 ─ T021 ───────────────── T023 ─────┴────────┘
```

Arrows are a summary; each task's own "Depends on" list is authoritative (for example T013
needs T003, T004, T006 and T012; T017 needs T003, T005 and T008).

- **Setup (T001)** first; it unblocks everything.
- **Foundational**: T002, T003, T006, T007 in parallel; T004 after T002; T005 after T004; T008
  after T004 and T007.
- **US1**: T011, T012, T014 can start as soon as their dependencies merge, in parallel with the
  rest of Phase 2. T016 closes US1.
- **US2** needs US1's T016 (the job is enqueued by the sample request).
- **US4** (T019) and **US5** (T022) need US1 and US2; they can run in parallel.
- **US3** depends only on T003 and the Grafana provisioning (T015), so T020–T021 can run in
  parallel with US1/US2 code work.
- **T023** needs T018 and T021; **T024** is last.

## Parallel examples

```text
After T001:          T002 · T003 · T006 · T007 · T012 · T014
After T004:          T011 (alongside T005, T008)
After T015 + T003:   T020 → T021 (alongside T009–T013, T016–T018)
After T016 + T018:   T019 · T022
```

## Implementation strategy

- **MVP = Phase 1 + Phase 2 + US1** (T001–T016): one request is followable end to end in Grafana
  and by tests. Validate with quickstart §2–3 before moving on.
- **Then US2** (T017–T018), so the two P1 acceptance flows in the feature request are complete.
- **Then US4** (T019) — P1, the leak suite — and **US3/US5** (T020–T022).
- **Last, CI** (T023–T024): the stack-level check and the workflow wiring, after which
  `fr-trace` passes on its own and the feature is done.
