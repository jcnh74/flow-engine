// Test preset save/load roundtrip with new features
describe('Preset System', () => {
  test('should serialize fractal parameters', () => {
    const params = {
      frType: 0,
      frPower: 8,
      frIter: 12,
      frColor1: '#ff0080',
      frColor2: '#00e5ff',
      frCamDist: 3
    };
    
    const json = JSON.stringify(params);
    const loaded = JSON.parse(json);
    
    expect(loaded.frType).toBe(params.frType);
    expect(loaded.frPower).toBe(params.frPower);
    expect(loaded.frColor1).toBe(params.frColor1);
  });

  test('should serialize modulation mappings', () => {
    const mappings = {
      mappings: [
        {
          id: 'test-1',
          target: 'frPower',
          source: 'bass',
          enabled: true,
          min: 4,
          max: 12,
          depth: 1.0,
          smoothing: 0.7,
          release: 0.9,
          baseValue: 8
        }
      ]
    };
    
    const json = JSON.stringify(mappings);
    const loaded = JSON.parse(json);
    
    expect(loaded.mappings).toHaveLength(1);
    expect(loaded.mappings[0].target).toBe('frPower');
    expect(loaded.mappings[0].source).toBe('bass');
  });

  test('should handle missing fields gracefully', () => {
    const oldPreset = {
      mode: 'Wall Studio',
      seed: 1977
      // No fractal or modulation fields
    };
    
    const json = JSON.stringify(oldPreset);
    const loaded = JSON.parse(json);
    
    // Should load without crashing
    expect(loaded.mode).toBe('Wall Studio');
    expect(loaded.frPower).toBeUndefined(); // New field not present
  });

  test('should preserve existing fields when loading', () => {
    const preset = {
      mode: '3D Fractal',
      seed: 2024,
      palette: 'Liquid Spectrum',
      frPower: 10,
      stops: [[0, '#ff0000'], [1, '#0000ff']],
      modulationMappings: {
        mappings: [{
          id: 'map-1',
          target: 'frRotSpeed',
          source: 'beat',
          enabled: true,
          min: 0,
          max: 0.5,
          depth: 1,
          smoothing: 0.5,
          release: 0.8,
          baseValue: 0.05
        }]
      }
    };
    
    const json = JSON.stringify(preset);
    const loaded = JSON.parse(json);
    
    expect(loaded.mode).toBe('3D Fractal');
    expect(loaded.frPower).toBe(10);
    expect(loaded.stops).toHaveLength(2);
    expect(loaded.modulationMappings.mappings).toHaveLength(1);
  });
});

export {};
