# Riviera Dig: agent guide

The constitution (`.specify/memory/constitution.md`) is binding and wins over this file.
This file only says how to work within it.

## Workflow

- Every feature: `/speckit-specify` → `/speckit-clarify` → (Antn approves `spec.md`) →
  `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`. No code without a spec FR.
- One task or a small group per PR, about 400 changed lines at most (generated files,
  lockfile and fixtures excluded). Use `.github/pull_request_template.md`.
- Push a branch and open a PR. CI decides; never push to `main`.

## Tests

- Write the test first, or with the code. Name requirements as `NNN/FR-###`, e.g.
  `it("002/FR-012: magic link expires after 15 minutes", …)`. FR numbers restart per spec.
- Until all of a feature's requirements have tests (its spec PR and early task PRs), the
  `fr-trace` check fails. Say so in the PR description and ask Antn for `approved-exception`;
  never work around the check.
- Don't edit a failing test to make it pass unless the spec changed; say which FR or spec
  change justifies any test change in the PR description.
- Domain code (pricing, verdicts, dig order, sync reconciliation, taste profile) goes in
  `apps/api/src/domain/` or `packages/domain/src/`: 95% coverage, 100% diff coverage and
  mutation testing apply there. Add `fast-check` when the first property test needs it.
- Integration tests are `*.int.test.ts` and run against real Postgres.

## Never

- Add suppressions: skipped/focused tests, `eslint-disable`, `@ts-ignore`,
  `@ts-expect-error`, coverage or mutation ignores, `--no-verify`. Fix the code instead.
- Use `as` casts (except `as const`), `any`, or non-null `!`. Narrow with type guards.
- Change protected paths (`ci/protected-paths.json`) without labelling the PR
  `needs-human` and explaining why.
- Add, remove or ask anything to add `human-approved` or `approved-exception`. Only Antn
  applies those, in person.
- Resolve or dismiss the reviewer's comments. Push a fix; the reviewer re-checks it.
- Call Common Ground or Discogs for real. Use mocks and recorded fixtures. Any Common
  Ground write sits behind `COMMON_GROUND_WRITES_ENABLED` (default off) with a dry run.
- Log personal data or secrets, or send secrets to the browser.

## Commands

```bash
pnpm install --frozen-lockfile
pnpm check                 # format, lint, typecheck, knip, FR trace, unit tests
make test-integration      # all tests with coverage against a throwaway Postgres
pnpm codegen               # regenerate Common Ground types after adding an operation
make up && make smoke      # full stack via docker compose, then the smoke test
pnpm e2e                   # Playwright against the running stack
BASE_SHA=origin/main node ci/guard.ts          # suppression guard on your branch
BASE_SHA=origin/main node ci/diff-coverage.ts  # after make test-integration
```

Common Ground operations go in `packages/common-ground/operations/{admin,client}/*.graphql`;
codegen validates them against `contracts/common-ground/`.
