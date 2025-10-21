const USE_PROXY = (import.meta.env.VITE_USE_PROXY ?? '1') !== '0';
const DIRECT_BASE = (import.meta.env.VITE_GAS_URL as string | undefined) || '';
const BASE = USE_PROXY ? '/api/gas' : DIRECT_BASE;

function ensureBase(): string {
  if (!BASE) {
    throw new Error('GAS endpoint is not configured');
  }
  return BASE;
}

// "YYYY-MM" 形式の文字列を返す
export function formatMonth(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

async function get<T>(params: Record<string, string>): Promise<T> {
  const base = ensureBase();
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${base}${qs ? `?${qs}` : ''}`, { method: 'GET' });
  const json = await res.json();
  if (!json.ok) {
    throw new Error(json.error || 'GAS error');
  }
  return json as T;
}

async function post<T>(params: Record<string, string>, body: unknown): Promise<T> {
  const base = ensureBase();
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${base}${qs ? `?${qs}` : ''}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  const json = await res.json();
  if (!json.ok) {
    throw new Error(json.error || 'GAS error');
  }
  return json as T;
}

export type ListItem = {
  date: string | Date;
  type: 'intake' | 'inventory';
  ticketId: string;
  species?: string;
  factory?: string;
  status?: string;
};

export async function fetchList(month: string) {
  return get<{ ok: true; items: ListItem[] }>({ action: 'list', month });
}

export async function recordToSheet(payload: unknown, type: 'intake' | 'inventory') {
  return post<{ ok: true; result: unknown }>({ action: 'record', type }, payload);
}

export async function uploadB64(payload: {
  ticketId?: string;
  fileName?: string;
  contentB64: string;
  mimeType?: string;
  apiKey?: string;
}) {
  return post<{ ok: true; result: unknown }>({ action: 'uploadB64' }, payload);
}

export async function fetchTicket(id: string) {
  return get<{ ok: true; item: Record<string, string> | null }>({ action: 'ticket', id });
}
