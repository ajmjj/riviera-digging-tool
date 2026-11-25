# Contract: email and its configuration

## Settings (`.env`, research R8)

| Name | Meaning | Where it is read |
|---|---|---|
| `SESSION_SECRET` | ≥ 32 bytes; HKDF input for every token key (research R4) | api, worker (shared `loadConfig`; no worker code uses it in 002) |
| `SMTP_URL` | `smtps://user:password@smtp.ionos.de:465`; production only | api |
| `EMAIL_FROM` | sender, on `rivierarecords.de`, e.g. `dig@rivierarecords.de` | api |
| `INITIAL_ADMIN_EMAIL` | first admin's address, used only while no admin exists (FR-033) | api |
| `INITIAL_ADMIN_NAME` | optional; defaults to the part of the address before `@` | api |
| `EMAIL_CAPTURE_DIR` | development and CI only, refused in production: directory for the capture files below. Set by `docker-compose.capture.yml`, not in `.env.example`; when unset, captured mail stays in memory | api |

Startup refusals name the setting and never print its value. For example:
`SESSION_SECRET is missing or shorter than 32 bytes`,
`SMTP_URL is set but DEPLOYMENT_ENVIRONMENT is not production`,
`EMAIL_FROM must be an address on rivierarecords.de`.

## Messages (FR-039)

| Kind | Subject | Body contains |
|---|---|---|
| `invite` | "You're invited to Riviera Dig" | the name, the link `${APP_URL}/sign-in/confirm#t=…`, "valid for 7 days", a line telling the reader to ignore the email if it wasn't expected |
| `sign_in` | "Your Riviera Dig sign-in link" | the name, the link, "valid for 15 minutes", the same ignore line |

Each message has a plain-text and an HTML part. No staff ID, no other link, no tracking pixel.

## Capture file (development and CI)

One file per message, `/var/lib/riviera/mail/<iso-time>-<kind>-<n>.json`, mounted at
`./.captured-mail/`:

```json
{ "to": "mia@example.test", "kind": "invite", "subject": "…", "text": "…", "html": "…",
  "link": "http://localhost:8080/sign-in/confirm#t=rdl_…", "at": "2026-11-25T10:00:00.000Z" }
```

`ci/lib/sign-in.ts`, the e2e tests and the smoke test read the newest file for an address.
`make up-dev` empties the directory on start.
