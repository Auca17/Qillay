# Qillay

MCP server for smart grocery shopping in Argentina (ARS). Given a shopping list, it finds the cheapest split across stores, picks the best wallet/bank promo per day, and splits payments to exhaust reimbursement caps. Demo-first project.

`typescript-sdk/` is a vendored copy of `modelcontextprotocol/typescript-sdk` v2.4.0, **reference only** (read docs/examples there; do not edit it, do not depend on it by path).

## Product scope

Features, in build order (decided):

1. **Split-payment** ("at the checkout"): input total amount, output how to split across the user's wallets/cards to exhaust cashback caps. Pure math over wallet config + consumed caps. Needs no price data.
2. **Smart substitution**: compare price per unit (kg/l/unit) across brands and presentations, factoring in promos.
3. **Route optimizer**: split a list across stores and assign the wallet to use on each day.
4. **Fake-offer detector** ("traffic light"): is the "30% OFF" / "2x1" real, based on price history. Built last: history starts empty and needs weeks of data.
5. **Checkout + pick-up (demo extra)**: create an order for pick-up at a store; payment is a link ("pay" link in the demo). See open questions.

Non-goals: OCR / photo of receipts, any UI inside the MCP server, calling an LLM from the server.

## Decisions (grilling round 1)

| # | Decision |
|---|----------|
| Q1 | Prices come from **(a) SEPA / Precios Claros open dataset** (per store, per product, has EAN) **and (b) scraping** of retailer sites. Per-call overrides (price passed as tool input) are allowed. |
| Q2 | Promo/wallet rules are **user config** (JSON, validated with Zod) plus a versioned **seed file** of known promos. The server never discovers promos. It must flag rules that are expired or stale. |
| Q3 | **Stateful, local SQLite.** No Supabase, no cloud. Stores: price history, wallets, consumed cashback caps per period, orders. Full demo runs locally. |
| Q4 | **stdio** transport for the MVP (personal financial data stays on the machine). HTTP is an evolution; see open questions on the Grok demo. |
| Q5 | **Server is 100% deterministic.** No LLM calls, no sampling. The client LLM turns free text into structured items; our tools do the math. |
| Q6 | Build order as listed above (split-payment first, fake-offer last). |

## Decisions (grilling round 2)

| # | Decision |
|---|----------|
| Q1+ | Demo data is **realistic but not 100% real**: a curated, seeded catalog with plausible ARS prices (a Coca-Cola must not cost $100). Mark it as illustrative. Real ingestion (SEPA + scraping) sits behind the same provider interface and runs as a separate ingest job, never inside a tool call. |
| Q7 | Scrape 2-3 VTEX-based retailers at most, plus SEPA as base. Ingest via CLI. Verify which endpoints are really public before committing. |
| Q8 | Demo bot + HTML live in this repo as a separate app (`apps/demo`). The server supports **stdio and HTTP** with the same code; HTTP (plus a tunnel) only if the Grok side needs a remote endpoint. |
| Q9 | Checkout is **hard-coded / fake**: asks "which card or Mercado Pago QR", then shows a green "payment done" that does nothing real. Stretch goal; keep it behind a clear interface. |
| Q10 | `create_order` asks the human for confirmation via **elicitation** (summary: store, total, wallet, pick-up slot) before doing anything. |
| Q11 | Depend on the SDK from **npm** (`@modelcontextprotocol/server@2.4.x`). `typescript-sdk/` is reference only and is excluded from lint/tsc/tests. |
| Q12 | City: **Mendoza**. Wallets: TBD (see open questions). |

## How the demo works

The MCP exposes tools such as product search. The bot uses those tools to get title, description, photo and price per store, builds the price comparison for the shopping list, shows the full purchase summary to the user, and then links compatible wallets for the (fake) payment. The server stays deterministic: the bot's LLM does language, our tools do data and math.

## Conventions

- TypeScript, ESM, strict mode. Use SDK v2 (`@modelcontextprotocol/server`).
- Money: integer centavos, never floats. Currency is ARS.
- Never store card numbers (PAN) or credentials. Wallets are labels + rules only.
- Tool names, descriptions, and code are in English. User-facing sample data may be Spanish.
- Tools that move money or create orders must be explicit and confirmed by the human (MCP elicitation) before acting.
- Conventional commits. No AI attribution lines in commits.

## Decisions (grilling round 3)

| # | Decision |
|---|----------|
| Q13 | Grok calls the MCP **directly over remote HTTP** (public URL via tunnel). Fallback if the tunnel is flaky: the demo backend acts as MCP client and passes tools to Grok as function calling (same server code). |
| Q14 | Tool surface: `search_products`, `compare_basket`, `suggest_substitutions`, `plan_shopping`, `split_payment`, `check_offer`, `list_wallets`/`set_wallet`, `create_order` (with elicitation), plus an MCP prompt `weekly_shopping`. No MCP resources for now. Data accessed through a provider interface. |
| Q15 | Product photos come from the supermarket APIs. Cache images locally at ingest time so the demo does not depend on retailer CDNs. |
| Q16 | Build the shopping list and also try to do the purchase. See feasibility findings. |
| Q17 | UI and bot copy in neutral Argentine Spanish. Tool names, code, docs in English. |
| Q18 | Monorepo (pnpm): `packages/mcp-server`, `packages/seed`, `apps/demo`. Disjoint dirs so work can run in parallel (Devin/Cursor per unit, via written handoff specs). Claude defines the shared types contract first and **reviews every unit** before accepting it. |

## Feasibility findings (verified 2026-11-21 with read-only GETs)

- **Catalog search is public and anonymous**: `GET /api/catalog_system/pub/products/search?ft=<text>&_from=0&_to=N` answered HTTP 206 + JSON on Jumbo, Disco, Carrefour and Changomas (`masonline.com.ar`). `veadigital.com.ar` did not connect (check the right Vea host).
- **Fields available** per product: name, brand, EAN, SKU, seller, unit/multiplier, image URL, price, list price, stock. Example: Coca-Cola 2.25 L = ARS 6,100 at Jumbo.
- **Gotcha**: `ListPrice` came back as 504132 vs `Price` 6100 (garbage). Retailer list prices cannot be trusted for fake-offer detection, so we need our own price history.
- **Cart**: `GET /api/checkout/pub/orderForm` creates an anonymous cart (verified, HTTP 200). Adding items (`POST .../orderForm/{id}/items`) and cart simulation (`POST /api/checkout/pub/orderForms/simulation`) are documented by VTEX but NOT tested live yet.
- **Paying for real is not feasible**: checkout needs login, address or pick-up point, and the retailer's own payment gateway. Realistic scope: build the cart server-side and hand the user a link to finish on the retailer site; the payment inside our UI stays fake (Q9).
- **SEPA / Precios Claros**: daily ZIPs per weekday, reuse allowed by the Boletin Oficial. Column schema not verified yet, and the portal listing looked stale (July 2026 files). Check before relying on it.
- **Mendoza**: Vea (online + pick-up), Changomas (e-commerce hub in Mendoza), Carrefour operate there. Prices can vary by region/channel, so use the simulation endpoint with a Mendoza postal code.
- Scraping and cart creation on retailer sites is a ToS gray area: keep volume low, rate-limit, cache, identify the client honestly.

## Decisions (grilling round 4, final)

| # | Decision |
|---|----------|
| Q19 | Ship the whole flow at once. If time is short, **hard-code the checkout/payment** (fake green "paid", card or Mercado Pago QR choice) and move on. A real retailer cart is a stretch goal. |
| Q20 | **The MCP server itself** fetches products: read-through cache in SQLite, live call to the retailer with a short timeout, fallback to seed data. Every live fetch stores a price point (builds real history). |
| Q21 | Retailers: **Carrefour, Vea, Jumbo** (all VTEX). Changomas optional. Vea host still to be confirmed (`veadigital.com.ar` did not connect). |
| Wallets | Assumed for the seed: Mercado Pago, MODO + Banco Nacion, Naranja X, Banco Macro, marked as sample data. |

Grilling is closed; the design tree has no open branches.

## Work split (who owns what)

| Unit | Dir | Owner |
|------|-----|-------|
| MCP core + public HTTPS URL + the tools needed for the demo flow | `packages/mcp-server`, `packages/contracts` | Claude (this session) |
| Provider adapters (VTEX Carrefour/Vea/Jumbo, SEPA loader, image cache) | `packages/providers` | Devin |
| Seed (Mendoza catalog, 90-day synthetic price history, wallets/promos) | `packages/seed` | Teammate 1 |
| Demo bot (Grok) + HTML UI | `apps/demo` | Cursor |
| Integration: tunnel, end-to-end check, demo script and plan B | repo root scripts | Teammate 2 |

Rules for everyone (humans and AIs):

- Read this file first. Shared types live in `packages/contracts` (Zod schemas); do not invent your own shapes.
- Edit only your unit's directory. Root files (`package.json`, `pnpm-workspace.yaml`, tsconfig) are owned by the MCP core owner: ask before changing them.
- One branch per unit, open a PR, no direct pushes to `main`. Conventional commits, no AI attribution lines.
- Never edit `typescript-sdk/` (reference only).
- Money is integer centavos. Never store card numbers.
