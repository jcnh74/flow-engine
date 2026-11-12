// Screenshot the control panel for given modes (real Chrome), exercising a preset load to prove live binding.
// Usage: node scripts/panel-shot.mjs OUTDIR "Gravity=Monsoon" "Stargate=Hyperdrive" ...
// Original MIT-licensed work for flow-engine.
import { chromium } from 'playwright';
const [out, ...items] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--no-first-run'] });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
for (const it of items) {
  const [mode, preset] = it.split('=');
  const page = await ctx.newPage(); const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); }); page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`http://127.0.0.1:5197/?mode=${encodeURIComponent(mode)}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  const panel = page.locator('.flow-panel');
  const before = await page.evaluate(() => ({ ...window.engine.P }));
  if (preset) {
    await page.selectOption(`.mode-presets [data-mp-select]`, preset);
    await page.click(`.mode-presets [data-action="mp:load"]`);
    await page.waitForTimeout(1500);
  }
  const after = await page.evaluate(() => ({ ...window.engine.P }));
  const changed = Object.keys(after).filter((k) => typeof after[k] !== 'object' && after[k] !== before[k]).map((k) => `${k}:${before[k]}→${after[k]}`);
  // scroll the panel body so the mode's own sections are in view
  await page.evaluate(() => { const b = document.querySelector('.flow-panel .panel-body'); const s = document.querySelector('.mode-presets'); if (b && s) b.scrollTop = (s.closest('.panel-section')?.offsetTop ?? 0) - 40; });
  await page.waitForTimeout(400);
  const file = `${out}/controls_${mode.replace(/\s+/g, '_').toLowerCase()}.png`;
  await page.screenshot({ path: file });
  const knobs = await page.locator('.knob').count(); const sliders = await page.locator('.control-slider').count(); const selects = await page.locator('select.control-select').count();
  console.log(JSON.stringify({ mode, preset, file, knobs, sliders, selects, changed: changed.slice(0, 14), errors: errs }));
  await page.close();
}
await browser.close();
