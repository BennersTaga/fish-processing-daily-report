import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchMaster, Master } from '../lib/api';

const STORAGE_KEY = 'fish-processing/master-options';
const STORAGE_TS_KEY = 'fish-processing/master-fetched-at';
const CACHE_TTL_MS = 1000 * 60 * 10; // 10 minutes

type Status = 'idle' | 'loading' | 'success' | 'error';

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
      const data = await fetchMaster();
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
