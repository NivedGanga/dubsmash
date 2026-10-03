import type { ClipCharacter } from '@/types/database';
import { DEFAULT_CHARACTER_COLORS } from '@/lib/utils';

const IDS = ['A', 'B', 'C', 'D'];

export function defaultCharacters(count = 3): ClipCharacter[] {
  return IDS.slice(0, count).map((id, i) => ({ id, name: `Character ${id}`, color: DEFAULT_CHARACTER_COLORS[i]! }));
}

/** Create / rename / recolour / delete characters (1-4). */
export function CharacterEditor({
  characters,
  onChange,
  onDelete,
  disabled,
}: {
  characters: ClipCharacter[];
  onChange: (c: ClipCharacter[]) => void;
  onDelete: (id: string) => void;
  disabled?: boolean;
}) {
  const nextId = IDS.find((id) => !characters.some((c) => c.id === id));
  const update = (id: string, patch: Partial<ClipCharacter>) => onChange(characters.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  return (
    <div className="space-y-2">
      {characters.map((c, i) => (
        <div key={c.id} className="flex items-center gap-2">
          <span className="w-5 text-center text-sm font-bold text-ink-400">{i + 1}</span>
          <input
            type="color"
            aria-label={`${c.name} colour`}
            className="h-9 w-10 cursor-pointer rounded-lg border border-ink-600 bg-ink-900 p-1"
            value={c.color}
            disabled={disabled}
            onChange={(e) => update(c.id, { color: e.target.value })}
          />
          <input
            className="input"
            maxLength={40}
            aria-label={`Character ${i + 1} name`}
            value={c.name}
            disabled={disabled}
            onChange={(e) => update(c.id, { name: e.target.value })}
          />
          <button
            type="button"
            className="btn-ghost px-2"
            disabled={disabled || characters.length <= 1}
            onClick={() => onDelete(c.id)}
            aria-label={`Delete ${c.name}`}
          >
            ×
          </button>
        </div>
      ))}
      {nextId && (
        <button
          type="button"
          className="btn-secondary w-full py-1 text-sm"
          disabled={disabled}
          onClick={() => onChange([...characters, { id: nextId, name: `Character ${nextId}`, color: DEFAULT_CHARACTER_COLORS[IDS.indexOf(nextId)]! }])}
        >
          + Add character
        </button>
      )}
    </div>
  );
}
