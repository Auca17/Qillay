import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

// The factory runs once per request, so keep no state on the server instance.
const handler = createMcpHandler(() => {
    const server = new McpServer({ name: 'qillay', version: '0.1.0' });

    server.registerTool(
        'ping',
        {
            description: 'Check that the Qillay MCP server is reachable. Returns the message it was given.',
            inputSchema: z.object({
                message: z.string().describe('Any text to send back.')
            })
        },
        async ({ message }) => ({
            content: [{ type: 'text', text: `pong: ${message}` }]
        })
    );

    return server;
});

export default handler;
