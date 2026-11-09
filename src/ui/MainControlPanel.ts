// Main Control Panel - Complete UI replacement for lil-gui
import type { AudioState } from '../audio';
import type ModulationSystem from '../modulation';
import { BeatLinkPopup } from './BeatLinkPopup';
import { COLOR_PRESETS, applyColorPreset, type ColorPreset } from './ColorPresets';
import { LIGHTING_RIGS, applyLightingRig, type LightingRig } from './LightingPresets';

interface ControlConfig {
  params: any;
  audioState: AudioState;
  modulationSystem: ModulationSystem;
  onModeChange?: () => void;
  onReset?: () => void;
  onRandomize?: () => void;
  onSavePreset?: () => void;
  onExportJSON?: () => void;
  onImportJSON?: () => void;
}

export class MainControlPanel {
  private container: HTMLElement;
  private config: ControlConfig;
  private controls: Map<string, HTMLElement> = new Map();
  private sections: Map<string, HTMLElement> = new Map();
  private beatPulse: HTMLElement | null = null;
  private audioMeters: Map<string, { bar: HTMLElement; value: HTMLElement }> = new Map();
  private globalListenersAttached = false;

  constructor(config: ControlConfig) {
    this.config = config;
    this.container = this.build();
    document.body.appendChild(this.container);
    this.setupEventListeners();
    this.setupGlobalListeners();
  }

  private build(): HTMLElement {
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
        ${this.buildSections()}
        ${this.buildKeyboardHints()}
      </div>
    `;
    return panel;
  }

  private buildSections(): string {
    const mode = this.config.params.mode;
    let html = '';

    // Scene section (always visible)
    html += this.buildSection('Scene', [
      this.buildSelect('mode', 'Mode', ['Wall Studio', 'Tunnel', 'Kaleido', 'Plasma', 'Morph', '3D Fractal', '3D fabric', 'Liquid Spheres', 'Particle Fabric', '2D flow']),
      this.buildSlider('seed', 'Seed', 0, 999999, 1),
      this.buildButton('randomize', '🎲 Randomize', 'randomize'),
      this.buildButton('reset', '⛑ Reset', 'reset'),
      this.buildCheckbox('paused', 'Paused')
    ]);

    // Mode-specific sections
    if (false && mode === '2D Fractal') { // Removed
      html += this.buildSection('Fractal Type', [
        this.buildSelect('fr2Type', 'Type', { 'Mandelbrot': 0, 'Julia': 1, 'Burning Ship': 2, 'Newton': 3, 'Phoenix': 4 }),
        this.buildSlider('fr2MaxIter', 'Iterations', 32, 512, 1, true),
      ]);
      html += this.buildSection('View', [
        this.buildSlider('fr2Zoom', 'Zoom', 1, 1000, 1, true),
        this.buildSlider('fr2CenterX', 'Center X', -2, 2, 0.001, true),
        this.buildSlider('fr2CenterY', 'Center Y', -2, 2, 0.001, true),
        this.buildSlider('fr2Rotation', 'Rotation', -180, 180, 1, true),
      ]);
      html += this.buildSection('Julia', [
        this.buildSlider('fr2JuliaCX', 'Julia C Real', -2, 2, 0.001, true),
        this.buildSlider('fr2JuliaCY', 'Julia C Imag', -2, 2, 0.001, true),
        this.buildCheckbox('fr2JuliaOrbit', 'Orbit Animation'),
        this.buildSlider('fr2OrbitSpeed', 'Orbit Speed', 0, 2, 0.01, true),
      ]);
      html += this.buildSection('Animation', [
        this.buildCheckbox('fr2AutoZoom', 'Auto Zoom'),
        this.buildSlider('fr2ZoomSpeed', 'Zoom Speed', 0, 2, 0.01, true),
        this.buildSlider('fr2PaletteCycle', 'Palette Cycle', -10, 10, 0.1, true),
      ]);
    } else if (mode === '2D flow') {
      html += this.buildSection('Flow Field', [
        this.buildSlider('noiseScale', 'Noise Scale', 0.3, 5, 0.01, true),
        this.buildSlider('evolution', 'Evolution', 0, 1, 0.001, true),
        this.buildSlider('curl', 'Curl', 0, 3, 0.01, true),
        this.buildSlider('turbulence', 'Turbulence', 0, 1.5, 0.01, true),
        this.buildSlider('speed', 'Speed', 0, 3, 0.01, true),
      ]);
      html += this.buildSection('Particles', [
        this.buildSlider('life', 'Life Rate', 0.03, 1, 0.01, true),
        this.buildSlider('decay', 'Trail Decay', 0.85, 0.995, 0.001, true),
        this.buildSlider('pointSize', 'Point Size', 0.5, 5, 0.05, true),
        this.buildSlider('gain', 'Energy', 0.01, 0.3, 0.001, true),
      ]);
    } else if (mode === '3D fabric') {
      html += this.buildSection('Fabric Shape', [
        this.buildSlider('fold', 'Fold', 0, 1.5, 0.01, true),
        this.buildSlider('warp', 'Warp', 0, 2, 0.01, true),
        this.buildSlider('scale3d', 'Frequency', 0.2, 3, 0.01, true),
        this.buildSlider('detail', 'Detail', 1, 5, 1, true),
        this.buildSlider('layers', 'Layers', 1, 5, 1, true),
        this.buildSlider('evolution3d', 'Flow Speed', 0, 0.5, 0.001, true),
      ]);
      html += this.buildSection('Material', [
        this.buildSlider('gloss', 'Gloss', 4, 256, 1, true),
        this.buildSlider('spec', 'Specular', 0, 3, 0.01, true),
        this.buildSlider('iridescence', 'Iridescence', 0, 1, 0.01, true),
        this.buildSlider('saturation', 'Saturation', 0.5, 2, 0.01, true),
        this.buildSlider('brightness', 'Brightness', 0.3, 3, 0.01, true),
      ]);
      html += this.buildSection('Camera', [
        this.buildSlider('camDist', 'Distance', 1.5, 6, 0.01, true),
        this.buildSlider('fov', 'FOV', 20, 80, 0.1, true),
        this.buildSlider('orbitSpeed', 'Orbit', 0, 0.5, 0.001, true),
      ]);
    } else if (mode === 'Particle Fabric') {
      html += this.buildSection('Physics', [
        this.buildSlider('mass', 'Mass', 0.2, 3, 0.01, true),
        this.buildSlider('stiffness', 'Stiffness', 0.2, 3, 0.01, true),
        this.buildSlider('damping', 'Damping', 0, 1, 0.01, true),
        this.buildSlider('wind', 'Wind', 0, 1.5, 0.01, true),
      ]);
      html += this.buildSection('Particles', [
        this.buildSlider('stream', 'Stream Speed', 0, 4, 0.01, true),
        this.buildSlider('pLife', 'Respawn', 0.02, 1, 0.01, true),
        this.buildSlider('vmax', 'Speed Limit', 0.5, 20, 0.1, true),
        this.buildSlider('pWidth', 'Width', 0.5, 4, 0.01, true),
        this.buildSlider('pGain', 'Glow', 0.005, 0.3, 0.001, true),
      ]);
    } else if (mode === 'Grass Field') {
      html += this.buildSection('Grass', [
        this.buildCheckbox('gOn', 'Grass On'),
        this.buildSlider('gH', 'Height', 0.05, 1.2, 0.01, true),
        this.buildSlider('gW', 'Width', 0.003, 0.04, 0.001, true),
        this.buildSlider('gCurv', 'Curvature', 0, 1.5, 0.01, true),
        this.buildSlider('gDensity', 'Density', 128, 768, 16, true),
      ]);
      html += this.buildSection('Wind', [
        this.buildSlider('gWind', 'Strength', 0, 2, 0.01, true),
        this.buildSlider('gWindAz', 'Direction', -180, 180, 1, true),
        this.buildSlider('gGustK', 'Gust Size', 0.05, 2, 0.01, true),
        this.buildSlider('gGustSpeed', 'Gust Speed', 0, 6, 0.01, true),
      ]);
      html += this.buildSection('Camera', [
        this.buildSlider('gcDist', 'Distance', 0.3, 7, 0.01, true),
        this.buildSlider('gcHeight', 'Height', 0, 3, 0.01, true),
        this.buildSlider('gcFov', 'FOV', 15, 90, 0.5, true),
      ]);
    } else if (mode === 'Liquid Spheres' || mode === 'Wall Studio') {
      html += this.buildSection('Fabric', [
        this.buildSlider('fold', 'Fold', 0, 1.5, 0.01, true),
        this.buildSlider('warp', 'Warp', 0, 2, 0.01, true),
        this.buildSlider('scale3d', 'Frequency', 0.2, 3, 0.01, true),
      ]);
      html += this.buildSection('Spheres', [
        this.buildSlider('lsRadius', 'Radius', 0.015, 0.1, 0.001, true),
        this.buildSlider('lsDrip', 'Drip Rate', 30, 3000, 10, true),
        this.buildSlider('lsVisc', 'Viscosity', 0, 0.5, 0.005, true),
        this.buildSlider('lsCoh', 'Cohesion', 0, 1, 0.01, true),
      ]);
      html += this.buildSection('Camera', [
        this.buildSlider('camDist', 'Distance', 1.5, 6, 0.01, true),
        this.buildSlider('fov', 'FOV', 20, 80, 0.1, true),
      ]);
    } else if (mode === '3D Fractal') {
      html += this.buildSection('Fractal', [
        this.buildSelect('frType', 'Type', { 
          'Mandelbulb': 0, 
          'Mandelbox': 1, 
          'Menger Sponge': 2, 
          'Sierpinski': 3, 
          'Kaleidoscopic': 4, 
          'Quaternion Julia': 5 
        }),
        this.buildSlider('frPower', 'Power', 2, 16, 0.1, true),
        this.buildSlider('frIter', 'Iterations', 4, 24, 1, true),
        this.buildSlider('frBailout', 'Bailout', 1, 10, 0.1, true),
        this.buildSlider('frScale', 'Scale', -3, 3, 0.1, true),
      ]);
      html += this.buildSection('Camera', [
        this.buildSlider('frCamDist', 'Distance', 1, 10, 0.1, true),
        this.buildSlider('frCamFov', 'FOV', 30, 90, 1, true),
        this.buildSlider('frRotSpeed', 'Rotation', 0, 0.5, 0.01, true),
      ]);
      html += this.buildSection('Lighting', [
        this.buildSlider('frLightAz', 'Azimuth', 0, 360, 1, true),
        this.buildSlider('frLightEl', 'Elevation', -90, 90, 1, true),
        this.buildSlider('frAmbient', 'Ambient', 0, 1, 0.01, true),
        this.buildSlider('frDiffuse', 'Diffuse', 0, 2, 0.1, true),
        this.buildSlider('frGlow', 'Glow', 0, 2, 0.1, true),
      ]);
      html += this.buildSection('Motion', [
        this.buildSlider('frMorph', 'Morph Amount', 0, 1, 0.01, true),
        this.buildCheckbox('frJuliaOrbit', 'Julia C Orbit'),
        this.buildSlider('frJuliaSpeed', 'Julia Orbit Speed', 0, 2, 0.01, true),
        this.buildSlider('frFoldRot', 'Fold Rotation', 0, 360, 1, true),
        this.buildCheckbox('frCamOrbit', 'Camera Orbit'),
        this.buildSlider('frCamOrbitSpeed', 'Orbit Speed', 0, 1, 0.01, true),
        this.buildCheckbox('frSlicePlane', 'Slice Plane'),
        this.buildSlider('frSlicePos', 'Slice Position', -2, 2, 0.01, true),
      ]);
      html += this.buildSection('Quality', [
        this.buildSlider('frMaxSteps', 'Ray Steps', 64, 256, 1, true),
        this.buildSlider('frMaxDist', 'Max Distance', 10, 50, 1, true),
      ]);
    }

    // Unified Color section (always visible, mode-aware)
    html += this.buildColorSection(mode);

    // Unified Lighting section (3D modes only)
    const is2D = mode === '2D flow';
    if (!is2D) {
      html += this.buildLightingSection(mode);
    }

    // Audio section (always visible)
    html += this.buildAudioSection();

    // Presets section (always visible)
    html += this.buildPresetsSection();

    return html;
  }

  private buildSection(title: string, controls: string[]): string {
    return `
      <div class="panel-section" data-section="${title.toLowerCase()}">
        <div class="section-header">
          <span class="section-arrow">▼</span>
          <span>${title}</span>
        </div>
        <div class="section-body">
          ${controls.join('')}
        </div>
      </div>
    `;
  }

  private buildSlider(param: string, label: string, min: number, max: number, step: number, modulatable = false): string {
    const value = this.config.params[param] ?? ((min + max) / 2);
    const beatBtn = modulatable ? `<button class="beat-link-btn" data-param="${param}" title="Link to beat">🔗</button>` : '';
    return `
      <div class="control" data-param="${param}">
        <div class="control-row">
          <label class="control-label">${label}</label>
          <input type="range" class="control-slider" 
            data-param="${param}"
            min="${min}" max="${max}" step="${step}" value="${value}" />
          <span class="control-value" data-value="${param}">${typeof value === 'number' ? value.toFixed(2) : value}</span>
          ${beatBtn}
        </div>
      </div>
    `;
  }

  private buildSelect(param: string, label: string, options: any): string {
    const value = this.config.params[param];
    const opts = Array.isArray(options) ? options : Object.keys(options);
    const optionsHtml = opts.map(opt => {
      const val = Array.isArray(options) ? opt : options[opt];
      return `<option value="${val}" ${value == val ? 'selected' : ''}>${opt}</option>`;
    }).join('');
    
    return `
      <div class="control" data-param="${param}">
        <div class="control-row">
          <label class="control-label">${label}</label>
          <select class="control-select" data-param="${param}">
            ${optionsHtml}
          </select>
        </div>
      </div>
    `;
  }

  private buildCheckbox(param: string, label: string): string {
    const checked = this.config.params[param] ? 'checked' : '';
    return `
      <div class="control" data-param="${param}">
        <div class="control-row">
          <label class="control-label">
            <input type="checkbox" data-param="${param}" ${checked} />
            ${label}
          </label>
        </div>
      </div>
    `;
  }

  private buildButton(action: string, label: string, callback: string): string {
    return `
      <div class="control">
        <button class="control-button" data-action="${callback}">${label}</button>
      </div>
    `;
  }

  private buildAudioSection(): string {
    return `
      <div class="panel-section" data-section="audio">
        <div class="section-header">
          <span class="section-arrow">▼</span>
          <span>Audio & Beat</span>
        </div>
        <div class="section-body">
          <div class="audio-source">Source: <span id="audio-source">None</span></div>
          <div class="audio-meters">
            <div class="meter-row">
              <label class="meter-label">Level</label>
              <div class="meter-bar"><div class="meter-fill level" data-meter="level"></div></div>
              <span class="meter-value" data-meter-value="level">0.00</span>
            </div>
            <div class="meter-row">
              <label class="meter-label">Bass</label>
              <div class="meter-bar"><div class="meter-fill bass" data-meter="bass"></div></div>
              <span class="meter-value" data-meter-value="bass">0.00</span>
            </div>
            <div class="meter-row">
              <label class="meter-label">Mid</label>
              <div class="meter-bar"><div class="meter-fill mid" data-meter="mid"></div></div>
              <span class="meter-value" data-meter-value="mid">0.00</span>
            </div>
            <div class="meter-row">
              <label class="meter-label">High</label>
              <div class="meter-bar"><div class="meter-fill high" data-meter="high"></div></div>
              <span class="meter-value" data-meter-value="high">0.00</span>
            </div>
          </div>
          <div class="section-subheader">Drums</div>
          <div class="audio-meters">
            <div class="meter-row">
              <label class="meter-label">Kick</label>
              <div class="meter-bar"><div class="meter-fill kick" data-meter="kick"></div></div>
              <span class="meter-value" data-meter-value="kick">0.00</span>
            </div>
            <div class="meter-row">
              <label class="meter-label">Snare</label>
              <div class="meter-bar"><div class="meter-fill snare" data-meter="snare"></div></div>
              <span class="meter-value" data-meter-value="snare">0.00</span>
            </div>
            <div class="meter-row">
              <label class="meter-label">Hat</label>
              <div class="meter-bar"><div class="meter-fill hat" data-meter="hat"></div></div>
              <span class="meter-value" data-meter-value="hat">0.00</span>
            </div>
          </div>
          <div class="section-subheader">Envelopes</div>
          <div class="audio-meters">
            <div class="meter-row">
              <label class="meter-label">8th</label>
              <div class="meter-bar"><div class="meter-fill envelope8th" data-meter="envelope8th"></div></div>
              <span class="meter-value" data-meter-value="envelope8th">0.00</span>
            </div>
            <div class="meter-row">
              <label class="meter-label">16th</label>
              <div class="meter-bar"><div class="meter-fill envelope16th" data-meter="envelope16th"></div></div>
              <span class="meter-value" data-meter-value="envelope16th">0.00</span>
            </div>
            <div class="meter-row">
              <label class="meter-label">32nd</label>
              <div class="meter-bar"><div class="meter-fill envelope32nd" data-meter="envelope32nd"></div></div>
              <span class="meter-value" data-meter-value="envelope32nd">0.00</span>
            </div>
          </div>
          <div class="beat-indicator">
            <div class="beat-pulse" id="beat-pulse"></div>
            <span class="bpm-display" id="bpm-display">120 BPM</span>
          </div>
        </div>
      </div>
    `;
  }

  private buildPresetsSection(): string {
    return `
      <div class="panel-section" data-section="presets">
        <div class="section-header">
          <span class="section-arrow">▼</span>
          <span>Presets</span>
        </div>
        <div class="section-body">
          <div class="control">
            <button class="control-button" data-action="save-preset">💾 Save Preset</button>
          </div>
          <div class="control">
            <button class="control-button" data-action="export-json">⬇ Export JSON</button>
          </div>
          <div class="control">
            <button class="control-button" data-action="import-json">⬆ Import JSON</button>
          </div>
        </div>
      </div>
    `;
  }

  private buildColorSection(mode: string): string {
    const presetOptions = Object.keys(COLOR_PRESETS);
    const controls: string[] = [];
    
    // Color preset selector
    controls.push(this.buildSelect('colorPreset', 'Preset', presetOptions));
    
    // Universal controls
    controls.push(this.buildSlider('exposure', 'Exposure', 0.4, 4, 0.01, true));
    controls.push(this.buildSlider('bloom', 'Bloom', 0, 2, 0.01, true));
    
    // Mode-specific color controls
    if (mode === '3D Fractal') {
      controls.push(this.buildColorPicker('frColor1', 'Color 1'));
      controls.push(this.buildColorPicker('frColor2', 'Color 2'));
      controls.push(this.buildSlider('frColorMix', 'Color Mix', 0, 10, 0.1, true));
    } else if (mode === '2D flow') {
      controls.push(this.buildSlider('hueShift', 'Hue Shift', -180, 180, 1, true));
      controls.push(this.buildSlider('colorBySpeed', 'Color by Speed', 0, 1, 0.01, true));
      controls.push(this.buildColorPicker('background', 'Background'));
    } else if (mode === 'Grass Field') {
      controls.push(this.buildColorPicker('gBase', 'Base Color'));
      controls.push(this.buildColorPicker('gTip', 'Tip Color'));
      controls.push(this.buildColorPicker('gDryC', 'Dry Color'));
      controls.push(this.buildSlider('gDry', 'Dry Amount', 0, 1, 0.01, true));
    } else {
      // Default for 3D fabric, Particle Fabric, Wall Studio, Liquid Spheres
      controls.push(this.buildSlider('hueShift', 'Hue Shift', -180, 180, 1, true));
      controls.push(this.buildSlider('saturation', 'Saturation', 0.5, 2, 0.01, true));
      controls.push(this.buildColorPicker('background', 'Background'));
    }
    
    // Color animation
    controls.push(this.buildSlider('cHueCycle', 'Hue Cycle', -20, 20, 0.1, true));
    
    return this.buildSection('Color', controls);
  }

  private buildLightingSection(mode: string): string {
    const rigOptions = Object.keys(LIGHTING_RIGS);
    const controls: string[] = [];
    
    // Studio rig preset
    controls.push(this.buildSelect('lightingRig', 'Studio Rig', rigOptions));
    
    // Key light controls
    controls.push(this.buildSlider('envIntensity', 'Environment', 0, 3, 0.01, true));
    controls.push(this.buildSlider('envRot', 'Env Rotation', -180, 180, 1, true));
    
    // Shadow and AO
    controls.push(this.buildSlider('shadowSoft', 'Shadow Softness', 0, 1, 0.01, true));
    controls.push(this.buildSlider('ao', 'Ambient Occlusion', 0, 2, 0.01, true));
    
    // Atmosphere
    controls.push(this.buildSlider('fog', 'Fog', 0, 1, 0.01, true));
    controls.push(this.buildSelect('toneMap', 'Tone Map', ['ACES', 'Filmic (AgX-style)', 'Exponential']));
    
    return this.buildSection('Lighting & Studio', controls);
  }

  private buildColorPicker(param: string, label: string): string {
    const value = this.config.params[param] || '#ffffff';
    return `
      <div class="control" data-param="${param}">
        <div class="control-row">
          <label class="control-label">${label}</label>
          <input type="color" class="control-color" 
            data-param="${param}"
            value="${value}" />
        </div>
      </div>
    `;
  }

  private buildKeyboardHints(): string {
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
    // Section collapse
    this.container.querySelectorAll('.section-header').forEach(header => {
      header.addEventListener('click', () => {
        header.closest('.panel-section')?.classList.toggle('collapsed');
      });
    });

    // Parameter controls - only actual inputs/selects, not wrapper divs
    this.container.querySelectorAll('input[data-param], select[data-param]').forEach(el => {
      const input = el as HTMLInputElement | HTMLSelectElement;
      const param = input.dataset.param!;
      
      input.addEventListener('input', () => {
        let value: any = input.value;
        
        if (input.type === 'range') {
          value = parseFloat(value);
          // Round integers safely
          if (param === 'frIter' || param === 'frMaxSteps' || param === 'seed') {
            value = Math.round(value);
          }
        } else if (input.type === 'checkbox') {
          value = (input as HTMLInputElement).checked;
        } else if (input.type === 'color') {
          // Color inputs return hex strings
          value = input.value;
        } else if (input.tagName === 'SELECT') {
          // Handle color preset selection
          if (param === 'colorPreset') {
            const preset = COLOR_PRESETS[value];
            if (preset) {
              applyColorPreset(preset, this.config.params, this.config.params.mode);
              this.syncDisplayedValues();
              return; // Preset applied, don't set individual param
            }
          }
          // Handle lighting rig selection
          if (param === 'lightingRig') {
            const rig = LIGHTING_RIGS[value];
            if (rig) {
              applyLightingRig(rig, this.config.params);
              this.syncDisplayedValues();
              return; // Rig applied, don't set individual param
            }
          }
          // Only coerce fully numeric strings
          const num = Number(value);
          value = (value !== '' && !isNaN(num)) ? num : value;
        }
        
        this.config.params[param] = value;
        this.updateValueDisplay(param, value);
        
        // Apply per-type defaults for 3D fractals
        if (param === 'frType') {
          const P = this.config.params;
          // Auto-rotation for all fractals
          P.frRotSpeed = 0.15;
          
          if (value === 0) { // Mandelbulb
            P.frIter = 12; P.frPower = 8; P.frCamDist = 2.5;
          } else if (value === 1) { // Mandelbox
            P.frIter = 12; P.frScale = -1.8; P.frCamDist = 7;
          } else if (value === 2) { // Menger Sponge
            P.frIter = 5; P.frCamDist = 4;
          }
          this.syncDisplayedValues();
        }
        
        // 2D Fractal removed
        
        if (param === 'mode' && this.config.onModeChange) {
          this.config.onModeChange();
          this.rebuild();
        }
      });
    });

    // Beat link buttons
    this.container.querySelectorAll('.beat-link-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const param = (btn as HTMLElement).dataset.param!;
        this.showBeatLinkPopup(param);
      });
    });

    // Store refs
    this.beatPulse = this.container.querySelector('#beat-pulse');
    this.container.querySelectorAll('[data-meter]').forEach(el => {
      const type = (el as HTMLElement).dataset.meter!;
      const valueEl = this.container.querySelector(`[data-meter-value="${type}"]`) as HTMLElement;
      this.audioMeters.set(type, { bar: el as HTMLElement, value: valueEl });
    });
  }

  private setupGlobalListeners(): void {
    if (this.globalListenersAttached) return;
    this.globalListenersAttached = true;

    // Panel controls (delegated to container, bound once)
    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const action = target.dataset.action;
      
      if (action === 'collapse') {
        this.container.classList.toggle('collapsed');
      } else if (action === 'hide') {
        this.container.classList.add('hidden');
      } else if (action === 'randomize' && this.config.onRandomize) {
        this.config.onRandomize();
      } else if (action === 'reset' && this.config.onReset) {
        this.config.onReset();
      } else if (action === 'save-preset' && this.config.onSavePreset) {
        this.config.onSavePreset();
      } else if (action === 'export-json' && this.config.onExportJSON) {
        this.config.onExportJSON();
      } else if (action === 'import-json' && this.config.onImportJSON) {
        this.config.onImportJSON();
      }
    });

    // Keyboard shortcuts (bound once)
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if (e.key === 'h' || e.key === 'H') {
        this.container.classList.toggle('hidden');
        e.preventDefault();
      } else if (e.key === 'c' || e.key === 'C') {
        this.container.classList.toggle('collapsed');
        e.preventDefault();
      }
    });
  }

  private updateValueDisplay(param: string, value: any): void {
    const valueEl = this.container.querySelector(`[data-value="${param}"]`);
    if (valueEl) {
      valueEl.textContent = typeof value === 'number' ? value.toFixed(2) : value.toString();
    }
  }

  private showBeatLinkPopup(param: string): void {
    const currentMapping = this.config.modulationSystem.getAllMappings()
      .find((m: any) => m.target === param);

    new BeatLinkPopup({
      param,
      currentMapping: currentMapping ? {
        source: currentMapping.source,
        amount: currentMapping.depth || 0.5,
        smoothing: currentMapping.smoothing || 0.7,
        invert: false // Note: current API doesn't support invert
      } : undefined,
      onSave: (mapping) => {
        const baseValue = this.config.params[param];
        
        // Remove existing mapping if any
        this.config.modulationSystem.removeMapping(param);
        
        // Add new mapping (API: target, source, baseValue)
        const newMapping = this.config.modulationSystem.addMapping(param, mapping.source as any, baseValue);
        
        // Update mapping properties
        newMapping.depth = mapping.amount;
        newMapping.smoothing = mapping.smoothing;
        // Note: invert not currently supported by ModulationSystem
        
        // Update UI indicator
        const btn = this.container.querySelector(`.beat-link-btn[data-param="${param}"]`);
        if (btn) btn.classList.add('active');
      },
      onRemove: () => {
        this.config.modulationSystem.removeMapping(param);
        const btn = this.container.querySelector(`.beat-link-btn[data-param="${param}"]`);
        if (btn) btn.classList.remove('active');
      },
      onCancel: () => {
        // Nothing needed
      }
    });
  }

  update(): void {
    const audio = this.config.audioState;
    
    // Update audio meters
    this.updateMeter('level', audio.level);
    this.updateMeter('bass', audio.bass);
    this.updateMeter('mid', audio.mid);
    this.updateMeter('high', audio.high);
    
    // Update drum meters
    this.updateMeter('kick', audio.kick);
    this.updateMeter('snare', audio.snare);
    this.updateMeter('hat', audio.hat);
    
    // Update envelope meters
    this.updateMeter('envelope8th', audio.envelope8th);
    this.updateMeter('envelope16th', audio.envelope16th);
    this.updateMeter('envelope32nd', audio.envelope32nd);
    
    // Update beat pulse
    if (this.beatPulse && audio.beatDetected) {
      this.beatPulse.classList.add('active');
      setTimeout(() => this.beatPulse?.classList.remove('active'), 100);
    }
    
    // Update BPM
    const bpmEl = this.container.querySelector('#bpm-display');
    if (bpmEl) bpmEl.textContent = `${Math.round(audio.bpm)} BPM`;
    
    // Update source
    const sourceEl = this.container.querySelector('#audio-source');
    if (sourceEl) {
      const labels: Record<string, string> = {
        'none': 'None',
        'file': audio.fileName || 'File',
        'mic': 'Microphone',
        'system': 'System (Spotify)'
      };
      sourceEl.textContent = labels[audio.source] || audio.source;
    }

    // Sync displayed values with external P changes (randomize, wheel zoom, etc.)
    this.syncDisplayedValues();
  }

  private syncDisplayedValues(): void {
    // Update all visible input/select values to match params
    this.container.querySelectorAll('input[data-param], select[data-param]').forEach(el => {
      const input = el as HTMLInputElement | HTMLSelectElement;
      const param = input.dataset.param!;
      const value = this.config.params[param];
      
      if (value === undefined) return;
      
      if (input.type === 'checkbox') {
        (input as HTMLInputElement).checked = !!value;
      } else if (input.type === 'color') {
        input.value = String(value);
      } else if (input.type === 'range' || input.tagName === 'SELECT') {
        input.value = String(value);
      }
      
      // Update display value
      this.updateValueDisplay(param, value);
    });
  }

  private updateMeter(type: string, value: number): void {
    const meter = this.audioMeters.get(type);
    if (!meter) return;
    
    const percent = Math.min(100, Math.max(0, value * 100));
    meter.bar.style.width = `${percent}%`;
    meter.value.textContent = value.toFixed(2);
  }

  private rebuild(): void {
    const body = this.container.querySelector('.panel-body');
    if (body) {
      body.innerHTML = this.buildSections() + this.buildKeyboardHints();
      // Re-setup event listeners for new DOM elements
      this.setupEventListeners();
      // Re-store refs after rebuild
      this.beatPulse = this.container.querySelector('#beat-pulse');
      this.audioMeters.clear();
      this.container.querySelectorAll('[data-meter]').forEach(el => {
        const type = (el as HTMLElement).dataset.meter!;
        const valueEl = this.container.querySelector(`[data-meter-value="${type}"]`) as HTMLElement;
        this.audioMeters.set(type, { bar: el as HTMLElement, value: valueEl });
      });
    }
  }

  show(): void {
    this.container.classList.remove('hidden');
  }

  hide(): void {
    this.container.classList.add('hidden');
  }

  toggle(): void {
    this.container.classList.toggle('hidden');
  }

  destroy(): void {
    this.container.remove();
  }
}
