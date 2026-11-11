import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';

const mainSrc = readFileSync(join(import.meta.dir, '../src/main.ts'), 'utf-8');

describe('Watchdog False Positive Fixes', () => {
  test('probe should sample 64x64 downscaled frame', () => {
    expect(mainSrc).toContain('const sampleW = 64, sampleH = 64');
    expect(mainSrc).toContain('new Uint8Array(sampleW * sampleH * 4)');
  });

  test('probe should track allZero flag', () => {
    expect(mainSrc).toContain('allZero = true');
    expect(mainSrc).toContain('if (pixelLum > 0.1) allZero = false');
    expect(mainSrc).toContain('allZero, nan:');
  });

  test('watchdog should track black duration', () => {
    expect(mainSrc).toContain('let blackStartTime = 0');
    expect(mainSrc).toContain('if (blackStartTime === 0)');
    expect(mainSrc).toContain('blackStartTime = now');
  });

  test('watchdog should only clear FB after >1s of all zeros', () => {
    expect(mainSrc).toContain('if (black && p.allZero)');
    expect(mainSrc).toContain('now - blackStartTime > 1000');
    expect(mainSrc).toContain("recover('black >1s', true)");
  });

  test('recover should have clearFeedback parameter', () => {
    expect(mainSrc).toContain('function recover(why: string, clearFeedback: boolean = false)');
    expect(mainSrc).toContain('if (clearFeedback) {');
    expect(mainSrc).toContain('reset();');
  });

  test('watchdog should throttle probe to ~2/sec', () => {
    expect(mainSrc).toContain('let lastProbeTime = 0');
    expect(mainSrc).toContain('if (now - lastProbeTime < 500) return');
    expect(mainSrc).toContain('lastProbeTime = now');
  });

  test('NaN should trigger immediate recovery with FB clear', () => {
    expect(mainSrc).toContain('if (p.nan) {');
    expect(mainSrc).toContain("recover('NaN', true)");
  });

  test('user-initiated recovery should clear FB', () => {
    expect(mainSrc).toContain("recover('button', true)");
    expect(mainSrc).toContain("recover('remote', true)");
    expect(mainSrc).toContain("recover('Esc', true)");
  });

  test('non-black frames should reset black timer', () => {
    expect(mainSrc).toContain('} else {');
    expect(mainSrc).toContain('blackStartTime = 0');
    expect(mainSrc).toContain('badTicks = 0');
  });
});

describe('Mode Query Parameter', () => {
  test('should define valid modes list', () => {
    expect(mainSrc).toContain("const VALID_MODES = ['Wall Studio', 'Tunnel', 'Kaleido', 'Plasma', 'Morph', '3D Fractal', 'MilkDrop', '3D fabric', 'Liquid Spheres', 'Particle Fabric', '2D flow']");
  });

  test('should define mode aliases', () => {
    expect(mainSrc).toContain("const MODE_ALIASES: Record<string, string> = {");
    expect(mainSrc).toContain("'2d': '2D flow'");
    expect(mainSrc).toContain("'particles': 'Particle Fabric'");
    expect(mainSrc).toContain("'spheres': 'Liquid Spheres'");
    expect(mainSrc).toContain("'3d': '3D fabric'");
  });

  test('should check aliases first', () => {
    expect(mainSrc).toContain('if (MODE_ALIASES[modeParam.toLowerCase()])');
    expect(mainSrc).toContain('P.mode = MODE_ALIASES[modeParam.toLowerCase()]');
  });

  test('should do case-insensitive mode matching', () => {
    expect(mainSrc).toContain('const matchedMode = VALID_MODES.find(m => m.toLowerCase() === modeParam.toLowerCase())');
    expect(mainSrc).toContain('if (matchedMode) P.mode = matchedMode');
  });
});

describe('Performance - Throttling', () => {
  test('watchdog interval should be 100ms', () => {
    // setInterval should be 100ms, but probe throttles to 500ms internally
    expect(mainSrc).toContain('}, 100);');
  });

  test('probe should throttle to 500ms (2/sec)', () => {
    expect(mainSrc).toContain('if (now - lastProbeTime < 500) return');
  });
});
