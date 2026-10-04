import Link from 'next/link';
import { clearAdminToken } from '@/lib/adminSession';

/** Shown to admin accounts that exist but haven't been approved by a super admin yet. */
export default function AdminPendingPage() {
  return (
    <div className="admin-scope admin-bg flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <p className="text-5xl" aria-hidden>⏳</p>
        <h1 className="mt-4 font-display text-3xl font-black">Waiting for approval</h1>
        <p className="mt-3 text-ink-200">
          Your admin account was created, but a super admin has to activate it before you can use the admin portal.
          Ask your super admin to approve it under <span className="font-semibold">Admin accounts</span>.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/admin/login" className="btn-ghost" onClick={() => clearAdminToken()}>
            Back to admin sign-in
          </Link>
          <Link href="/login" className="btn-ghost">Game portal</Link>
        </div>
      </div>
    </div>
  );
}
