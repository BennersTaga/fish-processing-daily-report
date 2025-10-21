import { useCallback, useEffect, useMemo, useState } from 'react';
import { Master } from '../types';

const STORAGE_KEY = 'fish-processing/master-options';
const STORAGE_TS_KEY = 'fish-processing/master-fetched-at';
const CACHE_TTL_MS = 1000 * 60 * 10; // 10 minutes
const MASTER_CSV_URL = import.meta.env.VITE_MASTER_CSV_URL as string | undefined;

type Status = 'idle' | 'loading' | 'success' | 'error';

function parseMasterCsv(text: string): Master {
  const rows = text
    .split(/\r?\n/)
    .map((r) => r.split(',').map((c) => c.trim()))
    .filter((r) => r.length > 0 && r.some((c) => c.length > 0));
  if (rows.length < 2) return {};
  const ids = rows[1];
  const master: Master = {};
  for (let c = 0; c < ids.length; c += 1) {
    const id = ids[c];
    if (!id) continue;
    const items: string[] = [];
    for (let r = 2; r < rows.length; r += 1) {
      const value = rows[r]?.[c];
      if (value) items.push(value);
    }
    master[id] = items;
  }
  return master;
}

async function fetchMasterFromCsv(): Promise<Master> {
  if (!MASTER_CSV_URL) {
    throw new Error('VITE_MASTER_CSV_URL is not configured');
  }
  const res = await fetch(MASTER_CSV_URL);
  if (!res.ok) {
    throw new Error('master fetch failed');
  }
  const text = await res.text();
  return parseMasterCsv(text);
}

export function useMasterOptions() {
  const [master, setMaster] = useState<Master>({});
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  const loadFromStorage = useCallback(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const ts = Number(localStorage.getItem(STORAGE_TS_KEY) || '0');
      if (!raw) return false;
      if (Date.now() - ts > CACHE_TTL_MS) return false;
      const parsed = JSON.parse(raw) as Master;
      setMaster(parsed);
      setStatus('success');
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  }, []);

  const persist = useCallback((data: Master) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem(STORAGE_TS_KEY, String(Date.now()));
  }, []);

  const reload = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const data = await fetchMasterFromCsv();
      setMaster(data);
      persist(data);
      setStatus('success');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'unknown error');
      setStatus('error');
    }
  }, [persist]);

  useEffect(() => {
    const ok = loadFromStorage();
    if (!ok) {
      void reload();
    }
  }, [loadFromStorage, reload]);

  return useMemo(
    () => ({
      master,
      status,
      error,
      reload,
    }),
    [master, status, error, reload],
  );
}
