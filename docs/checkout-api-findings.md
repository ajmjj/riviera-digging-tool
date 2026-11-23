# Staff checkout via the Common Ground API — findings

Source: the Admin and Client API schema files (read 23 Nov 2026).

## Decision (23 Nov 2026)

Use **option B**. Each record goes onto the order at its own staff price, with no discount or coupon line. The design is on the canvas: the laptop Pile summary column and the phone "Staff checkout" screen.

Flow:
1. Staff start an empty Shop order at the till in Common Ground.
2. The tool lists open Shop orders with `orders(ordersFiltersInput: { origin: ["Shop"], status: ["New Order"] })` and the staff member picks one.
3. For each pile record, the tool calls `orderAddItem(orderId, listingRef)`, then `orderUpdateLine(orderId, line)` to set that line's price to the staff price.
4. The tool re-reads the order and checks that `totals.grand` matches the staff total it computed.
5. The tool calls `orderAddPaymentMethod(orderRef, { origin: "cash" | "card", amount }, markAsPaid: true)`.

Staff price rule: −50% up to €20, −30% above €20, never below €5, and never above the list price.

## What exists

**Client API (storefront):**
- `checkoutCreate`, then `checkoutUpdateItems(id, items: [{listingId, quantity}])`
- `checkoutVerifyAndUpdate(id)` to re-check stock
- `checkoutUpdate(id, buyer, billing, shipping, …)`, with `shipping.shopCollection: true` for pick-up in the shop
- `addVoucher(id, voucherId)` / `removeVoucher(id)`
- `checkout.urls.checkout` is the link to Common Ground's own checkout page. There is no mutation that pays or submits a checkout.

**Admin API (backend only):**
- No `orderCreate`, and no checkout operations. An order can't be created from scratch.
- Existing orders can be edited:
  - `orderAddItem(orderId, listingRef)`
  - `orderUpdateLine(orderId, line: JSON)`, which takes the whole line item (price, quantity, taxes) as untyped JSON
  - `orderAddDiscount(orderRef, type, value, amount)`
  - `orderAddVoucher(orderRef, voucherRef)`
  - `orderAddPaymentMethod(orderRef, {origin: "cash"|"card"|…, amount}, markAsPaid)`
  - `orderUpdateStatus`, `orderCancel(relist)`
- `voucherCreate(amount, redeemType: "value"|"percentage", value, spendingLimit, expires, userRef, note, id/prefix)`
- Order origins include "Shop" (POS) and "Online"; statuses include "Quote".

## Options considered

**A. Basket plus a one-off coupon (rejected).** The backend would create a Client checkout and apply a single-use value coupon for the difference between list and staff total. The total is exact, but the invoice would show list prices and one discount line, not a staff price per record.

**B. Fill an order started in the Common Ground POS (chosen).** See the decision above.

## To test before building (option B)
- What line JSON does `orderUpdateLine` accept? The safest approach is probably to read the line from `order(id)`, change `price.base` / `price.beforeTaxes` and keep everything else.
- Do taxes and `totals` recalculate after the change?
- Does `orderAddItem` reserve or decrement stock straight away? And does `orderCancel(relist: true)` put records back if a staff order is abandoned?
- Does the order's `seller` or a note record which staff member bought it? If not, add an `orderAddNote` such as "Staff purchase · Antn".

## Also confirmed for the digging tool
- `Listing.location` is the storage box.
- `Item.data.discogsId` is the link used to fetch Discogs videos.
- `Item.data.videos` lists the Discogs videos stored in Common Ground.
- The `hasAudio` inventory filter finds records with shop snippets.
- `Item.data.styles`, `genres` and `labels` feed the taste profile.
