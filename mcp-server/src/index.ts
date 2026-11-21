import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

import { APP_HTML, APP_MIME, APP_UI_META, APP_URI } from './app';
import { cachedCardsPage, cardsUrl } from './cards';
import { addItems, getCart, getOrder, newCartId, placeOrder, removeItem, type CartSummary } from './cart';
import { errorMessage } from './http';
import { comparePrice, listBranches } from './precios-claros';
import { cartPage, previewPage } from './preview';
import { DEFAULT_STORES, searchProducts, STORE_IDS } from './sources';
import { SAMPLE_WALLETS, splitPayment, todayInArgentina, WEEKDAYS } from './wallets';

// Tools that render in the MCP Apps view; the flat key is the pre-GA spelling some hosts still read.
const APP_TOOL_META = { ui: { resourceUri: APP_URI }, 'ui/resourceUri': APP_URI };

function ok(result: unknown) {
    return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
}

// Same data as text (for the model and text-only hosts) and as structuredContent (for the view).
function view(result: object) {
    return { ...ok(result), structuredContent: result as Record<string, unknown> };
}

// How the model should run the shopping flow; also kept in DEMO_PROMPT.md for clients that ignore server instructions.
const INSTRUCTIONS =
    'Qillay helps a user in Argentina buy a grocery list at the best price. Flow: (1) for each item of the list call search_products; (2) show the user a short comparison per item (store, product, price in pesos) and the option you recommend; (3) wait for the user to approve; (4) call add_to_cart ONCE with every approved product in "items"; (5) call create_order with confirmed=true; (6) tell the user the order id and the total and give them the "cart_url" link, where they see the order with its products and the total per store. Never buy without the approval of the user. Prices are in ARS centavos: divide by 100. Answer in Spanish.';

function failure(error: string) {
    return { ...ok({ error }), isError: true };
}

// Run a Precios Claros tool; an upstream failure becomes a tool error instead of a crash.
async function preciosClaros(run: () => Promise<unknown>) {
    try {
        return ok(await run());
    } catch (error) {
        return failure(`precios_claros: ${errorMessage(error)}`);
    }
}

const walletSchema = z.object({
    id: z.string().min(1).describe('Stable id for the wallet.'),
    name: z.string().min(1).describe('Display name.'),
    cashback_pct: z.number().gt(0).max(100).describe('Cashback as a percentage of the amount paid with this wallet.'),
    cap_cents: z.number().int().positive().describe('Maximum cashback per period, in ARS centavos.'),
    days: z.array(z.enum(WEEKDAYS)).optional().describe('Days the promo applies; omit for every day.')
});

const cartIdSchema = z.string().uuid().describe('Cart id returned by search_products or add_to_cart. Reuse the same id for the whole conversation.');

// The factory runs once per request, so keep no state on the server instance.
function buildServer(origin: string, env: Env): McpServer {
    const server = new McpServer({ name: 'qillay', version: '0.4.0' }, { instructions: INSTRUCTIONS });

    // Page where the user sees the cart and pays (simulated); for chat clients without MCP Apps.
    const withUrl = (cart: CartSummary) => ({ ...cart, cart_url: `${origin}/cart?id=${cart.cart_id}` });

    server.registerResource(
        'qillay-app',
        APP_URI,
        {
            title: 'Qillay',
            description: 'Product carousel, shopping cart and order confirmation for the Qillay tools.',
            mimeType: APP_MIME,
            _meta: APP_UI_META
        },
        async uri => ({ contents: [{ uri: uri.href, mimeType: APP_MIME, text: APP_HTML, _meta: APP_UI_META }] })
    );

    server.registerTool(
        'search_products',
        {
            description:
                'Search grocery products by text across Argentine supermarkets. Use it for any question about a product or its price. Returns products sorted by ascending price, each with store, name, brand, EAN, price_cents (ARS centavos, divide by 100 for pesos), image_url and url. On hosts with MCP Apps the result is shown to the user as product cards (a carousel when there are several), so do not repeat the full list in text: summarize the cheapest options. "cart_id" identifies the user\'s cart: pass it to every later call. Use two or more words ("coca cola 2.25l"); single words match poorly. Stores that fail are listed in "errors".',
            inputSchema: z.object({
                q: z.string().trim().min(1).describe('Search text in Spanish, for example "leche entera 1l".'),
                stores: z
                    .array(z.enum(STORE_IDS))
                    .min(1)
                    .optional()
                    .describe(
                        `Stores to query. Default: ${DEFAULT_STORES.join(', ')}. "precios_claros" needs "branch_ids"; "carrefour" usually rejects automated requests.`
                    ),
                branch_ids: z
                    .string()
                    .optional()
                    .describe('Comma-separated Precios Claros branch ids (from list_branches). Only for the precios_claros store.'),
                limit: z.number().int().min(1).max(20).default(3).describe('Maximum products per store (max 20).'),
                cart_id: cartIdSchema.optional()
            }),
            _meta: APP_TOOL_META
        },
        async ({ q, stores, branch_ids, limit, cart_id }) => {
            const selected = stores ?? DEFAULT_STORES;
            const result = await searchProducts(q, selected, { limit, branchIds: branch_ids });
            return view({ cart_id: cart_id ?? newCartId(), cards_url: cardsUrl(origin, q, selected, limit), ...result });
        }
    );

    server.registerTool(
        'add_to_cart',
        {
            description:
                'Add one or more products to the user\'s shopping cart. Add every product in ONE call through "items"; never call add_to_cart in parallel, because parallel calls overwrite each other and lose items. Copy store, name, brand, ean, price_cents, image_url and url of each item exactly from a search_products result. Adding a product already in the cart increases its quantity. Returns the whole cart with totals per store and "cart_url": always give that link to the user, it is the page where they see the products and the total and pay.',
            inputSchema: z.object({
                cart_id: cartIdSchema.nullish(),
                items: z
                    .array(
                        z.object({
                            store: z.string().min(1).describe('Store id of the product, from search_products.'),
                            name: z.string().min(1).describe('Product name, from search_products.'),
                            brand: z.string().nullish(),
                            ean: z.string().nullish(),
                            price_cents: z.number().int().positive().describe('Unit price in ARS centavos, from search_products.'),
                            image_url: z.string().nullish(),
                            url: z.string().nullish(),
                            quantity: z.number().int().min(1).max(99).default(1)
                        })
                    )
                    .min(1)
                    .max(30)
                    .describe('Every product to add, in one call.')
            }),
            _meta: APP_TOOL_META
        },
        async ({ cart_id, items }) =>
            view(
                withUrl(
                    await addItems(
                    env.CARTS,
                    cart_id ?? newCartId(),
                    items.map(item => ({
                        store: item.store,
                        name: item.name,
                        brand: item.brand ?? undefined,
                        ean: item.ean ?? undefined,
                        price_cents: item.price_cents,
                        image_url: item.image_url ?? undefined,
                        url: item.url ?? undefined,
                        quantity: item.quantity
                    }))
                    )
                )
            )
    );

    server.registerTool(
        'view_cart',
        {
            description:
                'Show the user\'s shopping cart: every item, the subtotal per store, the total and "cart_url" (the page where the user sees the cart and pays). Call it when the user asks for the cart or the full shopping list, and before asking whether they want to buy.',
            inputSchema: z.object({ cart_id: cartIdSchema }),
            _meta: APP_TOOL_META
        },
        async ({ cart_id }) => {
            const cart = await getCart(env.CARTS, cart_id);
            // After the purchase the cart is empty and the same id shows the order.
            const order = cart.items.length === 0 ? await getOrder(env.CARTS, cart_id) : null;
            return view(order ? { cart_id, cart_url: withUrl(cart).cart_url, order } : withUrl(cart));
        }
    );

    server.registerTool(
        'remove_from_cart',
        {
            description: 'Remove one item from the cart by its item_id (from view_cart or add_to_cart). Returns the updated cart.',
            inputSchema: z.object({ cart_id: cartIdSchema, item_id: z.string().min(1).describe('The item_id of the cart item to remove.') }),
            _meta: APP_TOOL_META
        },
        async ({ cart_id, item_id }) => view(withUrl(await removeItem(env.CARTS, cart_id, item_id)))
    );

    server.registerTool(
        'create_order',
        {
            description:
                'Buy the cart. Call it with confirmed=true only after the user has explicitly approved the purchase in this conversation. With confirmed=false it changes nothing and returns the cart to confirm. On success it returns the order and "cart_url", the link where the user sees the order: always give them that link.',
            inputSchema: z.object({
                cart_id: cartIdSchema,
                confirmed: z.boolean().describe('true only when the user has explicitly confirmed the purchase in this conversation.')
            }),
            _meta: APP_TOOL_META
        },
        async ({ cart_id, confirmed }) => {
            const cart = await getCart(env.CARTS, cart_id);
            if (cart.items.length === 0) return failure('The cart is empty.');
            if (!confirmed) return view({ ...withUrl(cart), needs_confirmation: true, note: 'Ask the user to confirm the purchase.' });
            return view({
                cart_id,
                cart_url: withUrl(cart).cart_url,
                order: await placeOrder(env.CARTS, cart),
                note: 'Order confirmed. Tell the user the order id and the total, and give them the "cart_url" link: it now shows the order.'
            });
        }
    );

    server.registerTool(
        'list_branches',
        {
            description:
                'List physical supermarket branches near a point in Argentina, from Precios Claros, sorted by distance. The ids feed search_products (store precios_claros) and compare_branch_prices.',
            inputSchema: z.object({
                lat: z.number().min(-90).max(90).describe('Latitude in decimal degrees (Mendoza is about -32.89).'),
                lng: z.number().min(-180).max(180).describe('Longitude in decimal degrees (Mendoza is about -68.84).'),
                limit: z.number().int().min(1).max(30).default(20).describe('Maximum branches (max 30).')
            })
        },
        async ({ lat, lng, limit }) => preciosClaros(async () => ({ branches: await listBranches(lat, lng, limit) }))
    );

    server.registerTool(
        'compare_branch_prices',
        {
            description:
                'Compare the price of one product (by EAN barcode) across Precios Claros branches, sorted by ascending price. Branches that do not carry the product are left out.',
            inputSchema: z.object({
                ean: z.string().trim().min(1).describe('EAN barcode of the product (the "ean" field of search_products).'),
                branch_ids: z.string().trim().min(1).describe('Comma-separated Precios Claros branch ids (from list_branches).')
            })
        },
        async ({ ean, branch_ids }) => preciosClaros(() => comparePrice(ean, branch_ids))
    );

    server.registerTool(
        'list_wallets',
        {
            description:
                'List the wallets and bank promos (cashback percentage, cap, active days) that split_payment uses by default.',
            inputSchema: z.object({})
        },
        async () => ok({ wallets: SAMPLE_WALLETS })
    );

    server.registerTool(
        'split_payment',
        {
            description:
                'Given a purchase total, compute how to split the payment across wallets to maximize cashback without exceeding each cap. Deterministic math; amounts are ARS centavos. Uses the wallets from list_wallets unless "wallets" is given. Returns the amount to pay with each wallet, the cashback of each, the total cashback, the net cost and the "day" the promos were evaluated for; tell the user which day was used.',
            inputSchema: z.object({
                total_cents: z.number().int().positive().describe('Purchase total in ARS centavos (pesos x 100).'),
                day: z
                    .enum(WEEKDAYS)
                    .optional()
                    .describe('Day of the purchase. Default: today in Argentina. Wallets whose promo is not active that day are skipped.'),
                wallets: z.array(walletSchema).min(1).optional().describe("The user's own wallets and rules; replaces the default ones."),
                consumed_cents: z
                    .record(z.string(), z.number().int().min(0))
                    .optional()
                    .describe('Cashback already received this period, by wallet id, in ARS centavos.')
            })
        },
        async ({ total_cents, day, wallets, consumed_cents }) => {
            const result = splitPayment({ totalCents: total_cents, wallets: wallets ?? SAMPLE_WALLETS, day: day ?? todayInArgentina(), consumedCents: consumed_cents });
            return ok(result);
        }
    );

    return server;
}

// One MCP handler per public origin, so tools can build absolute links to the cards page.
const handlers = new Map<string, ReturnType<typeof createMcpHandler>>();
const MAX_HANDLERS = 8;

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);
        if (request.method === 'GET') {
            if (url.pathname === '/cards') return cachedCardsPage(request, ctx);
            if (url.pathname === '/preview') return previewPage();
            if (url.pathname === '/cart') return cartPage(url);
            if (url.pathname === '/app.html') {
                // Served standalone only for /preview on this origin; real hosts read it through resources/read.
                return new Response(APP_HTML, {
                    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "frame-ancestors 'self'" }
                });
            }
        }
        let handler = handlers.get(url.origin);
        if (!handler) {
            // The Worker only answers on its own routes; the cap just keeps the map bounded.
            if (handlers.size >= MAX_HANDLERS) handlers.clear();
            handler = createMcpHandler(() => buildServer(url.origin, env));
            handlers.set(url.origin, handler);
        }
        return handler.fetch(request);
    }
} satisfies ExportedHandler<Env>;
