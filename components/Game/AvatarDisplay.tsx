import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { AvatarSpec, Stage } from '@/lib/three';

export interface AvatarDisplayItem extends AvatarSpec {
  label: ReactNode;
  /** Fallback 2D rendering when WebGL is unavailable. */
  displayName: string;
}

/**
 * Renders 1-4 avatars in a Three.js scene with HTML labels under each avatar.
 * Three.js is loaded lazily (dynamic import) so it is not part of the initial page bundle.
 */
export function AvatarDisplay({ avatars, variant = 'lobby', className = 'h-72' }: { avatars: AvatarDisplayItem[]; variant?: 'lobby' | 'stage'; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const stage = useRef<Stage | null>(null);
  const [labels, setLabels] = useState<Array<{ id: string; x: number; y: number }>>([]);
  const [fallback, setFallback] = useState(false);
  const specsKey = JSON.stringify(avatars.map(({ id, model, color, outfit, state, accent }) => ({ id, model, color, outfit, state, accent })));

  useEffect(() => {
    let cancelled = false;
    void import('@/lib/three').then(({ createStage, webglAvailable }) => {
      if (cancelled || !ref.current) return;
      if (!webglAvailable()) return setFallback(true);
      stage.current = createStage(ref.current, { variant });
    });
    return () => {
      cancelled = true;
      stage.current?.dispose();
      stage.current = null;
    };
  }, [variant]);

  useEffect(() => {
    let raf = 0;
    const apply = () => {
      if (!stage.current) {
        raf = requestAnimationFrame(apply); // stage still loading
        return;
      }
      stage.current.setAvatars(JSON.parse(specsKey) as AvatarSpec[]);
      setLabels(stage.current.positions());
    };
    apply();
    const onResize = () => stage.current && setLabels(stage.current.positions());
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, [specsKey]);

  const byId = new Map(avatars.map((a) => [a.id, a]));

  if (fallback) {
    return (
      <div className={`flex items-end justify-center gap-6 rounded-2xl bg-ink-800 p-6 ${className}`}>
        {avatars.map((a) => (
          <div key={a.id} className="flex flex-col items-center gap-2">
            <div className={`h-24 w-16 rounded-full ${a.state === 'speaking' || a.state === 'ready' ? 'animate-bounce' : ''}`} style={{ background: a.color }} />
            <div className="text-center text-sm">{a.label}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-b from-ink-700 to-ink-900 ${className}`}>
      <div ref={ref} className="absolute inset-0" aria-hidden />
      {labels.map((l) => {
        const a = byId.get(l.id);
        if (!a) return null;
        return (
          <div key={l.id} className="pointer-events-none absolute -translate-x-1/2 text-center text-sm" style={{ left: `${l.x * 100}%`, top: `calc(${l.y * 100}% + 8px)` }}>
            {a.label}
          </div>
        );
      })}
      <ul className="sr-only">
        {avatars.map((a) => <li key={a.id}>{a.displayName}</li>)}
      </ul>
    </div>
  );
}
