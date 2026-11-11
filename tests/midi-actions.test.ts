/**
 * Unit test: MIDI action triggers
 * 
 * Tests MIDI-learnable actions (note/CC triggers) for MilkDrop and presets
 * 
 * Ensures:
 * - Actions can be learned (note or CC)
 * - Action triggers fire on MIDI input
 * - Actions use isAction flag (no min/max)
 * - Multiple actions can be mapped
 */

import { describe, it, expect, beforeEach } from 'bun:test';

// Mock MIDI mapping structure
interface MidiMapping {
  channel: number;
  type: 'cc' | 'note';
  number: number;
  target: string;
  isAction?: boolean;
  min?: number;
  max?: number;
}

// Simulate MIDI learn and trigger
class TestMidiManager {
  public mappings: MidiMapping[] = [];
  private actionCallbacks: string[] = [];
  
  learn(target: string, channel: number, type: 'cc' | 'note', number: number) {
    // Remove existing mapping for this target
    this.mappings = this.mappings.filter(m => m.target !== target);
    
    // Check if action
    const isAction = target.startsWith('action:');
    
    if (isAction) {
      this.mappings.push({
        channel,
        type,
        number,
        target,
        isAction: true
      });
    } else {
      this.mappings.push({
        channel,
        type,
        number,
        target,
        isAction: false,
        min: 0,
        max: 1
      });
    }
  }
  
  trigger(channel: number, type: 'cc' | 'note', number: number, value: number) {
    const mapping = this.mappings.find(
      m => m.channel === channel && m.type === type && m.number === number
    );
    
    if (mapping && mapping.isAction) {
      // Action: trigger on note-on or CC > 64
      const shouldTrigger = type === 'note' ? value > 0 : value > 64;
      if (shouldTrigger) {
        this.actionCallbacks.push(mapping.target);
      }
    }
  }
  
  getTriggeredActions(): string[] {
    return this.actionCallbacks;
  }
  
  clearActions() {
    this.actionCallbacks = [];
  }
}

describe('MIDI Action Triggers', () => {
  let midi: TestMidiManager;
  
  beforeEach(() => {
    midi = new TestMidiManager();
  });
  
  it('should learn MilkDrop next as action', () => {
    midi.learn('action:milkdrop-next', 0, 'note', 60);
    
    const mapping = midi.mappings.find(m => m.target === 'action:milkdrop-next');
    expect(mapping).toBeDefined();
    expect(mapping?.isAction).toBe(true);
    expect(mapping?.min).toBeUndefined();
    expect(mapping?.max).toBeUndefined();
  });
  
  it('should learn MilkDrop prev as action', () => {
    midi.learn('action:milkdrop-prev', 0, 'cc', 20);
    
    const mapping = midi.mappings.find(m => m.target === 'action:milkdrop-prev');
    expect(mapping).toBeDefined();
    expect(mapping?.isAction).toBe(true);
  });
  
  it('should learn MilkDrop random as action', () => {
    midi.learn('action:milkdrop-random', 0, 'note', 62);
    
    const mapping = midi.mappings.find(m => m.target === 'action:milkdrop-random');
    expect(mapping).toBeDefined();
    expect(mapping?.isAction).toBe(true);
  });
  
  it('should trigger action on note-on', () => {
    midi.learn('action:milkdrop-next', 0, 'note', 60);
    
    // Note-on (value > 0)
    midi.trigger(0, 'note', 60, 127);
    
    const actions = midi.getTriggeredActions();
    expect(actions).toContain('action:milkdrop-next');
  });
  
  it('should not trigger action on note-off', () => {
    midi.learn('action:milkdrop-next', 0, 'note', 60);
    
    // Note-off (value = 0)
    midi.trigger(0, 'note', 60, 0);
    
    const actions = midi.getTriggeredActions();
    expect(actions.length).toBe(0);
  });
  
  it('should trigger action on CC > 64', () => {
    midi.learn('action:milkdrop-random', 0, 'cc', 20);
    
    // CC value 127 (> 64)
    midi.trigger(0, 'cc', 20, 127);
    
    const actions = midi.getTriggeredActions();
    expect(actions).toContain('action:milkdrop-random');
  });
  
  it('should not trigger action on CC <= 64', () => {
    midi.learn('action:milkdrop-random', 0, 'cc', 20);
    
    // CC value 32 (<= 64)
    midi.trigger(0, 'cc', 20, 32);
    
    const actions = midi.getTriggeredActions();
    expect(actions.length).toBe(0);
  });
  
  it('should handle multiple action mappings', () => {
    midi.learn('action:milkdrop-next', 0, 'note', 60);
    midi.learn('action:milkdrop-prev', 0, 'note', 61);
    midi.learn('action:milkdrop-random', 0, 'note', 62);
    
    expect(midi.mappings.length).toBe(3);
    expect(midi.mappings.every(m => m.isAction)).toBe(true);
  });
  
  it('should replace existing mapping for same target', () => {
    midi.learn('action:milkdrop-next', 0, 'note', 60);
    midi.learn('action:milkdrop-next', 0, 'note', 61); // Re-learn
    
    expect(midi.mappings.length).toBe(1);
    expect(midi.mappings[0].number).toBe(61);
  });
  
  it('should distinguish actions from parameters', () => {
    midi.learn('action:milkdrop-next', 0, 'note', 60);
    midi.learn('exposure', 0, 'cc', 20);
    
    const actionMapping = midi.mappings.find(m => m.target === 'action:milkdrop-next');
    const paramMapping = midi.mappings.find(m => m.target === 'exposure');
    
    expect(actionMapping?.isAction).toBe(true);
    expect(paramMapping?.isAction).toBe(false);
    expect(paramMapping?.min).toBeDefined();
    expect(paramMapping?.max).toBeDefined();
  });
  
  it('should support all MilkDrop actions', () => {
    const actions = [
      'action:milkdrop-next',
      'action:milkdrop-prev',
      'action:milkdrop-random'
    ];
    
    actions.forEach((action, i) => {
      midi.learn(action, 0, 'note', 60 + i);
    });
    
    expect(midi.mappings.length).toBe(3);
    actions.forEach(action => {
      const mapping = midi.mappings.find(m => m.target === action);
      expect(mapping).toBeDefined();
      expect(mapping?.isAction).toBe(true);
    });
  });
});
