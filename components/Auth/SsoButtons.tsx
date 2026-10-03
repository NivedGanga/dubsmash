import { useState } from 'react';
import { authErrorMessage, enabledSsoProviders, loginWithProvider, type SsoProvider } from '@/lib/auth';
import { setPortal, type Portal } from '@/lib/portal';

const labels: Record<SsoProvider, string> = { google: 'Google', github: 'GitHub', discord: 'Discord' };

/** SSO buttons. After the popup succeeds, SessionProvider picks up the Firebase user automatically. */
export function SsoButtons({ onError, portal }: { onError: (msg: string) => void; portal?: Portal }) {
  const providers = enabledSsoProviders();
  const [busy, setBusy] = useState<SsoProvider | null>(null);
  if (providers.length === 0) return null;
  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center gap-3 text-xs uppercase tracking-wider text-ink-400">
        <span className="h-px flex-1 bg-ink-700" /> or continue with <span className="h-px flex-1 bg-ink-700" />
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${providers.length}, minmax(0, 1fr))` }}>
        {providers.map((p) => (
          <button
            key={p}
            type="button"
            className="btn-secondary"
            disabled={busy !== null}
            onClick={async () => {
              setBusy(p);
              try {
                if (portal) setPortal(portal);
                await loginWithProvider(p);
              } catch (err) {
                onError(authErrorMessage(err));
              } finally {
                setBusy(null);
              }
            }}
          >
            {busy === p ? '…' : labels[p]}
          </button>
        ))}
      </div>
    </div>
  );
}
