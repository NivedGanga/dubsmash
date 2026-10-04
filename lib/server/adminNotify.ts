import { getAdminAccountById, superAdminAccounts } from './adminAuth';
import { sendEmail } from './email';
import { isFeatureEnabled } from './featureFlags';

/**
 * Admin-portal notifications. Admins aren't game users, so there's no in-app bell for them —
 * important events (clips awaiting approval, verdicts on their uploads) go out by email instead.
 * No-ops when email_notifications_enabled is off or SendGrid isn't configured.
 */
export async function emailSuperAdmins(subject: string, text: string): Promise<void> {
  if (!(await isFeatureEnabled('email_notifications_enabled'))) return;
  const admins = await superAdminAccounts();
  await Promise.all(admins.map((a) => sendEmail({ to: a.email, subject, text })));
}

export async function emailAdminAccount(accountId: string | null | undefined, subject: string, text: string): Promise<void> {
  if (!accountId || !(await isFeatureEnabled('email_notifications_enabled'))) return;
  const account = await getAdminAccountById(accountId);
  if (account?.email) await sendEmail({ to: account.email, subject, text });
}
