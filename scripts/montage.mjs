// Contact sheet for review: bun scripts/montage.mjs out.jpg a.png b.png ... (2 columns, 960x540 tiles)
import sharp from 'sharp';
const [out, ...files] = process.argv.slice(2);
const W = 960, H = 540, cols = files.length > 1 ? 2 : 1, rows = Math.ceil(files.length / cols);
const tiles = await Promise.all(files.map((f) => sharp(f).resize(W, H, { fit: 'cover' }).toBuffer()));
await sharp({ create: { width: W * cols, height: H * rows, channels: 3, background: '#000' } })
  .composite(tiles.map((b, i) => ({ input: b, left: (i % cols) * W, top: Math.floor(i / cols) * H })))
  .jpeg({ quality: 86 }).toFile(out);
console.log('wrote', out);
