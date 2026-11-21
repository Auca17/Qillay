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
.mousekey { display: flex; gap: 12px; align-items: center; margin-top: 12px; padding: 10px 12px; border: 2px solid var(--line); border-radius: 12px; }
.mousekey.wait { border-color: #f2b31b; }
.mousekey.ok { border-color: #2f8a4c; }
.mousekey.no { border-color: #c0392b; }
.mousekey .mk-text { flex: 1; min-width: 0; }
.mk-cat svg { width: 76px; height: 76px; display: block; }
.mk-meter { height: 10px; margin-top: 8px; border-radius: 999px; background: var(--line); overflow: hidden; }
.mk-meter i { display: block; height: 100%; width: 0; background: #f2b31b; transition: width .12s ease-out; }
.mk-cat .mk-happy, .mk-cat .mk-sad { display: none; }
.mk-cat.happy .mk-open, .mk-cat.sad .mk-open, .mk-cat.happy .mk-idle, .mk-cat.sad .mk-idle { display: none; }
.mk-cat.happy .mk-happy, .mk-cat.sad .mk-sad { display: inline; }
.mk-cat.happy svg { animation: mk-hop .45s ease-out 2; }
@keyframes mk-hop { 0%, 100% { transform: translateY(0); } 40% { transform: translateY(-6px); } }
@media (prefers-reduced-motion: reduce) { .mk-cat.happy svg { animation: none; } }
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
let hostOrigin = null;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function setCart(id) { if (typeof id === 'string' && UUID.test(id)) cartId = id; }

function post(message) { window.parent.postMessage(message, '*'); }
function request(method, params) {
    const id = nextId++;
    post({ jsonrpc: '2.0', id, method, params });
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
function notify(method, params) { post({ jsonrpc: '2.0', method, params }); }

window.addEventListener('message', event => {
    // Only the embedding host may talk to the view, and only from the origin it first used.
    if (event.source !== window.parent) return;
    if (hostOrigin === null) hostOrigin = event.origin;
    else if (event.origin !== hostOrigin) return;
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
    setCart(data.cart_id);
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
        if (index === 0 && priced.length > 1) card.append(el('span', 'best', 'Menor precio'));
        card.append(picture(product.image_url), el('p', 'name', product.name), el('p', 'brand', product.brand || ''));
        const price = el('p', 'price', pesos(product.price_cents) + ' ');
        if (product.list_price_cents) price.append(el('s', '', pesos(product.list_price_cents)));
        card.append(price);
        const add = el('button', '', 'Agregar al carrito');
        add.addEventListener('click', async () => {
            add.disabled = true;
            try {
                const cart = await callTool('add_to_cart', {
                    cart_id: cartId,
                    items: [{
                        store: product.store, name: product.name, brand: product.brand, ean: product.ean,
                        price_cents: product.price_cents, image_url: product.image_url, url: product.url, quantity: 1
                    }]
                });
                if (cart) setCart(cart.cart_id);
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
            try { renderCart(await callTool('remove_from_cart', { cart_id: cartId, item_id: item.item_id })); } catch { remove.disabled = false; }
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
    async function confirmPurchase() {
        try {
            await request('ui/message', { role: 'user', content: { type: 'text', text: 'Sí, confirmo la compra del carrito ' + cartId + '.' } });
            status.textContent = 'Confirmación enviada.';
        } catch {
            buy.disabled = false;
            status.textContent = 'Escribí "confirmo la compra" en el chat para continuar.';
        }
    }
    // MouseKey: Comprar stays disabled until Cuyano sees a real mouse being shaken.
    buy.addEventListener("click", () => {
        if (buy.disabled) return;
        mouseKeyPassed = true;
        buy.disabled = true;
        confirmPurchase();
    });
    actions.append(buy);
    panel.append(actions, status);
    root.append(panel);
    if (!mouseKeyPassed) armMouseKey(panel, buy);
}

const CUYANO = '<svg viewBox="50 16 120 122" aria-hidden="true">'
    + '<path d="M66 70 60 24l38 24z" fill="#e9a23b" stroke="#6f4a22" stroke-width="2.5" stroke-linejoin="round"/><path d="M69 58 66 36l18 12z" fill="#e88b7a"/>'
    + '<path d="M154 70l6-46-38 24z" fill="#e9a23b" stroke="#6f4a22" stroke-width="2.5" stroke-linejoin="round"/><path d="m151 58 3-22-18 12z" fill="#e88b7a"/>'
    + '<ellipse cx="110" cy="84" rx="54" ry="46" fill="#e9a23b" stroke="#6f4a22" stroke-width="2.5"/>'
    + '<path d="M98 42c2 8 2 14 0 20M110 40v22M122 42c-2 8-2 14 0 20" stroke="#b86b1f" stroke-width="3.5" stroke-linecap="round" fill="none"/>'
    + '<ellipse cx="110" cy="104" rx="26" ry="18" fill="#f6e3bf"/>'
    + '<g class="mk-open"><ellipse cx="88" cy="82" rx="12" ry="13" fill="#fff" stroke="#6f4a22" stroke-width="2"/><ellipse cx="132" cy="82" rx="12" ry="13" fill="#fff" stroke="#6f4a22" stroke-width="2"/>'
    + '<g class="mk-pupils"><ellipse cx="88" cy="83" rx="5" ry="7.5" fill="#1b1e2b"/><ellipse cx="132" cy="83" rx="5" ry="7.5" fill="#1b1e2b"/></g></g>'
    + '<g class="mk-happy" fill="none" stroke="#1b1e2b" stroke-width="3.5" stroke-linecap="round"><path d="M77 84c5-8 17-8 22 0M121 84c5-8 17-8 22 0"/></g>'
    + '<g class="mk-sad"><circle cx="88" cy="88" r="5" fill="#1b1e2b"/><circle cx="132" cy="88" r="5" fill="#1b1e2b"/><path d="M75 76l24 6M145 76l-24 6" stroke="#6f4a22" stroke-width="3" stroke-linecap="round"/></g>'
    + '<path d="M104 97h12l-6 7z" fill="#d96a5a" stroke="#6f4a22" stroke-width="1.5" stroke-linejoin="round"/>'
    + '<path class="mk-idle" d="M110 104c0 6-6 9-11 7M110 104c0 6 6 9 11 7" fill="none" stroke="#6f4a22" stroke-width="2.2" stroke-linecap="round"/>'
    + '<path class="mk-happy" d="M97 106c4 10 22 10 26 0z" fill="#b5413a" stroke="#6f4a22" stroke-width="2" stroke-linejoin="round"/>'
    + '<path class="mk-sad" d="M100 114c5-6 15-6 20 0" fill="none" stroke="#6f4a22" stroke-width="2.5" stroke-linecap="round"/>'
    + '<path d="M80 102 56 98M80 108l-24 4M140 102l24-4M140 108l24 4" stroke="#6f4a22" stroke-width="1.6" stroke-linecap="round"/>'
    + '</svg>';

const MOUSEKEY_SHAKES = 10;

function mouseKeyBox(panel) {
    let box = panel.querySelector('.mousekey');
    if (!box) {
        box = el('div', 'mousekey');
        const cat = el('div', 'mk-cat');
        cat.innerHTML = CUYANO; // constant markup, no user data
        const text = el('div', 'mk-text');
        text.append(el('div', 'title'), el('div', 'muted'));
        const meter = el('div', 'mk-meter');
        meter.append(el('i'));
        text.append(meter);
        box.append(cat, text);
        // Above the confirm button: shake first, then confirm.
        const actions = panel.querySelector(".actions");
        if (actions) panel.insertBefore(box, actions);
        else panel.append(box);
    }
    return box;
}

// MouseKey: the confirm button stays disabled until Cuyano sees a real mouse being shaken.
// One listener at a time: a re-render (for example after "Quitar") replaces the previous one.
let activeMouseKey = null;

function armMouseKey(panel, button, onReady) {
    if (activeMouseKey) document.removeEventListener('pointermove', activeMouseKey);
    activeMouseKey = null;
    const box = mouseKeyBox(panel);
    const cat = box.querySelector('.mk-cat');
    const [title, hint] = box.querySelectorAll('.mk-text > div');
    const meter = box.querySelector('.mk-meter');
    const fill = meter.querySelector('i');
    const pupils = cat.querySelector('.mk-pupils');
    const set = (state, head, body) => {
        box.className = 'mousekey ' + state;
        cat.className = 'mk-cat ' + (state === 'ok' ? 'happy' : state === 'no' ? 'sad' : '');
        title.textContent = head;
        hint.textContent = body;
        meter.style.display = state === 'wait' ? '' : 'none';
    };
    button.disabled = true;
    fill.style.width = '0%';

    if (!window.matchMedia('(any-pointer: fine)').matches) {
        set('no', 'Sin mouse no hay pago', 'Cuyano no ve ningún mouse en este dispositivo. Abrí el link en una compu con mouse.');
        return;
    }
    set('wait', 'Sacudí el mouse', 'Movelo de un lado a otro sobre este recuadro. Cuando Cuyano lo vea, se habilita el botón.');

    let flips = 0;
    let lastSign = 0;
    let lastX = null;
    function onMove(move) {
        if (move.pointerType !== 'mouse') return;
        const r = box.getBoundingClientRect();
        if (pupils) {
            const px = Math.max(-5, Math.min(5, (move.clientX - r.left - 40) / 30));
            const py = Math.max(-4, Math.min(4, (move.clientY - r.top - 40) / 30));
            pupils.setAttribute('transform', 'translate(' + px + ' ' + py + ')');
        }
        // Delta from clientX: movementX is 0 for some synthetic and remote-desktop events.
        const dx = lastX === null ? 0 : move.clientX - lastX;
        lastX = move.clientX;
        if (Math.abs(dx) < 4) return;
        const sign = Math.sign(dx);
        if (sign !== lastSign) {
            if (lastSign !== 0) flips++;
            lastSign = sign;
        }
        fill.style.width = Math.min(100, Math.round((flips / MOUSEKEY_SHAKES) * 100)) + '%';
        if (flips >= MOUSEKEY_SHAKES) {
            document.removeEventListener('pointermove', onMove);
            activeMouseKey = null;
            if (pupils) pupils.removeAttribute('transform');
            set('ok', 'Mouse verificado', 'Cuyano está contento. Ya podés confirmar.');
            button.disabled = false;
            if (onReady) onReady();
        }
    }
    activeMouseKey = onMove;
    document.addEventListener('pointermove', onMove);
}

// The cart link opens on the order when the chat already bought it: the user confirms it here.
// Once MouseKey passed in this view, it is not asked again.
let mouseKeyPassed = false;

function renderOrder(order) {
    if (mouseKeyPassed) return renderOrderContent(order);
    root.replaceChildren();
    const panel = el('section', 'panel');
    panel.append(el('h1', '', 'Confirmá tu pago'));
    panel.append(el('p', 'muted', 'Pedido ' + order.order_id + ' · ' + order.item_count + ' productos · ' + pesos(order.total_cents)));
    const actions = el('div', 'actions');
    const confirm = el('button', 'primary', 'Confirmar pago de ' + pesos(order.total_cents));
    confirm.addEventListener('click', () => {
        if (confirm.disabled) return;
        mouseKeyPassed = true;
        renderOrderContent(order);
    });
    actions.append(confirm);
    panel.append(actions);
    root.append(panel);
    armMouseKey(panel, confirm);
}

function renderOrderContent(order) {
    root.replaceChildren();
    const panel = el('section', 'panel');
    panel.append(el('p', 'paid', 'Pedido confirmado'), el('h1', '', 'Pedido ' + order.order_id));
    panel.append(el('p', 'muted', order.item_count + ' productos · Pago aprobado'));
    const stores = Object.fromEntries((order.by_store || []).map(store => [store.store, store]));
    for (const item of order.items || []) {
        const row = el('div', 'row');
        const info = el('div', 'info');
        info.append(el('div', 'title', item.name));
        const meta = el('div', 'muted');
        const dot = el('span', 'dot');
        dot.style.setProperty('--store', (stores[item.store] || {}).color || '#555555');
        meta.append(dot, ((stores[item.store] || {}).name || item.store) + ' · ' + item.quantity + ' × ' + pesos(item.price_cents));
        info.append(meta);
        row.append(picture(item.image_url), info, el('div', 'amount', pesos(item.line_total_cents)));
        panel.append(row);
    }
    const totals = el('ul', 'totals');
    for (const store of order.by_store || []) {
        const line = el('li');
        line.append(el('span', '', store.name), el('span', '', pesos(store.subtotal_cents)));
        totals.append(line);
    }
    const total = el('li', 'total');
    total.append(el('span', '', 'Total pagado'), el('span', '', pesos(order.total_cents)));
    totals.append(total);
    panel.append(totals);
    panel.append(el('p', 'muted', 'Te avisamos cuando esté listo para retirar.'));
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
