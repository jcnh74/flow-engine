// Pass 6: per-mode control panels + per-mode presets (built-in and user-saved), applied live.
// Each mode declares its own sliders / knobs / selectors bound to real scene parameters (the scenes read these
// keys every frame), its defaults and 3-5 built-in presets. User presets persist in localStorage per mode.
// Original MIT-licensed work for flow-engine.
import { SPLASH_PALETTES, SPLASH_SHAPES } from './physical/splash';
import { ROOM_PALETTES, ROOM_ORDERS, ROOM_CAMERAS } from './physical/colorroom';
import { LIQUID_BACKDROPS, LIQUID_CAMERAS } from './physical/liquid';
import { STUDIO_LOOK_NAMES, STUDIO_MATS } from './studio';
import { KNOT_PALETTES } from './physical/beadknot';
import { MANDALA_PALETTES } from './physical/mandala';
import { FEATHER_PALETTES } from './physical/feathervortex';

export type Ctl = { key: string; label: string; type: 'slider' | 'knob' | 'select' | 'check'; min?: number; max?: number; step?: number; options?: string[] | Record<string, string | number> };
export type ModeSpec = { sections: { title: string; ctls: Ctl[] }[]; defaults: Record<string, any>; presets: Record<string, Record<string, any>> };

const S = (key: string, label: string, min: number, max: number, step = 0.01): Ctl => ({ key, label, type: 'slider', min, max, step });
const K = (key: string, label: string, min: number, max: number, step = 0.01): Ctl => ({ key, label, type: 'knob', min, max, step });
const SEL = (key: string, label: string, options: string[] | Record<string, string | number>): Ctl => ({ key, label, type: 'select', options });
const CHK = (key: string, label: string): Ctl => ({ key, label, type: 'check' });

export const MODE_CONTROLS: Record<string, ModeSpec> = {
  'Gravity': {
    sections: [
      { title: 'Pour', ctls: [K('grPour', 'Pour Rate', 0.2, 2), S('grStreams', 'Streams', 1, 10, 1), K('grBursts', 'Clump Bursts', 0, 3), K('grBallSize', 'Ball Size', 0.6, 1.6)] },
      { title: 'Liquid Body', ctls: [K('grCohesion', 'Cohesion', 0, 2.5), K('grViscosity', 'Viscosity', 0, 2.5), K('grDrip', 'Drip / Cling', 0, 2.5), K('grTurbulence', 'Turbulence', 0, 3), K('grGravity', 'Gravity', 2, 20, 0.1), S('phSpeed', 'Time Scale', 0.1, 2)] },
      { title: 'Look & Camera', ctls: [SEL('phVariant', 'Scene', ['Liquid', 'Color Room', 'Cascade', 'Machine']), SEL('grBackdrop', 'Backdrop (Liquid)', Object.keys(LIQUID_BACKDROPS)), SEL('grOrder', 'Colour Order', Object.keys(ROOM_ORDERS)),
        SEL('grLqCamera', 'Camera (Liquid)', LIQUID_CAMERAS), K('grCamEnergy', 'Camera Energy', 0, 2.5), S('phFov', 'Lens FOV', 30, 85, 1), S('phDof', 'Depth of Field', 0, 1), S('phIrid', 'Pearl Iridescence', 0, 1)] },
      { title: 'Color Room (room scene only)', ctls: [S('grDropSize', 'Drop Size (balls)', 100, 2400, 10), S('grDropEvery', 'Drop Interval (s)', 0.6, 6, 0.05), K('grSpread', 'Drop Spread', 0, 1.5), K('grBounce', 'Bounciness', 0.2, 0.95), K('grRest', 'Settle → Recycle (s)', 0.5, 8, 0.1),
        SEL('grRoom', 'Room Colours', Object.keys(ROOM_PALETTES)), SEL('grCamera', 'Camera (Room)', ROOM_CAMERAS)] },
    ],
    defaults: { grPour: 1, grStreams: 8, grBursts: 1, grBallSize: 1, grCohesion: 1, grViscosity: 1, grDrip: 1, grTurbulence: 1, grGravity: 9.8, grBackdrop: 'Ink Studio', grOrder: 'Rainbow', grLqCamera: 'Drift', grCamEnergy: 1,
      grDropSize: 1100, grDropEvery: 2.4, grSpread: 1, grBounce: 0.78, grRest: 2.5, grRoom: 'Pop Gallery', grCamera: 'Low Wide' },
    presets: {
      'Liquid Rainbow': { phVariant: 'Liquid', grPour: 1, grStreams: 8, grBursts: 1, grCohesion: 1, grViscosity: 1, grDrip: 1, grTurbulence: 1, grGravity: 9.8, grBallSize: 1, grBackdrop: 'Ink Studio', grOrder: 'Rainbow', grLqCamera: 'Drift', phSpeed: 1 },
      'Honey Pour': { phVariant: 'Liquid', grPour: 0.8, grStreams: 5, grBursts: 0.5, grCohesion: 1.8, grViscosity: 2.2, grDrip: 2, grTurbulence: 0.4, grGravity: 7, grBallSize: 1.1, grBackdrop: 'Sunlit Cream', grOrder: 'Mint & Gold', grLqCamera: 'Close Pour', phSpeed: 0.8 },
      'Monsoon Drip': { phVariant: 'Liquid', grPour: 1.6, grStreams: 10, grBursts: 2.2, grCohesion: 0.7, grViscosity: 0.5, grDrip: 1.4, grTurbulence: 1.8, grGravity: 13, grBallSize: 0.8, grBackdrop: 'Deep Teal', grOrder: 'Warm / Cool', grLqCamera: 'Wide', phSpeed: 1 },
      'Zero-G Swirl': { phVariant: 'Liquid', grPour: 1.2, grStreams: 7, grBursts: 1, grCohesion: 1.4, grViscosity: 1.2, grDrip: 0.6, grTurbulence: 3, grGravity: 3, grBallSize: 1, grBackdrop: 'Blush Void', grOrder: 'Duo Coral-Cobalt', grLqCamera: 'Low Angle', phSpeed: 0.9 },
      'Pop Splash (room)': { phVariant: 'Color Room', grDropSize: 1100, grDropEvery: 2.4, grBounce: 0.78, grGravity: 9.8, grRoom: 'Pop Gallery', grOrder: 'Rainbow', grCamera: 'Low Wide', grBallSize: 1 },
      'Moon Bounce (room)': { phVariant: 'Color Room', grDropSize: 700, grDropEvery: 3.2, grBounce: 0.93, grGravity: 4, grRoom: 'Candy Loft', grOrder: 'Mint & Gold', grCamera: 'Orbit', grBallSize: 1.2 },
    },
  },

  'Stargate': {
    sections: [
      { title: 'Flight', ctls: [S('phSpeed', 'Speed', 0, 3), K('phStreak', 'Streak Length', 0.1, 3), K('sgWarp', 'Warp', 0, 2), S('sgFov', 'Lens', 0.4, 1.2)] },
      { title: 'Artwork', ctls: [K('sgDensity', 'Density', 0.1, 0.95), K('sgBands', 'Band Count', 0.4, 4), SEL('sgPattern', 'Pattern', ['Auto Cycle', 'Ribbons', 'Dot Lattice', 'Moiré']), SEL('phPalette', 'Light Palette', ['Kubrick', 'Jupiter', 'Neon Ice', 'Sunset Strip']), SEL('phVariant', 'Planes', ['Floor + Ceiling', 'Walls'])] },
      { title: 'Light', ctls: [K('sgGlow', 'Horizon Glow', 0, 3), K('sgExposure', 'Exposure', 0.3, 2.5)] },
    ],
    defaults: { sgWarp: 0.3, sgFov: 0.62, sgDensity: 0.68, sgBands: 1.4, sgPattern: 'Auto Cycle', sgGlow: 1, sgExposure: 1 },
    presets: {
      'Kubrick 1968': { phSpeed: 1, phStreak: 1, sgWarp: 0.3, sgDensity: 0.68, sgBands: 1.4, sgPattern: 'Auto Cycle', phPalette: 'Kubrick', phVariant: 'Floor + Ceiling', sgGlow: 1, sgExposure: 1 },
      'Hyperdrive': { phSpeed: 2.6, phStreak: 2.6, sgWarp: 0.1, sgDensity: 0.8, sgBands: 2.2, sgPattern: 'Ribbons', phPalette: 'Neon Ice', sgGlow: 2, sgExposure: 1.3 },
      'Jupiter Drift': { phSpeed: 0.5, phStreak: 1.6, sgWarp: 1.2, sgDensity: 0.5, sgBands: 0.9, sgPattern: 'Moiré', phPalette: 'Jupiter', phVariant: 'Walls', sgGlow: 1.4, sgExposure: 1 },
      'Dot Tunnel': { phSpeed: 1.4, phStreak: 0.5, sgWarp: 0.5, sgDensity: 0.6, sgBands: 3, sgPattern: 'Dot Lattice', phPalette: 'Sunset Strip', sgGlow: 0.6, sgExposure: 1.1 },
    },
  },
  'Paint Pour': {
    sections: [
      { title: 'Clip', ctls: [SEL('ppClip', 'Clip', ['Splash', 'Pour']), S('phSpeed', 'Playback Speed', 0.25, 2)] },
      { title: 'Grade', ctls: [K('ppSat', 'Saturation', 0, 2), K('ppHue', 'Hue Shift', -0.5, 0.5), K('ppExposure', 'Exposure', 0.4, 2), K('ppZoom', 'Push-in', 1, 1.6), K('ppDrift', 'Camera Drift', 0, 1)] },
    ],
    defaults: { ppClip: 'Pour', ppSat: 1, ppHue: 0, ppExposure: 1, ppZoom: 1, ppDrift: 0.3 },
    presets: {
      'Splash Natural': { ppClip: 'Splash', ppSat: 1, ppHue: 0, ppExposure: 1, ppZoom: 1, ppDrift: 0.3, phSpeed: 1 },
      'Splash Slow-mo': { ppClip: 'Splash', ppSat: 1.15, ppHue: 0, ppExposure: 1.05, ppZoom: 1.15, ppDrift: 0.6, phSpeed: 0.4 },
      'Splash Cool Shift': { ppClip: 'Splash', ppSat: 1.3, ppHue: 0.33, ppExposure: 1, ppZoom: 1.05, ppDrift: 0.3, phSpeed: 1 },
      'Pour Classic': { ppClip: 'Pour', ppSat: 1, ppHue: 0, ppExposure: 1, ppZoom: 1, ppDrift: 0, phSpeed: 1 },
    },
  },
  'Paint': {
    sections: [
      { title: 'Splash', ctls: [SEL('phVariant', 'Scene', ['Splash', 'Pour', 'Drip Wall']), SEL('spShape', 'Splash Type', SPLASH_SHAPES), S('spRate', 'Splashes / s', 0.2, 6, 0.05), K('spSize', 'Paint Size', 0.5, 2), K('spSpeed', 'Throw Speed', 0.3, 2.2), K('spDepth', 'Depth Spread', 0.3, 1.6)] },
      { title: 'Paint Body', ctls: [K('spGravity', 'Gravity', 0, 6, 0.05), K('spDrag', 'Air Drag', 0, 1.5), K('spDroplets', 'Droplets', 0, 2.5), K('spStretch', 'Rope Stretch', 0, 2.5), K('spSmooth', 'Surface Smoothing', 0.3, 2), S('spMix', 'Two-Colour Mix', 0, 1)] },
      { title: 'Colour & Light', ctls: [SEL('spPalette', 'Palette', Object.keys(SPLASH_PALETTES)), K('phGloss', 'Gloss', 0.2, 2), K('spGlow', 'Thickness Glow', 0, 2.5), S('phKeyAz', 'Key Angle', -180, 180, 1), S('phKeyEl', 'Key Height', 5, 85, 1)] },
      { title: 'Camera', ctls: [S('phSpeed', 'Time Scale', 0, 2), K('spCamDrift', 'Camera Drift', 0, 3), S('phFov', 'Lens FOV', 30, 85, 1), S('spFocus', 'Focus Distance', 2, 18, 0.1), S('phDof', 'Depth of Field', 0, 1)] },
      { title: 'Classic Canvas', ctls: [K('phThickness', 'Thickness', 0.2, 3)] },
    ],
    defaults: { spShape: 'Mixed', spRate: 2.2, spSize: 1, spSpeed: 1, spDepth: 1, spGravity: 1.6, spDrag: 0.25, spDroplets: 1, spStretch: 1, spSmooth: 1, spMix: 0.5, spPalette: 'Carnival', spGlow: 1, spCamDrift: 1, spFocus: 6 },
    presets: {
      'Carnival Burst': { phVariant: 'Splash', spShape: 'Mixed', spRate: 2.2, spSize: 1, spSpeed: 1, spPalette: 'Carnival', spMix: 0.5, spGravity: 1.6, phSpeed: 1 },
      'Crown Storm': { phVariant: 'Splash', spShape: 'Crowns', spRate: 3.6, spSize: 1.2, spSpeed: 1.3, spPalette: 'Primary Pop', spMix: 0.7, spDroplets: 1.6, phSpeed: 1 },
      'Honey Ropes': { phVariant: 'Splash', spShape: 'Ropes', spRate: 1.4, spSize: 1.5, spSpeed: 0.7, spPalette: 'Earth & Gold', spDrag: 0.6, spStretch: 1.8, spGravity: 2.4, phSpeed: 0.7 },
      'Neon Spray': { phVariant: 'Splash', spShape: 'Mixed', spRate: 4.5, spSize: 0.8, spSpeed: 1.6, spPalette: 'Neon', spDroplets: 2.2, spMix: 0.9, phSpeed: 1.2 },
      'Wet Pour (canvas)': { phVariant: 'Pour', phThickness: 1, phSpeed: 1, phGloss: 1.2 },
      'Drip Wall (canvas)': { phVariant: 'Drip Wall', phThickness: 1.2, phSpeed: 1.2, phGloss: 1.4 },
    },
  },
  'City Vortex': {
    sections: [
      { title: 'Traffic & Flow', ctls: [S('phSpeed', 'Flow Speed', 0, 2.5), K('ctSpin', 'Vortex Spin', 0, 0.3), K('ctTraffic', 'Traffic Speed', 0, 2.5), K('ctLights', 'Window Lights', 0, 1.5)] },
      { title: 'City', ctls: [SEL('phMat', 'Palette', ['Dusk Gold', 'Cobalt Night', 'Pastel Morning']), SEL('ctDistrict', 'District Bias', ['Mixed', 'Downtown Glass', 'Brownstones', 'Industrial', 'Waterfront']), K('ctFog', 'Haze', 0, 2), K('ctRefl', 'Glass Reflection', 0, 1.5)] },
      { title: 'Camera', ctls: [S('phFov', 'Lens FOV', 35, 90, 1), S('phDof', 'Depth of Field', 0, 1), S('phKeyAz', 'Sun Angle', -180, 180, 1), S('phKeyEl', 'Sun Height', 5, 85, 1)] },
    ],
    defaults: { ctSpin: 0.07, ctTraffic: 1, ctLights: 1, ctDistrict: 'Mixed', ctFog: 1, ctRefl: 1 },
    presets: {
      'Golden Hour': { phMat: 'Dusk Gold', phSpeed: 1, ctSpin: 0.07, ctTraffic: 1, ctLights: 0.6, ctFog: 1, ctRefl: 1.1, phKeyEl: 20 },
      'Night Shift': { phMat: 'Cobalt Night', phSpeed: 1.3, ctSpin: 0.1, ctTraffic: 1.8, ctLights: 1.4, ctFog: 1.2, ctRefl: 0.8 },
      'Morning Commute': { phMat: 'Pastel Morning', phSpeed: 0.7, ctSpin: 0.04, ctTraffic: 0.8, ctLights: 0.2, ctFog: 0.7, ctRefl: 1.2, phKeyEl: 50 },
      'Brownstone Calm': { phMat: 'Dusk Gold', ctDistrict: 'Brownstones', phSpeed: 0.5, ctSpin: 0.03, ctTraffic: 0.5, ctLights: 0.8 },
    },
  },
  'Jungle': {
    sections: [
      { title: 'Motifs', ctls: [SEL('jgMotif', 'Motif', ['Journey (cycle)', 'Orchids', 'Heliconia & Bird-of-Paradise', 'Monstera & Palm', 'Ferns & Moss', 'Bromeliads', 'Lotus Water Garden']), K('jgCycle', 'Motif Duration (s)', 6, 40, 1)] },
      { title: 'Motion', ctls: [S('phSpeed', 'Flight Speed', 0, 2), K('jgSway', 'Leaf Sway', 0, 2), K('jgBloom', 'Petal Opening', 0, 1.5), K('jgDensity', 'Density', 0.3, 1)] },
      { title: 'Look', ctls: [SEL('phMat', 'Flora', ['Natural', 'Pastel', 'Iridescent']), K('jgFloor', 'Forest Floor', 0, 1),K('jgFog', 'Depth Fog', 0, 2), K('jgSat', 'Saturation', 0.4, 1.8), S('phFov', 'Lens FOV', 35, 90, 1), S('phDof', 'Depth of Field', 0, 1)] },
    ],
    defaults: { jgMotif: 'Journey (cycle)', jgFloor: 1, jgCycle: 16, jgSway: 1, jgBloom: 1, jgDensity: 1, jgFog: 1, jgSat: 1 },
    presets: {
      'Rainforest Journey': { jgMotif: 'Journey (cycle)', jgCycle: 16, phSpeed: 1, jgSway: 1, jgBloom: 1, phMat: 'Natural', jgFog: 1, jgSat: 1 },
      'Orchid House': { jgMotif: 'Orchids', phSpeed: 0.6, jgSway: 0.6, jgBloom: 1.3, phMat: 'Natural', jgFog: 0.7, jgSat: 1.2 },
      'Lotus Dream': { jgMotif: 'Lotus Water Garden', phSpeed: 0.5, jgSway: 0.4, phMat: 'Pastel', jgFog: 1.3, jgSat: 0.9 },
      'Iridescent Canopy': { jgMotif: 'Monstera & Palm', phSpeed: 1.3, jgSway: 1.6, phMat: 'Iridescent', jgFog: 0.8, jgSat: 1.4 },
    },
  },
  'Fabric': {
    sections: [
      { title: 'Ribbons', ctls: [S('fbCount', 'Ribbon Count', 1, 10, 1), S('phSpeed', 'Float Speed', 0, 2.5), K('fbFlutter', 'Flutter', 0, 2), K('fbWidth', 'Width', 0.4, 2), K('fbTwist', 'Twist', 0, 2)] },
      { title: 'Cloth', ctls: [SEL('fbPalette', 'Palette', ['Complementary Coral/Teal', 'Triad Jewel', 'Analog Sunset', 'Split Lilac/Gold', 'Monochrome Pearl']), SEL('phMat', 'Cloth', ['Satin', 'Silk', 'Iridescent', 'Velvet']), K('fbWeave', 'Weave Bump', 0, 2), K('fbSheen', 'Anisotropic Sheen', 0, 2), SEL('phVariant', 'Motion', ['Drift', 'Ribbon', 'Flow', 'Blender Bake'])] },
      { title: 'Camera', ctls: [S('phFov', 'Lens FOV', 30, 85, 1), S('fbFocus', 'Focus Distance', 3, 25, 0.1), S('phDof', 'Depth of Field', 0, 1), S('phKeyAz', 'Key Angle', -180, 180, 1), S('phKeyEl', 'Key Height', 5, 85, 1)] },
    ],
    defaults: { fbFocus: 9, fbCount: 8, fbFlutter: 1, fbWidth: 1, fbTwist: 1, fbPalette: 'Complementary Coral/Teal', fbWeave: 1, fbSheen: 1 },
    presets: {
      'Silk Parade': { fbCount: 7, phSpeed: 1, fbFlutter: 1, fbWidth: 1, fbPalette: 'Complementary Coral/Teal', phMat: 'Silk', fbWeave: 1, fbSheen: 1.2 },
      'Jewel Satin': { fbCount: 9, phSpeed: 0.8, fbFlutter: 0.7, fbWidth: 1.3, fbPalette: 'Triad Jewel', phMat: 'Satin', fbWeave: 0.8, fbSheen: 1.5 },
      'Sunset Drift': { fbCount: 5, phSpeed: 0.5, fbFlutter: 1.4, fbWidth: 1.6, fbPalette: 'Analog Sunset', phMat: 'Silk', fbWeave: 1.3, fbSheen: 1 },
      'Pearl Velvet': { fbCount: 6, phSpeed: 0.7, fbFlutter: 0.5, fbWidth: 1.1, fbPalette: 'Monochrome Pearl', phMat: 'Velvet', fbWeave: 1.8, fbSheen: 0.6 },
    },
  },


  'Bead Knot': {
    sections: [
      { title: 'Knot', ctls: [S('bkP', 'Windings P', 2, 7, 1), S('bkQ', 'Windings Q', 1, 5, 1), S('bkStrands', 'Strands', 3, 14, 1), S('bkBeads', 'Beads / Strand', 60, 280, 1), K('bkSize', 'Bead Size', 0.5, 1.8), K('bkGap', 'Segment Gap', 0, 0.6)] },
      { title: 'Motion', ctls: [S('phSpeed', 'Time Scale', 0, 2), K('bkOrbit', 'Orbit', 0, 2.5), K('bkMorph', 'Morph', 0, 2.5), K('bkTube', 'Tube Radius', 0.5, 1.8), K('bkCore', 'Crystal Core', 0.3, 2)] },
      { title: 'Look', ctls: [SEL('bkPalette', 'Palette', Object.keys(KNOT_PALETTES)), K('phGloss', 'Gloss', 0.2, 2), K('phIrid', 'Iridescence', 0, 1), K('bkGrid', 'Studio Grid', 0, 1.5), S('phFov', 'Lens FOV', 30, 75, 1), S('phDof', 'Depth of Field', 0, 1)] },
    ],
    defaults: { bkP: 3, bkQ: 2, bkStrands: 8, bkBeads: 180, bkSize: 1, bkGap: 0.18, bkOrbit: 1, bkMorph: 1, bkTube: 1, bkCore: 1, bkPalette: 'Ember Core', bkGrid: 0.7 },
    presets: {
      'Ember Orbit': { bkPalette: 'Ember Core', bkP: 3, bkQ: 2, bkStrands: 8, bkBeads: 180, bkSize: 1, bkGap: 0.18, bkOrbit: 1, bkMorph: 1, bkCore: 1, phGloss: 1.2, phSpeed: 1 },
      'Tight Helix': { bkPalette: 'Magenta Sun', bkP: 5, bkQ: 2, bkStrands: 10, bkBeads: 220, bkSize: 0.85, bkGap: 0.12, bkOrbit: 0.7, bkMorph: 0.6, bkTube: 0.8, phGloss: 1.4, phSpeed: 0.85 },
      'Neon Ice': { bkPalette: 'Neon Ice', bkP: 3, bkQ: 4, bkStrands: 7, bkBeads: 160, bkSize: 1.15, bkGap: 0.22, bkOrbit: 1.2, bkMorph: 1.6, bkCore: 1.3, phIrid: 0.8, phSpeed: 1.1 },
      'Lime Storm': { bkPalette: 'Electric Lime', bkP: 4, bkQ: 3, bkStrands: 12, bkBeads: 240, bkSize: 0.8, bkGap: 0.1, bkOrbit: 1.5, bkMorph: 1.8, bkCore: 0.8, phSpeed: 1.25 },
    },
  },
  'Mirror Mandala': {
    sections: [
      { title: 'Symmetry', ctls: [SEL('mmSym', 'Fold', ['Bilateral', '4-fold', '8-fold']), K('mmDensity', 'Bead Density', 0.5, 1.8), K('mmLobes', 'Bubble Lobes', 0, 1.6)] },
      { title: 'Motion', ctls: [S('phSpeed', 'Time Scale', 0, 2), K('mmGrow', 'Grow', 0, 2), K('mmBreathe', 'Breathe', 0, 2.5), K('mmZoom', 'Inward Zoom', 0, 2)] },
      { title: 'Look', ctls: [SEL('mmPalette', 'Palette', Object.keys(MANDALA_PALETTES)), K('mmFringe', 'RGB Fringe', 0, 2.5), K('phGloss', 'Gloss', 0.2, 2), K('phIrid', 'Iridescence', 0, 1), S('phFov', 'Lens FOV', 28, 70, 1), S('phDof', 'Depth of Field', 0, 1)] },
    ],
    defaults: { mmSym: 'Bilateral', mmDensity: 1, mmLobes: 1, mmGrow: 1, mmBreathe: 1, mmZoom: 1, mmPalette: 'Poison Garden', mmFringe: 1 },
    presets: {
      'Poison Guardian': { mmSym: 'Bilateral', mmPalette: 'Poison Garden', mmDensity: 1.15, mmLobes: 1.1, mmGrow: 1, mmBreathe: 1, mmZoom: 1, mmFringe: 1, phGloss: 1.15, phSpeed: 1 },
      'Coral Loom': { mmSym: 'Bilateral', mmPalette: 'Neon Coral', mmDensity: 1.3, mmLobes: 1.4, mmGrow: 1.3, mmBreathe: 1.4, mmZoom: 0.7, mmFringe: 1.4, phIrid: 0.7, phSpeed: 0.9 },
      'Violet Relic 4': { mmSym: '4-fold', mmPalette: 'Violet Relic', mmDensity: 1, mmLobes: 1, mmGrow: 0.8, mmBreathe: 0.8, mmZoom: 1.2, mmFringe: 0.8, phSpeed: 0.8 },
      'Ice Orchid 8': { mmSym: '8-fold', mmPalette: 'Ice Orchid', mmDensity: 0.85, mmLobes: 0.7, mmGrow: 1.1, mmBreathe: 1.6, mmZoom: 0.9, mmFringe: 1.6, phIrid: 0.85, phSpeed: 1.1 },
    },
  },
  'Feather Vortex': {
    sections: [
      { title: 'Swirl', ctls: [K('fvDensity', 'Blade Density', 0.4, 1.6), K('fvSpin', 'Spin', 0, 2.5), K('fvInward', 'Inward Drift', 0, 2.2), K('fvMelt', 'Melt / Undulate', 0, 2.5), K('fvBlade', 'Blade Size', 0.5, 1.8)] },
      { title: 'Trail', ctls: [S('phSpeed', 'Time Scale', 0, 2), K('fvTrail', 'Feedback Trail', 0, 0.9), K('fvCore', 'Dark Core', 0.4, 1.6)] },
      { title: 'Look', ctls: [SEL('fvPalette', 'Palette', Object.keys(FEATHER_PALETTES)), K('phGloss', 'Sheen', 0.2, 2), S('phFov', 'Lens FOV', 35, 80, 1), S('phDof', 'Depth of Field', 0, 1), S('phKeyAz', 'Key Angle', -180, 180, 1), S('phKeyEl', 'Key Height', 5, 85, 1)] },
    ],
    defaults: { fvDensity: 1, fvSpin: 1, fvInward: 1, fvMelt: 1, fvBlade: 1, fvTrail: 0.65, fvCore: 1, fvPalette: 'Ember Tide' },
    presets: {
      'Ember Tide': { fvPalette: 'Ember Tide', fvDensity: 1, fvSpin: 1, fvInward: 1, fvMelt: 1, fvBlade: 1, fvTrail: 0.65, phGloss: 1, phSpeed: 1 },
      'Slow Melt': { fvPalette: 'Solar Flare', fvDensity: 1.15, fvSpin: 0.45, fvInward: 0.7, fvMelt: 1.8, fvBlade: 1.25, fvTrail: 0.8, phSpeed: 0.7, phDof: 0.28 },
      'Magenta Well': { fvPalette: 'Magenta Deep', fvDensity: 0.9, fvSpin: 1.4, fvInward: 1.5, fvMelt: 0.7, fvBlade: 0.9, fvTrail: 0.55, phGloss: 1.3, phSpeed: 1.15 },
      'Jade Firestorm': { fvPalette: 'Jade Fire', fvDensity: 1.35, fvSpin: 1.8, fvInward: 1.2, fvMelt: 1.5, fvBlade: 0.8, fvTrail: 0.7, phSpeed: 1.3 },
    },
  },
  '3D Fractal': {
    sections: [
      { title: 'Form', ctls: [
        SEL('frType', 'Type', { 'Mandelbulb': 0, 'Mandelbox': 1, 'Menger Sponge': 2, 'Sierpinski': 3, 'Kaleidoscopic': 4, 'Quaternion Julia': 5 }),
        S('frPower', 'Power', 2, 16, 0.1), S('frIter', 'Iterations', 4, 24, 1), S('frBailout', 'Bailout', 1, 10, 0.1), S('frScale', 'Scale', -3, 3, 0.1),
      ] },
      { title: 'Studio', ctls: [
        CHK('frStudio', 'Studio cove look'), SEL('stLook', 'Look', STUDIO_LOOK_NAMES), SEL('stMat', 'Material', STUDIO_MATS),
        S('stRim', 'Rim Light', 0, 1.5, 0.01), S('frRes', 'Internal Resolution', 0.35, 1, 0.05),
      ] },
      { title: 'Camera', ctls: [
        S('frCamDist', 'Distance', 1, 10, 0.1), S('frCamFov', 'FOV', 30, 90, 1), S('frRotSpeed', 'Rotation', 0, 0.5, 0.01),
        CHK('frCamOrbit', 'Camera Orbit'), S('frCamOrbitSpeed', 'Orbit Speed', 0, 1, 0.01),
      ] },
      { title: 'Light', ctls: [
        S('frLightAz', 'Azimuth', 0, 360, 1), S('frLightEl', 'Elevation', -90, 90, 1),
        K('frAmbient', 'Ambient', 0, 1), K('frDiffuse', 'Diffuse', 0, 2), K('frGlow', 'Glow', 0, 2),
        S('frShadow', 'Shadow Strength', 0, 1, 0.01), S('frShadowSharpness', 'Shadow Sharpness', 0.5, 32, 0.5),
        S('frAOStrength', 'AO Strength', 0, 10, 0.2), S('frAORadius', 'AO Radius', 0.01, 1, 0.02),
        S('frFogDensity', 'Fog Density', 0, 1.5, 0.05), S('frFogStart', 'Fog Start', 0, 5, 0.1),
      ] },
      { title: 'Motion & Quality', ctls: [
        S('frMorph', 'Morph Amount', 0, 1, 0.01), CHK('frJuliaOrbit', 'Julia C Orbit'), S('frJuliaSpeed', 'Julia Orbit Speed', 0, 2, 0.01),
        S('frFoldRot', 'Fold Rotation', 0, 360, 1), CHK('frSlicePlane', 'Slice Plane'), S('frSlicePos', 'Slice Position', -2, 2, 0.01),
        S('frMaxSteps', 'Ray Steps', 64, 256, 1), S('frMaxDist', 'Max Distance', 10, 50, 1),
      ] },
    ],
    defaults: {
      frStudio: true, stLook: 'Lilac Dream', stMat: 'Gloss', stRim: 0.35, frRes: 0.45,
      frType: 0, frPower: 8, frIter: 10, frBailout: 4, frScale: -1.5,
      frCamDist: 2.5, frCamFov: 50, frRotSpeed: 0.15, frCamOrbit: true, frCamOrbitSpeed: 0.3,
      frLightAz: 35, frLightEl: 50, frAmbient: 0.42, frDiffuse: 0.85, frGlow: 0, frShadow: 0.8, frShadowSharpness: 6,
      frAOStrength: 4, frAORadius: 0.3, frFogDensity: 0.04, frFogStart: 2.0, frMaxSteps: 80, frMaxDist: 20,
      frMorph: 0, frJuliaOrbit: false, frJuliaSpeed: 0.2, frFoldRot: 0, frSlicePlane: false, frSlicePos: 0,
    },
    presets: {
      'Lilac Bulb': { frType: 0, frPower: 8, frIter: 10, frCamDist: 2.5, frRes: 0.45, frMaxSteps: 80, frAmbient: 0.42, frGlow: 0, frFogDensity: 0.04, frRotSpeed: 0.15, frStudio: true, stLook: 'Lilac Dream', stMat: 'Gloss', stRim: 0.35 },
      'Coral Bulb': { frType: 0, frPower: 5, frIter: 10, frCamDist: 2.6, frRes: 0.45, frMaxSteps: 80, frAmbient: 0.42, frGlow: 0, frFogDensity: 0.04, frRotSpeed: 0.12, frStudio: true, stLook: 'Coral Peach', stMat: 'Gloss', stRim: 0.4 },
      'Mandelbox Deep': { frType: 1, frScale: -1.8, frIter: 12, frCamDist: 7, frRes: 0.5, frMaxSteps: 120, frAmbient: 0.38, frFogDensity: 0.06, frRotSpeed: 0.08, frStudio: true, stLook: 'Cobalt Orange', stMat: 'Satin metal', stRim: 0.5 },
      'Menger Studio': { frType: 2, frIter: 5, frCamDist: 4, frRes: 0.5, frMaxSteps: 80, frAmbient: 0.45, frAOStrength: 5, frFogDensity: 0.05, frRotSpeed: 0.1, frStudio: true, stLook: 'Cream Gold', stMat: 'Matte', stRim: 0.3 },
      'Julia Drift': { frType: 5, frIter: 10, frCamDist: 3.2, frJuliaOrbit: true, frJuliaSpeed: 0.35, frRotSpeed: 0.08, frGlow: 0.15, frFogDensity: 0.05, frStudio: true, stLook: 'Mint Pink', stMat: 'Iridescent', stRim: 0.55 },
    },
  },
  'Landscape': {
    sections: [{ title: 'Dynamics', ctls: [K('landSpeed', 'Flight Speed', 0, 2), K('landFlow', 'Pigment Flow', 0, 4), K('landPigment', 'Pigment', 0, 1.5), K('landFog', 'Depth Fade', 0, 1.5)] }],
    defaults: {},
    presets: {
      'Gentle Glide': { landSpeed: 0.6, landFlow: 1, landPigment: 0.8, landFog: 0.6 },
      'Pigment Storm': { landSpeed: 1.4, landFlow: 3.2, landPigment: 1.4, landFog: 0.4 },
      'Misty Dawn': { landSpeed: 0.4, landFlow: 0.6, landPigment: 0.5, landFog: 1.3 },
      'Fast Canyon': { landSpeed: 2, landFlow: 1.6, landPigment: 1, landFog: 0.2 },
    },
  },
  'Morph': {
    sections: [{ title: 'Dynamics', ctls: [K('trippySpeed', 'Speed', 0.5, 3), K('morphBlobs', 'Blob Count', 1, 6, 1), K('morphSmooth', 'Smoothness', 0, 1), K('morphRate', 'Morph Rate', 0, 1), K('morphGlow', 'Glow', 0, 2)] }],
    defaults: {},
    presets: {
      'Lava Calm': { trippySpeed: 0.8, morphBlobs: 3, morphSmooth: 0.8, morphRate: 0.3, morphGlow: 0.6 },
      'Busy Cells': { trippySpeed: 2.2, morphBlobs: 6, morphSmooth: 0.4, morphRate: 0.8, morphGlow: 1 },
      'Glow Pair': { trippySpeed: 1.2, morphBlobs: 2, morphSmooth: 0.9, morphRate: 0.5, morphGlow: 1.8 },
    },
  },
  'Plasma': {
    sections: [{ title: 'Dynamics', ctls: [K('trippySpeed', 'Speed', 0.5, 3), K('plasmaScale', 'Scale', 0.5, 3), K('plasmaWarp', 'Warp', 0, 2), K('plasmaFlow', 'Flow', 0, 1.5), K('plasmaContrast', 'Contrast', 0.5, 2)] }],
    defaults: {},
    presets: {
      'Silk Plasma': { trippySpeed: 0.8, plasmaScale: 1.2, plasmaWarp: 0.6, plasmaFlow: 0.5, plasmaContrast: 1 },
      'Acid Warp': { trippySpeed: 2.4, plasmaScale: 2.4, plasmaWarp: 1.8, plasmaFlow: 1.2, plasmaContrast: 1.6 },
      'Slow Tide': { trippySpeed: 0.5, plasmaScale: 0.7, plasmaWarp: 0.3, plasmaFlow: 0.3, plasmaContrast: 0.8 },
    },
  },
};

const LS = (mode: string) => `flowModePresets:${mode}`;
type Store = { getItem(k: string): string | null; setItem(k: string, v: string): void };
const store = (): Store | null => (typeof localStorage !== 'undefined' ? localStorage : null);
export function userPresets(mode: string): Record<string, Record<string, any>> {
  try { return JSON.parse(store()?.getItem(LS(mode)) ?? '{}'); } catch { return {}; }
}
export function presetNames(mode: string): string[] {
  const spec = MODE_CONTROLS[mode]; if (!spec) return [];
  return [...Object.keys(spec.presets), ...Object.keys(userPresets(mode)).map((n) => `★ ${n}`)];
}
/** Fill any of the mode's control keys that are still unset. */
export function applyModeDefaults(P: Record<string, any>, mode: string) {
  const spec = MODE_CONTROLS[mode]; if (!spec) return;
  for (const [k, v] of Object.entries(spec.defaults)) if (P[k] === undefined) P[k] = v;
}
export function applyModePreset(P: Record<string, any>, mode: string, name: string): boolean {
  const spec = MODE_CONTROLS[mode]; if (!spec) return false;
  const vals = name.startsWith('★ ') ? userPresets(mode)[name.slice(2)] : spec.presets[name];
  if (!vals) return false;
  Object.assign(P, vals); return true;
}
export function captureModeValues(P: Record<string, any>, mode: string): Record<string, any> {
  const spec = MODE_CONTROLS[mode]; const out: Record<string, any> = {};
  if (!spec) return out;
  for (const s of spec.sections) for (const c of s.ctls) if (P[c.key] !== undefined) out[c.key] = P[c.key];
  return out;
}
export function saveModePreset(P: Record<string, any>, mode: string, name: string): string | null {
  const st = store(); const n = name.trim().slice(0, 40); if (!st || !n) return null;
  const all = userPresets(mode); all[n] = captureModeValues(P, mode); st.setItem(LS(mode), JSON.stringify(all)); return `★ ${n}`;
}
export function deleteModePreset(mode: string, name: string): boolean {
  const st = store(); if (!st || !name.startsWith('★ ')) return false;
  const all = userPresets(mode); delete all[name.slice(2)]; st.setItem(LS(mode), JSON.stringify(all)); return true;
}
