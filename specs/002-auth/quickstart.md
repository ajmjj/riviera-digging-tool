# Quickstart: Auth

How to check 002 end to end once its tasks have merged. The routes are in
[contracts/http.md](./contracts/http.md), the mail capture in
[contracts/email.md](./contracts/email.md).

## Prerequisites

- Docker and pnpm, as for 001; `pnpm install --frozen-lockfile`.
- **Development** needs no real settings: `make up-dev` passes the dev placeholder
  `SESSION_SECRET`, a test `INITIAL_ADMIN_EMAIL` (`admin@dev.invalid`) and the capture
  directory, with `DEPLOYMENT_ENVIRONMENT=development`.
- **Antn's host** (production): fill `SESSION_SECRET` (for example `openssl rand -base64 48`),
  `SMTP_URL`, `EMAIL_FROM` and `INITIAL_ADMIN_EMAIL` in `.env`. Without them `make up` refuses
  to start and names the missing setting. This is intended (research R8).

## 1. Tests

```bash
pnpm check
```

```bash
make test-integration
```

Every `002/FR-###` test passes, and `pnpm fr-trace` reports no untested 002 FR (after the last
task).

## 2. First admin and an invite (US1, FR-033)

```bash
make up-dev
```

1. `ls .captured-mail/` shows one `invite` message to `admin@dev.invalid`. The api logs show
   `auth.bootstrap` without the address.
2. Open its `link` at http://localhost:8080. The page shows "Confirm sign-in" and has sent no
   confirm request. Press it: you are signed in as an admin.
3. Restart the api with `docker compose restart api`. No second invite appears (any admin
   exists).
4. On People, invite `mia@example.test`. A second capture file appears. Open it in a private
   window and confirm. Mia is active, with one device.
5. Open Mia's link again. You get "This link can't be used any more…".

## 3. Security checks by hand (US3)

- As Mia, `GET /api/admin/people` answers 403. Signed out, `GET /api/me` answers 401.
- `curl -X POST http://localhost:8080/api/auth/links -H 'content-type: application/json' -d '{"email":"x@y.z"}'`
  (no token, no Origin) answers 403.
- Send four link requests for one address within 15 minutes through the UI. The fourth answers
  "try again later" with a wait time, and no fourth email is captured.

## 4. Devices and codes (US5, US6)

1. As Mia on the laptop window, open You and choose "Link a device". Six digits appear.
2. In another browser choose "I have a code" and enter them. That browser is signed in, and You
   lists two devices, one marked current.
3. Sign the other one out. Its next request answers 401.

## 5. People actions (US4)

On the laptop layout (1440×900): Mia's row shows "2 devices" and "Sign out everywhere". At
phone width (390×844) neither appears. Deactivate Mia: both her browsers answer 401, and a new
link request for her captures nothing. Reactivate her: a new invite is captured, and signing in
keeps her staff ID.

## 6. Telemetry (FR-040, FR-041)

With `make up-dev` (the observability profile is on), Grafana's Explore shows
`riviera_auth_sign_ins_total{method,outcome}` and the other auth counters. Search Loki for
`mia@example.test`, for `rdl_` and for the code: nothing is found.

## Emergency sign-out

Changing `SESSION_SECRET` and restarting ends every session, link and code at once (research
R4).
