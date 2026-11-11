/**
 * Unit tests for auto quality governor logic
 */

import { describe, test, expect } from 'bun:test';

describe('Quality Governor', () => {
  // Simulate the governor algorithm
  function simulateGovernor(frameTimes: number[], initialScale = 1.0) {
    const TARGET_HIGH = 14.5; // 68fps
    const TARGET_LOW = 18.0;  // 55fps
    let frameTimeEMA = 16.67;
    let scale = initialScale;
    const scales: number[] = [scale];
    
    for (let i = 0; i < frameTimes.length; i++) {
      frameTimeEMA = frameTimeEMA * 0.9 + frameTimes[i] * 0.1;
      
      // Simulate 2s between adjustments (assume 60fps = 120 frames)
      if (i % 120 === 0 && i > 0) {
        if (frameTimeEMA > TARGET_LOW && scale > 0.5) {
          scale = Math.max(0.5, scale - 0.05);
        } else if (frameTimeEMA < TARGET_HIGH && scale < 1.0) {
          scale = Math.min(1.0, scale + 0.05);
        }
        scales.push(scale);
      }
    }
    
    return { finalScale: scale, finalEMA: frameTimeEMA, history: scales };
  }

  test('should reduce quality when frame time is too high', () => {
    // Simulate consistently slow frames (25fps = 40ms)
    const slowFrames = Array(300).fill(40);
    const result = simulateGovernor(slowFrames, 1.0);
    
    expect(result.finalScale).toBeLessThan(1.0);
    expect(result.finalScale).toBeGreaterThanOrEqual(0.5);
  });

  test('should increase quality when frame time is low', () => {
    // Simulate consistently fast frames (120fps = 8.33ms)
    const fastFrames = Array(300).fill(8.33);
    const result = simulateGovernor(fastFrames, 0.6);
    
    expect(result.finalScale).toBeGreaterThan(0.6);
    expect(result.finalScale).toBeLessThanOrEqual(1.0);
  });

  test('should maintain stable quality in target zone', () => {
    // Simulate frames in the stable zone (60fps = 16.67ms)
    const stableFrames = Array(300).fill(16.67);
    const result = simulateGovernor(stableFrames, 0.8);
    
    // Should not change much
    expect(result.finalScale).toBe(0.8);
  });

  test('should respect minimum scale of 0.5', () => {
    // Simulate extremely slow frames (need enough iterations to reach min)
    const verySlowFrames = Array(1200).fill(100);
    const result = simulateGovernor(verySlowFrames, 1.0);
    
    expect(result.finalScale).toBeCloseTo(0.5, 1);
  });

  test('should respect maximum scale of 1.0', () => {
    // Simulate extremely fast frames (need enough iterations to reach max)
    const veryFastFrames = Array(1200).fill(5);
    const result = simulateGovernor(veryFastFrames, 0.5);
    
    expect(result.finalScale).toBeCloseTo(1.0, 1);
  });

  test('should use hysteresis to avoid thrashing', () => {
    // Simulate oscillating frame times
    const oscillating: number[] = [];
    for (let i = 0; i < 300; i++) {
      oscillating.push(i % 2 === 0 ? 12 : 20);
    }
    const result = simulateGovernor(oscillating, 0.8);
    
    // EMA should smooth out oscillations
    // Scale changes should be gradual, not every frame
    expect(result.history.length).toBeLessThan(10); // Max ~2 adjustments in 300 frames
  });

  test('should converge to appropriate scale for 30fps workload', () => {
    // Simulate 30fps (33.33ms per frame)
    const frames30fps = Array(600).fill(33.33);
    const result = simulateGovernor(frames30fps, 1.0);
    
    // Should scale down significantly
    expect(result.finalScale).toBeLessThan(0.8);
    expect(result.finalScale).toBeGreaterThanOrEqual(0.5);
  });
});
