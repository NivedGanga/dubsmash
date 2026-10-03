import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorMessage, type RequestOptions } from '@/lib/api';

export interface ApiState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => Promise<void>;
  setData: (updater: T | null | ((prev: T | null) => T | null)) => void;
}

/** Fetch JSON from the API on mount / when path or query change. Pass null to skip. */
export function useApi<T>(path: string | null, query?: RequestOptions['query']): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);
  const key = path ? `${path}?${JSON.stringify(query ?? {})}` : null;
  const queryRef = useRef(query);
  queryRef.current = query;
  const reqId = useRef(0);

  const reload = useCallback(async () => {
    if (!path) return;
    const id = ++reqId.current;
    setLoading(true);
    try {
      const res = await api<T>(path, { query: queryRef.current });
      if (id === reqId.current) {
        setData(res);
        setError(null);
      }
    } catch (err) {
      if (id === reqId.current) setError(errorMessage(err));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, loading, reload, setData };
}
