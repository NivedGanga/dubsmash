import { create } from 'zustand';
import type { MeResponse } from '@/types/api';

export type SessionStatus = 'loading' | 'unconfigured' | 'signed_out' | 'needs_profile' | 'ready' | 'error';

interface SessionState {
  status: SessionStatus;
  me: MeResponse | null;
  error: string | null;
  onlineUserIds: Set<string>;
  set: (patch: Partial<Omit<SessionState, 'set'>>) => void;
}

/** Global auth/session state, populated by components/Common/SessionProvider. */
export const useSession = create<SessionState>((set) => ({
  status: 'loading',
  me: null,
  error: null,
  onlineUserIds: new Set(),
  set: (patch) => set(patch),
}));
