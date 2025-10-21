type VercelRequest = {
  method?: string;
  query?: Record<string, string | string[]>;
  body?: unknown;
};

type VercelResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): VercelResponse;
  json(body: unknown): void;
  end(): void;
  type(contentType: string): VercelResponse;
  send(body: string): void;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const GAS = process.env.GAS_URL;
  if (!GAS) {
    res.status(500).json({ ok: false, error: 'GAS_URL not set' });
    return;
  }

  const query = req.query ?? {};
  const searchParams = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((v) => searchParams.append(key, String(v)));
    } else if (value != null) {
      searchParams.append(key, String(value));
    }
  });

  const qs = searchParams.toString();
  const url = `${GAS}${qs ? `?${qs}` : ''}`;

  try {
    const upstream = await fetch(url, {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      body:
        req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS'
          ? undefined
          : JSON.stringify(req.body ?? {}),
    });

    const text = await upstream.text();
    res.status(upstream.status).type('application/json').send(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(502).json({ ok: false, error: 'proxy_error', detail: message });
  }
}
