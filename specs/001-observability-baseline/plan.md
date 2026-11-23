# Implementation Plan: Observability baseline

**Branch**: `claude/laughing-mendel-hmlr0n` (feature directory `specs/001-observability-baseline`) |
**Date**: 2026-11-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-observability-baseline/spec.md`

## Summary

Put the telemetry pipeline in place before any business feature exists. The api and the worker
(one image, two commands) get hand-written OpenTelemetry instrumentation: a Fastify plugin for
request IDs, server spans and HTTP metrics; a traced query wrapper for Postgres; one shared
outbound client for Common Ground and Discogs; a minimal Postgres-backed job queue whose job runs
are traced and linked to the request that enqueued them. Logs stay pino JSON on stdout and are
also bridged to OTLP. A redaction and truncation layer sits in front of every log line and every
exported span. All SLO metrics from `ci/slo-catalog.json` are registered at startup from one
registry (`packages/telemetry/src/slo-metrics.ts`), which turns `ci/slo-check.ts` from "passes
trivially" into a real check.

A Compose profile `observability` adds the OpenTelemetry Collector, Loki, Tempo, Prometheus and
Grafana, bound to 127.0.0.1, with data sources, trace↔log↔metric links, seven SLO dashboards
(generated from the catalog) and one service overview dashboard provisioned on first start. A
sample request and a sample job (behind `SAMPLE_FLOWS_ENABLED`, development and CI only, R17)
exercise the whole path against local Common Ground and Discogs mocks (compose profile `dev`), and a CI script confirms through Tempo, Loki, Prometheus
and Grafana's own APIs that both traces, their logs and their metrics arrived.

Design decisions and their alternatives are in [research.md](./research.md); entities, metric
definitions and the job table in [data-model.md](./data-model.md); the external interfaces in
[contracts/](./contracts/); the end-to-end check in [quickstart.md](./quickstart.md).

## Technical Context

**Language/Version**: TypeScript 6.0 on Node ≥ 22.18 (type stripping, no build step), as today.

**Primary Dependencies** (exact versions, pinned at install time; current at planning):

- Existing: Fastify 5.12.8 (bundles pino 10.4.0), pg 8.23.1, zod 4.6.7.
- OpenTelemetry: `@opentelemetry/api` 1.10.0, `@opentelemetry/api-logs` 0.223.0,
  `@opentelemetry/sdk-trace` 3.1.1 (successor of the deprecated `sdk-trace-base`/`-node`),
  `@opentelemetry/sdk-metrics` 3.1.1, `@opentelemetry/sdk-logs` 3.1.1,
  `@opentelemetry/context-async-hooks` 3.1.1, `@opentelemetry/core` 3.1.1,
  `@opentelemetry/resources` 3.1.1, `@opentelemetry/semantic-conventions` 1.45.0, and the three
  OTLP/HTTP exporters (`exporter-{trace,metrics,logs}-otlp-http` 0.301.2).
- New dev dependencies: `fast-check` 4.11.0 (first property test: redaction), `yaml` 2.9.1
  (tests that read `docker-compose.yml` and the collector/Grafana configs).
- No auto-instrumentation packages (see research R1).

**Storage**: Postgres (compose: 19-alpine, CI test DB: 18-alpine). New table `job` and a
`schema_migration` bookkeeping table. Telemetry storage is Loki, Tempo and Prometheus on
named volumes inside the profile, discarded by `docker compose down --volumes`.

**Testing**: Vitest (unit; `*.int.test.ts` against real Postgres), fast-check for redaction,
in-memory span/metric/log exporters for FR-030/031/032, a Node script against the running
stack for FR-033 (`ci/obs-check.ts`, logic in `ci/lib/obs-check.ts` with unit tests).

**Target Platform**: Linux containers via Docker Compose on Antn's machine and on the GitHub
`ubuntu-24.04` runner.

**Project Type**: Web service (api + worker) with a PWA; this feature touches only the backend,
a new mocks service and the Compose stack.

**Performance Goals**: Sample request and job visible in Grafana within 30 s (SC-001/002):
metric export interval 5 s, batch span/log export delay 1 s locally. Telemetry overhead on the
sample request p95 with the collector stopped ≤ max(110%, +5 ms) of the running p95 (SC-006).

**Constraints**: No `as` casts, no `any`, no suppressions; exact versions; health endpoints
produce no spans; telemetry export never blocks a request or job; at most one dropped-telemetry
warning per minute; every observability service healthy within 120 s and bound to 127.0.0.1;
no real Common Ground or Discogs host is ever contacted.

**Scale/Scope**: One shop, a handful of staff, tens of requests per minute. Metric label sets
are fixed enumerations (route templates, job names, services, outcomes), so cardinality is
bounded by code, not by data.

No open `NEEDS CLARIFICATION`: every unknown is resolved in research.md.

## Constitution Check

*GATE: checked before Phase 0 and again after Phase 1 design. Both pass.*

| Principle / gate | How this plan complies | Status |
|---|---|---|
| I. CI is the only path to `main` | Every task is its own PR through the existing required checks. The FR-033 check is added as steps of the existing `stack` job, so no new required check name appears and nothing is skipped. | ✅ |
| II. Never weaken the safety net | No threshold, suppression or ruleset change. Protected paths touched by implementation tasks: `**/tsconfig*.json`, `knip.json`, `ci/scope.json` (T001), `ci/**` and `.github/workflows/ci.yml` (T023, T024). Every task PR is labelled `needs-human` (T001–T023 ask for the fr-trace exception; T001, T023, T024 touch protected paths). T001 states that adding entrypoints to `ci/scope.json` takes those thin files out of coverage, so Antn can judge it as a possible loosening. This plan PR touches only `specs/` and is `needs-human` because it asks for the fr-trace exception. `ci/slo-catalog.json` is unchanged (research R6). | ✅ |
| III. Spec first, fully traceable | Every task names the FRs it covers; every FR-001…FR-033 is covered by at least one task with a `001/FR-###` test (matrix in tasks.md). Task PRs before the last need Antn's `approved-exception` for the untested-FR part of `fr-trace`; each PR says so. | ✅ |
| IV. Tests lead | Each task writes its tests with the code. Redaction gets property tests (fast-check). No domain code in this feature, so mutation testing stays a no-op; the queue is infrastructure, not one of the listed domain areas. | ✅ |
| V. Small PRs | 24 tasks, each sized ≤ ~400 changed lines excluding lockfile, generated dashboards JSON and fixtures (estimates in tasks.md). | ✅ |
| VI. No live side effects | Common Ground and Discogs only via the local mocks service; config refuses the real hosts (FR-013). The only Common Ground call is a read (`config { shopName }`), so `COMMON_GROUND_WRITES_ENABLED` is not involved. | ✅ |
| VII. Traces, metrics, logs | This feature *is* Principle VII: stack, profile, `staff_id` context, JSON logs with CI-tested redaction, spans on HTTP/jobs/outbound calls, the minimum metrics, catalog check made real, emission tests. `/healthz` and `/readyz` stay as they are. | ✅ |
| VIII. Product invariants | Secrets: no secret enters telemetry (FR-005, US4), the PWA is untouched. Isolation: staff IDs never become metric labels. Other invariants untouched. | ✅ |
| Stack and delivery order | TypeScript, pnpm workspaces, Fastify api and worker in one image, Postgres, OTel → Collector → Loki/Tempo/Prometheus → Grafana; 001 before 002. | ✅ |
| Quality gates | Coverage ≥ 90% overall applies to the two new workspaces; thin entrypoints are added to `ci/scope.json` `entrypoints` (T001, protected). Trivy now also scans the observability images (R11). | ✅ |

**Post-design re-check**: still passes. The design adds two workspaces (`packages/telemetry`,
`apps/mocks`); see Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-observability-baseline/
├── spec.md
├── plan.md              # this file
├── research.md          # Phase 0: decisions R1–R18
├── data-model.md        # Phase 1: request context, job, metric registry, SLO dashboards
├── quickstart.md        # Phase 1: run and verify end to end
├── contracts/
│   ├── http.md          # request ID header, trace context, sample endpoint
│   ├── telemetry.md     # span names/attributes, metric names/labels/units, log fields
│   ├── log-line.schema.json
│   └── mocks.md         # Common Ground and Discogs mocks, control endpoint
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
packages/telemetry/                 # NEW workspace @riviera/telemetry
├── src/
│   ├── slo-metrics.ts              # registry: SLO_METRIC_NAMES + every instrument definition (no runtime imports)
│   ├── instruments.ts              # createInstruments(meter): typed recorders with bounded labels
│   ├── redact.ts                   # key- and value-based redaction
│   ├── truncate.ts                 # 8 KB limit with marker
│   ├── sdk.ts                      # startTelemetry(): providers, resource, sampler, OTLP exporters
│   ├── export-guard.ts             # exporter wrapper: redact spans, rate-limited failure warning
│   ├── logger.ts                   # pino options + OTLP log bridge stream
│   ├── testing.ts                  # in-memory exporters harness for tests
│   └── dashboards/
│       ├── slo-queries.ts          # PromQL per SLO id (SLI, budget), checked against the catalog
│       ├── build.ts                # Grafana dashboard JSON builders
│       └── write.ts                # thin CLI: regenerate observability/grafana/dashboards/**
└── test/

apps/api/src/                       # existing; api and worker
├── app.ts                          # registers telemetry plugin, sample routes when enabled
├── config.ts                       # + OTEL_EXPORTER_OTLP_ENDPOINT, DEPLOYMENT_ENVIRONMENT, SAMPLE_FLOWS_ENABLED, COMMON_GROUND_URL, DISCOGS_URL
├── db.ts                           # + traced query()
├── migrate.ts                      # NEW: SQL up/down runner under an advisory lock
├── http/request-context.ts         # NEW: request ID, staff context
├── http/telemetry-plugin.ts        # NEW: server spans, HTTP metrics, log bindings
├── external/client.ts              # NEW: shared outbound layer (span, metrics, 429)
├── external/common-ground.ts       # NEW: sample read operation
├── external/discogs.ts             # NEW: sample release lookup
├── jobs/queue.ts                   # NEW: enqueue / claim / complete / fail (SKIP LOCKED)
├── jobs/runner.ts                  # NEW: worker loop, job spans, job metrics, queue depth
├── sample/routes.ts                # NEW: POST /sample/trace (flagged)
├── sample/job.ts                   # NEW: sample.discogs_release job
└── main.ts                         # wiring only (excluded from coverage)
apps/api/migrations/0001_job.{up,down}.sql   # NEW

apps/mocks/                         # NEW workspace @riviera/mocks (own image, compose profile `dev`)
├── src/{server.ts,common-ground.ts,discogs.ts,control.ts,main.ts}
├── fixtures/{common-ground,discogs}/*.json
└── test/

packages/common-ground/operations/admin/SampleShopConfig.graphql   # NEW, codegen output regenerated

observability/                      # NEW: config mounted by the compose profile
├── otel-collector.yaml
├── loki.yaml
├── tempo.yaml
├── prometheus.yaml
└── grafana/
    ├── provisioning/{datasources,dashboards}/*.yaml
    └── dashboards/{slo/*.json,overview.json}   # generated by packages/telemetry/src/dashboards/write.ts

docker-compose.yml                  # + profile `dev` (mocks); + profile `observability` services; sample-flow env passthroughs default off
docker/mocks.Dockerfile             # NEW
docker/api.Dockerfile               # + telemetry package, migrations
Makefile                            # + up-observability, up-dev, down-observability, dashboards
ci/obs-check.ts, ci/lib/obs-check.ts, ci/test/obs-check.test.ts   # NEW (protected)
.github/workflows/ci.yml            # stack job: observability steps (protected)
```

**Structure Decision**: keep the existing pnpm workspace layout. Telemetry is a package
because the catalog already names its registry path (`packages/telemetry/src/slo-metrics.ts`)
and because 002+ features and the worker share it. The mocks are a separate app and image so
no mock code ships in the api image. Observability configuration lives in a top-level
`observability/` directory, mounted read-only by the profile's services.

## Delivery and review notes

- **PR sequence**: tasks.md lists 24 tasks in dependency order; [P] marks tasks that touch
  disjoint files and can be opened in parallel once their dependencies merge.
- **Protected-path PRs**: T001 (workspace tsconfigs, `knip.json`, `ci/scope.json`
  entrypoints), T023 (`ci/obs-check.ts` and its lib/tests), T024
  (`.github/workflows/ci.yml` stack job). Nothing else touches a protected path.
- **fr-trace**: every task PR until the last one fails the untested-FR part and needs
  Antn's `approved-exception`; the final task (T024) is the first PR where all 33 FRs are
  tested and `fr-trace` must pass without an exception.
- **`needs-human`**: every PR that asks for an exception carries `needs-human`
  (constitution II), so T001–T023 all do, as does T024 for its protected paths. Each needs
  Antn's `human-approved` after its last commit.
- **slo-check**: becomes real in T001, the moment the registry file exists.

## Complexity Tracking

| Addition | Why needed | Simpler alternative rejected because |
|---|---|---|
| New workspace `packages/telemetry` | The catalog fixes the registry path there; api, worker and the dashboard generator all use it; `ci/slo-check.ts` imports it directly. | Putting it in `apps/api/src` would mean changing the protected catalog's `registry` path and mixing the generator into the app. |
| New workspace and image `apps/mocks` | FR-013 needs mock services that answer over HTTP inside the stack and can be told to fail or 429. | A third role in the api image would ship mock code in the production image and blur the "never contact real hosts" boundary. |
| Hand-written instrumentation instead of auto-instrumentation | Node runs TypeScript via type stripping as native ESM; auto-instrumentation of `pg` and Fastify needs ESM loader hooks (`import-in-the-middle`) and produces spans we would then have to filter. | Auto-instrumentation: extra loader flags in the image, fragile under ESM, less control over exactly which spans exist (FR-007 health exclusion, FR-008 no parameters, FR-012 one client layer). See R1. |
