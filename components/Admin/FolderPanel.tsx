import { useState } from 'react';
import type { FolderRow } from '@/types/database';
import type { FolderTreeResponse } from '@/types/api';
import { adminDelete, adminPatch, adminPost } from '@/lib/adminApi';
import { errorMessage } from '@/lib/api';
import { toast } from '@/store/toast';

export type FolderSelection = 'all' | 'root' | string;

interface Props {
  tree: FolderTreeResponse | null;
  selected: FolderSelection;
  onSelect: (f: FolderSelection) => void;
  /** Super admin "username folders". */
  owner: string | null;
  onOwner: (ownerId: string | null) => void;
  isSuper: boolean;
  onChanged: () => void;
}

function children(folders: FolderRow[], parent: string | null) {
  return folders.filter((f) => f.parent_folder_id === parent);
}

export function FolderPanel({ tree, selected, onSelect, owner, onOwner, isSuper, onChanged }: Props) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const folders = tree?.folders ?? [];
  const parentForNew = selected !== 'all' && selected !== 'root' ? selected : null;

  async function create() {
    if (!name.trim()) return;
    try {
      await adminPost('/api/folders', { name: name.trim(), parent_folder_id: parentForNew, owner_id: owner ?? undefined });
      setName('');
      setCreating(false);
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function rename(f: FolderRow) {
    const next = window.prompt('Rename folder', f.name)?.trim();
    if (!next || next === f.name) return;
    try {
      await adminPatch(`/api/folders/${f.id}`, { name: next });
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function remove(f: FolderRow) {
    if (!window.confirm(`Delete folder "${f.name}"? Only empty folders can be deleted.`)) return;
    try {
      await adminDelete(`/api/folders/${f.id}`);
      if (selected === f.id) onSelect('all');
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const renderTree = (parent: string | null, depth: number) =>
    children(folders, parent).map((f) => (
      <li key={f.id}>
        <div className={`group flex items-center rounded-lg ${selected === f.id ? 'bg-ink-700' : 'hover:bg-ink-800'}`} style={{ paddingLeft: depth * 12 }}>
          <button className="flex-1 truncate px-2 py-1.5 text-left text-sm" onClick={() => onSelect(f.id)}>
            📁 {f.name}
          </button>
          <button className="hidden px-1 text-xs text-ink-400 hover:text-white group-hover:block" onClick={() => void rename(f)} aria-label={`Rename ${f.name}`}>✎</button>
          <button className="hidden px-1 text-xs text-ink-400 hover:text-white group-hover:block" onClick={() => void remove(f)} aria-label={`Delete ${f.name}`}>×</button>
        </div>
        <ul>{renderTree(f.id, depth + 1)}</ul>
      </li>
    ));

  return (
    <div className="card space-y-3 p-3">
      {isSuper && (
        <div>
          <label className="label px-2" htmlFor="owner">Admin folders</label>
          <select id="owner" className="input py-1 text-sm" value={owner ?? ''} onChange={(e) => onOwner(e.target.value || null)}>
            <option value="">Everyone (all clips)</option>
            {(tree?.owners ?? []).map((o) => <option key={o.id} value={o.id}>{o.display_name}</option>)}
          </select>
        </div>
      )}
      <ul className="space-y-0.5">
        <li>
          <button className={`w-full rounded-lg px-2 py-1.5 text-left text-sm ${selected === 'all' ? 'bg-ink-700' : 'hover:bg-ink-800'}`} onClick={() => onSelect('all')}>
            All clips
          </button>
        </li>
        <li>
          <button className={`w-full rounded-lg px-2 py-1.5 text-left text-sm ${selected === 'root' ? 'bg-ink-700' : 'hover:bg-ink-800'}`} onClick={() => onSelect('root')}>
            Unfiled
          </button>
        </li>
        {renderTree(null, 0)}
      </ul>
      {creating ? (
        <div className="flex gap-1">
          <input className="input py-1 text-sm" autoFocus maxLength={80} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void create()} placeholder={parentForNew ? 'Subfolder name' : 'Folder name'} />
          <button className="btn-primary px-2 py-1 text-sm" onClick={() => void create()}>Add</button>
        </div>
      ) : (
        <button className="btn-secondary w-full py-1 text-sm" onClick={() => setCreating(true)}>
          + New {parentForNew ? 'subfolder' : 'folder'}
        </button>
      )}
    </div>
  );
}
