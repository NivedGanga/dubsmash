import Link from 'next/link';
import { useRouter } from 'next/router';
import type { ReactNode } from 'react';
import type { PublicAdminAccount } from '@/types/api';
import { clearAdminToken } from '@/lib/adminSession';

/** Admin portal chrome: separate branding/nav and its own credential session — no game account needed. */
export function AdminShell({ children, wide = false, account }: { children: ReactNode; wide?: boolean; account?: PublicAdminAccount | null }) {
  const router = useRouter();
  return (
    <div className="admin-scope admin-bg min-h-screen">
      <header className="sticky top-0 z-30 border-b border-ink-700 bg-ink-900/90 backdrop-blur">
        <nav className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <Link href="/admin" className="flex items-baseline gap-2 font-display">
            <span className="text-2xl font-black tracking-tight text-admin-500">Dubsmash</span>
            <span className="rounded bg-admin-500/15 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider text-admin-300">Admin</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            {account ? (
              <>
                <span className="flex items-center gap-2 rounded-lg px-2 py-1">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-admin-500/20 text-sm">🛡️</span>
                  <span className="hidden text-sm font-semibold sm:inline">{account.display_name}</span>
                  {account.role === 'super_admin' && (
                    <span className="rounded bg-admin-500/15 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider text-admin-300">super</span>
                  )}
                </span>
                <button
                  className="btn-ghost px-2 py-1 text-sm"
                  onClick={() => {
                    clearAdminToken();
                    void router.push('/admin/login');
                  }}
                >
                  Log out
                </button>
              </>
            ) : (
              <Link href="/login" className="btn-ghost px-2 py-1 text-sm">Game portal →</Link>
            )}
          </div>
        </nav>
      </header>
      <main className={`mx-auto px-4 py-8 ${wide ? 'max-w-7xl' : 'max-w-4xl'}`}>{children}</main>
    </div>
  );
}
