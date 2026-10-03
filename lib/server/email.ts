import sgMail from '@sendgrid/mail';
import { optionalEnv } from './env';

let initialised = false;

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Send a transactional email via SendGrid. Returns false (and logs) when SendGrid is not configured
 * or delivery fails — email is never allowed to break the request that triggered it.
 */
export async function sendEmail(msg: EmailMessage): Promise<boolean> {
  const key = optionalEnv('SENDGRID_API_KEY');
  const from = optionalEnv('SENDGRID_FROM_EMAIL');
  if (!key || !from) {
    console.warn('[email] SendGrid not configured; skipping email', msg.subject);
    return false;
  }
  if (!initialised) {
    sgMail.setApiKey(key);
    initialised = true;
  }
  try {
    await sgMail.send({ ...msg, from, html: msg.html ?? escapeHtml(msg.text).replace(/\n/g, '<br>') });
    return true;
  } catch (err) {
    console.error('[email] send failed', err);
    return false;
  }
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
