import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildDubArgs, buildFilterComplex } from '@/lib/ffmpeg';

describe('ffmpeg command builder', () => {
  it('delays each take to its line and mixes without attenuation', () => {
    const { filter } = buildFilterComplex({
      videoPath: 'v.mp4',
      trimStart: 0,
      trimEnd: null,
      outputPath: 'o.mp4',
      tracks: [
        { path: 'a.webm', start: 0, end: 7 },
        { path: 'b.webm', start: 7, end: 13 },
      ],
    });
    expect(filter).toContain('[1:a]atrim=0:7.75');
    expect(filter).toContain('adelay=delays=7000:all=1[t1]');
    expect(filter).toContain('[t0][t1]amix=inputs=2:normalize=0');
    expect(filter).toContain('loudnorm');
    expect(filter).toContain('alimiter');
  });

  it('seeks/trims the source video and maps the mixed audio', () => {
    const args = buildDubArgs({ videoPath: 'v.mp4', trimStart: 2, trimEnd: 12, outputPath: 'o.mp4', tracks: [{ path: 'a', start: 0, end: 3 }] });
    expect(args.slice(args.indexOf('-ss'), args.indexOf('-ss') + 4)).toEqual(['-ss', '2', '-t', '10']);
    expect(args).toContain('-shortest');
    expect(args[args.indexOf('-map') + 1]).toBe('0:v:0');
  });

  it('produces a silent track when there are no takes', () => {
    expect(buildFilterComplex({ videoPath: 'v', trimStart: 0, trimEnd: null, outputPath: 'o', tracks: [] }).filter).toContain('anullsrc');
  });
});

const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;
(hasFfmpeg ? describe : describe.skip)('ffmpeg render (real binary)', () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'dub-'));
    const run = (args: string[]) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]);
    // 12s test video with its own (original) audio, plus two takes in different formats.
    run(['-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=25:duration=12', '-f', 'lavfi', '-i', 'sine=frequency=220:duration=12', '-shortest', '-c:v', 'libx264', '-c:a', 'aac', join(dir, 'clip.mp4')]);
    run(['-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-c:a', 'libopus', join(dir, 'a.webm')]);
    run(['-f', 'lavfi', '-i', 'sine=frequency=880:duration=4', '-c:a', 'aac', join(dir, 'b.m4a')]);
  }, 60_000);
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('renders a trimmed MP4 whose length matches the trimmed video and has one audio stream', () => {
    const out = join(dir, 'out.mp4');
    const args = buildDubArgs({
      videoPath: join(dir, 'clip.mp4'),
      trimStart: 2,
      trimEnd: 10,
      outputPath: out,
      tracks: [
        { path: join(dir, 'a.webm'), start: 0, end: 3 },
        { path: join(dir, 'b.m4a'), start: 4, end: 8 },
      ],
      preset: 'ultrafast',
    });
    execFileSync('ffmpeg', args);
    expect(existsSync(out)).toBe(true);
    const probe = JSON.parse(
      execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,codec_name', '-of', 'json', out]).toString(),
    ) as { format: { duration: string }; streams: Array<{ codec_type: string; codec_name: string }> };
    expect(Number(probe.format.duration)).toBeGreaterThan(7.8);
    expect(Number(probe.format.duration)).toBeLessThan(8.3);
    expect(probe.streams.map((s) => `${s.codec_type}:${s.codec_name}`).sort()).toEqual(['audio:aac', 'video:h264']);

    // Take A covers 0-3s, take B starts at 4s: 3.2-3.5s must be silent (original audio is replaced),
    // and both takes must be audible at their positions.
    const meanVolume = (at: number) => {
      const stderr = spawnSync('ffmpeg', ['-hide_banner', '-ss', String(at), '-t', '0.3', '-i', out, '-af', 'volumedetect', '-f', 'null', '-']).stderr.toString();
      return Number(/mean_volume: (-?[\d.]+) dB/.exec(stderr)?.[1] ?? '-91');
    };
    expect(meanVolume(1)).toBeGreaterThan(-30);
    expect(meanVolume(3.2)).toBeLessThan(-50);
    expect(meanVolume(5)).toBeGreaterThan(-30);
  }, 60_000);
});
