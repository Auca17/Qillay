import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

import { errorMessage } from './http';
import { comparePrice, listBranches } from './precios-claros';
import { DEFAULT_SOURCES, searchProducts, SOURCE_IDS } from './sources';

function ok(result: unknown) {
    return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
}

// Run a single-source tool; an upstream failure becomes a tool error instead of a crash.
async function precioClaros(run: () => Promise<unknown>) {
    try {
        return ok(await run());
    } catch (error) {
        return { ...ok({ fuente: 'precios_claros', error: errorMessage(error) }), isError: true };
    }
}

// The factory runs once per request, so keep no state on the server instance.
const handler = createMcpHandler(() => {
    const server = new McpServer({ name: 'qillay', version: '0.1.0' });

    server.registerTool(
        'listar_sucursales',
        {
            description:
                'Lista sucursales de supermercados de Precios Claros (Argentina) cercanas a un punto, ordenadas por distancia. Los ids sirven para buscar_producto (fuente precios_claros) y comparar_precio.',
            inputSchema: z.object({
                lat: z.number().min(-90).max(90).describe('Latitud del punto, en grados decimales (ej. -32.89).'),
                lng: z.number().min(-180).max(180).describe('Longitud del punto, en grados decimales (ej. -68.84).'),
                limit: z.number().int().min(1).max(30).default(20).describe('Cantidad máxima de sucursales (máximo 30).')
            })
        },
        async ({ lat, lng, limit }) => precioClaros(async () => ({ sucursales: await listBranches(lat, lng, limit) }))
    );

    server.registerTool(
        'buscar_producto',
        {
            description:
                'Busca un producto por texto en supermercados de Argentina y devuelve precios en pesos (ARS) de todas las fuentes pedidas, ordenados de menor a mayor. Las fuentes que fallan se informan en "errores" sin afectar al resto.',
            inputSchema: z.object({
                q: z.string().trim().min(1).describe('Texto a buscar, por ejemplo "leche entera 1l".'),
                fuentes: z
                    .array(z.enum(SOURCE_IDS))
                    .min(1)
                    .optional()
                    .describe(
                        `Fuentes a consultar. Por defecto: ${DEFAULT_SOURCES.join(', ')}. "precios_claros" requiere "sucursales"; "carrefour" suele rechazar consultas automáticas.`
                    ),
                sucursales: z
                    .string()
                    .optional()
                    .describe('Ids de sucursales de Precios Claros separados por coma (de listar_sucursales). Solo para la fuente precios_claros.'),
                limite: z.number().int().min(1).max(20).default(5).describe('Cantidad máxima de productos por fuente (máximo 20).')
            })
        },
        async ({ q, fuentes, sucursales, limite }) =>
            ok(await searchProducts(q, fuentes ?? DEFAULT_SOURCES, { limit: limite, sucursales }))
    );

    server.registerTool(
        'comparar_precio',
        {
            description:
                'Compara el precio de un producto (por código EAN) entre sucursales de Precios Claros, ordenado de menor a mayor precio.',
            inputSchema: z.object({
                ean: z.string().trim().min(1).describe('Código de barras EAN del producto (campo "ean" de buscar_producto).'),
                sucursales: z
                    .string()
                    .trim()
                    .min(1)
                    .describe('Ids de sucursales de Precios Claros separados por coma (de listar_sucursales).')
            })
        },
        async ({ ean, sucursales }) => precioClaros(() => comparePrice(ean, sucursales))
    );

    return server;
});

export default handler;
