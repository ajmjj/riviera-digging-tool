# Riviera Dig — constitution input

Paste or reference this when running `/speckit.constitution`. It sets the non-negotiable rules for a codebase that is written entirely by AI agents (Claude Opus 5.5) and is **not reviewed line by line by a human**. Everything below exists so that a green CI run can stand in for code review.

## 0. Ground rules for agents

1. **CI is the only path to `main`.** No direct pushes, no force-pushes, no bypass, admin included. A change is "done" only when every required check is green on the PR.
2. **Agents may never weaken the safety net.** These all need Antn's approval through CODEOWNERS:
   - files in `.github/`, `ci/`, `CODEOWNERS`
   - test and coverage thresholds, mutation thresholds
   - lint, type-checker and security configs
   - the constitution itself

   CI also fails a PR that adds `skip`/`only`/`todo` tests, `eslint-disable`, `@ts-ignore`/`@ts-expect-error`, `# type: ignore`, `noqa`, `--no-verify`, or lowers any threshold, unless the PR carries an `approved-exception` label that only Antn can add.
3. **Spec first.** Every feature goes through `/speckit.specify → /speckit.clarify → /speckit.plan → /speckit.tasks → /speckit.implement`. Code without a spec requirement behind it is rejected.
4. **Traceability.** Every functional requirement ID in a spec (`FR-###`) must be referenced by at least one test (for example `it("FR-012: …")`). A CI script fails the build if any FR in `specs/**/spec.md` has no test, or if a test names an FR that doesn't exist.
5. **Tests are written before or with the code, never after a green run.** Agents must not edit a failing test to make it pass unless the spec changed. Any test change in a PR must cite the FR or spec change that justifies it.
6. **Small PRs.** One task (or a small group of tasks) per PR, about 400 changed lines at most, excluding generated files and fixtures. Each PR description lists the tasks and FRs it covers.
7. **No live side effects in development or CI.** Common Ground and Discogs are always mocked in CI. Anything that writes to Common Ground (adding order lines, changing prices, marking an order paid) is behind a feature flag that is off by default, and has a dry-run mode that logs the calls it would make.

## 1. CI pipeline (all required checks on every PR)

**Static**
- Formatter check, plus a linter at its strictest preset with zero warnings allowed.
- Type checking in strict mode, with no implicit `any` and no unchecked casts. If Python is used, `mypy --strict` or pyright strict.
- Lockfile is committed and installs are frozen (`--frozen-lockfile` or equivalent). No floating dependency versions.
- Dead code and unused-dependency check.

**Tests**
- **Unit tests**, with branch coverage of at least 90% overall and at least 95% on domain code (pricing, verdicts, dig order, sync reconciliation, taste profile).
- **Diff coverage:** 100% of changed lines in domain code, and at least 90% of changed lines elsewhere.
- **Mutation testing** (for example Stryker) on domain code, with a mutation score of at least 80%. This catches tests that run the code without checking anything, which is the main risk with agent-written tests.
- **Property-based tests** for the staff price rule (never above list price, never below €5 unless the list price is lower, the 50%/30% boundary at exactly €20, rounding to the cent), for dig ordering, and for undo.
- **Integration tests** against real Postgres (Testcontainers or a compose service):
  - every migration runs up and down
  - the seed loads
  - every repository query is exercised
- **Contract tests:**
  - Every Common Ground GraphQL operation is validated against the committed Admin and Client schema files in `contracts/common-ground/`, and CI fails on any mismatch. Typed clients are generated from those schemas.
  - Discogs and Common Ground are mocked with recorded fixtures, and the mocks are checked against the same contracts.
- **End-to-end tests** with Playwright against the full `docker compose` stack, using mocked external APIs:
  - every user flow on the design canvas, at phone (390×844) and laptop (1440×900) sizes
  - accessibility checks with axe, with no serious or critical violations allowed
  - visual regression screenshots of the main screens
- **Flake guard:** new or changed tests run 3 times in CI, and any flake fails the build.

**Build and run**
- Every Docker image builds.
- `docker compose up` comes up with every healthcheck green within 120 seconds.
- A smoke test runs through: sign-in, dig a record, add it to the pile, pull it, and a staff checkout in dry-run mode.
- Images are scanned with Trivy, failing on high or critical issues.

**Security**
- Secret scanning with gitleaks on the diff and on full history.
- Dependency audit and SAST (CodeQL plus Semgrep), failing on high or critical findings.
- GitHub Actions pinned to commit SHAs, with minimal `permissions:` on every workflow.
- Dependabot or Renovate updates go through the same pipeline. Auto-merge is only allowed for patch updates, and only when everything is green.
- Security tests for authentication: magic-link expiry and single use, session fixation, CSRF on state-changing routes, and role checks (a staff account gets 403 on every admin route).
- Data isolation tests: one staff member can never read or change another's verdicts, pile or Discogs token.

**Independent review**
- A separate reviewer agent runs on every PR in CI, with a fresh context and none of the implementing agent's conversation. It checks the diff against the spec, the plan and this constitution.
- It posts findings as PR review comments. Any blocking finding fails the check.
- The implementing agent can't resolve or dismiss the reviewer's findings. Only a new commit that the reviewer re-checks and passes clears them.

**Observability** (see section 2)
- Tests assert that logs, metrics and traces are emitted for key flows. For example, a sync run produces a span tree, a metrics update and a structured log line with a correlation ID.

## 2. Observability

**Use the same observability requirements as the Backstock project.** Before writing the constitution, read Backstock's constitution and observability documents (local copy at `~/Documents/Programming/Projects/backstock`; adjust the path if needed) and adopt their logging, metrics, tracing, dashboard, alerting and SLO rules unchanged, adapting only the names.

In addition, the following minimums apply even if Backstock doesn't spell them out:
- **Logs:** structured JSON with a request and correlation ID on every line, and no personal data or secrets (CI tests the redaction).
- **Traces:** OpenTelemetry traces for every HTTP request, background job and outbound call to Common Ground or Discogs.
- **Metrics:**
  - sync duration and outcome
  - Common Ground and Discogs calls, both total and rate-limited (HTTP 429)
  - queue depth and job failures
  - verdicts per minute
  - staff checkouts started, succeeded and failed, plus total mismatches
- **Local stack:** an observability stack in `docker compose`, behind a profile flag, with pre-provisioned dashboards.
- **Health endpoints:** `/healthz` (process alive) and `/readyz` (database reachable, last sync recent).

## 3. Product rules that must never break (each covered by tests)

- **Staff price:** `min(list, max(5, round(list × (list > 20 ? 0.7 : 0.5), 2)))`. Configurable in shop settings, but the default must match this exactly.
- **Progress:** one current verdict per staff member per record, and every change is logged. Box digging never reorders records.
- **Staff checkout:**
  - After writing the order lines, the tool re-reads the Common Ground order and stops if the total doesn't match the staff total.
  - It never marks an order paid after a mismatch.
- **Secrets:** the Common Ground Admin key and Discogs tokens never reach the browser. CI checks the built frontend bundle for secret-shaped strings.

## 4. Human checkpoints (minimal, but non-optional)

Antn does not review code, but he does approve:
1. the constitution
2. each feature's `spec.md`, after `/speckit.clarify`
3. any PR labelled `needs-human` (CODEOWNERS paths, exceptions, or anything that writes to Common Ground for real)
4. turning on the live Common Ground write flag after the spikes pass
