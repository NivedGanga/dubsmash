import Link from 'next/link';
import { useRouter } from 'next/router';
import type { ReactNode } from 'react';
import { api } from '@/lib/api';
import { logout } from '@/lib/auth';
import { useSession } from '@/store/session';
import { AvatarBadge } from '@/components/Common/AvatarBadge';

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const router = useRouter();
  const active = router.pathname === href || (href !== '/' && router.pathname.startsWith(href));
  return (
    <Link href={href} className={`rounded-full px-4 py-1.5 text-sm font-bold transition ${active ? 'bg-white/20 text-white shadow-[0_3px_0_rgba(0,0,0,0.3)]' : 'text-ink-200 hover:bg-white/10 hover:text-white'}`}>
      {children}
    </Link>
  );
}

export async function signOutEverywhere(): Promise<void> {
  await api('/api/auth/logout', { method: 'POST', body: {} }).catch(() => {});
  await logout();
}

/** Top navigation for the game portal (and wrapper for admin pages). `bell` is injected to avoid a cycle. */
export function AppShell({ children, wide = false, bell }: { children: ReactNode; wide?: boolean; bell?: ReactNode }) {
  const me = useSession((s) => s.me);
  const router = useRouter();
  return (
    <div className="game-bg min-h-screen">
      <header className="sticky top-0 z-30 border-b-2 border-white/10 bg-ink-900/80 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3">
          <Link href={me ? '/game' : '/'} className="mr-4 flex items-baseline gap-1.5 font-display">
            <span className="wordmark text-2xl tracking-tight">DUBSMASH</span>
            <span className="hidden text-xs font-bold uppercase tracking-widest text-ink-400 sm:inline">party dubbing</span>
          </Link>
          {me && (
            <>
              <NavLink href="/game">Play</NavLink>
              {me.flags.friend_system_enabled && <NavLink href="/friends">Friends</NavLink>}
              <div className="ml-auto flex items-center gap-2">
                {bell}
                <NavLink href="/settings">Settings</NavLink>
                <Link href="/profile" className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-ink-700" aria-label="Profile">
                  <AvatarBadge user={me.user} size={32} />
                  <span className="hidden text-sm font-semibold sm:inline">{me.user.display_name}</span>
                </Link>
                <button
                  className="btn-ghost px-2 py-1 text-sm"
                  onClick={async () => {
                    await signOutEverywhere();
                    void router.push('/');
                  }}
                >
                  Log out
                </button>
              </div>
            </>
          )}
        </nav>
      </header>
      <main className={`mx-auto px-4 py-8 ${wide ? 'max-w-7xl' : 'max-w-6xl'}`}>{children}</main>
    </div>
  );
}
