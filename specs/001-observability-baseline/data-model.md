# Data model: Observability baseline

Entities from the spec's Key Entities, with the fields, rules and state transitions the plan
implements. Wire formats (span names, metric names, log fields, HTTP) are in
[contracts/](./contracts/).

## 1. Request context — `RequestContext` (in memory, per HTTP request)

| Field | Type | Rule | Source |
|---|---|---|---|
| `requestId` | string | `^[A-Za-z0-9_-]{1,64}$`; client value if valid, else `randomUUID()` | FR-003 |
| `traceId`, `spanId` | hex strings | from the active server span; continued from a valid `traceparent`, else new | FR-011 |
| `staffId` | string \| undefined | opaque pseudonymous ID, `^[A-Za-z0-9_-]{1,64}$`, never email-shaped; set by `withStaff()` | FR-004 |
| `route` | string | Fastify route template or `unmatched` | FR-007, FR-017 |

Lifetime: created in `onRequest` (health routes excluded), ends in `onResponse`. Carried by the
OTel context (AsyncLocalStorage) and the request's child logger.

## 2. Job — `Job` (table `job`, migration `0001_job`)

| Column | Type | Rule |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `name` | `text` not null | a registered job name (`sample.discogs_release` for now); `^[a-z][a-z0-9_.]{0,63}$` |
| `payload` | `jsonb` not null | default `{}`; validated by the job's zod schema on enqueue and on run |
| `status` | `text` not null | `queued` \| `running` \| `succeeded` \| `failed` (CHECK) |
| `attempt` | `int` not null | default 0; incremented on claim |
| `max_attempts` | `int` not null | default 3, CHECK ≥ 1 |
| `run_after` | `timestamptz` not null | default `now()`; set to now + 2^attempt s on retry |
| `locked_until` | `timestamptz` null | lease while `running`: now + 2 min, renewed every 30 s by the runner; an expired lease is swept as a failed attempt (research R12) |
| `origin_traceparent` | `text` null | W3C `traceparent` of the producer span; null if not enqueued inside a span |
| `trace_parent` | `text` null | `traceparent` of the first attempt's span; later attempts are its children |
| `staff_id` | `text` null | pseudonymous staff ID the job acts for (FR-004); CHECK `^[A-Za-z0-9_-]{1,64}$`, same rule as `RequestContext.staffId` |
| `last_error` | `text` null | redacted and truncated error message of the last failed attempt |
| `created_at`, `updated_at` | `timestamptz` not null | default `now()` |
| `started_at`, `finished_at` | `timestamptz` null | last attempt's start; terminal time |

Index: `job_claimable_idx ON job (run_after, created_at) WHERE status IN ('queued','running')`.

**State transitions**

```text
            enqueue
               │
               ▼
   ┌────────► queued ──claim──► running ──ok──────────────► succeeded
   │                              │
   │                              ├─error or lease expired, attempt < max ──► queued (run_after = now + 2^attempt s)
   │                              └─error or lease expired, attempt = max ──► failed
   └────────────────────────────────────────────┘
```

Every transition out of `running` records a `riviera.jobs.runs` point with the attempt's
outcome; every `error` and every expired lease adds one to `riviera.jobs.failures` (R13). An
expired lease never starts a run beyond `max_attempts`. `succeeded` and `failed` are
terminal.

Bookkeeping table `schema_migration(version int PK, name text, applied_at timestamptz)`.

## 3. Metric registry — `InstrumentDef` (`packages/telemetry/src/slo-metrics.ts`)

One `as const` array of instrument definitions (catalog and service instruments); `SLO_METRIC_NAMES`
is derived from it as the names of the **catalog** instruments only (those with `slo` or `minimum`
set) and is what `ci/slo-check.ts` imports. The file has no runtime imports, so plain `node` can load it from
the repository root.

```ts
interface InstrumentDef {
  name: `riviera.${string}`;
  kind: "counter" | "histogram" | "gauge";
  unit: string;                       // "s" or an annotation like "{request}"
  description: string;
  labels: Record<string, readonly string[] | "route">; // allowed values per label
  buckets?: readonly number[];         // histograms only
  slo?: string;                        // catalog SLO id, if it feeds one
  minimum?: true;                      // one of the catalog's minimumMetrics
}
```

Validation (unit tests): `SLO_METRIC_NAMES` (the `slo`- or `minimum`-tagged names) equals
`requiredMetrics(catalog)` exactly, and the service instruments of research R6 are the only others; every label value set is a closed list (`route` is closed by
the registered routes plus `unmatched`; `method` of `riviera.http.server.duration` is `GET`, `HEAD`, `POST`, `PUT`,
`PATCH`, `DELETE`, `OPTIONS` plus `_OTHER`, which counts any other method, as in the semantic conventions); no label is named like `staff_id`, `request_id`, `job_id`,
`trace_id` or `email` (FR-018); every histogram used by a latency SLO has a bucket boundary at its
threshold. The full list of instruments is in [contracts/telemetry.md](./contracts/telemetry.md#metrics).

## 4. SLO catalog entry → dashboard — `SloDashboard`

Source of truth: `ci/slo-catalog.json` (`id`, `name`, `objective`, `metrics`). Joined in code with
`packages/telemetry/src/dashboards/slo-queries.ts`:

| Field | Meaning |
|---|---|
| `id` | catalog SLO id; dashboard UID `slo-<id>`, file `observability/grafana/dashboards/slo/<id>.json` |
| `title` | catalog `name` |
| `objectives[]` | one or two per SLO: `{ label, target, sli: PromQL ratio over 28d }` |
| `budget` | derived per objective: `1 - (1 - SLI) / (1 - target)`, shown as % remaining; for a 100% target (checkout `paid_after_mismatch = 0`) the formula would divide by zero, so the budget is 100% when the bad-event count over the window is 0 and 0% (exhausted) otherwise. Counters are zero-initialised at startup (R18), so `sum(increase(riviera_checkout_paid_after_mismatch_total[28d]))` counts the first mismatch too |
| `noData` | `"No data recorded yet"` on every stat panel (FR-025). Because counters are zero-initialised, an empty window is detected by counts, not by missing series: each objective has a `hasData` query (the SLO's total-events count over 28 d, e.g. `riviera.verdict.requests`, `riviera.checkout.started`, a histogram's `_count`) and its SLI/budget panels return no value while `hasData` is 0, via `… and on() (hasData > 0)` |

Rules (unit tests): ids in `slo-queries.ts` equal the catalog ids; every metric a query names is
in that SLO's catalog `metrics` (translated to its Prometheus name); the committed JSON equals the
generator's output (stale check, like codegen).

## 5. Telemetry signal (every log line, span and metric point)

Always carries resource attributes `service.name` (`riviera-api` | `riviera-worker`),
`service.namespace=riviera`, `deployment.environment.name` (`DEPLOYMENT_ENVIRONMENT`; unset means
`production`, research R17) and `service.version` (package version). Never carries personal data or secrets
(FR-005): enforced by `redact()` on logs and on spans at export, and by the closed label sets on
metrics.
