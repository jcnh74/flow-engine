import { describe, test, expect } from 'bun:test';
import { valueFromRelativeDrag, stepValue, fillRatio, clamp } from '../src/ui/touchSlider';
import { MODE_CONTROLS, FRACTAL_TYPES, normalizeFrType, applyFractalTypeDefaults, presetNames } from '../src/modeControls';
import { collectRemoteSchema, schemaKeys, colorGroupsFor } from '../src/colorSystem';
import { readFileSync } from 'fs';

describe('touch slider math', () => {
  test('relative drag does not jump to the tap point', () => {
    // Starting at mid (0.5 of 0–1). A tap 25% of the way along the track would
    // have jumped to 0.25 if we used absolute positioning; relative drag only
    // changes when the pointer moves.
    const start = 0.5;
    const atRest = valueFromRelativeDrag(start, 0, 0, 200, 0, 1, 0.01);
    expect(atRest).toBe(0.5);
    const moved = valueFromRelativeDrag(start, 40, 0, 200, 0, 1, 0.01);
    expect(moved).toBeCloseTo(0.7, 5);
  });

  test('vertical fine-drag reduces sensitivity', () => {
    const coarse = valueFromRelativeDrag(0.5, 40, 0, 200, 0, 1, 0.01);
    const fine = valueFromRelativeDrag(0.5, 40, 180, 200, 0, 1, 0.01);
    expect(fine).toBeLessThan(coarse);
    expect(fine).toBeGreaterThan(0.5);
  });

  test('values stay monotonic and clamped', () => {
    const xs = [0, 10, 20, 40, 80, 120];
    let last = 0;
    for (const dx of xs) {
      const v = valueFromRelativeDrag(0, dx, 0, 100, 0, 1, 0.01);
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
    expect(valueFromRelativeDrag(1, 400, 0, 100, 0, 1, 0.01)).toBe(1);
    expect(valueFromRelativeDrag(0, -400, 0, 100, 0, 1, 0.01)).toBe(0);
  });

  test('step snaps integers', () => {
    expect(stepValue(3.4, 0, 10, 1)).toBe(3);
    expect(clamp(5, 0, 3)).toBe(3);
    expect(fillRatio(5, 0, 10)).toBe(0.5);
  });
});

describe('remote schema is complete for every lineup mode', () => {
  const modes = ['Paint', 'Paint Pour', 'City Vortex', 'Jungle', 'Stargate', 'Fabric', '3D Fractal', 'Bead Knot', 'Mirror Mandala', 'Feather Vortex', 'Crystal Temple'];

  test('every mode control, color group and output slider is in the schema', () => {
    for (const mode of modes) {
      const keys = new Set(schemaKeys(mode));
      const spec = MODE_CONTROLS[mode];
      for (const sec of spec.sections) for (const c of sec.ctls) {
        if (!keys.has(c.key)) throw new Error(`${mode} missing ${c.key} in remote schema`);
      }
      for (const g of colorGroupsFor(mode)) for (const c of g.ctls) {
        if (!keys.has(c.key)) throw new Error(`${mode} missing color ${c.key}`);
      }
      expect(keys.has('exposure')).toBe(true);
      expect(keys.has('bloom')).toBe(true);
      const titles = collectRemoteSchema(mode).map((s) => s.title);
      expect(titles.some((t) => t.startsWith(mode))).toBe(true);
      expect(titles).toContain('Output');
    }
  });

  test('3D Fractal has no Menger or Sierpinski, and Kaleido/Julia are typed 2/3', () => {
    const sel = MODE_CONTROLS['3D Fractal'].sections[0].ctls.find((c) => c.key === 'frType')!;
    const opts = sel.options as Record<string, number>;
    expect(opts['Mandelbulb']).toBe(0);
    expect(opts['Mandelbox']).toBe(1);
    expect(opts['Kaleidoscopic']).toBe(2);
    expect(opts['Quaternion Julia']).toBe(3);
    expect(opts['Menger Sponge']).toBeUndefined();
    expect(opts['Sierpinski']).toBeUndefined();
    const names = presetNames('3D Fractal');
    expect(names).toContain('Kaleido Garden');
    expect(names).toContain('Julia Drift');
    expect(names.some((n) => /menger|sierpinski/i.test(n))).toBe(false);
    const src = readFileSync(new URL('../src/modeControls.ts', import.meta.url), 'utf8')
      + readFileSync(new URL('../src/fractal_shaders.ts', import.meta.url), 'utf8')
      + readFileSync(new URL('../remote.html', import.meta.url), 'utf8');
    expect(src).not.toMatch(/Menger Sponge|Sierpinski Tetrahedron|deMenger|deSierpinski/);
  });

  test('legacy type ids remap and kaleido/julia get a framed default', () => {
    expect(normalizeFrType(4)).toBe(2);
    expect(normalizeFrType(5)).toBe(3);
    expect(FRACTAL_TYPES['Kaleidoscopic']).toBe(2);
    const k: Record<string, any> = {};
    applyFractalTypeDefaults(k, 2);
    expect(k.frType).toBe(2);
    expect(k.frCamDist).toBeGreaterThan(2);
    expect(k.frIter).toBeGreaterThanOrEqual(6);
    const j: Record<string, any> = {};
    applyFractalTypeDefaults(j, 3);
    expect(j.frType).toBe(3);
    expect(j.frCamDist).toBeGreaterThan(2);
    expect(j.frIter).toBeGreaterThanOrEqual(6);
  });
});

export {};
