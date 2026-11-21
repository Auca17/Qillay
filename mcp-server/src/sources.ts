import { searchCoto } from './coto';
import { errorMessage } from './http';
import { searchPreciosClaros } from './precios-claros';
import { byPrice, type Product } from './product';
import { searchVtexCatalog, searchVtexIntelligent, type VtexStore } from './vtex';

export const STORE_IDS = ['jumbo', 'disco', 'vea', 'carrefour', 'dia', 'changomas', 'coto', 'vital', 'precios_claros'] as const;

export type StoreId = (typeof STORE_IDS)[number];

// Left out of the default: precios_claros needs branch ids, and carrefour.com.ar answers
// server-side requests with a Cloudflare challenge (HTTP 403).
export const DEFAULT_STORES: readonly StoreId[] = ['jumbo', 'disco', 'vea', 'dia', 'changomas', 'coto', 'vital'];

// Display data for a UI. Colors approximate each brand; they are not official brand values.
export const STORE_INFO: Record<StoreId, { name: string; color: string }> = {
    jumbo: { name: 'Jumbo', color: '#3DAE2B' },
    disco: { name: 'Disco', color: '#E2231A' },
    vea: { name: 'Vea', color: '#D52B1E' },
    carrefour: { name: 'Carrefour', color: '#004E9F' },
    dia: { name: 'DIA', color: '#E30613' },
    changomas: { name: 'ChangoMás', color: '#0072CE' },
    coto: { name: 'Coto', color: '#D6001C' },
    vital: { name: 'Vital', color: '#00529B' },
    precios_claros: { name: 'Precios Claros', color: '#37BBED' }
};

export interface SearchOptions {
    limit: number;
    branchIds?: string;
}

export interface StoreError {
    store: StoreId;
    error: string;
}

export interface SearchResult {
    products: Product[];
    stores: Partial<Record<StoreId, { name: string; color: string }>>;
    errors: StoreError[];
}

type Searcher = (q: string, options: SearchOptions) => Promise<Product[]>;

function catalog(id: StoreId, base: string, trustListPrice: boolean): Searcher {
    const store: VtexStore = { id, base, trustListPrice };
    return (q, { limit }) => searchVtexCatalog(store, q, limit);
}

const VITAL: VtexStore = { id: 'vital', base: 'https://tiendaonline.vital.com.ar', trustListPrice: true };

const SEARCHERS: Record<StoreId, Searcher> = {
    jumbo: catalog('jumbo', 'https://www.jumbo.com.ar', false),
    disco: catalog('disco', 'https://www.disco.com.ar', false),
    vea: catalog('vea', 'https://www.vea.com.ar', false),
    carrefour: catalog('carrefour', 'https://www.carrefour.com.ar', true),
    dia: catalog('dia', 'https://diaonline.supermercadosdia.com.ar', true),
    changomas: catalog('changomas', 'https://www.masonline.com.ar', true),
    coto: (q, { limit }) => searchCoto(q, limit),
    vital: (q, { limit }) => searchVtexIntelligent(VITAL, q, limit),
    precios_claros: async (q, { limit, branchIds }) => {
        if (!branchIds) throw new Error('needs branch_ids (ids from list_branches)');
        return searchPreciosClaros(q, branchIds, limit);
    }
};

// Query every store in parallel; a failing store becomes an entry in `errors`.
export async function searchProducts(q: string, stores: readonly StoreId[], options: SearchOptions): Promise<SearchResult> {
    const unique = [...new Set(stores)];
    const settled = await Promise.allSettled(unique.map(store => SEARCHERS[store](q, options)));
    const result: SearchResult = { products: [], stores: {}, errors: [] };
    settled.forEach((outcome, index) => {
        const store = unique[index];
        if (outcome.status === 'fulfilled') {
            result.products.push(...outcome.value);
            if (outcome.value.length > 0) result.stores[store] = STORE_INFO[store];
        } else {
            result.errors.push({ store, error: errorMessage(outcome.reason) });
        }
    });
    result.products.sort(byPrice);
    return result;
}
