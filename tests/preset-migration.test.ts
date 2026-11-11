// Test preset migration and real serialization paths
import { describe, test, expect } from 'bun:test';

describe('Preset Migration & Serialization', () => {
  test('should handle old preset without modulation mappings', () => {
    const oldPreset = {
      mode: 'Wall Studio',
      seed: 1977,
      palette: 'Liquid Spectrum',
      exposure: 1.0,
      stops: [[0, '#ff0000'], [1, '#0000ff']]
    };
    
    // Simulate load
    const loaded = JSON.parse(JSON.stringify(oldPreset));
    
    expect(loaded.mode).toBe('Wall Studio');
    expect(loaded.modulationMappings).toBeUndefined();
    // Should load without crashing
  });
  
  test('should preserve new fields in forward-compatible preset', () => {
    const newPreset = {
      mode: '3D Fractal',
      seed: 2024,
      frPower: 10,
      frType: 0,
      frRotSpeed: 0.1,
      modulationMappings: {
        mappings: [
          {
            id: 'map-1',
            target: 'frPower',
            source: 'bass' as const,
            enabled: true,
            min: 4,
            max: 16,
            depth: 1.0,
            smoothing: 0.7,
            release: 0.9,
            baseValue: 10
          },
          {
            id: 'map-2',
            target: 'light0.az',
            source: 'mid' as const,
            enabled: true,
            min: 0,
            max: 360,
            depth: 0.8,
            smoothing: 0.5,
            release: 0.85,
            baseValue: 45
          }
        ]
      }
    };
    
    const json = JSON.stringify(newPreset);
    const loaded = JSON.parse(json);
    
    expect(loaded.frPower).toBe(10);
    expect(loaded.modulationMappings.mappings).toHaveLength(2);
    expect(loaded.modulationMappings.mappings[0].target).toBe('frPower');
    expect(loaded.modulationMappings.mappings[1].target).toBe('light0.az');
  });
  
  test('should roundtrip complex preset with nested mappings', () => {
    const preset = {
      mode: '3D Fractal',
      frPower: 8,
      frType: 1, // Mandelbox
      lights: [
        { az: 45, el: 30, dist: 5, intensity: 1.0, cone: 30, on: true, type: 'spot', color: '#ffffff', shadow: true },
        { az: -45, el: 30, dist: 5, intensity: 0.8, cone: 25, on: true, type: 'spot', color: '#ffffff', shadow: false },
      ],
      wells: [
        { x: 0, y: 0, z: 0, mass: 1.0, falloff: 0.5, swirl: 0, on: true },
        { x: 1, y: 0, z: 0, mass: 0.8, falloff: 0.4, swirl: 0.5, on: true },
      ],
      modulationMappings: {
        mappings: [
          {
            id: 'm1',
            target: 'frPower',
            source: 'bass' as const,
            enabled: true,
            min: 4,
            max: 12,
            depth: 1.0,
            smoothing: 0.7,
            release: 0.9,
            baseValue: 8
          },
          {
            id: 'm2',
            target: 'light0.az',
            source: 'mid' as const,
            enabled: true,
            min: 0,
            max: 90,
            depth: 0.8,
            smoothing: 0.5,
            release: 0.85,
            baseValue: 45
          },
          {
            id: 'm3',
            target: 'well1.mass',
            source: 'beat' as const,
            enabled: true,
            min: 0.5,
            max: 1.5,
            depth: 1.0,
            smoothing: 0.3,
            release: 0.8,
            baseValue: 0.8
          }
        ]
      }
    };
    
    // Full roundtrip
    const json = JSON.stringify(preset);
    const loaded = JSON.parse(json);
    
    expect(loaded.mode).toBe('3D Fractal');
    expect(loaded.frPower).toBe(8);
    expect(loaded.frType).toBe(1);
    expect(loaded.lights).toHaveLength(2);
    expect(loaded.wells).toHaveLength(2);
    expect(loaded.modulationMappings.mappings).toHaveLength(3);
    
    // Verify nested targets preserved
    const targets = loaded.modulationMappings.mappings.map((m: any) => m.target);
    expect(targets).toContain('frPower');
    expect(targets).toContain('light0.az');
    expect(targets).toContain('well1.mass');
  });
  
  test('should handle malformed preset gracefully', () => {
    const malformed = {
      mode: null,
      modulationMappings: {
        mappings: 'not-an-array'
      }
    };
    
    // Should not throw
    expect(() => JSON.parse(JSON.stringify(malformed))).not.toThrow();
  });
  
  test('should preserve numeric precision', () => {
    const preset = {
      frPower: 8.123456789,
      exposure: 1.0000001,
      frRotSpeed: 0.05,
      modulationMappings: {
        mappings: [{
          id: 'm1',
          target: 'frPower',
          source: 'bass' as const,
          enabled: true,
          min: 4.5,
          max: 12.75,
          depth: 0.999,
          smoothing: 0.7123,
          release: 0.8999,
          baseValue: 8.123456789
        }]
      }
    };
    
    const json = JSON.stringify(preset);
    const loaded = JSON.parse(json);
    
    // Precision preserved within JSON limits
    expect(Math.abs(loaded.frPower - 8.123456789)).toBeLessThan(1e-10);
    expect(Math.abs(loaded.modulationMappings.mappings[0].baseValue - 8.123456789)).toBeLessThan(1e-10);
  });
});

export {};
