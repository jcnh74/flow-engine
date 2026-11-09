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
    name: 'Deep House Wall',
    mode: 'Wall Studio',
    description: 'Elegant spheres for deep house',
    params: {
      lsCount: 65536,
      fold: 0.55,
      warp: 0.7,
      iridescence: 0.4,
      stops: [[0, '#1a0033'], [0.5, '#6600cc'], [1, '#cc00ff']]
    },
    beatLinks: [
      { source: 'bass', target: 'warp', depth: 0.3 },
      { source: 'beat', target: 'bloom', depth: 0.8 },
      { source: 'kick', target: 'lsFlowU', depth: 0.2 }
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
    name: 'Cyberpunk Wall',
    mode: 'Wall Studio',
    description: 'High-tech urban vibes',
    params: {
      lsCount: 65536,
      fold: 0.45,
      warp: 0.6,
      iridescence: 0.5,
      stops: [[0, '#ff0080'], [0.5, '#00ffff'], [1, '#8000ff']]
    }
  },
  {
    name: 'Fractal Dreams',
    mode: '3D Fractal',
    description: 'Mandelbulb with slow morph',
    params: {
      frType: 0,
      frPower: 8,
      frIter: 12,
      frRotSpeed: 0.2,
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
    name: 'Minimal Wall',
    mode: 'Wall Studio',
    description: 'Clean minimal aesthetic',
    params: {
      lsCount: 32768,
      fold: 0.3,
      warp: 0.4,
      iridescence: 0.2,
      stops: [[0, '#ffffff'], [1, '#cccccc']]
    }
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
    description: 'Rotating Mandelbulb',
    params: {
      frType: 0,
      frPower: 12,
      frIter: 15,
      frRotSpeed: 0.3,
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
    name: 'Crystal Wall',
    mode: 'Wall Studio',
    description: 'Crystalline structures',
    params: {
      lsCount: 65536,
      fold: 0.6,
      warp: 0.5,
      iridescence: 0.6,
      stops: [[0, '#00ccff'], [0.5, '#ffffff'], [1, '#ff00cc']]
    }
  },
  {
    name: 'Void Tunnel',
    mode: 'Tunnel',
    description: 'Dark infinite void',
    params: {
      trippySpeed: 1.0,
      stops: [[0, '#000000'], [0.5, '#330066'], [1, '#660099']]
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
