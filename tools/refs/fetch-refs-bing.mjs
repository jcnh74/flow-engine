// Reference gatherer (Bing Images in real Chrome): reads result metadata (original image URL + source page)
// and saves the images for internal style reference only. Google Images returned a captcha page.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const out = resolve(process.argv[2]);
const queries = process.argv.slice(3);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--no-first-run', '--disable-sync'] });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1085 }, locale: 'en-US' });
const page = await ctx.newPage();
const all = [];
for (const [qi, q] of queries.entries()) {
  await page.goto(`https://www.bing.com/images/search?q=${encodeURIComponent(q)}&qft=+filterui:imagesize-large&form=IRFLTR`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: resolve(out, `grid-${qi}.png`) });
  const items = await page.evaluate(() => [...document.querySelectorAll('a.iusc')].map((a) => { try { const m = JSON.parse(a.getAttribute('m')); return { murl: m.murl, purl: m.purl, t: m.t, turl: m.turl }; } catch { return null; } }).filter(Boolean));
  console.log(q, '->', items.length);
  items.slice(0, 30).forEach((it, i) => all.push({ q, rank: i, ...it }));
}
writeFileSync(resolve(out, 'candidates.json'), JSON.stringify(all, null, 2));
let k = 0;
for (const it of all) {
  if (k >= 40) break;
  const r = await ctx.request.get(it.murl, { timeout: 12000 }).catch(() => null);
  if (!r || !r.ok()) continue;
  const ct = r.headers()['content-type'] || '';
  if (!ct.startsWith('image/')) continue;
  const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg';
  const f = resolve(out, `cand-${String(++k).padStart(2, '0')}.${ext}`);
  writeFileSync(f, await r.body());
  it.file = f;
  console.log('saved', f, it.purl);
}
writeFileSync(resolve(out, 'candidates.json'), JSON.stringify(all, null, 2));
await browser.close();
