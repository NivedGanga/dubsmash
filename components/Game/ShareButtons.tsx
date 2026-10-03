import { toast } from '@/store/toast';

/** Native share sheet when available, otherwise copy link + social intents. */
export function ShareButtons({ url, title }: { url: string; title: string }) {
  const text = `We dubbed "${title}" on Dubsmash 🎬`;
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  return (
    <>
      {canShare ? (
        <button className="btn-secondary" onClick={() => void navigator.share({ title: 'Dubsmash', text, url }).catch(() => {})}>
          ↗ Share
        </button>
      ) : (
        <button
          className="btn-secondary"
          onClick={async () => {
            await navigator.clipboard.writeText(url);
            toast.success('Link copied!');
          }}
        >
          🔗 Copy link
        </button>
      )}
      <a className="btn-ghost" target="_blank" rel="noopener noreferrer" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`}>
        X / Twitter
      </a>
      <a className="btn-ghost" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`}>
        WhatsApp
      </a>
    </>
  );
}
