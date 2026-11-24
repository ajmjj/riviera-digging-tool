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
