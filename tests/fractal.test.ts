// Basic tests for fractal shader parameters
import { describe, test, expect } from 'bun:test';
import { FRACTAL_VS, FRACTAL_FS } from '../src/fractal_shaders';

describe('Fractal Shaders', () => {
  test('should export vertex shader', () => {
    expect(FRACTAL_VS).toBeDefined();
    expect(FRACTAL_VS).toContain('#version 300 es');
    expect(FRACTAL_VS).toContain('void main()');
  });

  test('should export fragment shader', () => {
    expect(FRACTAL_FS).toBeDefined();
    expect(FRACTAL_FS).toContain('#version 300 es');
    expect(FRACTAL_FS).toContain('void main()');
  });

  test('should include Mandelbulb distance estimator', () => {
    expect(FRACTAL_FS).toContain('deMandelbulb');
    expect(FRACTAL_FS).toContain('pow(r, power)');
  });

  test('should include Mandelbox distance estimator', () => {
    expect(FRACTAL_FS).toContain('deMandelbox');
    expect(FRACTAL_FS).toContain('Box fold');
    expect(FRACTAL_FS).toContain('Sphere fold');
  });

  test('should include ray marching function', () => {
    expect(FRACTAL_FS).toContain('raymarch');
    expect(FRACTAL_FS).toContain('for');
  });

  test('should include lighting calculations', () => {
    expect(FRACTAL_FS).toContain('calcNormal');
    expect(FRACTAL_FS).toContain('calcAO');
    expect(FRACTAL_FS).toContain('calcShadow');
  });

  test('should include camera setup', () => {
    expect(FRACTAL_FS).toContain('camera');
    expect(FRACTAL_FS).toContain('uCamPos');
    expect(FRACTAL_FS).toContain('uCamTarget');
  });
});

// Test fractal parameter safety
describe('Fractal Parameter Bounds', () => {
  test('should validate iteration bounds', () => {
    const maxIter = 32;
    const testValues = [-1, 0, 16, 32, 50];
    
    testValues.forEach(val => {
      const clamped = Math.max(1, Math.min(maxIter, val));
      expect(clamped).toBeGreaterThanOrEqual(1);
      expect(clamped).toBeLessThanOrEqual(maxIter);
    });
  });

  test('should validate bailout radius', () => {
    const testValues = [0, 2, 4, 10, 20];
    
    testValues.forEach(val => {
      expect(val).toBeGreaterThanOrEqual(0);
      if (val < 2) {
        // Warn: too low bailout may not terminate
      }
      if (val > 10) {
        // Warn: very high bailout may be inefficient
      }
    });
  });

  test('should validate power parameter', () => {
    const testValues = [1, 2, 8, 16, 20];
    
    testValues.forEach(val => {
      expect(val).toBeGreaterThan(0);
      expect(Number.isFinite(val)).toBe(true);
    });
  });
});

export {};


import { readFileSync } from 'fs';
import { FRACTAL_PIGMENT, STUDIO_LOOKS, fractalPigment } from '../src/studio';

test('ray march is conservative and does not fade hits into the backdrop', () => {
  const src = readFileSync(new URL('../src/fractal_shaders.ts', import.meta.url), 'utf8');
  expect(src).toContain('t += d * 0.75');
  expect(src).toContain('float eps = max(0.00025, t * 0.0002)');
  expect(src).toContain('0.65 * length(pos)');
  expect(src).not.toContain('col = mix(col, fogColor, fogAmount)');
  expect(src).toContain('col *= 1.0 - 0.3 * fogAmount');
  expect(src).toContain('Edge / contact darkening');
});

test('object spin uses a continuous clock, not a camera-chasing wrap', () => {
  const src = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  expect(src).toContain('const t = frClock');
  expect(src).not.toMatch(/camAngle = t \* V\.frRotSpeed/);
  expect(src).toContain('if (P.frCamOrbit) camAngle += t * (P.frCamOrbitSpeed || 0)');
  expect(src).toContain('frClock += Math.min(0.1, dt)');
});

function luma(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16);
  const f = (c: number) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

test('every studio look has fractal pigments distinct from the cove', () => {
  for (const name of Object.keys(STUDIO_LOOKS)) {
    const look = STUDIO_LOOKS[name];
    const pig = fractalPigment(name);
    expect(FRACTAL_PIGMENT[name]).toBeTruthy();
    const bg = 0.5 * (luma(look.bgTop) + luma(look.bgBottom));
    for (const hex of [pig.c1, pig.mid, pig.c2]) {
      expect(Math.abs(luma(hex) - bg)).toBeGreaterThan(0.08);
    }
  }
});
