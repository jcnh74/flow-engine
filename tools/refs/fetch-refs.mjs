// Reference gatherer: opens a public image search in real Chrome, screenshots the grid,
// then clicks the first N results and saves the larger preview image (for internal style reference only).
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const out = resolve(process.argv[2] || 'out-landscape/pass3/ref-c4d');
const q = process.argv[3] || 'cinema4d studio abstract color look';
const n = +(process.argv[4] || 16);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--no-first-run', '--disable-sync'] });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1085 }, locale: 'en-US' });
const page = await ctx.newPage();
await page.goto(`https://www.google.com/search?q=${encodeURIComponent(q)}&udm=2&hl=en`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(3000);
for (const label of ['Accept all', 'Reject all', 'I agree']) {
  const b = page.getByRole('button', { name: label });
  if (await b.count()) { await b.first().click().catch(() => {}); await page.waitForTimeout(1500); break; }
}
await page.screenshot({ path: resolve(out, '00-google-grid.png') });
console.log('title', await page.title(), page.url());
const thumbs = page.locator('div[data-attrid="images universal"] img, g-img img, div[jsname] > div > a img');
const count = await thumbs.count();
console.log('thumbs', count);
const saved = [];
for (let i = 0; i < Math.min(count, n * 2) && saved.length < n; i++) {
  try {
    const t = thumbs.nth(i);
    const box = await t.boundingBox();
    if (!box || box.width < 80) continue;
    await t.click({ timeout: 4000 });
    await page.waitForTimeout(2200);
    const src = await page.evaluate(() => {
      const imgs = [...document.querySelectorAll('img')].filter((im) => im.src.startsWith('http') && !im.src.includes('gstatic') && im.naturalWidth >= 400);
      imgs.sort((a, b) => b.naturalWidth * b.naturalHeight - a.naturalWidth * a.naturalHeight);
      const im = imgs[0];
      return im ? { src: im.src, w: im.naturalWidth, h: im.naturalHeight, page: (im.closest('a') || {}).href || null } : null;
    });
    if (!src || saved.some((s) => s.src === src.src)) { await page.keyboard.press('Escape'); continue; }
    const r = await ctx.request.get(src.src, { timeout: 15000 }).catch(() => null);
    if (r && r.ok()) {
      const ct = r.headers()['content-type'] || '';
      const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg';
      const f = resolve(out, `ref-${String(saved.length + 1).padStart(2, '0')}.${ext}`);
      writeFileSync(f, await r.body());
      saved.push({ ...src, file: f });
      console.log('saved', f, src.w + 'x' + src.h, src.src.slice(0, 120));
    }
    await page.keyboard.press('Escape');
  } catch (e) { console.log('skip', i, String(e).slice(0, 100)); }
}
writeFileSync(resolve(out, 'sources.json'), JSON.stringify(saved, null, 2));
await browser.close();
