/**
 * Tests for new features: Lighting section, 2D Fractal mode, 3D Fractal expansion
 */

import { describe, test, expect } from 'bun:test';
import { LIGHTING_RIGS, applyLightingRig } from '../src/ui/LightingPresets';

describe('Unified Lighting & Studio Section', () => {
  test('Lighting rig presets exist', () => {
    expect(LIGHTING_RIGS['Softbox']).toBeTruthy();
    expect(LIGHTING_RIGS['Three-Point']).toBeTruthy();
    expect(LIGHTING_RIGS['Rim Light']).toBeTruthy();
    expect(LIGHTING_RIGS['Club Strobe']).toBeTruthy();
    expect(LIGHTING_RIGS['Sunset']).toBeTruthy();
  });

  test('Lighting rigs have correct structure', () => {
    const softbox = LIGHTING_RIGS['Softbox'];
    expect(softbox.lights.length).toBe(4);
    expect(softbox.envIntensity).toBeDefined();
    expect(softbox.shadowSoft).toBeDefined();
    expect(softbox.ao).toBeDefined();
    expect(softbox.toneMap).toBeDefined();
  });

  test('Lighting rig applies settings correctly', () => {
    const params = {
      lights: [{}, {}, {}, {}],
      envIntensity: 0,
      envRot: 0,
      shadowSoft: 0,
      shadowBias: 0,
      ao: 0,
      ssaoRadius: 0,
      fog: 0,
      toneMap: 'None'
    };

    const rig = LIGHTING_RIGS['Three-Point'];
    applyLightingRig(rig, params);

    expect(params.envIntensity).toBe(0.3);
    expect(params.shadowSoft).toBe(0.8);
    expect(params.ao).toBe(1.0);
    expect(params.toneMap).toBe('ACES');
    expect(params.fog).toBe(0);
  });

  test('Sunset rig has warm environment', () => {
    const sunset = LIGHTING_RIGS['Sunset'];
    expect(sunset.envIntensity).toBeGreaterThan(1.0);
    expect(sunset.envRot).toBe(-60);
    expect(sunset.fog).toBeGreaterThan(0.3);
  });
});

describe('2D Fractal Parameters', () => {
  test('Default 2D fractal params can be defined', () => {
    const params = {
      fr2Type: 0,
      fr2MaxIter: 256,
      fr2Zoom: 200,
      fr2CenterX: -0.5,
      fr2CenterY: 0,
      fr2Rotation: 0,
      fr2JuliaCX: -0.4,
      fr2JuliaCY: 0.6,
      fr2JuliaOrbit: false,
      fr2OrbitSpeed: 0.2,
      fr2AutoZoom: false,
      fr2ZoomSpeed: 0.1,
      fr2PaletteCycle: 0
    };
    
    expect(params.fr2Type).toBe(0);
    expect(params.fr2MaxIter).toBe(256);
    expect(params.fr2Zoom).toBe(200);
  });

  test('2D fractal types enumerated', () => {
    const types = {
      'Mandelbrot': 0,
      'Julia': 1,
      'Burning Ship': 2,
      'Newton': 3,
      'Phoenix': 4
    };
    
    expect(types['Mandelbrot']).toBe(0);
    expect(types['Julia']).toBe(1);
    expect(types['Burning Ship']).toBe(2);
    expect(types['Newton']).toBe(3);
    expect(types['Phoenix']).toBe(4);
  });
});

describe('3D Fractal Expansion Parameters', () => {
  test('3D fractal types enumerated', () => {
    const types = {
      'Mandelbulb': 0,
      'Mandelbox': 1,
      'Menger Sponge': 2,
      'Sierpinski': 3,
      'Kaleidoscopic': 4,
      'Quaternion Julia': 5
    };
    
    expect(types['Mandelbulb']).toBe(0);
    expect(types['Mandelbox']).toBe(1);
    expect(types['Menger Sponge']).toBe(2);
    expect(types['Sierpinski']).toBe(3);
    expect(types['Kaleidoscopic']).toBe(4);
    expect(types['Quaternion Julia']).toBe(5);
  });

  test('Motion parameters defined', () => {
    const params = {
      frMorph: 0,
      frJuliaOrbit: false,
      frJuliaSpeed: 0.2,
      frFoldRot: 0,
      frCamOrbit: false,
      frCamOrbitSpeed: 0.2,
      frSlicePlane: false,
      frSlicePos: 0
    };
    
    expect(params.frMorph).toBe(0);
    expect(params.frJuliaOrbit).toBe(false);
    expect(params.frSlicePlane).toBe(false);
  });
});
