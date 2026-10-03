import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface GameSettings {
  masterVolume: number;
  dialogueVolume: number;
  effectsVolume: number;
  microphoneDeviceId: string | null;
  subtitles: boolean;
  language: string;
}

interface SettingsState extends GameSettings {
  update: (patch: Partial<GameSettings>) => void;
  reset: () => void;
}

export const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.9,
  dialogueVolume: 1,
  effectsVolume: 0.7,
  microphoneDeviceId: null,
  subtitles: true,
  language: 'en',
};

/** Device-local settings persisted to localStorage, applied across all sessions on this device. */
export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      update: (patch) => set(patch),
      reset: () => set(DEFAULT_SETTINGS),
    }),
    { name: 'dubsmash-settings', version: 1 },
  ),
);

export const effectiveVolume = (s: Pick<GameSettings, 'masterVolume'>, channel: number) =>
  Math.max(0, Math.min(1, s.masterVolume * channel));
