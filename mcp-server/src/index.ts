import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

import { errorMessage } from './http';
import { comparePrice, listBranches } from './precios-claros';
import { DEFAULT_STORES, searchProducts, STORE_IDS } from './sources';
import { SAMPLE_WALLETS, splitPayment, WEEKDAYS } from './wallets';

function ok(result: unknown) {
    return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
}

// Run a Precios Claros tool; an upstream failure becomes a tool error instead of a crash.
async function preciosClaros(run: () => Promise<unknown>) {
    try {
        return ok(await run());
    } catch (error) {
        return { ...ok({ store: 'precios_claros', error: errorMessage(error) }), isError: true };
    }
}

const walletSchema = z.object({
    id: z.string().min(1).describe('Stable id for the wallet.'),
    name: z.string().min(1).describe('Display name.'),
    cashback_pct: z.number().gt(0).max(100).describe('Cashback as a percentage of the amount paid with this wallet.'),
    cap_cents: z.number().int().positive().describe('Maximum cashback per period, in ARS centavos.'),
    days: z.array(z.enum(WEEKDAYS)).optional().describe('Days the promo applies; omit for every day.')
});

// The factory runs once per request, so keep no state on the server instance.
const handler = createMcpHandler(() => {
    const server = new McpServer({ name: 'qillay', version: '0.2.0' });

    server.registerTool(
        'search_products',
        {
            description:
                'Search grocery products by text across Argentine supermarkets. Returns products sorted by ascending price, each with store, name, brand, EAN, price_cents (ARS centavos, divide by 100 for pesos), image_url and url. "stores" gives the display name and color of each store. Stores that fail are listed in "errors" and do not affect the rest. Use two or more words ("leche entera 1l"); single words match poorly.',
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
                limit: z.number().int().min(1).max(20).default(5).describe('Maximum products per store (max 20).')
            })
        },
        async ({ q, stores, branch_ids, limit }) => ok(await searchProducts(q, stores ?? DEFAULT_STORES, { limit, branchIds: branch_ids }))
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
                'List the sample wallets and bank promos (cashback percentage, cap, active days) that split_payment uses by default. These are illustrative demo rules, not real promotions; say so when showing them.',
            inputSchema: z.object({})
        },
        async () => ok({ sample_data: true, note: 'Illustrative rules for the demo, not real promotions.', wallets: SAMPLE_WALLETS })
    );

    server.registerTool(
        'split_payment',
        {
            description:
                'Given a purchase total, compute how to split the payment across wallets to maximize cashback without exceeding each cap. Deterministic math; amounts are ARS centavos. Uses the sample wallets from list_wallets unless "wallets" is given. Returns the amount to pay with each wallet, the cashback of each, the total cashback and the net cost.',
            inputSchema: z.object({
                total_cents: z.number().int().positive().describe('Purchase total in ARS centavos (pesos x 100).'),
                day: z.enum(WEEKDAYS).optional().describe('Day of the purchase; wallets whose promo is not active that day are skipped.'),
                wallets: z.array(walletSchema).min(1).optional().describe("The user's own wallets and rules; replaces the sample ones."),
                consumed_cents: z
                    .record(z.string(), z.number().int().min(0))
                    .optional()
                    .describe('Cashback already received this period, by wallet id, in ARS centavos.')
            })
        },
        async ({ total_cents, day, wallets, consumed_cents }) => {
            const result = splitPayment({ totalCents: total_cents, wallets: wallets ?? SAMPLE_WALLETS, day, consumedCents: consumed_cents });
            return ok(wallets ? result : { ...result, sample_data: true, note: 'Computed with illustrative wallet rules, not real promotions.' });
        }
    );

    return server;
});

export default handler;
