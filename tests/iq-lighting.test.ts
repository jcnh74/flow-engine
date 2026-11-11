import { describe, test, expect } from 'bun:test';
import { FRACTAL_FS } from '../src/fractal_shaders';

describe('IQ Lighting Enhancements', () => {
  test('should include cosine palette function', () => {
    expect(FRACTAL_FS).toContain('cosinePalette');
    expect(FRACTAL_FS).toContain('6.28318');
  });

  test('should have fog uniforms', () => {
    expect(FRACTAL_FS).toContain('uniform float uFogDensity');
    expect(FRACTAL_FS).toContain('uniform float uFogStart');
  });

  test('should have AO uniforms', () => {
    expect(FRACTAL_FS).toContain('uniform float uAOStrength');
    expect(FRACTAL_FS).toContain('uniform float uAORadius');
  });

  test('should have shadow sharpness uniform', () => {
    expect(FRACTAL_FS).toContain('uniform float uShadowSharpness');
  });

  test('should have cosine palette uniforms', () => {
    expect(FRACTAL_FS).toContain('uniform vec3 uCosinePaletteA');
    expect(FRACTAL_FS).toContain('uniform vec3 uCosinePaletteB');
    expect(FRACTAL_FS).toContain('uniform vec3 uCosinePaletteC');
    expect(FRACTAL_FS).toContain('uniform vec3 uCosinePaletteD');
    expect(FRACTAL_FS).toContain('uniform float uPaletteOffset');
  });

  test('should use cosine palette in rendering', () => {
    expect(FRACTAL_FS).toContain('cosinePalette(');
    expect(FRACTAL_FS).toContain('uCosinePaletteA');
  });

  test('should apply fog in rendering', () => {
    expect(FRACTAL_FS).toContain('if (uFogDensity > 0.0)');
    expect(FRACTAL_FS).toContain('exp(-uFogDensity');
  });

  test('should use improved AO with adaptive samples', () => {
    expect(FRACTAL_FS).toContain('uAORadius');
    expect(FRACTAL_FS).toContain('uAOStrength');
    expect(FRACTAL_FS).toContain('int samples = uMaxSteps > 96');
  });

  test('should use improved soft shadows with penumbra', () => {
    expect(FRACTAL_FS).toContain('uShadowSharpness');
    expect(FRACTAL_FS).toContain('float ph = 1e10');
    expect(FRACTAL_FS).toContain('maxShadowSteps');
  });

  test('calcAO should use adaptive sample count', () => {
    const aoFunc = FRACTAL_FS.match(/float calcAO\(.*?\n(?:.*?\n){0,30}\}/s)?.[0];
    expect(aoFunc).toBeDefined();
    expect(aoFunc).toContain('int samples = uMaxSteps > 96 ? 5 : (uMaxSteps > 64 ? 3 : 2)');
    expect(aoFunc).toContain('if (i >= samples) break');
  });

  test('calcShadow should implement IQ penumbra technique', () => {
    const shadowFunc = FRACTAL_FS.match(/float calcShadow\(.*?\n(?:.*?\n){0,40}\}/s)?.[0];
    expect(shadowFunc).toBeDefined();
    expect(shadowFunc).toContain('float ph = 1e10');
    expect(shadowFunc).toContain('float y = h * h / (2.0 * ph)');
    expect(shadowFunc).toContain('float d = sqrt(h * h - y * y)');
    expect(shadowFunc).toContain('uShadowSharpness * d');
  });
});

describe('Performance Optimizations', () => {
  test('should use adaptive quality for AO', () => {
    // AO samples: 5 for high (>96), 3 for medium (>64), 2 for low
    const aoFunc = FRACTAL_FS.match(/float calcAO\(.*?\n(?:.*?\n){0,30}\}/s)?.[0];
    expect(aoFunc).toContain('uMaxSteps > 96 ? 5 : (uMaxSteps > 64 ? 3 : 2)');
  });

  test('should use adaptive quality for shadows', () => {
    // Shadow steps: 24 for high (>96), 12 for medium (>64), 8 for low
    const shadowFunc = FRACTAL_FS.match(/float calcShadow\(.*?\n(?:.*?\n){0,40}\}/s)?.[0];
    expect(shadowFunc).toContain('uMaxSteps > 96 ? 24 : (uMaxSteps > 64 ? 12 : 8)');
  });

  test('should reduce iterations when quality is reduced', () => {
    // Adaptive step counts prevent slowdown on 60fps auto mode
    expect(FRACTAL_FS).toContain('int samples = uMaxSteps > 96');
    expect(FRACTAL_FS).toContain('int maxShadowSteps = uMaxSteps > 96');
  });
});
