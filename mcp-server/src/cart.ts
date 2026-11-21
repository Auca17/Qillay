import { STORE_INFO, type StoreId } from './sources';

// Carts live in Workers KV for a day. Money is integer centavos (ARS).
const TTL_SECONDS = 60 * 60 * 24;

export interface CartItem {
    item_id: string;
    store: string;
    name: string;
    brand?: string;
    ean?: string;
    price_cents: number;
    image_url?: string;
    url?: string;
    quantity: number;
}

export type NewCartItem = Omit<CartItem, 'item_id'>;

interface StoredCart {
    items: CartItem[];
}

export interface CartSummary {
    cart_id: string;
    items: (CartItem & { line_total_cents: number })[];
    by_store: { store: string; name: string; color: string; subtotal_cents: number; item_count: number }[];
    item_count: number;
    total_cents: number;
}

export function newCartId(): string {
    return crypto.randomUUID();
}

async function load(kv: KVNamespace, cartId: string): Promise<StoredCart> {
    return (await kv.get<StoredCart>(key(cartId), 'json')) ?? { items: [] };
}

async function save(kv: KVNamespace, cartId: string, cart: StoredCart): Promise<void> {
    await kv.put(key(cartId), JSON.stringify(cart), { expirationTtl: TTL_SECONDS });
}

function key(cartId: string): string {
    return `cart:${cartId}`;
}

export async function getCart(kv: KVNamespace, cartId: string): Promise<CartSummary> {
    return summarize(cartId, await load(kv, cartId));
}

export function newOrderId(): string {
    return `QY-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

// Adding a product already in the cart increases its quantity.
export async function addItem(kv: KVNamespace, cartId: string, item: NewCartItem): Promise<CartSummary> {
    return addItems(kv, cartId, [item]);
}

// Several products in ONE read-modify-write. KV has no transactions, so parallel calls
// for the same cart can still overwrite each other: batch instead of calling in parallel.
export async function addItems(kv: KVNamespace, cartId: string, items: NewCartItem[]): Promise<CartSummary> {
    const cart = await load(kv, cartId);
    for (const item of items) {
        const itemId = `${item.store}:${item.ean ?? item.name.toLowerCase()}`;
        const existing = cart.items.find(entry => entry.item_id === itemId);
        if (existing) existing.quantity += item.quantity;
        else cart.items.push({ ...item, item_id: itemId });
    }
    await save(kv, cartId, cart);
    return summarize(cartId, cart);
}

export async function removeItem(kv: KVNamespace, cartId: string, itemId: string): Promise<CartSummary> {
    const cart = await load(kv, cartId);
    cart.items = cart.items.filter(entry => entry.item_id !== itemId);
    await save(kv, cartId, cart);
    return summarize(cartId, cart);
}

export async function clearCart(kv: KVNamespace, cartId: string): Promise<void> {
    await kv.delete(key(cartId));
}

function summarize(cartId: string, cart: StoredCart): CartSummary {
    const items = cart.items.map(item => ({ ...item, line_total_cents: item.price_cents * item.quantity }));
    const stores = new Map<string, CartSummary['by_store'][number]>();
    for (const item of items) {
        const info = STORE_INFO[item.store as StoreId] ?? { name: item.store, color: '#555555' };
        const entry = stores.get(item.store) ?? { store: item.store, ...info, subtotal_cents: 0, item_count: 0 };
        entry.subtotal_cents += item.line_total_cents;
        entry.item_count += item.quantity;
        stores.set(item.store, entry);
    }
    return {
        cart_id: cartId,
        items,
        by_store: [...stores.values()],
        item_count: items.reduce((sum, item) => sum + item.quantity, 0),
        total_cents: items.reduce((sum, item) => sum + item.line_total_cents, 0)
    };
}
