// Curated preset gallery for DJ visualizer

export interface Preset {
  name: string;
  mode: string;
  params: any;
  description?: string;
  beatLinks?: Array<{
    source: string;
    target: string;
    depth: number;
  }>;
}

export const PRESET_GALLERY: Preset[] = [
  {
    name: 'Neon Tunnel',
    mode: 'Tunnel',
    description: 'High-speed tunnel with neon colors',
    params: {
      trippySpeed: 1.5,
      stops: [[0, '#ff00ff'], [0.5, '#00ffff'], [1, '#ff00ff']]
    },
    beatLinks: [
      { source: 'kick', target: 'trippySpeed', depth: 0.5 },
      { source: 'beat', target: 'bloom', depth: 1.0 }
    ]
  },
  {
    name: 'Acid Kaleido',
    mode: 'Kaleido',
    description: 'Psychedelic kaleidoscope',
    params: {
      trippySpeed: 1.0,
      stops: [[0, '#ffff00'], [0.33, '#ff00ff'], [0.66, '#00ff00'], [1, '#ffff00']]
    }
  },
  {
    name: 'Neon Chrome Wall',
    mode: 'Wall Studio',
    description: 'Metallic chrome spheres with neon glow',
    params: {
      wMat: 'glossy',
      wColor: '#d0d0d8',
      gloss: 1.0,
      spec: 1.5,
      iridescence: 0.9,
      envIntensity: 2.0,
      bloom: 0.8,
      exposure: 1.4,
      wcDist: 4.0,
      wcAuto: true,
      stops: [[0, '#00ffff'], [0.5, '#ff00ff'], [1, '#ffff00']]
    },
    beatLinks: [
      { source: 'kick', target: 'spec', depth: 0.5 },
      { source: 'beat', target: 'bloom', depth: 1.0 },
      { source: 'bass', target: 'iridescence', depth: 0.3 }
    ]
  },
  {
    name: 'Sunset Liquid',
    mode: 'Plasma',
    description: 'Warm flowing plasma',
    params: {
      trippySpeed: 0.8,
      stops: [[0, '#ff6600'], [0.5, '#ff0066'], [1, '#ffcc00']]
    }
  },
  {
    name: 'Morphing Blobs',
    mode: 'Morph',
    description: 'Organic morphing shapes',
    params: {
      trippySpeed: 1.2,
      stops: [[0, '#00ffcc'], [0.5, '#0066ff'], [1, '#cc00ff']]
    }
  },
  {
    name: 'Deep Ocean Wall',
    mode: 'Wall Studio',
    description: 'Underwater depths with flowing fabric',
    params: {
      wMat: 'silk',
      wColor: '#0a2040',
      wFurLen: 0.12,
      wWind: 0.4,
      wComb: 0.3,
      gloss: 0.6,
      spec: 0.4,
      iridescence: 0.2,
      envIntensity: 0.6,
      bloom: 0.2,
      exposure: 0.7,
      wcDist: 6.0,
      wcPitch: -15,
      stops: [[0, '#001122'], [0.4, '#003366'], [0.7, '#0066aa'], [1, '#0099cc']]
    },
    beatLinks: [
      { source: 'bass', target: 'wWind', depth: 0.3 },
      { source: 'beat', target: 'exposure', depth: 0.2 }
    ]
  },
  {
    name: 'Fractal Dreams',
    mode: '3D Fractal',
    description: 'Mandelbulb with audio-driven morph',
    params: {
      frType: 0,
      frPower: 8,
      frIter: 12,
      frRotSpeed: 0.4, // Increased for visible motion
      frMorph: 0.5, // Enable morph
      frCamOrbit: true, // Enable camera orbit
      frCamOrbitSpeed: 0.3,
      stops: [[0, '#0033ff'], [0.5, '#ff00ff'], [1, '#ffff00']]
    }
  },
  {
    name: 'Electric Tunnel',
    mode: 'Tunnel',
    description: 'Fast electric tunnel',
    params: {
      trippySpeed: 2.0,
      stops: [[0, '#0099ff'], [0.5, '#ffffff'], [1, '#0099ff']]
    }
  },
  {
    name: 'Rainbow Kaleido',
    mode: 'Kaleido',
    description: 'Full spectrum kaleidoscope',
    params: {
      trippySpeed: 1.0,
      stops: [[0, '#ff0000'], [0.2, '#ffff00'], [0.4, '#00ff00'], [0.6, '#00ffff'], [0.8, '#0000ff'], [1, '#ff00ff']]
    }
  },
  {
    name: 'Techno Liquid',
    mode: 'Plasma',
    description: 'Dark techno plasma',
    params: {
      trippySpeed: 1.5,
      stops: [[0, '#000033'], [0.5, '#3300ff'], [1, '#00ffff']]
    }
  },
  {
    name: 'Organic Morph',
    mode: 'Morph',
    description: 'Slow organic movement',
    params: {
      trippySpeed: 0.6,
      stops: [[0, '#003300'], [0.5, '#00ff66'], [1, '#66ff00']]
    }
  },
  {
    name: 'Monochrome Strobe',
    mode: 'Wall Studio',
    description: 'High-contrast black and white strobe',
    params: {
      wMat: 'plastic',
      wColor: '#ffffff',
      gloss: 0.9,
      spec: 1.2,
      iridescence: 0.0,
      saturation: 0.0,
      brightness: 1.2,
      envIntensity: 1.5,
      bloom: 0.1,
      exposure: 1.8,
      wcDist: 3.5,
      wcAuto: true,
      stops: [[0, '#000000'], [0.5, '#ffffff'], [1, '#000000']]
    },
    beatLinks: [
      { source: 'kick', target: 'exposure', depth: 1.5 },
      { source: 'beat', target: 'brightness', depth: 0.8 }
    ]
  },
  {
    name: 'Hyperdrive',
    mode: 'Tunnel',
    description: 'Maximum speed tunnel',
    params: {
      trippySpeed: 3.0,
      stops: [[0, '#ffffff'], [0.5, '#00ffff'], [1, '#0000ff']]
    }
  },
  {
    name: 'Mandel Vortex',
    mode: '3D Fractal',
    description: 'Audio-driven rotating Mandelbulb',
    params: {
      frType: 0,
      frPower: 12,
      frIter: 15,
      frRotSpeed: 0.5, // Increased for visible rotation
      frJuliaOrbit: true, // Enable Julia orbit
      frJuliaSpeed: 0.4,
      frCamOrbit: true, // Enable camera orbit
      frCamOrbitSpeed: 0.2,
      stops: [[0, '#ff0000'], [0.5, '#ffff00'], [1, '#ff0000']]
    }
  },
  {
    name: 'Box Matrix',
    mode: '3D Fractal',
    description: 'Mandelbox structure',
    params: {
      frType: 1,
      frScale: -1.8,
      frIter: 12,
      frRotSpeed: 0.15,
      stops: [[0, '#00ff00'], [0.5, '#00ffff'], [1, '#00ff00']]
    }
  },
  {
    name: 'Menger Cube',
    mode: '3D Fractal',
    description: 'Classic Menger sponge',
    params: {
      frType: 2,
      frIter: 5,
      frRotSpeed: 0.2,
      stops: [[0, '#ff6600'], [0.5, '#ffff00'], [1, '#ff6600']]
    }
  },
  {
    name: 'Purple Haze',
    mode: 'Plasma',
    description: 'Dreamy purple flow',
    params: {
      trippySpeed: 0.7,
      stops: [[0, '#330066'], [0.5, '#9900ff'], [1, '#ff00ff']]
    }
  },
  {
    name: 'Mirror Dance',
    mode: 'Kaleido',
    description: 'Dancing mirrors',
    params: {
      trippySpeed: 1.3,
      stops: [[0, '#ff0099'], [0.5, '#ffff00'], [1, '#00ffcc']]
    }
  },
  {
    name: 'Lava Morph',
    mode: 'Morph',
    description: 'Hot lava blobs',
    params: {
      trippySpeed: 0.9,
      stops: [[0, '#660000'], [0.5, '#ff3300'], [1, '#ffff00']]
    }
  },
  {
    name: 'Sunset Gold Wall',
    mode: 'Wall Studio',
    description: 'Warm golden sunset glow',
    params: {
      wMat: 'velvet',
      wColor: '#d4a574',
      wFurLen: 0.08,
      wFurDens: 800,
      gloss: 0.3,
      spec: 0.2,
      iridescence: 0.1,
      rim: 1.2,
      envIntensity: 1.2,
      bloom: 0.5,
      exposure: 1.1,
      wcDist: 5.0,
      wcPitch: 10,
      stops: [[0, '#ff6600'], [0.3, '#ff9933'], [0.6, '#ffcc66'], [1, '#ffffaa']]
    },
    beatLinks: [
      { source: 'bass', target: 'rim', depth: 0.4 },
      { source: 'beat', target: 'bloom', depth: 0.6 }
    ]
  },
  {
    name: 'Acid Rainbow Wall',
    mode: 'Wall Studio',
    description: 'Wild psychedelic rainbow colors',
    params: {
      wMat: 'glossy',
      wColor: '#ff00ff',
      wPatch: true,
      gloss: 1.2,
      spec: 0.9,
      iridescence: 1.5,
      saturation: 2.0,
      brightness: 1.3,
      envIntensity: 1.0,
      bloom: 0.7,
      exposure: 1.2,
      wcDist: 4.5,
      wcAuto: true,
      hueShift: 0.5,
      cHueCycle: 0.3,
      stops: [[0, '#ff0000'], [0.2, '#ff7700'], [0.4, '#ffff00'], [0.6, '#00ff00'], [0.8, '#0077ff'], [1, '#ff00ff']]
    },
    beatLinks: [
      { source: 'bass', target: 'hueShift', depth: 0.5 },
      { source: 'beat', target: 'saturation', depth: 0.8 },
      { source: 'kick', target: 'iridescence', depth: 0.4 }
    ]
  },
  {
    name: 'Void Tunnel',
    mode: 'Tunnel',
    description: 'Dark infinite void',
    params: {
      trippySpeed: 1.0,
      stops: [[0, '#000000'], [0.5, '#330066'], [1, '#660099']]
    }
  },
  
  // Phase 3: MilkDrop-style feedback presets
  {
    name: 'Feedback: Spiral Dreams',
    mode: 'Tunnel',
    description: 'Classic spiral feedback with rotation (homage to Rovastar)',
    params: {
      trippySpeed: 0.8,
      feedbackEnabled: true,
      feedbackMix: 0.7,
      feedbackDecay: 0.98,
      feedbackZoom: 0.995,
      feedbackRotate: 0.02,
      feedbackHueDrift: 0.01,
      exposure: 1.2,
      stops: [[0, '#ff0080'], [0.5, '#8000ff'], [1, '#00ffff']]
    }
  },
  {
    name: 'Feedback: Kaleidoscope Echo',
    mode: 'Kaleido',
    description: 'Kaleidoscopic feedback trails (homage to Geiss)',
    params: {
      trippySpeed: 1.0,
      feedbackEnabled: true,
      feedbackMix: 0.6,
      feedbackDecay: 0.96,
      feedbackZoom: 1.002,
      feedbackKaleido: 6,
      feedbackNoise: 0.02,
      exposure: 1.3,
      stops: [[0, '#ffff00'], [0.33, '#ff00ff'], [0.66, '#00ffff'], [1, '#ffff00']]
    }
  },
  {
    name: 'Feedback: Plasma Warp',
    mode: 'Plasma',
    description: 'Noise-displaced feedback (homage to Flexi)',
    params: {
      trippySpeed: 1.2,
      feedbackEnabled: true,
      feedbackMix: 0.8,
      feedbackDecay: 0.97,
      feedbackZoom: 0.998,
      feedbackNoise: 0.04,
      feedbackHueDrift: 0.005,
      exposure: 1.1,
      stops: [[0, '#ff4400'], [0.5, '#ff00ff'], [1, '#4400ff']]
    }
  },
  {
    name: 'Feedback: Fractal Echo',
    mode: '3D Fractal',
    description: 'Deep fractal feedback trails (homage to Mstress)',
    params: {
      frType: 0,
      frPower: 8,
      frRotSpeed: 0.3,
      feedbackEnabled: true,
      feedbackMix: 0.65,
      feedbackDecay: 0.985,
      feedbackZoom: 1.001,
      feedbackRotate: 0.01,
      feedbackKaleido: 4,
      exposure: 1.0,
      stops: [[0, '#0033ff'], [0.5, '#ff00aa'], [1, '#ffaa00']]
    }
  }
];

// Random preset selection
export function getRandomPreset(): Preset {
  return PRESET_GALLERY[Math.floor(Math.random() * PRESET_GALLERY.length)];
}

// Get presets for a specific mode
export function getPresetsForMode(mode: string): Preset[] {
  return PRESET_GALLERY.filter(p => p.mode === mode);
}
