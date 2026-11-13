// Pass 3: Blender studio scenes (Tunnel / Kaleido / Plasma) + studio-look presets
import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { parseGlb, parseCameraPath } from '../src/gltf';
import { STUDIO_LOOKS, STUDIO_MATS, invert } from '../src/studio';
import { PRESET_GALLERY, STUDIO_PRESETS } from '../src/presets';
import { isRetiredMode } from '../src/lineup';
import { LAND_LOOKS } from '../src/landscape';

const SCENES = ['tunnel', 'kaleido', 'plasma'];

describe('studio GLB scenes', () => {
  for (const name of SCENES) {
    test(`${name}.glb parses with baked AO + slot/material/layer encoding`, () => {
      const buf = readFileSync(`public/studio/${name}.glb`);
      const m = parseGlb(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
      const meta = JSON.parse(readFileSync(`public/studio/${name}.json`, 'utf8'));
      const nv = m.positions.length / 3;
      expect(nv).toBeGreaterThan(10000);
      expect(m.indices.length % 3).toBe(0);
      let aoMin = 1, aoMax = 0, maxLayer = 0; const slots = new Set<number>();
      for (let i = 0; i < nv; i++) {
        const ao = m.colors[i * 4]; aoMin = Math.min(aoMin, ao); aoMax = Math.max(aoMax, ao);
        slots.add(Math.round(m.colors[i * 4 + 1] * 7));
        maxLayer = Math.max(maxLayer, Math.round(m.colors[i * 4 + 3] * 7));
        expect(Math.round(m.colors[i * 4 + 2] * 3)).toBeLessThanOrEqual(3);
      }
      expect(aoMax - aoMin).toBeGreaterThan(0.3); // real occlusion, not a constant
      expect(slots.size).toBeGreaterThanOrEqual(4);
      expect(maxLayer).toBeLessThanOrEqual(meta.layers.length);
      expect(meta.stats.ao).toBe('cycles');
      if (meta.camera.type === 'path') {
        const p = parseCameraPath(meta.camera);
        expect(p.loop).toBe(true);
        expect(p.samples.length).toBeGreaterThan(100);
      } else {
        expect(meta.camera.type).toBe('orbit');
        expect(meta.camera.radius).toBeGreaterThan(2);
      }
      // floor (slot 7) exists for cove scenes, not for the tunnel
      expect(slots.has(7)).toBe(name !== 'tunnel');
    });
  }
});

describe('studio looks + presets', () => {
  test('every look has 7 slot colours and valid hex', () => {
    for (const [n, l] of Object.entries(STUDIO_LOOKS)) {
      expect(l.slots.length).toBe(7);
      for (const h of [l.bgTop, l.bgBottom, l.glow, l.key, l.fill, l.rim, l.dome, ...l.slots]) expect(h).toMatch(/^#[0-9a-f]{6}$/i);
      expect(n.length).toBeGreaterThan(2);
    }
  });
  test('2-3 studio presets per mode, all in the gallery, audio off, valid look/material', () => {
    const per: Record<string, number> = {};
    for (const p of STUDIO_PRESETS) {
      per[p.mode] = (per[p.mode] ?? 0) + 1;
      // pass 5: retired modes (Tunnel, Kaleido) keep their presets in ALL_PRESETS but leave the gallery
      expect(PRESET_GALLERY.includes(p)).toBe(!isRetiredMode(p.mode));
      expect(p.params.audioReactive).toBe(false);
      expect(STUDIO_LOOKS[p.params.stLook]).toBeDefined();
      expect(STUDIO_MATS).toContain(p.params.stMat);
      if (p.params.landLook) expect(LAND_LOOKS[p.params.landLook]).toBeDefined();
      // gallery lookup uses substring match: the full name must resolve to this preset
      if (!isRetiredMode(p.mode)) expect(PRESET_GALLERY.find((g) => g.name.toLowerCase().includes(p.name.toLowerCase()))).toBe(p);
    }
    for (const m of ['Tunnel', 'Kaleido', 'Plasma', 'Morph', '3D Fractal', 'Wall Studio', 'Landscape']) {
      expect(per[m]).toBeGreaterThanOrEqual(2);
      expect(per[m]).toBeLessThanOrEqual(3);
    }
  });
  test('matrix invert round-trips', () => {
    const m = [2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 4, 0, 1, 2, 3, 1];
    const i = invert(m);
    const o = new Array(16).fill(0);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += m[k * 4 + r] * i[c * 4 + k];
    o.forEach((v, idx) => expect(v).toBeCloseTo(idx % 5 === 0 ? 1 : 0, 6));
  });
});
