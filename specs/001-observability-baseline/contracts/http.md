# Contract: HTTP (api)

Paths are as the api sees them. Through the proxy they are prefixed with `/api`
(`/api/sample/trace` → `/sample/trace`).

## Every route

| Header | Direction | Rule |
|---|---|---|
| `X-Request-Id` | request | optional; used only if it matches `^[A-Za-z0-9_-]{1,64}$` (FR-003) |
| `X-Request-Id` | response | always present: the accepted or generated ID (FR-003) |
| `traceparent` (+ `tracestate`) | request | W3C Trace Context; continued if valid, ignored if missing or malformed (FR-011) |

Exceptions: `/healthz` and `/readyz` still return `X-Request-Id`, but produce no span, no HTTP
metric point and no per-request log line (FR-007, FR-017); a failing check is still logged.

## `POST /sample/trace`

Registered only when `SAMPLE_FLOWS_ENABLED=true` (FR-027). Otherwise the route does not exist
(404 like any unknown path).

Request body (JSON, optional):

```json
{ "failJob": false, "releaseId": 249504 }
```

- `failJob` (boolean, default `false`): enqueue the sample job in fail mode (`max_attempts = 1`).
- `releaseId` (positive integer, default `249504`): passed to the job's Discogs lookup.

What it does, in order, all under the request's server span:

1. `SELECT count(*) FROM job WHERE status = 'queued'` (db span, FR-008).
2. Common Ground `SampleShopConfig` query through the shared client (client span, FR-012).
3. `enqueue("sample.discogs_release", { releaseId, fail: failJob })` (producer span, FR-010).

Response `202`:

```json
{
  "requestId": "0b6c…",
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
  "jobId": "5f0c6c1e-…",
  "shopName": "Riviera Records (mock)",
  "queued": 0
}
```

Errors: `400` for an invalid body (zod), `502` with `{ "error": "common_ground_unavailable" }` when
the Common Ground call fails or is rate-limited (the span and metrics record which); no job is
enqueued in that case.

The route is state-changing (it enqueues); when 002 adds CSRF protection to every
state-changing route, this one is included.
