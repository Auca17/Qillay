# Qillay

Inferred from CLAUDE.md and the agreed brand voice on 2026-11-21 (no interview, at the user's request). Lines marked *assumption* need confirmation.

## What it is

An MCP server plus a demo chat (Grok) that helps people in Argentina buy groceries for less: compares supermarket prices, picks the best day and wallet (MODO, Mercado Pago, bank cards) to exhaust cashback caps, warns about fake offers, and creates a pick-up order with a fake payment.

## Audience and scene

- Shoppers in Mendoza dealing with inflation and many wallet promos. *Assumption:* 25-45, phone-first, already juggle 2-4 wallets.
- Real scene: standing in the checkout line or planning the weekly shop at home. The checkout moment is fast, one-handed, bright supermarket light.
- Demo scene: hackathon judges watching a laptop on a projector.

## Mechanism

Real prices from the retailers' public catalogs, plus deterministic math over the user's wallets. No AI inside the server: the chat LLM talks, the tools calculate.

## Voice

Accomplice against inflation, not a financial guru. Result first, always with a number. Argentine Spanish with voseo in UI copy. Honest about demo data ("pago de prueba, no se cobró nada"). No emojis: icons only, drawn as SVG. No hype words, no urgency, no shaming.

## Brand commitments

- Icons only, never emojis (user, 2026-11-21).
- A mascot (to be designed with this surface).
- "MouseKey": the demo payment only goes through if a mouse is detected and shaken; otherwise it is rejected. Deliberately absurd, for the hackathon's silly category.

## Constraints

- Hackathon, under two hours left.
- Demo payment is fake; nothing is charged.
- Prices are ARS.
