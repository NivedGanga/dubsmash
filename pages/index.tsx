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
        <span className="absolute -top-4 left-8 animate-float text-4xl opacity-70" aria-hidden>🎬</span>
        <span className="absolute right-10 top-10 animate-float text-4xl opacity-70 [animation-delay:1.2s]" aria-hidden>🎙️</span>
        <span className="absolute -left-2 top-32 animate-float text-3xl opacity-60 [animation-delay:2s]" aria-hidden>🎮</span>
        <p className="badge mb-4 border border-brand-500/40 bg-brand-500/15 text-brand-300">Multiplayer dubbing party game</p>
        <h1 className="max-w-3xl font-display text-6xl font-black leading-tight sm:text-7xl">
          <span className="wordmark text-glow">DUB</span> movie scenes{' '}
          <span className="text-glow text-brand-500">with your friends</span>
        </h1>
        <p className="mt-5 max-w-xl text-lg text-ink-200">
          Record your own dialogue for famous characters, then watch your 3D avatars act it out with your voices.
        </p>
        {status === 'unconfigured' ? (
          <p className="mt-8 rounded-xl border border-yellow-600 bg-yellow-900/40 px-4 py-3 text-sm text-yellow-200">
            Firebase is not configured. Copy <code>.env.example</code> to <code>.env.local</code> and fill in your credentials.
          </p>
        ) : (
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
            <Link href="/signup" className="btn-primary px-8 py-4 font-display text-xl uppercase tracking-wider">
              ▶ Press start
            </Link>
            <Link href="/login" className="btn-secondary px-8 py-4 font-display text-xl uppercase tracking-wider">
              Log in
            </Link>
          </div>
        )}
      </section>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <div key={s.title} className="card card-glow transition hover:-translate-y-1 hover:border-brand-500/60">
            <p className="font-display text-3xl font-black text-glow text-brand-500">{i + 1}</p>
            <p className="mt-2 font-bold">{s.title}</p>
            <p className="mt-1 text-sm text-ink-200">{s.body}</p>
          </div>
        ))}
      </section>
    </AppShell>
  );
}
