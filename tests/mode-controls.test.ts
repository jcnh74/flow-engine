import { describe, test, expect } from 'bun:test';
import { MODE_CONTROLS, presetNames, applyModePreset, captureModeValues, applyModeDefaults } from '../src/modeControls';
import { readFileSync } from 'fs';

describe('pass 6 per-mode controls + presets', () => {
  const modes = ['Gravity', 'Paint', 'Paint Pour', 'City Vortex', 'Jungle', 'Fabric', 'Stargate', 'Landscape', 'Morph', 'Plasma'];
  test('every mode has its own panel with sliders/knobs/selectors and 3+ presets', () => {
    for (const m of modes) {
      const spec = MODE_CONTROLS[m]; expect(spec).toBeDefined();
      const ctls = spec.sections.flatMap((s) => s.ctls);
      expect(ctls.length).toBeGreaterThanOrEqual(4);
      expect(Object.keys(spec.presets).length).toBeGreaterThanOrEqual(3);
      const keys = new Set(ctls.map((c) => c.key));
      for (const [name, vals] of Object.entries(spec.presets)) for (const k of Object.keys(vals)) {
        if (!keys.has(k)) throw new Error(`${m} preset ${name} sets ${k} which has no control`);
      }
      for (const c of ctls) if (c.type === 'slider' || c.type === 'knob') { expect(c.max!).toBeGreaterThan(c.min!); }
      for (const c of ctls) if (c.type === 'select') expect(c.options!.length).toBeGreaterThan(0);
    }
  });
  test('presets apply live onto params and round-trip through capture', () => {
    const P: Record<string, any> = {};
    applyModeDefaults(P, 'Gravity'); expect(P.grDropSize).toBe(1100);
    expect(P.grCohesion).toBe(1);
    expect(applyModePreset(P, 'Gravity', 'Honey Pour')).toBe(true); expect(P.grViscosity).toBe(1.8); expect(P.phVariant).toBe('Liquid'); expect(P.grZoom).toBe(0.85);
    const cap = captureModeValues(P, 'Gravity'); expect(cap.grViscosity).toBe(1.8);
    expect(presetNames('Stargate')).toContain('Hyperdrive');
  });
  test('scenes read the control keys (bound to real dynamics)', () => {
    const src = (f: string) => readFileSync(new URL(`../src/physical/${f}`, import.meta.url), 'utf8');
    for (const k of ['grDropSize', 'grDropEvery', 'grBounce', 'grGravity', 'grRoom', 'grCamera']) expect(src('colorroom.ts')).toContain(`P.${k}`);
    for (const k of ['grPour', 'grStreams', 'grCohesion', 'grViscosity', 'grTurbulence', 'grDrip', 'grGravity', 'grBallSize', 'grBursts', 'grBackdrop', 'grLqCamera', 'grOrder', 'grZoom', 'grLens', 'grDof', 'grKeyEl', 'grKeyAz', 'grSmooth']) expect(src('liquid.ts')).toContain(`P.${k}`);
    for (const k of ['spRate', 'spSize', 'spSpeed', 'spGravity', 'spPalette', 'spShape', 'spDroplets', 'spSmooth']) expect(src('splash.ts')).toContain(`P.${k}`);
    for (const k of ['fbCount', 'fbFlutter', 'fbWidth', 'fbTwist', 'fbPalette', 'fbWeave', 'fbSheen']) expect(src('fabricdrift.ts')).toContain(`P.${k}`);
    for (const k of ['ctSpin', 'ctTraffic', 'ctLights', 'ctDistrict', 'ctFog', 'ctRefl']) expect(src('city.ts')).toContain(`P.${k}`);
    for (const k of ['jgMotif', 'jgCycle', 'jgSway', 'jgBloom', 'jgDensity', 'jgFog', 'jgSat', 'jgFloor']) expect(src('jungle.ts')).toContain(`P.${k}`);
    for (const k of ['sgDensity', 'sgWarp', 'sgGlow', 'sgPattern', 'sgExposure', 'sgBands']) expect(src('stargate.ts')).toContain(`P.${k}`);
    for (const k of ['ppClip', 'ppSat', 'ppHue', 'ppZoom']) expect(src('videoloop.ts')).toContain(`P.${k}`);
  });
});
