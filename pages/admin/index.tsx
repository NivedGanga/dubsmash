import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { getAdminToken } from '@/lib/adminSession';
import { FullPageSpinner } from '@/components/Common/ui';

/** /admin -> dashboard when an admin session exists, otherwise the admin login. */
export default function AdminIndex() {
  const router = useRouter();
  useEffect(() => {
    if (router.isReady) void router.replace(getAdminToken() ? '/admin/dashboard' : '/admin/login');
  }, [router, router.isReady]);
  return <FullPageSpinner />;
}
