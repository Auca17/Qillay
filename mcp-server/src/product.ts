// The one product shape every source is normalized to; absent fields are omitted from the JSON.
export interface Product {
    fuente: string;
    nombre: string;
    marca?: string;
    ean?: string;
    precio?: number;
    precio_lista?: number;
    presentacion?: string;
    url?: string;
}

interface Priced {
    precio?: number;
}

// Ascending price, entries without a price last.
export function byPrice(a: Priced, b: Priced): number {
    return (a.precio ?? Infinity) - (b.precio ?? Infinity);
}

// The list price only when it says something the price does not.
export function listPrice(price: number | undefined, list: number | undefined): number | undefined {
    return price !== undefined && list !== undefined && list > price ? list : undefined;
}
