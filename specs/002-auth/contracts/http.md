# Contract: HTTP (auth)

The paths are as the api sees them. Through the proxy they carry the `/api` prefix. 001's rules
for every route (`X-Request-Id`, `traceparent`) still apply. Bodies are JSON.

## Every route

| Rule | Detail | FR |
|---|---|---|
| Access | each route declares `public`, `staff` or `admin` (research R9) | FR-023, FR-024 |
| Session | cookie `__Host-rd_session` (HTTPS) / `rd_session` (HTTP), research R3 | FR-011, FR-012 |
| CSRF | non-GET/HEAD/OPTIONS: `X-CSRF-Token` valid for the session or `rd_pre`, **and** `Origin` = `APP_URL` origin (research R2) | FR-034 |
| Client key | `X-Riviera-Client-Ip`, written only by the proxy (research R1) | FR-020, FR-021 |
| Browser protections | CSP, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `nosniff` on every response (research R15) | FR-042 |

**Answers, in order of the checks**:

1. CSRF fails: `403 {"error":"forbidden"}`, whether or not a session exists (FR-023).
2. No live session on a `staff` or `admin` route: `401 {"error":"sign_in_required"}`.
3. A staff member on an `admin` route: `403 {"error":"forbidden"}`.

None of these changes anything. Rate limited: `429 {"error":"rate_limited","retryAfterSeconds":n}`
plus `Retry-After`. Bad input: `400 {"error":"invalid"}`, which never echoes the value.

Database unreachable: `503 {"error":"unavailable"}`.

## Sign-in routes (`public`)

| Method, path | Body | Answer |
|---|---|---|
| `GET /auth/csrf` | – | `200 {"csrfToken"}`; sets `rd_pre` when there is neither a session nor `rd_pre` |
| `POST /auth/links` | `{"email"}` | always `202 {"message":"If this address has access, a sign-in link is on its way."}`, or `429` (FR-003, FR-021) |
| `POST /auth/links/inspect` | `{"token"}` | `200 {"state":"confirm","kind":"invite"\|"sign_in"}` or the refusal below; consumes nothing (FR-007) |
| `POST /auth/links/confirm` | `{"token"}` | `200 {"csrfToken", "me"}`, sets the session cookie and clears `rd_pre`; or the refusal |
| `POST /auth/codes/redeem` | `{"code"}` | as confirm; refusal `410 {"error":"code_refused"}`; `429` after 10 wrong tries (FR-019, FR-020) |

**Link refusal** (FR-009): `410 {"error":"link_refused","message":"This link can't be used any more. We can send you a new one."}`,
the same for every reason.

## Signed-in routes (`staff`; admins pass too)

| Method, path | Body | Answer | FR |
|---|---|---|---|
| `GET /me` | – | `200 {"staffId","name","role","csrfToken"}` | FR-025 |
| `POST /auth/sign-out` | – | `204`; ends the current session, clears the cookie | FR-016 |
| `POST /me/link-codes` | – | `201 {"code","expiresAt"}` | FR-018 |
| `GET /me/devices` | – | `200 [{"id","name","createdAt","lastSeenAt","current"}]` | FR-016 |
| `PATCH /me/devices/:id` | `{"name"}` | `200` device; `404` if it isn't the caller's | FR-014, FR-026 |
| `DELETE /me/devices/:id` | – | `204`; `404` if it isn't the caller's | FR-016, FR-026 |
| `POST /me/devices/sign-out-others` | – | `204` | FR-016 |
| `PUT /me/devices/current/push-subscription` | `{"endpoint","keys":{"p256dh","auth"}}` | `204` | FR-017 |
| `DELETE /me/devices/current/push-subscription` | – | `204` | FR-017 |

Another person's device answers `404`, never `403`, so a device ID reveals nothing (FR-026).

## Admin routes (`admin`, all under `/admin/`)

| Method, path | Body | Answer | FR |
|---|---|---|---|
| `GET /admin/people` | – | `200 [{"staffId","name","email","role","status","invitedAt","lastSeenAt","deviceCount"?}]` (`deviceCount` is omitted on the caller's own row) | FR-028 |
| `POST /admin/people` | `{"name","email"}` | `201 {"person","email":"sent"\|"failed"}`; `409 {"error":"already_listed","status"}` | FR-001, FR-002 |
| `POST /admin/people/:staffId/invite/resend` | – | `200 {"email":"sent"\|"failed"}`; `409` unless invited | FR-008, FR-029 |
| `DELETE /admin/people/:staffId/invite` | – | `204`; `409` unless invited | FR-029, FR-031 |
| `POST /admin/people/:staffId/deactivate` | – | `204`; `409` for self, the last admin, or an invited person | FR-030, FR-031 |
| `POST /admin/people/:staffId/reactivate` | – | `200 {"email":"sent"\|"failed"}`; `409` unless deactivated | FR-031 |
| `PUT /admin/people/:staffId/role` | `{"role":"admin"\|"staff"}` | `204`; `409` for self, an inactive person, or the last admin | FR-030 |
| `POST /admin/people/:staffId/sign-out-everywhere` | – | `204`; `409` for self | FR-028 |

`409` bodies are `{"error":"not_allowed","reason":<closed set>}` and never carry an address.
Every success writes one `people_action` row (FR-032).

## Development and CI only

`POST /sample/trace` (001) becomes `staff` access and needs CSRF (decided, research R9).

## Not served

There is no route that returns a token, a token hash, a session identifier other than through
`Set-Cookie`, another person's devices, or any `.env` value (FR-027, FR-033, FR-035).
