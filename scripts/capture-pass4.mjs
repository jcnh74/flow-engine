#!/usr/bin/env node
/**
 * Pass-4 capture: real Chrome + ANGLE/Metal at 1920x1080, UI hidden, no audio.
 * For each target "label|query" (query may carry set=key:value;key:value applied to engine.P after boot):
 *   1. waits for the physical scene to be ready, settles, samples engine fps for 3 s (no recording running),
 *   2. takes a PNG still, measures 1 s motion MAD,
 *   3. records --secs seconds via the DevTools screencast (frames exactly as Chrome composited them) and
 *      encodes them to H.264 MP4 at 30 fps with ffmpeg using the real frame timestamps.
 * Does not start servers; only talks to --url.
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { copyFileSync, existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const urlBase = arg('url', 'http://127.0.0.1:5197').replace(/\/$/, '');
const outDir = resolve(arg('out', 'out-landscape/pass4'));
const secs = +arg('secs', '8');
const waitMs = +arg('wait', '5000');
const noVideo = process.argv.includes('--no-video');
mkdirSync(outDir, { recursive: true });
const targets = arg('only', '').split(',').map((t) => t.trim()).filter(Boolean);
const browser = await chromium.launch({ channel: 'chrome', headless: false,
  args: ['--disable-sync', '--no-first-run', '--use-angle=metal', '--ignore-gpu-blocklist', '--enable-webgl', '--enable-webgl2', '--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const report = { url: urlBase, resolution: '1920x1080', shots: [] };
for (const t of targets) {
  const [label, query] = t.split('|');
  const qs = new URLSearchParams(query);
  const sets = (qs.get('set') || '').split(';').filter(Boolean).map((kv) => { const i = kv.indexOf(':'); return [kv.slice(0, i), kv.slice(i + 1)]; });
  qs.delete('set');
  const page = await context.newPage();
  const errors = [], pageErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => pageErrors.push(e.message || String(e)));
  await page.goto(`${urlBase}/?${qs.toString()}`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.evaluate((sets) => {
    const P = window.engine.P; P.autoQuality = false; P.resolutionScale = 1; P.paused = false;
    for (const [k, v] of sets) P[k] = (v !== '' && !isNaN(+v)) ? +v : v === 'true' ? true : v === 'false' ? false : v;
  }, sets);
  const readyInfo = await page.evaluate(async () => {
    const t0 = performance.now();
    while (performance.now() - t0 < 60000) { const s = window.engine.phys.stats(window.engine.P.mode); if (s && (s.ready || s.error)) return s; await new Promise((r) => setTimeout(r, 100)); }
    return { timeout: true };
  });
  await page.addStyleTag({ content: 'body *{visibility:hidden !important} canvas#c{visibility:visible !important}' });
  await page.waitForTimeout(waitMs);
  const fps = await page.evaluate(async () => { const s = []; for (let i = 0; i < 8; i++) { await new Promise((r) => setTimeout(r, 400)); s.push(window.engine.getFps()); } return s; });
  const still = join(outDir, `${label}.png`);
  await page.screenshot({ path: still, type: 'png' });
  await page.waitForTimeout(1000);
  const later = await page.screenshot({ type: 'png' });
  const [ra, rb] = await Promise.all([sharp(still).resize(480, 270).raw().toBuffer(), sharp(later).resize(480, 270).raw().toBuffer()]);
  let mad = 0; for (let i = 0; i < ra.length; i++) mad += Math.abs(ra[i] - rb[i]); mad /= ra.length;
  const stats = await page.evaluate(() => { const e = window.engine; const c = document.querySelector('canvas#c'); return { canvas: [c.width, c.height], mode: e.P.mode, look: e.P.phLook, mat: e.P.phMat, variant: e.P.phVariant, scene: e.phys.stats(e.P.mode) }; });
  let video = null, recFps = null;
  if (!noVideo) {
    const fdir = join(outDir, `.frames-${label}`); mkdirSync(fdir, { recursive: true });
    const cdp = await context.newCDPSession(page); const frames = [];
    cdp.on('Page.screencastFrame', async (ev) => { frames.push({ ts: ev.metadata.timestamp, data: ev.data }); cdp.send('Page.screencastFrameAck', { sessionId: ev.sessionId }).catch(() => {}); });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
    const fpsRec = [];
    const tEnd = Date.now() + secs * 1000 + 300;
    while (Date.now() < tEnd) { await page.waitForTimeout(500); fpsRec.push(await page.evaluate(() => window.engine.getFps())); }
    await cdp.send('Page.stopScreencast');
    recFps = +(fpsRec.reduce((a, b) => a + b, 0) / fpsRec.length).toFixed(1);
    // concat list with real durations
    let list = '';
    frames.forEach((fr, i) => { const fn = join(fdir, `f${String(i).padStart(5, '0')}.jpg`); writeFileSync(fn, Buffer.from(fr.data, 'base64'));
      const d = i + 1 < frames.length ? frames[i + 1].ts - fr.ts : 1 / 30; list += `file '${fn}'\nduration ${Math.max(0.001, d).toFixed(4)}\n`; });
    writeFileSync(join(fdir, 'list.txt'), list);
    video = join(outDir, `${label}.mp4`);
    // resample the real-timestamped screencast to a constant 30 fps (latest frame at or before each tick)
    const sdir = join(fdir, 'seq'); mkdirSync(sdir, { recursive: true });
    const t0 = frames.length ? frames[0].ts : 0, tLast = frames.length ? frames[frames.length - 1].ts : 0;
    let j = 0, nOut = 0;
    for (let k = 0; t0 + k / 30 <= tLast + 1e-6; k++) { while (j + 1 < frames.length && frames[j + 1].ts <= t0 + k / 30) j++;
      copyFileSync(join(fdir, `f${String(j).padStart(5, '0')}.jpg`), join(sdir, `s${String(k).padStart(5, '0')}.jpg`)); nOut++; }
    try {
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(fdir, 'list.txt'), '-vf', 'fps=30,scale=1920:1080:flags=lanczos,format=yuv420p',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-movflags', '+faststart', video], { stdio: 'pipe' });
      stats.encoder = 'ffmpeg libx264 crf17';
    } catch (e) {
      // system ffmpeg broken (e.g. missing dylib): use Blender's bundled FFmpeg on the same resampled sequence
      execFileSync(process.env.BLENDER || '/opt/homebrew/bin/blender', ['-b', '--factory-startup', '-P', join(process.cwd(), 'tools/blender/pass4/encode_seq.py'), '--', sdir, 's', String(nOut), video, '30', '1920', '1080'], { stdio: 'pipe' });
      if (!existsSync(video)) throw new Error('blender encode produced no file');
      stats.encoder = 'blender-ffmpeg h264 crf~17 (system ffmpeg unavailable)';
    }
    const span = frames.length > 1 ? frames[frames.length - 1].ts - frames[0].ts : 0;
    stats.screencast = { encoder: stats.encoder, frames: frames.length, seconds: +span.toFixed(2), deliveredFps: +(frames.length / Math.max(span, 1e-3)).toFixed(1) };
  }
  const avg = fps.reduce((a, b) => a + b, 0) / fps.length;
  const rec = { label, query, still, video, fpsAvg: +avg.toFixed(1), fps: fps.map((x) => +x.toFixed(1)), fpsWhileRecording: recFps, motionMAD1s: +mad.toFixed(2), ready: readyInfo, ...stats, consoleErrors: errors, pageErrors };
  report.shots.push(rec);
  console.log(JSON.stringify({ label, fps: rec.fpsAvg, recFps, mad: rec.motionMAD1s, scene: stats.scene, screencast: stats.screencast, errors: errors.length, pageErrors: pageErrors.length }));
  if (errors.length || pageErrors.length) console.log('  errors:', errors.slice(0, 4), pageErrors.slice(0, 4));
  await page.close();
}
const prev = (() => { try { return JSON.parse(readFileSync(join(outDir, 'capture-report.json'), 'utf8')); } catch { return { shots: [] }; } })();
const merged = [...prev.shots.filter((s) => !report.shots.some((r) => r.label === s.label)), ...report.shots];
writeFileSync(join(outDir, 'capture-report.json'), JSON.stringify({ ...report, shots: merged }, null, 2));
await browser.close();
const bad = report.shots.filter((s) => s.pageErrors.length || s.consoleErrors.length).length;
console.log(`done: ${report.shots.length} targets, ${bad} with errors`);
if (bad) process.exitCode = 2;
