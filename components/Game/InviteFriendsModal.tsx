import Link from 'next/link';
import { useState } from 'react';
import { useFriends } from '@/hooks/useFriends';
import { AvatarBadge } from '@/components/Common/AvatarBadge';
import { Modal, Spinner } from '@/components/Common/ui';

/** Pick up to `max` friends to invite into a game. */
export function InviteFriendsModal({
  open,
  onClose,
  exclude = [],
  max,
  onInvite,
  title = 'Invite friends',
  confirmLabel = 'Send invites',
}: {
  open: boolean;
  onClose: () => void;
  exclude?: string[];
  max: number;
  onInvite: (userIds: string[]) => Promise<void> | void;
  title?: string;
  confirmLabel?: string;
}) {
  const { friends, loading, enabled } = useFriends();
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const candidates = friends.filter((f) => !exclude.includes(f.user.id));

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < max ? [...p, id] : p));
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      {!enabled ? (
        <p className="text-sm text-ink-200">Invitations are currently disabled. You can still play solo.</p>
      ) : loading && !friends.length ? (
        <Spinner />
      ) : candidates.length === 0 ? (
        <p className="text-sm text-ink-200">
          No friends to invite yet. <Link href="/friends" className="text-brand-300 hover:underline">Find friends</Link>
        </p>
      ) : (
        <>
          <p className="mb-3 text-xs text-ink-400">Choose up to {max}. Invitations expire after 1 hour.</p>
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {candidates.map((f) => {
              const on = picked.includes(f.user.id);
              return (
                <li key={f.user.id}>
                  <button
                    type="button"
                    className={`flex w-full items-center gap-3 rounded-xl p-2 text-left ${on ? 'bg-brand-500/20 ring-1 ring-brand-500' : 'hover:bg-ink-700'}`}
                    onClick={() => toggle(f.user.id)}
                    aria-pressed={on}
                  >
                    <AvatarBadge user={f.user} size={36} online={f.online} />
                    <span className="flex-1">
                      <span className="block font-semibold">{f.user.display_name}</span>
                      <span className="text-xs text-ink-400">@{f.user.username} · {f.online ? 'online' : 'offline'}</span>
                    </span>
                    {on && <span className="text-brand-300">✓</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <button
        className="btn-primary mt-4 w-full"
        disabled={busy || (enabled && candidates.length > 0 && picked.length === 0)}
        onClick={async () => {
          setBusy(true);
          try {
            await onInvite(picked);
            setPicked([]);
          } finally {
            setBusy(false);
          }
        }}
      >
        {picked.length ? `${confirmLabel} (${picked.length})` : confirmLabel}
      </button>
    </Modal>
  );
}
