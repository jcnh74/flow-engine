import sharp from 'sharp';
const dir = (process.env.DIR || '/Users/Apple/flow-pass4-work/final') + '/';
const items = process.argv.slice(2);
const W = 640, H = 360, cols = 3, pad = 12, lab = 34;
const rows = Math.ceil(items.length / cols);
const comps = [];
for (let i = 0; i < items.length; i++) {
  const [file, label] = items[i].split('=');
  const x = pad + (i % cols) * (W + pad), y = pad + Math.floor(i / cols) * (H + lab + pad);
  comps.push({ input: await sharp(dir + file).resize(W, H).toBuffer(), left: x, top: y });
  const svg = `<svg width="${W}" height="${lab}"><text x="4" y="24" font-family="Helvetica" font-size="20" fill="#eee">${label}</text></svg>`;
  comps.push({ input: Buffer.from(svg), left: x, top: y + H });
}
await sharp({ create: { width: pad + cols * (W + pad), height: pad + rows * (H + lab + pad), channels: 3, background: '#1b1b1f' } }).composite(comps).png().toFile(dir + 'contact_sheet.png');
console.log('ok');
