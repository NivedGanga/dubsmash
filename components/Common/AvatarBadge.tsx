import type { PublicUser } from '@/types/api';
import { initials } from '@/lib/utils';

/** Lightweight 2D avatar (initials on the user's avatar colour) for lists and the navbar. */
export function AvatarBadge({
  user,
  size = 40,
  online,
}: {
  user: Pick<PublicUser, 'display_name' | 'avatar_color' | 'avatar_url'>;
  size?: number;
  online?: boolean;
}) {
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {user.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center rounded-full font-bold text-white"
          style={{ background: user.avatar_color, fontSize: size * 0.38 }}
          aria-hidden
        >
          {initials(user.display_name) || '?'}
        </span>
      )}
      {online !== undefined && (
        <span
          className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-ink-800 ${online ? 'bg-green-400' : 'bg-ink-400'}`}
          aria-label={online ? 'online' : 'offline'}
        />
      )}
    </span>
  );
}
