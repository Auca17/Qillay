import { describe, expect, it } from 'vitest';

import { addItems, getCart, getOrder, placeOrder, type NewCartItem } from '../src/cart';

// In-memory stand-in for the parts of Workers KV the cart uses.
function fakeKv(): KVNamespace {
    const store = new Map<string, string>();
    return {
        async get(key: string, type?: string) {
            const value = store.get(key);
            if (value === undefined) return null;
            return type === 'json' ? JSON.parse(value) : value;
        },
        async put(key: string, value: string) {
            store.set(key, String(value));
        },
        async delete(key: string) {
            store.delete(key);
        }
    } as unknown as KVNamespace;
}

const CART = '00000000-0000-4000-8000-000000000001';
const milk: NewCartItem = { store: 'jumbo', name: 'Leche 1l', ean: '779', price_cents: 340_000, quantity: 1 };
const yerba: NewCartItem = { store: 'vea', name: 'Yerba 1kg', ean: '780', price_cents: 520_800, quantity: 1 };
const oil: NewCartItem = { store: 'vea', name: 'Aceite 900ml', ean: '781', price_cents: 449_000, quantity: 2 };

describe('cart', () => {
    it('adding the same product twice increases its quantity', async () => {
        const kv = fakeKv();
        await addItems(kv, CART, [milk]);
        const cart = await addItems(kv, CART, [milk]);
        expect(cart.items).toHaveLength(1);
        expect(cart.items[0]!.quantity).toBe(2);
        expect(cart.total_cents).toBe(680_000);
    });

    it('adds several products in one write and totals them per store', async () => {
        const kv = fakeKv();
        const cart = await addItems(kv, CART, [milk, yerba, oil]);
        expect(cart.items.map(i => i.name)).toEqual(['Leche 1l', 'Yerba 1kg', 'Aceite 900ml']);
        expect(cart.by_store.map(s => [s.store, s.subtotal_cents])).toEqual([
            ['jumbo', 340_000],
            ['vea', 1_418_800]
        ]);
        expect((await getCart(kv, CART)).item_count).toBe(4);
    });
});

describe('placeOrder', () => {
    it('stores the order under the cart id, empties the cart, and gives each order its own id', async () => {
        const kv = fakeKv();
        const first = await placeOrder(kv, await addItems(kv, CART, [milk, yerba]));
        expect(first.order_id).toMatch(/^QY-[0-9A-F]{8}$/);
        expect(first.total_cents).toBe(860_800);
        expect((await getCart(kv, CART)).items).toHaveLength(0);
        expect((await getOrder(kv, CART))!.order_id).toBe(first.order_id);

        const second = await placeOrder(kv, await addItems(kv, CART, [oil]));
        expect(second.order_id).not.toBe(first.order_id);
    });
});
