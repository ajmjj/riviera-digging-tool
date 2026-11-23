# Riviera Dig Constitution

This codebase is written entirely by AI agents and is **not reviewed line by line by a
human**. Every rule below exists so that a green CI run can stand in for code review.
"Antn" means the project owner (GitHub `@ajmjj`), who is the sole CODEOWNER.

## Core Principles

### I. CI Is the Only Path to `main` (NON-NEGOTIABLE)

- `main` MUST only change through a pull request whose required checks are all green.
- Direct pushes, force-pushes and bypassing protection are forbidden for everyone, admins
  included. The repository ruleset has no bypass actors.
- A change is "done" only when every required check on its PR is green. Local green runs
  count for nothing.
- Every required check MUST run on every PR. A check that does not apply yet (for example,
  visual regression before there are screens) MUST still run and pass trivially, saying in
  its output why, so it can't be dropped quietly later.

Rationale: with no human reading the code, the pipeline is the reviewer. Anything that can
skip it makes every other rule optional.

### II. Agents Never Weaken the Safety Net (NON-NEGOTIABLE)

- **Protected paths.** Changes to any of the following MUST be approved by Antn (see
  Human Checkpoints for how approval is given and verified):
  - `.github/`, `ci/`, `CODEOWNERS`
  - test, coverage, diff-coverage and mutation thresholds (`ci/thresholds.json`)
  - formatter, lint, type-checker, test-runner and security-scanner configuration
  - this constitution (`.specify/memory/constitution.md`)

  The authoritative list is `ci/protected-paths.json`, which is itself protected.
- **Suppression guard.** CI MUST fail any PR that adds any of the following, unless Antn
  has applied the `approved-exception` label:
  - skipped, focused or placeholder tests (`.skip`, `.only`, `.todo`, `xit`, `fit`,
    `describe.skip`, `test.fixme`, and the like)
  - `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`, `# type: ignore`,
    `noqa`, `istanbul ignore`, `c8 ignore`, `v8 ignore`, `Stryker disable`
  - `--no-verify`
  - any lowered threshold
- **Labels.** Agents MUST apply `needs-human` to every PR that touches a protected path,
  asks for an exception, or writes to Common Ground for real.
- The gate checks (suppression guard, human gate, independent review) MUST run from the
  base branch's workflow definitions (`pull_request_target`) and MUST NOT execute code
  from the PR, so a PR can't rewrite the rules that judge it.
- Agents MUST NOT change the repository ruleset. Antn applies it himself with
  `ci/branch-protection.sh`.

Rationale: an agent under pressure to get to green will otherwise loosen the gate instead
of fixing the code.

### III. Spec First, Fully Traceable

- Every feature MUST go through `/speckit-specify → /speckit-clarify → /speckit-plan →
  /speckit-tasks → /speckit-implement`. Code with no spec requirement behind it MUST be
  rejected.
- Every functional requirement (`FR-###`) in `specs/**/spec.md` MUST be named by at least
  one test. Because FR numbers restart in every spec, tests name them with the feature
  number in front: `NNN/FR-###`, for example `it("002/FR-012: …")`.
- CI MUST fail the build if any FR has no test, or if any test names an FR that does not
  exist.
- While a feature's tests don't exist yet (its spec PR and its task PRs before the last), a PR
  may pass the untested-FR part of this check only with Antn's `approved-exception` label.
  References to FRs that don't exist never pass.

Rationale: traceability is how a reader with no time to read the code can still check that
every requirement is exercised and nothing unasked-for was built.

### IV. Tests Lead, and Tests Must Check Something

- Tests MUST be written before or together with the code they cover, never added after a
  green run.
- An agent MUST NOT edit a failing test to make it pass unless the spec changed. Every test
  change in a PR MUST cite the FR or spec change that justifies it.
- Domain code (pricing, verdicts, dig order, sync reconciliation, taste profile) MUST be
  covered by mutation testing, so a test that runs code without asserting anything fails
  the build.
- The staff price rule, dig ordering and undo MUST have property-based tests.

Rationale: the main risk with agent-written tests is tests that pass without checking
anything. Mutation and property tests catch that. Coverage alone does not.

### V. Small, Self-Describing PRs

- One task, or a small group of related tasks, per PR.
- At most about 400 changed lines, not counting generated files, lockfiles and fixtures.
- Each PR description MUST list the tasks (`T###`) and FRs it covers.

Rationale: small PRs keep the independent reviewer agent effective and make failures easy
to locate and revert.

### VI. No Live Side Effects Outside an Explicit Live Switch

- Common Ground and Discogs MUST always be mocked in development and CI.
- Any code that writes to Common Ground (adding order lines, changing prices, adding notes
  or payments, marking an order paid, changing status) MUST sit behind a feature flag that
  is off by default.
- Every such write MUST also have a dry-run mode that logs the exact calls it would make
  and makes none of them.
- The live write flag is turned on only by Antn (Human Checkpoint 4).

Rationale: one wrong write to the shop's point of sale costs real money and can't be
undone from this tool.

### VII. Every Feature Ships With Its Traces, Metrics and Logs

This principle adopts the Backstock project's observability setup unchanged, adapting
only the names.

**Stack (identical to Backstock)**
- Instrumentation: OpenTelemetry for TypeScript/Node, covering traces, metrics and logs.
- Pipeline: app → OpenTelemetry Collector → Grafana stack: Loki for logs, Tempo for
  traces, Prometheus/Mimir for metrics.
- SLOs are defined as OpenTelemetry metrics, with one Grafana dashboard per SLO.
- Local stack via Docker Compose in the repo, behind a compose profile, with dashboards
  pre-provisioned.

**Context.** Riviera Dig has a single shop, so where Backstock carries tenant context we
carry `staff_id` (pseudonymous, never the email address) plus the request ID or job ID.

**Minimums on top of Backstock**
- Logs: structured JSON, with no personal data or secrets. CI tests the redaction.
- Traces: spans on every HTTP request, every background job, and every outbound call to
  Common Ground or Discogs.
- Metrics: Common Ground and Discogs calls (total, failed, rate-limited 429), queue depth,
  job failures, staff checkout total mismatches.
- Health endpoints: `/healthz` (process alive) and `/readyz` (database reachable, last
  sync recent).
- CI checks that every SLO metric below exists and is exported.
- Tests assert that key flows emit their logs, metrics and traces. For example, a sync run
  produces a span tree, a metrics update and a structured log line with a correlation ID.

**Initial SLOs**, measured only while the host machine is running:

| SLO | Target |
|---|---|
| Verdict saved | ≥ 99.9% of verdict requests succeed; p95 latency < 300 ms |
| Next record ready | p95 < 500 ms to return the next record with its audio source |
| Inventory freshness | Nightly full sync succeeds within 26 h of the previous one, 99% of the time (missed runs caught up when the host starts) |
| Sold-record removal | A record sold in Common Ground leaves every pile within 20 min, 99% of the time |
| Staff checkout correctness | 100% of checkouts marked paid had zero total mismatch; ≥ 99% of started checkouts complete or stop safely |
| Audio resolvable | ≥ 95% of records that have an audio source resolve to something playable |
| Notification delivery | ≥ 99% of push notifications sent within 5 min of their trigger (outside quiet hours) |

The machine-readable SLO catalog is `ci/slo-catalog.json` (protected). It MUST match this
table.

Rationale: the tool runs unattended on a home machine. When something goes wrong,
telemetry is the only witness.

### VIII. Product Invariants Never Break

Each of these MUST be covered by tests:

- **Staff price:** the default rule is exactly
  `min(list, max(5, round(list × (list > 20 ? 0.7 : 0.5), 2)))`, in euros. The percentages,
  the €20 threshold and the €5 minimum are configurable in `shop_settings`, but the
  defaults MUST equal this rule.
- **Progress:** one current verdict per staff member per record. Every change is logged so
  undo works. A record with any verdict counts as heard, whichever screen produced it.
- **Dig order:** by box in shelf order, then by position in the box. Box digging MUST
  never reorder records; match % is only a badge.
- **Staff checkout:** after writing the order lines, the tool MUST re-read the Common
  Ground order and stop if `totals.grand` differs from the staff total. It MUST never mark
  an order paid after a mismatch.
- **Secrets:** the Common Ground Admin key and Discogs tokens MUST never reach the browser.
  CI MUST scan the built frontend bundle for secret-shaped strings.
- **Isolation:** nobody, admin included, can read or change another person's verdicts,
  pile or Discogs token. Staff accounts get 403 on every admin route.

Rationale: these are the rules the shop's money and the staff's trust depend on.

## Technology Stack and Delivery Order

**Stack**
- TypeScript throughout: a Node backend (`api`) and worker (same image, different
  command), plus the PWA (`web`). Postgres. Everything runs with `docker compose up`.
- pnpm workspaces with a committed lockfile and `--frozen-lockfile` installs. Exact
  dependency versions only.
- Prettier, ESLint (typescript-eslint strict type-checked preset) with zero warnings,
  `tsc --strict` with no implicit `any` and no unchecked casts, knip for dead code and
  unused dependencies.
- Vitest (unit and integration), Stryker (mutation), fast-check (property-based),
  Playwright with axe (end-to-end, accessibility, visual regression).
- Typed Common Ground clients are generated with GraphQL Code Generator from the schemas
  in `contracts/common-ground/`, so any operation that doesn't match the schema fails the
  build. Generated code is committed and CI fails if it is stale.
- The public URL is the `.env` setting `APP_URL`. The Cloudflare Tunnel is added once Antn
  has chosen the domain.

**Delivery order**
1. Foundation: repo, Spec Kit, constitution, CI, local Docker Compose and a hosting
   target. Deployable locally with `docker compose up` from the first PR.
2. `001` Observability baseline, before any business feature.
3. `002` Auth: magic link, invite only, roles admin and staff, Antn as the only admin.
   Strict TDD starts here.
4. Then the build order in `docs/digging-tool-handoff.md` section 11, starting with the
   Common Ground sync.

## Quality Gates (CI Pipeline)

Every check below is required on every PR, including dependency-update PRs. Thresholds
live in `ci/thresholds.json`.

**Static**
- Formatter check, and the strict linter with zero warnings.
- Strict type checking.
- Frozen lockfile install, no floating dependency versions.
- Dead-code and unused-dependency check.
- Generated Common Ground clients are up to date and every operation validates against
  the schemas.
- The suppression and threshold guard from Principle II.
- The FR traceability check from Principle III.

**Tests**
- Unit tests with branch coverage of at least 90% overall and at least 95% on domain code.
- Diff coverage: 100% of changed lines in domain code, at least 90% elsewhere.
- Mutation score of at least 80% on domain code.
- Property-based tests for the staff price rule (never above list, never below €5 unless
  list is lower, the 50%/30% boundary at exactly €20, rounding to the cent), dig ordering
  and undo.
- Integration tests against real Postgres: every migration runs up and down, the seed
  loads, and every repository query is exercised.
- Contract tests: Discogs and Common Ground mocks use recorded fixtures that are checked
  against the same contracts as the generated clients.
- End-to-end tests with Playwright against the full `docker compose` stack with mocked
  external APIs:
  - every user flow on the design canvas, at 390×844 and 1440×900
  - axe accessibility checks with no serious or critical violations
  - visual-regression screenshots of the main screens
- Flake guard: new or changed tests run 3 times, and any flake fails the build.

**Build and run**
- Every Docker image builds.
- `docker compose up` reaches all-green healthchecks within 120 seconds.
- A smoke test covers sign-in, digging a record, adding it to the pile, pulling it, and a
  staff checkout in dry-run mode (each step joins the smoke test as its feature lands).
- Trivy image scan, failing on high or critical issues.

**Security**
- gitleaks on the diff and on the full history.
- Dependency audit plus SAST (CodeQL and Semgrep), failing on high or critical findings.
- GitHub Actions pinned to commit SHAs, and third-party tools pinned to exact versions with
  verified checksums. Minimal `permissions:` on every workflow.
- Dependency-update PRs go through the same pipeline. Auto-merge is allowed only for patch
  updates, and only when everything is green.
- Authentication security tests: magic-link expiry and single use, session fixation, CSRF
  on every state-changing route, and role checks.
- Data isolation tests as in Principle VIII.

**Observability**
- SLO metric existence and export check, and the emission tests from Principle VII.

**Independent review**
- A separate reviewer agent runs on every PR in CI, with a fresh context and none of the
  implementing agent's conversation. It checks the diff against the spec, the plan and this
  constitution.
- It posts findings as PR review comments. Any blocking finding fails its check.
- The implementing agent MUST NOT resolve or dismiss reviewer findings. Only a new commit
  that the reviewer re-checks and passes clears them.

## Human Checkpoints

Antn does not review code, but these approvals are required and can't be skipped:

1. This constitution, and every amendment to it.
2. Each feature's `spec.md`, after `/speckit-clarify` and before `/speckit-plan`.
3. Any PR labelled `needs-human`.
4. Turning on the live Common Ground write flag, and only after the spikes in the handoff
   brief (section 10) have passed.

**How approval is given.** Agents open PRs through Antn's own GitHub account, and GitHub
does not let an author approve their own PR. So approval is the `human-approved` label
(and, for exceptions, `approved-exception`), applied by Antn himself in the GitHub web UI
or with his own `gh` login, after the PR's last commit. The `human-gate` check verifies
that each such label was applied by `@ajmjj` and not through any GitHub App, and every new
commit removes `human-approved`. Agents MUST NOT apply, remove or ask an app to apply
either label.

## Governance

- This constitution overrides every other practice, plan, task list and agent instruction
  in this repository. Where a plan or task conflicts with it, the constitution wins and the
  plan MUST be corrected.
- **Amendments:** by PR only, labelled `needs-human`, approved by Antn as described in
  Human Checkpoints. Each amendment states what changed, why, and what code or CI has to
  follow.
- **Versioning:** semantic versioning. MAJOR for removing or redefining a principle or
  gate, MINOR for a new principle or materially stronger rule, PATCH for wording only.
  Loosening any check is always at least MINOR and always needs Antn's approval.
- **Compliance:** `/speckit-plan` MUST include a constitution check. The reviewer agent
  checks every PR against this document. Any deviation needs either an amendment or an
  `approved-exception` label from Antn, recorded in the PR.
- Runtime guidance for agents lives in `CLAUDE.md`, and it MUST NOT contradict this file.

**Version**: 1.1.0 | **Ratified**: 2026-11-23 | **Last Amended**: 2026-11-23
