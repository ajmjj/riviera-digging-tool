# Shop locations (Common Ground `Listing.location`)

The full list of locations in Common Ground, as Antn gave it on 2026-11-26. A listing's
`location` is its box (handoff §3, §4). There are 284 locations.

## What the list shows

- **Codes are names, not `A01`-style codes.** A location is `<Genre> <n>`, `<Genre> Keller <n>`
  or a single named place. The `C14` in the handoff's Discogs note example is not a real code;
  a real one is, for example, `House Keller 12`.
- **The order Antn gave is a natural sort**: numbers compare as numbers (`High Price 2` comes
  before `High Price 10`). A plain string sort puts `10` before `2`, so the tool must not
  sort location strings with plain string comparison.
- **"Keller" is the basement.** Most genres have a few boxes on the shop floor and many more
  in the basement.
- **Some locations are probably not boxes to dig.** See the questions below.

## Numbered boxes (265)

| Genre | Shop floor | Keller |
|---|---|---|
| Album | – | Album Keller 1–4 |
| Disco | Disco 1–2 | Disco Keller 1 |
| DnB Jungle | – | DnB Jungle Keller 1 |
| Electro | Electro 1–2 | Electro Keller 1–5 |
| High Price | High Price 1–36 | – |
| Hip Hop | Hip Hop 1–2 | Hip Hop Keller 1–11 |
| Hits | Hits 1–6 | Hits Keller 1–23 |
| House | House 1–6 | House Keller 1–78 |
| Listening | Listening 1 | Listening Keller 1–3 |
| Minimal | Minimal 1–4 | Minimal Keller 1–22 |
| Promo | – | Promo Keller 1–5 |
| Techno | Techno 1–4 | Techno Keller 1–43 |
| Ten Inch | – | Ten Inch Keller 1 |
| UK Bass | UK Bass 1–2 | UK Bass Keller 1–3 |

## Single locations (19)

- `7"`
- `Archiv / Verkauft` (archive / sold)
- `Clone Backstock`, `Pascal Feos Backstock`
- `Dopplereffekt Keller`
- `Graue Box Regal Top 1`
- `PROMO`
- `NEW`, and `NEW / ALBUM`, `NEW / Cassette`, `NEW / DISCO`, `NEW / ELECTRO`, `NEW / HOUSE`,
  `NEW / LISTENING`, `NEW / MINIMAL`, `NEW / MUNICH`, `NEW / TECHNO`, `NEW / UK BASS`

## Open questions for Antn

1. **Shelf order.** Is it the natural sort above (alphabetical, numbers as numbers), or
   genre by genre with the shop floor before the Keller?
2. **What is not dug?** Should `Archiv / Verkauft`, the two backstocks, `PROMO`,
   `NEW / Cassette` and `Graue Box Regal Top 1` be left out of box digging, or shown as boxes
   like the others?
3. **NEW boxes.** Do records in `NEW / …` move to a genre box later? If so, a record changes
   location after staff have heard it, which matters for `dig_position(staff_id, box_code,
   index)` and the "new arrivals" notification (handoff §7).
4. **Genre label.** Can `box.genre_label` be taken from the name (drop ` Keller` and the
   number, so `House Keller 12` → House), with `High Price`, `Hits`, `Promo` and the singles
   as their own labels?
