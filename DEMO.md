# Qillay demo

Everything needed to run the demo. The Grok prompt also lives in `mcp-server/DEMO_PROMPT.md`.

## Links

- **MCP connector for Grok** (grok.com/connectors → New Connector → Custom):
  `https://qillay-mcp-server.soycarlosdugarte.workers.dev/mcp`
- **Cart / payment page:** `https://qillay-mcp-server.soycarlosdugarte.workers.dev/cart?id=<cart_id>`
  - Every cart has its own link. In the demo Grok generates it when it calls `add_to_cart` (field `cart_url`).
  - One purchase per link: pressing "Comprar" empties the cart, and the link then shows the order.
  - Sample cart (3 products, $10.005,50), **do not spend it before showing it**:
    `https://qillay-mcp-server.soycarlosdugarte.workers.dev/cart?id=ed691a32-6dc9-4ff2-892e-9334b5de177a`
  - Sample of a link after the purchase:
    `https://qillay-mcp-server.soycarlosdugarte.workers.dev/cart?id=8df765f5-affc-4174-be4f-3d34a2bd4db1`

## Script for Grok

First message (system-style prompt):

```text
Sos Qillay, un asistente de compras de supermercado en Argentina. Usá siempre las herramientas del conector Qillay; no inventes precios ni productos.

Cuando te pase una lista de compras:
1. Buscá cada producto con search_products (texto de dos o más palabras, por ejemplo "leche entera 1l").
2. Mostrame una tabla corta por producto: supermercado, producto y precio en pesos (price_cents dividido 100). Marcá la opción que recomendás y avisame si un producto no apareció.
3. Mostrame el total estimado y esperá mi OK. No agregues nada al carrito antes.
4. Cuando te diga que sí, llamá a add_to_cart UNA sola vez con todos los productos elegidos en "items".
5. Después llamá a create_order con confirmed=true para completar la compra.
6. Decime el número de pedido y el total, y pasame el link "cart_url": ahí veo el pedido con los productos y el total por supermercado.
7. Si te pido cómo conviene pagar, usá split_payment con el total y decime qué día usaste.

Nunca digas que esto es una demo, una prueba o una simulación.
```

Second message, the list:

```text
Necesito comprar: leche entera 1l, yerba mate 1kg, aceite de girasol 900ml y coca cola 2.25l. Buscame la opción más barata de cada uno.
```

Third message, the OK:

```text
Dale, comprá las opciones que recomendaste.
```

## MouseKey (Cuyano the cat)

With the Grok script above, Grok buys first and then sends the `cart_url` link. That link opens on "Confirmá tu pago" with Cuyano: press "Confirmar pago" and shake the mouse over the box until the bar fills; then "Pedido confirmado" appears with the order. The order already exists on the server; MouseKey guards what the page shows.

The "Comprar" button of the cart view (in Grok with MCP Apps, and on the `/cart` page before buying) is guarded the same way, and the user is not asked twice:

- Click "Comprar" with a mouse: Cuyano asks you to shake it left and right over the cart until the bar fills (15 s limit). Then it confirms the purchase.
- From a phone, a tablet or a pen: rejected ("Sin mouse no hay pago").
- A laptop trackpad counts as a mouse for the browser. To show the rejection on stage, open the link on a phone.

Rehearse with a fresh cart: every successful MouseKey spends that cart.

There is also a standalone checkout page with the full mascot, `demo/checkout.html` (`?total=85000&store=vea&order=QY-1&split=modo_bna:40000,mercado_pago:45000`, plus `&preview=rejected|approved|gate` to show a state without a mouse).
