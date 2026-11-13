// Shared color groups, palettes and remote schema for lineup visualizers.
// Original MIT-licensed work for flow-engine.
import { STUDIO_LOOKS, type StudioLook } from './studio';
import { MODE_CONTROLS, type Ctl } from './modeControls';

export type ColorGroupId = 'lighting' | 'studio' | 'background' | 'objects' | 'glow' | 'material';

export type ColorGroup = {
  id: ColorGroupId;
  title: string;
  ctls: Ctl[];
  palettes: Record<string, Record<string, string | number>>;
};

const COLOR = (key: string, label: string): Ctl => ({ key, label, type: 'color' });
const S = (key: string, label: string, min: number, max: number, step = 0.01): Ctl => ({ key, label, type: 'slider', min, max, step });

export const COLOR_GROUPS: Record<ColorGroupId, ColorGroup> = {
  lighting: {
    id: 'lighting', title: 'Lighting',
    ctls: [
      COLOR('colKey', 'Key'),
      COLOR('colFill', 'Fill'),
      COLOR('colRim', 'Rim'),
      COLOR('colAmbient', 'Ambient'),
    ],
    palettes: {
      'Warm Key': { colKey: '#fff1dc', colFill: '#ffd4bc', colRim: '#ffe0c4', colAmbient: '#1a1410' },
      'Cool Day': { colKey: '#e8f4ff', colFill: '#9fb8ff', colRim: '#c8e0ff', colAmbient: '#0c1218' },
      'Magenta Night': { colKey: '#ffe4f4', colFill: '#c090ff', colRim: '#ff9ad8', colAmbient: '#140814' },
      'Neutral Studio': { colKey: '#fff6ee', colFill: '#d8d4cc', colRim: '#f0ece4', colAmbient: '#161410' },
    },
  },
  studio: {
    id: 'studio', title: 'Studio',
    ctls: [
      COLOR('colFloor', 'Floor'),
      COLOR('colWalls', 'Walls'),
    ],
    palettes: {
      'Dark Cove': { colFloor: '#1a1a22', colWalls: '#24242e' },
      'Cream Studio': { colFloor: '#e8d8c0', colWalls: '#f2eadc' },
      'Black Box': { colFloor: '#0a0a0c', colWalls: '#121214' },
      'Warm Wood': { colFloor: '#6a4a28', colWalls: '#3a2a1c' },
    },
  },
  background: {
    id: 'background', title: 'Background',
    ctls: [
      COLOR('colBgTop', 'Sky / Top'),
      COLOR('colBgBottom', 'Horizon / Bottom'),
    ],
    palettes: {
      'Ink Void': { colBgTop: '#07070c', colBgBottom: '#000000' },
      'Cobalt Dusk': { colBgTop: '#3657d8', colBgBottom: '#1b3393' },
      'Deep Teal': { colBgTop: '#0c2830', colBgBottom: '#061018' },
      'Warm Dusk': { colBgTop: '#3a2018', colBgBottom: '#120806' },
    },
  },
  objects: {
    id: 'objects', title: 'Objects',
    ctls: [
      COLOR('colObject', 'Base Color'),
    ],
    palettes: {
      'Gold': { colObject: '#d4b46a' },
      'Cyan': { colObject: '#7ef0ff' },
      'Ivory': { colObject: '#f0e6d4' },
      'Magenta': { colObject: '#ff80c8' },
    },
  },
  glow: {
    id: 'glow', title: 'Glow',
    ctls: [
      COLOR('colGlow', 'Glow Color'),
      S('colGlowI', 'Glow Intensity', 0, 2, 0.01),
    ],
    palettes: {
      'Cyan Pulse': { colGlow: '#7ef6ff', colGlowI: 1 },
      'Amber': { colGlow: '#ffd27a', colGlowI: 1.1 },
      'Hot Pink': { colGlow: '#ff9ad8', colGlowI: 1.15 },
      'Soft White': { colGlow: '#e8f0ff', colGlowI: 0.7 },
    },
  },
  material: {
    id: 'material', title: 'Material',
    ctls: [
      S('phGloss', 'Gloss', 0, 2, 0.01),
      S('phIrid', 'Iridescence', 0, 1, 0.01),
    ],
    palettes: {
      'Matte': { phGloss: 0, phIrid: 0 },
      'Clay': { phGloss: 0, phIrid: 0 },
      'Satin': { phGloss: 1.0, phIrid: 0.25 },
      'Pearl': { phGloss: 1.4, phIrid: 0.85 },
    },
  },
};

/** Groups that apply to each lineup visualizer. Hidden groups are omitted from the panel and remote schema. */
export const MODE_COLOR_GROUPS: Record<string, ColorGroupId[]> = {
  'Paint': ['lighting', 'studio', 'background', 'objects', 'material'],
  'Paint Pour': ['lighting', 'studio', 'background', 'objects', 'material'],
  'City Vortex': ['lighting', 'background', 'objects', 'glow'],
  'Jungle': ['lighting', 'background', 'objects'],
  'Stargate': ['background', 'objects', 'glow'],
  'Fabric': ['lighting', 'studio', 'background', 'objects', 'material'],
  '3D Fractal': ['lighting', 'background', 'objects', 'glow', 'material'],
  'Bead Knot': ['lighting', 'studio', 'background', 'objects', 'material'],
  'Mirror Mandala': ['lighting', 'studio', 'background', 'objects', 'glow', 'material'],
  'Feather Vortex': ['lighting', 'background', 'objects', 'material'],
  'Crystal Temple': ['lighting', 'studio', 'background', 'objects', 'glow', 'material'],
};

export function colorGroupsFor(mode: string): ColorGroup[] {
  const ids = MODE_COLOR_GROUPS[mode];
  if (!ids) return [];
  return ids.map((id) => COLOR_GROUPS[id]);
}

export function lookColors(lookName: string | undefined): Partial<Record<string, string | number>> {
  const look: StudioLook = STUDIO_LOOKS[lookName ?? ''] ?? STUDIO_LOOKS['Cobalt Orange'] ?? Object.values(STUDIO_LOOKS)[0];
  return {
    colKey: look.key,
    colFill: look.fill,
    colRim: look.rim,
    colAmbient: look.dome,
    colBgTop: look.bgTop,
    colBgBottom: look.bgBottom,
    colFloor: look.bgBottom,
    colWalls: look.bgTop,
    colGlow: look.glow,
    colObject: look.slots[0],
    colGlowI: 1,
  };
}

/** Fill missing color keys so the first load matches the mode's current studio look. */
export function seedModeColors(P: Record<string, any>, mode: string) {
  const groups = colorGroupsFor(mode);
  if (!groups.length) return;
  const seeded = lookColors(P.phLook ?? P.stLook);
  // Mode-specific object / glow seeds that match today's palettes.
  if (mode === 'Crystal Temple') {
    seeded.colObject = '#182636';
    seeded.colGlow = '#7ef6ff';
    seeded.colBgTop = '#07070c';
    seeded.colBgBottom = '#000000';
    seeded.colFloor = '#c9a45a';
  } else if (mode === 'Jungle') {
    seeded.colObject = '#2aae9e';
  } else if (mode === 'City Vortex') {
    seeded.colGlow = '#ffc05e';
  } else if (mode === 'Stargate') {
    seeded.colGlow = '#7cb6ff';
    seeded.colBgTop = '#030018';
    seeded.colBgBottom = '#000000';
  }
  const allowed = new Set(groups.flatMap((g) => g.ctls.map((c) => c.key)));
  for (const [k, v] of Object.entries(seeded)) {
    if (allowed.has(k) && P[k] === undefined) P[k] = v;
  }
}

export function applyGroupPalette(P: Record<string, any>, groupId: ColorGroupId, name: string): boolean {
  const g = COLOR_GROUPS[groupId];
  const vals = g?.palettes[name];
  if (!vals) return false;
  Object.assign(P, vals);
  return true;
}

const OUTPUT_CTLS: Ctl[] = [
  S('exposure', 'Exposure', 0.2, 4),
  S('bloom', 'Bloom', 0, 2),
  S('phDof', 'Depth of Field', 0, 1),
];

/** Full control schema for a mode: its own panel, color groups, and shared output sliders. */
export type RemoteSection = { title: string; ctls: Ctl[]; palettes?: Record<string, Record<string, string | number>>; groupId?: string };
export function collectRemoteSchema(mode: string): RemoteSection[] {
  const sections: RemoteSection[] = [];
  const spec = MODE_CONTROLS[mode];
  if (spec) {
    for (const s of spec.sections) sections.push({ title: `${mode} · ${s.title}`, ctls: s.ctls });
  }
  for (const g of colorGroupsFor(mode)) {
    sections.push({ title: `Color · ${g.title}`, ctls: g.ctls, palettes: g.palettes, groupId: g.id });
  }
  sections.push({ title: 'Output', ctls: OUTPUT_CTLS });
  return sections;
}

export function schemaKeys(mode: string): string[] {
  const keys: string[] = [];
  for (const s of collectRemoteSchema(mode)) for (const c of s.ctls) keys.push(c.key);
  return [...new Set(keys)];
}

export function pickSchemaValues(P: Record<string, any>, mode: string): Record<string, any> {
  const out: Record<string, any> = { mode: P.mode, paused: P.paused };
  for (const k of schemaKeys(mode)) if (P[k] !== undefined) out[k] = P[k];
  return out;
}

/** Default assigned remote deck per mode — includes non-basic controls, not just bloom/exposure. */
export const DEFAULT_REMOTE_LAYOUT: Record<string, string[]> = {
  'Crystal Temple': ['ctLensFov', 'colFloor', 'ctZoom', 'ctDrift', 'ctLensAnim', 'phDof'],
  'Paint': ['phSpeed', 'colFloor', 'colObject', 'phGloss'],
  'Paint Pour': ['phSpeed', 'colFloor', 'colObject', 'phGloss'],
  'City Vortex': ['phFov', 'colKey', 'colGlow', 'phDof'],
  'Jungle': ['phFov', 'colObject', 'colBgTop', 'phDof'],
  'Stargate': ['phSpeed', 'colGlow', 'colBgTop', 'phStreak'],
  'Fabric': ['colFloor', 'colObject', 'phGloss', 'phIrid'],
  '3D Fractal': ['frCamFov', 'colObject', 'colGlow', 'phGloss'],
  'Bead Knot': ['colFloor', 'colObject', 'phGloss', 'phIrid'],
  'Mirror Mandala': ['colObject', 'colGlow', 'phGloss', 'mmFringe'],
  'Feather Vortex': ['colObject', 'phGloss', 'fvSpin', 'phDof'],
};

export function defaultRemoteLayout(mode: string): string[] {
  return (DEFAULT_REMOTE_LAYOUT[mode] ?? ['exposure', 'bloom']).slice();
}
