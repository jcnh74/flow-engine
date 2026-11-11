// Unified color preset system for house music visualizer aesthetic
export interface ColorPreset {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  gradient: boolean;
  cycle: number; // hue cycle speed
}

export const COLOR_PRESETS: Record<string, ColorPreset> = {
  'Neon Dreams': {
    name: 'Neon Dreams',
    primary: '#00ffff',
    secondary: '#ff00ff',
    accent: '#ffff00',
    background: '#0a0a0f',
    gradient: true,
    cycle: 5,
  },
  'Acid House': {
    name: 'Acid House',
    primary: '#39ff14',
    secondary: '#ff1493',
    accent: '#00ffff',
    background: '#000000',
    gradient: true,
    cycle: 10,
  },
  'Sunset Rave': {
    name: 'Sunset Rave',
    primary: '#ff4500',
    secondary: '#ff6347',
    accent: '#ffd700',
    background: '#1a0a0a',
    gradient: true,
    cycle: 2,
  },
  'Deep Purple': {
    name: 'Deep Purple',
    primary: '#8b00ff',
    secondary: '#4b0082',
    accent: '#ff00ff',
    background: '#050010',
    gradient: true,
    cycle: 3,
  },
  'Monochrome': {
    name: 'Monochrome',
    primary: '#ffffff',
    secondary: '#808080',
    accent: '#c0c0c0',
    background: '#000000',
    gradient: false,
    cycle: 0,
  },
  'Ice Club': {
    name: 'Ice Club',
    primary: '#00d4ff',
    secondary: '#0080ff',
    accent: '#80e0ff',
    background: '#000a10',
    gradient: true,
    cycle: 4,
  },
  'Magma': {
    name: 'Magma',
    primary: '#ff0000',
    secondary: '#ff8c00',
    accent: '#ffff00',
    background: '#1a0000',
    gradient: true,
    cycle: 6,
  },
  'Synthwave': {
    name: 'Synthwave',
    primary: '#ff71ce',
    secondary: '#01cdfe',
    accent: '#05ffa1',
    background: '#0a0a0a',
    gradient: true,
    cycle: 8,
  },
};

// Apply a color preset to the current mode's parameters
export function applyColorPreset(preset: ColorPreset, params: any, mode: string): void {
  const { primary, secondary, accent, background, cycle, gradient } = preset;
  
  // Universal
  params.exposure = 1.0;
  params.bloom = 0.5;
  
  // Parse hex to RGB for modes that need it
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : [255, 255, 255];
  };
  
  // Mode-specific color mapping
  if (mode === '3D Fractal') {
    params.frColor1 = primary;
    params.frColor2 = secondary;
    params.frAmbient = 0.3;
    params.frGlow = cycle > 0 ? 0.8 : 0.5;
  } else if (mode === '2D flow') {
    params.hueShift = 0;
    params.colorBySpeed = 0.7;
    params.background = background;
  } else if (mode === 'Grass Field') {
    params.gBase = primary;
    params.gTip = secondary;
    params.gDryC = accent;
    params.gSoil = background;
  } else if (mode === 'Wall Studio' || mode === 'Liquid Spheres') {
    params.lsFloorCol = background;
    params.background = background;
    // Cycle colors would map to palette in production
  } else {
    // 3D fabric, Particle Fabric - use palette system
    params.hueShift = 0;
    params.saturation = 1.2;
    params.brightness = 1.0;
    params.background = background;
  }
  
  // Color cycling
  params.cHueCycle = cycle;

  // Build actual engine stops from the preset swatches and push them
  // through the live palette hook. Previously this function never touched
  // `stops` / palTex / trippy uPalette, so the UI "Preset" dropdown was cosmetic.
  const newStops: [number, string][] = gradient
    ? [[0, primary], [0.5, secondary], [1, accent]]
    : [[0, primary], [0.5, secondary], [1, primary]];
  params.background = background;
  if (mode === 'Wall Studio') {
    params.wColor = primary;
  }
  const engine = (typeof window !== 'undefined') ? (window as any).engine : null;
  if (engine?.setStops) engine.setStops(newStops);
  if (engine?.P) engine.P.palette = preset.name;
}
