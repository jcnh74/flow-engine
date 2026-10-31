// Local-only dev server + tile stitch helper (sharp). Binds to 127.0.0.1.
import { defineConfig } from 'vite';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
let vid = null;
const OUT = path.resolve('out');
const jobs = new Map();
function body(req) { return new Promise((res, rej) => { const c = []; req.on('data', d => c.push(d)); req.on('end', () => res(Buffer.concat(c))); req.on('error', rej); }); }
function pdfWrapJpeg(jpg, w, h, wPt, hPt) {
  const objs = [];
  objs.push('<< /Type /Catalog /Pages 2 0 R >>');
  objs.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${wPt} ${hPt}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  const content = `q ${wPt} 0 0 ${hPt} 0 0 cm /Im0 Do Q`;
  const parts = []; const offsets = []; let len = 0;
  const push = b => { const buf = Buffer.isBuffer(b) ? b : Buffer.from(b, 'binary'); parts.push(buf); len += buf.length; };
  push('%PDF-1.4\n');
  objs.forEach((o, i) => { offsets.push(len); push(`${i + 1} 0 obj\n${o}\nendobj\n`); });
  offsets.push(len); push(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`); push(jpg); push('\nendstream\nendobj\n');
  offsets.push(len); push(`5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);
  const xref = len;
  push(`xref\n0 6\n0000000000 65535 f \n${offsets.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return Buffer.concat(parts);
}
const helper = () => ({
  name: 'stitch-helper',
  configureServer(server) {
    fs.mkdirSync(OUT, { recursive: true });
    server.middlewares.use(async (req, res, next) => {
      if (!req.url.startsWith('/api/')) return next();
      const u = new URL(req.url, 'http://x'); const q = Object.fromEntries(u.searchParams);
      try {
        if (u.pathname === '/api/log') { const b = await body(req); fs.appendFileSync(path.join(OUT, 'app.log'), new Date().toISOString() + ' ' + b.toString() + '\n'); return res.end('ok'); }
        if (u.pathname === '/api/vstart') {
          const name = q.name.replace(/[^\w.-]/g, '_'); const file = path.join(OUT, name + '.mp4');
          const ff = spawn('/opt/homebrew/bin/ffmpeg', ['-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${q.w}x${q.h}`, '-r', q.fps || '60', '-i', '-', '-vf', 'vflip', '-c:v', 'libx264', '-preset', 'medium', '-crf', q.crf || '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', file], { stdio: ['pipe', 'ignore', 'pipe'] });
          let err = ''; ff.stderr.on('data', d => { err = (err + d).slice(-2000); });
          vid = { ff, file, done: new Promise(r => ff.on('close', c => r({ code: c, err }))) }; return res.end('ok');
        }
        if (u.pathname === '/api/vframe') { const b = await body(req); if (!vid.ff.stdin.write(b)) await new Promise(r => vid.ff.stdin.once('drain', r)); return res.end('ok'); }
        if (u.pathname === '/api/vend') { vid.ff.stdin.end(); const r = await vid.done; const size = fs.existsSync(vid.file) ? fs.statSync(vid.file).size : 0; fs.appendFileSync(path.join(OUT, 'app.log'), `${new Date().toISOString()} video ${vid.file} size=${size} code=${r.code}\n`); res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify({ file: vid.file, size, code: r.code, err: r.code ? r.err : '' })); }
        if (u.pathname === '/api/tile') {
          const b = await body(req); const j = jobs.get(q.job) || { tiles: [] }; jobs.set(q.job, j);
          j.tiles.push({ input: b, raw: { width: +q.w, height: +q.h, channels: 4 }, left: +q.x, top: +q.y });
          return res.end('ok');
        }
        if (u.pathname === '/api/finish') {
          const j = jobs.get(q.job); const W = +q.W, H = +q.H; const name = q.name.replace(/[^\w.-]/g, '_');
          const t0 = Date.now();
          const raw = await sharp({ create: { width: W, height: H, channels: 4, background: '#000' }, limitInputPixels: false })
            .composite(j.tiles).raw().toBuffer();
          const img = () => sharp(raw, { raw: { width: W, height: H, channels: 4 }, limitInputPixels: false }).removeAlpha();
          const dpi = +q.dpi || 300; const files = [];
          const png = path.join(OUT, name + '.png'); await img().withMetadata({ density: dpi }).png({ compressionLevel: 6 }).toFile(png); files.push(png);
          if (q.tiff === '1') { const t = path.join(OUT, name + '.tif'); await img().withMetadata({ density: dpi }).tiff({ compression: 'lzw' }).toFile(t); files.push(t); }
          const pv = path.join(OUT, name + '_preview.jpg'); await img().resize({ width: Math.min(1920, W), height: Math.min(1920, H), fit: 'inside' }).jpeg({ quality: 88 }).toFile(pv); files.push(pv);
          if (q.pdf === '1') { const jpg = await img().jpeg({ quality: 95 }).toBuffer(); const p = path.join(OUT, name + '.pdf'); fs.writeFileSync(p, pdfWrapJpeg(jpg, W, H, W / dpi * 72, H / dpi * 72)); files.push(p); }
          jobs.delete(q.job);
          fs.appendFileSync(path.join(OUT, 'app.log'), `${new Date().toISOString()} stitched ${name} ${W}x${H} in ${Date.now() - t0}ms\n`);
          res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify({ files }));
        }
        res.statusCode = 404; res.end('nf');
      } catch (e) { res.statusCode = 500; res.end(String(e)); }
    });
  }
});
export default defineConfig({ plugins: [helper()], server: { host: '127.0.0.1', port: 5190 } });
