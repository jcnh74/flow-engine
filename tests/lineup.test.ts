import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'fs';
import {
  LINEUP_MODES, RETIRED_MODES, VALID_MODES, DEFAULT_MODE, MODE_ALIASES,
  resolveMode, isLineupMode, isRetiredMode,
} from '../src/lineup';
import { PRESET_GALLERY, ALL_PRESETS } from '../src/presets';
import { MODE_CONTROLS } from '../src/modeControls';

const src = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

describe('pass 8 mode lineup', () => {
  test('the visible lineup is the new physical scenes plus 3D Fractal, default Jungle', () => {
    expect([...LINEUP_MODES]).toEqual([
      'Paint', 'Paint Pour', 'City Vortex', 'Jungle', 'Stargate', 'Fabric', '3D Fractal',
    ]);
    expect(DEFAULT_MODE).toBe('Jungle');
    expect(isLineupMode(DEFAULT_MODE)).toBe(true);
    expect(isRetiredMode('Gravity')).toBe(true);
    expect(isLineupMode('Gravity')).toBe(false);
    for (const m of ['Landscape', 'Morph', 'Plasma', 'Wall Studio', 'MilkDrop', '3D fabric', 'Liquid Spheres', 'Particle Fabric', '2D flow', 'Tunnel', 'Kaleido']) {
      expect(isRetiredMode(m)).toBe(true);
      expect(isLineupMode(m)).toBe(false);
    }
    expect(new Set(VALID_MODES).size).toBe(VALID_MODES.length);
    for (const m of LINEUP_MODES) expect(VALID_MODES).toContain(m);
    for (const m of RETIRED_MODES) expect(VALID_MODES).toContain(m);
  });

  test('old URLs and aliases fall back to Jungle; lineup names resolve', () => {
    expect(resolveMode(null)).toBe('Jungle');
    expect(resolveMode('')).toBe('Jungle');
    expect(resolveMode('nope')).toBe('Jungle');
    expect(resolveMode('Landscape')).toBe('Jungle');
    expect(resolveMode('landscape')).toBe('Jungle');
    expect(resolveMode('canyon')).toBe('Jungle');
    expect(resolveMode('Wall Studio')).toBe('Jungle');
    expect(resolveMode('wall')).toBe('Jungle');
    expect(resolveMode('Plasma')).toBe('Jungle');
    expect(resolveMode('Morph')).toBe('Jungle');
    expect(resolveMode('MilkDrop')).toBe('Jungle');
    expect(resolveMode('Tunnel')).toBe('Jungle');
    expect(resolveMode('Kaleido')).toBe('Jungle');
    expect(resolveMode('Gravity')).toBe('Jungle');
    expect(resolveMode('gravity')).toBe('Jungle');
    expect(resolveMode('3d')).toBe('Jungle');
    expect(resolveMode('2d')).toBe('Jungle');
    expect(resolveMode('spheres')).toBe('Jungle');
    expect(resolveMode('particles')).toBe('Jungle');
    expect(resolveMode('2D Fractal')).toBe('Jungle');
    expect(resolveMode('Grass Field')).toBe('Jungle');

    expect(resolveMode('jungle')).toBe('Jungle');
    expect(resolveMode('Paint')).toBe('Paint');
    expect(resolveMode('paint pour')).toBe('Paint Pour');
    expect(resolveMode('city')).toBe('City Vortex');
    expect(resolveMode('City Vortex')).toBe('City Vortex');
    expect(resolveMode('Stargate')).toBe('Stargate');
    expect(resolveMode('Fabric')).toBe('Fabric');
    expect(resolveMode('fractal')).toBe('3D Fractal');
    expect(resolveMode('3D Fractal')).toBe('3D Fractal');
  });

  test('menus, remote UI and the gallery only show lineup modes', () => {
    const main = src('src/main.ts');
    const ui = src('src/ui/MainControlPanel.ts');
    const remote = src('remote.html');
    const gui = main.split('\n').find((l) => l.startsWith("gui.add(P, 'mode'"))!;
    expect(gui).toContain('LINEUP_MODES');
    for (const m of ['Gravity', 'Tunnel', 'Kaleido', 'Landscape', 'Morph', 'Plasma', 'Wall Studio', 'MilkDrop']) {
      expect(gui).not.toContain(`'${m}'`);
    }
    expect(ui).toContain('LINEUP_MODES');
    expect(ui).toContain("this.buildSelect('mode', 'Mode', [...LINEUP_MODES])");
    expect(remote).toContain("const MODES = ['Paint', 'Paint Pour', 'City Vortex', 'Jungle', 'Stargate', 'Fabric', '3D Fractal']");
    expect(remote).not.toContain("'Wall Studio'");
    expect(remote).not.toContain("'Tunnel'");
    expect(remote).not.toContain("'MilkDrop'");

    expect(PRESET_GALLERY.some((p) => isRetiredMode(p.mode))).toBe(false);
    expect(PRESET_GALLERY.some((p) => p.mode === 'Jungle')).toBe(true);
    expect(PRESET_GALLERY.some((p) => p.mode === '3D Fractal')).toBe(true);
    expect(ALL_PRESETS.some((p) => p.mode === 'Tunnel')).toBe(true);
    expect(ALL_PRESETS.some((p) => p.mode === 'Wall Studio')).toBe(true);
    expect(ALL_PRESETS.some((p) => p.mode === 'Gravity')).toBe(false); // gravity never had gallery presets in ALL_PRESETS
  });

  test('main boots on DEFAULT_MODE and routes old names through resolveMode', () => {
    const main = src('src/main.ts');
    expect(main).toContain('mode: DEFAULT_MODE');
    expect(main).toContain('setMode(DEFAULT_MODE)');
    expect(main).toContain("setMode(resolveMode(q.get('mode')))");
    expect(main).toContain('if (o.mode) o.mode = resolveMode(o.mode)');
    expect(main).toContain('const mode = resolveMode(preset.mode)');
    expect(main).not.toContain('Deep House Wall');
    expect(main).not.toContain("P.mode = '3D fabric'");
  });

  test('every lineup mode (and paused Gravity) still has a control panel and 3+ presets', () => {
    for (const m of [...LINEUP_MODES, 'Gravity']) {
      const spec = MODE_CONTROLS[m];
      expect(spec).toBeDefined();
      expect(spec.sections.flatMap((s) => s.ctls).length).toBeGreaterThanOrEqual(4);
      expect(Object.keys(spec.presets).length).toBeGreaterThanOrEqual(3);
    }
  });
});
