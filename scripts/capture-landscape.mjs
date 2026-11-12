#!/usr/bin/env node
/**
 * Real-GPU capture + fps for Landscape mode.
 * Uses system Chrome (not swiftshader, not headless_shell).
 * Does not start a dev server and does not touch ports 5190/5191/5194/5195/5196/3001.
 *
 * Usage:
 *   bun scripts/capture-landscape.mjs --url http://127.0.0.1:5197 --out /path/to/out
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

function makeWav(seconds = 8, sampleRate = 44100) {
  const n = seconds * sampleRate;
  const samples = new Int16Array(n);
  const twoPi = Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const beat = t * 2; // 120 bpm
    const beatPhase = beat - Math.floor(beat);
    const kick = Math.exp(-beatPhase * 12) * Math.sin(twoPi * (55 + beatPhase * -20) * t);
    const bass = 0.45 * Math.sin(twoPi * 60 * t) + 0.2 * Math.sin(twoPi * 90 * t);
    const mid = 0.18 * Math.sin(twoPi * 440 * t) + 0.12 * Math.sin(twoPi * 660 * t);
    const hat = beatPhase < 0.08 ? (Math.random() * 2 - 1) * 0.22 * Math.exp(-beatPhase * 40) : 0;
    const high = 0.08 * Math.sin(twoPi * 5200 * t) * (0.4 + 0.6 * Math.sin(twoPi * 2 * t));
    let s = kick * 0.9 + bass + mid + hat + high;
    s = Math.max(-1, Math.min(1, s));
    samples[i] = (s * 32000) | 0;
  }
  const dataSize = samples.length * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  Buffer.from(samples.buffer).copy(buf, 44);
  return buf;
}

const urlBase = arg('url', 'http://127.0.0.1:5197');
const outDir = resolve(arg('out', resolve(here, '..', 'out-landscape')));
mkdirSync(outDir, { recursive: true });

const consoleErrors = [];
const pageErrors = [];
const consoleAll = [];

const browser = await chromium.launch({
  channel: 'chrome',
  headless: false, // real window, real GPU
  args: [
    '--autoplay-policy=no-user-gesture-required',
    '--disable-sync',
    '--no-first-run',
    '--use-angle=metal',
    '--ignore-gpu-blocklist',
    '--enable-webgl',
    '--enable-webgl2',
  ],
});

const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  // Don't mute audio — we want the analyser to see the file
});
const page = await context.newPage();
page.on('console', (msg) => {
  const line = `[${msg.type()}] ${msg.text()}`;
  consoleAll.push(line);
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => pageErrors.push(err.message || String(err)));

const target = `${urlBase.replace(/\/$/, '')}/?mode=Landscape`;
console.log('goto', target);
await page.goto(target, { waitUntil: 'networkidle', timeout: 60000 });

const boot = await page.evaluate(async () => {
  const start = performance.now();
  while (performance.now() - start < 20000) {
    const eng = window.engine;
    if (eng?.landscape?.ready) return { ok: true, error: null, ms: performance.now() - start };
    if (eng?.landscape?.error) return { ok: false, error: eng.landscape.error, ms: performance.now() - start };
    await new Promise((r) => setTimeout(r, 100));
  }
  return { ok: false, error: 'timeout waiting for landscape.ready', ms: 20000 };
});
console.log('boot', boot);

// Force 1080p quality: auto quality off, scale 1
await page.evaluate(() => {
  const P = window.engine?.P || window.P;
  if (P) {
    P.autoQuality = false;
    P.resolutionScale = 1;
    P.paused = false;
    if (P.mode !== 'Landscape') window.setMode?.('Landscape') || window.engine?.setMode?.('Landscape');
  }
});
await page.waitForTimeout(2500);

const silentMeta = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  const eng = window.engine;
  const fps = eng?.getFps?.() ?? 0;
  const frame = eng?.getFrame?.() ?? 0;
  // Sample default framebuffer after present
  const pixels = eng?.readPixelsLDR
    ? Array.from(eng.readPixelsLDR(Math.max(0, ((canvas?.width || 0) >> 1) - 32), Math.max(0, ((canvas?.height || 0) >> 1) - 32), 64, 64))
    : [];
  let sum = 0, maxL = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const y = 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
    sum += y; maxL = Math.max(maxL, y);
  }
  const n = pixels.length / 4 || 1;
  return {
    canvas: canvas ? { w: canvas.width, h: canvas.height } : null,
    fps,
    frame,
    renderer: (() => { try { return window.engine?.landscape ? 'landscape' : 'unknown'; } catch { return 'err'; } })(),
    meanLuma: sum / n,
    maxLuma: maxL,
    ready: !!eng?.landscape?.ready,
    error: eng?.landscape?.error || null,
  };
});
console.log('silent meta', silentMeta);

const silentPath = resolve(outDir, 'landscape-silent.png');
await page.screenshot({ path: silentPath, type: 'png' });
console.log('wrote', silentPath);

// Measure fps silently over ~3s
const fpsSilent = await page.evaluate(async () => {
  const samples = [];
  for (let i = 0; i < 8; i++) {
    await new Promise((r) => setTimeout(r, 400));
    samples.push(window.engine?.getFps?.() ?? 0);
  }
  return samples;
});
console.log('fps silent samples', fpsSilent);

// Load + play synthetic track
const wav = makeWav(10);
const wavPath = resolve(outDir, 'test-tone.wav');
writeFileSync(wavPath, wav);
const wavB64 = wav.toString('base64');
const audio = await page.evaluate(async (b64) => {
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const file = new File([bin], 'test-tone.wav', { type: 'audio/wav' });
  const analyzer = window.__audioAnalyzer;
  if (!analyzer) return { ok: false, error: 'no __audioAnalyzer' };
  const ok = await analyzer.loadFile(file);
  if (ok) analyzer.play();
  // give envelopes a moment
  await new Promise((r) => setTimeout(r, 800));
  const s = analyzer.state;
  return {
    ok,
    source: s.source,
    playing: s.isPlaying,
    bass: s.bass, mid: s.mid, high: s.high,
    bassEnv: s.bassEnv, midEnv: s.midEnv, highEnv: s.highEnv, kickEnv: s.kickEnv,
  };
}, wavB64);
console.log('audio', audio);

await page.waitForTimeout(2500);
const musicMeta = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  const eng = window.engine;
  const pixels = eng?.readPixelsLDR
    ? Array.from(eng.readPixelsLDR(Math.max(0, ((canvas?.width || 0) >> 1) - 32), Math.max(0, ((canvas?.height || 0) >> 1) - 32), 64, 64))
    : [];
  let sum = 0, maxL = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const y = 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
    sum += y; maxL = Math.max(maxL, y);
  }
  const n = pixels.length / 4 || 1;
  const s = window.__audioAnalyzer?.state;
  return {
    canvas: canvas ? { w: canvas.width, h: canvas.height } : null,
    fps: eng?.getFps?.() ?? 0,
    frame: eng?.getFrame?.() ?? 0,
    meanLuma: sum / n,
    maxLuma: maxL,
    audio: s ? { source: s.source, playing: s.isPlaying, bassEnv: s.bassEnv, midEnv: s.midEnv, highEnv: s.highEnv, kickEnv: s.kickEnv } : null,
  };
});
console.log('music meta', musicMeta);
const musicPath = resolve(outDir, 'landscape-music.png');
await page.screenshot({ path: musicPath, type: 'png' });
console.log('wrote', musicPath);

const fpsMusic = await page.evaluate(async () => {
  const samples = [];
  for (let i = 0; i < 8; i++) {
    await new Promise((r) => setTimeout(r, 400));
    samples.push(window.engine?.getFps?.() ?? 0);
  }
  return samples;
});
console.log('fps music samples', fpsMusic);

const avg = (a) => a.filter((x) => x > 0).reduce((s, x) => s + x, 0) / Math.max(1, a.filter((x) => x > 0).length);

const report = {
  url: target,
  boot,
  silent: silentMeta,
  music: musicMeta,
  audio,
  fps: {
    silentSamples: fpsSilent,
    musicSamples: fpsMusic,
    silentAvg: avg(fpsSilent),
    musicAvg: avg(fpsMusic),
    resolution: silentMeta.canvas,
  },
  consoleErrors,
  pageErrors,
  consoleTail: consoleAll.slice(-40),
};
writeFileSync(resolve(outDir, 'capture-report.json'), JSON.stringify(report, null, 2));
console.log('REPORT', JSON.stringify(report.fps, null, 2));
console.log('consoleErrors', consoleErrors.length, consoleErrors);
console.log('pageErrors', pageErrors.length, pageErrors);

await browser.close();
if (pageErrors.length || !boot.ok || (silentMeta.meanLuma ?? 0) < 1) {
  process.exitCode = 2;
}
