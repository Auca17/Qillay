// The one product shape every source is normalized to; absent fields are omitted from the JSON.
// Money is integer centavos (ARS).
export interface Product {
    store: string;
    name: string;
    brand?: string;
    ean?: string;
    price_cents?: number;
    list_price_cents?: number;
    package?: string;
    image_url?: string;
    url?: string;
}

interface Priced {
    price_cents?: number;
}

// Ascending price, entries without a price last.
export function byPrice(a: Priced, b: Priced): number {
    return (a.price_cents ?? Infinity) - (b.price_cents ?? Infinity);
}

// Pesos (possibly fractional) to integer centavos.
export function cents(pesos: number | undefined): number | undefined {
    return pesos === undefined ? undefined : Math.round(pesos * 100);
}

// The list price only when it says something the price does not.
export function listPrice(price: number | undefined, list: number | undefined): number | undefined {
    return price !== undefined && list !== undefined && list > price ? list : undefined;
}
