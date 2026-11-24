# Riviera Dig

Internal tool for Riviera Records staff to listen through the shop's records, mark each
one Pass / Maybe / Want / No audio, and pull and check out their pile at staff price.
Brief: [`docs/digging-tool-handoff.md`](docs/digging-tool-handoff.md).

The code is written by AI agents and gated by CI instead of line-by-line review. The rules
are in the [constitution](.specify/memory/constitution.md); agent guidance is in
[`CLAUDE.md`](CLAUDE.md).

## Run it locally

```bash
make up      # creates .env from .env.example, builds, waits for every healthcheck
make smoke
```

Open http://localhost:8080. `make down` stops it; `make logs` follows the logs.

## Observability

The api and worker emit OpenTelemetry traces, metrics and JSON logs. The plain stack has no
collector, so export is off and logs go only to stdout. To see traces, metrics and logs in
Grafana:

```bash
make up-observability   # also starts the collector, Loki, Tempo, Prometheus and Grafana
make up-dev             # the same, plus the mocks and the sample request and job
make down-observability
```

Grafana is at http://127.0.0.1:3300 (`GRAFANA_PORT` in `.env`), with one dashboard per SLO
and a service overview. All ports bind to 127.0.0.1 only.

If the collector is down, requests and jobs carry on and telemetry is dropped, with at most
one `telemetry export failed; dropping data` warning per minute in the logs.

The walkthrough, with what to expect at each step, is
[`specs/001-observability-baseline/quickstart.md`](specs/001-observability-baseline/quickstart.md).

## How a change reaches `main`

Only through a PR with every required check green. The checks:

| Check         | What it does                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------ |
| `static`      | Prettier, strict ESLint (zero warnings), `tsc --strict`, knip, Common Ground codegen up to date, SLO catalog |
| `tests`       | Unit and integration tests on real Postgres with coverage thresholds, diff coverage, flake guard             |
| `mutation`    | Stryker on domain code                                                                                       |
| `stack`       | Builds every image, `docker compose up` within 120 s, smoke test, Playwright (phone and laptop, axe), Trivy  |
| `security`    | gitleaks (diff and history), secret scan of the built bundle, `pnpm audit`, Semgrep                          |
| `fr-trace`    | Every spec requirement has a test; untested ones pass only with Antn's `approved-exception`                  |
| `analyze (…)` | CodeQL                                                                                                       |
| `guard`       | Rejects added suppressions and loosened thresholds (runs from `main`)                                        |
| `human-gate`  | Protected paths and `needs-human` PRs wait for Antn's `human-approved` label (runs from `main`)              |
| `review`      | Independent reviewer agent with a fresh context (runs from `main`)                                           |

Thresholds live in [`ci/thresholds.json`](ci/thresholds.json), protected paths in
[`ci/protected-paths.json`](ci/protected-paths.json). Antn applies the branch rules with
[`ci/branch-protection.sh`](ci/branch-protection.sh).
