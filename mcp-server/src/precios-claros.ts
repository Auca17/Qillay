import { amount, fetchJson, isRecord, records, text, type Json } from './http';
import { byPrice, cents, type Product } from './product';

// Precios Claros answers 403 to some networks (seen from a home connection) and 200 from Workers.
const BASE = 'https://d3e6htiiul5ek9.cloudfront.net/prod';

export interface Branch {
    id?: string;
    chain?: string;
    branch?: string;
    address?: string;
    city?: string;
    province?: string;
    distance_km?: number;
}

export interface BranchPrice extends Branch {
    price_cents?: number;
    promo_price_cents?: number;
}

export interface PriceComparison {
    product?: Product;
    branches: BranchPrice[];
}

export async function listBranches(lat: number, lng: number, limit: number): Promise<Branch[]> {
    const params = new URLSearchParams({ lat: String(lat), lng: String(lng), limit: String(limit) });
    const data = await getObject(`/sucursales?${params}`);
    return records(data.sucursales).map(raw => ({ ...toBranch(raw), distance_km: distance(raw.distanciaNumero) }));
}

// `price_cents` is the lowest price among the given branches.
export async function searchPreciosClaros(q: string, branchIds: string, limit: number): Promise<Product[]> {
    const params = new URLSearchParams({ string: q, array_sucursales: branchIds, offset: '0', limit: String(limit) });
    const data = await getObject(`/productos?${params}`);
    return records(data.productos).flatMap(raw => toProduct(raw, amount(raw.precioMin)));
}

export async function comparePrice(ean: string, branchIds: string): Promise<PriceComparison> {
    const params = new URLSearchParams({ id_producto: ean, array_sucursales: branchIds, limit: '30' });
    const data = await getObject(`/producto?${params}`);
    const branches = records(data.sucursales).map(raw => {
        const prices = isRecord(raw.preciosProducto) ? raw.preciosProducto : {};
        const promo = isRecord(prices.promo1) ? amount(prices.promo1.precio) : undefined;
        return { ...toBranch(raw), price_cents: cents(amount(prices.precioLista)), promo_price_cents: cents(promo) };
    });
    return {
        product: isRecord(data.producto) ? toProduct(data.producto, undefined)[0] : undefined,
        // Branches that do not carry the product come back without a price.
        branches: branches.filter(branch => branch.price_cents !== undefined).sort(byPrice)
    };
}

async function getObject(path: string): Promise<Json> {
    const data = await fetchJson(`${BASE}${path}`);
    if (!isRecord(data)) throw new Error('unexpected response shape');
    return data;
}

function toBranch(raw: Json): Branch {
    return {
        id: text(raw.id),
        chain: text(raw.banderaDescripcion) ?? text(raw.comercioRazonSocial),
        branch: text(raw.sucursalNombre),
        address: text(raw.direccion),
        city: text(raw.localidad),
        province: text(raw.provincia)
    };
}

function toProduct(raw: Json, price: number | undefined): Product[] {
    const name = text(raw.nombre);
    if (!name) return [];
    return [
        {
            store: 'precios_claros',
            name,
            brand: text(raw.marca),
            ean: text(raw.id),
            price_cents: cents(price),
            package: text(raw.presentacion)
        }
    ];
}

// Kilometres with two decimals.
function distance(value: unknown): number | undefined {
    const km = amount(value);
    return km === undefined ? undefined : Math.round(km * 100) / 100;
}
