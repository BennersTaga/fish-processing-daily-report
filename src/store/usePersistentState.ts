import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useState } from 'react';

export function usePersistentState<T>(key: string, defaultValue: T): [T, Dispatch<SetStateAction<T>>, () => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return defaultValue;
      return JSON.parse(raw) as T;
    } catch (err) {
      console.error(err);
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (err) {
      console.error(err);
    }
  }, [key, state]);

  const reset = useCallback(() => {
    setState(defaultValue);
    localStorage.removeItem(key);
  }, [defaultValue, key]);

  return useMemo(() => [state, setState, reset] as [T, Dispatch<SetStateAction<T>>, () => void], [state, reset]);
}
