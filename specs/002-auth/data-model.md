# Data model: Auth

The tables of the spec's Key Entities, in migration `0002_auth` (up and down), with their rules
and state transitions. Token formats and keys are in [research.md](./research.md) R4, and the
wire format is in [contracts/http.md](./contracts/http.md). Handoff §3 sketched
`staff(… active …)`, `magic_link(token, expires)` and `link_code(code, …)`. The spec replaces
`active` with a three-state `status`, and FR-004 forbids storing tokens or codes as sent, so
these tables store HMACs.

## 1. `staff` (Person)

| Column | Type | Rule |
|---|---|---|
| `id` | `text` PK | `stf_` + 22 base64url chars; CHECK `^[A-Za-z0-9_-]{1,64}$` (001 `isStaffId`) |
| `email` | `text` not null | trimmed, NFC, lower-cased before insert; CHECK `email = lower(btrim(email))`; changes only through the first-admin step of FR-033 |
| `name` | `text` not null | 1–80 characters, trimmed |
| `role` | `text` not null | `admin` \| `staff` (CHECK); FR-022 |
| `status` | `text` not null | `invited` \| `active` \| `deactivated` (CHECK) |
| `invited_at` | `timestamptz` not null | set at invite and at reactivation |
| `invited_by` | `text` null | staff ID; null for the startup bootstrap (FR-033); no FK, so an inviter's removal doesn't cascade |
| `first_signed_in_at` | `timestamptz` null | set once, at the first completed sign-in; tells a first invite from a reactivation |
| `created_at` | `timestamptz` not null | default `now()` |

Unique index `staff_email_key ON staff (email)`: an address belongs to at most one person
(FR-002). Partial index `staff_admin_idx ON staff (id) WHERE role = 'admin'` for the bootstrap
and last-admin checks.

**State transitions** (rules in `domain/auth/people-rules.ts`, research R12):

```text
 invite (admin, or startup bootstrap)
        │
        ▼
     invited ──sign-in completed (invite link, sign-in link)──► active
        │  ▲                                                     │
        │  └──────────────── reactivate (sends invite) ──────────┤ deactivate
        │                                                        ▼
        ├─cancel, first_signed_in_at null ──► row deleted   deactivated
        └─cancel, first_signed_in_at set ───────────────────────►┘
```

A role change applies only to `active` people other than the actor. Demote and deactivate
never apply to the actor. Once any admin has `first_signed_in_at` set, at least one active
admin must remain (FR-030).

## 2. `magic_link`

| Column | Type | Rule |
|---|---|---|
| `token_hash` | `bytea` PK | HMAC(k_token, token); the token is never stored |
| `staff_id` | `text` not null | FK → `staff(id)` ON DELETE CASCADE |
| `kind` | `text` not null | `sign_in` \| `invite` (CHECK) |
| `created_at` | `timestamptz` not null | default `now()` |
| `expires_at` | `timestamptz` not null | created + 15 min (`sign_in`) or + 7 days (`invite`); FR-005 |

Index `(staff_id, kind)`. A row exists only while the link is usable: using, invalidating or
cancelling a link **deletes** it, and expired rows are deleted when that person's links change
and at startup. The rules:

- A new sign-in link deletes the person's `sign_in` rows only (FR-008).
- A new invite link deletes all their rows (FR-008).
- A completed sign-in deletes all their rows (FR-010).
- Deactivation and cancellation delete all their rows (FR-029, FR-031).

## 3. `device`

| Column | Type | Rule |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()`; shown to its owner only |
| `staff_id` | `text` not null | FK → `staff(id)` ON DELETE CASCADE |
| `name` | `text` not null | default from the User-Agent (research R5); 1–60 characters |
| `created_at` | `timestamptz` not null | default `now()` |
| `last_seen_at` | `timestamptz` not null | updated at most once a minute (FR-015) |
| `push_subscription` | `jsonb` null | `{ endpoint, keys: { p256dh, auth } }`, zod-validated; FR-017 |

## 4. `session`

| Column | Type | Rule |
|---|---|---|
| `token_hash` | `bytea` PK | HMAC(k_token, session identifier) |
| `device_id` | `uuid` not null unique | FK → `device(id)` ON DELETE CASCADE; one session per device |
| `staff_id` | `text` not null | FK → `staff(id)` ON DELETE CASCADE |
| `created_at` | `timestamptz` not null | default `now()` |
| `expires_at` | `timestamptz` not null | created + 90 days (FR-013) |
| `last_seen_at` | `timestamptz` not null | idle end = `last_seen_at + 30 days` |

A session is **alive** when `expires_at > now()`, `last_seen_at > now() − 30 days` and its
person is `active`. Ending a session deletes its `device`, and the session goes by cascade.
Sign-out, the end of a session, sign out everywhere and deactivation all go through this one
path. Index `session_staff_idx (staff_id)`.

## 5. `link_code`

| Column | Type | Rule |
|---|---|---|
| `code_hash` | `bytea` PK | HMAC(k_code, 6 digits); unique, so a collision retries (research R6) |
| `staff_id` | `text` not null unique | FK → `staff(id)` ON DELETE CASCADE; at most one unused code per person (FR-018) |
| `expires_at` | `timestamptz` not null | created + 10 minutes |

Redeeming a code deletes it atomically. Issuing one deletes the person's old code and every
expired code.

## 6. `people_action` (People action record, FR-032)

| Column | Type | Rule |
|---|---|---|
| `id` | `bigint` identity PK | |
| `at` | `timestamptz` not null | default `now()` |
| `actor_staff_id` | `text` null | null means the startup bootstrap (FR-033) |
| `target_staff_id` | `text` not null | **no FK**: outlives a removed person (FR-029) |
| `action` | `text` not null | `invite` \| `resend` \| `cancel` \| `deactivate` \| `reactivate` \| `role_change` \| `sign_out_everywhere` \| `first_admin_readdress` (FR-033) |
| `detail` | `jsonb` not null | default `{}`; only closed values such as `{ "role": "admin" }`; never an address or name |

The table is append-only: no update or delete path exists in the code.

## 7. `auth_rate_event` (rate limits, research R7)

| Column | Type | Rule |
|---|---|---|
| `bucket` | `text` not null | `link_address` \| `link_client` \| `code_client` |
| `key_hash` | `bytea` not null | HMAC(k_rate, normalized email or client key); never the address or IP |
| `at` | `timestamptz` not null | default `now()` |

Index `(bucket, key_hash, at)`. Rows older than one hour are deleted on insert.

## 8. Outgoing email (not a table)

`OutgoingEmail { to, kind: invite | sign_in, subject, text, html }` passes through the
`EmailTransport` interface (research R8). The capture transport keeps
`{ to, kind, subject, text, html, link, at }` in memory (tests) or as one JSON file per message
under `/var/lib/riviera/mail` (dev and CI stack). Production keeps nothing: the send outcome
is a log line and a metric with no recipient.

## 9. Request auth context (in memory)

`request.auth`, set by the auth hook (research R5):
`{ kind: "visitor" } | { kind: "person", staffId, role, sessionHash, deviceId }`. Routes read it
through a typed accessor, never through a cast. Every per-person query takes `staffId` from here
(FR-026), never from the URL. Admin People routes take the target from the URL, and only the
People repository accepts it.
