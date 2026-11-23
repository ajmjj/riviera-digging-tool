<!--
Sync Impact Report
- Version change: (template) → 1.0.0
- Basis: docs/constitution-input.md (binding input), docs/digging-tool-handoff.md,
  docs/checkout-api-findings.md
- Principles added: I–VIII (all new)
- Sections added: Quality Gates (CI Pipeline), Human Checkpoints, Governance
- Removed sections: none
- Deferred:
  - TODO(BACKSTOCK_OBSERVABILITY): Principle VII still has to adopt Backstock's logging,
    metrics, tracing, dashboard, alerting and SLO rules without changing them (only
    names adapted). Antn will paste them into the session. The minimums already in VII
    apply in the meantime.
  - TODO(RATIFICATION_DATE): set when Antn approves this constitution (Human Checkpoint 1).
- Templates: plan/spec/tasks templates read this file at runtime. No template edits needed.
-->
# Riviera Dig Constitution

This codebase is written entirely by AI agents and is **not reviewed line by line by a
human**. Every rule below exists so that a green CI run can stand in for code review.
"Antn" means the project owner, who is the sole CODEOWNER.

## Core Principles

### I. CI Is the Only Path to `main` (NON-NEGOTIABLE)

- `main` MUST only change through a pull request whose required checks are all green.
- Direct pushes, force-pushes and bypassing protection are forbidden for everyone, admins
  included.
- A change is "done" only when every required check on its PR is green. Local green runs
  count for nothing.

Rationale: with no human reading the code, the pipeline is the reviewer. Anything that can
skip it makes every other rule optional.

### II. Agents Never Weaken the Safety Net (NON-NEGOTIABLE)

- Changes to any of the following MUST be approved by Antn through CODEOWNERS:
  - `.github/`, `ci/`, `CODEOWNERS`
  - test, coverage, diff-coverage and mutation thresholds
  - formatter, lint, type-checker and security-scanner configuration
  - this constitution (`.specify/memory/constitution.md`)
- CI MUST fail any PR that adds any of the following, unless the PR carries the
  `approved-exception` label, which only Antn may apply:
  - skipped, focused or placeholder tests (`skip`, `only`, `todo`, `xit`, `fit`,
    `pytest.mark.skip`, and the like)
  - `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, `# type: ignore`, `noqa`
  - `--no-verify`
  - any lowered threshold
- Agents MUST NOT change the branch-protection rules. Antn applies them himself with the
  committed script.

Rationale: an agent under pressure to get to green will otherwise loosen the gate instead
of fixing the code.

### III. Spec First, Fully Traceable

- Every feature MUST go through `/speckit-specify → /speckit-clarify → /speckit-plan →
  /speckit-tasks → /speckit-implement`. Code with no spec requirement behind it MUST be
  rejected.
- Every functional requirement (`FR-###`) in `specs/**/spec.md` MUST be named by at least
  one test (for example `it("FR-012: …")`).
- A CI script MUST fail the build if any FR has no test, or if any test names an FR that
  does not exist.

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
- At most about 400 changed lines, not counting generated files and fixtures.
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

### VII. Observability by Default

> TODO(BACKSTOCK_OBSERVABILITY): adopt Backstock's logging, metrics, tracing, dashboard,
> alerting and SLO rules here without changing them, adapting only the names. Until then
> the minimums below are binding, and they stay binding afterwards wherever Backstock is
> silent.

- **Logs:** structured JSON to stdout, with a request ID and a correlation ID on every
  line. Logs MUST NOT contain personal data or secrets. CI MUST test the redaction.
- **Traces:** OpenTelemetry traces for every HTTP request, every background job and every
  outbound call to Common Ground or Discogs.
- **Metrics**, at minimum:
  - sync duration and outcome
  - Common Ground and Discogs calls, both total and rate-limited (HTTP 429)
  - job queue depth and job failures
  - verdicts per minute
  - staff checkouts started, succeeded and failed, and total mismatches
- **Local stack:** an observability stack in `docker compose`, behind a profile flag, with
  dashboards provisioned up front.
- **Health endpoints:** `/healthz` (the process is alive) and `/readyz` (the database is
  reachable and the last sync is recent).
- **Tested:** tests MUST assert that key flows emit their logs, metrics and traces. For
  example, a sync run produces a span tree, a metrics update and a structured log line with
  a correlation ID.

Rationale: the tool runs unattended on a home machine behind a tunnel. When something goes
wrong, telemetry is the only witness.

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

## Quality Gates (CI Pipeline)

Every check below is required on every PR, including Dependabot or Renovate PRs. A check
that does not apply yet (for example, before there is a frontend) MUST still run and pass
trivially, so it can't be dropped quietly later.

**Static**
- Formatter check, and a linter at its strictest preset with zero warnings allowed.
- Strict type checking: no implicit `any` and no unchecked casts (`mypy --strict` or
  pyright strict if Python is used).
- Lockfile committed, frozen installs (`--frozen-lockfile` or equivalent), no floating
  dependency versions.
- Dead-code and unused-dependency check.
- The suppression and threshold guard from Principle II.
- The FR traceability check from Principle III.

**Tests**
- Unit tests with branch coverage of at least 90% overall and at least 95% on domain code.
- Diff coverage: 100% of changed lines in domain code, at least 90% elsewhere.
- Mutation score of at least 80% on domain code.
- Property-based tests for the staff price rule (never above list, never below €5 unless
  list is lower, the 50%/30% boundary at exactly €20, rounding to the cent), dig ordering
  and undo.
- Integration tests against real Postgres (Testcontainers or a compose service): every
  migration runs up and down, the seed loads, and every repository query is exercised.
- Contract tests:
  - every Common Ground GraphQL operation is validated against the committed Admin and
    Client schemas in `contracts/common-ground/`, failing on any mismatch
  - typed clients are generated from those schemas
  - Discogs and Common Ground mocks use recorded fixtures that are checked against the same
    contracts
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
  staff checkout in dry-run mode.
- Trivy image scan, failing on high or critical issues.

**Security**
- gitleaks on the diff and on the full history.
- Dependency audit plus SAST (CodeQL and Semgrep), failing on high or critical findings.
- GitHub Actions pinned to commit SHAs, with minimal `permissions:` on every workflow.
- Dependency-update PRs go through the same pipeline. Auto-merge is allowed only for patch
  updates, and only when everything is green.
- Authentication security tests: magic-link expiry and single use, session fixation, CSRF
  on every state-changing route, and role checks.
- Data isolation tests as in Principle VIII.

**Observability**
- The emission tests from Principle VII.

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
3. Any PR labelled `needs-human`. Agents MUST apply that label to any PR that touches a
   CODEOWNERS path, asks for an exception, or writes to Common Ground for real.
4. Turning on the live Common Ground write flag, and only after the spikes in the handoff
   brief (section 10) have passed.

## Governance

- This constitution overrides every other practice, plan, task list and agent instruction
  in this repository. Where a plan or task conflicts with it, the constitution wins and the
  plan MUST be corrected.
- **Amendments:** by PR only, labelled `needs-human`, approved by Antn through CODEOWNERS.
  Each amendment states what changed, why, and what code or CI has to follow.
- **Versioning:** semantic versioning. MAJOR for removing or redefining a principle or
  gate, MINOR for a new principle or materially stronger rule, PATCH for wording only.
  Loosening any gate is at least MINOR and always needs Human Checkpoint 1.
- **Compliance:** `/speckit-plan` MUST include a constitution check. The reviewer agent
  checks every PR against this document. Any deviation needs either an amendment or an
  `approved-exception` label from Antn, recorded in the PR.
- Runtime guidance for agents lives in `CLAUDE.md`, and it MUST NOT contradict this file.

**Version**: 1.0.0 | **Ratified**: TODO(RATIFICATION_DATE): set on Antn's approval | **Last Amended**: 2026-11-23
