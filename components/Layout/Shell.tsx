import type { ReactNode } from 'react';
import { AppShell } from './AppShell';
import { NotificationBell } from '@/components/Common/NotificationBell';

/** AppShell with the notification bell wired in. Use this in pages. */
export function Shell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <AppShell wide={wide} bell={<NotificationBell />}>
      {children}
    </AppShell>
  );
}
