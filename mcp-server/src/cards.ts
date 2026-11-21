import type { Product } from './product';
import { DEFAULT_STORES, searchProducts, STORE_IDS, STORE_INFO, type StoreId } from './sources';

// Link to the cards page for a search; the page reruns the search when opened.
export function cardsUrl(origin: string, q: string, stores: readonly StoreId[], limit: number): string {
    const params = new URLSearchParams({ q, stores: stores.join(','), limit: String(limit) });
    return `${origin}/cards?${params}`;
}

// Worker responses are not cached by Cloudflare on their own: keep each search in the
// Cache API for 2 minutes so repeated GETs do not fan out to every retailer again.
export async function cachedCardsPage(request: Request, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const key = new Request(cacheKey(url), { method: 'GET' });
    const cache = caches.default;
    const hit = await cache.match(key);
    if (hit) return hit;
    const response = await cardsPage(url);
    if (response.ok) ctx.waitUntil(cache.put(key, response.clone()));
    return response;
}

// Same search, same key: normalized text, sorted stores, clamped limit.
function cacheKey(url: URL): string {
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase().slice(0, 100);
    const stores = (url.searchParams.get('stores') ?? '').split(',').filter(isStoreId).sort().join(',');
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 5, 1), 20);
    return `${url.origin}/cards?${new URLSearchParams({ q, stores, limit: String(limit) })}`;
}

// GET /cards?q=<text>&stores=<ids>&limit=<n>: product cards as a plain HTML page.
export async function cardsPage(url: URL): Promise<Response> {
    const q = (url.searchParams.get('q') ?? '').trim().slice(0, 100);
    const requested = (url.searchParams.get('stores') ?? '').split(',').filter(isStoreId);
    const stores = requested.length > 0 ? requested : DEFAULT_STORES;
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 5, 1), 20);
    const result = q ? await searchProducts(q, stores, { limit }) : { products: [], errors: [] };
    const priced = result.products.filter(product => product.price_cents !== undefined);

    const body = q
        ? `<h1>${escapeHtml(q)}</h1>
<p class="summary">${priced.length} productos con precio en ${new Set(priced.map(product => product.store)).size} supermercados, de menor a mayor.</p>
${savings(priced)}
<div class="grid">${priced.map((product, index) => card(product, index === 0)).join('')}</div>
${result.errors.length > 0 ? `<p class="errors">Sin respuesta de: ${result.errors.map(error => escapeHtml(STORE_INFO[error.store].name)).join(', ')}.</p>` : ''}`
        : '<h1>Qillay</h1><p class="summary">Falta el texto a buscar (parámetro q).</p>';

    return new Response(page(q ? `${q} · Qillay` : 'Qillay', body), {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Security-Policy': "default-src 'none'; img-src https:; style-src 'unsafe-inline'",
            'Cache-Control': 'public, max-age=120'
        }
    });
}

function isStoreId(value: string): value is StoreId {
    return (STORE_IDS as readonly string[]).includes(value);
}

function savings(priced: Product[]): string {
    const cheapest = priced[0]?.price_cents;
    const dearest = priced.at(-1)?.price_cents;
    if (cheapest === undefined || dearest === undefined || dearest <= cheapest) return '';
    return `<p class="savings">Entre el más barato y el más caro de esta búsqueda hay ${pesos(dearest - cheapest)} de diferencia. Son productos distintos: compará marca y tamaño.</p>`;
}

function card(product: Product, cheapest: boolean): string {
    const store = STORE_INFO[product.store as StoreId] ?? { name: product.store, color: '#555555' };
    const image = httpsUrl(product.image_url);
    const link = httpsUrl(product.url);
    const listPrice = product.list_price_cents ? `<s>${pesos(product.list_price_cents)}</s>` : '';
    return `<article class="card" style="--store:${store.color}">
<span class="store">${escapeHtml(store.name)}</span>
${cheapest ? '<span class="best">Menor precio</span>' : ''}
${image ? `<img src="${escapeHtml(image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<div class="noimg"></div>'}
<h2>${escapeHtml(product.name)}</h2>
<p class="brand">${escapeHtml(product.brand ?? '')}${product.package ? ` · ${escapeHtml(product.package)}` : ''}</p>
<p class="price">${pesos(product.price_cents ?? 0)} ${listPrice}</p>
${link ? `<a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">Ver en ${escapeHtml(store.name)}</a>` : ''}
</article>`;
}

function pesos(cents: number): string {
    return `$${(cents / 100).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
}

// Only https URLs reach an attribute; anything else is dropped.
function httpsUrl(value: string | undefined): string | undefined {
    if (!value) return undefined;
    const url = value.startsWith('http://') ? `https://${value.slice(7)}` : value;
    return url.startsWith('https://') ? url : undefined;
}

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, char => `&#${char.charCodeAt(0)};`);
}

function page(title: string, body: string): string {
    return `<!doctype html>
<html lang="es-AR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
:root { color-scheme: light dark; --bg: #f5f5f2; --surface: #ffffff; --text: #1c1c1a; --muted: #66665f; --line: #e2e2dc; }
@media (prefers-color-scheme: dark) { :root { --bg: #161614; --surface: #222220; --text: #f0f0ea; --muted: #a3a39b; --line: #34342f; } }
* { box-sizing: border-box; }
body { margin: 0; padding: 24px 16px 48px; background: var(--bg); color: var(--text); font: 16px/1.4 system-ui, sans-serif; }
h1 { margin: 0 0 4px; font-size: 1.5rem; text-transform: capitalize; }
.summary, .errors { margin: 0 0 12px; color: var(--muted); font-size: 0.9rem; }
.savings { margin: 0 0 20px; padding: 10px 14px; border-radius: 10px; background: var(--surface); border: 1px solid var(--line); font-size: 0.9rem; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 14px; margin-bottom: 20px; }
.card { position: relative; display: flex; flex-direction: column; padding: 44px 14px 14px; background: var(--surface); border: 1px solid var(--line); border-top: 5px solid var(--store); border-radius: 12px; }
.store { position: absolute; top: 10px; left: 12px; padding: 2px 9px; border-radius: 999px; background: var(--store); color: #fff; font-size: 0.75rem; font-weight: 600; }
.best { position: absolute; top: 10px; right: 12px; padding: 2px 9px; border-radius: 999px; border: 1px solid var(--text); font-size: 0.72rem; font-weight: 600; }
img, .noimg { width: 100%; aspect-ratio: 1; object-fit: contain; background: #fff; border-radius: 8px; }
h2 { margin: 10px 0 2px; font-size: 0.95rem; line-height: 1.25; }
.brand { margin: 0; min-height: 1.2em; color: var(--muted); font-size: 0.8rem; }
.price { margin: 8px 0 10px; font-size: 1.3rem; font-weight: 700; font-variant-numeric: tabular-nums; }
.price s { color: var(--muted); font-size: 0.85rem; font-weight: 400; }
a { margin-top: auto; color: inherit; font-size: 0.85rem; }
</style>
</head>
<body>
${body}
</body>
</html>`;
}
