import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from '@/store/session';
import { AppShell } from '@/components/Layout/AppShell';

const steps = [
  { title: 'Pick a scene', body: 'Choose a movie clip with 2-4 characters from the library.' },
  { title: 'Grab your role', body: 'Invite friends to the lobby. Everyone gets a character.' },
  { title: 'Record your lines', body: 'Hear the original, 3-2-1, and perform. Re-record as often as you like.' },
  { title: 'Watch & share', body: 'Your avatars perform the scene with your voices. Download the MP4.' },
];

export default function Home() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'ready') void router.replace('/game');
    if (status === 'needs_profile') void router.replace('/signup?step=username');
  }, [status, router]);

  return (
    <AppShell>
      <section className="relative flex flex-col items-center py-16 text-center">
        <span className="bean left-6 top-2 h-16 w-10 animate-float bg-fg-pink [border-radius:60%_40%_55%_45%/50%_60%_40%_50%]" aria-hidden />
        <span className="bean right-8 top-16 h-12 w-9 animate-float bg-fg-cyan [animation-delay:1.2s] [border-radius:55%_45%_50%_50%/60%_55%_45%_40%]" aria-hidden />
        <span className="bean -left-4 top-40 h-10 w-7 animate-float bg-fg-yellow [animation-delay:2s] [border-radius:50%_50%_55%_45%/55%_60%_40%_45%]" aria-hidden />
        <span className="bean -right-3 top-48 h-14 w-10 animate-float bg-fg-purple [animation-delay:0.6s] [border-radius:60%_40%_45%_55%/50%_55%_45%_50%]" aria-hidden />
        <p className="badge mb-6 bg-white/15 text-white">Multiplayer dubbing party game</p>
        <h1 className="max-w-3xl font-display text-6xl leading-tight sm:text-7xl">
          <span className="wordmark">DUB</span>{' '}
          <span className="text-white">movie scenes</span>
          <br />
          <span className="text-fg-yellow drop-shadow-[0_4px_0_rgba(0,0,0,0.35)]">with your friends</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg font-medium text-ink-200">
          Record your own dialogue for famous characters, then watch your 3D avatars act it out with your voices.
        </p>
        {status === 'unconfigured' ? (
          <p className="mt-8 rounded-2xl border-2 border-yellow-400/60 bg-yellow-900/40 px-5 py-3 text-sm text-yellow-200">
            Firebase is not configured. Copy <code>.env.example</code> to <code>.env.local</code> and fill in your credentials.
          </p>
        ) : (
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
            <Link href="/signup" className="btn-yellow animate-bounce-soft px-10 py-4 font-display text-2xl">
              Press start
            </Link>
            <Link href="/login" className="btn-secondary px-8 py-4 font-display text-xl">
              Log in
            </Link>
          </div>
        )}
      </section>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <div key={s.title} className="card transition hover:-translate-y-2 hover:rotate-1 hover:border-white/30">
            <p className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-fg-pink font-display text-2xl text-white shadow-[0_4px_0_rgba(0,0,0,0.3)]">
              {i + 1}
            </p>
            <p className="mt-3 font-display text-lg">{s.title}</p>
            <p className="mt-1 text-sm text-ink-200">{s.body}</p>
          </div>
        ))}
      </section>
    </AppShell>
  );
}
