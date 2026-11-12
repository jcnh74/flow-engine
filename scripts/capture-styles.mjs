#!/usr/bin/env node
/**
 * Style capture (pass 2): real Chrome + ANGLE/Metal, 1920x1080, UI panels hidden, no audio.
 * One fresh page per target so presets cannot leak into each other.
 * Does not start a dev server and does not touch ports 5190/5191/5194/5195/3001.
 *
 * Usage:
 *   bun scripts/capture-styles.mjs --url http://127.0.0.1:5197 --out out-landscape/pass2/shots \
 *     [--only "gallery=Living Pigment,mode=Wall Studio"] [--wait 5000]
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const urlBase = arg('url', 'http://127.0.0.1:5197').replace(/\/$/, '');
const outDir = resolve(arg('out', 'out-landscape/pass2/shots'));
const waitMs = +arg('wait', '5000');
mkdirSync(outDir, { recursive: true });

const DEFAULT = [
  'gallery=Living Pigment', 'gallery=Ember Canyon', 'gallery=Glacier Night', 'gallery=Neon Pigment', 'mode=Landscape',
  'mode=Wall Studio', 'mode=Morph', 'mode=3D Fractal', 'mode=Kaleido', 'mode=Tunnel', 'mode=Plasma',
];
const targets = (arg('only', '') ? arg('only').split(',') : DEFAULT).map((t) => t.trim()).filter(Boolean);

const browser = await chromium.launch({
  channel: 'chrome',
  headless: false,
  args: ['--disable-sync', '--no-first-run', '--use-angle=metal', '--ignore-gpu-blocklist', '--enable-webgl', '--enable-webgl2'],
});
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await context.grantPermissions(['midi', 'midi-sysex'], { origin: urlBase }).catch(() => {});
const report = { url: urlBase, resolution: '1920x1080', shots: [] };

for (const t of targets) {
  const [kind, value] = t.split('=');
  const slug = `${kind}-${value.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const page = await context.newPage();
  const errors = [], pageErrors = [], tail = [];
  page.on('console', (m) => { tail.push(`[${m.type()}] ${m.text()}`); if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => pageErrors.push(e.message || String(e)));
  const q = kind === 'gallery' ? `gallery=${encodeURIComponent(value)}` : `mode=${encodeURIComponent(value)}`;
  await page.goto(`${urlBase}/?${q}`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.evaluate(async () => {
    const t0 = performance.now();
    while (performance.now() - t0 < 15000) {
      const e = window.engine;
      if (e && (!e.P || e.P.mode !== 'Landscape' || e.landscape?.ready || e.landscape?.error)) return;
      await new Promise((r) => setTimeout(r, 100));
    }
  });
  await page.evaluate(() => {
    const P = window.engine?.P || window.P;
    if (P) { P.autoQuality = false; P.resolutionScale = 1; P.paused = false; }
  });
  // Hide every UI panel; only the WebGL canvas stays visible
  await page.addStyleTag({ content: 'body *{visibility:hidden !important} canvas#c{visibility:visible !important}' });
  await page.waitForTimeout(waitMs);
  const fps = await page.evaluate(async () => {
    const s = [];
    for (let i = 0; i < 6; i++) { await new Promise((r) => setTimeout(r, 400)); s.push(window.engine?.getFps?.() ?? 0); }
    return s;
  });
  const meta = await page.evaluate(() => {
    const c = document.querySelector('canvas#c');
    const e = window.engine;
    return { canvas: c ? { w: c.width, h: c.height } : null, mode: e?.P?.mode, palette: e?.P?.palette, audioReactive: e?.P?.audioReactive,
      landLook: e?.P?.landLook, landscapeReady: !!e?.landscape?.ready, landscapeError: e?.landscape?.error || null, debug: e?.landscape?.lastDebug || null };
  });
  const path = resolve(outDir, `${slug}.png`);
  await page.screenshot({ path, type: 'png' });
  const avg = fps.filter((x) => x > 0).reduce((a, b) => a + b, 0) / Math.max(1, fps.filter((x) => x > 0).length);
  const rec = { target: t, file: path, fpsAvg: +avg.toFixed(2), fps, ...meta, consoleErrors: errors, pageErrors };
  report.shots.push(rec);
  console.log(JSON.stringify({ target: t, fps: rec.fpsAvg, mode: meta.mode, canvas: meta.canvas, errors: errors.length, pageErrors: pageErrors.length, landErr: meta.landscapeError }));
  if (errors.length || pageErrors.length) console.log('  errors:', errors.slice(0, 3), pageErrors.slice(0, 3));
  await page.close();
}
writeFileSync(resolve(outDir, 'capture-report.json'), JSON.stringify(report, null, 2));
await browser.close();
const bad = report.shots.filter((s) => s.pageErrors.length || s.consoleErrors.length).length;
console.log(`done: ${report.shots.length} shots, ${bad} with errors`);
if (bad) process.exitCode = 2;
