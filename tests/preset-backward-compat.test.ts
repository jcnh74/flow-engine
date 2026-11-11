import { describe, it, expect } from 'bun:test';

describe('Preset Backward Compatibility', () => {
  it('should load old main-branch format (P + stops)', () => {
    // Simulate old preset format from main branch
    const oldPreset = {
      P: {
        mode: '2D flow',
        noiseScale: 0.5,
        curl: 0.8,
        speed: 1.2,
        palette: 'sunset',
        exposure: 1.0,
        bloom: 0.5,
        particles: 100000
      },
      stops: [
        [0, [255, 100, 50]],
        [0.5, [200, 50, 100]],
        [1.0, [100, 50, 200]]
      ]
    };

    // The import should handle this format
    expect(oldPreset.P).toBeDefined();
    expect(oldPreset.stops).toBeDefined();
    expect(Array.isArray(oldPreset.stops)).toBe(true);
    expect(oldPreset.P.mode).toBe('2D flow');
    
    // Verify stops format
    for (const stop of oldPreset.stops) {
      expect(Array.isArray(stop)).toBe(true);
      expect(stop.length).toBe(2);
      expect(typeof stop[0]).toBe('number');
      expect(Array.isArray(stop[1])).toBe(true);
      expect(stop[1].length).toBe(3);
    }
  });

  it('should handle preset with modulation mappings', () => {
    const presetWithMod = {
      P: {
        mode: '3D fabric',
        fold: 0.5,
        warp: 1.0,
        exposure: 1.2
      },
      stops: [[0, [255, 0, 0]], [1, [0, 0, 255]]],
      modulation: {
        mappings: [
          { path: 'fold', source: 'beat', amount: 0.3, smoothing: 0.7 },
          { path: 'warp', source: 'bass', amount: 0.5, smoothing: 0.8 }
        ]
      }
    };

    expect(presetWithMod.modulation).toBeDefined();
    expect(Array.isArray(presetWithMod.modulation.mappings)).toBe(true);
    expect(presetWithMod.modulation.mappings.length).toBe(2);
    
    // Verify mapping structure
    const mapping = presetWithMod.modulation.mappings[0];
    expect(mapping.path).toBe('fold');
    expect(mapping.source).toBe('beat');
    expect(mapping.amount).toBe(0.3);
    expect(mapping.smoothing).toBe(0.7);
  });

  it('should handle minimal preset without optional fields', () => {
    const minimalPreset = {
      P: {
        mode: 'Wall Studio',
        exposure: 1.0
      },
      stops: [[0, [255, 255, 255]], [1, [0, 0, 0]]]
    };

    expect(minimalPreset.P).toBeDefined();
    expect(minimalPreset.stops).toBeDefined();
    // modulation should be optional
    expect(minimalPreset.modulation).toBeUndefined();
  });

  it('should validate fractal preset parameters', () => {
    const fractalPreset = {
      P: {
        mode: '3D Fractal',
        frType: 0,
        frPower: 8,
        frIter: 12,
        frCamDist: 3.0,
        frLightAz: 45,
        frLightEl: 30,
        frMaxSteps: 100,
        frMaxDist: 50,
        frBailout: 2.0,
        exposure: 1.0
      },
      stops: [[0, [0, 0, 0]], [1, [255, 255, 255]]]
    };

    expect(fractalPreset.P.mode).toBe('3D Fractal');
    expect(fractalPreset.P.frType).toBe(0);
    expect(fractalPreset.P.frPower).toBe(8);
    expect(fractalPreset.P.frIter).toBe(12);
    expect(fractalPreset.P.frLightAz).toBe(45);
    expect(fractalPreset.P.frLightEl).toBe(30);
  });

  it('should handle Wall Studio preset', () => {
    const wallPreset = {
      P: {
        mode: 'Wall Studio',
        fold: 0.5,
        warp: 0.6,
        scale3d: 0.8,
        exposure: 1.0
      },
      stops: [[0, [50, 150, 50]], [1, [200, 255, 100]]]
    };

    expect(wallPreset.P.mode).toBe('Wall Studio');
    expect(wallPreset.P.fold).toBeDefined();
    expect(wallPreset.P.warp).toBeDefined();
  });
});
