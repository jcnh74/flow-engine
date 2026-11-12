// Curated preset gallery for DJ visualizer
import { STUDIO_LOOKS } from './studio';

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

// ---- Pass 3: C4D studio-abstract presets (2-3 per mode). Audio reactivity off; beat links empty.
const STUDIO_POST = {
  tonemapMode: 'Khronos Neutral', exposure: 1.0, bloom: 0.1, bloomStrength: 0.03, bloomThreshold2: 1.8, kickBloomAmount: 0,
  caStrength: 0, distortion: 0, saturation: 1.0, saturationPost: 1.0, vibrance: 0, vignetteStrength: 0.12, grainStrength: 0.008,
  feedbackEnabled: false, hueShift: 0, cHueCycle: 0, audioReactive: false,
};
const lookStops = (look: string) => STUDIO_LOOKS[look].slots.slice(0, 6).map((c, i) => [i / 5, c]);
function studioPreset(name: string, mode: string, look: string, description: string, extra: Record<string, any> = {}): Preset {
  return { name, mode, description, params: { ...STUDIO_POST, studio3d: true, stLook: look, stMat: 'Scene', stSpeed: 1, stCamSpeed: 1,
    stDof: 0.5, stFocus: 0, stAO: 1, stGloss: 1, stIrid: 0.8, stRim: 0.35, stShadowSoft: 3, stFog: 0, stKeyAz: -40, stKeyEl: 55,
    stops: lookStops(look), ...extra }, beatLinks: [] };
}
const WALL_STUDIO = { lightPreset: 'C4D Studio Softbox', wMat: 'silk', wPatch: true, wObj: false, ao: 1.0, ssaoRadius: 0.6, iridescence: 0.25,
  fold: 0.34, warp: 0.32, scale3d: 0.42, detail: 1, layers: 2, wallPaletteMix: 1.0, wcAuto: true, wcDist: 4.2, cycOn: true };
export const STUDIO_PRESETS: Preset[] = [
  studioPreset('Tunnel · Mint Ribbon', 'Tunnel', 'Mint Pink', 'Flight through pearl and mint torus rings, glossy double helix', { stFog: 0.03, stDof: 0.35, stKeyEl: 70, stKeyAz: -30 }),
  studioPreset('Tunnel · Cobalt Rush', 'Tunnel', 'Cobalt Orange', 'Cobalt cove, orange and sky rings, faster flight', { stFog: 0.04, stDof: 0.3, stKeyEl: 70, stKeyAz: -30, stCamSpeed: 1.5 }),
  studioPreset('Tunnel · Lilac Drift', 'Tunnel', 'Lilac Dream', 'Slow iridescent drift in lilac', { stFog: 0.03, stDof: 0.45, stKeyEl: 70, stMat: 'Iridescent', stCamSpeed: 0.7 }),
  studioPreset('Kaleido · Coral Bloom', 'Kaleido', 'Coral Peach', 'Mirrored petal sculpture on a peach cove, counter-rotating rings', { stDof: 0.55 }),
  studioPreset('Kaleido · Cream Gold', 'Kaleido', 'Cream Gold', 'Cream and gold still-life sculpture, satin metal', { stDof: 0.55, stMat: 'Satin metal', stKeyAz: -60, stKeyEl: 40 }),
  studioPreset('Kaleido · Mint Pearl', 'Kaleido', 'Mint Pink', 'Iridescent pearl sculpture in mint and pink', { stDof: 0.6, stMat: 'Iridescent' }),
  studioPreset('Plasma · Red Rope', 'Plasma', 'Red Studio', 'Twisted rope torus in teal, bordeaux and cream on a red cove', { stDof: 0.5, stKeyAz: -45 }),
  studioPreset('Plasma · Cobalt Twist', 'Plasma', 'Cobalt Orange', 'Orange and cobalt twisted torus, glossy', { stDof: 0.5, stMat: 'Gloss', stKeyAz: -45 }),
  studioPreset('Plasma · Lilac Twist', 'Plasma', 'Lilac Dream', 'Pastel twisted torus with iridescent strands', { stDof: 0.5, stMat: 'Iridescent', stKeyAz: -45 }),
  studioPreset('Morph · Lilac Gloss', 'Morph', 'Lilac Dream', 'Glossy pastel metaballs on a lilac cove', { morphSculpt: true, stMat: 'Gloss', stDof: 0.45 }),
  studioPreset('Morph · Coral Pearl', 'Morph', 'Coral Peach', 'Iridescent pearl blobs on a peach cove', { morphSculpt: true, stMat: 'Iridescent', stDof: 0.45 }),
  studioPreset('Morph · Cobalt Satin', 'Morph', 'Cobalt Orange', 'Satin-metal blobs on a cobalt cove', { morphSculpt: true, stMat: 'Satin metal', stDof: 0.45 }),
  studioPreset('Fractal · Lilac Bulb', '3D Fractal', 'Lilac Dream', 'Mandelbulb in a lilac studio cove', { frStudio: true, frType: 0, frPower: 8, frIter: 10, frCamDist: 2.5, frRes: 0.45, frMaxSteps: 80, frAmbient: 0.42, frGlow: 0, frFogDensity: 0.04, frRotSpeed: 0.15, stMat: 'Gloss' }),
  studioPreset('Fractal · Coral Bulb', '3D Fractal', 'Coral Peach', 'Soft power-5 Mandelbulb in a peach studio cove', { frStudio: true, frType: 0, frPower: 5, frIter: 10, frCamDist: 2.6, frRes: 0.45, frMaxSteps: 80, frAmbient: 0.42, frGlow: 0, frFogDensity: 0.04, frRotSpeed: 0.12, stMat: 'Gloss' }),
  studioPreset('Wall · Coral Silk', 'Wall Studio', 'Coral Peach', 'Smooth sculpted satin sheets in coral, lilac and mint', { ...WALL_STUDIO, saturation: 1.6, iridescence: 0.08 }),
  studioPreset('Wall · Cobalt Clay', 'Wall Studio', 'Cobalt Orange', 'Smooth matte clay sheets, cobalt and orange', { ...WALL_STUDIO, wMat: 'clay', layers: 1, saturation: 1.8, brightness: 0.8 }),
  studioPreset('Landscape · Pastel Canyon', 'Landscape', 'Coral Peach', 'The Blender canyon in a pastel studio: peach cove, coral/lilac/mint pigment', { landLook: 'Studio Pastel', landSpeed: 1, landFov: 50, landSunEl: 45, landSunAz: -40, landAO: 1.6, landPigment: 1.0, landFlow: 0.8, landGrain: 0.04, landFog: 0.6, landParticles: false, vignetteStrength: 0.1 }),
  studioPreset('Landscape · Cobalt Dunes', 'Landscape', 'Cobalt Orange', 'The canyon in a cobalt studio with orange pigment', { landLook: 'Studio Cobalt', landSpeed: 1, landFov: 50, landSunEl: 45, landSunAz: -40, landAO: 1.6, landPigment: 1.0, landFlow: 0.8, landGrain: 0.04, landFog: 0.6, landParticles: false, vignetteStrength: 0.1 }),
];

/** Every preset ever authored (retired modes included, so their code paths stay reachable from code/tests). */
export const ALL_PRESETS: Preset[] = [
  {
    name: 'Living Pigment',
    mode: 'Landscape',
    description: 'Sculpted pigment relief, C4D-style AO studio light, aqua / gold / cream paint',
    params: {
      landLook: 'Living Pigment',
      landSpeed: 1.0,
      landFov: 50,
      landSunEl: 38,
      landSunAz: -40,
      landAO: 1.7,
      landPigment: 1.0,
      landFlow: 1.0,
      landGrain: 0.25,
      landFog: 0.5,
      landParticles: false,
      exposure: 0.85,
      bloom: 0.2,
      bloomStrength: 0.06,
      bloomThreshold2: 1.6,
      kickBloomAmount: 0,
      saturation: 1.0,
      saturationPost: 1.0,
      vibrance: 0.0,
      vignetteStrength: 0.25,
      grainStrength: 0.015,
      caStrength: 0,
      distortion: 0,
      feedbackEnabled: false,
      hueShift: 0,
      palette: 'Living Pigment',
      tonemapMode: 'ACES',
      audioReactive: false,
      stops: [[0, '#0f3a48'], [0.22, '#1d8ea6'], [0.45, '#4cc3d2'], [0.66, '#e4eeec'], [0.84, '#d89a4c'], [1, '#8e4e2a']],
    },
    beatLinks: []
  },
  {
    name: 'Ember Canyon',
    mode: 'Landscape',
    description: 'Folded ember relief: coral, saffron and charcoal under a warm softbox',
    params: {
      landLook: 'Ember Bloom',
      landSpeed: 1.0,
      landFov: 50,
      landSunEl: 30,
      landSunAz: -55,
      landAO: 1.8,
      landPigment: 1.0,
      landFlow: 1.0,
      landGrain: 0.25,
      landFog: 0.5,
      landParticles: false,
      exposure: 0.85,
      bloom: 0.2,
      bloomStrength: 0.06,
      bloomThreshold2: 1.6,
      kickBloomAmount: 0,
      saturation: 1.0,
      saturationPost: 1.0,
      vibrance: 0.0,
      vignetteStrength: 0.25,
      grainStrength: 0.015,
      caStrength: 0,
      distortion: 0,
      feedbackEnabled: false,
      hueShift: 0,
      palette: 'Ember Bloom',
      tonemapMode: 'ACES',
      audioReactive: false,
      stops: [[0, '#1e1d24'], [0.25, '#4a4b58'], [0.45, '#6f7284'], [0.62, '#d8586a'], [0.8, '#f2a83a'], [1, '#ffe3a8']],
    },
    beatLinks: []
  },
  {
    name: 'Glacier Night',
    mode: 'Landscape',
    description: 'Moonlit glacier relief: deep blue folds, ice-white crests, cool rim',
    params: {
      landLook: 'Glacier Night',
      landSpeed: 1.0,
      landFov: 50,
      landSunEl: 26,
      landSunAz: 35,
      landAO: 1.9,
      landPigment: 1.0,
      landFlow: 1.0,
      landGrain: 0.25,
      landFog: 0.5,
      landParticles: false,
      exposure: 0.85,
      bloom: 0.2,
      bloomStrength: 0.06,
      bloomThreshold2: 1.6,
      kickBloomAmount: 0,
      saturation: 1.1,
      saturationPost: 1.0,
      vibrance: 0.0,
      vignetteStrength: 0.25,
      grainStrength: 0.015,
      caStrength: 0,
      distortion: 0,
      feedbackEnabled: false,
      hueShift: 0,
      palette: 'Glacier Night',
      tonemapMode: 'ACES',
      audioReactive: false,
      stops: [[0, '#0a1428'], [0.25, '#1f3f74'], [0.45, '#4f7fc0'], [0.65, '#8cc4e4'], [0.85, '#e2f0f6'], [1, '#fbf4e8']],
    },
    beatLinks: []
  },
  {
    name: 'Neon Pigment',
    mode: 'Landscape',
    description: 'Violet / magenta / cyan pigment sculpture with a magenta rim',
    params: {
      landLook: 'Neon Pigment',
      landSpeed: 1.0,
      landFov: 50,
      landSunEl: 42,
      landSunAz: -25,
      landAO: 1.7,
      landPigment: 1.0,
      landFlow: 1.0,
      landGrain: 0.25,
      landFog: 0.5,
      landParticles: false,
      exposure: 0.85,
      bloom: 0.2,
      bloomStrength: 0.06,
      bloomThreshold2: 1.6,
      kickBloomAmount: 0,
      saturation: 1.2,
      saturationPost: 1.0,
      vibrance: 0.0,
      vignetteStrength: 0.25,
      grainStrength: 0.015,
      caStrength: 0,
      distortion: 0,
      feedbackEnabled: false,
      hueShift: 0,
      palette: 'Neon Pigment',
      tonemapMode: 'ACES',
      audioReactive: false,
      stops: [[0, '#1a1030'], [0.25, '#3d2a78'], [0.45, '#7a5cc8'], [0.62, '#e04a9c'], [0.8, '#3cc8d8'], [1, '#f5efff']],
    },
    beatLinks: []
  },
  ...STUDIO_PRESETS,
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
  
  // Phase 3: MilkDrop-style feedback presets (tuned for std > 10, MAD > 0.5)
  // Lighten blend + sparse emissive layer + bloom accent
  {
    name: 'Feedback: Spiral Dreams',
    mode: 'Tunnel',
    description: 'Classic spiral feedback with rotation (homage to Rovastar)',
    params: {
      trippySpeed: 1.3,
      feedbackEnabled: true,
      feedbackMix: 0.88,        // Strong echo presence with lighten blend
      feedbackDecay: 0.97,      // Slower decay maintains trails longer
      feedbackZoom: 0.985,      // More zoom out for energy
      feedbackRotate: 0.045,    // Stronger rotation for spiral effect
      feedbackHueDrift: 0.02,   // More color shift
      exposure: 1.0,            // Lower to preserve black regions (was 1.8)
      bloomStrength: 0.12,      // Reduced bloom (accent, not wash)
      bloomThreshold2: 1.8,     // Higher threshold for sparse bloom
      stops: [[0, '#ff0080'], [0.5, '#8000ff'], [1, '#00ffff']]
    }
  },
  {
    name: 'Feedback: Kaleidoscope Echo',
    mode: 'Kaleido',
    description: 'Kaleidoscopic feedback trails (homage to Geiss)',
    params: {
      trippySpeed: 1.4,
      feedbackEnabled: true,
      feedbackMix: 0.90,        // Higher mix like Spiral
      feedbackDecay: 0.97,      // Match Spiral's decay
      feedbackZoom: 1.01,       // Moderate zoom in
      feedbackKaleido: 8,       // More folds for structure
      feedbackNoise: 0.02,      // Minimal noise
      feedbackRotate: 0.035,    // Match Spiral's rotation
      exposure: 1.8,            // Restored from 1.0 to bring luma back to ~6 (was 1.5 in r25, MAD < 1.0)
      bloomStrength: 0.12,      // Match Spiral
      bloomThreshold2: 1.8,     // Match Spiral
      stops: [[0, '#ffff00'], [0.33, '#ff00ff'], [0.66, '#00ffff'], [1, '#ffff00']]
    }
  },
  {
    name: 'Feedback: Plasma Warp',
    mode: 'Plasma',
    description: 'Noise-displaced feedback (homage to Flexi)',
    params: {
      trippySpeed: 1.5,
      feedbackEnabled: true,
      feedbackMix: 0.88,        // Match Spiral
      feedbackDecay: 0.97,      // Higher decay prevents decay to 0
      feedbackZoom: 0.985,      // Match Spiral's zoom
      feedbackNoise: 0.045,     // Moderate noise
      feedbackHueDrift: 0.02,   // Match Spiral
      feedbackRotate: 0.04,     // Slightly more rotation
      exposure: 1.0,            // Lower to create dark regions (was 1.8)
      bloomStrength: 0.12,      // Match Spiral
      bloomThreshold2: 1.8,     // Match Spiral
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
      frRotSpeed: 0.6,          // Fast rotation for dynamics
      frCamOrbit: true,
      feedbackEnabled: true,
      feedbackMix: 0.92,        // Increased from 0.88 to raise luma from ~18 toward ~38
      feedbackDecay: 0.97,      // Match Spiral
      feedbackZoom: 0.985,      // Match Spiral (zoom out, not in)
      feedbackRotate: 0.045,    // Match Spiral
      feedbackKaleido: 0,       // No kaleido (preserve fractal structure)
      feedbackNoise: 0.01,      // Minimal noise
      exposure: 2.1,            // Increased from 1.8 to boost luma (target ~38 vs measured 18)
      bloomStrength: 0.12,      // Match Spiral
      bloomThreshold2: 1.8,     // Match Spiral
      stops: [[0, '#0033ff'], [0.5, '#ff00aa'], [1, '#ffaa00']]
    }
  }
];

/** Pass 5: Tunnel and Kaleido are retired from the UI (code kept). */
export const RETIRED_MODES = ['Tunnel', 'Kaleido'];
export const PRESET_GALLERY: Preset[] = ALL_PRESETS.filter((p) => !RETIRED_MODES.includes(p.mode));

// Random preset selection
export function getRandomPreset(): Preset {
  return PRESET_GALLERY[Math.floor(Math.random() * PRESET_GALLERY.length)];
}

// Get presets for a specific mode
export function getPresetsForMode(mode: string): Preset[] {
  return PRESET_GALLERY.filter(p => p.mode === mode);
}
