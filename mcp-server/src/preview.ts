// GET /preview: a minimal MCP Apps host for the view, to try it in a browser without an AI client.
// It plays the host side of the postMessage protocol and forwards tool calls to this server's /mcp.

const SCRIPT = `
const frame = document.getElementById('app');
const log = document.getElementById('log');
let cartId = null;
let rpcId = 1;

async function mcp(name, args) {
    const response = await fetch('/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
        body: JSON.stringify({ jsonrpc: '2.0', id: rpcId++, method: 'tools/call', params: { name, arguments: args } })
    });
    const text = await response.text();
    const line = text.split('\\n').find(part => part.startsWith('data: '));
    const message = JSON.parse(line ? line.slice(6) : text);
    if (message.error) throw new Error(message.error.message);
    const data = message.result.structuredContent;
    if (data && data.cart_id) cartId = data.cart_id;
    return message.result;
}
function send(message) { frame.contentWindow.postMessage(message, '*'); }
function showResult(result) { send({ jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: result }); }
function say(text) { log.textContent = text; }

window.addEventListener('message', async event => {
    if (event.source !== frame.contentWindow) return;
    const message = event.data;
    if (!message || message.jsonrpc !== '2.0') return;
    const reply = result => send({ jsonrpc: '2.0', id: message.id, result });
    try {
        if (message.method === 'ui/initialize') {
            reply({ protocolVersion: '2026-01-26', hostInfo: { name: 'qillay-preview', version: '0' }, hostCapabilities: {}, hostContext: {} });
        } else if (message.method === 'ui/notifications/initialized') {
            search();
        } else if (message.method === 'ui/notifications/size-changed') {
            frame.style.height = Math.max(120, message.params.height) + 'px';
        } else if (message.method === 'tools/call') {
            reply(await mcp(message.params.name, message.params.arguments));
        } else if (message.method === 'ui/message') {
            reply({});
            say('El usuario dijo: ' + message.params.content.text);
            showResult(await mcp('create_order', { cart_id: cartId, confirmed: true }));
        } else if (message.id !== undefined) {
            reply({});
        }
    } catch (error) {
        if (message.id !== undefined) send({ jsonrpc: '2.0', id: message.id, error: { code: -32000, message: error.message } });
        say('Error: ' + error.message);
    }
});

async function search() {
    const q = document.getElementById('q').value.trim();
    if (!q) return;
    say('Buscando…');
    showResult(await mcp('search_products', { q, limit: 3, cart_id: cartId || undefined }));
    say('');
}
document.getElementById('form').addEventListener('submit', event => { event.preventDefault(); search(); });
document.getElementById('cart').addEventListener('click', async () => {
    if (!cartId) return say('Primero buscá un producto.');
    showResult(await mcp('view_cart', { cart_id: cartId }));
});
`;

const HTML = `<!doctype html>
<html lang="es-AR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Qillay · vista previa</title>
<style>
:root { color-scheme: light dark; }
body { max-width: 900px; margin: 0 auto; padding: 20px 16px; font: 15px/1.4 system-ui, sans-serif; }
form { display: flex; gap: 8px; margin: 12px 0; }
input { flex: 1; padding: 9px 12px; font: inherit; border: 1px solid #8884; border-radius: 8px; }
button { padding: 9px 14px; font: inherit; border: 1px solid #8886; border-radius: 8px; background: transparent; color: inherit; cursor: pointer; }
iframe { width: 100%; height: 420px; border: 1px dashed #8886; border-radius: 12px; }
p { margin: 6px 0; color: #888; font-size: 0.85rem; }
</style>
</head>
<body>
<h1>Qillay · vista previa del componente</h1>
<p>Simula un cliente con MCP Apps. El recuadro punteado es lo que el cliente mostraría dentro del chat.</p>
<form id="form"><input id="q" value="coca cola 2.25l" aria-label="Producto"><button>Buscar</button><button type="button" id="cart">Ver carrito</button></form>
<p id="log"></p>
<iframe id="app" src="/app.html" sandbox="allow-scripts" title="Componente Qillay"></iframe>
<script>${SCRIPT}</script>
</body>
</html>`;

export function previewPage(): Response {
    return new Response(HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
