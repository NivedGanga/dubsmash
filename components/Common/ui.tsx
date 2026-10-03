import type { ReactNode } from 'react';

export function Spinner({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-ink-400 border-t-brand-500 ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}

export function FullPageSpinner({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-ink-200">
      <Spinner className="h-10 w-10" />
      {label && <p>{label}</p>}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 py-12 text-center">
      <p className="text-lg font-semibold">{title}</p>
      {children && <div className="max-w-md text-sm text-ink-200">{children}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-red-700 bg-red-950/60 p-4 text-sm text-red-200" role="alert">
      <p>{message}</p>
      {onRetry && (
        <button className="btn-secondary mt-3 py-1 text-xs" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-300',
  active: 'bg-green-500/20 text-green-300',
  approved: 'bg-green-500/20 text-green-300',
  completed: 'bg-green-500/20 text-green-300',
  rejected: 'bg-red-500/20 text-red-300',
  failed: 'bg-red-500/20 text-red-300',
  archived: 'bg-ink-600 text-ink-200',
  processing: 'bg-blue-500/20 text-blue-300',
  lobby: 'bg-purple-500/20 text-purple-300',
  recording: 'bg-red-500/20 text-red-300',
  playback: 'bg-blue-500/20 text-blue-300',
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${statusColors[status] ?? 'bg-ink-600 text-ink-200'}`}>{status.replace(/_/g, ' ')}</span>;
}

export function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-40 ${checked ? 'bg-brand-500' : 'bg-ink-600'}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${checked ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="card w-full max-w-md animate-pop" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button className="text-ink-200 hover:text-white" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
