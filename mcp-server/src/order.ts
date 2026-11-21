import { newOrderId, type CartSummary } from './cart';
import { SAMPLE_WALLETS, splitPayment, type SplitResult } from './wallets';

export interface Order {
    order_id: string;
    status: 'confirmed';
    payment: 'simulated';
    item_count: number;
    total_cents: number;
    by_store: CartSummary['by_store'];
    items: CartSummary['items'];
    // How to pay it with the sample wallets on the day of the order (illustrative rules).
    split: SplitResult;
}

// A simulated order: nothing is charged.
export function buildOrder(cart: CartSummary, now: Date = new Date()): Order {
    return {
        order_id: newOrderId(),
        status: 'confirmed',
        payment: 'simulated',
        item_count: cart.item_count,
        total_cents: cart.total_cents,
        by_store: cart.by_store,
        items: cart.items,
        split: splitPayment({ totalCents: cart.total_cents, wallets: SAMPLE_WALLETS, now })
    };
}
