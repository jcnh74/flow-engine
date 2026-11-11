// Simplified control definitions for faster integration
// Maps parameters to their UI controls, organized by mode

export interface ControlDef {
  param: string;
  label: string;
  type: 'slider' | 'select' | 'color' | 'checkbox' | 'button';
  min?: number;
  max?: number;
  step?: number;
  options?: any;
  modulatable?: boolean;
  modes?: string[]; // Empty = all modes
  section?: string;
}

// Universal controls (visible in all modes)
export const UNIVERSAL_CONTROLS: ControlDef[] = [
  { param: 'mode', label: 'Render Mode', type: 'select', section: 'Scene',
    options: ['Wall Studio', '3D Fractal', 'Grass Field', '3D fabric', 'Liquid Spheres', 'Particle Fabric', '2D flow'] },
  { param: 'seed', label: 'Seed', type: 'slider', min: 0, max: 999999, step: 1, section: 'Scene' },
  { param: 'paused', label: 'Paused', type: 'checkbox', section: 'Scene' },
  { param: 'exposure', label: 'Exposure', type: 'slider', min: 0.4, max: 4, step: 0.01, modulatable: true, section: 'Color' },
  { param: 'bloom', label: 'Bloom', type: 'slider', min: 0, max: 2, step: 0.01, modulatable: true, section: 'Color' },
  { param: 'hueShift', label: 'Hue Shift', type: 'slider', min: -180, max: 180, step: 1, modulatable: true, section: 'Color' },
];

// Mode-specific controls
export const MODE_CONTROLS: Record<string, ControlDef[]> = {
  '3D Fractal': [
    { param: 'frType', label: 'Type', type: 'select', options: { 'Mandelbulb': 0, 'Mandelbox': 1 }, section: 'Scene' },
    { param: 'frPower', label: 'Power', type: 'slider', min: 2, max: 16, step: 0.1, modulatable: true, section: 'Scene' },
    { param: 'frIter', label: 'Iterations', type: 'slider', min: 4, max: 24, step: 1, modulatable: true, section: 'Scene' },
    { param: 'frBailout', label: 'Bailout', type: 'slider', min: 1, max: 10, step: 0.1, modulatable: true, section: 'Scene' },
    { param: 'frScale', label: 'Scale', type: 'slider', min: -3, max: 3, step: 0.1, modulatable: true, section: 'Scene' },
    { param: 'frCamDist', label: 'Camera Distance', type: 'slider', min: 1, max: 10, step: 0.1, modulatable: true, section: 'Camera' },
    { param: 'frCamFov', label: 'FOV', type: 'slider', min: 30, max: 90, step: 1, modulatable: true, section: 'Camera' },
    { param: 'frRotSpeed', label: 'Rotation', type: 'slider', min: 0, max: 0.5, step: 0.01, modulatable: true, section: 'Camera' },
    { param: 'frLightAz', label: 'Light Azimuth', type: 'slider', min: 0, max: 360, step: 1, modulatable: true, section: 'Lighting' },
    { param: 'frLightEl', label: 'Light Elevation', type: 'slider', min: -90, max: 90, step: 1, modulatable: true, section: 'Lighting' },
    { param: 'frAmbient', label: 'Ambient', type: 'slider', min: 0, max: 1, step: 0.01, modulatable: true, section: 'Lighting' },
    { param: 'frDiffuse', label: 'Diffuse', type: 'slider', min: 0, max: 2, step: 0.1, modulatable: true, section: 'Lighting' },
    { param: 'frGlow', label: 'Glow', type: 'slider', min: 0, max: 2, step: 0.1, modulatable: true, section: 'Lighting' },
    { param: 'frMaxSteps', label: 'Ray Steps', type: 'slider', min: 64, max: 256, step: 1, modulatable: true, section: 'Quality' },
    { param: 'frMaxDist', label: 'Max Distance', type: 'slider', min: 10, max: 50, step: 1, modulatable: true, section: 'Quality' },
  ],
  
  '2D flow': [
    { param: 'particles', label: 'Particles', type: 'select', options: { '65K': 65536, '262K': 262144, '1M': 1048576, '2M': 2097152 }, section: 'Scene' },
    { param: 'noiseScale', label: 'Noise Scale', type: 'slider', min: 0.3, max: 5, step: 0.01, modulatable: true, section: 'Flow' },
    { param: 'evolution', label: 'Evolution', type: 'slider', min: 0, max: 1, step: 0.001, modulatable: true, section: 'Flow' },
    { param: 'curl', label: 'Curl', type: 'slider', min: 0, max: 3, step: 0.01, modulatable: true, section: 'Flow' },
    { param: 'turbulence', label: 'Turbulence', type: 'slider', min: 0, max: 1.5, step: 0.01, modulatable: true, section: 'Flow' },
    { param: 'speed', label: 'Speed', type: 'slider', min: 0, max: 3, step: 0.01, modulatable: true, section: 'Flow' },
    { param: 'life', label: 'Life Rate', type: 'slider', min: 0.03, max: 1, step: 0.01, modulatable: true, section: 'Particles' },
    { param: 'decay', label: 'Trail Decay', type: 'slider', min: 0.85, max: 0.995, step: 0.001, modulatable: true, section: 'Particles' },
    { param: 'pointSize', label: 'Point Size', type: 'slider', min: 0.5, max: 5, step: 0.05, modulatable: true, section: 'Particles' },
    { param: 'gain', label: 'Energy', type: 'slider', min: 0.01, max: 0.3, step: 0.001, modulatable: true, section: 'Particles' },
    { param: 'zoom', label: 'Zoom', type: 'slider', min: 0.6, max: 3, step: 0.01, modulatable: true, section: 'Camera' },
  ],
  
  '3D fabric': [
    { param: 'fold', label: 'Fold', type: 'slider', min: 0, max: 1.5, step: 0.01, modulatable: true, section: 'Shape' },
    { param: 'warp', label: 'Warp', type: 'slider', min: 0, max: 2, step: 0.01, modulatable: true, section: 'Shape' },
    { param: 'layers', label: 'Layers', type: 'slider', min: 1, max: 5, step: 1, section: 'Shape' },
    { param: 'scale3d', label: 'Frequency', type: 'slider', min: 0.2, max: 3, step: 0.01, modulatable: true, section: 'Shape' },
    { param: 'gloss', label: 'Gloss', type: 'slider', min: 4, max: 256, step: 1, modulatable: true, section: 'Material' },
    { param: 'spec', label: 'Specular', type: 'slider', min: 0, max: 3, step: 0.01, modulatable: true, section: 'Material' },
    { param: 'iridescence', label: 'Iridescence', type: 'slider', min: 0, max: 1, step: 0.01, modulatable: true, section: 'Material' },
    { param: 'camDist', label: 'Camera Distance', type: 'slider', min: 1.5, max: 6, step: 0.01, modulatable: true, section: 'Camera' },
    { param: 'fov', label: 'FOV', type: 'slider', min: 20, max: 80, step: 0.1, modulatable: true, section: 'Camera' },
  ],
};

// Section order for UI
export const SECTION_ORDER = ['Scene', 'Shape', 'Flow', 'Particles', 'Material', 'Lighting', 'Camera', 'Quality', 'Color'];

// Helper to get all controls for a mode
export function getControlsForMode(mode: string): ControlDef[] {
  return [
    ...UNIVERSAL_CONTROLS,
    ...(MODE_CONTROLS[mode] || [])
  ];
}

// Helper to group controls by section
export function groupBySection(controls: ControlDef[]): Record<string, ControlDef[]> {
  const groups: Record<string, ControlDef[]> = {};
  for (const control of controls) {
    const section = control.section || 'Other';
    if (!groups[section]) groups[section] = [];
    groups[section].push(control);
  }
  return groups;
}
