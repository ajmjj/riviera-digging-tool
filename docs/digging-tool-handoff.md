# Riviera Dig — build brief for Claude Code

Design: the "Riviera Digging Tool" canvas, https://claude.ai/artifact/EAZ4ywg9dzi7ksFjuFyYH6 (phone and laptop artboards, plus a notes panel).
Related: `claude/checkout-api-findings.md` (staff checkout), and the two Common Ground schema files in this project.
All records, prices, names and counts on the canvas are sample data.

## 1. What it is

An internal tool that lets Riviera Records staff listen through the shop's ~20,000 records methodically and keep track of what they've heard:
- Each staff member marks every record **Pass / Maybe / Want**, or **No audio** if there's nothing online to play.
- Wants are collected into a **pile**, which they **pull** from the boxes and **check out** at their staff price.
- It works on phone and laptop with one account per person, synced between devices.
- Everyone digs independently, and nobody claims boxes.

## 2. Architecture

- **Backend service.** This is the same intermediary already planned for the Chrome extension and the stale-stock dashboard, so build it once and share it.
  - It holds the Common Ground Admin API key, which must never reach a browser, plus a Postgres database and a job runner.
  - Common Ground allows 60 requests a minute for the whole shop, so everything goes through one rate-limited queue.
- **Frontend.** One responsive web app (a PWA, so it can be added to the iPhone home screen and receive push notifications). The phone layout and laptop layout share all logic.
- **No live inventory queries from the client.** Screens read the backend's database, and the backend syncs from Common Ground.
- **Everything runs in Docker**, hosted locally by Antn for now and reached through a Cloudflare Tunnel. See section 12.

## 3. Data model (minimum)

- `staff(id, email, name, role[admin|staff], status[invited|active|deactivated], …)`. Antn is the only admin at launch; admins can make others admins.
- `session`, `magic_link`, `device(staff_id, name, last_seen, push_subscription)`, `link_code` (6 digits, 10-minute expiry). Tokens and codes are stored only as keyed hashes, never as sent.
- Auth is specified in `specs/002-auth/` (spec and `data-model.md`), which wins over this sketch.
- `record(listing_id, item_id, listing_ref, discogs_release_id, artist, title, label, catno, year, styles[], genres[], condition, list_price, location /*box*/, has_snippet, cg_snippet_uris[], cg_video_uris[], status, posted, synced_at)`
- `box(code, genre_label, sort_order, diggable)`. The shelf order comes from the box code, unless a config overrides it (open question, section 14). `diggable` is set by the admin; records in a box that isn't diggable never appear in Dig or For you.
- `verdict(staff_id, listing_id, value[pass|maybe|want|noaudio], created_at, source[box|foryou|shoplist])`. There is one current verdict per staff member per record, and every change is logged so undo works.
- `dig_position(staff_id, box_code, index)`
- `taste_profile(staff_id, weights jsonb, signatures text[], updated_at)` and `discogs_collection(staff_id, release_id)`
- `discogs_account(staff_id, username, token_encrypted, checked_at)`
- `notification_pref(staff_id, type, enabled)` and `quiet_hours`
- `staff_order(id, staff_id, cg_order_id, lines jsonb, list_total, staff_total, status, paid_method, created_at)`
- `shop_settings(price_rule jsonb, shift_days, updated_by, updated_at)`

## 4. Syncing from Common Ground (Admin API)

- **Nightly full sync.** Page through `inventory(filters: { stock: "inStock", itemTypes: ["ReleaseItem"] })` and upsert the records.
  - A listing's `location` is its box. The item's `data.discogsId`, `data.videos`, `data.styles`, `data.genres` and `data.labels` fill in the rest.
  - Use the `hasAudio` filter (or `itemStatsForIds.audioPreviewsCount`) to set `has_snippet`.
- **Frequent light sync**, every 10–15 minutes and when the app opens:
  - New arrivals via `filters.createdDate`.
  - Sold or out-of-stock listings, which are dropped from piles and trigger the "sold" notification.
- **Budget:** with page sizes at the server maximum, a full sync is roughly a couple of hundred requests, so it fits comfortably at night.
- **Catch-up:** because the host machine may be off at night, the worker runs any missed nightly sync when it starts.

## 5. Audio

Each record tries three sources in order:
1. The shop's own Common Ground snippets.
2. The Discogs release videos (YouTube). Use the `data.videos` already stored on the item first, and fall back to the Discogs API (`/releases/{id}`) if there are none.
3. Neither: the record goes on the **shop list**, to be played on the turntable.

**Needle drop.** For each track, play about 15 seconds at 25%, 50% and 75% of its length, then move on automatically. Use the YouTube IFrame API's `seekTo`.

## 6. Rules

- **Staff price:** −50% if the list price is €20 or less, −30% if it's over €20.
  - Round to the cent, raise anything under €5 to €5, and never go above the list price.
  - `price = min(list, max(5, round(list × (list > 20 ? 0.7 : 0.5), 2)))`
  - The percentages, threshold and minimum live in `shop_settings` so an admin can change them.
- **Dig order:** by box, in shelf order, then by position within the box.
  - Box digging never reorders anything. Match % is only shown as a badge.
- **Progress:** a record counts as heard once it has any verdict. "For you" and the shop list write the same verdicts as box digging, so nothing is ever heard twice.

## 7. Screens and what they need

(Phone tab bar: Dig · For you · Boxes · Pile · You. Laptop top menu: Dig · For you · Boxes · Pile, with You behind the avatar.)

| Screen | Data / calls |
|---|---|
| Sign in / First run | Magic-link email, invite only. First run offers a Discogs import, picking a starting box, and turning on notifications |
| Dig (phone + laptop) | Next record from `dig_position`, the audio sources, staff price, match %, POST verdict, undo. Laptop shortcuts: 1/2/3/0, Space, →, ↓, U |
| For you (swipe) | Unheard records across all boxes, sorted by match %, filtered (70%+, all boxes, under €20). "Why" chips come from the profile features |
| Boxes / Box detail | Per-box counts of heard, want, maybe, matches and no audio. Detail lists records with their status. "Continue at record N" |
| Shop list | Records with `noaudio` or no source, grouped by box, with Pass / Maybe / Want buttons |
| Pile (Want / Maybe) | Staff price per record. Sold items greyed out with a banner. Empty state |
| Pull list (phone) | The Want pile in shelf order, ticked off one record at a time. Laptop "Pull on my phone" sends a push notification that opens it |
| Staff checkout | Only the records ticked on the pull list. See section 9 |
| Discogs connect | Personal access token → validate with `/oauth/identity` → store encrypted. Send it as `Authorization: Discogs token=…`. Export = add each Want to the wantlist with an optional note "Riviera · box C14 · staff €7.50", queued at Discogs' limit of 60 requests a minute |
| You & team | Profile counts, devices, link code, team list (heard, current box, % of shop), notification switches. Admins invite colleagues from People, on the laptop only (spec 002, FR-028) |
| Your sound | Signatures, want rate per style, eras, labels, taste twin. "Tune it" hides a style or label |
| Notifications | Price drop on Maybe/Want records or strong matches (especially when a price crosses €20 and the discount doubles), pile record sold, new arrivals that match (only in boxes already finished), shop-list reminder on shift days, weekly recap. Respect quiet hours |
| Admin pages (laptop) | People, shop settings, staff purchases log, sync health. See section 13. Not on the canvas yet. People is laptop only; a phone shows a note to use a computer (spec 002, FR-028) |

## 8. Taste profile ("Your sound")

- **Features per record:** its styles, label, decade, country and format, all from Common Ground's item data.
- **Weights:** for each feature, (wants + 0.5 × maybes) ÷ times heard, smoothed with a small prior. Seed it from the Discogs collection and wantlist if the person imports them.
- **Match %:** the record's average feature weight, rescaled to 0–100.
- **Signatures:** the top 2–3 feature combinations.
- **Taste twin:** the colleague whose wants overlap most with yours, by cosine similarity.
- Recompute nightly and after every 25 new verdicts.

## 9. Staff checkout (decided: a staff price on every line)

The Admin API can't create orders, so:
1. Staff start an empty Shop order at the till in Common Ground.
2. The tool lists open orders with `orders(ordersFiltersInput: { origin: ["Shop"], status: ["New Order"] })` and the staff member picks one.
3. For each pulled record: `orderAddItem(orderId, listingRef)`, then `orderUpdateLine(orderId, line)` with the staff price. Read the line back from `order(id)` first and change only the price fields.
4. Re-read the order and check that `totals.grand` matches the staff total. If it doesn't, stop and show the difference.
5. Add `orderAddNote` "Staff purchase · {name}".
6. Record payment with `orderAddPaymentMethod({ origin: cash|card, amount }, markAsPaid: true)`.
7. Write a `staff_order` row for the admin's staff purchases log.

## 10. Spikes before building (do these first)

1. **`orderUpdateLine`:** which JSON shape it accepts, and whether tax and totals recalculate after a price change.
2. **Stock:** whether `orderAddItem` reserves stock straight away, and whether `orderCancel(relist: true)` puts records back.
3. **Audio coverage:** how complete `data.videos` is compared with fetching from the Discogs API, to decide how many Discogs calls are needed.
4. **Inventory sync:** the real page size limit and how long a full sync takes at 60 requests a minute.
5. **iPhone push:** whether web push works for the PWA once it's added to the home screen, over the Cloudflare Tunnel hostname (section 12). If it doesn't, fall back to email notifications.

## 11. Suggested build order

1. `docker compose` skeleton including the tunnel (section 12), backend, nightly sync, records and boxes in the database.
2. Sign-in (magic link, invite only).
3. Dig screen with audio, verdicts and progress (phone first).
4. Boxes, Box detail, Pile, Pull list.
5. Staff checkout (after spike 1).
6. Shop list, Discogs connect and export.
7. Taste profile and For you.
8. Notifications.
9. Laptop layouts, team view and admin pages (people, shop settings, staff purchases log, sync health).

## 12. Hosting and Docker (decided: local, in Docker, via Cloudflare Tunnel)

Antn hosts it on his own machine for now. Everything runs with one `docker compose up`, so it can later move to a server unchanged.

**Services in `docker-compose.yml`:**
- `api`: the backend (HTTP API, auth, Common Ground and Discogs clients).
- `worker`: syncs, the rate-limited job queue, taste-profile recompute, notifications. Same image as `api`, different command.
- `web`: the built PWA (static files), served by the proxy.
- `db`: Postgres, data on a named volume (`pgdata`).
- `proxy`: nginx, routing `/api` to `api` and everything else to `web`, on one origin.
- `cloudflared`: the Cloudflare Tunnel connector (see below).

**Rules:**
- **Secrets:** the Common Ground Admin key, the key used to encrypt Discogs tokens, the session secret, SMTP credentials, the web-push keys and the Cloudflare tunnel token go in `.env`. Commit only `.env.example`, never `.env`.
- **Database:** migrations run automatically when `api` starts.
- **Health:** each service has a healthcheck, `restart: unless-stopped`, and logs to stdout.
- **Backups:** a nightly `pg_dump` into a mounted `./backups` folder, keeping the last 14.
- **Convenience:** a `Makefile` or scripts for `up`, `down`, `logs`, `backup`, `restore` and `seed` (seed loads sample data for working on the design without the live API).

**Reaching it from a phone: Cloudflare Tunnel (decided).**
- `cloudflared` connects out to Cloudflare, started with `CLOUDFLARE_TUNNEL_TOKEN` from `.env`.
- Public hostname on the tool's own domain (see Domain below), routed by the tunnel to the proxy's tunnel-only listener `proxy:8081`, the only place Cloudflare's client-address header is trusted (spec 002, research R1).
- Cloudflare handles HTTPS. Inside the Docker network everything is plain HTTP.
- No ports are opened on the router. Compose publishes nothing to the internet; for local debugging it binds only to `127.0.0.1`.
- This gives HTTPS on a fixed address, so the iPhone install prompt, push notifications and sign-in links work, at home and in the shop.
- Access stays invite-only through the tool's own magic-link sign-in. Optionally, put Cloudflare Access (email one-time code) in front of `/admin` as a second lock.
- `APP_URL` in `.env` is the public hostname. Sign-in links, the PWA manifest and the push setup all use it.
- **Domain:** `rivierarecords.de` is registered and its DNS is hosted at IONOS. Cloudflare's free plan can only run a tunnel hostname on a domain whose nameservers point to Cloudflare. Keeping IONOS DNS and only routing one subdomain through Cloudflare needs the Business plan or higher.
  - **Decided (2026-11-26):** register a small separate domain for the tool (it can be bought at IONOS) and point *its* nameservers to Cloudflare (free plan). The tunnel hostname, `APP_URL`, sign-in links, session cookies and the PWA all live on that domain. The shop's website and email on `rivierarecords.de` are untouched, and its DNS stays at IONOS.
  - **Convenience redirect:** set up an IONOS domain forward from `dig.rivierarecords.de` to the tool's domain, so staff can type the familiar address. It is only a redirect: nothing is served or signed in on `rivierarecords.de`. Not yet checked: that IONOS offers this forwarding over HTTPS (it needs a certificate for the subdomain at IONOS); if it only forwards plain HTTP, the redirect still works when typed but browsers may warn.
  - **Not chosen:** moving `rivierarecords.de` nameservers to Cloudflare. It would risk the shop's website and email for no gain over the above.
  - Still to do: pick and register the domain name, then set `APP_URL` and add the tunnel.

**Uptime:** the tool is only available while the host machine is on. The worker catches up on missed syncs when it starts.

## 13. Roles

Antn is the only admin at launch, and admins can make others admins (spec 002, FR-030; Antn confirmed this reading of the constitution on 2026-11-25). The People part below is settled by spec 002; the rest is still a proposal for the features that build it:

**Everyone (staff):**
- Dig, swipe For you, use the shop list.
- Their own pile, pull list and staff checkout.
- Their own Discogs connection, devices, notifications and taste profile.
- See the team list: names, current box, heard count and % of the shop. They can't see anyone else's pile or verdicts.

**Admin, in addition:**
- **People:** invite colleagues, resend or cancel invites, deactivate an account, and make someone else an admin. Deactivating keeps their history but signs them out of every device.
- **Shop settings:** the staff price rule (percentages, the €20 threshold, the €5 minimum), box shelf order, box names and which boxes are dug, and the shift days used for shop-list reminders.
- **Staff purchases:** a log of every staff checkout made through the tool: who bought what, the Common Ground order, list vs staff total, and payment method. This is for the shop's books.
- **Sync health:** last nightly and light sync, errors, Common Ground rate-limit use, and a "sync now" button.

**Nobody, admin included:**
- Can see another person's Discogs token or act on their Discogs account.
- Can edit another person's verdicts.

## 14. Open questions for Antn and the shop

- ~~Does the shop owner agree to staff purchases going through the API, and to the discount rule as written?~~ Yes, both as written in sections 6 and 9 (decided 2026-11-26).
- ~~Should the shop owner get read-only access to the staff purchases log without being an admin?~~ No: two roles only, admin and staff; a further role would be a change to spec 002 (decided 2026-11-25).
- Is the shelf order simply alphabetical by box code (A01…), or does it need its own list? Still open. Common Ground locations are names, not codes (for example `Electro Keller 3`, `High Price 12`, `Archiv / Verkauft`), so the answer is either the names in natural sort order or an explicit list kept by the admin. Partly decided (2026-11-26): not every location is a box to dig, so the admin switches digging on or off per box in shop settings.
- ~~Which separate domain should the tool use (section 12, Domain)? Or does the shop want to move `rivierarecords.de` DNS from IONOS to Cloudflare?~~ A separate domain with its nameservers on Cloudflare, plus an IONOS forward from `dig.rivierarecords.de` to it; `rivierarecords.de` DNS stays at IONOS (decided 2026-11-26; section 12, Domain). Still to do: pick and register the domain name, and check that IONOS can forward that subdomain over HTTPS.
- ~~Which email address and SMTP service will send the sign-in links?~~ IONOS SMTP, from a mailbox on `rivierarecords.de` set as `EMAIL_FROM` (decided 2026-11-25; spec 002, FR-037).
