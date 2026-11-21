import { describe, expect, it } from 'vitest';

import { SAMPLE_WALLETS, splitPayment, todayInArgentina } from '../src/wallets';

describe('splitPayment', () => {
    it('fills the best promo up to its cap first (MODO exhausts $12.000 with $40.000 on a Wednesday)', () => {
        const r = splitPayment({ totalCents: 8_500_000, wallets: SAMPLE_WALLETS, day: 'wednesday' });
        expect(r.parts[0]).toMatchObject({ wallet_id: 'modo_bna', pay_cents: 4_000_000, cashback_cents: 1_200_000, cap_reached: true });
        expect(r.parts[1]).toMatchObject({ wallet_id: 'mercado_pago', pay_cents: 4_500_000, cashback_cents: 450_000 });
        expect(r.total_cashback_cents).toBe(1_650_000);
        expect(r.net_cents).toBe(8_500_000 - 1_650_000);
        expect(r.day).toBe('wednesday');
    });

    it('respects cashback already received this period', () => {
        const r = splitPayment({ totalCents: 8_500_000, wallets: SAMPLE_WALLETS, day: 'wednesday', consumedCents: { modo_bna: 900_000 } });
        expect(r.parts[0]).toMatchObject({ wallet_id: 'modo_bna', pay_cents: 1_000_000, cashback_cents: 300_000 });
    });

    it('skips promos that are not active on the given day', () => {
        const r = splitPayment({ totalCents: 1_000_000, wallets: SAMPLE_WALLETS, day: 'monday' });
        expect(r.parts.map(p => p.wallet_id)).toEqual(['mercado_pago']);
        expect(r.skipped.map(s => s.wallet_id)).toContain('modo_bna');
    });

    it('always accounts for the whole total in integer centavos', () => {
        for (const total of [1, 999, 123_457, 8_500_001, 99_999_999]) {
            const r = splitPayment({ totalCents: total, wallets: SAMPLE_WALLETS, day: 'wednesday' });
            expect(r.parts.reduce((s, p) => s + p.pay_cents, 0) + r.unassigned_cents).toBe(total);
            expect(r.parts.every(p => Number.isInteger(p.pay_cents) && Number.isInteger(p.cashback_cents))).toBe(true);
        }
    });
});

describe('todayInArgentina', () => {
    it('uses UTC-3, not UTC', () => {
        // 02:00 UTC on Tuesday is still 23:00 on Monday in Argentina.
        expect(todayInArgentina(new Date('2026-11-24T02:00:00Z'))).toBe('monday');
        expect(todayInArgentina(new Date('2026-11-24T03:00:00Z'))).toBe('tuesday');
        expect(todayInArgentina(new Date('2026-11-22T15:00:00Z'))).toBe('sunday');
    });
});
