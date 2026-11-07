// Tests for nested parameter modulation (lights/wells)
import { describe, test, expect, beforeEach } from 'bun:test';
import { ModulationSystem } from '../src/modulation';
import type { AudioState } from '../src/audio';

describe('Nested Parameter Modulation', () => {
  let modSystem: ModulationSystem;
  let mockAudioState: AudioState;

  beforeEach(() => {
    modSystem = new ModulationSystem();
    mockAudioState = {
      isPlaying: false,
      source: 'none',
      fileName: '',
      duration: 0,
      currentTime: 0,
      bpm: 120,
      bass: 0,
      mid: 0,
      high: 0,
      level: 0,
      envelope: 0,
      beatDetected: false,
      beatPhase: 0,
      isMicActive: false,
      isSystemAudioActive: false,
      systemAudioError: '',
    };
  });

  test('should modulate nested light parameter', () => {
    const params = {
      lights: [
        { az: 45, el: 30, dist: 5, intensity: 1.0, cone: 30 },
        { az: -45, el: 30, dist: 5, intensity: 0.8, cone: 25 },
      ]
    };
    
    const mapping = modSystem.addMapping('light0.az', 'bass', 45);
    mapping.min = 0;
    mapping.max = 90;
    mockAudioState.bass = 1.0;
    
    modSystem.update(mockAudioState, params);
    
    // light0.az should be modulated towards max
    expect(params.lights[0].az).toBeGreaterThan(45);
    expect(params.lights[0].az).toBeLessThanOrEqual(90);
    
    // light1.az should be unchanged
    expect(params.lights[1].az).toBe(-45);
  });

  test('should modulate nested well parameter', () => {
    const params = {
      wells: [
        { x: 0, y: 0, z: 0, mass: 1.0, falloff: 0.5, swirl: 0 },
        { x: 1, y: 0, z: 0, mass: 0.8, falloff: 0.4, swirl: 0.5 },
      ]
    };
    
    const mapping = modSystem.addMapping('well0.mass', 'beat', 1.0);
    mapping.min = 0.5;
    mapping.max = 2.0;
    mockAudioState.bass = 0;
    mockAudioState.beatDetected = true;
    
    modSystem.update(mockAudioState, params);
    
    // well0.mass should respond to beat
    expect(params.wells[0].mass).toBeGreaterThan(1.0);
    
    // well1.mass should be unchanged
    expect(params.wells[1].mass).toBe(0.8);
  });

  test('should modulate multiple light properties independently', () => {
    const params = {
      lights: [
        { az: 45, el: 30, dist: 5, intensity: 1.0, cone: 30 },
      ]
    };
    
    modSystem.addMapping('light0.az', 'bass', 45);
    modSystem.addMapping('light0.el', 'mid', 30);
    modSystem.addMapping('light0.intensity', 'level', 1.0);
    
    mockAudioState.bass = 1.0;
    mockAudioState.mid = 0.5;
    mockAudioState.level = 0.8;
    
    modSystem.update(mockAudioState, params);
    
    // All three should be modulated
    expect(params.lights[0].az).not.toBe(45);
    expect(params.lights[0].el).not.toBe(30);
    expect(params.lights[0].intensity).not.toBe(1.0);
  });

  test('should restore nested base values', () => {
    const params = {
      lights: [{ az: 45, el: 30, dist: 5, intensity: 1.0, cone: 30 }],
      wells: [{ x: 0, y: 0, z: 0, mass: 1.0, falloff: 0.5, swirl: 0 }]
    };
    
    modSystem.addMapping('light0.az', 'bass', 45);
    modSystem.addMapping('well0.mass', 'beat', 1.0);
    
    mockAudioState.bass = 1.0;
    mockAudioState.beatDetected = true;
    
    modSystem.update(mockAudioState, params);
    
    // Values should be modulated
    expect(params.lights[0].az).not.toBe(45);
    expect(params.wells[0].mass).not.toBe(1.0);
    
    // Restore base values
    modSystem.restoreBaseValues(params);
    
    expect(params.lights[0].az).toBe(45);
    expect(params.wells[0].mass).toBe(1.0);
  });

  test('should serialize nested mappings', () => {
    modSystem.addMapping('light0.az', 'bass', 45);
    modSystem.addMapping('well2.mass', 'beat', 1.2);
    modSystem.addMapping('light3.cone', 'high', 30);
    
    const json = modSystem.toJSON();
    
    expect(json.mappings).toHaveLength(3);
    expect(json.mappings.some((m: any) => m.target === 'light0.az')).toBe(true);
    expect(json.mappings.some((m: any) => m.target === 'well2.mass')).toBe(true);
    expect(json.mappings.some((m: any) => m.target === 'light3.cone')).toBe(true);
  });

  test('should deserialize nested mappings', () => {
    const json = {
      mappings: [
        {
          id: 'test-1',
          target: 'light0.az',
          source: 'bass' as const,
          enabled: true,
          min: 0,
          max: 90,
          depth: 1.0,
          smoothing: 0.7,
          release: 0.9,
          baseValue: 45
        },
        {
          id: 'test-2',
          target: 'well1.mass',
          source: 'beat' as const,
          enabled: true,
          min: 0.5,
          max: 2.0,
          depth: 1.0,
          smoothing: 0.5,
          release: 0.8,
          baseValue: 1.0
        }
      ]
    };
    
    modSystem.fromJSON(json);
    
    const mappings = modSystem.getAllMappings();
    expect(mappings).toHaveLength(2);
    expect(mappings.some(m => m.target === 'light0.az')).toBe(true);
    expect(mappings.some(m => m.target === 'well1.mass')).toBe(true);
  });

  test('should handle disabled nested mappings', () => {
    const params = {
      lights: [{ az: 45, el: 30, dist: 5, intensity: 1.0, cone: 30 }]
    };
    
    const mapping = modSystem.addMapping('light0.az', 'bass', 45);
    mapping.min = 0;
    mapping.max = 90;
    mockAudioState.bass = 1.0;
    
    modSystem.update(mockAudioState, params);
    const modulatedValue = params.lights[0].az;
    expect(modulatedValue).toBeGreaterThan(45);
    
    // Disable mapping
    mapping.enabled = false;
    modSystem.update(mockAudioState, params);
    
    // Should release back toward base
    expect(Math.abs(params.lights[0].az - 45)).toBeLessThan(Math.abs(modulatedValue - 45));
  });

  test('should clamp nested values to bounds', () => {
    const params = {
      wells: [{ x: 0, y: 0, z: 0, mass: 1.0, falloff: 0.5, swirl: 0 }]
    };
    
    const mapping = modSystem.addMapping('well0.mass', 'bass', 1.0);
    mapping.min = 0.5;
    mapping.max = 2.0;
    mapping.depth = 2.0; // High depth to try to exceed bounds
    mockAudioState.bass = 1.0;
    
    modSystem.update(mockAudioState, params);
    
    // Should be clamped to max
    expect(params.wells[0].mass).toBeLessThanOrEqual(2.0);
    expect(params.wells[0].mass).toBeGreaterThanOrEqual(0.5);
  });

  test('should modulate all 4 lights independently', () => {
    const params = {
      lights: [
        { az: 45, el: 30, dist: 5, intensity: 1.0, cone: 30 },
        { az: -45, el: 30, dist: 5, intensity: 0.8, cone: 25 },
        { az: 90, el: 45, dist: 6, intensity: 0.6, cone: 20 },
        { az: -90, el: 20, dist: 4, intensity: 0.4, cone: 35 },
      ]
    };
    
    modSystem.addMapping('light0.az', 'bass', 45);
    modSystem.addMapping('light1.az', 'mid', -45);
    modSystem.addMapping('light2.az', 'high', 90);
    modSystem.addMapping('light3.az', 'level', -90);
    
    mockAudioState.bass = 1.0;
    mockAudioState.mid = 0.5;
    mockAudioState.high = 0.8;
    mockAudioState.level = 0.3;
    
    modSystem.update(mockAudioState, params);
    
    // All four lights should be modulated
    expect(params.lights[0].az).not.toBe(45);
    expect(params.lights[1].az).not.toBe(-45);
    expect(params.lights[2].az).not.toBe(90);
    expect(params.lights[3].az).not.toBe(-90);
  });

  test('should modulate all 4 wells independently', () => {
    const params = {
      wells: [
        { x: 0, y: 0, z: 0, mass: 1.0, falloff: 0.5, swirl: 0 },
        { x: 1, y: 0, z: 0, mass: 0.8, falloff: 0.4, swirl: 0.5 },
        { x: -1, y: 0, z: 0, mass: 1.2, falloff: 0.6, swirl: -0.5 },
        { x: 0, y: 1, z: 0, mass: 0.9, falloff: 0.3, swirl: 0.3 },
      ]
    };
    
    modSystem.addMapping('well0.mass', 'bass', 1.0);
    modSystem.addMapping('well1.mass', 'mid', 0.8);
    modSystem.addMapping('well2.mass', 'high', 1.2);
    modSystem.addMapping('well3.mass', 'level', 0.9);
    
    mockAudioState.bass = 1.0;
    mockAudioState.mid = 0.5;
    mockAudioState.high = 0.8;
    mockAudioState.level = 0.3;
    
    modSystem.update(mockAudioState, params);
    
    // All four wells should be modulated
    expect(params.wells[0].mass).not.toBe(1.0);
    expect(params.wells[1].mass).not.toBe(0.8);
    expect(params.wells[2].mass).not.toBe(1.2);
    expect(params.wells[3].mass).not.toBe(0.9);
  });
});
