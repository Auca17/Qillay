import { amount, fetchJson, isRecord, records, text, type Json } from './http';
import { listPrice, type Product } from './product';

export interface VtexStore {
    fuente: string;
    base: string;
    // Jumbo, Disco and Vea report a ListPrice unrelated to the shelf price, so it is ignored there.
    trustListPrice: boolean;
}

// Legacy catalog search, the API of most VTEX stores.
export async function searchVtexCatalog(store: VtexStore, q: string, limit: number): Promise<Product[]> {
    // Not URLSearchParams: it encodes spaces as "+", which this API rejects with HTTP 400.
    const query = `ft=${encodeURIComponent(q)}&_from=0&_to=${limit - 1}`;
    const data = await fetchJson(`${store.base}/api/catalog_system/pub/products/search?${query}`);
    if (!Array.isArray(data)) throw new Error('respuesta con formato inesperado');
    return toProducts(store, data);
}

// Intelligent search; only its `query` parameter filters, the path form returns unrelated products.
export async function searchVtexIntelligent(store: VtexStore, q: string, limit: number): Promise<Product[]> {
    const params = new URLSearchParams({ query: q, count: String(limit), page: '1' });
    const data = await fetchJson(`${store.base}/api/io/_v/api/intelligent-search/product_search?${params}`);
    if (!isRecord(data) || !Array.isArray(data.products)) throw new Error('respuesta con formato inesperado');
    return toProducts(store, data.products);
}

function toProducts(store: VtexStore, raw: unknown[]): Product[] {
    return records(raw).flatMap(product => {
        const nombre = text(product.productName);
        if (!nombre) return [];
        const sku = records(product.items)[0] ?? {};
        const offer = firstOffer(sku);
        const precio = amount(offer.Price);
        const multiplier = amount(sku.unitMultiplier);
        return [
            {
                fuente: store.fuente,
                nombre,
                marca: text(product.brand),
                ean: text(sku.ean),
                precio,
                precio_lista: store.trustListPrice ? listPrice(precio, amount(offer.ListPrice)) : undefined,
                // Only wholesale packs carry information here; retail SKUs are 1 "un".
                presentacion:
                    multiplier && multiplier !== 1 ? `x${multiplier} ${text(sku.measurementUnit) ?? 'un'}` : undefined,
                url: productUrl(store.base, text(product.link))
            }
        ];
    });
}

// The first in-stock seller offer; out-of-stock offers keep stale prices, so they yield none.
function firstOffer(sku: Json): Json {
    const offers = records(sku.sellers)
        .map(seller => seller.commertialOffer)
        .filter(isRecord);
    return offers.find(offer => amount(offer.AvailableQuantity) !== undefined && amount(offer.Price) !== undefined) ?? {};
}

// Catalog search links are absolute, intelligent search links are site-relative.
function productUrl(base: string, link: string | undefined): string | undefined {
    if (!link) return undefined;
    return link.startsWith('http') ? link : `${base}${link}`;
}
