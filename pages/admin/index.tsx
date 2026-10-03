import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { FullPageSpinner } from '@/components/Common/ui';

/** /admin -> dashboard, or the request-access screen when the user lacks admin access. */
export default function AdminIndex() {
  const router = useRouter();
  const { me, status } = useRequireAuth('admin');
  useEffect(() => {
    if (status !== 'ready' || !me) return;
    void router.replace(me.admin_access.status === 'granted' ? '/admin/dashboard' : '/admin/request-access');
  }, [me, status, router]);
  return <FullPageSpinner />;
}
