// Labeled grid: node tools/refs/grid.mjs out.jpg cols tileW tileH files...
import sharp from 'sharp';
const [out, cols, tw, th, ...files] = process.argv.slice(2);
const C = +cols, W = +tw, H = +th, rows = Math.ceil(files.length / C);
const tiles = await Promise.all(files.map(async (f, i) => {
  const label = Buffer.from(`<svg width="${W}" height="${H}"><rect x="0" y="0" width="${Math.min(W, 22 + f.split('/').pop().length * 11)}" height="26" fill="black" opacity="0.6"/><text x="6" y="19" font-size="18" font-family="Helvetica" fill="white">${f.split('/').pop()}</text></svg>`);
  try { return await sharp(f).resize(W, H, { fit: 'cover' }).composite([{ input: label }]).toBuffer(); }
  catch { return await sharp({ create: { width: W, height: H, channels: 3, background: '#400' } }).composite([{ input: label }]).png().toBuffer(); }
}));
await sharp({ create: { width: W * C, height: H * rows, channels: 3, background: '#111' } })
  .composite(tiles.map((b, i) => ({ input: b, left: (i % C) * W, top: Math.floor(i / C) * H }))).jpeg({ quality: 85 }).toFile(out);
console.log('wrote', out);
