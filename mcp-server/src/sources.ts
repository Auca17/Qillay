import { searchCoto } from './coto';
import { errorMessage } from './http';
import { searchPreciosClaros } from './precios-claros';
import { byPrice, type Product } from './product';
import { searchVtexCatalog, searchVtexIntelligent, type VtexStore } from './vtex';

export const SOURCE_IDS = [
    'jumbo',
    'disco',
    'vea',
    'carrefour',
    'dia',
    'changomas',
    'coto',
    'vital',
    'precios_claros'
] as const;

export type SourceId = (typeof SOURCE_IDS)[number];

// Left out of the default: precios_claros needs branch ids, and carrefour.com.ar answers
// server-side requests with a Cloudflare challenge (HTTP 403).
export const DEFAULT_SOURCES: readonly SourceId[] = ['jumbo', 'disco', 'vea', 'dia', 'changomas', 'coto', 'vital'];

export interface SearchOptions {
    limit: number;
    sucursales?: string;
}

export interface SourceError {
    fuente: SourceId;
    error: string;
}

export interface SearchResult {
    resultados: Product[];
    errores: SourceError[];
}

type Searcher = (q: string, options: SearchOptions) => Promise<Product[]>;

function catalog(fuente: SourceId, base: string, trustListPrice: boolean): Searcher {
    const store: VtexStore = { fuente, base, trustListPrice };
    return (q, { limit }) => searchVtexCatalog(store, q, limit);
}

const VITAL: VtexStore = { fuente: 'vital', base: 'https://tiendaonline.vital.com.ar', trustListPrice: true };

const SEARCHERS: Record<SourceId, Searcher> = {
    jumbo: catalog('jumbo', 'https://www.jumbo.com.ar', false),
    disco: catalog('disco', 'https://www.disco.com.ar', false),
    vea: catalog('vea', 'https://www.vea.com.ar', false),
    carrefour: catalog('carrefour', 'https://www.carrefour.com.ar', true),
    dia: catalog('dia', 'https://diaonline.supermercadosdia.com.ar', true),
    changomas: catalog('changomas', 'https://www.masonline.com.ar', true),
    coto: (q, { limit }) => searchCoto(q, limit),
    vital: (q, { limit }) => searchVtexIntelligent(VITAL, q, limit),
    precios_claros: async (q, { limit, sucursales }) => {
        if (!sucursales) throw new Error('requiere el parámetro sucursales (ids de listar_sucursales)');
        return searchPreciosClaros(q, sucursales, limit);
    }
};

// Query every source in parallel; a failing source becomes an entry in `errores`.
export async function searchProducts(q: string, sources: readonly SourceId[], options: SearchOptions): Promise<SearchResult> {
    const unique = [...new Set(sources)];
    const settled = await Promise.allSettled(unique.map(source => SEARCHERS[source](q, options)));
    const result: SearchResult = { resultados: [], errores: [] };
    settled.forEach((outcome, index) => {
        if (outcome.status === 'fulfilled') result.resultados.push(...outcome.value);
        else result.errores.push({ fuente: unique[index], error: errorMessage(outcome.reason) });
    });
    result.resultados.sort(byPrice);
    return result;
}
