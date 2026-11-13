// Main Control Panel - Complete UI replacement for lil-gui
import type { AudioState } from '../audio';
import type ModulationSystem from '../modulation';
import type { MidiManager } from '../midi';
import type { RemoteSync } from '../remote';
import { BeatLinkPopup } from './BeatLinkPopup';
import { COLOR_PRESETS, applyColorPreset, type ColorPreset } from './ColorPresets';
import { LIGHTING_RIGS, applyLightingRig, type LightingRig } from './LightingPresets';
import { STUDIO_LOOK_NAMES, STUDIO_MATS } from '../studio';
import { LAND_LOOK_NAMES } from '../landscape';
import { MODE_CONTROLS, presetNames, applyModePreset, saveModePreset, deleteModePreset, applyModeDefaults, type Ctl } from '../modeControls';
import { LINEUP_MODES } from '../lineup';
import { colorGroupsFor, applyGroupPalette, seedModeColors } from '../colorSystem';

interface ControlConfig {
  params: any;
  audioState: AudioState;
  modulationSystem: ModulationSystem;
  midiManager?: MidiManager;
  remoteSync?: RemoteSync;
  onModeChange?: () => void;
  onReset?: () => void;
  onRandomize?: () => void;
  onSavePreset?: () => void;
  onExportJSON?: () => void;
  onImportJSON?: () => void;
  onExportMidi?: () => void;
  onImportMidi?: () => void;
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
    seedModeColors(this.config.params, mode);
    let html = '';

    // Scene section (always visible)
    html += this.buildSection('Scene', [
      this.buildSelect('mode', 'Mode', [...LINEUP_MODES]),
      this.buildSlider('seed', 'Seed', 0, 999999, 1),
      this.buildSlider('resolutionScale', 'Quality / Resolution', 0.5, 1.0, 0.05, false),
      this.buildCheckbox('autoQuality', 'Auto Quality (60fps)'),
      this.buildButton('randomize', '🎲 Randomize', 'randomize'),
      this.buildButton('reset', '⛑ Reset', 'reset'),
      this.buildCheckbox('paused', 'Paused'),
      this.buildCheckbox('audioReactive', 'Audio Reactive (off = style only)'),
      ...(this.config.params.mode === 'Morph' ? [
        this.buildCheckbox('morphSculpt', 'Sculpt (3D AO blobs)'),
        this.buildSlider('sculptBlend', 'Sculpt Blend', 0.05, 2, 0.01, true),
        this.buildSlider('sculptAO', 'Sculpt AO', 0, 3, 0.01, true),
      ] : []),
      ...((['Kaleido', 'Tunnel', 'Plasma'].includes(this.config.params.mode) && !this.config.params.studio3d) || (this.config.params.mode === 'Morph' && !this.config.params.morphSculpt) ? [
        this.buildSlider('relief', 'Sculpt (AO relief)', 0, 1, 0.01, true),
        this.buildSlider('reliefDepth', 'Sculpt Depth', 0, 20, 0.1, true),
        this.buildSlider('reliefAO', 'Sculpt AO', 0, 3, 0.01, true),
        this.buildSlider('reliefRadius', 'Sculpt Softness', 2, 30, 0.5, true),
        this.buildSelect('reliefPalette', 'Sculpt Palette', ['Living Pigment', 'Ember Bloom', 'Glacier Night', 'Neon Pigment']),
      ] : [])
    ]);

    // Mode-specific sections
    const studio3d = ['Tunnel', 'Kaleido', 'Plasma'].includes(mode) && !!this.config.params.studio3d;
    if (studio3d) {
      html += this.buildStudioSection(mode, true);
      html += this.buildPostSection();
    } else if (mode === 'Tunnel') {
      html += this.buildSection('Tunnel', [
        this.buildSlider('trippySpeed', 'Speed', 0.5, 3, 0.1, true),
        this.buildSlider('tunnelTwist', 'Twist', 0, 3, 0.1, true),
        this.buildSlider('tunnelRings', 'Rings', 4, 16, 1, true),
        this.buildSlider('tunnelFov', 'FOV', 0.5, 2, 0.1, true),
        this.buildSlider('tunnelWarp', 'Warp', 0, 1.5, 0.1, true),
      ]);
      html += this.buildSection('Palette', [
        this.buildSelect('trippyPalette', 'Color Palette', ['Liquid Spectrum', 'Silk Iris', 'Tropical Ink', 'Aurora Fluid', 'Coral Reef', 'Machine Dreams', 'Ember', 'Glacier', 'Neon Bloom', 'Pastel Data']),
      ]);
      html += this.buildPostSection();
      html += this.buildFeedbackSection();
      html += this.buildFeedbackSection();
    } else if (mode === 'Kaleido') {
      html += this.buildSection('Kaleidoscope', [
        this.buildSlider('trippySpeed', 'Speed', 0.5, 3, 0.1, true),
        this.buildSlider('kaleidoSegments', 'Segments', 3, 12, 1, true),
        this.buildSlider('kaleidoZoom', 'Zoom', 0.5, 2, 0.1, true),
        this.buildSlider('kaleidoRotation', 'Rotation', -1, 1, 0.1, true),
        this.buildSlider('kaleidoFeedback', 'Feedback', 0, 1, 0.05, true),
      ]);
      html += this.buildSection('Palette', [
        this.buildSelect('trippyPalette', 'Color Palette', ['Liquid Spectrum', 'Silk Iris', 'Tropical Ink', 'Aurora Fluid', 'Coral Reef', 'Machine Dreams', 'Ember', 'Glacier', 'Neon Bloom', 'Pastel Data']),
      ]);
      html += this.buildPostSection();
      html += this.buildFeedbackSection();
    } else if (mode === 'Plasma') {
      html += this.buildModeControls(mode);
      html += this.buildSection('Plasma', [
        this.buildSlider('trippySpeed', 'Speed', 0.5, 3, 0.1, true),
        this.buildSlider('plasmaScale', 'Scale', 0.5, 3, 0.1, true),
        this.buildSlider('plasmaWarp', 'Warp', 0, 2, 0.1, true),
        this.buildSlider('plasmaFlow', 'Flow', 0, 1.5, 0.1, true),
        this.buildSlider('plasmaContrast', 'Contrast', 0.5, 2, 0.1, true),
      ]);
      html += this.buildSection('Palette', [
        this.buildSelect('trippyPalette', 'Color Palette', ['Liquid Spectrum', 'Silk Iris', 'Tropical Ink', 'Aurora Fluid', 'Coral Reef', 'Machine Dreams', 'Ember', 'Glacier', 'Neon Bloom', 'Pastel Data']),
      ]);
      html += this.buildPostSection();
      html += this.buildFeedbackSection();
    } else if (mode === 'Morph') {
      html += this.buildModeControls(mode);
      html += this.buildSection('Morphing', [
        this.buildSlider('trippySpeed', 'Speed', 0.5, 3, 0.1, true),
        this.buildSlider('morphBlobs', 'Blob Count', 1, 6, 1, true),
        this.buildSlider('morphSmooth', 'Smoothness', 0, 1, 0.05, true),
        this.buildSlider('morphRate', 'Morph Rate', 0, 1, 0.05, true),
        this.buildSlider('morphGlow', 'Glow', 0, 2, 0.1, true),
      ]);
      if (this.config.params.morphSculpt) html += this.buildStudioSection(mode, false);
      html += this.buildSection('Palette', [
        this.buildSelect('trippyPalette', 'Color Palette', ['Liquid Spectrum', 'Silk Iris', 'Tropical Ink', 'Aurora Fluid', 'Coral Reef', 'Machine Dreams', 'Ember', 'Glacier', 'Neon Bloom', 'Pastel Data']),
      ]);
      html += this.buildPostSection();
      html += this.buildFeedbackSection();
    } else if (false && mode === '2D Fractal') { // Removed
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
    } else if (mode === 'Liquid Spheres' || mode === 'Wall Studio') {
      html += this.buildSection('Studio Look', [
        this.buildSelect('stLook', 'Look', STUDIO_LOOK_NAMES),
        this.buildSelect('wMat', 'Material', ['silk', 'clay', 'water', 'glass', 'fur', 'grass']),
        this.buildSlider('detail', 'Detail (1 = smooth)', 1, 5, 1, true),
        this.buildSlider('layers', 'Layers', 1, 5, 1, true),
      ]);
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
    } else if (mode === 'MilkDrop') {
      html += this.buildSection('MilkDrop', [
        this.buildButton('milkdrop-prev', '← Previous', 'action:milkdrop-prev'),
        this.buildButton('milkdrop-next', 'Next →', 'action:milkdrop-next'),
        this.buildButton('milkdrop-random', '🎲 Random', 'action:milkdrop-random'),
        `<div class="preset-name" id="milkdrop-preset-name" style="padding: 8px; font-size: 11px; color: #999; text-align: center; font-family: monospace;"></div>`
      ]);
    } else if (['Fabric', 'Gravity', 'Paint', 'Jungle', 'City Vortex', 'Stargate', 'Paint Pour', 'Bead Knot', 'Mirror Mandala', 'Feather Vortex', 'Crystal Temple'].includes(mode)) {
      html += this.buildModeControls(mode);
      html += this.buildSection('Studio', [
        this.buildSelect('phLook', 'Palette', STUDIO_LOOK_NAMES),
        this.buildSlider('phSpeed', 'Motion Speed', 0, 2, 0.01, true),
        this.buildSlider('phGloss', 'Gloss', 0.2, 2, 0.01, true),
        this.buildSlider('phIrid', 'Iridescence', 0, 1, 0.01, true),
        this.buildSlider('phKeyAz', 'Key Angle', -180, 180, 1, true),
        this.buildSlider('phKeyEl', 'Key Height', 5, 85, 1, true),
        this.buildSlider('phDof', 'Depth of Field', 0, 1, 0.01, true),
      ]);
      html += this.buildPostSection();
    } else if (mode === 'Landscape') {
      html += this.buildModeControls(mode);
      html += this.buildSection('Landscape', [
        this.buildSelect('landLook', 'Look', LAND_LOOK_NAMES),
        this.buildSlider('landSpeed', 'Flight Speed', 0, 2, 0.01, true),
        this.buildSlider('landFov', 'Lens FOV', 30, 90, 1, true),
        this.buildSlider('landSunEl', 'Key Height', 5, 85, 1, true),
        this.buildSlider('landSunAz', 'Key Angle', -180, 180, 1, true),
        this.buildSlider('landAO', 'AO Depth', 0, 4, 0.05, true),
        this.buildSlider('landPigment', 'Pigment', 0, 1.5, 0.01, true),
        this.buildSlider('landFlow', 'Pigment Flow', 0, 4, 0.01, true),
        this.buildSlider('landGrain', 'Pigment Grain', 0, 1, 0.01, true),
        this.buildSlider('landFog', 'Depth Fade', 0, 1.5, 0.01, true),
        this.buildSlider('landBassLift', 'Bass Lift', 0, 4, 0.05, true),
        this.buildCheckbox('landParticles', 'Particles'),
        this.buildSlider('landParticleSize', 'Particle Size', 0.5, 8, 0.05, true),
        this.buildSlider('landParticleGlow', 'Particle Glow', 0.2, 2.5, 0.05, true),
      ]);
      html += this.buildPostSection();
    } else if (mode === '3D Fractal') {
      html += this.buildModeControls(mode);
      html += this.buildPostSection();
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

    // MIDI section (always visible)
    html += this.buildMidiSection();

    // Remote section (always visible)
    html += this.buildRemoteSection();

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

  private buildPostSection(): string {
    return this.buildSection('Post FX', [
      this.buildSlider('exposure', 'Exposure', 0.2, 4, 0.01, true),
      this.buildSelect('tonemapMode', 'Tonemap', ['AgX', 'ACES', 'Khronos Neutral']),
      this.buildSlider('bloomStrength', 'Bloom Strength', 0, 0.5, 0.01, true),
      this.buildSlider('bloomThreshold2', 'Bloom Threshold', 0.2, 2, 0.01, true),
      this.buildSlider('kickBloomAmount', 'Kick→Bloom', 0, 1, 0.05, true),
      this.buildSlider('caStrength', 'Chromatic Aberr.', 0, 0.02, 0.001, true),
      this.buildSlider('distortion', 'Barrel Distortion', -0.3, 0.3, 0.01, true),
      this.buildColorPicker('lift', 'Lift (Shadows)'),
      this.buildColorPicker('gamma', 'Gamma (Midtones)'),
      this.buildColorPicker('gainPost', 'Gain (Highlights)'),
      this.buildSlider('saturationPost', 'Saturation', 0, 2, 0.01, true),
      this.buildSlider('vibrance', 'Vibrance', -0.5, 0.5, 0.01, true),
      this.buildSlider('vignetteStrength', 'Vignette', 0, 1, 0.01, true),
      this.buildSlider('grainStrength', 'Film Grain', 0, 0.15, 0.001, true),
    ]);
  }

  private buildFeedbackSection(): string {
    return this.buildSection('Feedback Layer (Phase 3)', [
      this.buildCheckbox('feedbackEnabled', 'Enable Feedback'),
      this.buildSlider('feedbackMix', 'Mix', 0, 1, 0.01, true),
      this.buildSlider('feedbackDecay', 'Decay', 0.8, 1.0, 0.001, true),
      this.buildSlider('feedbackZoom', 'Zoom', 0.95, 1.05, 0.001, true),
      this.buildSlider('feedbackRotate', 'Rotate', -0.1, 0.1, 0.001, true),
      this.buildSlider('feedbackTranslateX', 'Shift X', -0.05, 0.05, 0.001, true),
      this.buildSlider('feedbackTranslateY', 'Shift Y', -0.05, 0.05, 0.001, true),
      this.buildSlider('feedbackKaleido', 'Kaleido Folds', 0, 12, 1, true),
      this.buildSlider('feedbackNoise', 'Noise Displacement', 0, 0.1, 0.001, true),
      this.buildSlider('feedbackHueDrift', 'Hue Drift', -0.1, 0.1, 0.001, true),
    ]);
  }

  /** Pass 3: shared C4D studio-look controls (Tunnel / Kaleido / Plasma 3D scenes, Morph sculpt). */
  private buildStudioSection(mode: string, scene: boolean): string {
    return this.buildSection(scene ? `Studio 3D · ${mode}` : 'Studio Look', [
      ...(scene ? [this.buildCheckbox('studio3d', '3D studio scene (Blender)')] : []),
      this.buildSelect('stLook', 'Look', STUDIO_LOOK_NAMES),
      this.buildSelect('stMat', 'Material', STUDIO_MATS),
      ...(scene ? [
        this.buildSlider('stSpeed', 'Sculpture Motion', 0, 3, 0.01, true),
        this.buildSlider('stCamSpeed', 'Camera Speed', 0, 3, 0.01, true),
      ] : []),
      this.buildSlider('stDof', 'Depth of Field', 0, 2, 0.01, true),
      this.buildSlider('stFocus', 'Focus Distance (0 = auto)', 0, 20, 0.1, true),
      this.buildSlider('stGloss', 'Gloss', 0.3, 3, 0.01, true),
      this.buildSlider('stIrid', 'Iridescence', 0, 1, 0.01, true),
      this.buildSlider('stRim', 'Rim Light', 0, 1.5, 0.01, true),
      ...(scene ? [
        this.buildSlider('stAO', 'AO Depth', 0, 3, 0.01, true),
        this.buildSlider('stShadowSoft', 'Shadow Softness', 0.5, 8, 0.1, true),
        this.buildSlider('stKeyAz', 'Key Angle', -180, 180, 1, true),
        this.buildSlider('stKeyEl', 'Key Height', 5, 89, 1, true),
        this.buildSlider('stFog', 'Depth Haze', 0, 0.2, 0.001, true),
      ] : []),
    ]);
  }

  /** Pass 6: the mode's own panel (sliders, knobs, selectors bound to live scene parameters) + its presets. */
  private buildModeControls(mode: string): string {
    const spec = MODE_CONTROLS[mode]; if (!spec) return '';
    applyModeDefaults(this.config.params, mode);
    const one = (c: Ctl) => c.type === 'slider' || c.type === 'knob' ? this.buildSlider(c.key, c.label, c.min!, c.max!, c.step ?? 0.01, true)
      : c.type === 'select' ? this.buildSelect(c.key, c.label, c.options!)
      : c.type === 'color' ? this.buildColorPicker(c.key, c.label)
      : this.buildCheckbox(c.key, c.label);
    const names = presetNames(mode);
    const presetHtml = `
      <div class="control mode-presets" data-mode="${mode}">
        <div class="control-row"><label class="control-label">Preset</label>
          <select class="control-select" data-mp-select>${names.map((n) => `<option value="${n}">${n}</option>`).join('')}</select></div>
        <div class="control-row mp-buttons">
          <button class="control-button" data-action="mp:load">Load</button>
          <input class="mp-name" type="text" placeholder="name" maxlength="40" />
          <button class="control-button" data-action="mp:save">Save</button>
          <button class="control-button" data-action="mp:delete" title="Delete a ★ user preset">Delete</button>
        </div>
      </div>`;
    return this.buildSection(`${mode} Presets`, [presetHtml]) + spec.sections.map((sec) => this.buildSection(`${mode} · ${sec.title}`, sec.ctls.map(one))).join('');
  }

  private buildKnob(param: string, label: string, min: number, max: number, step: number): string {
    const value = Number(this.config.params[param] ?? (min + max) / 2);
    const v = Math.max(0, Math.min(1, (value - min) / (max - min || 1)));
    return `
      <div class="control knob-control" data-param="${param}">
        <div class="knob" style="--v:${v.toFixed(3)}" data-knob="${param}" data-min="${min}" data-max="${max}">
          <input type="range" class="knob-input" data-param="${param}" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${label}" />
          <div class="knob-cap"></div>
        </div>
        <label class="knob-label">${label}</label>
        <span class="control-value" data-value="${param}">${value.toFixed(2)}</span>
      </div>`;
  }

  private buildSlider(param: string, label: string, min: number, max: number, step: number, modulatable = false): string {
    const value = this.config.params[param] ?? ((min + max) / 2);
    const beatBtn = modulatable ? `<button class="beat-link-btn" data-param="${param}" title="Link to beat">🔗</button>` : '';
    const shown = typeof value === 'number' ? (Math.abs(value) >= 10 ? value.toFixed(0) : value.toFixed(2)) : value;
    return `
      <div class="control touch-control" data-param="${param}">
        <div class="control-row touch-row">
          <label class="control-label">${label}</label>
          <span class="control-value" data-value="${param}">${shown}</span>
          ${beatBtn}
        </div>
        <input type="range" class="control-slider"
          data-param="${param}" data-default="${value}"
          min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${label}" />
      </div>
    `;
  }

  private buildSelect(param: string, label: string, options: any): string {
    const value = this.config.params[param];
    const opts = Array.isArray(options) ? options : Object.keys(options);
    const valOf = (opt: string) => Array.isArray(options) ? opt : options[opt];
    if (opts.length >= 2 && opts.length <= 5) {
      const segs = opts.map((opt) => {
        const val = valOf(opt);
        const on = value == val ? 'is-on' : '';
        return `<button type="button" class="seg-btn ${on}" data-param="${param}" data-value="${val}">${opt}</button>`;
      }).join('');
      return `
        <div class="control touch-control" data-param="${param}">
          <label class="control-label">${label}</label>
          <div class="seg-row" role="group" aria-label="${label}">${segs}</div>
        </div>`;
    }
    const optionsHtml = opts.map((opt) => {
      const val = valOf(opt);
      return `<option value="${val}" ${value == val ? 'selected' : ''}>${opt}</option>`;
    }).join('');
    return `
      <div class="control touch-control" data-param="${param}">
        <div class="control-row touch-row">
          <label class="control-label">${label}</label>
          <select class="control-select" data-param="${param}" data-default="${value ?? ''}">
            ${optionsHtml}
          </select>
        </div>
      </div>
    `;
  }

  private buildCheckbox(param: string, label: string): string {
    const checked = this.config.params[param] ? 'checked' : '';
    const on = this.config.params[param] ? 'is-on' : '';
    return `
      <div class="control touch-control" data-param="${param}">
        <label class="toggle-row ${on}">
          <span class="control-label">${label}</span>
          <input type="checkbox" data-param="${param}" data-default="${this.config.params[param] ? 1 : 0}" ${checked} />
          <span class="toggle-ui" aria-hidden="true"></span>
        </label>
      </div>
    `;
  }

  private buildButton(action: string, label: string, callback: string): string {
    return `
      <div class="control">
        <button class="control-button" data-action="${callback}" data-midi-action="${callback}">${label}</button>
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

  private buildMidiSection(): string {
    const midi = this.config.midiManager;
    const supported = midi?.state.supported ?? false;
    const enabled = midi?.state.enabled ?? false;
    const devices = midi?.state.devices ?? [];
    const selectedId = midi?.state.selectedDeviceId ?? null;
    
    if (!supported) {
      return `
        <div class="panel-section" data-section="midi">
          <div class="section-header">
            <span class="section-arrow">▼</span>
            <span>MIDI</span>
          </div>
          <div class="section-body">
            <div class="midi-status">Web MIDI not supported</div>
          </div>
        </div>
      `;
    }
    
    return `
      <div class="panel-section" data-section="midi">
        <div class="section-header">
          <span class="section-arrow">▼</span>
          <span>MIDI</span>
        </div>
        <div class="section-body">
          <div class="midi-status" id="midi-status">${enabled ? '✅ Connected' : '❌ Disconnected'}</div>
          ${devices.length > 0 ? `
            <div class="control">
              <label class="control-label">Device</label>
              <select class="control-select" id="midi-device">
                ${devices.map(d => `<option value="${d.id}" ${d.id === selectedId ? 'selected' : ''}>${d.name}</option>`).join('')}
              </select>
            </div>
          ` : '<div class="midi-status">No MIDI devices</div>'}
          <div class="control-hint">Right-click any slider to MIDI Learn</div>
          <div class="control">
            <button class="control-button" data-action="export-midi">⬇ Export MIDI Map</button>
          </div>
          <div class="control">
            <button class="control-button" data-action="import-midi">⬆ Import MIDI Map</button>
          </div>
          <div class="control-hint">Mappings: <span id="midi-mapping-count">${midi?.state.mappings.length ?? 0}</span></div>
        </div>
      </div>
    `;
  }

  private buildRemoteSection(): string {
    const remote = this.config.remoteSync;
    const connected = remote?.state.connected ?? false;
    const remoteUrl = remote?.state.remoteUrl ?? '';
    const qrCode = remote?.state.qrCode ?? '';
    
    return `
      <div class="panel-section" data-section="remote">
        <div class="section-header">
          <span class="section-arrow">▼</span>
          <span>Remote Control</span>
        </div>
        <div class="section-body">
          <div class="midi-status" id="remote-status">${connected ? '✅ Connected' : '⚠️ Relay Offline'}</div>
          <div class="control-hint">Scan QR code with iPhone/iPad</div>
          ${qrCode ? `<div class="qr-code"><img src="${qrCode}" alt="Remote QR Code" /></div>` : ''}
          <div class="control-hint remote-url">${remoteUrl}</div>
          <div class="control-hint">Start relay: <code>bun relay-server.ts</code></div>
        </div>
      </div>
    `;
  }

  private buildColorSection(mode: string): string {
    const groups = colorGroupsFor(mode);
    if (!groups.length) {
      // Legacy / non-lineup modes keep a compact color strip.
      const controls: string[] = [
        this.buildSlider('exposure', 'Exposure', 0.4, 4, 0.01, true),
        this.buildSlider('bloom', 'Bloom', 0, 2, 0.01, true),
        this.buildColorPicker('background', 'Background'),
      ];
      return this.buildSection('Color', controls);
    }
    return groups.map((g) => {
      const palNames = Object.keys(g.palettes);
      const pal = palNames.length
        ? `<div class="control touch-control" data-color-group="${g.id}">
            <label class="control-label">Preset</label>
            <div class="swatch-presets">${palNames.map((n) =>
              `<button type="button" class="swatch-preset" data-color-group="${g.id}" data-palette="${n}" title="${n}">${n}</button>`
            ).join('')}</div>
          </div>`
        : '';
      const body = g.ctls.map((c) => c.type === 'color' ? this.buildColorPicker(c.key, c.label)
        : this.buildSlider(c.key, c.label, c.min ?? 0, c.max ?? 1, c.step ?? 0.01, false)).join('');
      return this.buildSection(`Color · ${g.title}`, [pal, body]);
    }).join('');
  }

  private buildLightingSection(mode: string): string {
    if (colorGroupsFor(mode).some((g) => g.id === 'lighting' || g.id === 'studio')) return '';
    if (mode === 'Tunnel' || mode === 'Kaleido' || mode === 'Plasma' || mode === 'Morph') {
      return '';
    }
    
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
    
    return this.buildSection('Lighting & Studio', controls);
  }

  private buildColorPicker(param: string, label: string): string {
    const value = this.config.params[param] || '#ffffff';
    return `
      <div class="control touch-control color-control" data-param="${param}">
        <label class="color-row">
          <span class="control-label">${label}</span>
          <input type="color" class="control-color" data-param="${param}" data-default="${value}" value="${value}" aria-label="${label}" />
          <span class="color-hex" data-value="${param}">${value}</span>
        </label>
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

    const applyParam = (param: string, value: any, input?: HTMLInputElement | HTMLSelectElement) => {
      this.config.params[param] = value;
      this.updateValueDisplay(param, value);
      this.updateKnob(param, value);
      this.config.remoteSync?.syncState();
    };
    const resetToDefault = (input: HTMLInputElement | HTMLSelectElement) => {
      const param = input.dataset.param!;
      const def = input.dataset.default;
      if (def === undefined) return;
      let value: any = def;
      if (input.type === 'range') value = parseFloat(def);
      else if (input.type === 'checkbox') { value = def === '1' || def === 'true'; (input as HTMLInputElement).checked = value; }
      else input.value = def;
      if (input.type === 'range' || input.type === 'color') input.value = String(value);
      applyParam(param, value, input);
      this.syncDisplayedValues();
    };
    // Double-tap / double-click restores the default. Ignore if the pointer dragged.
    this.container.querySelectorAll('input[data-param], select[data-param]').forEach((el) => {
      const input = el as HTMLInputElement | HTMLSelectElement;
      let lastTap = 0;
      let downX = 0, downY = 0;
      input.addEventListener('pointerdown', (e) => { const ev = e as PointerEvent; downX = ev.clientX; downY = ev.clientY; });
      const maybeReset = (e: Event) => {
        const ev = e as PointerEvent;
        const dx = ev.clientX !== undefined ? ev.clientX - downX : 0;
        const dy = ev.clientY !== undefined ? ev.clientY - downY : 0;
        if (Math.hypot(dx, dy) > 12) { lastTap = 0; return; }
        const now = performance.now();
        if (now - lastTap < 380) { e.preventDefault(); resetToDefault(input); lastTap = 0; }
        else lastTap = now;
      };
      input.addEventListener('dblclick', (e) => { e.preventDefault(); resetToDefault(input); });
      input.addEventListener('pointerup', maybeReset);
    });
    this.container.querySelectorAll('.seg-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const param = (btn as HTMLElement).dataset.param!;
        let value: any = (btn as HTMLElement).dataset.value;
        const num = Number(value);
        value = (value !== '' && !isNaN(num)) ? num : value;
        if (value === 'true') value = true;
        if (value === 'false') value = false;
        applyParam(param, value);
        btn.parentElement?.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('is-on', b === btn));
        if (param === 'mode' && this.config.onModeChange) { this.config.onModeChange(); this.rebuild(); }
      });
    });
    this.container.querySelectorAll('button.swatch-preset').forEach((btn) => {
      btn.addEventListener('click', () => {
        const group = (btn as HTMLElement).dataset.colorGroup as any;
        const name = (btn as HTMLElement).dataset.palette!;
        if (applyGroupPalette(this.config.params, group, name)) {
          this.syncDisplayedValues();
          this.config.remoteSync?.syncState();
          // Update color input values in this group
          this.container.querySelectorAll(`input.control-color`).forEach((el) => {
            const inp = el as HTMLInputElement;
            const v = this.config.params[inp.dataset.param!];
            if (typeof v === 'string') inp.value = v;
          });
        }
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
        this.updateKnob(param, value);
        if (input.type === 'checkbox') input.closest('.toggle-row')?.classList.toggle('is-on', !!value);
        this.config.remoteSync?.syncState();
        if (param === 'hueShift' && (window as any).engine?.buildPalette) {
          (window as any).engine.buildPalette();
        }
        
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

    // MIDI Learn on right-click for range inputs
    this.container.querySelectorAll('input[data-param][type="range"]').forEach(input => {
      input.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const param = (input as HTMLElement).dataset.param!;
        if (this.config.midiManager) {
          this.config.midiManager.startLearning(param);
          // Visual feedback
          input.classList.add('midi-learning');
          setTimeout(() => input.classList.remove('midi-learning'), 5000);
        }
      });
    });

    // MIDI Learn on right-click for action buttons
    this.container.querySelectorAll('button[data-midi-action]').forEach(btn => {
      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const action = (btn as HTMLElement).dataset.midiAction!;
        if (this.config.midiManager) {
          this.config.midiManager.startLearning(action);
          // Visual feedback
          btn.classList.add('midi-learning');
          setTimeout(() => btn.classList.remove('midi-learning'), 5000);
        }
      });
    });

    // MIDI device selection
    const midiDevice = this.container.querySelector('#midi-device') as HTMLSelectElement;
    if (midiDevice && this.config.midiManager) {
      midiDevice.addEventListener('change', () => {
        this.config.midiManager!.selectDevice(midiDevice.value);
      });
    }

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
      } else if (action === 'export-midi' && this.config.onExportMidi) {
        this.config.onExportMidi();
      } else if (action === 'import-midi' && this.config.onImportMidi) {
        this.config.onImportMidi();
      } else if (action?.startsWith('mp:')) {
        this.handleModePreset(action, target);
      } else if (action?.startsWith('action:')) {
        // Handle MIDI-learnable action buttons
        // Trigger the action via global window functions
        const actionName = action.replace('action:', '');
        if (actionName === 'milkdrop-next' && (window as any).__milkDropNext) {
          (window as any).__milkDropNext();
        } else if (actionName === 'milkdrop-prev' && (window as any).__milkDropPrev) {
          (window as any).__milkDropPrev();
        } else if (actionName === 'milkdrop-random' && (window as any).__milkDropRandom) {
          (window as any).__milkDropRandom();
        }
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

  private updateKnob(param: string, value: any): void {
    this.container.querySelectorAll(`.knob[data-knob="${param}"]`).forEach((k) => {
      const el = k as HTMLElement; const mn = Number(el.dataset.min), mx = Number(el.dataset.max);
      el.style.setProperty('--v', String(Math.max(0, Math.min(1, (Number(value) - mn) / (mx - mn || 1)))));
    });
  }

  private handleModePreset(action: string, target: HTMLElement): void {
    const box = target.closest('.mode-presets') as HTMLElement | null; if (!box) return;
    const mode = box.dataset.mode!; const sel = box.querySelector('[data-mp-select]') as HTMLSelectElement;
    const P = this.config.params;
    if (action === 'mp:load') { if (applyModePreset(P, mode, sel.value)) { this.syncDisplayedValues(); P.__modePreset = sel.value; } }
    else if (action === 'mp:save') {
      const nameEl = box.querySelector('.mp-name') as HTMLInputElement; const saved = saveModePreset(P, mode, nameEl.value || `My ${mode} ${new Date().toLocaleTimeString()}`);
      if (saved) { this.rebuild(); const s2 = this.container.querySelector('[data-mp-select]') as HTMLSelectElement | null; if (s2) s2.value = saved; }
    } else if (action === 'mp:delete') { if (deleteModePreset(mode, sel.value)) this.rebuild(); }
  }

  private updateValueDisplay(param: string, value: any): void {
    this.container.querySelectorAll(`[data-value="${param}"]`).forEach((valueEl) => {
      if (typeof value === 'number') {
        const step = Number((this.container.querySelector(`input[data-param="${param}"]`) as HTMLInputElement | null)?.step ?? 0.01);
        valueEl.textContent = step >= 1 ? String(Math.round(value)) : value.toFixed(2);
      } else valueEl.textContent = String(value);
    });
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
        input.closest('.toggle-row')?.classList.toggle('is-on', !!value);
      } else if (input.type === 'color') {
        input.value = String(value);
      } else if (input.type === 'range' || input.tagName === 'SELECT') {
        input.value = String(value);
        if (input.classList.contains('knob-input')) this.updateKnob(param, value);
      }
      this.container.querySelectorAll(`.seg-btn[data-param="${param}"]`).forEach((b) => {
        const ev = (b as HTMLElement).dataset.value;
        b.classList.toggle('is-on', String(value) === String(ev) || value == ev);
      });
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

  rebuild(): void {
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

  refreshRemote(): void {
    const remoteSection = this.container.querySelector('[data-section="remote"]');
    if (remoteSection) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = this.buildRemoteSection();
      const newRemote = tempDiv.firstElementChild;
      if (newRemote) {
        remoteSection.replaceWith(newRemote);
        // Re-attach collapse/expand listener
        const header = newRemote.querySelector('.section-header');
        if (header) {
          header.addEventListener('click', () => {
            const body = newRemote.querySelector('.section-body');
            body?.classList.toggle('collapsed');
          });
        }
      }
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
