import { describe, expect, it } from 'vitest';

import { addItem, addItems, getCart, newOrderId, type NewCartItem } from '../src/cart';
import { buildOrder } from '../src/order';

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
        await addItem(kv, CART, milk);
        const cart = await addItem(kv, CART, milk);
        expect(cart.items).toHaveLength(1);
        expect(cart.items[0]!.quantity).toBe(2);
        expect(cart.total_cents).toBe(680_000);
    });

    it('summarizes totals per store', async () => {
        const kv = fakeKv();
        await addItem(kv, CART, milk);
        const cart = await addItem(kv, CART, oil);
        expect(cart.by_store.map(s => [s.store, s.subtotal_cents])).toEqual([
            ['jumbo', 340_000],
            ['vea', 898_000]
        ]);
        expect(cart.item_count).toBe(3);
    });

    // Fix.md #1
    it('adds several products in one write, so none is lost', async () => {
        const kv = fakeKv();
        const cart = await addItems(kv, CART, [milk, yerba, oil]);
        expect(cart.items.map(i => i.name)).toEqual(['Leche 1l', 'Yerba 1kg', 'Aceite 900ml']);
        expect((await getCart(kv, CART)).items).toHaveLength(3);
    });
});

describe('orders', () => {
    // Fix.md #4
    it('gives every order its own id', () => {
        const a = newOrderId();
        const b = newOrderId();
        expect(a).toMatch(/^QY-[0-9A-F]{8}$/);
        expect(a).not.toBe(b);
    });

    // Fix.md #5
    it('records the wallet split of the day on the order', async () => {
        const kv = fakeKv();
        const cart = await addItems(kv, CART, [milk, yerba, oil]);
        // 2026-11-25 is a Wednesday: MODO 30% applies.
        const order = buildOrder(cart, new Date('2026-11-25T15:00:00Z'));
        expect(order.status).toBe('confirmed');
        expect(order.total_cents).toBe(cart.total_cents);
        expect(order.split.day).toBe('wednesday');
        expect(order.split.parts[0]!.wallet_id).toBe('modo_bna');
        expect(order.split.parts.reduce((s, p) => s + p.pay_cents, 0) + order.split.unassigned_cents).toBe(cart.total_cents);
    });
});
