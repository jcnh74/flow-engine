import { describe, test, expect } from 'bun:test';
import { readFileSync, statSync } from 'fs';
import { join } from 'path';
import { BallSim, SECTIONS, SECTION_ORDER } from '../src/physical/balls_sim';
import { CascadeSim } from '../src/physical/cascade';
import { ColorRoomSim } from '../src/physical/colorroom';

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
    const lineup = src('lineup.ts');
    for (const m of ['Fabric', 'Gravity', 'Paint', 'Jungle', 'City Vortex', 'Stargate', 'Paint Pour', 'Bead Knot', 'Mirror Mandala', 'Feather Vortex', 'Crystal Temple']) {
      expect(idx).toContain(`'${m}'`);
      expect(ui).toContain(`'${m}'`);
    }
    for (const m of ['Paint', 'Paint Pour', 'City Vortex', 'Jungle', 'Stargate', 'Fabric', 'Bead Knot', 'Mirror Mandala', 'Feather Vortex', 'Crystal Temple']) {
      expect(lineup).toContain(`'${m}'`);
    }
    expect(main).toContain('PHYS_MODES[P.mode]');
    expect(main).toContain('LINEUP_MODES');
  });
  test('shaders are GLSL ES 3.00 and the loop-critical pieces are present', () => {
    for (const f of ['stargate', 'paint', 'balls', 'cascade', 'fabric', 'jungle', 'city', 'beadknot', 'mandala', 'feathervortex']) expect(src(`physical/${f}.ts`)).toContain('#version 300 es');
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

describe('pass 8 lineup retirements', () => {
  test('legacy modes and paused Gravity are hidden from the mode lists and presets (code kept)', async () => {
    const { PRESET_GALLERY, ALL_PRESETS } = await import('../src/presets');
    const { isRetiredMode, LINEUP_MODES } = await import('../src/lineup');
    expect(PRESET_GALLERY.some((p) => isRetiredMode(p.mode))).toBe(false);
    expect(ALL_PRESETS.some((p) => p.mode === 'Tunnel')).toBe(true);
    expect(ALL_PRESETS.some((p) => p.mode === 'Landscape')).toBe(true);
    const fs = await import('fs');
    const main = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
    const gui = main.split('\n').find((l) => l.startsWith("gui.add(P, 'mode'"))!;
    expect(gui).toContain('LINEUP_MODES');
    for (const m of ['Gravity', 'Tunnel', 'Kaleido', 'Landscape', 'Morph', 'Plasma', 'Wall Studio']) {
      expect(gui).not.toContain(`'${m}'`);
    }
    expect(main).toContain('LINEUP_MODES');
    expect(main).toContain("} else if (P.mode === 'Tunnel') {");
  });
});

describe('pass 6 gravity color room', () => {
  test('drops single-colour clumps that splash, mix and recycle without NaNs or leaks', () => {
    const sim = new ColorRoomSim(3000); sim.P.dropSize = 600; sim.P.dropEvery = 1.5;
    let maxUp = 0;
    for (let i = 0; i < 60 * 10; i++) { sim.step(1 / 60, 1, i % 30 === 0); for (let k = 0; k < sim.N; k += 7) if (sim.alive[k]) maxUp = Math.max(maxUp, sim.vy[k]); }
    expect(sim.drop).toBeGreaterThanOrEqual(5);
    expect(maxUp).toBeGreaterThan(2);          // balls really bounce back up
    let alive = 0; for (let i = 0; i < sim.N; i++) if (sim.alive[i]) { alive++; expect(Number.isFinite(sim.px[i] + sim.py[i] + sim.pz[i])).toBe(true); }
    expect(alive).toBeGreaterThan(300); expect(alive).toBeLessThanOrEqual(sim.N);
  });
});
