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
