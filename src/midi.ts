// Web MIDI API integration with MIDI Learn
// Maps MIDI CC/Note messages to parameters

export interface MidiMapping {
  channel: number;
  type: 'cc' | 'note';
  number: number;
  target: string;
  min: number;
  max: number;
}

export interface MidiState {
  supported: boolean;
  enabled: boolean;
  devices: MIDIInput[];
  selectedDeviceId: string | null;
  learning: boolean;
  learningTarget: string | null;
  mappings: MidiMapping[];
}

export class MidiManager {
  private midiAccess: MIDIAccess | null = null;
  public state: MidiState = {
    supported: typeof navigator.requestMIDIAccess === 'function',
    enabled: false,
    devices: [],
    selectedDeviceId: null,
    learning: false,
    learningTarget: null,
    mappings: []
  };

  private params: any;
  private onParamChange?: (param: string, value: any) => void;

  constructor(params: any, onParamChange?: (param: string, value: any) => void) {
    this.params = params;
    this.onParamChange = onParamChange;
    this.loadMappings();
  }

  async init() {
    if (!this.state.supported) {
      console.warn('Web MIDI API not supported');
      return false;
    }

    try {
      this.midiAccess = await navigator.requestMIDIAccess();
      this.state.enabled = true;
      this.updateDeviceList();
      
      // Listen for device connect/disconnect
      this.midiAccess.onstatechange = () => this.updateDeviceList();
      
      return true;
    } catch (err) {
      console.error('Failed to access MIDI devices:', err);
      return false;
    }
  }

  private updateDeviceList() {
    if (!this.midiAccess) return;
    
    this.state.devices = Array.from(this.midiAccess.inputs.values());
    
    // Auto-select first device if none selected
    if (!this.state.selectedDeviceId && this.state.devices.length > 0) {
      this.selectDevice(this.state.devices[0].id);
    }
  }

  selectDevice(deviceId: string) {
    if (!this.midiAccess) return;
    
    // Remove listeners from old device
    if (this.state.selectedDeviceId) {
      const oldDevice = this.midiAccess.inputs.get(this.state.selectedDeviceId);
      if (oldDevice) oldDevice.onmidimessage = null;
    }
    
    // Add listener to new device
    const device = this.midiAccess.inputs.get(deviceId);
    if (device) {
      this.state.selectedDeviceId = deviceId;
      device.onmidimessage = (e) => this.handleMidiMessage(e);
    }
  }

  private handleMidiMessage(event: MIDIMessageEvent) {
    const data = event.data;
    if (!data || data.length < 3) return;
    const [status, data1, data2] = [data[0], data[1], data[2]];
    const channel = status & 0x0F;
    const type = (status & 0xF0) === 0xB0 ? 'cc' : 'note';
    const number = data1;
    const value = data2;

    // Learning mode: capture this MIDI message
    if (this.state.learning && this.state.learningTarget) {
      this.learnMapping(channel, type, number);
      return;
    }

    // Normal mode: apply existing mappings
    const mapping = this.state.mappings.find(
      m => m.channel === channel && m.type === type && m.number === number
    );

    if (mapping) {
      this.applyMapping(mapping, value);
    }
  }

  startLearning(target: string) {
    this.state.learning = true;
    this.state.learningTarget = target;
  }

  stopLearning() {
    this.state.learning = false;
    this.state.learningTarget = null;
  }

  private learnMapping(channel: number, type: 'cc' | 'note', number: number) {
    if (!this.state.learningTarget) return;

    const target = this.state.learningTarget;
    
    // Remove existing mapping for this target
    this.state.mappings = this.state.mappings.filter(m => m.target !== target);
    
    // Determine min/max based on param type
    const currentValue = this.params[target];
    let min = 0, max = 1;
    
    if (typeof currentValue === 'number') {
      // Try to infer range from current value
      if (currentValue > 1) {
        max = Math.max(currentValue * 2, 100);
      }
    } else if (typeof currentValue === 'boolean') {
      min = 0;
      max = 1;
    }
    
    // Add new mapping
    this.state.mappings.push({
      channel,
      type,
      number,
      target,
      min,
      max
    });
    
    this.saveMappings();
    this.stopLearning();
  }

  private applyMapping(mapping: MidiMapping, value: number) {
    const normalized = value / 127;
    const scaled = mapping.min + (mapping.max - mapping.min) * normalized;
    
    // Handle special action targets
    if (mapping.target === 'preset:next') {
      (window as any).presetGallery?.nextPreset();
      return;
    }
    if (mapping.target === 'preset:prev') {
      (window as any).presetGallery?.prevPreset();
      return;
    }
    if (mapping.target === 'preset:random') {
      (window as any).presetGallery?.randomPreset();
      return;
    }
    if (mapping.target === 'tapTempo') {
      (window as any).audioAnalyzer?.tapTempo();
      return;
    }
    
    // Apply to parameter
    const currentValue = this.params[mapping.target];
    if (typeof currentValue === 'boolean') {
      this.params[mapping.target] = value > 63;
    } else if (typeof currentValue === 'number') {
      this.params[mapping.target] = scaled;
    }
    
    if (this.onParamChange) {
      this.onParamChange(mapping.target, this.params[mapping.target]);
    }
  }

  removeMapping(target: string) {
    this.state.mappings = this.state.mappings.filter(m => m.target !== target);
    this.saveMappings();
  }

  private saveMappings() {
    localStorage.setItem('flow-midi-mappings', JSON.stringify(this.state.mappings));
  }

  private loadMappings() {
    const saved = localStorage.getItem('flow-midi-mappings');
    if (saved) {
      try {
        this.state.mappings = JSON.parse(saved);
      } catch (e) {
        console.error('Failed to load MIDI mappings:', e);
      }
    }
  }

  exportMappings(): string {
    return JSON.stringify(this.state.mappings, null, 2);
  }

  importMappings(json: string) {
    try {
      const mappings = JSON.parse(json);
      if (Array.isArray(mappings)) {
        this.state.mappings = mappings;
        this.saveMappings();
        return true;
      }
    } catch (e) {
      console.error('Failed to import MIDI mappings:', e);
    }
    return false;
  }

  cleanup() {
    if (this.state.selectedDeviceId && this.midiAccess) {
      const device = this.midiAccess.inputs.get(this.state.selectedDeviceId);
      if (device) device.onmidimessage = null;
    }
  }
}
