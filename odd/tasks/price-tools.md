# price-tools

## Objective

Turn the Qillay MCP server into a supermarket price lookup for Argentina that an agent (Grok, for the hackathon demo) can use over Streamable HTTP.

## Problem and why

The user's draft (`super-ar-mcp.ts`, a v1 stdio server) returns each upstream API's raw response. VTEX responses are very large, so an agent would spend its context on fields it does not need. The tools must return compact, uniform results.

## Scope

- Port the three draft tools to the deployed Worker in `mcp-server/` (SDK v2, `createMcpHandler`): `listar_sucursales`, `buscar_producto`, `comparar_precio`.
- Sources: Precios Claros, Coto Digital, the VTEX stores (Jumbo, Disco, Vea, Carrefour, DIA, ChangoMás) and Vital.
- Normalize every source to one product shape.

Out of scope: authentication, skills, caching, automated tests (no runner in the project yet).

## Constraints

- Runs on Cloudflare Workers: web `fetch` only, no Node APIs, no state on the server instance.
- Tool names and descriptions stay in Spanish (the draft's product copy and the demo audience); code and comments in English.
- One slow or failing source must not fail the whole search.

## Delivery

Strategy: `ask-on-risk`. Forecast: about 300 authored lines, under the 400-line budget. Base boundary: `4739d9c`.

## Tasks

- [x] T1 — Commit the Worker skeleton (`ping` tool). Route: inline (already written and verified). Commit `36e0b55`.
- [x] T2 — Price tools with normalized output. Route: delegated writer (several non-trivial files, needs upstream response shapes). Commit `e50b352`.
- [x] T3 — Deploy and verify on the public URL. Route: inline. Worker version `43ec0774`.

## Acceptance criteria

- `tools/list` shows the three tools with Spanish descriptions and described parameters.
- `buscar_producto` returns, per product: source, name, brand, EAN, price, list price and URL where the source provides them.
- A failing source appears as an error entry for that source; the others still return.
- `tsc --noEmit` passes and `wrangler deploy --dry-run` builds.

## Checks

- `./node_modules/.bin/tsc --noEmit`
- `./node_modules/.bin/wrangler deploy --dry-run`
- Live calls against `wrangler dev`, then against the deployed URL.

Test-first exception: no test runner exists and results depend on live third-party APIs, so checks are functional.

## Progress and evidence

- T1: skeleton verified with curl locally and on the deployed URL (`tools/list`, `tools/call ping`, legacy `initialize`). Review assessment for `4739d9c..36e0b55`: unassessable (untracked `.atl/` folders need an explicit declaration), so treated as due; pending, to run with T2's commit.

## Next step

User connects the server in Grok and reports the result. Pending: native review of `4739d9c..e50b352` (skipped on 2026-11-21, user asked to keep it simple with under two hours left); Carrefour returns 403; endpoint has no auth.

## Follow-up: align with the team CLAUDE.md (2026-11-21)

- [x] T4 — English tool names and fields, integer centavos, product image, store display colors. Route: inline (user asked to keep it simple, under two hours left).
- [x] T5 — `list_wallets` (sample data) and `split_payment`. Route: inline.
- Dropped at the user's request: `compare_basket`. Not built: `suggest_substitutions`, `plan_shopping`, `create_order`, `check_offer`, `set_wallet`.
- Evidence: all five tools called on the deployed URL (Worker version `1d38864d`); search returned 21 products, all with image; split of ARS 60,000 on a Wednesday gave 12,000 + 2,000 cashback, matching a hand calculation.
- Pending: native review skipped; no automated tests; store colors are approximations; wallet rules are illustrative.
- [x] T6 — `/cards` page on the Worker (server-rendered product cards with photo, price, store color) and `cards_url` in `search_products`. Route: inline. Evidence: deployed (`ab64415c`), 21 cards with images for "leche entera 1l", screenshot checked, `<script>` in `q` is escaped. Note: the team CLAUDE.md lists UI inside the MCP server as a non-goal; this is a separate route on the same Worker, built at the user's request.
- [x] T7 — MCP Apps view (`ui://qillay/app.html`: product carousel, cart, order), cart tools on Workers KV (`add_to_cart`, `view_cart`, `remove_from_cart`), simulated `create_order`, and `/preview` (a minimal MCP Apps host for browser testing). Route: inline. Evidence: full flow run on the deployed URL with curl and in `/preview` with a browser (search, add two items, view cart, buy, order confirmed). Not verified: rendering inside Grok or any real MCP Apps host.
