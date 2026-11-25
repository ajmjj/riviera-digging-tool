# Implementation Plan: Auth

**Branch**: `002-auth-plan` (feature directory `specs/002-auth`) | **Date**: 2026-11-25 |
**Spec**: [spec.md](./spec.md) (approved, ajmjj/riviera-digging-tool#55)

**Input**: Feature specification from `specs/002-auth/spec.md`

## Summary

Invite-only, magic-link sign-in for the api and the PWA. People, devices, sessions, links,
link codes, People action records and rate-limit events live in Postgres (migration
`0002_auth`). Every token and code is stored only as an HMAC under keys derived from
`SESSION_SECRET`, and each is consumed by one atomic `DELETE … RETURNING`. Sessions are
server-side, one per device, carried in a host-only, HttpOnly, SameSite=Strict cookie, and read
fresh on every request. CSRF uses a stateless HMAC token bound to the session, or before sign-in
to a pre-sign-in cookie, together with an exact `Origin` check. Rate limits count the client the
proxy reports in one header that it always overwrites: `$remote_addr` on the local listener,
Cloudflare's `CF-Connecting-IP` only on a tunnel-only listener. Email goes through one interface,
with SMTP to IONOS in production only and a capture transport everywhere else. Startup refuses
unsafe configuration and creates the first admin from `INITIAL_ADMIN_EMAIL`. A route inventory,
checked against the routes the api actually serves, drives the 401, 403, CSRF, GET-has-no-effect
and response-secret tests. Auth telemetry uses closed label sets and 001's redaction, and a
planted-value test proves that no personal data or secrets leak. Every response carries
frame, referrer and content-security protections (FR-042).

The security checklist review (`checklists/security.md`, 2026-11-25) changed FR-023, FR-028,
FR-032, FR-033, FR-036 and FR-040 and added FR-042; the plan follows (research R11, R13, R15,
R16).

Decisions and alternatives are in [research.md](./research.md) (R1–R16), the tables in
[data-model.md](./data-model.md), the interfaces in [contracts/](./contracts/), and the
end-to-end check in [quickstart.md](./quickstart.md).

## Technical Context

**Language/Version**: TypeScript 6.0 on Node ≥ 22.18 (type stripping), as in 001.

**Primary Dependencies**: existing Fastify 5.12.8, pg 8.23.1, zod 4.6.7, `@riviera/telemetry`.
New: `@fastify/cookie` (parsing only, research R3) and `nodemailer` with `@types/nodemailer`
(SMTP transport, R8). Each is pinned to an exact version by the task that first imports it.
HMAC, HKDF and random values come from `node:crypto`. The device-name parser is hand-written
(R5). The web app adds no framework (R13).

**Storage**: Postgres, migration `0002_auth` (seven tables, data-model.md). No new service.

**Testing**: Vitest unit tests for `domain/auth/*` (with fast-check property tests and Stryker
mutation, because they sit under the domain glob); `*.int.test.ts` against real Postgres for every
repository query, the races and the route-inventory-driven security tests; Playwright with axe at
390×844 and 1440×900 for the screens; a sign-in step in the smoke test.

**Target Platform**: Docker Compose on Antn's machine and the `ubuntu-24.04` CI runner; iPhone
Safari and desktop browsers for the PWA.

**Project Type**: web service (api) and PWA (web). The worker is untouched except that it now
needs `SESSION_SECRET`: both roles start from the same image and the same `loadConfig`, which
checks it for both (research R8). No worker code uses it in 002.

**Performance Goals**: auth adds one indexed session lookup per request, plus at most one
last-seen write a minute per device. Unknown and known addresses answer within 50 ms of each
other at the median (SC-008).

**Constraints**: no `as`, `any`, `!` or suppressions; no secret or personal data in logs, spans,
metric labels, responses or the bundle; no real email outside production; GET never changes
state beyond session bookkeeping.

**Scale/Scope**: one shop, fewer than 20 people, a few devices each.

No open `NEEDS CLARIFICATION`. The two questions that came up while planning were answered by
Antn (research R8 "Fresh install", R9 "The sample route").

## Constitution Check

*GATE: checked before Phase 0 and again after Phase 1 design. Both pass.*

| Principle / gate | How this plan complies | Status |
|---|---|---|
| I. CI is the only path to `main` | Every task is a PR through the existing checks. No new required check: the sign-in smoke step and the security tests run inside existing jobs. | ✅ |
| II. Never weaken the safety net | No threshold, suppression or ruleset change. Protected paths that implementation tasks touch (tasks.md): `.github/workflows/ci.yml` (T001: the stack env of R8, job-level `APP_URL` and `INITIAL_ADMIN_EMAIL`, the capture mount; T038: the bundle-scan step calls the new `ci/lib/bundle-scan.ts`), `ci/lib/sign-in.ts` and `ci/test/sign-in.test.ts` (T036), `ci/lib/obs-check.ts`, `ci/lib/latency.ts` and their tests (T037), and `ci/lib/smoke.ts`, `ci/lib/bundle-scan.ts` and their tests (T038). Each such task is labelled `needs-human` and says why. The plan PR (merged) touched only `specs/002-auth/` and `.env.example`, neither protected; it was `needs-human` because it asked for `approved-exception` (fr-trace, size). | ✅ |
| III. Spec first, fully traceable | Every FR-001…FR-042 maps to at least one named test below; the task PRs write those tests first. Until the last task, `fr-trace` fails on untested 002 FRs, and each PR asks Antn for `approved-exception`. | ✅ |
| IV. Tests lead and check something | Tests first in every task. The pure rules sit in `apps/api/src/domain/auth/`, so mutation testing and 95%/100% coverage apply (R12), which is stronger than required. Property tests cover email normalization, the rate-limit window, the People rules and the "at least one admin" invariant. No 001 test is weakened; registry and config test updates cite 002/FR-041 and FR-036. | ✅ |
| V. Small PRs | Tasks are sized at about 400 lines or less (tasks.md; the larger ones were split after the analysis review). **Deviation, closed**: the plan PR was about 900 lines of planning documents with no code, recorded in that PR for Antn's `approved-exception` as in 001. | ✅ (deviation was recorded) |
| VI. No live side effects | No Common Ground or Discogs call. Real email only from production with SMTP (FR-038); dev and CI capture to files; CI never sets `SMTP_URL`. | ✅ |
| VII. Traces, metrics, logs | Auth counters with closed labels in the registry, zero-initialised; `withStaff()` on every authenticated request; one structured line per auth event; a planted-value redaction test (R10). The catalog is unchanged. | ✅ |
| VIII. Product invariants | Secrets: no server secret in responses or the bundle; the response scan and the bundle scan are extended (R9). Isolation: per-person queries take the staff ID only from the session, never from the URL; admins see only the device count and "sign out everywhere" (FR-026, FR-028); "staff get 403 on every admin route" comes from the inventory-driven test. | ✅ |
| Quality gates, Security | Magic-link expiry and single use, session fixation, CSRF on every state-changing route and role checks are each a named test (matrix). | ✅ |
| **Delivery order, item 3** | It says "Antn as the only admin". Antn confirmed on 2026-11-25 that this means *at launch*, so admins may promote others (FR-022, FR-030); no amendment (R14, spec Assumptions). | ✅ (decided) |

**Post-design re-check**: still passes. The design adds no workspace or service; one compose
network (`edge`), one proxy listener and one bind mount for dev/CI mail are its only stack
changes.

## Project Structure

### Documentation (this feature)

```text
specs/002-auth/
├── spec.md
├── plan.md              # this file
├── research.md          # R1–R16
├── data-model.md        # migration 0002_auth
├── quickstart.md
├── contracts/
│   ├── http.md          # routes, answers, CSRF, cookies
│   └── email.md         # settings, messages, capture file
├── checklists/
│   ├── requirements.md
│   └── security.md
└── tasks.md             # /speckit-tasks: T001–T038
```

### Source Code (repository root)

```text
apps/api/src/
├── domain/auth/               # pure rules, mutation-tested (R12)
│   ├── email.ts               # normalize, validate
│   ├── expiry.ts              # link, code and session lifetimes and idle end
│   ├── rate-window.ts         # sliding-window decision and retry-after
│   ├── people-rules.ts        # which action applies; self and last-admin rules
│   └── device-name.ts
├── auth/
│   ├── plugin.ts              # the encapsulated auth context and its hooks
│   ├── browser-protections.ts # FR-042 headers on every api response (R15)
│   ├── keys.ts                # HKDF purpose keys, HMAC, token generation (R4)
│   ├── client-key.ts          # X-Riviera-Client-Ip, IPv6 /64 (R1)
│   ├── cookies.ts             # session and pre cookies (R3)
│   ├── csrf.ts                # onRequest hook (R2)
│   ├── session.ts             # auth hook, request.auth, last seen (R5)
│   ├── access.ts              # onRoute: every route declares access (R9)
│   ├── rate-limit.ts          # auth_rate_event repository (R7)
│   ├── links.ts, codes.ts     # issue, inspect, consume (R6)
│   ├── sign-in.ts             # the sign-in transaction (R6)
│   ├── people.ts              # People repository and transactions (R12)
│   ├── bootstrap.ts           # first admin (R11)
│   ├── telemetry.ts           # auth log events and counters (R10)
│   └── routes/{sign-in,me,devices,admin-people}.ts
├── email/{transport.ts,smtp.ts,capture.ts,templates.ts,sender.ts}
├── config.ts                  # + SESSION_SECRET, SMTP_URL, EMAIL_FROM, INITIAL_ADMIN_* (R8)
├── app.ts, startup.ts         # register auth; bootstrap after migrations; mail after listen
└── sample/routes.ts           # access "staff" (R9)
apps/api/migrations/0002_auth.{up,down}.sql
apps/api/test/auth/route-inventory.ts           # committed route lists (R9)
apps/api/test/auth/{fixtures.ts,snapshot.ts,planted.ts}  # rows and ageRows(); table snapshots; planted-value collector
packages/telemetry/src/{slo-metrics.ts,redact.ts}  # + auth counters, + rd[lsp]_ value rule
apps/web/src/{api.ts,shell.ts,sign-in.ts,confirm.ts,you.ts,people.ts}
e2e/{auth.spec.ts,people.spec.ts}, e2e/support/{mail.ts,fixtures.ts}   # shared admin session (R9)
proxy/nginx.conf               # client header; tunnel listener 8081; log format without IP/UA (R1); browser protections (R15)
docker-compose.yml             # edge network; env passthroughs
docker-compose.capture.yml     # dev/CI only: mail capture mount and EMAIL_CAPTURE_DIR
Makefile                       # up-dev: dev secret, test INITIAL_ADMIN_EMAIL, capture dir
.gitignore                     # .captured-mail/, .ci-session/
ci/lib/{sign-in,smoke,obs-check,latency,bundle-scan}.ts, ci/test/*, .github/workflows/ci.yml   # protected
```

**Structure Decision**: everything stays in the existing workspaces. Auth is api code with its
pure rules under `domain/`, and the web screens are plain modules like today's shell.

## Test Map

Every FR is named by at least one test (`002/FR-###` in the title). The files are under
`apps/api/test/` unless they start with `e2e/`, `ci/` or `packages/`. `int` means
`*.int.test.ts` against Postgres.

| FR | Test file(s) | What it asserts |
|---|---|---|
| 001 | `auth/admin-people.int` | only admins add people; no self-registration route is served (inventory) |
| 002 | `domain/email.test`, `auth/admin-people.int` | staff role, invited, one email; trim and case; duplicate refused (409) |
| 003 | `auth/link-request.int` | same 202 body for known, unknown, deactivated and cancelled addresses; email only for invited and active; median timing within 50 ms over 100 requests (SC-008) |
| 004 | `auth/keys.test`, `auth/links.int` | ≥ 256-bit `rdl_` tokens; the link starts with `APP_URL`; the database holds only the HMAC |
| 005 | `domain/expiry.test`, `auth/links.int` | 15 min and 7 days, judged by the server clock (Postgres `now()` in the query; tests age rows with the fixtures' `ageRows()`, the domain rule takes an injected `now`) |
| 006 | `auth/links.int` | used twice: refused; two concurrent confirms: exactly one session |
| 007 | `auth/links.int`, `e2e/auth.spec` | inspect consumes nothing; no confirm request before the button is pressed |
| 008 | `auth/links.int` | a new sign-in link kills older sign-in links, not the invite; resend kills both |
| 009 | `auth/links.int` | identical refusal for unknown, altered, expired, used, cancelled and deactivated |
| 010 | `auth/sign-in.int` | invited → active after either link; remaining links gone |
| 011 | `auth/sign-in.int` | new session and device; the pre-sign-in cookie and the old session no longer authenticate (fixation) |
| 012 | `auth/cookies.test`, `auth/keys.test` | HttpOnly, SameSite=Strict, host-only, Secure on HTTPS, `__Host-`; stored hash only |
| 013 | `domain/expiry.test`, `auth/session.int` | 90 days absolute, 30 days idle; ended session gives 401 and its device is removed |
| 014 | `domain/device-name.test`, `auth/devices.int` | default names; rename rules |
| 015 | `auth/session.int` | last seen updated within 1 minute, no more than one write a minute |
| 016 | `auth/devices.int` | list with current, rename, sign out one, others, current |
| 017 | `auth/devices.int` | store, remove and validate the push subscription; the tool works without one |
| 018 | `auth/codes.int` | 6 digits, 10 minutes, a new code replaces the old one, collision retry |
| 019 | `auth/codes.int` | signs in as the owner under FR-011; one refusal for unknown, used and expired |
| 020 | `domain/rate-window.test`, `auth/codes.int`, `proxy-config.test` | 10 wrong tries per client per 10 min, then even a correct code is refused; client header trust (R1) |
| 021 | `domain/rate-window.test`, `auth/link-request.int`, `auth/client-key.test` | 3 per address per 15 min (unknown too), 20 per client per hour, 429 with retry-after, no email |
| 022 | `auth/people.int` | the CHECK allows only admin and staff; the bootstrap admin is the only admin at launch |
| 023 | `auth/unauthenticated-401.int`, `auth/route-inventory.test` | 401 on every non-public served route; the public allow-list is exact |
| 024 | `auth/admin-403.int`, `auth/route-inventory.test` | 403 and no change for staff on every admin route; the list equals the served routes |
| 025 | `auth/session.int` | a role change or deactivation applies to the next request |
| 026 | `auth/isolation.int` | devices, sessions and subscriptions are reachable only by their owner, admins included (404) |
| 027 | `auth/response-secrets.int` | the scan of every served route as each role finds no secret field or value |
| 028 | `auth/admin-people.int`, `e2e/auth.spec` | list fields, device count, sign out everywhere; People and its actions at 1440×900 with a confirmation naming the person; at 390×844 only the "use a computer" note |
| 029 | `auth/admin-people.int` | resend and cancel only while invited; cancel removes the row, keeps the action without the address, allows a re-invite |
| 030 | `domain/people-rules.test` (property), `auth/people.int` | promote and demote; never self; concurrent mutual demotion leaves one admin |
| 031 | `auth/admin-people.int` | deactivation ends everything at once and keeps the record; reactivation keeps the staff ID; cancelling a reactivation returns to deactivated |
| 032 | `auth/admin-people.int` | one `people_action` per action, staff IDs only |
| 033 | `auth/bootstrap.int` | creates and invites once; a changed setting moves the pending invite (same staff ID, old links dead, one action record) until an admin signs in, and is ignored after; same setting: no new email; empty setting: starts and logs without an address; never logs the address or link |
| 034 | `auth/csrf.test`, `auth/csrf.int`, `auth/get-no-state.int` | 403 and no change on a missing or wrong token or origin, sign-in routes included; GET changes nothing but bookkeeping |
| 035 | `auth/response-secrets.int`, `ci/test/bundle-scan.test` | no server secret in responses; `rd[lsp]_` and 64-hex patterns absent from `apps/web/dist`. The file is created for FR-027 earlier; its FR-035 cases arrive only in the last task (T038), which is the first to name 002/FR-035 |
| 036 | `config.test` | refuses a missing or short `SESSION_SECRET`, missing SMTP and a plain-HTTP non-localhost `APP_URL` in production, naming the setting without its value |
| 037 | `email/transport.test`, `config.test` | one interface; `EMAIL_FROM` on rivierarecords.de; IONOS host allow-list; capture stores and sends nothing |
| 038 | `config.test` | `SMTP_URL` outside production refuses to start |
| 039 | `email/templates.test` | link, name and lifetime present; no staff ID or other secret |
| 040 | `auth/telemetry-planted.int`, `packages/telemetry/test/redact.test`, `proxy-config.test` | planted values, including a client IP and a User-Agent, absent from logs, spans and metrics; `rd[lsp]_` values redacted; the proxy's log format names no IP or User-Agent variable |
| 041 | `auth/telemetry.int`, `packages/telemetry/test/slo-metrics.test` | each event's counter and log line by outcome; closed label sets |
| 042 | `auth/browser-protections.int`, `proxy-config.test`, `e2e/auth.spec` | CSP, frame, referrer and nosniff headers on every served route (inventory), in the proxy config and on the pages |

The constitution's auth security tests map to FR-005/006 (expiry, single use), FR-011
(fixation), FR-034 (CSRF) and FR-024/030 (roles). The smoke test gains "sign in through the
captured invite" (R9), in `ci/lib/smoke.ts`.

## Delivery and review notes

- **Order** (for `/speckit-tasks`):
  1. config and email
  2. migration and domain rules
  3. keys, cookies, CSRF, the session hook and route access
  4. links, codes and sign-in
  5. rate limits and the proxy header
  6. devices
  7. People and the bootstrap
  8. telemetry
  9. web screens and e2e
  10. CI (smoke, sign-in helper, obs-check, ci.yml)

  The sample route switches to `staff` in the same PR as the obs-check and latency change, right
  after the CI sign-in helper, so `obs-check` never breaks. The response-secret and planted-value
  suites land in step 3 with the route inventory (decided by Antn, 2026-11-25), so each later
  route is scanned in its own PR.
- **fr-trace**: fails on every task PR until the last one has tested all 42 FRs; each PR asks
  Antn for `approved-exception` and carries `needs-human`.
- **Protected paths**: only T001 (the `ci.yml` environment of R8, which must merge before the
  config task makes production fail closed) and the CI tasks T036, T037 and T038 touch `ci/**` and
  `.github/**`, and they say so (tasks.md).

## Complexity Tracking

| Addition | Why needed | Simpler alternative rejected because |
|---|---|---|
| Tunnel-only proxy listener and `edge` network now, before `cloudflared` exists | The spec's assumption fixes which header is trusted from where; deciding and testing it now stops the tunnel PR from inventing it | Waiting would leave FR-020/021 with an untested trust rule and the tunnel PR free to trust `CF-Connecting-IP` on the public listener |
| Rate-limit events in Postgres | Limits must survive restarts and be atomic across concurrent requests | In memory: a restart resets an attacker's window |
| Inspect endpoint besides confirm | US1-3 and US1-4 refuse a spent link on opening, without spending it | Confirm-only would show the refusal only after pressing the button |
