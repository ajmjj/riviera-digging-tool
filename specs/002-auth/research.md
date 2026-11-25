# Research: Auth

Phase 0 of `/speckit-plan`. Each entry is a decision the plan depends on. Entries marked
**(check)** are listed in the PR description for Antn. Decisions Antn made while this plan was
being written are marked **(decided)**.

## R1. The client a rate limit counts (FR-020, FR-021) **(check)**

- **Facts**: the proxy is nginx (`proxy/nginx.conf`). The handoff (§12) says Caddy, but the
  foundation shipped nginx and this plan keeps it. The api publishes no port, so on the compose
  network only the proxy reaches it. `cloudflared` doesn't exist yet. It joins once the domain is
  chosen (constitution, Stack) and will connect to the proxy from inside the compose network.
  Cloudflare sets `CF-Connecting-IP` at its edge and overwrites any value a client sends.
- **Decision**: there is one trusted header, `X-Riviera-Client-Ip`. Only the proxy writes it, and
  it always **overwrites** it (`proxy_set_header`), never appends.
  - **Local listener** (`listen 80`, published on `127.0.0.1:${PROXY_PORT}`): the value is
    `$remote_addr`. `CF-Connecting-IP` and `X-Forwarded-For` sent by a client are ignored there.
  - **Tunnel listener** (`listen 8081`, never published, on a compose network `edge` that only
    `proxy` and, later, `cloudflared` join): the value is `$http_cf_connecting_ip`, or
    `$remote_addr` if that header is empty. `cloudflared` is pointed at `proxy:8081` when it
    joins. 002 adds the listener and the network, so the trust rule is fixed and tested now.
  - **api**: Fastify `trustProxy` stays off. A small function `clientKey(request)` reads
    `X-Riviera-Client-Ip` and accepts it only if `net.isIP()` accepts it. If the header is
    missing or invalid (a direct call in tests, or a misconfigured proxy), it uses the socket
    address. `X-Forwarded-For` is never read. IPv6 addresses count by their /64 prefix, so one
    host can't rotate through its own range. The key is stored only as an HMAC (R4), never
    as the address.
- **Access log** (FR-040 as clarified): both listeners use a `log_format` with neither
  `$remote_addr`, `$http_x_forwarded_for`, `$http_cf_connecting_ip` nor `$http_user_agent`
  (time, method, path without query, status, bytes, duration, request ID).
- **Tests**: a static test of `proxy/nginx.conf`, in the style of `proxy-config.test.ts`. The
  port-80 block sets the header from `$remote_addr` and never mentions `cf_connecting_ip`. The
  8081 block uses it. Port 8081 appears in no compose `ports:`, and `edge` holds only `proxy`.
  Unit tests of `clientKey` cover a spoofed `X-Forwarded-For`, an invalid header and the IPv6 /64
  prefix.
- **Alternatives**: nginx `realip` with `set_real_ip_from` the `cloudflared` address. Container
  addresses on a compose network are dynamic, so the trusted range would be the whole subnet,
  which is the same trust with more config. Fastify `trustProxy` with `X-Forwarded-For`: the
  proxy appends to a client-supplied XFF, so picking the right hop is error-prone. Cloudflare's
  `True-Client-IP` is an Enterprise feature.

## R2. CSRF (FR-034), including the sign-in forms **(check)**

- **Decision**: a stateless synchronizer token plus a strict Origin check. Both must pass on
  every request whose method is not GET, HEAD or OPTIONS, on every route, the sign-in routes
  included.
  - **Binding**: the session (its token hash) after sign-in. Before sign-in, a *pre-sign-in
    token*: 128 random bits in a cookie `rd_pre` (HttpOnly, SameSite=Strict, Path=/, Secure on
    HTTPS, Max-Age 1 day). `GET /auth/csrf` sets it when it is missing. The cookie authenticates
    nothing and has no server-side row.
  - **Token**: `base64url(HMAC-SHA256(k_csrf, binding))`, where `k_csrf` is derived from
    `SESSION_SECRET` (R4). `GET /auth/csrf` and `GET /me` return it as `csrfToken`. The client
    sends it in the `X-CSRF-Token` header. The server compares with `timingSafeEqual`. Nothing
    is stored. A new session gives a new token automatically.
  - **Origin**: the `Origin` header must equal `APP_URL`'s origin exactly. Browsers send `Origin`
    on every non-GET fetch, same-origin included, so a missing `Origin` is refused.
    `Referer` is not used.
  - **Refusal**: 403 `{ "error": "forbidden" }`, nothing changes, and the outcome is counted
    (R10). The check runs in an `onRequest` hook before body parsing and before any handler, and
    it is registered before the routes, so a new route can't miss it.
  - **At sign-in**: the response sets the session cookie, clears `rd_pre` and returns the new
    `csrfToken`.
- **GET never changes state** (FR-034): GET and HEAD handlers may only touch session bookkeeping:
  the last-seen update and removing an ended session (R5). A test enforces this (R9).
- **Alternatives**: double-submit cookie (weaker: a cookie set on a sibling subdomain can be
  planted); SameSite alone (doesn't protect same-site requests, and the spec asks for a token);
  `@fastify/csrf-protection` (stores a secret per session, and the pre-sign-in case still needs
  hand-written code).

## R3. Session cookie (FR-011, FR-012, FR-035)

- **Decision**: one cookie. It is called `__Host-rd_session` when `APP_URL` is HTTPS and
  `rd_session` on plain-HTTP localhost, because the `__Host-` prefix requires `Secure`. It is
  HttpOnly, SameSite=Strict, Path=/ and has no `Domain` (host-only, so it is sent only to the
  tool's own origin). Secure is set when `APP_URL` is HTTPS, and Max-Age is 90 days.
- **Why Strict**: the web app is a static SPA, so the only request that loses the cookie under
  Strict is the cross-site top-level navigation itself (for example opening a link from the
  email). The fetches the page makes afterwards are same-site and carry it. The confirm page
  needs no session anyway.
- **Cookie parsing**: `@fastify/cookie`, used only for parsing and serializing (no signing),
  with its version pinned exactly by the task that adds it.

## R4. Tokens, hashes and keys (FR-004, FR-006, FR-011, FR-012, FR-018) **(check)**

- **Formats**: tokens carry a prefix, so the redactor (R10) and the response and bundle scans
  (R9) can recognise them anywhere.

  | Value | Format | Entropy |
  |---|---|---|
  | Sign-in or invite link token | `rdl_` + base64url(32 random bytes) | 256 bits |
  | Session identifier | `rds_` + base64url(32 random bytes) | 256 bits |
  | Pre-sign-in token | `rdp_` + base64url(16 random bytes) | 128 bits |
  | Link code | 6 digits from `crypto.randomInt(0, 1_000_000)`, zero-padded | – |
  | Staff ID | `stf_` + base64url(16 random bytes); passes `isStaffId` | 128 bits |

- **Keys**: `SESSION_SECRET` is never used directly. HKDF-SHA256 derives four purpose keys from
  it at startup: `k_token` (link and session hashes), `k_code` (link codes), `k_csrf` (R2) and
  `k_rate` (rate-limit keys). Every stored token is `HMAC-SHA256(k, value)` (`bytea`). A keyed
  hash is needed for link codes, because a plain hash of 6 digits is reversible by trying all
  10⁶ values. Using HMAC everywhere keeps one rule. Rotating `SESSION_SECRET` therefore
  invalidates every session, link and code at once, which is documented in quickstart as the
  emergency "sign everyone out".
- **Atomic single use**: consuming a link or code is a single
  `DELETE … WHERE token_hash = $1 AND expires_at > now() RETURNING …` inside the sign-in
  transaction. If two confirmations race, the row lock lets exactly one `DELETE` return the row;
  the other returns nothing and is refused (FR-006, edge case). Because a used, invalidated or
  cancelled link no longer exists, every refusal looks alike (FR-009).
- **Link in the email**: `${APP_URL}/sign-in/confirm#t=<token>`. The token is in the URL
  *fragment*, so browsers never send it to the server, nginx access logs never see it, and
  `Referer` never carries it. The page reads it from `location.hash` and immediately removes it
  with `history.replaceState`.
- **Alternatives**: plain SHA-256 for links and sessions (fine for 256-bit tokens, but then
  codes need a second scheme); bcrypt or argon2 (pointless for high-entropy tokens, slow per
  request); signed stateless sessions/JWT (can't be revoked per device, and FR-013, FR-016 and
  FR-031 need revocation).

## R5. Sessions and devices, expiry and last seen (FR-011, FR-013 to FR-017, FR-025)

- **Decision**: a `device` table and a `session` table, one to one (data-model §3–§4). Ending a
  session deletes its device, and the session goes with it through `ON DELETE CASCADE`.
- **Per request**: an `onRequest` auth hook, registered after CSRF, runs one query: the session
  joined to its person by token hash, alive only if `expires_at > now()`,
  `last_seen_at > now() − 30 days` and the person's status is `active`. Role and status are
  therefore read fresh on every request (FR-025). On a hit it calls `withStaff()` (001), so logs
  and spans carry `staff_id`. A session that is found but ended has its device deleted, and the
  request gets 401.
- **Last seen** (FR-015): `UPDATE session/device SET last_seen_at = now() WHERE … AND
  last_seen_at < now() − interval '1 minute'`, at most one write a minute per device and well
  inside the 5-minute accuracy.
- **Sweep**: device lists and the admin device count read only live sessions. Startup deletes the
  devices of ended sessions, and the sign-in transaction deletes that person's ended devices. No
  scheduler is needed.
- **Fixation** (FR-011): sign-in ignores any presented session for authentication. If the browser
  presented a session cookie, that session's device is deleted in the sign-in transaction. Then
  a new token is issued.
- **Device name** (FR-014): a small hand-written parser in `domain/auth/device-name.ts` maps the
  User-Agent to `{iPhone|iPad|Android|Mac|Windows|Linux|Device} · {Safari|Chrome|Firefox|Edge|Browser}`.
  Only the name is stored, never the User-Agent. Renaming accepts 1–60 characters, trimmed.
- **Push subscription** (FR-017): `jsonb` validated by zod (`endpoint` https URL ≤ 2 KB,
  `keys.p256dh`, `keys.auth`). It is never logged and never returned.

## R6. Magic links, invites and link codes (FR-002 to FR-010, FR-018 to FR-020)

- **Request a link** (`POST /auth/links`): normalize the email (trim, Unicode NFC, lower case),
  apply both rate limits (R7) **before** looking the address up, then look it up. If the address
  belongs to an `invited` or `active` person: in one transaction, delete their unused `sign_in`
  links (never their `invite` link, FR-008), insert a new one with a 15-minute expiry, then
  hand the email to the **background sender**. Every case answers the same `202` body.
- **Background sender**: an in-process `queueMicrotask`/promise chain in the api. It is not the
  001 job queue, because a job payload would store the link token in plain text (FR-004). If
  the process dies, that email is lost, and the person asks again. A failure is logged without
  the address and counted (R10). Sending after the response keeps SMTP latency out of the
  timing (FR-003, SC-008).
- **Invite, resend, reactivate**: the admin waits for the send. On a transport failure the
  person and the link still exist, and the response says `"email": "failed"` so the admin can
  resend (edge case). Issuing an invite deletes every unused link of either kind for that person
  (FR-008).
- **Opening a link** (FR-007): the page is static. Its script calls `POST /auth/links/inspect`
  with the token. That call checks the link without consuming it (rows are never touched) and
  answers either `{ "state": "confirm" }` or the single refusal. That gives US1-3 and US1-4
  their refusal on opening. Only the button's `POST /auth/links/confirm` consumes the link
  (R4). The script never calls confirm by itself, and an e2e test checks that no confirm request
  is sent until the button is pressed.
- **Completing sign-in** (link or code): one transaction consumes the link or code, locks the
  person `FOR UPDATE` and requires status `invited` or `active`. If they were `invited` it sets
  `active` and `first_signed_in_at` once. It deletes all their remaining links (FR-010), removes
  the presented old session (R5), and inserts the device and session. The cookie is set after
  the commit.
- **Link codes** (FR-018 to FR-020): issuing one deletes the person's unused code and every
  expired code, then inserts `HMAC(k_code, code)`. A unique index on `code_hash` means a
  collision with another person's live code retries with new digits, up to 5 times. Redeeming
  first checks the client's wrong-attempt count (R7). If it is 10 or more, the answer is 429,
  even for a correct code. Otherwise the code is consumed atomically (R4). A miss records one
  wrong attempt and gets the single refusal.

## R7. Rate limits: storage and algorithm (FR-020, FR-021)

- **Decision**: a sliding log in Postgres, table `auth_rate_event(bucket, key_hash, at)`.
  Checking and recording run under `pg_advisory_xact_lock(hashtextextended(bucket || key_hash))`,
  so concurrent requests can't both slip under a limit. Events older than an hour are deleted on
  insert. At this scale (a handful of people) that is a few rows.

  | Bucket | Key | Limit | Recorded when |
  |---|---|---|---|
  | `link_address` | HMAC(k_rate, normalized email) | 3 / 15 min | every accepted link request, known or unknown address |
  | `link_client` | HMAC(k_rate, client key, R1) | 20 / 1 h | every accepted link request |
  | `code_client` | HMAC(k_rate, client key) | 10 / 10 min | every wrong code attempt |

- **Answer when limited**: 429 `{ "error": "rate_limited", "retryAfterSeconds": n }` with a
  `Retry-After` header, where n comes from the oldest event in the window. No email is sent.
  Because the per-address limit is keyed on the address whether or not it is known, it reveals
  nothing (FR-021).
- **Alternatives**: in-memory counters (lost at restart, and a restart would reset an attacker's
  window); fixed windows (allow double the limit across a boundary); `@fastify/rate-limit`
  (per-route counters with no per-address key, and the wrong-attempts-only rule needs custom
  code anyway).

## R8. Email interface, transports and startup refusals (FR-036 to FR-039) **(check)**

- **Interface** (`apps/api/src/email/`):
  `interface EmailTransport { send(message: OutgoingEmail): Promise<void> }`, where
  `OutgoingEmail` is `{ to, kind: "invite" | "sign_in", subject, text, html }`. Templates live in
  `email/templates.ts` and carry the name, the link and its lifetime ("valid for 15 minutes",
  "valid for 7 days"), and nothing else secret (FR-039). They are plain English like the UI.
- **SMTP transport**: `nodemailer`, exact version pinned when the task adds it, created from
  `SMTP_URL` (`smtps://user:password@smtp.ionos.de:465`, or `smtp://…:587`, always with
  `requireTLS`). The host must be on an allow-list in code: `smtp.ionos.de` and
  `smtp.ionos.com`, which can be extended with a test. Credentials stay inside a `Secret` (001
  `config.ts`).
- **Capture transport**: unit and integration tests use an in-memory capture. The running dev
  and CI stack writes one JSON file per message to `/var/lib/riviera/mail` in the api
  container, mounted to `./.captured-mail/` (gitignored) by `make up-dev` and by CI, so e2e
  tests, the smoke test and developers can read the link. It never opens a network connection.
  It holds links by design (FR-037 asks for it) and exists only outside production.
- **Config rules** in `loadConfig`. Every error names the setting and never prints its value:

  | Setting | production | development / ci |
  |---|---|---|
  | `APP_URL` | `https:`, or `http:` only for `localhost` / `127.0.0.1` (FR-036) | any |
  | `SESSION_SECRET` | required, ≥ 32 UTF-8 bytes, must not start with `dev-only` | required, ≥ 32 bytes (Makefile and CI pass the fixed placeholder `dev-only-session-secret-0000000000000000`) |
  | `SMTP_URL` | required, `smtp:`/`smtps:`, allowed IONOS host | **must be empty** (FR-038); capture transport |
  | `EMAIL_FROM` | required, an address whose domain is exactly `rivierarecords.de` (no subdomains) | optional; defaults to `dev-capture@localhost.invalid` |
  | `INITIAL_ADMIN_EMAIL` | optional; if set, must be an email address | same |
  | `INITIAL_ADMIN_NAME` | optional, 1–80 characters | same |
  | `EMAIL_CAPTURE_DIR` | **must be empty** (nothing is captured in production) | optional; when set, the capture transport writes one file per message there, otherwise it keeps messages in memory. Set only by `docker-compose.capture.yml` (`/var/lib/riviera/mail`), never in `.env.example` |

  `SESSION_SECRET` is checked for the api and the worker alike: both start from one image and one
  `loadConfig` (001), so one rule covers both. No worker code uses it in 002. `SMTP_URL`,
  `EMAIL_FROM`, `EMAIL_CAPTURE_DIR` and the first-admin settings are api only.

- **Fresh install (decided)**: Antn chose *fail closed*. An unset `DEPLOYMENT_ENVIRONMENT` still
  means production (001 R17), so `cp .env.example .env && make up` refuses to start until the
  real values are filled in, and says which setting is missing. Development uses `make up-dev`.
  CI's plain-stack step runs with `DEPLOYMENT_ENVIRONMENT=ci`, the placeholder secret and a test
  `INITIAL_ADMIN_EMAIL`. That is a change to `.github/workflows/ci.yml` (protected, needs-human).
- **Alternatives**: Mailpit as a fake SMTP server (that would be the SMTP transport outside
  production, which FR-038 forbids); a dev-only HTTP route listing captured mail (an
  unauthenticated route exposing links); storing captured mail in Postgres (puts plain links in
  the shared database).

## R9. Route inventory: admin and state-changing route lists (FR-023, FR-024, FR-027, FR-034) **(check)**

- **Declaration**: every route must declare `config.access` as `"public"`, `"staff"` or
  `"admin"`. An `onRoute` hook in the auth plugin throws at startup if one doesn't. The health
  routes are `public`. A `public` route must be on a fixed allow-list in code: health and the
  five sign-in routes. Every `/admin/*` route must be `admin`, and every `admin` route must be
  under `/admin/`, which keeps the optional Cloudflare Access lock (handoff §12) meaningful.
- **Committed lists**: `apps/api/test/auth/route-inventory.ts` exports `ADMIN_ROUTES`,
  `STATE_CHANGING_ROUTES` and `PUBLIC_ROUTES` as `{ method, url }` literals, each with a sample
  request (params and body) the security tests can send.
- **Check against what is served**: `route-inventory.test.ts` builds the full app (every
  feature's routes, sample routes on), collects `onRoute` events and asserts both directions:
  every served admin or state-changing route is in the list, and every listed route is served.
  A new route that nobody added to the list fails CI, and so does a stale entry.
- **Tests driven by the lists**: `admin-403.int.test.ts` (FR-024), `csrf.int.test.ts` (FR-034:
  missing token, wrong token, token for another session, foreign origin, missing origin; each
  answers 403 and a table snapshot shows no change), `unauthenticated-401.int.test.ts` (FR-023),
  `get-no-state.int.test.ts` (FR-034: each GET route, as each role, leaves every table unchanged
  except `last_seen_at` and ended-session cleanup) and `response-secrets.int.test.ts` (FR-027 and
  FR-035: every served route as visitor, staff and admin; the bodies and headers are scanned
  with 001's `isSecretName` for keys and with prefixed-token, 64-hex and `Discogs token=`
  patterns for values). `csrfToken` is the one allowed key, on `GET /auth/csrf`, `GET /me`,
  `POST /auth/links/confirm` and `POST /auth/codes/redeem` (contracts/http.md). The session cookie
  is allowed in `Set-Cookie` only. The response-secret and planted-value suites are written with
  the route inventory, before the routes they scan (decided by Antn, 2026-11-25), so every route
  is scanned in the PR that adds it.
- **The sample route (decided)**: Antn chose that 001's `POST /sample/trace` follows 002. It is
  `staff` access and needs CSRF. A shared CI helper, `ci/lib/sign-in.ts`, signs in as the
  bootstrap admin from the captured invite and is used by both `ci/obs-check.ts` and the
  sign-in smoke step. That touches `ci/**` (protected, needs-human). No exception is needed.
- **One shared admin session in CI** (added after the analysis review): the CI helper and the
  e2e fixture keep the bootstrap admin's session cookie and CSRF token in one gitignored file,
  `.ci-session/admin.json`, behind an exclusive lock file `.ci-session/admin.lock`. They sign in
  in one order: the stored session while `GET /api/me` answers 200, else the newest unused
  bootstrap invite (polled for up to 10 seconds, since it is sent after `listen`), else one
  sign-in link. They read `APP_URL` (for the `Origin` they send) and `INITIAL_ADMIN_EMAIL` from the
  environment, which the `stack` job sets at job level. No e2e test ends that session; each acts
  on its own invitee. So each fresh database costs at most one sign-in link for the admin address
  (limit 3 per 15 minutes), and e2e with its flake-guard repeats stays well under 20 link
  requests per client per hour.

## R10. Auth telemetry with bounded labels (FR-040, FR-041)

- **Metrics**: new counters in the registry `packages/telemetry/src/slo-metrics.ts`. They are not
  SLO metrics and the protected catalog is unchanged. Like 001's, they are zero-initialised at
  startup. Every label is a closed set:

  | OTel name | Labels |
  |---|---|
  | `riviera.auth.link_requests` | `outcome`: `issued` \| `not_issued` \| `rate_limited` \| `invalid` |
  | `riviera.auth.sign_ins` | `method`: `invite_link` \| `sign_in_link` \| `link_code`; `outcome`: `success` \| `refused` |
  | `riviera.auth.link_code_attempts` | `outcome`: `success` \| `wrong` \| `rate_limited` |
  | `riviera.auth.rate_limited` | `limit`: `link_address` \| `link_client` \| `code_client` |
  | `riviera.auth.refusals` | `reason`: `unauthenticated` \| `forbidden_role` \| `csrf_token` \| `csrf_origin` |
  | `riviera.auth.emails` | `kind`: `invite` \| `sign_in`; `outcome`: `sent` \| `failed` |
  | `riviera.auth.people_actions` | `action`: `invite` \| `resend` \| `cancel` \| `deactivate` \| `reactivate` \| `role_change` \| `sign_out_everywhere`; `outcome`: `success` \| `refused` |

  The registry tests ("the service instruments of R6 are the only others") are extended to name
  these. That test change cites 002/FR-041.
- **Logs**: one structured line per event, `{ event: "auth.<name>", outcome, staff_id? }`, with
  `staff_id` only when the person is known. An unknown address is never in the log, not even
  hashed.
- **Redaction** (001/FR-005, R4 there): `redact.ts` gains one value rule. Strings matching
  `\brd[lsp]_[A-Za-z0-9_-]{20,}` become `[REDACTED]`. Email addresses are already redacted by
  value. Names, link codes and push endpoints can't be recognised by shape, so the rule for them
  is that they are never passed to a logger or span. The planted-value test enforces this.
- **Planted-value test** (FR-040, SC-006): `telemetry-planted.int.test.ts` sends every served
  route's sample request from the route inventory (R9), then runs the auth flows that need a
  sequence (wrong codes up to the limit, People actions, the bootstrap), with distinctive values: an email, a name, the link token, the code, the session cookie, the
  CSRF token, a push endpoint, a client IP address and a User-Agent string. It collects stdout log lines and 001's in-memory spans,
  span events and metric points, and asserts that none of the planted strings appears.

## R11. First admin from `INITIAL_ADMIN_EMAIL` (FR-033)

- **Decision**: a step `bootstrapFirstAdmin()` in `startService`, for the api only, after
  migrations, inside a transaction holding `pg_advisory_xact_lock(<fixed key>)`:
  - Any admin has `first_signed_in_at` set: do nothing.
  - An admin exists but none has signed in (the pending first admin): if the setting names a
    different address, update that person's email and name, delete their links, insert a new
    invite and a `people_action` (`first_admin_readdress`, `actor_staff_id = null`, no
    address). If it names the same address, or is empty, do nothing (FR-033 as clarified).
  - No admin exists and the setting is empty: log
    `{ event: "auth.bootstrap", outcome: "not_configured" }` and continue starting.
  - No admin exists: insert the person as an invited admin (name from `INITIAL_ADMIN_NAME`, or the part of the
  address before `@`), insert a 7-day invite link and a `people_action`
  (`actor_staff_id = null`, meaning startup). The invite email goes to the background sender
  **after `listen`**, so a slow SMTP server never delays startup or health. Nothing logs the
  address, the link or the token.
- The worker never runs the bootstrap. The advisory lock and the "any admin" check make
  concurrent api starts and restarts send at most one invite per install.

## R12. People rules: self-protection and at least one admin (FR-029 to FR-032)

- **Decision**: every People mutation runs in one transaction that locks the actor's and the
  target's rows `FOR UPDATE`, ordered by ID so two admins can't deadlock. It then re-checks that
  the actor is an active admin and that actor ≠ target for demote and deactivate. After the
  change it asserts that at least one active admin remains, once any admin has
  `first_signed_in_at` set. When two admins demote each other at once, the second transaction
  finds its actor is no longer an admin, answers 403 and changes nothing (edge case).
- The rules (which action applies to which status and role) are a pure function,
  `domain/auth/people-rules.ts`, unit- and property-tested. The handler only maps its answer to
  SQL.
- **Placement**: the pure auth rules (expiry and idle, rate windows, People rules, email
  normalization, device names) go in `apps/api/src/domain/auth/`. The constitution doesn't list
  auth as domain code, but putting them there makes 95% coverage, 100% diff coverage and
  mutation testing apply. That is stronger than required, and `ci/scope.json` already covers
  `apps/api/src/domain/**`.

## R13. Web screens

- **Decision**: plain TypeScript modules in `apps/web/src/` like today's shell, with no framework
  added in 002: sign in (email, "I have a code"), confirm, You (devices, link code, push) and
  People. People is laptop only (FR-028 as clarified): at phone width it shows only "The People
  pages are on the computer layout". Deactivate, cancel invite, sign out everywhere and role
  changes open a confirmation naming the person; a person's own device actions don't.
- **UX defaults** (security checklist CHK045–CHK055, accepted by Antn):
  - one plain-English message per refusal code, listed next to the codes in contracts/http.md;
  - People with only the admin shows "Invite a colleague"; a single device hides "Sign out
    other devices";
  - last seen is relative ("5 min ago", "yesterday") with the exact time on hover;
  - after sign-in the app returns to the page that sent the person to sign in (same-origin
    paths only, otherwise home);
  - every field is labelled and keyboard-usable; the code field uses `inputmode="numeric"` and
    `autocomplete="one-time-code"`;
  - a link code shows its expiry time and a countdown, then "This code has expired. Get a new
    one.";
  - People is grouped invited, active, deactivated, then sorted by name; a reactivation invite
    is labelled "invited (reactivation)". A small `api.ts` fetch wrapper fetches the CSRF token once and sends it with every
  state-changing call. Playwright e2e tests at 390×844 and 1440×900 with axe cover the flows.
  Final visual design comes later (spec Assumptions).

## R14. "The only admin" (decided)

**Decided 2026-11-25**: Antn confirmed the spec's reading, "at launch" (spec Assumptions). No
constitution amendment. The original note follows.

The constitution's delivery order says 002 is "Auth: magic link, invite only, roles admin and
staff, **Antn as the only admin**". The approved spec reads that as "at launch" (FR-022) and
lets admins make others admins (FR-030, US4, handoff §13 "make someone else an admin"). This
plan implements the spec. If the constitution means "only ever one admin in 002", FR-030's
promotion and the last-admin rule would have to go, which is a spec change. If it means "at
launch", the constitution's wording could be clarified by a PATCH amendment. This plan changes
neither and leaves the call to Antn.

## R15. Browser protections (FR-042)

- **Decision**: the proxy adds these headers with `always` to every response it serves, PWA and
  api alike, and the api sets the same ones itself, so `app.inject()` tests and the proxy agree:
  - `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self';
    connect-src 'self'; img-src 'self' data:; manifest-src 'self'; frame-ancestors 'none';
    base-uri 'none'; form-action 'self'; object-src 'none'`
  - `X-Frame-Options: DENY`, for older browsers
  - `Referrer-Policy: no-referrer`
  - `X-Content-Type-Options: nosniff`
- **One copy of each header**: in the `/api/` blocks the proxy first `proxy_hide_header`s the
  api's four headers and then adds its own, so a response through the proxy carries each exactly
  once and still has them when the api is down (a 502 from nginx). The headers are written in
  every answering `location` block, because nginx drops server-level `add_header` lines in a
  block that sets any of its own.
- Later features that embed YouTube (handoff §5) extend `frame-src` in their own spec.
- **Tests**: a static test of `proxy/nginx.conf` (every answering `location`, and the hide lines
  in `/api/`), an api test over every served route (from the route inventory, R9), and an e2e
  check that pages and api responses carry each header exactly once.
- **Alternatives**: `@fastify/helmet` (more defaults than we want, and the PWA's headers would
  still have to come from nginx); CSP in a `<meta>` tag (can't set `frame-ancestors`).

## R16. Notes from the security checklist review

Answers that the checklist (`checklists/security.md`) asked to be written down:

- **Link codes** are shown once, on the device that asked for them; being stored as an HMAC,
  they can't be shown again (CHK004).
- **No limit** on how often a signed-in person requests link codes, and **no cap** on devices
  per person: excluded for a team this size (CHK005, CHK010).
- **Names** are plain text, 1–80 characters, escaped in HTML pages and emails, never put in a
  subject line (CHK033).
- **Database unreachable**: every route answers `503 {"error":"unavailable"}`; `/readyz` fails as
  in 001 (CHK041).
- **Changing `APP_URL`** (when the domain is chosen) signs everyone out in effect: the cookie
  is host-only, the origin check follows the new URL, and links point at the old address
  (CHK042).
- **SC-001 and SC-002** are timed in e2e from opening the captured link, or from requesting the
  code, to the signed-in screen; email delivery is outside the measure (CHK054).
