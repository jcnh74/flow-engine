#!/usr/bin/env node
/**
 * Pass-3 style capture: real Chrome + ANGLE/Metal, 1920x1080, every UI element hidden, no audio.
 * One fresh page per target. Target syntax:  label|query   e.g.  "kaleido-coral|mode=Kaleido&set=stLook:Coral Peach"
 *   set=key:value;key:value  is applied to engine.P after boot (strings or numbers).
 * Waits for Landscape / studio GLB scenes to be ready, settles, samples fps for 2.4 s, then screenshots.
 * Does not start servers; does not touch ports other than the one in --url.
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const urlBase = arg('url', 'http://127.0.0.1:5197').replace(/\/$/, '');
const outDir = resolve(arg('out', 'out-landscape/pass3/shots'));
const waitMs = +arg('wait', '4000');
mkdirSync(outDir, { recursive: true });
const targets = (arg('targets-file') ? readFileSync(arg('targets-file'), 'utf8').split('\n') : arg('only', '').split(','))
  .map((t) => t.trim()).filter((t) => t && !t.startsWith('#'));

const browser = await chromium.launch({ channel: 'chrome', headless: false,
  args: ['--disable-sync', '--no-first-run', '--use-angle=metal', '--ignore-gpu-blocklist', '--enable-webgl', '--enable-webgl2'] });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await context.grantPermissions(['midi', 'midi-sysex'], { origin: urlBase }).catch(() => {});
const report = { url: urlBase, resolution: '1920x1080', shots: [] };
// Warm-up page: lets Vite finish transforming modules and Chrome compile shaders before anything is measured
{ const w = await context.newPage(); await w.goto(`${urlBase}/?mode=Kaleido`, { waitUntil: 'networkidle', timeout: 90000 }); await w.waitForTimeout(4000); await w.close(); }
for (const t of targets) {
  const [label, query] = t.split('|');
  const qs = new URLSearchParams(query);
  const sets = (qs.get('set') || '').split(';').filter(Boolean).map((kv) => { const i = kv.indexOf(':'); return [kv.slice(0, i), kv.slice(i + 1)]; });
  qs.delete('set');
  const page = await context.newPage();
  const errors = [], pageErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => pageErrors.push(e.message || String(e)));
  await page.goto(`${urlBase}/?${qs.toString()}`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.evaluate((sets) => {
    const P = window.engine.P;
    P.autoQuality = false; P.resolutionScale = 1; P.paused = false;
    for (const [k, v] of sets) P[k] = (v !== '' && !isNaN(+v)) ? +v : v === 'true' ? true : v === 'false' ? false : v;
    if (sets.length) window.engine.reset?.();
  }, sets);
  await page.evaluate(async () => {
    const t0 = performance.now();
    const S = { Tunnel: 'tunnel', Kaleido: 'kaleido', Plasma: 'plasma' };
    while (performance.now() - t0 < 30000) {
      const e = window.engine, m = e.P.mode;
      const ok = m === 'Landscape' ? (e.landscape?.ready || e.landscape?.error) : (S[m] && e.P.studio3d) ? (e.studio?.ready(S[m]) || e.studio?.errors[S[m]]) : true;
      if (ok) return;
      await new Promise((r) => setTimeout(r, 100));
    }
  });
  await page.addStyleTag({ content: 'body *{visibility:hidden !important} canvas#c{visibility:visible !important}' });
  await page.waitForTimeout(waitMs);
  const fps = await page.evaluate(async () => { const s = []; for (let i = 0; i < 6; i++) { await new Promise((r) => setTimeout(r, 400)); s.push(window.engine.getFps()); } return s; });
  const meta = await page.evaluate(() => { const e = window.engine, c = document.querySelector('canvas#c');
    return { canvas: { w: c.width, h: c.height }, mode: e.P.mode, stLook: e.P.stLook, stMat: e.P.stMat, landLook: e.P.landLook, tonemap: e.P.tonemapMode,
      audioReactive: e.P.audioReactive, studio: e.studio?.lastDebug ? { scene: e.studio.lastDebug.scene, tris: e.studio.lastDebug.tris, samples: e.studio.lastDebug.samples } : null,
      studioErrors: e.studio?.errors, landscapeError: e.landscape?.error || null }; });
  const file = resolve(outDir, `${label}.png`);
  await page.screenshot({ path: file, type: 'png' });
  // Motion proof: mean absolute RGB difference between this frame and one 1.0 s later (0-255 scale)
  await page.waitForTimeout(1000);
  const later = await page.screenshot({ type: 'png' });
  const [ra, rb] = await Promise.all([sharp(file).resize(480, 270).raw().toBuffer(), sharp(later).resize(480, 270).raw().toBuffer()]);
  let mad = 0; for (let i = 0; i < ra.length; i++) mad += Math.abs(ra[i] - rb[i]); mad /= ra.length;
  const avg = fps.reduce((a, b) => a + b, 0) / fps.length;
  report.shots.push({ label, query, file, motionMAD1s: +mad.toFixed(2), fpsAvg: +avg.toFixed(1), fps: fps.map((x) => +x.toFixed(1)), ...meta, consoleErrors: errors, pageErrors });
  console.log(JSON.stringify({ label, fps: +avg.toFixed(1), motionMAD1s: +mad.toFixed(2), mode: meta.mode, look: meta.stLook, errors: errors.length, pageErrors: pageErrors.length }));
  if (errors.length || pageErrors.length) console.log('  errors:', errors.slice(0, 3), pageErrors.slice(0, 3));
  await page.close();
}
writeFileSync(resolve(outDir, 'capture-report.json'), JSON.stringify(report, null, 2));
await browser.close();
const bad = report.shots.filter((s) => s.pageErrors.length || s.consoleErrors.length).length;
console.log(`done: ${report.shots.length} shots, ${bad} with errors`);
if (bad) process.exitCode = 2;
