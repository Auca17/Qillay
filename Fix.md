# Fix.md

Review of `mcp-server/` at `ebca87a` (PR #2, `feat/demo-tools`). Every finding below comes from reading the code. Nothing was executed against the deployed Worker, and the project has no automated tests, so each fix lists the check that proves it.

Priority: **P1** fix before the demo, **P2** fix if there is time, **P3** known risk, fine for the demo.

## Summary

| # | Priority | Problem | Where | Status |
|---|----------|---------|-------|--------|
| 1 | P1 | Parallel `add_to_cart` calls lose items | `src/cart.ts:53-60` | Done upstream (PR #3, batch `items`; Durable Object not done) |
| 2 | P1 | `split_payment` without `day` applies every promo, inflating the cashback | `src/wallets.ts:56-60` | Done upstream (PR #3, `todayInArgentina`) |
| 3 | P1 | Sample wallets disagree with the demo checkout page | `src/wallets.ts:19-24`, `demo/checkout.html` | Done |
| 4 | P2 | Two orders in one conversation get the same `order_id` | `src/index.ts:166` | Done upstream (PR #5, `placeOrder`) |
| 5 | P2 | `create_order` ignores the wallet split | `src/index.ts:159-176` | Open (my fix was dropped in the merge with PR #5) |
| 6 | P2 | The "Más barato" badge compares different products and sizes | `src/cards.ts:54`, `src/app.ts` | Done (renamed; per-unit compare not done) |
| 7 | P2 | `/cards` is an open proxy that fans out to 7 retailers per GET | `src/cards.ts:11-33` | Partial (cache done; rate limit pending) |
| 8 | P3 | `add_to_cart` trusts the price the model sends | `src/index.ts:105` | Open |
| 9 | P3 | No authentication on `/mcp` or KV writes | `src/index.ts:243-262` | Open (needs a decision) |
| 10 | P3 | Handler cache keyed by request origin grows without bound | `src/index.ts:241-260` | Done |
| 11 | P3 | No tests for the pure money logic | `src/wallets.ts`, `src/cart.ts` | Done |

Update after merging `main` (PRs #3 to #5): the team fixed #1, #2 and #4 on their own, and those versions won the merge because they are the deployed ones. My versions of #1, #2, #4 and #5 were dropped; the per-item notes below describe my original fix and stay as history. The tests were rewritten against the team's API (`addItems`, `todayInArgentina`, `placeOrder`): 8 tests, all passing.

The fixes still marked Done here and not upstream (#3, #6, #7 cache, #10, #11) are not deployed until someone runs `wrangler deploy`.

How to check: in `mcp-server/`, `pnpm test` and `pnpm typecheck`.

## P1: fix before the demo

### 1. Parallel `add_to_cart` calls lose items

`addItem` reads the cart from KV, changes it in memory and writes it back, with no concurrency control. Models often call tools in parallel ("add milk, yerba and oil"). Three parallel calls each read the empty cart and each write a cart with one item, so the last write wins and two items are lost. KV is also eventually consistent across locations (up to about 60 s), so a `view_cart` served by another data center can return an old cart.

Repair (pick one):

- **Fast, enough for the demo:** let `add_to_cart` take `items: [...]` and write them all in one read-modify-write. Say in the tool description: "Add every product in ONE call; never call add_to_cart in parallel."
- **Correct:** move carts to a Durable Object (one object per `cart_id`), which serializes writes and is strongly consistent.

Check: add three products in one call (or three parallel calls after the Durable Object change), then `view_cart` shows all three.

**Status: done (fast fix).** `add_to_cart` takes `items: [...]` and writes them in one read-modify-write (`addItems` in `src/cart.ts`); the single-product fields still work, so the app view's "Agregar" button is unchanged. The description tells the model to batch and never call it in parallel. Evidence: test "adds several products in one write"; on `wrangler dev`, one call with 3 products (one with quantity 2) returned all of them, and a following single-product call raised the total to $20.988. Parallel calls can still overwrite each other: only the Durable Object fixes that.

### 2. `split_payment` without `day` applies every promo

When `day` is omitted, the filter at `src/wallets.ts:57` never runs, so a Monday purchase still gets the Wednesday 30% of MODO + Banco Nación. The cashback is the number we show on stage, so a wrong one is very visible.

Repair: when `day` is missing, use today's weekday in Argentina time (UTC-3, no DST). Return the day used in the result (`day: 'monday'`) so the model can say it.

Check: `split_payment({ total_cents: 6_000_000 })` on a Monday returns no MODO part and `day: 'monday'`.

**Status: done.** `weekdayInArgentina()` in `src/wallets.ts` (UTC-3, so 23:00 Monday in Argentina is still Monday) is the default, and every result carries `day`. Evidence: tests "uses today in Argentina when no day is given" and "uses UTC-3, not UTC"; on `wrangler dev` on a Saturday, `split_payment` without `day` returned `day: "saturday"`.

### 3. Wallets disagree with the demo checkout page

`SAMPLE_WALLETS` uses ids with underscores (`modo_bna`, `mercado_pago`, `naranja_x`, `banco_macro`) and different rules (MODO on Wednesdays). `demo/checkout.html` uses dashes (`modo-bna`) and other days and percentages. A checkout link built from a `split_payment` result shows the wrong wallets.

Repair: `src/wallets.ts` is the single source of truth. The checkout page takes its ids, names and percentages from it (same ids, same rules), and the link format is `demo/checkout.html?total=<pesos>&store=<id>&order=<order_id>&split=<wallet_id>:<pesos>,...`.

Check: a `split_payment` result turned into a link shows the same wallets and cashback on the checkout page.

**Status: done.** `demo/checkout.html` now uses the same ids (`modo_bna`, `naranja_x`, `banco_macro`, `mercado_pago`, plus `mp_qr` for the QR), percentages and caps as `SAMPLE_WALLETS`, and the store names of `STORE_INFO` (default store: Vea). The cashback on the page is capped like in `splitPayment`. Evidence: rendered `?total=85000&split=modo_bna:40000,mercado_pago:45000`; it shows $12.000 back for MODO and $4.500 for Mercado Pago, the same as `split_payment` (1.200.000 and 450.000 centavos).

## P2: fix if there is time

### 4. Duplicate order ids

`order_id` is `QY-` plus the first 8 characters of `cart_id`, and the same `cart_id` is reused for the whole conversation. A second purchase gets the same id.

Repair: `QY-` plus 8 characters from `crypto.randomUUID()`.

**Status: done.** `newOrderId()` in `src/cart.ts`. Evidence: test "gives every order its own id"; on `wrangler dev`, two purchases with the same cart got `QY-B21B62BC` and `QY-26D13F85`.

### 5. `create_order` ignores the split

The order records only "payment: simulated". It does not say which wallet paid or what cashback was applied, so the demo cannot show "you paid $40.000 with MODO and got $12.000 back" on the order.

Repair: optional `split` input on `create_order` (the `parts` of `split_payment`), stored on the order and returned in the result. Or compute it inside `create_order` with `splitPayment` and today's day.

**Status: done (second option).** `buildOrder()` in `src/order.ts` adds `split` (sample wallets, today in Argentina) to every order; the result note tells the model the rules are illustrative. Evidence: test "records the wallet split of the day on the order" (a Wednesday order starts with MODO and its parts add up to the total).

### 6. "Más barato" compares different products

Search results from all stores are sorted by price and the first one gets the "Más barato" badge, but they are different products and sizes (a 1.75 L Coca-Cola is "cheaper" than a 2.25 L one). The `/cards` page warns about it in text, but the badge still says it.

Repair: compare price per unit (per kg, l or unit) parsed from the name or the `package` field, and only badge products of the same size, or rename the badge to "Menor precio" and keep the warning.

**Status: done (rename).** The badge says "Menor precio" in `src/cards.ts` and `src/app.ts`, which is true for any mix of sizes. Evidence: `/cards` on `wrangler dev` shows "Menor precio". Comparing per unit is still open.

### 7. `/cards` is an open proxy

Every GET to `/cards?q=...` fans out to 7 retailers, with no auth and no rate limit. The `Cache-Control: public, max-age=120` header does not cache it: Cloudflare does not cache a response a Worker generates unless the Worker uses the Cache API. Anyone can use the Worker to hit the retailers and burn the Worker quota, and the retailers may block us mid-demo.

Repair: cache the response with the Workers Cache API keyed by `q + stores + limit`, and add a simple per-IP rate limit (Workers Rate Limiting binding).

**Status: partial.** Cache done: `cachedCardsPage()` in `src/cards.ts` keeps each search for 2 minutes, keyed by lowercased text, sorted stores and clamped limit. Evidence on `wrangler dev`: first GET 1.6 s, the same GET 8 ms, the same search with stores in another order 8 ms. Rate limit pending: it needs a `ratelimits` binding in `wrangler.jsonc` and a deploy, which is a change to the deployed environment.

## P3: known risks, fine for the demo

### 8. Model-supplied price

`add_to_cart` stores the `price_cents` the model sends. A hallucinated price goes straight into the total. Repair after the demo: keep search results in KV by product key and have `add_to_cart` take that key instead of the price.

### 9. No authentication

`/mcp` and KV writes are open, as the task doc already notes. Repair after the demo: a bearer token checked before `handler.fetch` (Grok's remote MCP can send headers).

**Status: open, needs a decision.** Adding a token breaks the current Grok connection until whoever configured it adds the header, so it should not land the day of the demo without coordinating.

### 10. Handler cache by origin

`handlers` is a `Map` keyed by `url.origin` and never shrinks. On Workers the host is limited to the routes we configure, so this is minor. Repair: key by a fixed public origin from `env`.

**Status: done (cap).** The map is cleared when it reaches 8 origins (`MAX_HANDLERS` in `src/index.ts`), which keeps it bounded without a new config value.

### 11. No tests for the money logic

`splitPayment` and the cart summary are pure functions and easy to test with Vitest. Minimum set: the brief example (MODO exhausts the $12.000 cap), cap already consumed, day filter, parts adding up to the total, and adding the same product twice.

**Status: done.** Vitest added to `mcp-server/` (`pnpm test`), with `test/wallets.test.ts` and `test/cart.test.ts`: the minimum set above plus the tests for #1, #2, #4 and #5, 12 in total, all passing. `tsconfig.json` now typechecks `test/` too. To install, `pnpm-workspace.yaml` needed `allowBuilds` set to `true` for `esbuild` and `workerd` (they were left as "set this to true or false", which blocks `pnpm install` on pnpm 11).

## Integration with the MouseKey checkout

The app view's "Comprar" button (`src/app.ts:210-216`) sends a user message ("Sí, confirmo la compra..."), and the model then calls `create_order` with `confirmed=true`. That click is where MouseKey goes:

- **Option A (inside the view):** gate the "Comprar" button with MouseKey before it sends the confirmation message.
- **Option B (separate page):** `create_order` with `confirmed=false` returns the cart; the model sends the user the link to `demo/checkout.html` with total, order and split, and calls `create_order` with `confirmed=true` after the page reports approval.

Option A keeps everything in one place for the demo; option B works on hosts without MCP Apps.
