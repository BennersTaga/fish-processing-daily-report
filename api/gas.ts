import type { VercelRequest, VercelResponse } from '@vercel/node';
export const config = { runtime: 'nodejs18.x' };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const GAS = process.env.GAS_URL?.trim();
  if (!GAS) return res.status(500).json({ ok: false, error: 'GAS_URL not set' });

  const qs = new URLSearchParams((req.query as Record<string, string>) || {}).toString();
  const url = `${GAS}${qs ? `?${qs}` : ''}`;

  const init: RequestInit =
    req.method === 'GET' || req.method === 'HEAD'
      ? { method: 'GET' }
      : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req.body ?? {}) };

  try {
    const upstream = await fetch(url, init);
    const text = await upstream.text();

    if (!upstream.ok) {
      return res.status(502).json({ ok: false, error: 'upstream_http_error', status: upstream.status, url, body: text.slice(0,500) });
    }

    try { // JSONならそのまま返す
      return res.status(200).json(JSON.parse(text));
    } catch {
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).send(text); // ← .type(...) は使わない
    }
  } catch (e: any) {
    return res.status(502).json({ ok: false, error: 'proxy_error', detail: e?.message || String(e) });
  }
}
