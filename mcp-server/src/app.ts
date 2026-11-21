// The MCP Apps view (SEP-1865): one HTML document a host renders in an iframe next to tool results.
// It shows a product carousel, the cart or an order, depending on the tool result it receives.

export const APP_URI = 'ui://qillay/app.html';
export const APP_MIME = 'text/html;profile=mcp-app';

// Product photos load from the retailers' CDNs.
export const APP_UI_META = {
    ui: {
        csp: {
            resourceDomains: ['https://*.vteximg.com.br', 'https://*.vtexassets.com', 'https://static.cotodigital3.com.ar']
        },
        prefersBorder: false
    }
};

const STYLE = `
:root { color-scheme: light dark; --bg: transparent; --surface: #ffffff; --text: #1c1c1a; --muted: #66665f; --line: #e2e2dc; --accent: #1c1c1a; --ok: #1a8f4c; }
:root[data-theme="dark"] { --surface: #222220; --text: #f0f0ea; --muted: #a3a39b; --line: #3a3a35; --accent: #f0f0ea; --ok: #4cc38a; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --surface: #222220; --text: #f0f0ea; --muted: #a3a39b; --line: #3a3a35; --accent: #f0f0ea; --ok: #4cc38a; } }
* { box-sizing: border-box; }
body { margin: 0; padding: 4px; background: var(--bg); color: var(--text); font: 14px/1.35 system-ui, sans-serif; }
h1 { margin: 0 0 2px; font-size: 1.05rem; }
.muted { margin: 0 0 10px; color: var(--muted); font-size: 0.82rem; }
.carousel { display: flex; gap: 12px; overflow-x: auto; scroll-snap-type: x mandatory; padding: 2px 2px 12px; }
.card { position: relative; flex: 0 0 190px; scroll-snap-align: start; display: flex; flex-direction: column; padding: 40px 12px 12px; background: var(--surface); border: 1px solid var(--line); border-top: 5px solid var(--store); border-radius: 12px; }
.store { position: absolute; top: 9px; left: 10px; padding: 2px 9px; border-radius: 999px; background: var(--store); color: #fff; font-size: 0.72rem; font-weight: 600; }
.best { position: absolute; top: 9px; right: 10px; padding: 1px 8px; border-radius: 999px; border: 1px solid var(--text); font-size: 0.68rem; font-weight: 600; }
.card img, .noimg { width: 100%; aspect-ratio: 1; object-fit: contain; background: #fff; border-radius: 8px; }
.name { margin: 8px 0 2px; font-size: 0.88rem; font-weight: 600; line-height: 1.25; }
.brand { margin: 0; min-height: 1.2em; color: var(--muted); font-size: 0.76rem; }
.price { margin: 6px 0 10px; font-size: 1.2rem; font-weight: 700; font-variant-numeric: tabular-nums; }
.price s { color: var(--muted); font-size: 0.8rem; font-weight: 400; }
button { margin-top: auto; padding: 8px 10px; border: 1px solid var(--accent); border-radius: 8px; background: transparent; color: var(--text); font: inherit; font-weight: 600; cursor: pointer; }
button.primary { background: var(--accent); color: var(--surface); }
button:disabled { opacity: 0.55; cursor: default; }
button.link { margin: 0; padding: 0; border: 0; color: var(--muted); font-weight: 400; font-size: 0.78rem; text-decoration: underline; }
.panel { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 14px; }
.row { display: flex; gap: 10px; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--line); }
.row img, .row .noimg { width: 46px; height: 46px; flex: none; aspect-ratio: auto; border-radius: 6px; }
.row .info { flex: 1; min-width: 0; }
.row .title { font-weight: 600; font-size: 0.86rem; }
.row .amount { font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
.dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: var(--store); margin-right: 5px; }
.totals { margin: 10px 0 0; padding: 0; list-style: none; font-size: 0.85rem; }
.totals li { display: flex; justify-content: space-between; padding: 2px 0; }
.totals .total { margin-top: 6px; padding-top: 8px; border-top: 1px solid var(--line); font-size: 1.1rem; font-weight: 700; }
.actions { display: flex; gap: 8px; margin-top: 14px; }
.actions button { flex: 1; }
.paid { color: var(--ok); font-weight: 700; font-size: 1.05rem; }
.status { margin: 8px 0 0; min-height: 1.2em; color: var(--muted); font-size: 0.8rem; }
`;

const SCRIPT = `
const root = document.getElementById('root');
const pending = new Map();
let nextId = 1;
let cartId = null;

function post(message) { window.parent.postMessage(message, '*'); }
function request(method, params) {
    const id = nextId++;
    post({ jsonrpc: '2.0', id, method, params });
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
function notify(method, params) { post({ jsonrpc: '2.0', method, params }); }

window.addEventListener('message', event => {
    const message = event.data;
    if (!message || message.jsonrpc !== '2.0') return;
    if (message.id !== undefined && message.method === undefined) {
        const waiting = pending.get(message.id);
        if (!waiting) return;
        pending.delete(message.id);
        if (message.error) waiting.reject(new Error(message.error.message || 'error'));
        else waiting.resolve(message.result);
        return;
    }
    if (message.method === 'ui/notifications/tool-result') show(message.params);
    else if (message.method === 'ui/notifications/host-context-changed') applyContext(message.params);
    else if (message.id !== undefined) post({ jsonrpc: '2.0', id: message.id, result: {} });
});

function applyContext(context) {
    if (context && (context.theme === 'dark' || context.theme === 'light')) document.documentElement.dataset.theme = context.theme;
}

// Tool results carry the data as structuredContent, with the same JSON as text for older hosts.
function dataOf(result) {
    if (result && result.structuredContent) return result.structuredContent;
    try { return JSON.parse(result.content[0].text); } catch { return null; }
}

function show(result) {
    const data = dataOf(result);
    if (!data) return;
    if (data.cart_id) cartId = data.cart_id;
    if (data.order) renderOrder(data.order);
    else if (data.items) renderCart(data);
    else if (data.products) renderProducts(data);
}

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}
function pesos(cents) { return '$' + (cents / 100).toLocaleString('es-AR', { maximumFractionDigits: 2 }); }
function picture(url) {
    if (!url || !url.startsWith('https://')) return el('div', 'noimg');
    const image = el('img');
    image.src = url;
    image.alt = '';
    image.loading = 'lazy';
    image.referrerPolicy = 'no-referrer';
    return image;
}
function storeOf(data, id) { return (data.stores && data.stores[id]) || { name: id, color: '#555555' }; }
async function callTool(name, args) { return dataOf(await request('tools/call', { name, arguments: args })); }

function renderProducts(data) {
    const priced = data.products.filter(product => product.price_cents !== undefined);
    root.replaceChildren();
    root.append(el('h1', '', priced.length === 1 ? priced[0].name : priced.length + ' productos'));
    root.append(el('p', 'muted', priced.length > 1 ? 'De menor a mayor precio. Deslizá para ver todos.' : ''));
    const carousel = el('div', 'carousel');
    const status = el('p', 'status');
    priced.forEach((product, index) => {
        const store = storeOf(data, product.store);
        const card = el('article', 'card');
        card.style.setProperty('--store', store.color);
        card.append(el('span', 'store', store.name));
        if (index === 0 && priced.length > 1) card.append(el('span', 'best', 'Más barato'));
        card.append(picture(product.image_url), el('p', 'name', product.name), el('p', 'brand', product.brand || ''));
        const price = el('p', 'price', pesos(product.price_cents) + ' ');
        if (product.list_price_cents) price.append(el('s', '', pesos(product.list_price_cents)));
        card.append(price);
        const add = el('button', '', 'Agregar al carrito');
        add.addEventListener('click', async () => {
            add.disabled = true;
            try {
                const cart = await callTool('add_to_cart', {
                    cart_id: cartId, store: product.store, name: product.name, brand: product.brand, ean: product.ean,
                    price_cents: product.price_cents, image_url: product.image_url, url: product.url, quantity: 1
                });
                if (cart && cart.cart_id) cartId = cart.cart_id;
                add.textContent = 'Agregado';
                status.textContent = cart ? cart.item_count + ' en el carrito · ' + pesos(cart.total_cents) : '';
            } catch (error) {
                add.disabled = false;
                status.textContent = 'No se pudo agregar: ' + error.message;
            }
        });
        card.append(add);
        carousel.append(card);
    });
    root.append(carousel, status);
}

function renderCart(cart) {
    root.replaceChildren();
    const panel = el('section', 'panel');
    panel.append(el('h1', '', 'Tu carrito'));
    if (cart.items.length === 0) {
        panel.append(el('p', 'muted', 'Todavía no agregaste productos.'));
        root.append(panel);
        return;
    }
    panel.append(el('p', 'muted', cart.item_count + ' productos'));
    const colors = Object.fromEntries(cart.by_store.map(store => [store.store, store]));
    for (const item of cart.items) {
        const row = el('div', 'row');
        const info = el('div', 'info');
        info.append(el('div', 'title', item.name));
        const meta = el('div', 'muted');
        const dot = el('span', 'dot');
        dot.style.setProperty('--store', (colors[item.store] || {}).color || '#555555');
        meta.append(dot, (colors[item.store] || {}).name + ' · ' + item.quantity + ' × ' + pesos(item.price_cents) + ' · ');
        const remove = el('button', 'link', 'Quitar');
        remove.addEventListener('click', async () => {
            remove.disabled = true;
            try { renderCart(await callTool('remove_from_cart', { cart_id: cart.cart_id, item_id: item.item_id })); } catch { remove.disabled = false; }
        });
        meta.append(remove);
        info.append(meta);
        row.append(picture(item.image_url), info, el('div', 'amount', pesos(item.line_total_cents)));
        panel.append(row);
    }
    const totals = el('ul', 'totals');
    for (const store of cart.by_store) {
        const line = el('li');
        line.append(el('span', '', store.name), el('span', '', pesos(store.subtotal_cents)));
        totals.append(line);
    }
    const total = el('li', 'total');
    total.append(el('span', '', 'Total'), el('span', '', pesos(cart.total_cents)));
    totals.append(total);
    panel.append(totals);
    const actions = el('div', 'actions');
    const buy = el('button', 'primary', 'Comprar');
    const status = el('p', 'status');
    buy.addEventListener('click', async () => {
        buy.disabled = true;
        try {
            await request('ui/message', { role: 'user', content: { type: 'text', text: 'Sí, confirmo la compra del carrito ' + cart.cart_id + '.' } });
            status.textContent = 'Confirmación enviada.';
        } catch {
            buy.disabled = false;
            status.textContent = 'Escribí "confirmo la compra" en el chat para continuar.';
        }
    });
    actions.append(buy);
    panel.append(actions, status);
    root.append(panel);
}

function renderOrder(order) {
    root.replaceChildren();
    const panel = el('section', 'panel');
    panel.append(el('p', 'paid', 'Pedido confirmado'), el('h1', '', 'Pedido ' + order.order_id));
    panel.append(el('p', 'muted', order.item_count + ' productos · ' + pesos(order.total_cents)));
    panel.append(el('p', 'muted', 'Demo: el pago es simulado, no se cobró nada.'));
    root.append(panel);
}

new ResizeObserver(() => {
    notify('ui/notifications/size-changed', { width: document.documentElement.scrollWidth, height: Math.ceil(document.body.getBoundingClientRect().height) });
}).observe(document.body);

request('ui/initialize', {
    protocolVersion: '2026-01-26',
    appInfo: { name: 'qillay', version: '0.3.0' },
    appCapabilities: { availableDisplayModes: ['inline'] }
}).then(result => {
    applyContext(result && result.hostContext);
    notify('ui/notifications/initialized', {});
}).catch(() => {});
`;

export const APP_HTML = `<!doctype html>
<html lang="es-AR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Qillay</title>
<style>${STYLE}</style>
</head>
<body>
<div id="root"><p class="muted">Cargando…</p></div>
<script>${SCRIPT}</script>
</body>
</html>`;
