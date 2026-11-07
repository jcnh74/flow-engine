// Basic tests for modulation system
import { describe, test, expect, beforeEach } from 'bun:test';
import { ModulationSystem } from '../src/modulation';
import type { AudioState } from '../src/audio';

describe('ModulationSystem', () => {
  let modSystem: ModulationSystem;
  let mockAudioState: AudioState;
  let mockParams: any;

  beforeEach(() => {
    modSystem = new ModulationSystem();
    mockAudioState = {
      isPlaying: false,
      isMicActive: false,
      isSystemAudioActive: false,
      source: 'none',
      fileName: '',
      currentTime: 0,
      duration: 0,
      bpm: 120,
      manualBpm: 120,
      beatDetected: false,
      level: 0,
      bass: 0,
      mid: 0,
      high: 0,
      envelope: 0,
      systemAudioSupported: false,
      systemAudioError: ''
    };
    mockParams = {
      testParam: 1.0,
      anotherParam: 0.5
    };
  });

  test('should add mapping', () => {
    const mapping = modSystem.addMapping('testParam', 'bass', 1.0);
    expect(mapping).toBeDefined();
    expect(mapping.target).toBe('testParam');
    expect(mapping.source).toBe('bass');
    expect(mapping.baseValue).toBe(1.0);
  });

  test('should modulate parameter with audio signal', () => {
    modSystem.addMapping('testParam', 'bass', 1.0);
    mockAudioState.bass = 1.0;
    
    modSystem.update(mockAudioState, mockParams);
    
    // Parameter should be modulated above base value
    expect(mockParams.testParam).toBeGreaterThan(1.0);
  });

  test('should clamp modulated values to min/max', () => {
    const mapping = modSystem.addMapping('testParam', 'bass', 1.0);
    mapping.min = 0.5;
    mapping.max = 1.5;
    mockAudioState.bass = 2.0; // Very high signal
    
    modSystem.update(mockAudioState, mockParams);
    
    // Should be clamped to max
    expect(mockParams.testParam).toBeLessThanOrEqual(1.5);
  });

  test('should restore base value when disabled', () => {
    const mapping = modSystem.addMapping('testParam', 'bass', 1.0);
    mockAudioState.bass = 1.0;
    
    modSystem.update(mockAudioState, mockParams);
    const modulatedValue = mockParams.testParam;
    expect(modulatedValue).toBeGreaterThan(1.0);
    
    mapping.enabled = false;
    modSystem.update(mockAudioState, mockParams);
    
    // Should return closer to base value (with release)
    expect(Math.abs(mockParams.testParam - 1.0)).toBeLessThan(Math.abs(modulatedValue - 1.0));
  });

  test('should handle beat detection', () => {
    modSystem.addMapping('testParam', 'beat', 1.0);
    mockAudioState.beatDetected = true;
    
    modSystem.update(mockAudioState, mockParams);
    
    expect(mockParams.testParam).toBeGreaterThan(1.0);
  });

  test('should serialize and deserialize mappings', () => {
    modSystem.addMapping('testParam', 'bass', 1.0);
    modSystem.addMapping('anotherParam', 'high', 0.5);
    
    const json = modSystem.toJSON();
    expect(json.mappings).toHaveLength(2);
    
    const newSystem = new ModulationSystem();
    newSystem.fromJSON(json);
    
    expect(newSystem.getAllMappings()).toHaveLength(2);
  });

  test('should handle silence gracefully', () => {
    modSystem.addMapping('testParam', 'bass', 1.0);
    // All audio values are zero (silence)
    
    modSystem.update(mockAudioState, mockParams);
    
    // Should not crash and should stay near base value
    expect(Number.isFinite(mockParams.testParam)).toBe(true);
  });

  test('should prevent NaN values', () => {
    modSystem.addMapping('testParam', 'bass', 1.0);
    mockAudioState.bass = NaN;
    
    modSystem.update(mockAudioState, mockParams);
    
    expect(Number.isNaN(mockParams.testParam)).toBe(false);
  });
});

// Export for test runner compatibility
export {};
