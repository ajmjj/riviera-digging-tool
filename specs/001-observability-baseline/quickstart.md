# Quickstart: verify the observability baseline

A run guide, not an implementation. It proves the user stories end to end once all tasks
have merged. Names and formats are in [contracts/](./contracts/); the CI equivalent is
`ci/obs-check.ts` (research R14).

## Prerequisites

- Docker with Compose v2, Node ≥ 22.18, pnpm 10.
- `pnpm install --frozen-lockfile` and `make env` (copies `.env.example`). The sample flows and
  the mocks are not in `.env.example`: `make up-dev` turns them on for development (research
  R17).
- Free 127.0.0.1 ports: 8080 (proxy), 3300 (Grafana), 9090 (Prometheus), 3100 (Loki),
  3200 (Tempo), 4318 (collector OTLP/HTTP). Override with `GRAFANA_PORT` etc. in `.env`.

## 1. Without the network: the emission tests

```bash
pnpm test
```

```bash
make test-integration
```

Expected: the `001/FR-030`, `001/FR-031` and `001/FR-032` tests pass with in-memory exporters
(no observability stack), and `node ci/slo-check.ts` reports all catalog metrics registered.

## 2. Stack with the `dev` and `observability` profiles

```bash
make up-dev
```

Expected: `docker compose ps` shows `otel-collector`, `loki`, `tempo`, `prometheus`, `grafana`,
`mocks`, `api`, `worker`, `db`, `web`, `proxy` all `healthy` within 120 s (FR-021, SC-007).

## 3. Follow one request (US1)

```bash
curl -s -X POST -H 'content-type: application/json' -H 'x-request-id: demo-req-1' \
  -d '{}' http://127.0.0.1:8080/api/sample/trace
```

Expected: `202` with `requestId: "demo-req-1"`, a `traceId` and a `jobId`; response header
`X-Request-Id: demo-req-1`. Then, within 30 s, in Grafana (http://127.0.0.1:3300):

- Explore → Tempo → the `traceId`: spans `POST /sample/trace` → `db SELECT`,
  `common_ground SampleShopConfig`, `job.enqueue sample.discogs_release` (US1-1).
- "Logs for this span" opens Loki lines carrying that `trace_id` and `request_id`
  `demo-req-1` (US1-2); a line's `trace_id` link opens the same trace (US1-3).
- Dashboards → "Service overview": the `/sample/trace` request count and latency panels moved
  (US1-4).
- Send `x-request-id: bad id!` or none: a generated ID comes back instead (US1-5).

## 4. Follow one job (US2)

From the trace above, the job trace is under the producer span's links (or search Tempo for
`riviera.job.id = <jobId>`):

- `job.run sample.discogs_release` → `discogs GET /releases/{id}`, with a link back to the
  request trace (US2-1, US2-2). Logs carry `job_id`, `job_name`, `trace_id` (US2-3).
- Fail on purpose:

  ```bash
  curl -s -X POST -H 'content-type: application/json' -d '{"failJob":true}' \
    http://127.0.0.1:8080/api/sample/trace
  ```

  The job span is an error, an error log line has the `job_id`, and the overview's job-failure
  panel goes up by one (US2-4).
- Queue depth (US2-5): `docker compose stop worker`, send three sample requests, the overview's
  queue-depth panel shows 3 after the api's next metric export (≤ 5 s); `docker compose start
  worker` drains it.

## 5. SLO dashboards (US3)

Dashboards → folder "SLOs": exactly seven dashboards named after the constitution's SLOs.
Each shows its target and "No data recorded yet" (US3-1, US3-2). To see values (US3-3):

```bash
node ci/obs-check.ts --emit-slo-samples
```

## 6. No secrets in telemetry (US4)

Send the sample request (§3) with an `Authorization` header and a `Cookie` header whose values
are marker words of your choice (for example `PLANTED_MARKER_1` and `PLANTED_MARKER_2`), then
search `docker compose logs api worker`, Loki and Tempo's span attributes for those markers.

Expected: no match anywhere. The automated version is the T019 suite (FR-032). The marker values
are deliberately not secret-shaped, so this guide doesn't trip the repository's secret scan.

## 7. Telemetry problems don't break the tool (US5)

```bash
docker compose stop otel-collector
```

```bash
make smoke
```

Expected: the smoke test passes, sample requests still answer `202`, and `docker compose logs
api` shows at most one `telemetry export failed; dropping data` warning per minute (US5-2). With
the plain stack (`make down && make up`, no profile, no endpoint), the smoke test passes and logs
are JSON on stdout (US5-1).

## 8. The CI check, locally

```bash
node ci/obs-check.ts
```

Expected: every step `PASS` (FR-033).

## Clean up

```bash
docker compose --profile observability down --volumes
```

Telemetry data is discarded with the volumes (FR-023).
