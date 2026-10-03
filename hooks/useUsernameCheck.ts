import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { isValidUsername } from '@/lib/utils';

export interface UsernameCheck {
  state: 'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'error';
  message: string;
}

/** Debounced real-time username availability check. `current` is treated as available (unchanged). */
export function useUsernameCheck(username: string, current?: string): UsernameCheck {
  const [result, setResult] = useState<UsernameCheck>({ state: 'idle', message: '' });

  useEffect(() => {
    const name = username.trim();
    if (!name || (current && name.toLowerCase() === current.toLowerCase())) {
      setResult({ state: 'idle', message: '' });
      return;
    }
    if (!isValidUsername(name)) {
      setResult({ state: 'invalid', message: '3-20 characters: letters, numbers and underscores.' });
      return;
    }
    setResult({ state: 'checking', message: 'Checking…' });
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await api<{ available: boolean; message: string }>(`/api/users/check-username/${encodeURIComponent(name)}`, { signal: ctrl.signal });
        setResult({ state: res.available ? 'available' : 'taken', message: res.message });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setResult({ state: 'error', message: 'Could not check username.' });
      }
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [username, current]);

  return result;
}

export const usernameHintColor: Record<UsernameCheck['state'], string> = {
  idle: 'text-ink-400',
  checking: 'text-ink-200',
  available: 'text-green-400',
  taken: 'text-red-400',
  invalid: 'text-red-400',
  error: 'text-yellow-400',
};
