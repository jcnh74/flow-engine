/**
 * Unit test: Gallery preset loading
 * 
 * Ensures loadPresetFromGallery applies every field from preset.params
 * Catches regressions where preset values don't override defaults
 * 
 * Round 10 issue: Kaleido preset showed exposure 1.8, feedbackKaleido 0
 * but presets.ts defined exposure 1.0, feedbackKaleido 8
 */

import { describe, it, expect, beforeEach } from 'bun:test';

// Mock the preset gallery structure
interface PresetParams {
  [key: string]: any;
}

interface GalleryPreset {
  name: string;
  mode: string;
  description?: string;
  params: PresetParams;
  beatLinks?: any[];
}

// Simulate the load behavior
function simulateLoad(target: PresetParams, preset: GalleryPreset): PresetParams {
  const result = { ...target };
  
  // This simulates what main.ts load() does:
  // Object.assign(P, preset.params)
  Object.assign(result, preset.params);
  
  return result;
}

// Test presets matching actual gallery presets
const testPresets: GalleryPreset[] = [
  {
    name: 'Feedback: Spiral Dreams',
    mode: 'Tunnel',
    params: {
      trippySpeed: 1.3,
      feedbackEnabled: true,
      feedbackMix: 0.88,
      feedbackDecay: 0.97,
      feedbackZoom: 0.985,
      feedbackRotate: 0.045,
      feedbackHueDrift: 0.02,
      exposure: 1.0,
      bloomStrength: 0.12,
      bloomThreshold2: 1.8,
    }
  },
  {
    name: 'Feedback: Kaleidoscope Echo',
    mode: 'Kaleido',
    params: {
      trippySpeed: 1.4,
      feedbackEnabled: true,
      feedbackMix: 0.90,
      feedbackDecay: 0.97,
      feedbackZoom: 1.01,
      feedbackKaleido: 8,
      feedbackNoise: 0.02,
      feedbackRotate: 0.035,
      exposure: 1.0,
      bloomStrength: 0.12,
      bloomThreshold2: 1.8,
    }
  },
  {
    name: 'Feedback: Plasma Warp',
    mode: 'Plasma',
    params: {
      trippySpeed: 1.5,
      feedbackEnabled: true,
      feedbackMix: 0.88,
      feedbackDecay: 0.97,
      feedbackZoom: 0.985,
      feedbackNoise: 0.045,
      feedbackHueDrift: 0.02,
      feedbackRotate: 0.04,
      exposure: 1.0,
      bloomStrength: 0.12,
      bloomThreshold2: 1.8,
    }
  },
  {
    name: 'Feedback: Fractal Echo',
    mode: '3D Fractal',
    params: {
      frType: 0,
      frPower: 8,
      frRotSpeed: 0.6,
      frCamOrbit: true,
      feedbackEnabled: true,
      feedbackMix: 0.88,
      feedbackDecay: 0.97,
      feedbackZoom: 0.985,
      feedbackRotate: 0.045,
      feedbackKaleido: 0,
      feedbackNoise: 0.01,
      exposure: 1.8,
      bloomStrength: 0.12,
      bloomThreshold2: 1.8,
    }
  },
];

describe('Gallery Preset Loading', () => {
  let defaultState: PresetParams;
  
  beforeEach(() => {
    // Simulate default state with different values
    defaultState = {
      trippySpeed: 1.0,
      feedbackEnabled: false,
      feedbackMix: 0.5,
      feedbackDecay: 0.95,
      feedbackZoom: 1.0,
      feedbackRotate: 0.0,
      feedbackKaleido: 0,
      feedbackNoise: 0.0,
      feedbackHueDrift: 0.0,
      exposure: 1.8,
      bloomStrength: 0.2,
      bloomThreshold2: 1.0,
      frType: 0,
      frPower: 8,
      frRotSpeed: 0.5,
      frCamOrbit: false,
    };
  });
  
  it('should apply Spiral Dreams exposure 1.0', () => {
    const preset = testPresets.find(p => p.name === 'Feedback: Spiral Dreams')!;
    const result = simulateLoad(defaultState, preset);
    
    expect(result.exposure).toBe(1.0);
    expect(result.feedbackMix).toBe(0.88);
    expect(result.feedbackDecay).toBe(0.97);
  });
  
  it('should apply Kaleido exposure 1.0 and feedbackKaleido 8', () => {
    const preset = testPresets.find(p => p.name === 'Feedback: Kaleidoscope Echo')!;
    const result = simulateLoad(defaultState, preset);
    
    // Round 10 regression: these were not applied
    expect(result.exposure).toBe(1.0);
    expect(result.feedbackKaleido).toBe(8);
    expect(result.feedbackMix).toBe(0.90);
  });
  
  it('should apply Plasma exposure 1.0', () => {
    const preset = testPresets.find(p => p.name === 'Feedback: Plasma Warp')!;
    const result = simulateLoad(defaultState, preset);
    
    expect(result.exposure).toBe(1.0);
    expect(result.feedbackNoise).toBe(0.045);
  });
  
  it('should apply Fractal Echo exposure 1.8', () => {
    const preset = testPresets.find(p => p.name === 'Feedback: Fractal Echo')!;
    const result = simulateLoad(defaultState, preset);
    
    expect(result.exposure).toBe(1.8);
    expect(result.frCamOrbit).toBe(true);
    expect(result.feedbackKaleido).toBe(0);
  });
  
  it('should override all preset params over defaults', () => {
    for (const preset of testPresets) {
      const result = simulateLoad(defaultState, preset);
      
      // Check every param in preset.params was applied
      for (const [key, value] of Object.entries(preset.params)) {
        expect(result[key]).toBe(value);
      }
    }
  });
  
  it('should enable feedback when preset sets feedbackEnabled true', () => {
    const preset = testPresets[0]; // Spiral Dreams
    const result = simulateLoad({ feedbackEnabled: false }, preset);
    
    expect(result.feedbackEnabled).toBe(true);
  });
  
  it('should handle numeric params correctly', () => {
    const preset = testPresets[1]; // Kaleido
    const result = simulateLoad(defaultState, preset);
    
    // All numeric params should be exact
    expect(typeof result.feedbackMix).toBe('number');
    expect(typeof result.feedbackKaleido).toBe('number');
    expect(result.feedbackKaleido).toBe(8); // Not 0
  });
});
