import { amount, fetchJson, isRecord, records, text, type Json } from './http';
import { byPrice, type Product } from './product';

// Field names below follow the public Precios Claros API; they could not be checked against a
// live response because the endpoint answered 403 while this was written.
const BASE = 'https://d3e6htiiul5ek9.cloudfront.net/prod';

export interface Branch {
    id?: string;
    cadena?: string;
    sucursal?: string;
    direccion?: string;
    localidad?: string;
    provincia?: string;
    distancia_km?: number;
}

export interface BranchPrice extends Branch {
    precio?: number;
    precio_promo?: number;
}

export interface PriceComparison {
    producto?: Product;
    sucursales: BranchPrice[];
}

export async function listBranches(lat: number, lng: number, limit: number): Promise<Branch[]> {
    const params = new URLSearchParams({ lat: String(lat), lng: String(lng), limit: String(limit) });
    const data = await getObject(`/sucursales?${params}`);
    return records(data.sucursales).map(raw => ({ ...toBranch(raw), distancia_km: distance(raw.distanciaNumero) }));
}

// `precio` is the lowest price among the given branches.
export async function searchPreciosClaros(q: string, sucursales: string, limit: number): Promise<Product[]> {
    const params = new URLSearchParams({ string: q, array_sucursales: sucursales, offset: '0', limit: String(limit) });
    const data = await getObject(`/productos?${params}`);
    return records(data.productos).flatMap(raw => toProduct(raw, amount(raw.precioMin)));
}

export async function comparePrice(ean: string, sucursales: string): Promise<PriceComparison> {
    const params = new URLSearchParams({ id_producto: ean, array_sucursales: sucursales, limit: '30' });
    const data = await getObject(`/producto?${params}`);
    const branches = records(data.sucursales).map(raw => {
        const prices = isRecord(raw.preciosProducto) ? raw.preciosProducto : {};
        const promo = isRecord(prices.promo1) ? amount(prices.promo1.precio) : undefined;
        return { ...toBranch(raw), precio: amount(prices.precioLista), precio_promo: promo };
    });
    return {
        producto: isRecord(data.producto) ? toProduct(data.producto, undefined)[0] : undefined,
        // Branches that do not carry the product come back without a price.
        sucursales: branches.filter(branch => branch.precio !== undefined).sort(byPrice)
    };
}

async function getObject(path: string): Promise<Json> {
    const data = await fetchJson(`${BASE}${path}`);
    if (!isRecord(data)) throw new Error('respuesta con formato inesperado');
    return data;
}

function toBranch(raw: Json): Branch {
    return {
        id: text(raw.id),
        cadena: text(raw.banderaDescripcion) ?? text(raw.comercioRazonSocial),
        sucursal: text(raw.sucursalNombre),
        direccion: text(raw.direccion),
        localidad: text(raw.localidad),
        provincia: text(raw.provincia)
    };
}

function toProduct(raw: Json, precio: number | undefined): Product[] {
    const nombre = text(raw.nombre);
    if (!nombre) return [];
    return [
        {
            fuente: 'precios_claros',
            nombre,
            marca: text(raw.marca),
            ean: text(raw.id),
            precio,
            presentacion: text(raw.presentacion)
        }
    ];
}

// Kilometres with two decimals.
function distance(value: unknown): number | undefined {
    const km = amount(value);
    return km === undefined ? undefined : Math.round(km * 100) / 100;
}
