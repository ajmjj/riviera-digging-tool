# 001 carry-forward notes

Notes for later tasks of this feature, from review of earlier PRs. Each note goes into the PR
description of the task it names, and that PR either acts on it or says why not.

## T005

- Don't rely on `redactText` for raw headers or upstream error bodies. Use the research R4
  header allow-list and record no bodies. (T004 records no exporter error bodies; the header
  allow-list belongs to the logger's request serialiser.)

## T016 (from T013)

- The Common Ground mock answers 401 without `Authorization`, and T013's client sends the header
  only when `sampleShopConfig` gets a key (config's `sampleFlows.commonGroundDevApiKey`, from
  `COMMON_GROUND_DEV_API_KEY`). `docker-compose.yml` and `make up-dev` don't pass that variable
  through yet; T013 left them alone to keep its wave out of `docker-compose.yml`. T016 adds the
  api passthrough (`COMMON_GROUND_DEV_API_KEY: ${COMMON_GROUND_DEV_API_KEY:-}`, empty means unset)
  and a dev-only value in `make up-dev`, and passes the key to `createCommonGround`. Without it the
  sample request's Common Ground call fails with 401 and the route answers 502.

## T024 (from T014 / T015)

- R11: `docker compose --profile dev --profile observability config --images` lists the locally
  built derived images (`riviera-dig/otel-collector:local`, `riviera-dig/loki:local`,
  `riviera-dig/tempo:local`). The Trivy step must scan them after the build, not try to pull
  them, so the upstream images inside them (and the copied busybox) are covered.

## T024 (from the 001 follow-ups, PR #45)

- `proxy/nginx.conf` now resolves `api` and `web` through Docker's DNS (`resolver 127.0.0.11
  valid=2s`). Before, a recreated api that came back on a new IP got 502s through the proxy
  until the proxy restarted, which the plain-stack → `--profile dev --profile observability` up
  sequence of the stack job triggers. Only static tests (`apps/api/test/proxy-config.test.ts`)
  cover it; the stack job's second smoke through the proxy, after that up, is its end-to-end
  check, so keep that smoke step after the profile switch. `ci/smoke.ts` does not retry: if it
  runs within ~2 s of the api changing IP it can still see one 502.

## After 001 (from PR #52): Trivy exceptions expire 2026-12-31

- `ci/trivy-exceptions/{grafana,prometheus,tempo}.yaml` hold time-boxed exceptions, added in PR #52
  as a recorded deviation from the Trivy gate (see that PR), for HIGH CVEs in Go libraries compiled into upstream `grafana/grafana:13.3.1`,
  `prom/prometheus:v3.16.0` and `grafana/tempo:2.10.10` (x/net, go-jose, Go stdlib, Grafana's
  bundled Tempo library). No upstream release had the fixes on 2026-11-25. `ci/trivy-scan.sh`
  applies each file only to the exact image reference on its `# image:` line (for Tempo, also only
  while `docker/tempo.Dockerfile` starts from the base on its `# from:` line); every other image is
  scanned without exceptions.
- When an upstream release passes `trivy image --severity HIGH,CRITICAL --ignore-unfixed` with no
  ignore file, bump its pin (`docker-compose.yml`, or `docker/tempo.Dockerfile` for Tempo) and
  delete its exception file in the same PR. Do this before 2026-12-31. After that date the
  entries stop applying and the `stack` job fails until the pin is bumped or Antn approves a
  renewal.
