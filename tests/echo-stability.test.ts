/**
 * Unit test: Echo feedback transfer function stability
 * 
 * Ensures the feedback loop (decay * mix * contrast) stays bounded
 * for typical HDR values (1.0, 2.0, 10.0) over 1000 iterations.
 * 
 * Prevents runaway like Round 9 where pow(echo, 1.2) on HDR >1 
 * amplified instead of compressing, hitting float16 max (65504).
 */

import { describe, it, expect } from 'bun:test';

/**
 * Simulate one iteration of the echo transfer function
 * Matches FEEDBACK_FS shader logic:
 * 1. Decay
 * 2. Compress/contrast/expand
 * 3. Mix with current (assume curr = input for stability test)
 * 4. Luma key
 * 5. Clamp
 */
function echoIteration(value: number, params: { decay: number; mix: number }): number {
  const { decay, mix } = params;
  
  // Apply decay
  let echo = value * decay;
  
  // Apply contrast on compressed value (matches shader)
  if (echo > 0.01) {
    // Compress
    let compressed = echo / (1.0 + echo);
    // Contrast
    compressed = Math.pow(compressed, 1.2);
    // Expand
    echo = compressed / (1.0 - compressed + 1e-4);
    // Clamp
    echo = Math.min(echo, 4.0);
  }
  
  // Mix with current (assume current = value for worst-case test)
  // In real shader: max(curr, echo * mix), so echo is scaled by mix
  echo = echo * mix;
  
  // Luma key (assume passes for bright values)
  // In shader: smoothstep(0.25, 0.65, luma) ≈ 1.0 for bright
  // So no attenuation for stability test (worst case)
  
  // Clamp stored feedback
  echo = Math.min(echo, 4.0);
  
  // Sanitize NaN/Inf
  if (!isFinite(echo)) {
    echo = 0.0;
  }
  
  return echo;
}

/**
 * Iterate echo transfer function N times starting from initial value
 * Returns final value and max value seen
 */
function iterateEcho(
  initial: number, 
  iterations: number, 
  params: { decay: number; mix: number }
): { final: number; max: number } {
  let value = initial;
  let max = initial;
  
  for (let i = 0; i < iterations; i++) {
    value = echoIteration(value, params);
    max = Math.max(max, value);
  }
  
  return { final: value, max };
}

describe('Echo Feedback Stability', () => {
  // Spiral Dreams parameters (Round 9 runaway case)
  const spiralParams = { decay: 0.97, mix: 0.88 };
  
  it('should stay bounded from 1.0 over 1000 iterations', () => {
    const result = iterateEcho(1.0, 1000, spiralParams);
    
    // Should converge or stay bounded, not explode
    expect(result.final).toBeLessThan(100);
    expect(result.max).toBeLessThan(100);
    expect(isFinite(result.final)).toBe(true);
  });
  
  it('should stay bounded from 2.0 over 1000 iterations', () => {
    const result = iterateEcho(2.0, 1000, spiralParams);
    
    expect(result.final).toBeLessThan(100);
    expect(result.max).toBeLessThan(100);
    expect(isFinite(result.final)).toBe(true);
  });
  
  it('should stay bounded from 10.0 over 1000 iterations', () => {
    const result = iterateEcho(10.0, 1000, spiralParams);
    
    expect(result.final).toBeLessThan(100);
    expect(result.max).toBeLessThan(100);
    expect(isFinite(result.final)).toBe(true);
  });
  
  it('should not produce NaN or Infinity', () => {
    const testValues = [0.1, 1.0, 2.0, 5.0, 10.0, 100.0];
    
    for (const initial of testValues) {
      const result = iterateEcho(initial, 1000, spiralParams);
      expect(isFinite(result.final)).toBe(true);
      expect(isNaN(result.final)).toBe(false);
    }
  });
  
  it('should converge for typical feedback parameters', () => {
    // Typical parameters from working presets
    const testCases = [
      { decay: 0.97, mix: 0.88 }, // Spiral Dreams
      { decay: 0.95, mix: 0.85 }, // Conservative
      { decay: 0.99, mix: 0.90 }, // Aggressive
    ];
    
    for (const params of testCases) {
      const result = iterateEcho(2.0, 1000, params);
      
      // Loop gain = decay * mix * (contrast effect)
      // Should be < 1 for convergence
      // With clamp at 4.0, should never exceed that
      expect(result.max).toBeLessThanOrEqual(4.0);
      expect(result.final).toBeLessThan(10);
    }
  });
});
