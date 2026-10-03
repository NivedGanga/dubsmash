import { useEffect, useRef, useState } from 'react';
import { AudioRecorder, MicrophoneError, listInputDevices, playAudio, requestMicrophoneAccess, startLevelMeter, stopStream } from '@/lib/audio';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { effectiveVolume, useSettings } from '@/store/settings';
import { toast } from '@/store/toast';
import { Shell } from '@/components/Layout/Shell';
import { ErrorBox, FullPageSpinner, Toggle } from '@/components/Common/ui';

const LANGUAGES = [
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Español' },
  { id: 'fr', label: 'Français' },
  { id: 'de', label: 'Deutsch' },
];

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-4">
      <label className="w-28 text-sm text-ink-200">{label}</label>
      <input type="range" min={0} max={1} step={0.05} value={value} onChange={(e) => onChange(Number(e.target.value))} className="flex-1 accent-brand-500" aria-label={label} />
      <span className="w-10 text-right font-mono text-sm">{Math.round(value * 100)}</span>
    </div>
  );
}

/** Mic picker + live level meter + 3-second test recording with playback. */
function MicrophoneTest() {
  const settings = useSettings();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [level, setLevel] = useState(0);
  const [active, setActive] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const stopMeter = useRef<(() => void) | null>(null);

  const stop = () => {
    stopMeter.current?.();
    stopStream(stream.current);
    stream.current = null;
    setActive(false);
    setLevel(0);
  };
  useEffect(() => stop, []);
  useEffect(() => {
    void listInputDevices().then(setDevices);
  }, [active]);

  async function start() {
    setError(null);
    stop();
    try {
      stream.current = await requestMicrophoneAccess(settings.microphoneDeviceId);
      stopMeter.current = startLevelMeter(stream.current, setLevel);
      setActive(true);
      setDevices(await listInputDevices()); // labels are only available after permission
    } catch (err) {
      setError(err instanceof MicrophoneError ? err.message : 'Could not access the microphone.');
    }
  }

  async function testRecording() {
    if (!stream.current) await start();
    if (!stream.current) return;
    setTesting(true);
    const rec = new AudioRecorder(stream.current);
    rec.start();
    await new Promise((r) => setTimeout(r, 3000));
    try {
      const take = await rec.stop();
      playAudio(take.blob, effectiveVolume(settings, settings.dialogueVolume), () => setTesting(false));
    } catch (err) {
      setError((err as Error).message);
      setTesting(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && <ErrorBox message={error} />}
      <div>
        <label className="label" htmlFor="mic">Microphone</label>
        <select
          id="mic"
          className="input"
          value={settings.microphoneDeviceId ?? ''}
          onChange={(e) => {
            settings.update({ microphoneDeviceId: e.target.value || null });
            if (active) setTimeout(() => void start(), 0);
          }}
        >
          <option value="">System default</option>
          {devices.map((d, i) => <option key={d.deviceId || i} value={d.deviceId}>{d.label || `Microphone ${i + 1}`}</option>)}
        </select>
      </div>
      <div>
        <div className="h-4 overflow-hidden rounded-full bg-ink-900" aria-label="Input level">
          <div className={`h-full transition-[width] duration-75 ${level > 0.85 ? 'bg-red-500' : level > 0.05 ? 'bg-green-400' : 'bg-ink-600'}`} style={{ width: `${Math.round(level * 100)}%` }} />
        </div>
        <p className="mt-1 text-xs text-ink-400">
          {!active ? 'Start the test to see your input level.' : level > 0.85 ? 'Too loud — move back from the mic.' : level > 0.05 ? 'Sounds good!' : 'Say something…'}
        </p>
      </div>
      <div className="flex gap-2">
        {active ? <button className="btn-secondary" onClick={stop}>Stop mic</button> : <button className="btn-secondary" onClick={() => void start()}>Test microphone</button>}
        <button className="btn-secondary" disabled={testing} onClick={() => void testRecording()}>{testing ? 'Recording / playing…' : 'Record 3s & play back'}</button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { allowed } = useRequireAuth('user');
  const s = useSettings();
  if (!allowed) return <Shell><FullPageSpinner /></Shell>;
  return (
    <Shell>
      <h1 className="mb-6 font-display text-3xl font-black">Settings</h1>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card space-y-4">
          <h2 className="font-bold">Audio</h2>
          <Slider label="Master" value={s.masterVolume} onChange={(v) => s.update({ masterVolume: v })} />
          <Slider label="Dialogue" value={s.dialogueVolume} onChange={(v) => s.update({ dialogueVolume: v })} />
          <Slider label="Effects" value={s.effectsVolume} onChange={(v) => s.update({ effectsVolume: v })} />
        </section>
        <section className="card space-y-4">
          <h2 className="font-bold">Microphone</h2>
          <MicrophoneTest />
        </section>
        <section className="card space-y-4">
          <h2 className="font-bold">Display</h2>
          <div className="flex items-center justify-between">
            <span className="text-sm">Subtitles during playback</span>
            <Toggle checked={s.subtitles} onChange={(v) => s.update({ subtitles: v })} label="Subtitles" />
          </div>
          <div>
            <label className="label" htmlFor="lang">Language</label>
            <select id="lang" className="input" value={s.language} onChange={(e) => s.update({ language: e.target.value })}>
              {LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
            <p className="mt-1 text-xs text-ink-400">Interface translations are rolling out; English is used where a translation is missing.</p>
          </div>
        </section>
        <section className="card flex flex-col justify-between gap-4">
          <p className="text-sm text-ink-200">Settings are saved automatically on this device.</p>
          <button className="btn-ghost w-fit" onClick={() => { s.reset(); toast.success('Settings reset.'); }}>Reset to defaults</button>
        </section>
      </div>
    </Shell>
  );
}
