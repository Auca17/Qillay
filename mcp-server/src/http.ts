const HEADERS = { Accept: 'application/json', 'User-Agent': 'hackaton-mcp-canasta/0.1' };
const TIMEOUT_MS = 8000;

export type Json = Record<string, unknown>;

// GET a JSON document; a non-2xx status, a non-JSON body or a timeout throws.
export async function fetchJson(url: string): Promise<unknown> {
    const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) {
        await response.body?.cancel();
        throw new Error(`HTTP ${response.status}`);
    }
    try {
        return await response.json();
    } catch (error) {
        if (isTimeout(error)) throw error;
        throw new Error('response is not JSON');
    }
}

function isTimeout(error: unknown): boolean {
    return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
}

export function errorMessage(error: unknown): string {
    if (isTimeout(error)) return `no response in ${TIMEOUT_MS / 1000} s`;
    return error instanceof Error ? error.message : String(error);
}

// Upstream payloads are untyped, so every field is read through these guards.
export function isRecord(value: unknown): value is Json {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function records(value: unknown): Json[] {
    return Array.isArray(value) ? value.filter(isRecord) : [];
}

// A non-empty trimmed string, or undefined.
export function text(value: unknown): string | undefined {
    if (typeof value === 'number') return String(value);
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
}

// A positive amount (number or numeric string), or undefined; stores report 0 for "no price".
export function amount(value: unknown): number | undefined {
    const parsed = typeof value === 'string' ? Number(value) : value;
    return typeof parsed === 'number' && Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
