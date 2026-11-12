import { describe, test, expect } from 'bun:test';
import { readFileSync, statSync } from 'fs';
import { join } from 'path';
import { BallSim, SECTIONS, SECTION_ORDER } from '../src/physical/balls_sim';
import { CascadeSim } from '../src/physical/cascade';

const root = join(import.meta.dir, '..');
const pub = (f: string) => join(root, 'public/pass4', f);
const src = (f: string) => readFileSync(join(root, 'src', f), 'utf-8');
const MB = 1024 * 1024;

describe('pass 4 physical scenes: assets', () => {
  test('fabric VAT matches its metadata and stays under 60 MB', () => {
    const m = JSON.parse(readFileSync(pub('fabric.json'), 'utf-8'));
    expect(m.format).toBe('rgb16f');
    const size = statSync(pub('fabric.vat')).size;
    expect(size).toBe(m.nx * m.ny * m.frames * 3 * 2);
    expect(size).toBeLessThan(60 * MB);
    expect(m.frames).toBeGreaterThanOrEqual(120);
  });
  test('jungle prototypes are consistent with the binary', () => {
    const m = JSON.parse(readFileSync(pub('jungle.json'), 'utf-8'));
    const size = statSync(pub('jungle.bin')).size;
    expect(size).toBe(m.vertexBytes + m.indexCount * 4);
    expect(size).toBeLessThan(60 * MB);
    expect(m.protos.length).toBeGreaterThanOrEqual(8);
    for (const n of ['orchid', 'heliconia', 'bromeliad', 'palm', 'monstera', 'fern', 'hibiscus']) expect(m.protos.map((p: { name: string }) => p.name)).toContain(n);
    expect(m.protos.some((p: { kind: string }) => p.kind === 'flower')).toBe(true);
    expect(m.protos.some((p: { kind: string }) => p.kind === 'leaf')).toBe(true);
  });
});

describe('pass 5 city vortex: assets', () => {
  test('city kit is consistent with the binary and has every prototype', () => {
    const m = JSON.parse(readFileSync(pub('city.json'), 'utf-8'));
    const size = statSync(pub('city.bin')).size;
    expect(size).toBe(m.vertexBytes + m.indexCount * 4);
    expect(size).toBeLessThan(60 * MB);
    const names = m.protos.map((p: { name: string }) => p.name);
    for (const n of ['taxi', 'bus', 'traffic_light', 'street_lamp', 'sign', 'hydrant', 'bench', 'street', 'crosswalk']) expect(names).toContain(n);
    expect(m.protos.filter((p: { kind: string }) => p.kind === 'tower').length).toBeGreaterThanOrEqual(4);
  });
});

describe('pass 4 physical scenes: gravity sim', () => {
  test('emits sectional palettes, collides and recycles balls without leaking', () => {
    const s = new BallSim(1100);
    const seen = new Set<number>();
    let maxAlive = 0;
    for (let f = 0; f < 60 * 20; f++) {
      s.step(1 / 60, 4);
      maxAlive = Math.max(maxAlive, s.stats.alive);
      if (f % 60 === 0) for (let i = 0; i < s.N; i++) if (s.alive[i]) seen.add(s.section[i]);
    }
    expect(s.stats.alive).toBeGreaterThan(200);
    expect(maxAlive).toBeLessThanOrEqual(1100);
    expect(s.stats.contacts).toBeGreaterThan(50);
    expect(seen.size).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < s.N; i++) if (s.alive[i]) { expect(Number.isFinite(s.px[i])).toBe(true); expect(Number.isFinite(s.vy[i])).toBe(true); }
  });
  test('every section has its own palette band', () => {
    expect(SECTION_ORDER.length).toBe(5);
    for (const k of SECTION_ORDER) expect(SECTIONS[k].length).toBeGreaterThanOrEqual(3);
  });
});

describe('pass 4 physical scenes: wiring', () => {
  test('modes are registered in main and the panel', () => {
    const main = src('main.ts'), ui = src('ui/MainControlPanel.ts'), idx = src('physical/index.ts');
    for (const m of ['Fabric', 'Gravity', 'Paint', 'Jungle', 'City Vortex', 'Stargate', 'Paint Pour']) {
      expect(idx).toContain(`'${m}'`.replace(/^'(\w+)'$/, '$1'));
      expect(main).toContain(`'${m}'`);
      expect(ui).toContain(`'${m}'`);
    }
    expect(main).toContain('PHYS_MODES[P.mode]');
  });
  test('shaders are GLSL ES 3.00 and the loop-critical pieces are present', () => {
    for (const f of ['stargate', 'paint', 'balls', 'cascade', 'fabric', 'jungle', 'city']) expect(src(`physical/${f}.ts`)).toContain('#version 300 es');
    expect(src('physical/fabric.ts')).toContain('uTime/12.0');          // wave cloth periodic in 12 s
    expect(src('physical/paint.ts')).toContain('uGravV');               // gravity-driven paint
  });
  test('gravity cascade: waves of thousands of balls run down the terraces toward the camera without NaNs', () => {
    const sim = new CascadeSim(3000);
    for (let i = 0; i < 60 * 8; i++) sim.step(1 / 60, 1, i % 30 === 0);
    expect(sim.stats.alive).toBeGreaterThan(1500);
    expect(sim.wave).toBeGreaterThanOrEqual(3);
    let maxZ = -1e9;
    for (let i = 0; i < sim.N; i++) if (sim.alive[i]) { expect(Number.isFinite(sim.px[i] + sim.py[i] + sim.pz[i])).toBe(true); maxZ = Math.max(maxZ, sim.pz[i]); }
    expect(maxZ).toBeGreaterThan(0);   // the surge reaches the floor in front of the terraces
  });
});
