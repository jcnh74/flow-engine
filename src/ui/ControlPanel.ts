// Control Panel - House Music Visualizer Aesthetic
import type { AudioState } from '../audio';

export interface PanelConfig {
  params: any;
  audioState: AudioState;
  modulationSystem?: any;
  onChange?: (param: string, value: any) => void;
}

interface ControlDef {
  name: string;
  label: string;
  type: 'slider' | 'select' | 'button' | 'checkbox';
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  modulatable?: boolean;
  modes?: string[];  // Which modes this control is visible in
}

// Mode-aware control definitions
const CONTROL_DEFS: Record<string, ControlDef[]> = {
  Scene: [
    { name: 'mode', label: 'Mode', type: 'select', options: ['Paint', 'Paint Pour', 'City Vortex', 'Jungle', 'Stargate', 'Fabric', '3D Fractal'] },
    // 3D Fractal specific
    { name: 'frType', label: 'Fractal Type', type: 'select', options: ['Mandelbulb', 'Mandelbox'], modes: ['3D Fractal'] },
    { name: 'frPower', label: 'Power', type: 'slider', min: 1, max: 20, step: 0.1, modulatable: true, modes: ['3D Fractal'] },
    { name: 'frIter', label: 'Iterations', type: 'slider', min: 4, max: 32, step: 1, modulatable: true, modes: ['3D Fractal'] },
    { name: 'frBailout', label: 'Bailout', type: 'slider', min: 1, max: 10, step: 0.1, modulatable: true, modes: ['3D Fractal'] },
    { name: 'frScale', label: 'Scale', type: 'slider', min: 0.5, max: 4, step: 0.1, modulatable: true, modes: ['3D Fractal'] },
    // 2D Flow specific
    { name: 'noiseScale', label: 'Noise Scale', type: 'slider', min: 0.1, max: 10, step: 0.1, modulatable: true, modes: ['2D flow'] },
    { name: 'speed', label: 'Speed', type: 'slider', min: 0, max: 5, step: 0.1, modulatable: true, modes: ['2D flow'] },
    { name: 'curl', label: 'Curl', type: 'slider', min: 0, max: 2, step: 0.1, modulatable: true, modes: ['2D flow'] },
    // 3D Fabric specific
    { name: 'fold', label: 'Fold', type: 'slider', min: 0, max: 1, step: 0.01, modulatable: true, modes: ['3D fabric'] },
    { name: 'warp', label: 'Warp', type: 'slider', min: 0, max: 2, step: 0.1, modulatable: true, modes: ['3D fabric'] },
    { name: 'layers', label: 'Layers', type: 'slider', min: 1, max: 20, step: 1, modes: ['3D fabric'] },
  ],
  Color: [
    { name: 'palette', label: 'Palette', type: 'select', options: ['sunset', 'ocean', 'fire', 'forest', 'monochrome'] },
    { name: 'paletteOffset', label: 'Offset', type: 'slider', min: 0, max: 1, step: 0.01, modulatable: true },
    { name: 'hueShift', label: 'Hue Shift', type: 'slider', min: 0, max: 360, step: 1, modulatable: true },
    { name: 'exposure', label: 'Exposure', type: 'slider', min: 0.1, max: 3, step: 0.1, modulatable: true },
  ],
  Lighting: [
    { name: 'frLightAz', label: 'Azimuth', type: 'slider', min: 0, max: 360, step: 1, modulatable: true, modes: ['3D Fractal'] },
    { name: 'frLightEl', label: 'Elevation', type: 'slider', min: -90, max: 90, step: 1, modulatable: true, modes: ['3D Fractal'] },
    { name: 'frAmbient', label: 'Ambient', type: 'slider', min: 0, max: 1, step: 0.01, modulatable: true, modes: ['3D Fractal'] },
    { name: 'frDiffuse', label: 'Diffuse', type: 'slider', min: 0, max: 2, step: 0.1, modulatable: true, modes: ['3D Fractal'] },
    { name: 'frGlow', label: 'Glow', type: 'slider', min: 0, max: 2, step: 0.1, modulatable: true, modes: ['3D Fractal'] },
  ],
  Camera: [
    { name: 'frCamDist', label: 'Distance', type: 'slider', min: 1, max: 10, step: 0.1, modulatable: true, modes: ['3D Fractal'] },
    { name: 'frCamFov', label: 'FOV', type: 'slider', min: 30, max: 120, step: 1, modulatable: true, modes: ['3D Fractal'] },
    { name: 'frRotSpeed', label: 'Rotation', type: 'slider', min: 0, max: 1, step: 0.01, modulatable: true, modes: ['3D Fractal'] },
    { name: 'camDist', label: 'Distance', type: 'slider', min: 1, max: 20, step: 0.1, modulatable: true, modes: ['3D fabric'] },
    { name: 'zoom', label: 'Zoom', type: 'slider', min: 0.1, max: 5, step: 0.1, modulatable: true, modes: ['2D flow'] },
  ],
};

export class ControlPanel {
  private container: HTMLElement;
  private config: PanelConfig;
  private audioMeterElements: Map<string, { bar: HTMLElement, value: HTMLElement }> = new Map();
  private beatPulseElement: HTMLElement | null = null;
  private controlElements: Map<string, HTMLInputElement> = new Map();
  private isCollapsed = false;
  private isHidden = false;

  constructor(config: PanelConfig) {
    this.config = config;
    this.container = this.createPanel();
    document.body.appendChild(this.container);
    this.setupEventListeners();
    this.updateModeVisibility();
  }

  private createPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'flow-panel';
    panel.innerHTML = `
      <div class="panel-header">
        <h1 class="panel-title">Flow Engine</h1>
        <div class="panel-controls">
          <button class="panel-btn" data-action="collapse" title="Collapse (C)">−</button>
          <button class="panel-btn" data-action="hide" title="Hide (H)">×</button>
        </div>
      </div>
      <div class="panel-body">
        ${this.createSections()}
        ${this.createKeyboardHints()}
      </div>
    `;
    return panel;
  }

  private createSections(): string {
    let html = '';
    
    for (const [sectionName, controls] of Object.entries(CONTROL_DEFS)) {
      html += `
        <div class="panel-section" data-section="${sectionName.toLowerCase()}">
          <div class="section-header">
            <span class="section-arrow">▼</span>
            <span>${sectionName}</span>
          </div>
          <div class="section-body">
            ${controls.map(c => this.createControl(c)).join('')}
          </div>
        </div>
      `;
    }
    
    // Audio section (always visible)
    html += `
      <div class="panel-section" data-section="audio">
        <div class="section-header">
          <span class="section-arrow">▼</span>
          <span>Audio & Beat</span>
        </div>
        <div class="section-body">
          <div class="audio-source">Source: <span id="audio-source-display">None</span></div>
          <div class="audio-meters">
            ${this.createMeter('level', 'Level')}
            ${this.createMeter('bass', 'Bass')}
            ${this.createMeter('mid', 'Mid')}
            ${this.createMeter('high', 'High')}
          </div>
          <div class="beat-indicator">
            <div class="beat-pulse" id="beat-pulse"></div>
            <span class="bpm-display" id="bpm-display">120 BPM</span>
          </div>
        </div>
      </div>
    `;
    
    return html;
  }

  private createControl(def: ControlDef): string {
    const value = this.config.params[def.name] ?? '';
    const modulated = false; // TODO: check modulationSystem
    
    if (def.type === 'slider') {
      return `
        <div class="control ${modulated ? 'modulated' : ''}" data-control="${def.name}" data-modes="${(def.modes || []).join(',')}">
          <div class="control-row">
            <label class="control-label">${def.label}</label>
            <input 
              type="range" 
              class="control-slider"
              data-param="${def.name}"
              min="${def.min}" 
              max="${def.max}" 
              step="${def.step}"
              value="${value}"
            />
            <span class="control-value" data-value="${def.name}">${typeof value === 'number' ? value.toFixed(2) : value}</span>
            ${def.modulatable ? '<button class="beat-link-btn" data-link="${def.name}" title="Link to beat">🔗</button>' : ''}
          </div>
        </div>
      `;
    } else if (def.type === 'select') {
      const options = def.options || [];
      return `
        <div class="control" data-control="${def.name}" data-modes="${(def.modes || []).join(',')}">
          <div class="control-row">
            <label class="control-label">${def.label}</label>
            <select class="control-select" data-param="${def.name}">
              ${options.map(opt => `<option value="${opt}" ${value === opt ? 'selected' : ''}>${opt}</option>`).join('')}
            </select>
          </div>
        </div>
      `;
    } else if (def.type === 'button') {
      return `
        <div class="control" data-control="${def.name}">
          <button class="control-button" data-action="${def.name}">${def.label}</button>
        </div>
      `;
    }
    return '';
  }

  private createMeter(type: string, label: string): string {
    return `
      <div class="meter-row">
        <label class="meter-label">${label}</label>
        <div class="meter-bar">
          <div class="meter-fill ${type}" data-meter="${type}"></div>
        </div>
        <span class="meter-value" data-meter-value="${type}">0.00</span>
      </div>
    `;
  }

  private createKeyboardHints(): string {
    return `
      <div class="keyboard-hint">
        <span><kbd>H</kbd> Hide</span>
        <span><kbd>C</kbd> Collapse</span>
        <span><kbd>Shift</kbd>+<kbd>R</kbd> Randomize</span>
        <span><kbd>Space</kbd> Pause</span>
      </div>
    `;
  }

  private setupEventListeners(): void {
    // Panel controls
    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const action = target.dataset.action;
      
      if (action === 'collapse') {
        this.toggleCollapse();
      } else if (action === 'hide') {
        this.hide();
      }
    });

    // Section collapse
    this.container.querySelectorAll('.section-header').forEach(header => {
      header.addEventListener('click', () => {
        const section = header.closest('.panel-section')!;
        section.classList.toggle('collapsed');
      });
    });

    // Parameter controls
    this.container.querySelectorAll('[data-param]').forEach(input => {
      const param = (input as HTMLInputElement).dataset.param!;
      this.controlElements.set(param, input as HTMLInputElement);
      
      input.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        let value: any = target.value;
        
        if (target.type === 'range') {
          value = parseFloat(value);
        }
        
        this.config.params[param] = value;
        this.updateValueDisplay(param, value);
        
        if (this.config.onChange) {
          this.config.onChange(param, value);
        }
        
        // Update mode visibility when mode changes
        if (param === 'mode') {
          this.updateModeVisibility();
        }
      });
    });

    // Beat link buttons
    this.container.querySelectorAll('[data-link]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const param = (btn as HTMLElement).dataset.link!;
        this.showBeatLinkPopup(param);
      });
    });

    // Keyboard shortcuts
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      if (e.key === 'h' || e.key === 'H') {
        this.toggleHide();
        e.preventDefault();
      } else if (e.key === 'c' || e.key === 'C') {
        this.toggleCollapse();
        e.preventDefault();
      }
    });

    // Store meter elements
    this.container.querySelectorAll('[data-meter]').forEach(el => {
      const type = (el as HTMLElement).dataset.meter!;
      const valueEl = this.container.querySelector(`[data-meter-value="${type}"]`) as HTMLElement;
      this.audioMeterElements.set(type, { bar: el as HTMLElement, value: valueEl });
    });

    this.beatPulseElement = this.container.querySelector('#beat-pulse');
  }

  private updateValueDisplay(param: string, value: any): void {
    const valueEl = this.container.querySelector(`[data-value="${param}"]`);
    if (valueEl) {
      if (typeof value === 'number') {
        valueEl.textContent = value.toFixed(2);
      } else {
        valueEl.textContent = value.toString();
      }
    }
  }

  private updateModeVisibility(): void {
    const currentMode = this.config.params.mode;
    
    this.container.querySelectorAll('[data-control]').forEach(el => {
      const control = el as HTMLElement;
      const modes = control.dataset.modes;
      
      // If no modes specified, visible in all modes
      if (!modes || modes === '') {
        control.style.display = '';
        return;
      }
      
      // Check if current mode is in the allowed modes list
      const allowedModes = modes.split(',');
      const isVisible = allowedModes.includes(currentMode);
      control.style.display = isVisible ? '' : 'none';
    });

    // Show/hide entire sections based on mode
    const sectionsVisibility: Record<string, string[]> = {
      'lighting': ['3D Fractal', '3D fabric'],
      'camera': ['3D Fractal', '3D fabric', '2D flow'],
    };

    for (const [section, modes] of Object.entries(sectionsVisibility)) {
      const sectionEl = this.container.querySelector(`[data-section="${section}"]`);
      if (sectionEl) {
        const isVisible = modes.includes(currentMode);
        (sectionEl as HTMLElement).style.display = isVisible ? '' : 'none';
      }
    }
  }

  private showBeatLinkPopup(param: string): void {
    // TODO: Implement beat link popup
    // For now, just toggle the button state
    const btn = this.container.querySelector(`[data-link="${param}"]`);
    if (btn) {
      btn.classList.toggle('active');
    }
    console.log('Beat link popup for:', param);
  }

  public update(): void {
    const audio = this.config.audioState;
    
    // Update audio meters
    this.updateMeter('level', audio.level);
    this.updateMeter('bass', audio.bass);
    this.updateMeter('mid', audio.mid);
    this.updateMeter('high', audio.high);
    
    // Update beat pulse
    if (this.beatPulseElement) {
      if (audio.beatDetected) {
        this.beatPulseElement.classList.add('active');
        setTimeout(() => this.beatPulseElement?.classList.remove('active'), 100);
      }
    }
    
    // Update BPM display
    const bpmEl = this.container.querySelector('#bpm-display');
    if (bpmEl) {
      bpmEl.textContent = `${Math.round(audio.bpm)} BPM`;
    }
    
    // Update audio source display
    const sourceEl = this.container.querySelector('#audio-source-display');
    if (sourceEl) {
      const sourceLabels: Record<string, string> = {
        'none': 'None',
        'file': audio.fileName || 'File',
        'mic': 'Microphone',
        'system': 'System Audio (Spotify)'
      };
      sourceEl.textContent = sourceLabels[audio.source] || audio.source;
    }
  }

  private updateMeter(type: string, value: number): void {
    const meter = this.audioMeterElements.get(type);
    if (!meter) return;
    
    const percent = Math.min(100, Math.max(0, value * 100));
    meter.bar.style.width = `${percent}%`;
    meter.value.textContent = value.toFixed(2);
  }

  public toggleCollapse(): void {
    this.isCollapsed = !this.isCollapsed;
    this.container.classList.toggle('collapsed', this.isCollapsed);
  }

  public toggleHide(): void {
    this.isHidden = !this.isHidden;
    this.container.classList.toggle('hidden', this.isHidden);
  }

  public hide(): void {
    this.isHidden = true;
    this.container.classList.add('hidden');
  }

  public show(): void {
    this.isHidden = false;
    this.container.classList.remove('hidden');
  }

  public updateParam(param: string, value: any): void {
    const input = this.controlElements.get(param);
    if (input) {
      input.value = value;
      this.updateValueDisplay(param, value);
    }
  }

  public destroy(): void {
    this.container.remove();
  }
}
