import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';

const mainSrc = readFileSync(join(import.meta.dir, '../src/main.ts'), 'utf-8');

describe('Watchdog False Positive Fixes', () => {
  test('probe should sample 64x64 for max-luma test (catches sparse content)', () => {
    expect(mainSrc).toContain('const sampleW = 64, sampleH = 64');
    expect(mainSrc).toContain('new Uint8Array(sampleW * sampleH * 4)');
  });

  test('probe should track allZero flag', () => {
    expect(mainSrc).toContain('allZero = true');
    expect(mainSrc).toContain('const BLACK_THRESHOLD = 2.0');
    expect(mainSrc).toContain('if (pixelLum > BLACK_THRESHOLD) allZero = false');
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
    expect(mainSrc).toContain('shouldClearFeedback');
    expect(mainSrc).toContain("recover('black >1s', shouldClearFeedback)");
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
    expect(mainSrc).toContain('targetMode = MODE_ALIASES[modeParam.toLowerCase()]');
  });

  test('should do case-insensitive mode matching', () => {
    expect(mainSrc).toContain('targetMode = VALID_MODES.find(m => m.toLowerCase() === modeParam.toLowerCase())');
    expect(mainSrc).toContain('setMode(targetMode)');
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

describe('Watchdog Sparse Pattern Detection', () => {
  test('should calculate standard deviation of pixel luma', () => {
    // probe() must calculate std to detect sparse content
    expect(mainSrc).toContain('sumSqDiff');
    expect(mainSrc).toContain('Math.sqrt(sumSqDiff');
    expect(mainSrc).toContain('std:');
  });

  test('should use BLACK_THRESHOLD of 2.0 (not 0.1)', () => {
    // Any pixel > ~2/255 means not black
    expect(mainSrc).toContain('BLACK_THRESHOLD = 2.0');
    expect(mainSrc).toContain('if (pixelLum > BLACK_THRESHOLD) allZero = false');
  });

  test('should never clear feedback while std > 1', () => {
    // Sparse starburst has high std even with low mean luma
    // Now we skip recovery entirely when std > 1.0 (not just skip clearing feedback)
    expect(mainSrc).toContain('p.std > 1.0');
    expect(mainSrc).toContain('Watchdog skip');
  });

  test('sparse starburst pattern should have high std', () => {
    // Simulate probe logic with sparse bright pixels on black
    const sampleSize = 64 * 64;
    const px = new Uint8Array(sampleSize * 4);
    
    // Fill with black
    px.fill(0);
    
    // Add sparse bright pixels in starburst pattern (8 rays, 8 pixels each = 64 bright pixels out of 4096)
    const centerX = 32, centerY = 32;
    for (let ray = 0; ray < 8; ray++) {
      const angle = (ray / 8) * 2 * Math.PI;
      for (let dist = 5; dist < 28; dist += 3) {
        const x = Math.floor(centerX + Math.cos(angle) * dist);
        const y = Math.floor(centerY + Math.sin(angle) * dist);
        const idx = (y * 64 + x) * 4;
        if (idx < px.length - 3) {
          px[idx] = 255;     // R
          px[idx+1] = 255;   // G
          px[idx+2] = 255;   // B
          px[idx+3] = 255;   // A
        }
      }
    }
    
    // Calculate luma stats (same logic as probe())
    let s = 0, n = 0, maxLum = 0;
    for (let i = 0; i < px.length; i += 4) {
      const pixelLum = (px[i] + px[i+1] + px[i+2]) / 3;
      s += px[i] + px[i+1] + px[i+2];
      n += 3;
      maxLum = Math.max(maxLum, pixelLum);
    }
    const lum = s / n;
    
    // Calculate std
    let sumSqDiff = 0;
    for (let i = 0; i < px.length; i += 4) {
      const pixelLum = (px[i] + px[i+1] + px[i+2]) / 3;
      const diff = pixelLum - lum;
      sumSqDiff += diff * diff;
    }
    const std = Math.sqrt(sumSqDiff / sampleSize);
    
    // Sparse starburst should have:
    // - Low mean luma (mostly black) but non-zero
    expect(lum).toBeGreaterThan(0);
    expect(lum).toBeLessThan(10);
    
    // - High max luma (bright rays)
    expect(maxLum).toBeGreaterThan(200);
    
    // - High std (contrast between black and bright)
    expect(std).toBeGreaterThan(20);
    
    // Therefore: feedback should NEVER be cleared (std > 1)
  });
});
