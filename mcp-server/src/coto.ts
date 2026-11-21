import { amount, fetchJson, isRecord, records, text, type Json } from './http';
import { listPrice, type Product } from './product';

const BASE = 'https://www.coto.com.ar';

// Coto Digital answers with an Endeca page; the products sit in the results list of its Main slot.
export async function searchCoto(q: string, limit: number): Promise<Product[]> {
    const params = new URLSearchParams({ Ntt: q, format: 'json', Nrpp: String(limit) });
    const data = await fetchJson(`${BASE}/sitios/cdigi/categoria?${params}`);
    const page = isRecord(data) ? records(data.contents)[0] : undefined;
    if (!page) throw new Error('respuesta con formato inesperado');
    // A search without matches has no results list.
    const results = records(page.Main)
        .flatMap(slot => records(slot.contents))
        .find(content => Array.isArray(content.records));
    return records(results?.records).flatMap(toProduct);
}

function toProduct(group: Json): Product[] {
    // Each result groups one product; its first inner record holds the SKU attributes.
    const sku = records(group.records)[0];
    const attributes = sku && isRecord(sku.attributes) ? sku.attributes : undefined;
    const nombre = attributes && first(attributes['product.displayName']);
    if (!attributes || !nombre) return [];
    const precio = amount(first(attributes['sku.activePrice']));
    return [
        {
            fuente: 'coto',
            nombre,
            marca: first(attributes['product.brand']),
            ean: first(attributes['product.eanPrincipal']),
            precio,
            precio_lista: listPrice(precio, amount(first(attributes['sku.referencePrice']))),
            url: productUrl(group.detailsAction)
        }
    ];
}

// Endeca attributes are single-element arrays.
function first(value: unknown): string | undefined {
    return Array.isArray(value) ? text(value[0]) : undefined;
}

// recordState is "/<slug>/_/A-<id>?format=json"; the shop page is "/productos/<slug>/_/R-<id>".
function productUrl(detailsAction: unknown): string | undefined {
    const state = isRecord(detailsAction) ? text(detailsAction.recordState) : undefined;
    if (!state) return undefined;
    return `${BASE}/productos${encodeURI(state.split('?')[0].replace('/_/A-', '/_/R-'))}`;
}
