import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage, type RequestOptions } from '@/lib/api';
import { adminApi } from '@/lib/adminApi';
import type { ApiState } from './useApi';

/** Admin-portal counterpart of useApi — same ergonomics, sends the admin session token. */
export function useAdminApi<T>(path: string | null, query?: RequestOptions['query']): ApiState<T> {
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
      const res = await adminApi<T>(path, { query: queryRef.current });
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
