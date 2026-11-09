// Audio modulation mapping system
// Maps audio signals to numeric parameters with smoothing and bounds

import type { AudioState } from './audio';

export type ModulationSource = 'beat' | 'bass' | 'mid' | 'high' | 'level' | 'envelope' | 'kick' | 'snare' | 'hat' | 'envelope8th' | 'envelope16th' | 'envelope32nd';

export interface ModulationMapping {
  id: string;
  target: string;           // Parameter name in P object
  source: ModulationSource;
  enabled: boolean;
  min: number;              // Output range minimum
  max: number;              // Output range maximum
  depth: number;            // 0-1 modulation amount
  smoothing: number;        // 0-1 smoothing/attack
  release: number;          // 0-1 release time
  baseValue: number;        // Original parameter value to restore
}

export class ModulationSystem {
  private mappings: Map<string, ModulationMapping> = new Map();
  private smoothedValues: Map<string, number> = new Map();
  private releaseValues: Map<string, number> = new Map();
  
  // Get value from nested path like "light0.az" -> params.lights[0].az
  private getValue(params: any, path: string): number | undefined {
    const match = path.match(/^(light|well)(\d+)\.(\w+)$/);
    if (match) {
      const [, type, index, prop] = match;
      const arrayName = type === 'light' ? 'lights' : 'wells';
      const arr = params[arrayName];
      if (arr && arr[parseInt(index)]) {
        return arr[parseInt(index)][prop];
      }
      return undefined;
    }
    return params[path];
  }
  
  // Set value to nested path
  private setValue(params: any, path: string, value: number): void {
    const match = path.match(/^(light|well)(\d+)\.(\w+)$/);
    if (match) {
      const [, type, index, prop] = match;
      const arrayName = type === 'light' ? 'lights' : 'wells';
      const arr = params[arrayName];
      if (arr && arr[parseInt(index)]) {
        arr[parseInt(index)][prop] = value;
      }
    } else {
      params[path] = value;
    }
  }
  
  addMapping(target: string, source: ModulationSource, baseValue: number): ModulationMapping {
    const id = `${target}_${Date.now()}`;
    const mapping: ModulationMapping = {
      id,
      target,
      source,
      enabled: true,
      min: baseValue * 0.5,
      max: baseValue * 1.5,
      depth: 1.0,
      smoothing: 0.7,
      release: 0.9,
      baseValue
    };
    this.mappings.set(id, mapping);
    this.smoothedValues.set(id, 0);
    this.releaseValues.set(id, 0);
    return mapping;
  }
  
  removeMapping(id: string) {
    this.mappings.delete(id);
    this.smoothedValues.delete(id);
    this.releaseValues.delete(id);
  }
  
  updateMapping(id: string, updates: Partial<ModulationMapping>) {
    const mapping = this.mappings.get(id);
    if (mapping) {
      Object.assign(mapping, updates);
    }
  }
  
  getMapping(id: string): ModulationMapping | undefined {
    return this.mappings.get(id);
  }
  
  getMappingsForTarget(target: string): ModulationMapping[] {
    return Array.from(this.mappings.values()).filter(m => m.target === target);
  }
  
  getAllMappings(): ModulationMapping[] {
    return Array.from(this.mappings.values());
  }
  
  clearAllMappings() {
    this.mappings.clear();
    this.smoothedValues.clear();
    this.releaseValues.clear();
  }
  
  update(audioState: AudioState, params: any): void {
    for (const [id, mapping] of this.mappings.entries()) {
      if (!mapping.enabled) {
        // Restore base value when disabled
        const current = this.getValue(params, mapping.target);
        if (current !== undefined) {
          const release = Math.max(0.7, mapping.release);
          this.setValue(params, mapping.target, current * release + mapping.baseValue * (1 - release));
        }
        continue;
      }
      
      // Get source value
      let sourceValue = 0;
      if (mapping.source === 'beat') {
        sourceValue = audioState.beatDetected ? 1 : 0;
      } else if (mapping.source === 'kick') {
        sourceValue = audioState.kickDetected ? audioState.kick : audioState.kick * 0.5;
      } else if (mapping.source === 'snare') {
        sourceValue = audioState.snareDetected ? audioState.snare : audioState.snare * 0.5;
      } else if (mapping.source === 'hat') {
        sourceValue = audioState.hatDetected ? audioState.hat : audioState.hat * 0.5;
      } else {
        sourceValue = audioState[mapping.source] || 0;
      }
      
      // Apply smoothing (attack)
      const smoothed = this.smoothedValues.get(id) || 0;
      const attack = 1 - Math.max(0.01, Math.min(0.99, mapping.smoothing));
      const newSmoothed = smoothed * (1 - attack) + sourceValue * attack;
      this.smoothedValues.set(id, newSmoothed);
      
      // Apply release (when signal drops)
      let releaseValue = this.releaseValues.get(id) || 0;
      if (newSmoothed < releaseValue) {
        const releaseFactor = Math.max(0.7, mapping.release);
        releaseValue = releaseValue * releaseFactor + newSmoothed * (1 - releaseFactor);
      } else {
        releaseValue = newSmoothed;
      }
      this.releaseValues.set(id, releaseValue);
      
      // Map to output range with depth
      const modulated = mapping.baseValue + (mapping.max - mapping.min) * releaseValue * mapping.depth;
      const clamped = Math.max(mapping.min, Math.min(mapping.max, modulated));
      
      // Apply to parameter (preserve base value, only modulate displayed value)
      const currentValue = this.getValue(params, mapping.target);
      if (currentValue !== undefined) {
        this.setValue(params, mapping.target, clamped);
      }
    }
  }
  
  // Restore base values for all targets
  restoreBaseValues(params: any): void {
    const restored = new Set<string>();
    for (const mapping of this.mappings.values()) {
      if (!restored.has(mapping.target)) {
        const currentValue = this.getValue(params, mapping.target);
        if (currentValue !== undefined) {
          this.setValue(params, mapping.target, mapping.baseValue);
        }
        restored.add(mapping.target);
      }
    }
  }
  
  // Update base values when user manually changes parameters
  updateBaseValues(params: any): void {
    for (const mapping of this.mappings.values()) {
      const currentValue = this.getValue(params, mapping.target);
      if (currentValue !== undefined && !mapping.enabled) {
        mapping.baseValue = currentValue;
      }
    }
  }
  
  // Serialize for presets
  toJSON(): any {
    return {
      mappings: Array.from(this.mappings.values())
    };
  }
  
  // Deserialize from presets
  fromJSON(data: any): void {
    this.clearAllMappings();
    if (data && Array.isArray(data.mappings)) {
      for (const m of data.mappings) {
        this.mappings.set(m.id, { ...m });
        this.smoothedValues.set(m.id, 0);
        this.releaseValues.set(m.id, 0);
      }
    }
  }
}

export default ModulationSystem;
