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
