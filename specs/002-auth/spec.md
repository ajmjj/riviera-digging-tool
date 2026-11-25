# Feature Specification: Auth

**Feature Branch**: `002-auth-spec` (spec directory `specs/002-auth`)

**Created**: 2026-11-25

**Status**: Draft

**Input**: User description: "002 Auth: magic-link email sign-in, invite only (links at APP_URL, expire, single use); roles admin and staff (Antn only admin at launch; staff 403 on every admin route); sessions and devices (name, last_seen, optional push subscription; 6-digit link code, 10-minute expiry, links an extra device); admin People pages (invite, resend/cancel invite, deactivate keeping history and signing out every device, make admin); nobody sees another person's Discogs token or edits their verdicts; security FRs: link expiry and single use, session ID rotation at sign-in, CSRF on every state-changing route, role checks, no secrets to the browser, no personal data or tokens in logs/telemetry per 001 redaction; email behind an interface, dev/CI use mock or capture transport, never real email; session secret and SMTP credentials from .env."

## Context

Riviera Dig is an internal tool for the staff of one record shop. Every later feature (digging,
verdicts, piles, checkout, Discogs, notifications) needs to know who is asking and what they
may do. This feature answers both: it lets invited people sign in with a link sent to their
email address, keeps them signed in on each of their devices, and separates the one admin
(Antn, at launch) from everyone else.

The constitution makes several parts of this binding rather than design choices: strict TDD
starts with this feature; CI must test magic-link expiry and single use, session fixation,
CSRF on every state-changing route and role checks (Quality Gates, Security); staff get 403
on every admin route and nobody, admin included, can read or change another person's
verdicts, pile or Discogs token (Principle VIII); secrets never reach the browser
(Principle VIII); and logs and telemetry carry the pseudonymous staff ID, never the email
address (Principle VII, and 001/FR-004 and 001/FR-005).

**Actors**
- **Admin**: Antn at launch. Invites colleagues and manages who has access.
- **Staff member**: an invited colleague with an active account.
- **Invitee**: someone an admin has invited who has not signed in yet.
- **Visitor**: anyone without a valid session, including people who were never invited.

## Clarifications

### Session 2026-11-25

- Q: How long should a sign-in link stay valid, and how long should an invite link stay valid? → A: Sign-in link 15 minutes; invite link 7 days.
- Q: How long should a session last, after how much inactivity should it end, and should there be a "remember me" choice? → A: Sessions last 90 days, end after 30 days idle, no remember-me.
- Q: What limits should apply to requests for sign-in links and to attempts at entering link codes? → A: Link requests 3 per email address per 15 min and 20 per client per hour; 10 wrong code tries per client per 10 min; no tool-wide cap. (Amended after review: a "code dies after 5 wrong tries" limit was dropped, because a code is entered without an email address, so a wrong guess can't be tied to a code.)
- Q: Which email service and sender address should send the sign-in and invite emails? → A: IONOS SMTP, sending from a mailbox on `rivierarecords.de` (for example `dig@rivierarecords.de`).
- Q: Can an admin remove admin rights from another admin or deactivate them, and can an admin demote or deactivate themself? → A: Admins can demote or deactivate other admins, never themselves; self-removal needs another admin.
- Q: Should 002 already allow for a read-only role, so the shop owner could see the staff purchases log without being an admin? → A: No. Two roles only, admin and staff; any later role is a change to 002's role model.
- Q: How should the first admin account (Antn's) be created on a fresh install, when there is no admin yet to send the invite? → A: A one-off host-machine command takes a name and email, creates the admin and sends an invite link; it refuses once any admin exists. (Superseded by the startup setting below.)
- Q: Should an admin be able to reactivate a deactivated person, or change a person's email address? → A: Admins can reactivate (fresh invite link, same staff ID and history); email changes stay out of scope.
- Q: What should an admin be able to see and do about other people's signed-in devices? → A: Admins see each person's device count and can "sign out everywhere" without deactivating, no device names; shown only in the laptop (computer) layout, not on phones.
- Q: When someone opens a sign-in link, should they have to tap "Confirm sign-in" before they are signed in? → A: Yes: opening the link shows a "Confirm sign-in" button and only tapping it signs in; no automatic confirm by script.
- Q: How should the first admin be created on a fresh install? (revisited) → A: From the `.env` setting `INITIAL_ADMIN_EMAIL` (Antn's address, set only in `.env`, never committed): at startup, if no admin exists, the api creates that admin and emails an invite; otherwise it does nothing.
- Q: With the per-code counter dropped, should wrong link-code guesses get a tool-wide cap? → A: No; only 10 wrong tries per client per 10 min.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Accept an invite and sign in for the first time (Priority: P1)

Antn invites a colleague by name and email address. The colleague gets an email with a
sign-in link to the tool's public address. They open it on their phone, confirm, and land
in the tool signed in as themselves, with this phone recorded as one of their devices.

**Why this priority**: Without it, nobody but the first admin can use the tool. It is the
smallest slice that makes the tool usable by a second person.

**Independent Test**: As an admin, invite an email address; read the captured email; open
the link, confirm, and check that the invitee is signed in with the staff role and that a
device is recorded for them.

**Acceptance Scenarios**:

1. **Given** an admin invites "Mia" at an email address nobody uses yet, **When** the invite
   is saved, **Then** one email is sent to that address containing a sign-in link that starts
   with `APP_URL`, and Mia appears on the People page as "invited".
2. **Given** Mia opens the link within its lifetime, **When** she confirms sign-in, **Then**
   she is signed in with the staff role, her account becomes active, and her current device is
   recorded.
3. **Given** Mia has used the link once, **When** anyone opens the same link again, **Then**
   sign-in is refused with a message offering to send a new link, and no session is created.
4. **Given** the link's lifetime has passed, **When** Mia opens it, **Then** sign-in is refused
   in the same way.
5. **Given** an email security scanner fetches the link before Mia does, **When** Mia then
   opens it and confirms, **Then** she still signs in, because opening the link alone never
   uses it up.

---

### User Story 2 - Sign in again with a magic link (Priority: P1)

A staff member whose session has ended, or who is on a new browser, enters their email address
on the sign-in screen and receives a fresh sign-in link.

**Why this priority**: Every staff member needs this to get back in. Together with Story 1 it
is the whole sign-in flow.

**Independent Test**: Request a link for an active staff member's address, open it, confirm,
and check that a new session exists and that any session the browser held before sign-in no
longer works.

**Acceptance Scenarios**:

1. **Given** an active staff member enters their email address, **When** they submit it,
   **Then** they see a neutral message ("If this address has access, a sign-in link is on its
   way") and one email with a fresh link is sent.
2. **Given** someone enters an address that was never invited, belongs to a deactivated
   account, or whose invite was cancelled, **When** they submit it, **Then** they see exactly
   the same message, with the same status and comparable timing, and no email is sent.
3. **Given** a browser holds a session identifier before sign-in, **When** sign-in completes,
   **Then** the browser receives a new session identifier and the old one no longer
   authenticates anything.
4. **Given** a staff member requests two links in a row, **When** they open the older one,
   **Then** it is refused, because a new sign-in link replaces any earlier unused sign-in link
   for the same person.
5. **Given** an invited person who hasn't used their invite yet, **When** they request and use
   an ordinary sign-in link instead, **Then** they are signed in and become active; **and when**
   someone else requests sign-in links for that address, **Then** the invite link keeps working.

---

### User Story 3 - Admin and staff each get only what their role allows (Priority: P1)

Staff members can use everything meant for staff. Every admin page and admin action answers
"forbidden" to them, however they reach it. Signed-out visitors can reach only the sign-in
screens.

**Why this priority**: Role checks and the 403 rule are constitutional invariants (Principle
VIII) and a required CI security test. Every later admin feature relies on them.

**Independent Test**: For every admin route, send a request as a signed-out visitor, as a
staff member and as an admin, and check the answers are "sign in required", "forbidden" and
success respectively.

**Acceptance Scenarios**:

1. **Given** a signed-in staff member, **When** they call any admin route directly, **Then** the
   answer is 403 and nothing changes.
2. **Given** a signed-out visitor, **When** they call any route other than the sign-in routes
   and the health endpoints, **Then** the answer is 401.
3. **Given** an admin makes a staff member an admin, **When** that person's next request
   arrives, **Then** it is judged with the admin role, with no need to sign in again.
4. **Given** a staff member signed in, **When** the tool shows its navigation, **Then** admin
   pages are not offered to them (the server-side 403 still applies).

---

### User Story 4 - Admin manages people (Priority: P2)

On the People pages, the admin sees everyone with their role, status (invited, active,
deactivated) and when they were last seen. The admin can invite someone, resend or cancel a
pending invite, deactivate an account, reactivate a deactivated one, and make someone an admin.
On the laptop, the admin also sees how many devices each person is signed in on and can sign
them out everywhere without deactivating them.

**Why this priority**: Needed to run the team after launch, but Story 1's invite is enough to
onboard the first colleagues.

**Independent Test**: As an admin, perform each People action and check its effect on the
person's status, their sessions, and the emails captured.

**Acceptance Scenarios**:

1. **Given** a pending invite, **When** the admin resends it, **Then** a new email with a new
   link is sent and the previous invite link stops working.
2. **Given** a pending invite, **When** the admin cancels it, **Then** its link stops working
   and the person disappears from the People list's pending invites.
3. **Given** an active staff member signed in on two devices, **When** the admin deactivates
   them, **Then** both devices are signed out at their next request, their devices and push
   subscriptions are removed, any outstanding sign-in links and link codes stop working, and
   everything they recorded in the tool (for example verdicts, once they exist) is kept.
4. **Given** a deactivated person, **When** they request a sign-in link, **Then** they get the
   neutral message and no email.
5. **Given** an admin invites an address that already belongs to anyone on the list (invited,
   active or deactivated), **When** they save, **Then** the invite is refused with a message
   saying the person is already on the list (and, if deactivated, offering to reactivate them).
6. **Given** a deactivated person, **When** the admin reactivates them, **Then** they get a fresh
   invite email, and once they sign in from it they are active again under the same staff ID,
   with everything they recorded before.
7. **Given** a staff member signed in on two devices, **When** the admin, in the laptop layout,
   chooses "sign out everywhere" for them, **Then** both devices answer 401 at their next request,
   the person stays active and can sign in again, and the admin saw only "2 devices", never the
   device names.

---

### User Story 5 - Link an extra device with a code (Priority: P2)

A staff member signed in on their laptop wants to use their phone too, without waiting for an
email. On the laptop they ask for a link code and get six digits. On the phone's sign-in
screen they choose "I have a code" and type them. The phone is now signed in as them and
appears in their device list.

**Why this priority**: The tool is meant for phone and laptop together. Email links already
cover it, so the code is a convenience.

**Independent Test**: As a signed-in staff member, request a code; on a second browser, enter
it and check it signs in as the same person with a new device record; then check the code
cannot be used again and that a code older than 10 minutes is refused.

**Acceptance Scenarios**:

1. **Given** a signed-in staff member asks for a link code, **When** it is shown, **Then** it is
   6 digits and says it expires in 10 minutes.
2. **Given** a valid code, **When** it is entered on another browser, **Then** that browser is
   signed in as the same person, with a new session and a new device record.
3. **Given** a code has been used, or 10 minutes have passed, **When** it is entered, **Then**
   it is refused and nothing is signed in.
4. **Given** someone enters wrong codes repeatedly, **When** they pass the attempt limit,
   **Then** further attempts are refused for a while, even with a correct code.

---

### User Story 6 - See and sign out my devices (Priority: P3)

On their "You" page, a staff member sees the devices they are signed in on, with a name and
when each was last seen. They can rename a device, sign one out, or sign out everywhere else.

**Why this priority**: Useful hygiene, especially after losing a phone; not needed to start
using the tool.

**Independent Test**: Sign one person in on two browsers, list devices from one, sign the
other out, and check its next request answers 401.

**Acceptance Scenarios**:

1. **Given** a staff member signed in on a phone and a laptop, **When** they open their device
   list, **Then** both devices appear with a name and a last-seen time, and the current one is
   marked.
2. **Given** they sign the phone out from the laptop, **When** the phone makes its next request,
   **Then** it answers 401 and the phone's push subscription is removed.
3. **Given** they sign out on the current device, **When** they reload, **Then** they see the
   sign-in screen.
4. **Given** any person, admin included, **When** they ask for another person's devices,
   **Then** they cannot see or change them, apart from the admin's device count and "sign out
   everywhere" (FR-028).

---

### Edge Cases

- A sign-in link is opened on a different device or browser from the one that asked for it:
  sign-in succeeds there. The link belongs to the person, not to a browser.
- A link is altered by a single character, truncated, or comes from a different deployment:
  it is refused with the same message as an expired link, without saying which check failed.
- Two browsers confirm the same link at the same moment: exactly one succeeds.
- A person is deactivated while a sign-in link or link code for them is outstanding: both stop
  working at once.
- A person is deactivated while a request of theirs is in flight: that request may complete,
  but the next one answers 401.
- An invite is resent after the original link was already used: the person is already active,
  so there is nothing to resend; the action is refused.
- The email cannot be sent (the transport fails): for a sign-in request the visitor still sees
  the neutral message and the failure is logged without the address; for an admin invite or
  resend, the admin is told the email could not be sent and can retry.
- The tool's clock moves between issuing and using a link: expiry is judged on the server's
  clock only.
- A request to change state arrives with a missing or wrong CSRF token, or from a different
  origin than `APP_URL`: it answers 403 and changes nothing, including on the sign-in
  routes themselves.
- A staff member's role changes from admin to staff while they have an admin page open: their
  next admin request answers 403.
- An admin tries to demote or deactivate themself: refused, whether or not other admins exist
  (FR-030). Another admin has to do it.
- Two admins try to demote each other at the same moment: at most one change applies, so at least
  one active admin remains.
- An email address is entered with different letter case or surrounding spaces: it is matched
  to the same person.

## Requirements *(mandatory)*

### Functional Requirements

**Invites and sign-in links**

- **FR-001**: Access MUST be invite only. Only an admin can add a person, by name and email
  address; there is no self-registration.
- **FR-002**: Inviting a person MUST create them with the staff role (the first admin of FR-033
  is the one exception) and the status "invited",
  and send one email containing a sign-in link. Email addresses MUST be compared after trimming
  spaces and ignoring letter case, and an address can belong to at most one person.
- **FR-003**: Any visitor MUST be able to request a sign-in link by entering an email address.
  A link MUST be emailed only when the address belongs to an active or invited person. The
  visible answer, its status code and its timing MUST NOT reveal whether the address is known.
- **FR-004**: Every sign-in link MUST point at the configured `APP_URL` and MUST contain an
  unguessable token of at least 128 bits of randomness. The token MUST be stored only in a form
  from which it cannot be recovered (for example a hash), never as sent.
- **FR-005**: A sign-in link MUST expire 15 minutes after it is issued, and an invite link 7
  days after it is issued. An expired link MUST be refused, judged by the server's clock.
- **FR-006**: A sign-in or invite link MUST be usable only once. Using it MUST be atomic, so
  that if it is confirmed twice at the same time, exactly one confirmation creates a session.
- **FR-007**: Opening a link MUST NOT use it up or sign anyone in. It MUST show a confirmation
  step with a "Confirm sign-in" button, and only pressing it uses the link, so that mail scanners
  and link previews can't spend it. The page MUST NOT confirm automatically, by script or
  otherwise.
- **FR-008**: Issuing a new sign-in link for a person MUST invalidate their earlier unused
  sign-in links, and MUST NOT affect an outstanding invite link, so that someone who knows an
  invitee's address can't cancel their invite by requesting sign-in links. Issuing a new invite
  link (resend, reactivation) MUST invalidate every earlier unused link for that person, of
  either kind.
- **FR-009**: A refused link (unknown, altered, expired, used, cancelled, or for a deactivated
  person) MUST get one and the same message, offering to send a new link, without saying why it
  was refused.
- **FR-010**: Any completed sign-in by an invited person, from an invite link or a sign-in link,
  MUST change their status from "invited" to "active" and invalidate their remaining unused
  links, so resend and cancel (FR-029) no longer apply to them.

**Sessions and devices**

- **FR-011**: Completing sign-in (by link or link code) MUST create a new server-side session
  and a new device record for that person, and MUST issue a new session identifier. Any session
  identifier the browser presented before sign-in MUST be discarded and MUST NOT authenticate
  afterwards (no session fixation).
- **FR-012**: The session identifier MUST be carried only in a cookie that page scripts can't
  read, that is sent only to the tool's own origin, that is marked secure whenever `APP_URL`
  uses HTTPS, and that is not sent on cross-site sub-requests. Session identifiers MUST be
  unguessable (at least 128 bits of randomness) and stored server-side only in a form from
  which they cannot be recovered.
- **FR-013**: A session MUST end 90 days after sign-in, or earlier once 30 days pass without an
  authenticated request from it, judged by the server's clock. There is no "remember me" choice:
  every session follows these limits. An ended session MUST answer 401 and remove its device
  record.
- **FR-014**: Each device record MUST hold the person it belongs to, a name, when it was
  created, when it was last seen, and optionally one push subscription. Its default name MUST be
  derived from the browser and platform (for example "iPhone · Safari"), and its owner MUST be
  able to rename it.
- **FR-015**: A device's last-seen time MUST be updated by its authenticated requests, and MUST
  be accurate to within 5 minutes.
- **FR-016**: A person MUST be able to list their own devices (marking the current one), rename
  one, sign one out, sign out every device except the current one, and sign out the current
  device. Signing a device out MUST end its session and remove its record and push
  subscription.
- **FR-017**: A person MUST be able to store and remove the push subscription of their current
  device. Storing it MUST NOT be required to use the tool.

**Link codes for an extra device**

- **FR-018**: A signed-in person MUST be able to request a link code: 6 random digits, valid for
  10 minutes, for one use. Requesting a new code MUST invalidate their previous unused one.
- **FR-019**: Entering a valid link code on the sign-in screen of another browser MUST sign that
  browser in as the code's owner, under FR-011. An unknown, used or expired code MUST be refused
  with one and the same message.
- **FR-020**: Wrong link-code attempts from one client MUST be limited to 10 per 10 minutes,
  after which every code attempt from that client is refused until the window has passed. There
  is no per-code or tool-wide limit (a code is entered without an email address, so a wrong
  guess can't be tied to a particular code).

**Rate limits**

- **FR-021**: Sign-in link requests MUST be limited to 3 per email address per 15 minutes and
  20 per client per hour. The per-address limit MUST apply the same way to unknown addresses, so
  that it reveals nothing (FR-003). A limited request MUST get a "try again later" answer with
  the time to wait, and MUST send no email.

**Roles and access**

- **FR-022**: Every person MUST have exactly one role, admin or staff, and there MUST be no other
  role. At launch, Antn is the only admin. A further role (for example read-only access to the
  staff purchases log for the shop owner, handoff §14) is out of scope and would be a change to
  this spec.
- **FR-023**: Every route MUST require a valid session except the sign-in routes (request a
  link, confirm a link, enter a link code) and the health endpoints. A request without a valid
  session MUST answer 401.
- **FR-024**: Every admin route MUST answer 403 to a signed-in staff member and MUST change
  nothing. CI MUST check this for every admin route, using a list of admin routes that is
  checked against the routes the api actually serves, so that a new admin route can't escape the
  test.
- **FR-025**: The role and active status MUST be read fresh for every request, so a change of
  role or a deactivation applies from the person's next request.
- **FR-026**: Per-person data MUST be reachable only by its owner. Every request MUST carry the
  acting person's pseudonymous staff ID, and every read or change of per-person data MUST be
  scoped to it. The admin role MUST NOT widen this scope, with one exception: the device count
  and "sign out everywhere" of FR-028. In this feature the rule MUST be
  enforced and tested on devices, sessions and push subscriptions; later features that add
  verdicts, piles and Discogs accounts MUST use the same scoping and add their own tests.
- **FR-027**: No route's response MUST contain a Discogs token, a session or CSRF secret, a
  sign-in token or a token hash, any person's own included. CI MUST check this by calling every
  served route, as each role, and scanning the responses for secret-named fields and
  secret-shaped values. (Discogs accounts and verdicts arrive in later features; their specs
  extend this scan and add their own isolation tests, see Assumptions.)

**People administration**

- **FR-028**: Admins MUST be able to see every person with name, email address, role, status
  (invited, active, deactivated), when they were invited, and when they were last seen on any
  device. For each other person, admins MUST also be able to see how many devices that person is
  signed in on, and to "sign out everywhere": end all that person's sessions and remove their
  devices and push subscriptions without deactivating them. Admins MUST NOT see anyone else's
  device names, individual devices, sessions or push subscriptions. The device count and the
  "sign out everywhere" action MUST appear only in the laptop layout of the People pages (as on
  the design canvas, checked at 1440×900) and MUST NOT appear in the phone layout (checked at
  390×844). The server enforces the admin role for both (FR-024); it doesn't tell layouts apart.
- **FR-029**: Admins MUST be able to resend a pending invite (FR-008 applies) and cancel a
  pending invite (its links stop working at once). Neither action applies to an active or
  deactivated person.
- **FR-030**: Admins MUST be able to make an active staff member an admin, and to make another
  admin a staff member again. An admin MUST NOT be able to demote or deactivate themself: those
  requests MUST be refused and change nothing, so giving up admin rights always needs another
  admin. Once any admin has signed in, the tool MUST always keep at least one active admin, and
  MUST refuse any action that would leave none.
- **FR-031**: Admins MUST be able to deactivate any other person, other admins included (FR-030). Deactivation MUST end all their
  sessions, remove their devices and push subscriptions, and invalidate their outstanding links
  and link codes, all at once. It MUST keep the person's record and everything recorded under
  their staff ID, and a deactivated person MUST NOT be able to sign in.
  Admins MUST be able to reactivate a deactivated person: this sets their status to "invited" and
  sends a fresh invite link (FR-002, FR-005), keeping the same staff ID, role and everything
  recorded under it; signing in from that link makes them active again (FR-010). Cancelling such
  an invite (FR-029) returns the person to "deactivated" rather than removing them.
- **FR-032**: Every People action (invite, resend, cancel, deactivate, reactivate, role change,
  sign out everywhere) MUST be
  recorded with who did it, to whom, what, and when, identified by staff IDs.
- **FR-033**: The first admin MUST come from the `.env` setting `INITIAL_ADMIN_EMAIL` (for this
  install, Antn's address; it is set only in `.env` and never committed, and `.env.example` names
  the setting with an empty value). The admin's name comes from the optional `INITIAL_ADMIN_NAME`,
  or else from the part of the address before the `@`. When the api starts and no admin exists in any status,
  it MUST create that person as an invited admin and send them an invite link (FR-002, FR-005),
  so starting a fresh install emails the first admin. When any admin exists, startup MUST
  change nothing and send nothing, whatever the setting says. The setting MUST NOT be reachable
  over HTTP, and the api MUST NOT log or print the address, the link or the token. If no admin
  exists and the setting is empty, the api MUST still start and MUST log, without any address,
  that no first admin is configured. A first admin whose invite has expired gets in with an
  ordinary sign-in link (FR-003, FR-010).

**Request integrity and secrets**

- **FR-034**: Every state-changing request (any method other than GET, HEAD or OPTIONS) MUST
  carry a valid CSRF token bound to the browser's session (or, before sign-in, to a pre-sign-in
  token), and MUST come from the `APP_URL` origin. Otherwise it MUST answer 403 and change
  nothing. This MUST apply to the sign-in routes too. GET and HEAD requests MUST NOT change
  state, apart from session bookkeeping: updating last-seen times (FR-015) and removing an ended
  session and its device (FR-013). CI MUST check every state-changing route, from a route list checked against the routes
  the api actually serves.
- **FR-035**: What is sent to the browser (responses, pages, the built frontend bundle) MUST NOT
  contain the session secret, SMTP credentials, stored token or session hashes, or any other
  server-side secret. Session identifiers MUST reach the browser only in the cookie of FR-012.
- **FR-036**: The session secret and SMTP credentials MUST come from `.env`
  (`SESSION_SECRET`, `SMTP_URL`), never from committed files; the sender address comes from
  `EMAIL_FROM` (FR-037) and the first admin's address from `INITIAL_ADMIN_EMAIL` (FR-033). The api MUST refuse to start in
  production if the session secret is missing or shorter than 32 bytes, or if no SMTP transport
  is configured, and MUST say which setting is missing without printing any value.

**Email**

- **FR-037**: Email MUST be sent through one email interface with interchangeable transports.
  Production MUST use an SMTP transport to IONOS SMTP, sending from a mailbox on
  `rivierarecords.de` (for example `dig@rivierarecords.de`) given by the `.env` setting
  `EMAIL_FROM`; the api MUST refuse to start in production if `EMAIL_FROM` is missing or not an
  address on `rivierarecords.de`. Development and CI MUST use a capture transport that stores
  messages where tests and developers can read them and sends nothing.
- **FR-038**: The api MUST refuse to start with the SMTP transport unless the deployment
  environment is production, so development and CI can never send real email.
- **FR-039**: Sign-in and invite emails MUST contain the link, the person's name, and how long
  the link is valid, and nothing secret beyond the link itself.

**Logs and telemetry**

- **FR-040**: Logs, span attributes and metric labels MUST NOT contain email addresses, names,
  sign-in tokens or links, link codes, session identifiers, CSRF tokens or push subscription
  data. They MUST identify people only by pseudonymous staff ID (001/FR-004) and MUST go through
  001's redaction (001/FR-005). Tests MUST plant each of these values in auth flows and check
  that none appears in emitted telemetry.
- **FR-041**: Auth MUST emit structured logs and metrics for link requests, sign-ins, link-code
  attempts, rate-limit refusals, CSRF and role refusals, emails sent, and People actions, each by
  outcome, with bounded labels only (001/FR-018).

### Key Entities

- **Person (staff)**: one member of the shop who may use the tool. Pseudonymous staff ID, email
  address, name, role (admin or staff), status (invited, active, deactivated), when they were
  invited and by whom.
- **Session**: one signed-in browser. Belongs to a person and a device; created at sign-in;
  ends by sign-out, expiry or deactivation. Only a non-recoverable form of its identifier is
  stored.
- **Device**: the signed-in browser as the person sees it: name, created, last seen, optional
  push subscription. One per session.
- **Magic link**: a single-use, expiring sign-in or invite token for one person. Kind (sign-in
  or invite), issued, expires, used or invalidated. Only a non-recoverable form of the token is
  stored.
- **Link code**: a 6-digit, single-use code for one person, valid 10 minutes.
- **People action record**: who did which People action to whom, and when.
- **Outgoing email**: recipient, kind (invite, sign-in), the link, and the outcome of sending.
  In development and CI it is captured instead of sent.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An invited colleague can go from opening their invite email to being signed in in
  under 1 minute.
- **SC-002**: A staff member can link a second device with a code in under 30 seconds.
- **SC-003**: In the security test suite, 100% of attempts to use an expired, used, altered or
  cancelled link or code are refused, and no pre-sign-in session identifier ever authenticates
  after sign-in.
- **SC-004**: 100% of admin routes answer 403 to staff, and 100% of state-changing routes answer
  403 without a valid CSRF token or from a foreign origin, as checked in CI.
- **SC-005**: After deactivation, the person's next request from every one of their devices is
  refused, with zero exceptions in tests.
- **SC-006**: Zero planted email addresses, names, tokens, codes or session identifiers appear in
  emitted telemetry across the auth test suite, and zero secret-shaped strings in the built
  frontend bundle.
- **SC-007**: Zero real emails are sent from development or CI.
- **SC-008**: Requesting a link for an unknown address is indistinguishable from requesting one
  for a known address in message, status code, and timing (median within 50 ms over 100
  requests in a test).

## Assumptions

- Wrong link-code attempts are limited only per client (FR-020, clarified 2026-11-25). Antn
  accepted that someone guessing from many client addresses is not capped.
- The client a rate limit counts is identified by the connecting address the proxy reports.
  Behind the Cloudflare Tunnel that is Cloudflare's client-address header, trusted only from the
  tunnel; locally, the proxy's view of the client.
- Changing a person's email address is out of scope for 002 (clarified 2026-11-25); it can be
  raised as a later change.
- The team list (names, current box, heard count) that every staff member sees belongs to a later
  feature; this feature exposes no other person's data to staff.
- Verdicts, piles and Discogs accounts don't exist yet. FR-026 and FR-027 set the rule they must
  follow and how it is tested; each owning feature proves it for its own data. In particular,
  the specs that add verdicts and Discogs accounts must require that nobody can change another
  person's verdicts and that no route returns a Discogs token (constitution, Principle VIII).
- Cloudflare Access in front of `/admin` (handoff §12) is optional and outside this feature; the
  tool's own role checks must hold without it.
- The public domain isn't chosen yet. Everything is driven by `APP_URL`, which locally is
  `http://localhost:8080`.
- The IONOS mailbox used as `EMAIL_FROM`, and its SMTP credentials, are set up by Antn before
  launch. Its name is a deployment choice, not a spec change.
- Admin pages are built for the laptop layout first (handoff §11 step 9); this feature delivers
  working People pages, not their final visual design.
