# 001 carry-forward notes

Notes for later tasks of this feature, from review of earlier PRs. Each note goes into the PR
description of the task it names, and that PR either acts on it or says why not.

## T004 / T005

- Don't rely on `redactText` for raw headers or upstream error bodies. Use the research R4
  header allow-list and record no bodies.
- Fix the non-blocking finding from ajmjj/riviera-digging-tool#15: when a quoted authorization
  value is redacted (e.g. JSON `{"authorization":"Bearer x","user_id":1}`), the redaction should
  end at the closing quote instead of the end of the line. Check for a quote before the
  authorization-to-end-of-line rule, and add a test.

## T004 / T019

- In-memory test exporters go through the same export-guard (redaction) wrapper as the OTLP
  exporters.
- The `DropWarning` line carries `time`, `service` and `env`, and is validated against
  `contracts/log-line.schema.json`.

## T006 / T013

- Name a dev-only Common Ground credential variable for the mock's `Authorization` header. It is
  redacted and never sent to the browser.

## Spec follow-up (its own spec PR, not a task)

- 001/FR-005 should say that secret words match whole words of a field name, plus the
  run-together compound names (e.g. `ADMINKEY`) that T002 also matches. Research R4 already
  assumes the whole-word rule.

## T010 / T013 / T017 / T020 (from T003)

- Record through `createInstruments(meter, { routes })` from `@riviera/telemetry/instruments`.
  `routes` is the list of registered route templates; `unmatched` is always allowed.
- `riviera.queue.depth` reports 0 for every registered job name with no queued rows (research
  R18); `observe()` reports only what its callback passes to `report`, so T017 fills in the zeros.
- `@opentelemetry/sdk-metrics` is a dev dependency so far (only the T003 tests import it); T004
  moves it to `dependencies` when `sdk.ts` imports it.
