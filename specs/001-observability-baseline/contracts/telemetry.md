# Contract: telemetry signals

What the api and worker emit. Tests (FR-030/031/032) and the dashboards depend on these names;
changing one is a contract change.

## Resource (all signals)

| Attribute | Value |
|---|---|
| `service.name` | `riviera-api` or `riviera-worker` |
| `service.namespace` | `riviera` |
| `service.version` | `apps/api/package.json` version |
| `deployment.environment.name` | `DEPLOYMENT_ENVIRONMENT` (`development` default, `ci` in CI) |

## Spans

| Span name | Kind | Parent | Attributes (never request/response bodies, never parameter values) | Requirement |
|---|---|---|---|---|
| `{METHOD} {route}` e.g. `POST /sample/trace` | SERVER | incoming `traceparent` or root | `http.request.method`, `http.route`, `http.response.status_code`, `url.scheme`, `riviera.request_id`, `riviera.staff_id`? | FR-007, FR-011 |
| `db {operation}` e.g. `db SELECT` | CLIENT | active span (none → no span) | `db.system.name=postgresql`, `db.operation.name`, `db.query.summary` (statement name, not the text with values) | FR-008 |
| `{service} {operation}` e.g. `common_ground SampleShopConfig`, `discogs GET /releases/{id}` | CLIENT | active span | `riviera.external.service` (`common_ground`\|`discogs`), `riviera.external.operation`, `http.request.method`, `http.response.status_code`, `riviera.external.rate_limited` (bool), `server.address` | FR-012 |
| `job.enqueue {job_name}` | PRODUCER | active span | `riviera.job.name`, `riviera.job.id` | FR-010 |
| `job.run {job_name}` | CONSUMER | attempt 1: root, link → producer; attempt n: child of attempt 1, link → producer | `riviera.job.name`, `riviera.job.id`, `riviera.job.attempt`, `riviera.job.outcome` (`succeeded`\|`failed`), `riviera.staff_id`? | FR-009, FR-010 |

Status: `ERROR` on 5xx server spans, failed db queries, failed or rate-limited outbound calls,
and failed job attempts (with a recorded, redacted exception event). Attribute values pass
through `redact()` and the 8 KB `truncate()` at export (FR-005, FR-006).

## Metrics

OTel name → Prometheus name after OTLP translation (research R7). All labels are closed sets
(FR-018).

### Minimum and service metrics (FR-015, FR-016, FR-017)

| OTel name | Kind, unit | Labels | Prometheus |
|---|---|---|---|
| `riviera.http.server.duration` | histogram, s; buckets .005 .01 .025 .05 .1 .25 .3 .5 1 2.5 5 | `route`, `method`, `status_class` (`1xx`…`5xx`) | `riviera_http_server_duration_seconds_*` |
| `riviera.external.calls` | counter, `{call}` | `service`, `operation`, `outcome` (`success`\|`failed`\|`rate_limited`) | `riviera_external_calls_total` |
| `riviera.external.duration` | histogram, s; buckets .05 .1 .25 .5 1 2.5 5 10 | `service`, `operation`, `outcome` | `riviera_external_duration_seconds_*` |
| `riviera.jobs.runs` | counter, `{run}` | `job_name`, `outcome` (`succeeded`\|`failed`) | `riviera_jobs_runs_total` |
| `riviera.jobs.duration` | histogram, s; buckets .01 .05 .1 .5 1 5 10 30 60 300 | `job_name`, `outcome` | `riviera_jobs_duration_seconds_*` |
| `riviera.jobs.failures` | counter, `{failure}` | `job_name` | `riviera_jobs_failures_total` |
| `riviera.queue.depth` | gauge (observable), `{job}` | `job_name` | `riviera_queue_depth` |

`riviera.queue.depth` is observed by both the api and the worker at each export (one
`SELECT name, count(*) FROM job WHERE status = 'queued' GROUP BY name`, no span because no span
is active), so it stays visible while the worker is down; dashboards take `max by (job_name)`.

### SLO metrics (catalog, FR-014; recorded by later features)

| OTel name | SLO | Kind, unit | Labels | Bucket at threshold |
|---|---|---|---|---|
| `riviera.verdict.requests` | verdict-saved | counter, `{request}` | `outcome` (`success`\|`error`) | – |
| `riviera.verdict.duration` | verdict-saved | histogram, s | – | 0.3 |
| `riviera.dig.next_record.duration` | next-record-ready | histogram, s | – | 0.5 |
| `riviera.sync.runs` | inventory-freshness | counter, `{run}` | `kind` (`full`\|`light`), `outcome` (`success`\|`failed`) | – |
| `riviera.sync.duration` | inventory-freshness | histogram, s | `kind` | – |
| `riviera.sync.last_success` | inventory-freshness | gauge, s (Unix time) | `kind` | – |
| `riviera.pile.sold_removal.delay` | sold-record-removal | histogram, s | – | 1200 |
| `riviera.checkout.started` | staff-checkout-correctness | counter, `{checkout}` | – | – |
| `riviera.checkout.finished` | staff-checkout-correctness | counter, `{checkout}` | `outcome` (`paid`\|`stopped_safely`\|`failed`) | – |
| `riviera.checkout.mismatches` | staff-checkout-correctness | counter, `{checkout}` | – | – |
| `riviera.checkout.paid_after_mismatch` | staff-checkout-correctness | counter, `{checkout}` | – | – |
| `riviera.audio.resolutions` | audio-resolvable | counter, `{record}` | `source` (`cg_snippet`\|`discogs_video`), `outcome` (`playable`\|`unplayable`) | – |
| `riviera.notification.delivery.delay` | notification-delivery | histogram, s | – | 300 |

Label values for later features are proposals; the feature that records a metric may extend a
closed set in the registry (a non-protected file) with a test.

### SLIs (28-day window, dashboards)

| SLO | Objective → SLI |
|---|---|
| verdict-saved | success: `outcome="success"` / all ≥ 99.9%; latency: share ≤ 0.3 s ≥ 95% (p95 < 300 ms), plus a p95 graph |
| next-record-ready | share ≤ 0.5 s ≥ 95% |
| inventory-freshness | share of time with `time() - last_success{kind="full"} < 26 h` ≥ 99% |
| sold-record-removal | share of delays ≤ 1200 s ≥ 99% |
| staff-checkout-correctness | `paid_after_mismatch` = 0 (100%); (`paid` + `stopped_safely`) / `started` ≥ 99% |
| audio-resolvable | `playable` / all ≥ 95% |
| notification-delivery | share of delays ≤ 300 s ≥ 99% (the notifications feature records only sends outside quiet hours) |

## Logs

One JSON object per line on stdout; the same record is exported over OTLP when export is on.
Schema: [log-line.schema.json](./log-line.schema.json).

| Field | When | Notes |
|---|---|---|
| `time` | always | ISO 8601 UTC |
| `level` | always | `fatal`…`trace` |
| `service`, `env` | always | as the resource |
| `msg` | always | redacted, ≤ 8 KB + marker |
| `trace_id`, `span_id` | an active span exists | lowercase hex (FR-001) |
| `request_id` | while handling a request | FR-002 |
| `job_id`, `job_name`, `attempt` | while running a job | FR-002 |
| `staff_id` | request or job acts for a staff member | FR-004 |
| `err` | error logged | `{ type, message, stack }`, all redacted |

OTLP mapping: `msg` → body, `level` → severity, `trace_id`/`span_id` → the record's trace
context (Loki structured metadata `trace_id`), remaining fields → attributes.

Dropped telemetry: at most one line per minute,
`{"level":"warn","msg":"telemetry export failed; dropping data","signal":"traces|metrics|logs",...}`
(FR-020).
