import Link from 'next/link';
import { useRouter } from 'next/router';
import type { ReactNode } from 'react';
import { useRequireAdmin, AdminMeContext } from '@/hooks/useRequireAdmin';
import { FullPageSpinner } from '@/components/Common/ui';
import { AdminShell } from './AdminShell';

const links: Array<{ href: string; label: string; superOnly?: boolean }> = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/clips', label: 'Clips' },
  { href: '/admin/accounts', label: 'Admin accounts', superOnly: true },
  { href: '/admin/users', label: 'Users', superOnly: true },
  { href: '/admin/feature-flags', label: 'Feature flags', superOnly: true },
];

/** Admin portal chrome + guard. Pages pass `requireSuper` for super-admin-only screens. */
export function AdminLayout({ children, title, requireSuper = false }: { children: ReactNode; title: string; requireSuper?: boolean }) {
  const { me, allowed } = useRequireAdmin(requireSuper);
  const router = useRouter();
  const isSuper = me?.account.role === 'super_admin';

  return (
    <AdminShell wide account={me?.account}>
      {!allowed ? (
        <FullPageSpinner />
      ) : (
        <div className="flex flex-col gap-6 md:flex-row">
          <aside className="md:w-52 md:shrink-0">
            <p className="mb-2 px-3 text-xs font-bold uppercase tracking-wider text-ink-400">
              Admin portal {isSuper && <span className="text-admin-300">· super</span>}
            </p>
            <nav className="flex gap-1 overflow-x-auto md:flex-col">
              {links
                .filter((l) => !l.superOnly || isSuper)
                .map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold ${
                      router.pathname.startsWith(l.href) ? 'bg-ink-700 text-white' : 'text-ink-200 hover:bg-ink-800 hover:text-white'
                    }`}
                  >
                    {l.label}
                  </Link>
                ))}
            </nav>
          </aside>
          <section className="min-w-0 flex-1">
            <h1 className="mb-6 font-display text-3xl font-black">{title}</h1>
            <AdminMeContext.Provider value={me}>{children}</AdminMeContext.Provider>
          </section>
        </div>
      )}
    </AdminShell>
  );
}
