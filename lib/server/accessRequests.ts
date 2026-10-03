import type { AccessRequestRow, UserRow } from '@/types/database';
import { conflict, notFound } from './handler';
import { supabaseAdmin } from './supabase';
import { notify } from './notify';

/** Approve or reject a pending access request. Approval promotes a `user` to `admin`. */
export async function respondToAccessRequest(
  requestId: string,
  decision: 'approved' | 'rejected',
  responder: UserRow,
  responseMessage?: string,
): Promise<AccessRequestRow> {
  const sb = supabaseAdmin();
  // Conditional update on status=pending makes double-approval / approve-after-reject impossible.
  const { data, error } = await sb
    .from('access_requests')
    .update({
      status: decision,
      responded_at: new Date().toISOString(),
      responded_by: responder.id,
      response_message: responseMessage || null,
    })
    .eq('id', requestId)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    const { data: existing } = await sb.from('access_requests').select('id').eq('id', requestId).maybeSingle();
    throw existing ? conflict('This request was already handled.') : notFound('Access request');
  }
  const request = data as AccessRequestRow;

  if (decision === 'approved') {
    const { error: roleErr } = await sb.from('users').update({ role: 'admin' }).eq('id', request.user_id).eq('role', 'user');
    if (roleErr) throw roleErr;
  }
  await notify({
    userId: request.user_id,
    type: decision === 'approved' ? 'access_approved' : 'access_rejected',
    message:
      decision === 'approved'
        ? 'Your admin portal access was approved. You can now upload clips.'
        : `Your admin portal access request was declined${responseMessage ? `: ${responseMessage}` : '.'}`,
    metadata: { request_id: request.id, sender_id: responder.id },
  });
  return request;
}
