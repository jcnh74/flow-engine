import { describe, test, expect } from 'bun:test';
import { readFileSync, readdirSync } from 'fs';
import { LINEUP_MODES, resolveMode, isRetiredMode, isLineupMode } from '../src/lineup';
import { MODE_CONTROLS, applyModePreset, applyModeDefaults, captureModeValues } from '../src/modeControls';
import { PHYS_MODES } from '../src/physical';
import { KNOT_PALETTES } from '../src/physical/beadknot';
import { MANDALA_PALETTES } from '../src/physical/mandala';
import { FEATHER_PALETTES } from '../src/physical/feathervortex';
import { PRESET_GALLERY } from '../src/presets';

const src = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

const NEW = ['Bead Knot', 'Mirror Mandala', 'Feather Vortex'] as const;
const FILES = ['src/physical/beadknot.ts', 'src/physical/mandala.ts', 'src/physical/feathervortex.ts'] as const;

describe('Mind Balloon-inspired modes', () => {
  test('the three modes sit in the lineup, registry and menus without retiring anything', () => {
    for (const m of NEW) {
      expect(LINEUP_MODES).toContain(m);
      expect(isLineupMode(m)).toBe(true);
      expect(isRetiredMode(m)).toBe(false);
      expect(PHYS_MODES[m]).toBeDefined();
    }
    expect(PHYS_MODES['Bead Knot']).toBe('beadknot');
    expect(PHYS_MODES['Mirror Mandala']).toBe('mandala');
    expect(PHYS_MODES['Feather Vortex']).toBe('feathervortex');
    // existing modes stay visible
    for (const m of ['Paint', 'Paint Pour', 'City Vortex', 'Jungle', 'Stargate', 'Fabric', '3D Fractal']) {
      expect(LINEUP_MODES).toContain(m);
    }
    const idx = src('src/physical/index.ts');
    expect(idx).toContain('new BeadKnotScene');
    expect(idx).toContain('new MandalaScene');
    expect(idx).toContain('new FeatherVortexScene');
    // unknown ids still fall through to VideoLoop, but the three new ids are explicit
    const factory = idx.slice(idx.indexOf('const s: PhysScene'), idx.indexOf('void s.load()'));
    expect(factory).toContain("id === 'beadknot'");
    expect(factory).toContain("id === 'mandala'");
    expect(factory).toContain("id === 'feathervortex'");

    const ui = src('src/ui/MainControlPanel.ts');
    const remote = src('remote.html');
    for (const m of NEW) {
      expect(ui).toContain(`'${m}'`);
      expect(remote).toContain(`'${m}'`);
    }
  });

  test('aliases resolve and retired names still fall back to Jungle', () => {
    expect(resolveMode('bead')).toBe('Bead Knot');
    expect(resolveMode('knot')).toBe('Bead Knot');
    expect(resolveMode('mandala')).toBe('Mirror Mandala');
    expect(resolveMode('mirror')).toBe('Mirror Mandala');
    expect(resolveMode('feather')).toBe('Feather Vortex');
    expect(resolveMode('Gravity')).toBe('Jungle');
    expect(resolveMode('Tunnel')).toBe('Jungle');
    expect(resolveMode('Kaleido')).toBe('Jungle');
  });

  test('each mode has a full panel, a palette, and at least four presets that apply', () => {
    expect(Object.keys(KNOT_PALETTES).length).toBeGreaterThanOrEqual(4);
    expect(Object.keys(MANDALA_PALETTES).length).toBeGreaterThanOrEqual(4);
    expect(Object.keys(FEATHER_PALETTES).length).toBeGreaterThanOrEqual(4);
    for (const m of NEW) {
      const spec = MODE_CONTROLS[m];
      expect(spec).toBeDefined();
      const ctls = spec.sections.flatMap((s) => s.ctls);
      expect(ctls.length).toBeGreaterThanOrEqual(8);
      expect(ctls.some((c) => c.type === 'slider')).toBe(true);
      expect(ctls.some((c) => c.type === 'knob')).toBe(true);
      expect(ctls.some((c) => c.type === 'select')).toBe(true);
      const names = Object.keys(spec.presets);
      expect(names.length).toBeGreaterThanOrEqual(4);
      const P: Record<string, any> = {};
      applyModeDefaults(P, m);
      for (const k of Object.keys(spec.defaults)) expect(P[k]).toBeDefined();
      for (const name of names) {
        expect(applyModePreset(P, m, name)).toBe(true);
        const cap = captureModeValues(P, m);
        expect(Object.keys(cap).length).toBeGreaterThan(3);
      }
      expect(PRESET_GALLERY.filter((p) => p.mode === m).length).toBeGreaterThanOrEqual(4);
    }
  });

  test('source is original MIT work with no Shadertoy imports', () => {
    for (const f of FILES) {
      const t = src(f);
      expect(t).toContain('Original MIT-licensed work');
      expect(t).toContain('No Shadertoy');
      expect(t).not.toContain('https://www.shadertoy.com');
      expect(t).not.toContain('43758.5453');
      expect(t).not.toMatch(/from ['"]shadertoy/i);
    }
    // no unexpected third-party copies in the physical folder
    const phys = readdirSync(new URL('../src/physical', import.meta.url));
    expect(phys).toContain('beadknot.ts');
    expect(phys).toContain('mandala.ts');
    expect(phys).toContain('feathervortex.ts');
  });
});
