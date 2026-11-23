# Feature Specification: Observability baseline

**Feature Branch**: `claude/confident-gates-wtd8sc` (spec directory `specs/001-observability-baseline`)

**Created**: 2026-11-23

**Status**: Approved

**Input**: User description: "Read docs/digging-tool-handoff.md and the constitution. Specify the observability baseline before any business features exist: structured logs with staff and request/job context, distributed traces across HTTP requests and background jobs (including outbound calls to Common Ground and Discogs, mocked), metrics for every SLO in the constitution, a local OpenTelemetry Collector + Loki + Tempo + Prometheus + Grafana stack that developers can run with Docker Compose, and one dashboard per SLO. Acceptance: a sample request and a sample background job are both visible end to end as a trace in Grafana, with linked logs and metrics, and every SLO dashboard exists."

## Context

Riviera Dig runs unattended on Antn's own machine. When something goes wrong (a sync stalls,
Common Ground starts rate-limiting, a staff checkout stops), the telemetry is the only witness.
This feature puts that witness in place before any business feature exists, so that every
later feature (auth, sync, digging, checkout) only has to *record* its signals into a pipeline
that already works, is already tested, and already has its dashboards.

The constitution (Principle VII) fixes the stack: OpenTelemetry instrumentation, an
OpenTelemetry Collector, Loki for logs, Tempo for traces, Prometheus for metrics and Grafana for
dashboards, run locally behind a Docker Compose profile. Those names appear in this spec as
binding constraints, not as design choices.

**Actors**
- **Developer**: the agent or person working on the code. Runs the stack locally and needs to
  see what a request or job did.
- **Operator**: Antn, running the tool on his machine. Needs to see whether the tool meets its
  SLOs and to find the cause when it doesn't.

## Clarifications

### Session 2026-11-23

- Q: When a background job fails and is retried, does the job-failure metric count every failed attempt or only jobs that give up for good? → A: Every failed attempt counts once; job runs are also counted by outcome.
- Q: Should requests to the health endpoints also be left out of HTTP metrics and per-request logs, not only traces? → A: Yes: health requests produce no spans, no HTTP metric points and no per-request log lines; failures are still logged.
- Q: Over what period should each SLO dashboard measure its current value and remaining error budget? → A: A rolling 28-day window; metrics are kept for at least 30 days.
- Q: How should CI decide that a stopped collector doesn't slow requests? → A: p95 with the collector stopped ≤ the larger of 1.10 × p95 with it running, or p95 with it running + 5 ms.
- Q: Must the observability images pass the same CI vulnerability scan as the app's own images? → A: Yes: the observability images go through the same image vulnerability scan as the app's images, with the same failure rule.
- Q: What does "exported" in FR-014 mean for metrics that have no meaningful value before their first observation? → A: Counters are exported from startup, starting at zero; histograms and timestamp gauges are registered at startup and exported from their first observation.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Follow one request end to end (Priority: P1)

A developer starts the stack with observability turned on, sends the sample request, and opens
Grafana. They find the request's trace: one span for the incoming request, a child span for the
database query it ran, and a child span for its (mocked) call to Common Ground. From the trace
they jump to the log lines for that same request, each carrying the same request ID and trace
ID, and to the request-rate and latency metrics that the request moved.

**Why this priority**: This is the core of the feature. If one request can be followed across
traces, logs and metrics, every later HTTP feature inherits it for free.

**Independent Test**: Start the stack with the observability profile, send the sample request,
and check that Grafana shows its trace with the expected spans, that the trace links to its
log lines, and that the request metrics changed.

**Acceptance Scenarios**:

1. **Given** the stack is running with the observability profile, **When** a developer sends
   the sample request, **Then** within 30 seconds Grafana shows one trace for it containing the
   incoming request span, a database span and a Common Ground client span.
2. **Given** that trace is open in Grafana, **When** the developer follows the link to logs,
   **Then** Grafana shows the request's log lines, and every one carries the same trace ID and
   request ID.
3. **Given** a log line for that request, **When** the developer follows its trace link,
   **Then** Grafana opens the same trace.
4. **Given** the sample request was sent, **When** the developer opens the service overview
   dashboard, **Then** the request count and latency panels include it.
5. **Given** a client sends its own request ID header, **When** the request is served,
   **Then** that ID is used in the logs and returned in the response; **and when** the client
   sends none or an invalid one, **Then** the system generates one and returns it.

---

### User Story 2 - Follow one background job end to end (Priority: P1)

A developer triggers the sample background job. The worker picks it up and runs it. Grafana
shows the job's trace: a span for the job run and a child span for its (mocked) call to
Discogs. When the job was triggered by the sample request, the job's trace is linked to the
request's trace. The job's log lines carry the job ID and trace ID, and the job metrics (runs,
duration, failures, queue depth) reflect it.

**Why this priority**: Most of the tool's risk lives in background work (syncs, the
rate-limited queue, notifications). The user's acceptance criteria name this explicitly.

**Independent Test**: Trigger the sample job, then check in Grafana that its trace, its log
lines and its job metrics are all present and linked.

**Acceptance Scenarios**:

1. **Given** the stack is running with the observability profile, **When** the sample job is
   triggered, **Then** within 30 seconds Grafana shows a trace for the job run with a job span
   and a Discogs client span.
2. **Given** the sample request triggered the job, **When** the developer opens the job's
   trace, **Then** it shows a link to the request trace that enqueued it.
3. **Given** the job ran, **When** the developer follows the trace-to-logs link, **Then** the
   job's log lines appear, each with the job ID, job name and trace ID.
4. **Given** the sample job is told to fail, **When** it runs, **Then** its span is marked as an
   error, an error log line is written with the job ID, and the job-failure metric goes up by one.
5. **Given** jobs are waiting in the queue, **When** the developer looks at the overview
   dashboard, **Then** the queue-depth panel shows how many.

---

### User Story 3 - See every SLO on its own dashboard (Priority: P2)

The operator opens Grafana and finds one dashboard per SLO in the constitution (seven in all).
Each shows the target, the current measured value, and the error budget left over the
SLO window. Until the feature that feeds an SLO exists, its dashboard says that no data has
been recorded yet, instead of showing a misleading zero or 100%.

**Why this priority**: The dashboards are the operator's view of whether the tool is healthy.
They can be built now, because the metrics they read are defined now; they fill with data as
features land.

**Independent Test**: Start Grafana with the observability profile and check that the seven
SLO dashboards exist, each naming its target and reading the metrics the SLO catalog lists.

**Acceptance Scenarios**:

1. **Given** the observability profile is running, **When** the operator opens Grafana,
   **Then** there is a folder of SLO dashboards with exactly one dashboard per SLO in the
   constitution, named after it.
2. **Given** an SLO whose feature has not been built, **When** the operator opens its
   dashboard, **Then** it shows the target and states that no data has been recorded yet.
3. **Given** a test emits sample values for an SLO's metrics, **When** the operator opens that
   SLO's dashboard, **Then** it shows the measured value and the remaining error budget.

---

### User Story 4 - Telemetry never leaks personal data or secrets (Priority: P1)

Logs, span attributes and metric labels identify staff only by a pseudonymous staff ID, never
by email address or name, and never contain secrets such as the Common Ground Admin key, a
Discogs token, a session cookie or an authorization header.

**Why this priority**: The constitution forbids personal data and secrets in logs and requires
CI to test the redaction. A leak here would copy secrets into every log store.

**Independent Test**: Send requests and run jobs whose inputs contain an email address, an
authorization header, a cookie and secret-looking values, then check that none of them appears
in any emitted log line, span attribute or metric label.

**Acceptance Scenarios**:

1. **Given** a request carries an authorization header and a cookie, **When** it is logged and
   traced, **Then** neither value appears in any log line or span attribute.
2. **Given** a log call includes an email address, a token or a secret-named field, **When**
   the line is written, **Then** the value is replaced by a redaction marker.
3. **Given** a staff member is associated with a request, **When** its log lines and spans are
   written, **Then** they carry only the pseudonymous staff ID.

---

### User Story 5 - Telemetry problems never break the tool (Priority: P2)

The observability stack is optional. Without the profile, or when the collector is down, the
tool keeps serving requests and running jobs normally, and the healthchecks stay green.

**Why this priority**: The host machine may run without the observability stack. Telemetry
must never become a new way for the tool to fail.

**Independent Test**: Run the stack without the observability profile and with the collector
stopped, and check that the smoke test passes and requests are not slowed noticeably.

**Acceptance Scenarios**:

1. **Given** the stack runs without the observability profile, **When** the smoke test runs,
   **Then** it passes and logs are still written to standard output.
2. **Given** the collector stops while the stack runs, **When** requests and jobs continue,
   **Then** they succeed, and at most a warning about dropped telemetry is logged, not one per
   request.

---

### Edge Cases

- A client sends a request ID that is too long or contains control characters: it is replaced
  by a generated one, never echoed into logs as is.
- A client sends a trace context header: the request joins that trace only if the header is
  valid; a malformed header starts a new trace.
- A background job fails partway: the job span records the error and its duration, the
  failure metric counts that failed attempt once, and any retry is a new span in the same
  trace (whose own failure, if any, counts once more).
- A job is enqueued with no originating request (for example a scheduled job): it starts its
  own trace.
- The mocked Common Ground or Discogs answers HTTP 429: the client span and the outbound-call
  metric record it as rate-limited, distinct from other failures.
- Very large log messages or attribute values are truncated to a fixed limit rather than
  dropped or allowed to grow the log line without bound.
- An SLO metric has never been recorded: its dashboard shows "no data recorded yet", and
  error-budget panels do not show a false 100% or 0%.
- The observability profile is started on a machine where the telemetry ports are already
  taken: the tool's own services still start; only the observability services fail.

## Requirements *(mandatory)*

### Functional Requirements

**Logs**

- **FR-001**: The api and the worker MUST write logs as structured JSON, one object per line,
  to standard output, with at least: timestamp, level, service name, message, and the trace ID
  and span ID of the active span when there is one.
- **FR-002**: Every log line written while handling an HTTP request MUST carry that request's
  request ID; every log line written while running a background job MUST carry the job ID and
  job name.
- **FR-003**: The system MUST accept a client-supplied request ID header only if it is at most
  64 characters of letters, digits, `-` and `_`; otherwise it MUST generate one. The request ID
  MUST be returned in the response header of the same name.
- **FR-004**: When a request or job is associated with a staff member, log lines, span
  attributes and job records MUST identify them only by the pseudonymous staff ID, never by
  email address or name. Until authentication exists (002), the mechanism MUST exist and be
  tested with a test staff ID.
- **FR-005**: Before any log line or span attribute is written, the system MUST redact
  authorization headers, cookies, values of fields whose names indicate secrets (such as
  password, token, secret, key, authorization, cookie), email addresses, and bearer or token
  strings, replacing each with a fixed redaction marker. Field names are matched regardless of
  letter case and word separators, so `adminKey`, `admin_key`, `Admin-Key` and `ADMIN_KEY` are all
  treated as secret names.
- **FR-006**: Log messages and attribute values longer than 8 KB MUST be truncated, with a
  marker showing that truncation happened.

**Traces**

- **FR-007**: Every incoming HTTP request MUST produce a server span recording the method,
  route template (not the raw path with IDs), response status and duration. Requests to the
  health endpoints MUST NOT produce spans, HTTP metric points or per-request log lines, so
  healthchecks don't flood traces, dashboards or logs; a failing health check (for example the
  database unreachable) is still logged.
- **FR-008**: Every database query made while handling a request or job MUST produce a child
  span recording the operation, without parameter values.
- **FR-009**: Every background job run MUST produce a span recording the job name, job ID,
  attempt number, outcome and duration. A failed run MUST mark its span as an error.
- **FR-010**: When a request enqueues a job, the job's trace MUST link to the request's trace
  so a developer can navigate from one to the other.
- **FR-011**: A valid incoming trace context header MUST be continued; a missing or malformed
  one MUST start a new trace.
- **FR-012**: Every outbound call to Common Ground or Discogs MUST go through one shared
  client layer that produces a client span recording the service, the operation name (for
  Common Ground, the GraphQL operation name), the HTTP status and whether the call was
  rate-limited (HTTP 429). Request and response bodies MUST NOT be recorded.
- **FR-013**: In development and CI, Common Ground and Discogs MUST be served by local mock
  services that answer the sample calls and can be told to answer with a failure or HTTP 429.
  No real Common Ground or Discogs host is ever contacted.

**Metrics**

- **FR-014**: Every metric listed in the SLO catalog (constitution Principle VII and
  `ci/slo-catalog.json`) MUST be registered at startup, even before the feature that records it
  exists. Counters MUST be exported from startup, starting at zero. Histograms and timestamp
  gauges, which have no meaningful value before their first observation, MUST be exported from
  that first observation. The registry MUST make the catalog check in CI pass for real.
- **FR-015**: The system MUST record Common Ground and Discogs calls as one counter by service
  and outcome (success, failed, rate-limited), and their duration.
- **FR-016**: The system MUST record background job runs (every attempt) by job name and
  outcome, their duration, job failures, and current queue depth. Each failed attempt counts
  as exactly one job failure, whether or not it will be retried.
- **FR-017**: The system MUST record HTTP server requests by route, method and status class,
  and their duration, excluding the health endpoints (FR-007).
- **FR-018**: Metric labels MUST NOT include staff IDs, request IDs, job IDs or any other
  unbounded value, so the number of time series stays bounded.

**Pipeline and local stack**

- **FR-019**: The api and the worker MUST send traces, metrics and logs to an OpenTelemetry
  Collector over OTLP. The collector address MUST be configuration, with telemetry export
  turned off when it is not set.
- **FR-020**: Telemetry export MUST NOT block or fail requests or jobs. If the collector is
  unreachable, telemetry is dropped, and the system logs at most one warning per minute about
  it.
- **FR-021**: The repository MUST provide a local observability stack (OpenTelemetry Collector,
  Loki, Tempo, Prometheus and Grafana) in Docker Compose behind a profile named
  `observability`, off by default. Every service in it MUST have a healthcheck, bind only to
  127.0.0.1, and come up healthy within the constitution's 120-second startup limit. Its images
  MUST pass the same image vulnerability scan as the app's images.
- **FR-022**: Grafana MUST come pre-provisioned with its data sources and dashboards, with no
  manual setup, and MUST link traces to logs (by trace ID), logs to traces, and traces to the
  related request and job metrics.
- **FR-023**: Locally, every trace MUST be kept (no sampling), and telemetry data MAY be
  discarded when the observability stack is removed.

**Dashboards**

- **FR-024**: Grafana MUST provide exactly one dashboard per SLO in the constitution (seven),
  generated from or checked against the SLO catalog, each showing the SLO's target, its current
  measured value over the SLO window (a rolling 28 days), and the remaining error budget over
  that window. Locally stored metrics MUST be kept for at least 30 days so the window is
  complete.
- **FR-025**: An SLO dashboard whose metrics have no recorded data MUST say that no data has
  been recorded yet, rather than show a value.
- **FR-026**: Grafana MUST also provide one service overview dashboard: request rate, errors
  and latency per route; job runs, failures and queue depth; and Common Ground and Discogs
  calls by outcome.

**Sample flows**

- **FR-027**: The api MUST provide a sample request that runs a database query, makes one
  mocked Common Ground call and enqueues the sample job. It MUST be available only when a
  configuration flag enables it (off by default, on in development and CI).
- **FR-028**: The worker MUST run the sample job, which makes one mocked Discogs call. The
  sample job MUST also be able to fail on purpose, for testing failure telemetry.
- **FR-029**: The worker MUST have the minimal job queue the sample job needs (enqueue, pick
  up, run, record outcome), backed by the database, so that later features (sync,
  notifications) build on it.

**Verification**

- **FR-030**: Automated tests MUST assert that the sample request produces the expected span
  tree, a structured log line with its request ID and trace ID, and an update to the request
  metrics, without needing the observability stack.
- **FR-031**: Automated tests MUST assert the same for the sample job: span tree, link to the
  enqueuing request, log lines with job ID and trace ID, and job metrics, including the failure
  case.
- **FR-032**: Automated tests MUST assert the redaction of FR-005 for log lines and span
  attributes, using inputs that contain each kind of sensitive value.
- **FR-033**: CI MUST run an end-to-end observability check against the stack with the
  observability profile: send the sample request and trigger the sample job, then confirm
  through the stack's own query interfaces that both traces, their log lines and their metrics
  arrived, and that every SLO dashboard and the overview dashboard are provisioned.

### Key Entities

- **Request context**: request ID, trace ID, and (once auth exists) pseudonymous staff ID,
  attached to everything done while handling one HTTP request.
- **Job**: one unit of background work in the queue: job ID, job name, payload, attempt,
  status (queued, running, succeeded, failed), timestamps, the trace context of whoever
  enqueued it, and optionally the staff ID it acts for.
- **SLO catalog entry**: one SLO from the constitution: ID, name, target, the metrics it reads,
  and the dashboard that shows it.
- **Telemetry signal**: a log line, span or metric data point, always carrying the service name
  and environment, and never carrying personal data or secrets.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From sending the sample request, a developer can open its full trace (request,
  database and Common Ground spans) and its log lines in Grafana within 30 seconds, without
  searching by anything other than the request ID.
- **SC-002**: From triggering the sample job, a developer can open its full trace (job and
  Discogs spans), its link back to the request, and its log lines within 30 seconds.
- **SC-003**: All 7 SLO dashboards and the overview dashboard exist on first start of the
  observability stack, with no manual steps.
- **SC-004**: 100% of the SLO catalog's metrics are registered and exported as FR-014 defines,
  as checked in CI.
- **SC-005**: Zero occurrences of the planted email addresses, tokens, cookies and secrets in
  emitted telemetry across the redaction test suite.
- **SC-006**: With the collector stopped, the smoke test still passes and p95 latency of the
  sample request is no higher than the larger of 110% of, or 5 ms above, its p95 with the
  collector running.
- **SC-007**: The full stack with the observability profile becomes healthy within 120 seconds
  on the CI runner.

## Assumptions

- Recording each SLO's real values is the job of the feature that owns it (verdicts in the Dig
  feature, sync freshness in the sync feature, and so on). This feature defines and exports the
  metrics and builds the dashboards; most of them will show "no data recorded yet" until then.
- Alerting is out of scope: the Backstock rules adopted by the constitution define SLOs as
  metrics with one dashboard each and do not define alerts. Alerting can be added by a later
  amendment.
- The observability stack is for local development and for Antn's machine. Long-term retention,
  remote storage and access control for Grafana beyond binding to 127.0.0.1 are out of scope;
  Grafana may allow anonymous local access.
- The `/readyz` "last sync recent" condition is added by the Common Ground sync feature; this
  feature leaves `/healthz` and `/readyz` as they are and keeps them out of traces.
- The sample request and sample job exist for demonstration and testing only. They are off
  unless a configuration flag enables them, and they never touch real Common Ground or Discogs.
- The job queue here is the minimum the sample job needs. Rate limiting (60 requests a minute
  for Common Ground and Discogs), scheduling and catch-up runs are added by the features that
  need them.
- Metric names are the proposals in `ci/slo-catalog.json`. If planning renames any, the catalog
  changes in the same PR, with Antn's approval because the catalog is a protected path.
