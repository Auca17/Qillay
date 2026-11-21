// Wallet promo rules and the split-payment math. Money is integer centavos (ARS).

export const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export interface Wallet {
    id: string;
    name: string;
    // Cashback as a percentage of the amount paid with this wallet.
    cashback_pct: number;
    // Maximum cashback per period.
    cap_cents: number;
    // Days the promo applies; absent means every day.
    days?: Weekday[];
}

// Illustrative rules for the demo. They are NOT real promotions.
export const SAMPLE_WALLETS: Wallet[] = [
    { id: 'modo_bna', name: 'MODO + Banco Nación', cashback_pct: 30, cap_cents: 1_200_000, days: ['wednesday'] },
    { id: 'naranja_x', name: 'Naranja X', cashback_pct: 25, cap_cents: 800_000, days: ['tuesday', 'thursday'] },
    { id: 'banco_macro', name: 'Banco Macro', cashback_pct: 20, cap_cents: 1_000_000, days: ['friday', 'saturday'] },
    { id: 'mercado_pago', name: 'Mercado Pago', cashback_pct: 10, cap_cents: 500_000 }
];

export interface SplitInput {
    totalCents: number;
    wallets: Wallet[];
    day?: Weekday;
    // Cashback already received this period, per wallet id.
    consumedCents?: Record<string, number>;
}

export interface SplitPart {
    wallet_id: string;
    name: string;
    pay_cents: number;
    cashback_cents: number;
    cashback_pct: number;
    cap_reached: boolean;
}

export interface SplitResult {
    total_cents: number;
    parts: SplitPart[];
    // Amount left after every cap is exhausted; pay it with any method.
    unassigned_cents: number;
    total_cashback_cents: number;
    net_cents: number;
    skipped: { wallet_id: string; reason: string }[];
}

// Fill the highest-percentage wallets first, each up to the amount that exhausts its cap.
export function splitPayment({ totalCents, wallets, day, consumedCents = {} }: SplitInput): SplitResult {
    const skipped: SplitResult['skipped'] = [];
    const usable = wallets.filter(wallet => {
        if (day && wallet.days && !wallet.days.includes(day)) {
            skipped.push({ wallet_id: wallet.id, reason: `promo not active on ${day}` });
            return false;
        }
        if (wallet.cap_cents - (consumedCents[wallet.id] ?? 0) <= 0) {
            skipped.push({ wallet_id: wallet.id, reason: 'cashback cap already used' });
            return false;
        }
        return true;
    });

    let remaining = totalCents;
    const parts: SplitPart[] = [];
    for (const wallet of [...usable].sort((a, b) => b.cashback_pct - a.cashback_pct)) {
        if (remaining <= 0) break;
        const capLeft = wallet.cap_cents - (consumedCents[wallet.id] ?? 0);
        // Smallest payment whose cashback reaches the remaining cap.
        const toExhaust = Math.ceil((capLeft * 100) / wallet.cashback_pct);
        const pay = Math.min(remaining, toExhaust);
        const cashback = Math.min(capLeft, Math.floor((pay * wallet.cashback_pct) / 100));
        parts.push({
            wallet_id: wallet.id,
            name: wallet.name,
            pay_cents: pay,
            cashback_cents: cashback,
            cashback_pct: wallet.cashback_pct,
            cap_reached: cashback >= capLeft
        });
        remaining -= pay;
    }

    const totalCashback = parts.reduce((sum, part) => sum + part.cashback_cents, 0);
    return {
        total_cents: totalCents,
        parts,
        unassigned_cents: remaining,
        total_cashback_cents: totalCashback,
        net_cents: totalCents - totalCashback,
        skipped
    };
}
