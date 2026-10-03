import Link from 'next/link';
import { useRouter } from 'next/router';
import type { ReactNode } from 'react';
import { useSession } from '@/store/session';
import { AvatarBadge } from '@/components/Common/AvatarBadge';
import { NotificationBell } from '@/components/Common/NotificationBell';
import { signOutEverywhere } from './AppShell';

/** Admin portal chrome: separate branding/nav from the game portal, wrapped in .admin-scope styles. */
export function AdminShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const me = useSession((s) => s.me);
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
            <NotificationBell />
            <Link href="/game" className="btn-ghost px-2 py-1 text-sm">Game portal →</Link>
            {me && (
              <>
                <Link href="/profile" className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-ink-700" aria-label="Profile">
                  <AvatarBadge user={me.user} size={28} />
                  <span className="hidden text-sm font-semibold sm:inline">{me.user.display_name}</span>
                </Link>
                <button
                  className="btn-ghost px-2 py-1 text-sm"
                  onClick={async () => {
                    await signOutEverywhere();
                    void router.push('/admin/login');
                  }}
                >
                  Log out
                </button>
              </>
            )}
          </div>
        </nav>
      </header>
      <main className={`mx-auto px-4 py-8 ${wide ? 'max-w-7xl' : 'max-w-4xl'}`}>{children}</main>
    </div>
  );
}
