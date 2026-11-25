---
description: "Task list for 002 Auth"
---

# Tasks: Auth

**Input**: Design documents from `specs/002-auth/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md),
[checklists/security.md](./checklists/security.md)

**Tests**: Required, and strict TDD starts here (constitution, Delivery order 3). Each task writes
its tests first, in the same PR, and names requirements as `002/FR-###` in the test titles
(plan.md, Test Map). Pure rules go in `apps/api/src/domain/auth/` (research R12), so 95%
coverage, 100% diff coverage and mutation testing apply to them. `*.int.test.ts` run against real
Postgres. Planted secret-shaped values (`rdl_…`, `rds_…`, `rdp_…`, 64-hex) are built at runtime,
so no secret-shaped literal is committed and gitleaks stays green without an allowlist change.

**One task = one PR** (constitution V): each task is sized to about 400 changed lines or less,
not counting `pnpm-lock.yaml`, generated code, fixtures and Playwright snapshots. The estimate is
given as `~N lines`. Every PR lists its task ID and FRs (`.github/pull_request_template.md`).

**fr-trace, `approved-exception` and `needs-human`**: until T035 merges, some of 002/FR-001…FR-042
have no test, so every task PR T001–T034 needs Antn's `approved-exception` for the untested-FR
part of the check. A PR that asks for an exception must carry `needs-human` (constitution II,
Labels), so **every task PR T001–T034 is labelled `needs-human`**, and the human gate then also
needs Antn's `human-approved` after its last commit. Say both in each PR description. **T035 is
the first PR that must pass `fr-trace` with no exception**: it adds the first test for 002/FR-035
(see the matrix). It is still `needs-human`, because it touches protected paths.

**Protected paths** (`ci/protected-paths.json`): only **T001** (`.github/workflows/ci.yml`),
**T034** (`ci/**`) and **T035** (`ci/**`, `.github/workflows/ci.yml`) touch them. Their PR
descriptions say which paths and why. No other task may touch a protected path. That includes
every `tsconfig*.json`, `knip.json`, `vitest.config.ts`, `stryker.config.mjs`,
`playwright.config.ts`, `eslint.config.js`, `contracts/**` and `ci/scope.json`. None needs a
change: `ci/scope.json` already covers `apps/api/src/domain/**`, and Playwright already runs at
390×844 and 1440×900. If a task turns out to need one, split that change into its own
`needs-human` PR.

**Why T001 touches `ci.yml` before the CI tasks** (plan.md "Delivery and review notes" is corrected to match):
T002 makes production refuse to start without `SESSION_SECRET`, `SMTP_URL` and `EMAIL_FROM`.
An unset `DEPLOYMENT_ENVIRONMENT` means production (001 R17), and the `stack` job's plain stack
starts from `cp .env.example .env`. So T002 alone would turn the `stack` job red. T001 first
gives CI the environment research R8 fixes for it (`DEPLOYMENT_ENVIRONMENT=ci`, the placeholder
secret, a test `INITIAL_ADMIN_EMAIL`, the mail capture mount). Setting variables nothing reads
yet is harmless.

**The sample route until T034** (decided by Antn, 2026-11-25): from T009 on, `buildApp` registers
the auth hooks (CSRF, session, access, browser protections) and every 002 route in one
encapsulated Fastify context. 001's `POST /sample/trace` stays in a sibling context, exactly as
today, so `ci/obs-check.ts`, `ci/lib/latency.ts` and 001's sample tests keep working. The route
inventory (T011) names it in one constant, `SAMPLE_ROUTE_PENDING_002`, and its test checks that
this is the only served route outside the auth context. T034 deletes the constant and moves the
route in with `staff` access and CSRF, in the same PR as `ci/lib/sign-in.ts` and the obs-check
change. The route exists only in development and CI (001 R17), so nothing live is exposed.

**Route inventory rule**: from T011 on, every task that adds a route adds it to
`apps/api/test/auth/route-inventory.ts` (with its access and a sample request) in the same PR.
Otherwise `route-inventory.test.ts` fails. The 401, 403, CSRF, GET-no-state, browser-protection
and response-secret suites (T011, T012, T021, T025) are driven by that list, so each new route is
covered by them as soon as it lands.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can be worked on in parallel with the other [P] tasks of the same phase once its
  listed dependencies have merged (disjoint files).
- **[Story]**: US1…US6 from spec.md. Setup, foundational and CI tasks carry no story label.
- Phases follow plan.md "Delivery and review notes", steps 1–10, not story priority. Each task
  names the stories it serves.

---

## Phase 1: Setup: config and email (delivery step 1)

**Purpose**: CI can run the stack under the new settings; the api reads and refuses settings per
FR-036–FR-038; email goes through one interface with a capture transport outside production.

- [ ] T001 CI and compose environment for the auth settings (research R8, contracts/email.md). In `.github/workflows/ci.yml` `stack` job: job-level `COMPOSE_FILE=docker-compose.yml:docker-compose.capture.yml` and `E2E_BASE_URL=http://localhost:8080` (the `APP_URL` origin of `.env.example`: from T009 on, a browser on `127.0.0.1` would send a foreign `Origin` and get 403; `playwright.config.ts` already reads the variable, so it needs no change), and on **both** stack-up steps `DEPLOYMENT_ENVIRONMENT=ci`, `SESSION_SECRET=dev-only-session-secret-0000000000000000`, `INITIAL_ADMIN_EMAIL=admin@ci.invalid`, with `.captured-mail/` created (writable by the api container user) before `up`; `SMTP_URL` is never set. `docker-compose.yml`: api passthroughs `SESSION_SECRET`, `SMTP_URL`, `EMAIL_FROM`, `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_NAME`, worker passthrough `SESSION_SECRET`, each `${VAR:-}` (empty default, nothing secret committed). New `docker-compose.capture.yml`: bind mount `./.captured-mail:/var/lib/riviera/mail` on the api and `EMAIL_CAPTURE_DIR=/var/lib/riviera/mail`. `Makefile` `up-dev`: empties and creates `.captured-mail/`, adds the override file, passes the placeholder secret, `INITIAL_ADMIN_EMAIL=admin@dev.invalid` and `DEPLOYMENT_ENVIRONMENT=development`. `.gitignore` += `.captured-mail/` and `.ci-session/`. Tests in `apps/api/test/compose.test.ts`: every new passthrough defaults to empty; no compose file or Makefile target sets `SMTP_URL`; the capture mount exists only in `docker-compose.capture.yml`. **FR-036, FR-038** · `needs-human` (`.github/workflows/ci.yml`: the stack would otherwise fail once T002 fails closed) · ~150 lines
- [ ] T002 Config in `apps/api/src/config.ts` per research R8's table: `SESSION_SECRET` (a 001 `Secret`; at least 32 UTF-8 bytes everywhere; in production it must not start with `dev-only`), `SMTP_URL` (production only, `smtp:`/`smtps:` with `requireTLS`, host on the IONOS allow-list `smtp.ionos.de`/`smtp.ionos.com`, credentials kept in a `Secret`; any value outside production refuses to start, FR-038), `EMAIL_FROM` (production: required, domain exactly `rivierarecords.de`; elsewhere defaults to `dev-capture@localhost.invalid`), `EMAIL_CAPTURE_DIR` (optional; outside production only), `INITIAL_ADMIN_EMAIL` (optional, must be an address) and `INITIAL_ADMIN_NAME` (optional, 1–80 characters), and the production `APP_URL` rule (`https:`, or `http:` only on `localhost`/`127.0.0.1`). Every refusal names the setting and never prints its value (contracts/email.md wording). The worker reads `SESSION_SECRET` too. `.env.example` names each new setting with an empty value. Tests in `apps/api/test/config.test.ts`: each refusal, its message without the planted value, each accepted case. 001 config tests that build a production config gain the new required settings; that change cites 002/FR-036. Depends on T001. **FR-033, FR-036, FR-037, FR-038** · ~300 lines
- [ ] T003 Email in `apps/api/src/email/`: `transport.ts` (`EmailTransport`, `OutgoingEmail` per data-model.md §8, kind `invite` \| `sign_in`), `smtp.ts` (nodemailer from the T002 SMTP config), `capture.ts` (in-memory capture for tests; file capture writing one JSON file per message, `<iso-time>-<kind>-<n>.json` with `to, kind, subject, text, html, link, at`, under `EMAIL_CAPTURE_DIR`; never opens a connection), `templates.ts` (contracts/email.md "Messages": subject, name, link, "valid for 15 minutes" / "valid for 7 days", the ignore line; text and HTML parts; the name HTML-escaped and never in the subject, research R16), `sender.ts` (`sendNow()` that the admin flows await, returning `sent`/`failed`, and `sendInBackground()`, the in-process promise chain of research R6 that logs failures without the address). Transport choice: SMTP only when the config has it (production), otherwise capture. Tests `apps/api/test/email/transport.test.ts` (capture stores and sends nothing; file layout; SMTP transport built only from a production config, with a fake nodemailer and no network) and `apps/api/test/email/templates.test.ts` (link, name and lifetime present; no staff ID, no other link, no tracking image; a name with `<script>` is escaped). Depends on T002. Adds `nodemailer` and `@types/nodemailer` (exact versions). **FR-037, FR-038, FR-039** · ~380 lines

**Checkpoint**: the stack starts in CI and with `make up-dev`; production refuses to start without
its settings and names the missing one.

---

## Phase 2: Foundational: migration and domain rules (delivery step 2)

- [ ] T004 Migration `apps/api/migrations/0002_auth.up.sql` and `0002_auth.down.sql` with the seven tables of data-model.md and every column, CHECK, FK and index stated there: §1 `staff.id`, `staff.email` (CHECK `email = lower(btrim(email))`, unique index `staff_email_key`), `staff.name`, `staff.role`, `staff.status`, `staff.invited_at`, `staff.invited_by` (no FK), `staff.first_signed_in_at`, partial index `staff_admin_idx`; §2 `magic_link.token_hash`, `magic_link.staff_id`, `magic_link.kind`, `magic_link.expires_at`, index `(staff_id, kind)`; §3 `device.id`, `device.staff_id`, `device.name`, `device.last_seen_at`, `device.push_subscription`; §4 `session.token_hash`, `session.device_id` (unique, cascade from `device`), `session.staff_id`, `session.expires_at`, `session.last_seen_at`, `session_staff_idx`; §5 `link_code.code_hash`, `link_code.staff_id` (unique), `link_code.expires_at`; §6 `people_action.actor_staff_id`, `people_action.target_staff_id` (no FK), `people_action.action` (all nine values, `host_readdress` included), `people_action.detail`; §7 `auth_rate_event.bucket`, `auth_rate_event.key_hash`, `auth_rate_event.at` and its index. Tests `apps/api/test/integration/migrate.int.test.ts` (extend): 0002 runs up, down and up again; CHECKs reject a third role, a bad status, kind, action or bucket, an unnormalized email, a duplicate email and a non-`isStaffId` ID; `people_action` **accepts `host_readdress`** and every other listed action; deleting a person cascades to links, devices, sessions and codes but keeps their `people_action` rows. New `apps/api/test/integration/host-readdress.int.test.ts` (follow-up from the review of ajmjj/riviera-digging-tool#58): it reads the SQL block of quickstart.md "The only admin lost their mailbox" **from the file**, so the document and the test can't drift. It fills in the ID and a mixed-case, space-padded address and runs it against Postgres. For an active admin: `INSERT 0 1`; the address is stored normalized; that person's links, link code, devices and sessions are gone; one `host_readdress` row with a null actor and a `detail` holding no address; other people untouched. For an unknown ID, a staff member and a deactivated admin: `INSERT 0 0` and no table changes. Depends on T002 (the migration runner is 001's). **FR-002, FR-022, FR-032** · ~380 lines
- [ ] T005 [P] Domain rules `apps/api/src/domain/auth/email.ts` (normalize: trim, NFC, lower case; validate; the same rule as data-model.md `staff.email`) and `apps/api/src/domain/auth/expiry.ts` (link lifetimes 15 min / 7 days, link-code lifetime 10 min, session 90 days absolute and 30 days idle, "is alive" from an injected `now`; data-model.md `magic_link.expires_at`, `link_code.expires_at`, `session.expires_at`, `session.last_seen_at`). Tests `apps/api/test/domain/auth/email.test.ts` and `expiry.test.ts` with fast-check properties (normalize is idempotent; case and surrounding spaces never change the result; each lifetime boundary is exact to the millisecond, at `expires_at` itself refused). No dependencies. Adds `fast-check` to `apps/api` devDependencies (same exact version as `packages/telemetry`). **FR-002, FR-005, FR-013, FR-018** · ~250 lines
- [ ] T006 [P] Domain rules `apps/api/src/domain/auth/rate-window.ts` (sliding-window decision and `retryAfterSeconds` from the oldest event in the window; research R7 limits: `link_address` 3/15 min, `link_client` 20/h, `code_client` 10/10 min; data-model.md `auth_rate_event.bucket`) and `apps/api/src/domain/auth/device-name.ts` (research R5 User-Agent → `{platform} · {browser}`; rename rule 1–60 characters trimmed, data-model.md `device.name`). Tests `apps/api/test/domain/auth/rate-window.test.ts` (property: never more than the limit inside any window; exactly at the limit refused; retry-after positive and at most the window) and `device-name.test.ts` (a table of real User-Agent strings for iPhone, iPad, Android, Mac, Windows and Linux; unknown → `Device · Browser`). **FR-014, FR-020, FR-021** · ~300 lines
- [ ] T007 [P] Domain rules `apps/api/src/domain/auth/people-rules.ts` (research R12, data-model.md §1 state transitions): which of invite, resend, cancel, deactivate, reactivate, role change and sign out everywhere applies to a target's `staff.status`, `staff.role` and `staff.first_signed_in_at` (cancel → delete the row or return to `deactivated`); never demote, deactivate or sign out everywhere the actor; deactivate applies only to `active` people, never to `invited` ones (contracts/http.md `409` and the data-model.md §1 diagram; FR-031 as clarified 2026-11-25: deactivation applies to active people only, and FR-029's cancel is the action for invited people), so a person with `staff.first_signed_in_at` null can never be deactivated and a cancelled first invite always deletes the row; refuse any change that leaves no active admin once any admin has signed in. Returns a closed `reason` set for contracts/http.md `409` bodies. Tests `apps/api/test/domain/auth/people-rules.test.ts`: one example per transition and refusal, plus fast-check properties over random teams and random action sequences (at least one active admin always remains once an admin has signed in; the actor never loses admin or active status through their own action; cancel never removes a person who has signed in; deactivating an invited person is refused). **FR-028, FR-029, FR-030, FR-031** · ~320 lines

---

## Phase 3: Foundational: keys, cookies, CSRF, session hook and route access (delivery step 3)

- [ ] T008 [P] `apps/api/src/auth/keys.ts` (research R4: HKDF-SHA256 from `SESSION_SECRET` to `k_token`, `k_code`, `k_csrf`, `k_rate`; `hmac(key, value)` → `Buffer`; generators for `rdl_` link tokens, `rds_` session IDs, `rdp_` pre-sign-in tokens, `stf_` staff IDs and 6-digit codes via `crypto.randomInt`; data-model.md `staff.id`, `magic_link.token_hash`, `session.token_hash`, `link_code.code_hash`) and `apps/api/src/auth/cookies.ts` (research R3: `__Host-rd_session` on HTTPS, `rd_session` on plain-HTTP localhost; HttpOnly, SameSite=Strict, Path=/, no Domain, Secure on HTTPS, Max-Age 90 days; `rd_pre` per R2; clear helpers). Tests `apps/api/test/auth/keys.test.ts` (formats and lengths, ≥ 256 bits for links and sessions, staff IDs pass `isStaffId`, codes always 6 digits and zero-padded, different purposes give different keys, a different secret gives a different HMAC) and `apps/api/test/auth/cookies.test.ts` (each attribute on HTTP and HTTPS `APP_URL`). Adds `@fastify/cookie` (exact version, parsing and serializing only). **FR-004, FR-012, FR-018** · ~300 lines
- [ ] T009 The auth plugin `apps/api/src/auth/plugin.ts`, registered from `apps/api/src/app.ts` as the encapsulated auth context of "The sample route until T034" (sample routes stay outside it), with the first two hooks: `apps/api/src/auth/csrf.ts` (research R2: `onRequest`, before body parsing, for every method other than GET/HEAD/OPTIONS: `X-CSRF-Token` must equal `base64url(HMAC(k_csrf, binding))` under `timingSafeEqual`, binding = the session's token hash or the `rd_pre` value; `Origin` must equal `APP_URL`'s origin, a missing `Origin` refused; refusal `403 {"error":"forbidden"}` before any handler) and `apps/api/src/auth/browser-protections.ts` (research R15: the CSP, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff` on every response of the app, health and errors included). Route `GET /auth/csrf` in `apps/api/src/auth/routes/sign-in.ts` (sets `rd_pre` when there is neither a session nor `rd_pre`; returns `csrfToken`). Tests `apps/api/test/auth/csrf.test.ts` via `app.inject()` on a test app with a throwaway POST route: missing token, wrong token, token for another binding, foreign origin, missing origin → 403 and the handler never runs; a valid pair passes; GET/HEAD/OPTIONS are not checked; and `apps/api/test/auth/browser-protections.test.ts` (headers on a 200, a 404 and a 500). Depends on T008. **FR-034, FR-042** · ~350 lines
- [ ] T010 [US2] [US3] Session hook `apps/api/src/auth/session.ts` (research R5): an `onRequest` hook after CSRF reads the session cookie and runs one query joining `session` to `staff` by `HMAC(k_token, id)`; alive per data-model.md §4 (`session.expires_at`, `session.last_seen_at` idle end) and `staff.status = 'active'`. It sets `request.auth` (data-model.md §9, a typed accessor, no casts), calls 001's `withStaff()`, updates `session.last_seen_at`/`device.last_seen_at` at most once a minute, and on a found-but-ended session deletes its device. A database error answers `503 {"error":"unavailable"}`. Routes `GET /me` (staffId, name, role, csrfToken) and `POST /auth/sign-out` (ends the current session through the device delete, clears the cookie, 204). Test helper `apps/api/test/auth/fixtures.ts` inserts a person, device and session directly with T008's keys (sign-in arrives in T014). Tests `apps/api/test/auth/session.int.test.ts`: 90-day and 30-day ends give 401 and remove the device; last seen written at most once a minute and within 1 minute; a role change or deactivation applies to the very next request; `GET /me` reflects the fresh role; sign-out of the current device gives 401 on the next request; database down → 503. Depends on T004, T005, T009. **FR-013, FR-015, FR-016, FR-025** · ~380 lines
- [ ] T011 [US3] Route access `apps/api/src/auth/access.ts` (research R9): an `onRoute` hook that throws at startup unless every route in the auth context declares `config.access` (`public` \| `staff` \| `admin`); `public` only on the fixed allow-list (health plus `GET /auth/csrf`, `POST /auth/links`, `POST /auth/links/inspect`, `POST /auth/links/confirm`, `POST /auth/codes/redeem`, so later tasks only implement them); every `/admin/*` route is `admin` and every `admin` route is under `/admin/`; a `preHandler` answers `401 {"error":"sign_in_required"}` then `403 {"error":"forbidden"}` in contracts/http.md order. Health routes declare `public`. `apps/api/test/auth/route-inventory.ts` exports `PUBLIC_ROUTES`, `ADMIN_ROUTES`, `STATE_CHANGING_ROUTES` (each `{ method, url, sample }`) and `SAMPLE_ROUTE_PENDING_002`. Tests `apps/api/test/auth/route-inventory.test.ts` (builds the full app with sample routes on, collects `onRoute`: every served admin and state-changing route is listed and every listed route is served; the public allow-list is exact; the only route outside the auth context is `SAMPLE_ROUTE_PENDING_002`; a test app with an undeclared, a misplaced `admin` and an off-list `public` route each fails to start) and `apps/api/test/auth/unauthenticated-401.int.test.ts` (every served non-public route answers 401 without a session and with an ended one). Depends on T010. **FR-023, FR-024** · ~380 lines
- [ ] T012 [US3] Inventory-driven security suites: `apps/api/test/auth/csrf.int.test.ts` (every `STATE_CHANGING_ROUTES` entry, signed out and signed in: missing token, wrong token, another session's token, foreign origin, missing origin → 403, and a snapshot of every auth table shows no change; the CSRF answer comes before the 401), `apps/api/test/auth/get-no-state.int.test.ts` (every served GET route, as visitor, staff and admin, leaves every table unchanged except `last_seen_at` and ended-session cleanup) and `apps/api/test/auth/browser-protections.int.test.ts` (the four headers on every served route of the inventory). Shared table-snapshot helper in `apps/api/test/auth/snapshot.ts`. Fix any gap in the owning module in the same PR. Depends on T011. **FR-023, FR-034, FR-042** · ~300 lines

**Checkpoint**: every route the api serves (except the pending sample route) is behind CSRF, the
session check and declared access, and the inventory keeps it that way.

---

## Phase 4: Links, codes and sign-in: US1, US2, US5 (delivery step 4)

**Goal**: an invite or sign-in link signs a person in through the confirm step; a link code signs
in an extra device. **Independent test**: US1 and US2 independent tests (spec.md) via
`app.inject()` with the in-memory capture; US5's from T016.

- [ ] T013 [US1] [US2] Links repository `apps/api/src/auth/links.ts` (research R4, R6, data-model.md §2 `magic_link.token_hash`, `magic_link.kind`, `magic_link.expires_at`): `issueSignIn(staffId)` deletes the person's `sign_in` rows only; `issueInvite(staffId)` deletes all their rows; both also delete that person's expired rows and return `${APP_URL}/sign-in/confirm#t=<token>`; `inspect(token)` reads without touching rows; `consume(token, tx)` is the single `DELETE … WHERE token_hash = $1 AND expires_at > now() RETURNING …`. Route `POST /auth/links/inspect` (`200 {"state":"confirm","kind"}` or the one `410 link_refused` body of contracts/http.md). A settable clock for tests. Tests `apps/api/test/auth/links.int.test.ts`: the link starts with `APP_URL` and the database holds only the HMAC (no row contains the token); 15 min and 7 days judged by the server clock; inspect changes nothing (table snapshot); a new sign-in link kills older sign-in links but not the invite; a new invite kills both kinds; the refusal is byte-identical for unknown, altered by one character, truncated, from another `SESSION_SECRET`, expired, used, cancelled and deactivated. Depends on T011. **FR-004, FR-005, FR-007, FR-008, FR-009** · ~350 lines
- [ ] T014 [US1] [US2] Sign-in transaction `apps/api/src/auth/sign-in.ts` (research R6, R5 "Fixation"): consume the link, lock the person `FOR UPDATE`, require `invited` or `active`; if `invited`, set `active` and `staff.first_signed_in_at` once; delete all their remaining links and their ended devices; delete the device of any presented session; insert `device` (default name from T006, data-model.md `device.name`) and `session`; after commit set the session cookie, clear `rd_pre` and return the new `csrfToken` and `me`. Route `POST /auth/links/confirm`. Tests `apps/api/test/auth/sign-in.int.test.ts`: invited → active after an invite link and after a sign-in link (US2-5); the other links are gone; a new session and device each time; the pre-sign-in cookie and a previously presented session no longer authenticate (fixation, SC-003); the cookie attributes of T008 on the real response. Extend `links.int.test.ts`: confirming twice → refused; two concurrent confirms of one link → exactly one session; a deactivated person's link → refused. Depends on T006, T013. **FR-006, FR-010, FR-011** · ~380 lines
- [ ] T015 [US2] `POST /auth/links` (research R6): normalize with T005, look up, and for an `invited` or `active` person issue a sign-in link and hand the email to `sendInBackground()`; every case answers the same `202` body of contracts/http.md (`400 {"error":"invalid"}` for a malformed address, never echoed). Rate limits come in T017. Tests `apps/api/test/auth/link-request.int.test.ts`: identical status, headers and body for active, invited, unknown, deactivated and cancelled addresses; an email is captured only for active and invited; mixed case and spaces reach the same person; a failing transport still answers 202 and logs without the address; the median of 100 known against 100 unknown requests is within 50 ms (SC-008). Every request in this file uses its own address and its own `X-Riviera-Client-Ip`, so T017's limits never answer 429 here and T017 needs no change to these tests. Depends on T003, T014. **FR-003** · ~280 lines
- [ ] T016 [US5] Link codes `apps/api/src/auth/codes.ts` (research R6, data-model.md §5 `link_code.code_hash`, `link_code.staff_id`, `link_code.expires_at`): issuing deletes the person's code and every expired code, inserts `HMAC(k_code, code)`, and retries on a `code_hash` collision up to 5 times; redeeming consumes atomically and then runs T014's sign-in transaction (method `link_code`). Routes `POST /me/link-codes` (`201 {"code","expiresAt"}`) and `POST /auth/codes/redeem` (as confirm; refusal `410 {"error":"code_refused"}`). Tests `apps/api/test/auth/codes.int.test.ts`: 6 digits, 10 minutes, a new code replaces the old one; a forced collision retries; redeeming signs in as the owner with a new session and device under FR-011; one refusal for unknown, used and expired; a deactivated owner's code is refused. Depends on T014. **FR-011, FR-018, FR-019** · ~320 lines

**Checkpoint**: US1 and US2 work through `app.inject()`; US5's code works without its rate limit.

---

## Phase 5: Rate limits and the proxy header: US2, US5 (delivery step 5)

- [ ] T017 [US2] [US5] `apps/api/src/auth/client-key.ts` (research R1: `X-Riviera-Client-Ip` accepted only if `net.isIP()` accepts it, else the socket address; IPv6 by /64; `X-Forwarded-For` never read) and the rate-limit repository `apps/api/src/auth/rate-limit.ts` (research R7, data-model.md §7 `auth_rate_event.bucket`, `auth_rate_event.key_hash`: keys are `HMAC(k_rate, …)`; check and record under `pg_advisory_xact_lock`; events older than an hour deleted on insert; the decision from T006). Applied to `POST /auth/links` (both limits before the lookup, for unknown addresses too) and `POST /auth/codes/redeem` (the count checked first, so a correct code is refused at 10; only wrong attempts recorded). Answer `429 {"error":"rate_limited","retryAfterSeconds"}` plus `Retry-After`, no email. Tests `apps/api/test/auth/client-key.test.ts` (spoofed `X-Forwarded-For` ignored, invalid header → socket address, two IPv6 addresses in one /64 share a key), extend `link-request.int.test.ts` (fourth request for one address within 15 min → 429 with the wait and no fourth email, known and unknown alike; 21st from one client within the hour → 429; concurrent requests never exceed the limit; no row holds the address or IP) and `codes.int.test.ts` (10 wrong tries, then a correct code → 429; another client unaffected). Depends on T006, T015, T016. **FR-020, FR-021** · ~380 lines
- [ ] T018 [P] Proxy `proxy/nginx.conf` (research R1, R15): `proxy_set_header X-Riviera-Client-Ip $remote_addr` on the `listen 80` block, which never mentions `cf_connecting_ip`; a `listen 8081` tunnel block that uses `$http_cf_connecting_ip`, or `$remote_addr` when it is empty; a `log_format` for both with time, method, path without query, status, bytes, duration and request ID, and without `$remote_addr`, `$http_x_forwarded_for`, `$http_cf_connecting_ip` or `$http_user_agent`; the four browser-protection headers with `always`. `docker-compose.yml`: network `edge` that only `proxy` joins; 8081 in no `ports:`. Tests `apps/api/test/proxy-config.test.ts` (extend) and `apps/api/test/compose.test.ts` (extend). Depends on T001. **FR-020, FR-021, FR-040, FR-042** · ~220 lines

---

## Phase 6: Devices: US6 (delivery step 6)

**Goal**: a person lists, renames and signs out their own devices and manages their push
subscription; nobody reaches anyone else's. **Independent test**: US6's (spec.md).

- [ ] T019 [US6] `apps/api/src/auth/routes/devices.ts` with a devices repository that takes the staff ID only from `request.auth` (FR-026): `GET /me/devices` (live sessions only, `current` marked), `PATCH /me/devices/:id` (rename per T006, data-model.md `device.name`), `DELETE /me/devices/:id` and `POST /me/devices/sign-out-others`, all ending sessions through the device delete; another person's device answers 404. Tests `apps/api/test/auth/devices.int.test.ts` (list, rename including the 1–60 rule, sign out one, others, current; the signed-out device's next request is 401) and `apps/api/test/auth/isolation.int.test.ts` (two people and an admin: each device route with another person's device ID answers 404 and changes nothing, admins included; sessions likewise). Depends on T014. **FR-014, FR-016, FR-026** · ~380 lines
- [ ] T020 [US6] Push subscription routes `PUT` and `DELETE /me/devices/current/push-subscription` (research R5: zod schema for data-model.md `device.push_subscription`, `endpoint` an https URL ≤ 2 KB, `keys.p256dh`, `keys.auth`; never logged, never returned). Signing a device out removes its subscription with the row. Tests: extend `devices.int.test.ts` (store, replace, remove; invalid bodies → 400 without echo; every route works on a device without one) and `isolation.int.test.ts` (one person's request never touches another's subscription). Depends on T019. **FR-017, FR-026** · ~200 lines

---

## Phase 7: People and the bootstrap: US4, US1 (delivery step 7)

**Goal**: the admin runs the team; a fresh install invites the first admin. **Independent test**:
US4's (spec.md), and quickstart §2 steps 1–3.

- [ ] T021 [US1] [US4] People repository `apps/api/src/auth/people.ts` (research R12: one transaction per mutation, actor and target locked `FOR UPDATE` in ID order, the actor re-checked as an active admin, the T007 decision mapped to SQL, the at-least-one-admin assertion after the change; one `people_action` row per success, data-model.md §6 `people_action.actor_staff_id`, `.target_staff_id`, `.action`, `.detail` with closed values only). Routes in `apps/api/src/auth/routes/admin-people.ts`: `GET /admin/people` (contracts/http.md fields; `lastSeenAt` the newest live device; `deviceCount` from live sessions, omitted on the caller's row; never device names) and `POST /admin/people` (invite: data-model.md `staff.email` normalized by T005, `staff.name` 1–80 trimmed, role `staff`, status `invited`, `staff.invited_by`; an invite link; `sendNow()`; `201` with `email: sent|failed`; `409 already_listed` with the status for any existing address). Tests `apps/api/test/auth/admin-people.int.test.ts` (invite creates an invited staff member and one captured email; trim and case; duplicate against invited, active and deactivated; transport failure → `failed` with the person and link kept; list fields and device count; no self-registration route is served), `apps/api/test/auth/people.int.test.ts` (the role CHECK, one `people_action` per action with staff IDs only) and `apps/api/test/auth/admin-403.int.test.ts` (every `ADMIN_ROUTES` entry as staff → 403 and no table change; as admin → not 403). Depends on T003, T007, T014. **FR-001, FR-002, FR-022, FR-024, FR-028, FR-032** · ~400 lines
- [ ] T022 [US4] People routes `POST /admin/people/:staffId/invite/resend` (only while `invited`; a new invite link that kills both kinds), `DELETE /admin/people/:staffId/invite` (only while `invited`; deletes the row when `staff.first_signed_in_at` is null, otherwise returns to `deactivated`; links gone at once) and `POST /admin/people/:staffId/reactivate` (only while `deactivated`; status `invited`, new `staff.invited_at`, fresh invite, same staff ID and role). Each awaits `sendNow()` where it sends and records its `people_action`. Tests in `admin-people.int.test.ts`: resend kills the old invite link; resend and cancel refused (409) for active and deactivated people and after the invite was used; cancel removes the person, keeps a `cancel` row with the staff ID and no address or name, and the address can be invited again as a new person; reactivation keeps the staff ID and signing in from it makes them active; cancelling a reactivation returns to deactivated. Depends on T021. **FR-008, FR-029, FR-031, FR-032** · ~350 lines
- [ ] T023 [US4] People routes `POST /admin/people/:staffId/deactivate`, `PUT /admin/people/:staffId/role` and `POST /admin/people/:staffId/sign-out-everywhere`. Deactivation deletes the person's devices (and so sessions and push subscriptions), links and link code in one transaction and keeps the row and its `people_action` history. Tests in `admin-people.int.test.ts` (a person signed in on two devices: after deactivation both answer 401 at their next request, their outstanding link and code are refused, a link request captures nothing (SC-005); sign out everywhere: both devices 401, the person stays active and can sign in again; promote and demote; 409 reasons for self, an inactive person and the last admin; deactivating an invited person → 409, so a cancelled reactivation can only ever follow a real deactivation) and `people.int.test.ts` (two admins demoting each other concurrently leave exactly one admin; a concurrent self-deactivation race changes nothing). Depends on T022. **FR-028, FR-030, FR-031, FR-032** · ~380 lines
- [ ] T024 [US1] Bootstrap `apps/api/src/auth/bootstrap.ts` (research R11) called from `apps/api/src/startup.ts` for the api only, after migrations and under `pg_advisory_xact_lock`: any admin with `staff.first_signed_in_at` set → nothing; a pending first admin and a different configured address → move the invite (same staff ID, new address and name, old links deleted, new invite, a `first_admin_readdress` row without either address); same address or empty setting → nothing; no admin and an empty setting → log `auth.bootstrap` `not_configured` and keep starting; no admin → an invited admin (name from `INITIAL_ADMIN_NAME` or the part before `@`), a 7-day invite and a `people_action` with a null actor. The email goes to `sendInBackground()` after `listen`. Startup also deletes expired links and the devices of ended sessions. Tests `apps/api/test/auth/bootstrap.int.test.ts`: each branch; two concurrent starts send one invite; a restart sends nothing; the stdout log contains neither the address, the link nor the token; the setting is not reachable over HTTP (no route returns it); the bootstrap admin is the only admin. Extend `apps/api/test/integration/startup.int.test.ts` for the order: migrations, bootstrap, zero-init and flush, listen, then the invite. Depends on T021. **FR-022, FR-032, FR-033** · ~350 lines
- [ ] T025 [US3] `apps/api/test/auth/response-secrets.int.test.ts` (research R9): every served route of the inventory, as visitor, staff and admin, with planted values (a session ID, a CSRF binding, link tokens, token hashes as hex and base64, and a `Discogs token=` string). Bodies and headers are scanned for 001's `isSecretName` keys and for `rd[lsp]_` prefixed, 64-hex and `Discogs token=` values. `csrfToken` is allowed only on `GET /auth/csrf`, `GET /me`, confirm and redeem, and the session cookie only in `Set-Cookie`. Fix any leak in the owning module in the same PR. Depends on T023, T024. **FR-027** · ~250 lines

**Checkpoint**: quickstart §2–§5 pass through `app.inject()`; every People action and its audit row
is tested.

---

## Phase 8: Telemetry (delivery step 8)

- [ ] T026 [P] Auth counters in `packages/telemetry/src/slo-metrics.ts` (research R10 table, closed labels, not SLO metrics; `ci/slo-catalog.json` unchanged), zero-initialised by 001's `zeroInitialise()`; one value rule in `packages/telemetry/src/redact.ts`: `\brd[lsp]_[A-Za-z0-9_-]{20,}` → `[REDACTED]`. Tests: extend `packages/telemetry/test/slo-metrics.test.ts` (the service-instruments list now names the seven auth counters; that test change cites 002/FR-041), `instruments.test.ts` (each auth counter exported as 0 for every label combination) and `redact.test.ts` (fast-check: an `rdl_`/`rds_`/`rdp_` token anywhere in arbitrary JSON never survives; short look-alikes such as `rdl_x` stay). Depends on T003. **FR-040, FR-041** · ~250 lines
- [ ] T027 Auth telemetry `apps/api/src/auth/telemetry.ts`: one structured line `{ event: "auth.<name>", outcome, staff_id? }` and one counter increment for each link request, sign-in (by method), link-code attempt, rate-limit refusal, CSRF and role refusal (from the hooks), email sent or failed, and People action; `staff_id` only when the person is known; never an address, not even hashed. Wire it into T009–T024's modules. Tests `apps/api/test/auth/telemetry.int.test.ts` with 001's in-memory exporters: each event moves its counter with the right labels and writes its line by outcome; no label value outside the closed sets. Depends on T025, T026. **FR-041** · ~350 lines
- [ ] T028 `apps/api/test/auth/telemetry-planted.int.test.ts` (research R10, SC-006): runs invite, link request, inspect, confirm, link code issue and redeem, wrong codes up to the limit, device rename and push subscription, every People action and the bootstrap, with distinctive planted values (an email, a name, the link token, the code, the session cookie, the CSRF token, a push endpoint, a client IP in `X-Riviera-Client-Ip` and a User-Agent). It collects stdout, spans, span events and metric points and asserts none of the planted strings appears. Fix any leak in the owning module in the same PR. Depends on T027. **FR-040** · ~300 lines

---

## Phase 9: Web screens and e2e: US1–US6 (delivery step 9)

Plain TypeScript modules, no framework (research R13). The UX defaults of R13 apply to every
screen. Unit tests under `apps/web/test/` with the existing setup.

- [ ] T029 [US1] [US2] [US5] `apps/web/src/api.ts` (fetch wrapper: gets the CSRF token once from `GET /auth/csrf` or `GET /me`, sends `X-CSRF-Token` on every state-changing call, maps each refusal code to its plain-English message), a small router in `apps/web/src/shell.ts`, `apps/web/src/sign-in.ts` (email form with the neutral message, "try again later" with the wait, "I have a code" with `inputmode="numeric"` and `autocomplete="one-time-code"`) and `apps/web/src/confirm.ts` (reads `#t=` from `location.hash`, removes it with `history.replaceState`, calls inspect, shows "Confirm sign-in" or the refusal with "send a new link"; only the button calls confirm; after sign-in returns to a same-origin path or home). Tests `apps/web/test/api.test.ts`, `sign-in.test.ts`, `confirm.test.ts`: no confirm request without a click; the fragment is gone after load; an off-origin return path goes home. Depends on T017. **FR-007, FR-009** · ~400 lines
- [ ] T030 [P] [US5] [US6] `apps/web/src/you.ts`: devices (name, relative last seen with the exact time on hover, current marked, rename, sign out, "sign out other devices" hidden with one device), "Link a device" (code, expiry time and countdown, then the expired message) and push subscription store and remove. Admin navigation is hidden for staff (US3-4). Tests `apps/web/test/you.test.ts`. Depends on T020, T029. **FR-016, FR-018** · ~350 lines
- [ ] T031 [P] [US4] `apps/web/src/people.ts`, laptop only: under the laptop breakpoint only "The People pages are on the computer layout"; otherwise the list grouped invited, active, deactivated and sorted by name, "invited (reactivation)" labelled, "Invite a colleague" when alone, device count and "Sign out everywhere", and every People action; deactivate, cancel, sign out everywhere and role changes open a confirmation naming the person; email `failed` shown with "resend". Tests `apps/web/test/people.test.ts`. Depends on T023, T029. **FR-028** · ~380 lines
- [ ] T032 [US1] [US2] [US5] [US6] `e2e/auth.spec.ts` (part 1) and the helper `e2e/support/mail.ts` (reads the newest `.captured-mail/` file for an address; signs in as the CI bootstrap admin and keeps the session in the one shared file `.ci-session/admin.json`. The order is: the stored session while `GET /api/me` answers 200, else the newest unused bootstrap invite, else one sign-in link. A worker-scoped fixture in `e2e/support/fixtures.ts` (`test.extend`) does this, taking an exclusive lock file `.ci-session/admin.lock` so parallel workers sign in once and then share the file, and the flake guard's repeats reuse it and request no link. A fixture needs no `playwright.config.ts` change, unlike a global setup or a setup project, so T032 touches no protected path). Each test invites its own fresh address, so the flake guard's three runs and both projects stay under the per-address and per-client link limits. Flows at 390×844 and 1440×900 with axe: accept an invite (no confirm request until the button, asserted from the network log; SC-001 timed); reopen a used link → refusal; request a link and sign in; link a device with a code in a second context (SC-002 timed); list devices, sign one out, its next request 401; visual-regression screenshots of sign-in, confirm and You. Requests use the `APP_URL` origin (T001's `E2E_BASE_URL`). Depends on T024, T029, T030. **FR-007, FR-016, FR-019** · ~380 lines (snapshots excluded)
- [ ] T033 [US3] [US4] `e2e/auth.spec.ts` (part 2) or `e2e/people.spec.ts`: at 1440×900 the People list, "2 devices", each action with its confirmation naming the person, deactivate then both contexts 401, reactivate; at 390×844 only the "use a computer" note, no list and no actions; staff see no admin navigation and `/api/admin/people` answers 403; the CSP, frame, referrer and nosniff headers on every page the tests open; visual-regression screenshot of People. Depends on T031, T032. **FR-028, FR-042** · ~350 lines (snapshots excluded)

---

## Phase 10: CI: smoke, sign-in helper, obs-check, ci.yml (delivery step 10)

- [ ] T034 Sample route switch and the CI sign-in helper (research R9, decided). `apps/api/src/sample/routes.ts` moves into the auth context with `access: "staff"` and CSRF; delete `SAMPLE_ROUTE_PENDING_002` and list the route in `route-inventory.ts`. New `ci/lib/sign-in.ts`: reads the newest capture file for `INITIAL_ADMIN_EMAIL`, inspects and confirms its invite (or, once spent, requests one sign-in link), and keeps the session cookie and CSRF token in the same `.ci-session/admin.json` as T032's e2e helper, with the same order (stored session, newest unused invite, one sign-in link). Each fresh database sends a new bootstrap invite, so every sign-in in the stack job (smoke ×3, e2e with the flake guard, obs-check, latency ×2) comes from a stored session or an invite, and the job requests at most one sign-in link per database, under the 3-per-15-minute address limit (FR-021). `ci/lib/obs-check.ts` and `ci/lib/latency.ts` send the cookie, `X-CSRF-Token` and `Origin`. `e2e/support/mail.ts` reads and writes through `ci/lib/sign-in.ts` from here on, so there is one implementation. Tests `ci/test/sign-in.test.ts` (fake fetch and fake capture dir: invite path, spent-invite path, reuse of a session written by the other caller, a stale session from an earlier database, each failure message) and extend `ci/test/obs-check.test.ts` and `ci/test/latency.test.ts`. 001's `sample-request`, `sample-job`, `redaction` and `telemetry-resilience` integration tests sign in through `apps/api/test/auth/fixtures.ts` first; each such change cites 002/FR-023 and FR-034 (research R9). The inventory suites of T011–T025 now cover the sample route. Depends on T024, T028. **FR-023, FR-034** · `needs-human` (`ci/lib/**`, `ci/test/**`) · ~400 lines
- [ ] T035 Last task. The smoke test signs in: `ci/lib/smoke.ts` gains a step "sign in through the captured invite" that uses `ci/lib/sign-in.ts` and checks `GET /api/me`. Every `ci/smoke.ts` run reuses the stored session. New `ci/lib/bundle-scan.ts` with the existing patterns plus `rd[lsp]_[A-Za-z0-9_-]{20,}` and 64-hex, called from the "Built frontend bundle" step of `.github/workflows/ci.yml` in place of the inline `grep` (gitleaks stays). Tests `ci/test/bundle-scan.test.ts` (each pattern caught in a fake dist, built at runtime; a clean dist passes), extend the smoke tests in `ci/test/misc.test.ts`, and add the FR-035 cases to `apps/api/test/auth/response-secrets.int.test.ts` (the configured `SESSION_SECRET`, the SMTP password from a production-shaped config, and stored token and session hashes never appear in any response, as each role; session identifiers only in `Set-Cookie`). Update the quickstart only if a command changed. **`fr-trace` must pass with no exception**: this PR adds the first test for 002/FR-035, the last untested 002 FR. Depends on T033, T034. **FR-035** · `needs-human` (`ci/lib/**`, `ci/test/**`, `.github/workflows/ci.yml`) · ~300 lines

---

## Requirement coverage

Every FR has at least one task whose tests name it. FR-035 is first tested in T035, so T035 is the
first PR on which `fr-trace` passes without `approved-exception`.

| FR | Tasks | FR | Tasks | FR | Tasks |
|---|---|---|---|---|---|
| FR-001 | T021 | FR-015 | T010 | FR-029 | T007, T022 |
| FR-002 | T004, T005, T021 | FR-016 | T010, T019, T030, T032 | FR-030 | T007, T023 |
| FR-003 | T015 | FR-017 | T020 | FR-031 | T007, T022, T023 |
| FR-004 | T008, T013 | FR-018 | T005, T008, T016, T030 | FR-032 | T004, T021, T022, T023, T024 |
| FR-005 | T005, T013 | FR-019 | T016, T032 | FR-033 | T002, T024 |
| FR-006 | T014 | FR-020 | T006, T017, T018 | FR-034 | T009, T012, T034 |
| FR-007 | T013, T029, T032 | FR-021 | T006, T017, T018 | FR-035 | **T035** |
| FR-008 | T013, T022 | FR-022 | T004, T021, T024 | FR-036 | T001, T002 |
| FR-009 | T013, T029 | FR-023 | T011, T012, T034 | FR-037 | T002, T003 |
| FR-010 | T014 | FR-024 | T011, T021 | FR-038 | T001, T002, T003 |
| FR-011 | T014, T016 | FR-025 | T010 | FR-039 | T003 |
| FR-012 | T008 | FR-026 | T019, T020 | FR-040 | T018, T026, T028 |
| FR-013 | T005, T010 | FR-027 | T025 | FR-041 | T026, T027 |
| FR-014 | T006, T019 | FR-028 | T007, T021, T023, T031, T033 | FR-042 | T009, T012, T018, T033 |

Success criteria: SC-001 → T032; SC-002 → T032; SC-003 → T013, T014, T016; SC-004 → T012, T021;
SC-005 → T023; SC-006 → T028, T035; SC-007 → T001, T002, T003; SC-008 → T015.

Constitution auth security tests: expiry and single use → T013, T014; session fixation → T014;
CSRF on every state-changing route → T012; role checks → T021, T023.

---

## Dependencies & execution order

```text
T001 ─ T002 ─┬─ T003 ──────────────────────────────┬─ T015 ─┐
             └─ T004 ─┐                            │        ├─ T017 ─ T029 ─┬─ T030 ─┐
       T005 ──────────┤  T006 ─────────────────────┼────────┘               │        ├─ T032 ─ T033 ─┐
                      │  T007 ─────────────┐       │                        └─ T031 ─┘               │
T008 ─ T009 ─ T010 ─ T011 ─┬─ T012         │       │                                                 │
                           └─ T013 ─ T014 ─┼─ T016 ┘                                                 ├─ T035
                                     T014 ─┼─ T019 ─ T020                                            │
                                           └─ T021 ─ T022 ─ T023 ─┬─ T025 ─ T027 ─ T028 ─ T034 ──────┘
                                              T021 ─ T024 ────────┘   T026 ─┘
T001 ─ T018
```

Arrows are a summary; each task's own "Depends on" list is authoritative (for example T010 needs
T004, T005 and T009; T014 needs T006; T017 needs T006, T015 and T016; T021 needs T003; T032 needs T024; T034 needs T024 and T028).

- **Setup** T001 → T002 → T003 in order. T001 must merge before T002, or the `stack` job fails.
- **Step 2**: T004 after T002; T005, T006, T007 have no dependencies and run in parallel.
- **Step 3**: T008 has no dependencies; T009 → T010 → T011 → T012 (T010 also needs T004, T005).
- **Step 4**: T013 → T014 → T015 and T016.
- **Step 5**: T017 after T015 and T016; T018 any time after T001.
- **Steps 6–7**: T019 → T020 and T021 → T022 → T023 can run side by side after T014; T024 after
  T021; T025 after T023 and T024.
- **Step 8**: T026 any time after T003; T027 after T025 and T026; T028 after T027.
- **Step 9**: T029 after T017; T030 and T031 in parallel; T032 → T033.
- **Step 10**: T034 after T024 and T028; **T035 last**.

## Parallel examples

```text
At once:             T005 · T006 · T007 · T008
After T002:          T003 · T004
After T001:          T018 (any time)
After T014:          T015 · T016 · T019 · T021
After T029:          T030 · T031
```

## Implementation strategy

- **MVP = steps 1–4** (T001–T016): an invited person and a returning staff member can sign in,
  with CSRF, sessions and route access in force (US1, US2, US3's server rules). Check with
  quickstart §2 steps 4–5 through `app.inject()`.
- **Then** rate limits and the proxy (T017–T018), devices (US6, T019–T020), People and the
  bootstrap (US4, T021–T025) and telemetry (T026–T028).
- **Then** the screens and e2e (T029–T033), so the flows run end to end in a browser.
- **Last, CI** (T034–T035): the sample route joins auth with the CI sign-in helper, the smoke test
  signs in and the bundle scan learns the token prefixes. After that `fr-trace` passes on its own
  and the feature is done (quickstart §1–§6).
