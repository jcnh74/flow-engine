import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Presentation Blit Guard', () => {
  test('tick() must call bindFramebuffer(null) followed by tonemapPass', () => {
    // Read main.ts source
    const mainPath = join(import.meta.dir, '../src/main.ts');
    const mainSrc = readFileSync(mainPath, 'utf-8');
    
    // Find the tick function
    const tickStart = mainSrc.indexOf('function tick(');
    expect(tickStart, 'tick function should exist').toBeGreaterThan(0);
    
    const tickEnd = mainSrc.indexOf('\nfunction ', tickStart + 1);
    const tickSrc = mainSrc.substring(tickStart, tickEnd > 0 ? tickEnd : mainSrc.length);
    
    // Must contain bindFramebuffer(null) - the final presentation target
    expect(tickSrc, 'tick() must bind default framebuffer for presentation').toContain('bindFramebuffer(gl.FRAMEBUFFER, null)');
    
    // Must contain tonemapPass - the final tonemap to screen
    expect(tickSrc, 'tick() must call tonemapPass for final presentation').toContain('tonemapPass(');
    
    // Verify they appear in the correct order: bindFramebuffer(null) before tonemapPass
    const bindIndex = tickSrc.lastIndexOf('bindFramebuffer(gl.FRAMEBUFFER, null)');
    const tonemapIndex = tickSrc.lastIndexOf('tonemapPass(');
    
    expect(bindIndex, 'bindFramebuffer(null) should appear in tick()').toBeGreaterThan(0);
    expect(tonemapIndex, 'tonemapPass should appear in tick()').toBeGreaterThan(0);
    expect(tonemapIndex, 'tonemapPass must come after bindFramebuffer(null) for presentation').toBeGreaterThan(bindIndex);
    
    // Verify the blit happens after rendering (should be near the end of tick)
    const tickLength = tickSrc.length;
    const blitPosition = bindIndex / tickLength;
    expect(blitPosition, 'Final blit should be near end of tick (after rendering)').toBeGreaterThan(0.8);
  });
  
  test('default Kaleido at silence should have visible pixels', () => {
    // Read trippy shaders source
    const shaderPath = join(import.meta.dir, '../src/trippy_shaders.ts');
    const shaderSrc = readFileSync(shaderPath, 'utf-8');
    
    // Find renderKaleido function
    const kaleidoStart = shaderSrc.indexOf('vec3 renderKaleido(');
    expect(kaleidoStart, 'renderKaleido should exist').toBeGreaterThan(0);
    
    const kaleidoEnd = shaderSrc.indexOf('vec3 renderPlasma(', kaleidoStart);
    const kaleidoSrc = shaderSrc.substring(kaleidoStart, kaleidoEnd > 0 ? kaleidoEnd : shaderSrc.length);
    
    // Check for base gain floor (should be >= 0.8 to ensure visibility at silence)
    // Pattern: col *= (BASE + kick*X + onset*Y + high*Z)
    // BASE should be >= 0.8 for 25-60% lit pixels at silence
    const gainMatch = kaleidoSrc.match(/col \*= \(([0-9.]+) \+/);
    expect(gainMatch, 'Kaleido should have HDR gain formula').not.toBeNull();
    
    if (gainMatch) {
      const baseGain = parseFloat(gainMatch[1]);
      expect(baseGain, 'Kaleido base gain should be >= 0.8 for visibility at silence').toBeGreaterThanOrEqual(0.8);
    }
    
    // Verify pattern is not too sparse (softer falloff exponents)
    // Should NOT have pow(..., 12.0) or higher for spokes/rings
    expect(kaleidoSrc, 'Kaleido pattern should not be too sparse (avoid pow >= 12)').not.toContain('pow(1.0 - abs(sin(spokeAngle * 0.5)), 12.0)');
  });
});
