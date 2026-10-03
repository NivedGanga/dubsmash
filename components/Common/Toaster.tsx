import { useToasts } from '@/store/toast';

const styles = {
  info: 'border-ink-600 bg-ink-700',
  success: 'border-green-600 bg-green-900/80',
  error: 'border-red-600 bg-red-900/80',
} as const;

export function Toaster() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`pointer-events-auto animate-pop rounded-xl border p-3 text-sm shadow-xl ${styles[t.kind]}`} role="status">
          <div className="flex items-start gap-2">
            <p className="flex-1">{t.message}</p>
            <button className="text-ink-200 hover:text-white" onClick={() => dismiss(t.id)} aria-label="Dismiss">
              ×
            </button>
          </div>
          {t.action && (
            <button
              className="btn-primary mt-2 w-full py-1 text-xs"
              onClick={() => {
                t.action!.onClick();
                dismiss(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
