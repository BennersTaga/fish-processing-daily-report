const GAS = import.meta.env.VITE_GAS_URL as string;

function withOrigin(params: Record<string, string>) {
  if (typeof window === 'undefined') {
    return params;
  }
  return { ...params, origin: window.location.origin };
}

async function req<T>(method: 'GET' | 'POST', params: Record<string, string>, body?: unknown): Promise<T> {
  if (!GAS) {
    throw new Error('VITE_GAS_URL is not configured');
  }
  const qs = new URLSearchParams(withOrigin(params)).toString();
  const res = await fetch(`${GAS}?${qs}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
    credentials: 'omit',
  });
  const json = await res.json();
  if (!json.ok) {
    throw new Error(json.error || 'GAS error');
  }
  return json as T;
}

export function recordToSheet(payload: unknown, type: 'intake' | 'inventory') {
  return req<{ ok: true; result: unknown }>('POST', { action: 'record', type }, payload);
}

export function uploadB64(payload: {
  ticketId?: string;
  fileName?: string;
  contentB64: string;
  mimeType?: string;
  apiKey?: string;
}) {
  return req<{ ok: true; result: unknown }>('POST', { action: 'uploadB64' }, payload);
}

export function fetchList(month: string) {
  return req<{ ok: true; items: any[] }>('GET', { action: 'list', month });
}

export function fetchTicket(id: string) {
  return req<{ ok: true; item: any }>('GET', { action: 'ticket', id });
}
