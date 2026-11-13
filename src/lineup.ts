// Visible mode lineup (pass 8). Retired modes keep their code; they leave menus, the
// preset gallery and the remote/phone UI. Old URLs and presets fall back to DEFAULT_MODE.
// Original MIT-licensed work for flow-engine.

/** First-load default: Jungle (motifs + forest floor) is the strongest locked-in scene. */
export const DEFAULT_MODE = 'Jungle';

/** Modes shown in the app menus, lil-gui, preset gallery and remote UI. */
export const LINEUP_MODES = [
  'Paint',
  'Paint Pour',
  'City Vortex',
  'Jungle',
  'Stargate',
  'Fabric',
  '3D Fractal',
  'Bead Knot',
  'Mirror Mandala',
  'Feather Vortex',
] as const;
export type LineupMode = (typeof LINEUP_MODES)[number];

/**
 * Modes recognized in URLs, recover snapshots and old presets, but hidden from the lineup.
 * Gravity is paused (code kept). Tunnel and Kaleido were already retired in pass 5.
 */
export const RETIRED_MODES = [
  'Gravity',
  'Tunnel',
  'Kaleido',
  'Landscape',
  'Morph',
  'Plasma',
  'Wall Studio',
  'MilkDrop',
  '3D fabric',
  'Liquid Spheres',
  'Particle Fabric',
  '2D flow',
  'Grass Field',
  '2D Fractal',
] as const;

/** Every real mode name the engine can still boot (lineup + retired). */
export const VALID_MODES: readonly string[] = [
  ...LINEUP_MODES,
  'Gravity',
  'Wall Studio',
  'Tunnel',
  'Kaleido',
  'Plasma',
  'Morph',
  'Landscape',
  'MilkDrop',
  '3D fabric',
  'Liquid Spheres',
  'Particle Fabric',
  '2D flow',
  'Grass Field',
  '2D Fractal',
];

/** Short / legacy query aliases. Aliases that resolve to a retired mode still fall back. */
export const MODE_ALIASES: Record<string, string> = {
  '2d': '2D flow',
  'particles': 'Particle Fabric',
  'spheres': 'Liquid Spheres',
  '3d': '3D fabric',
  'canyon': 'Landscape',
  'landscape': 'Landscape',
  'wall': 'Wall Studio',
  'studio': 'Wall Studio',
  'paintpour': 'Paint Pour',
  'paint-pour': 'Paint Pour',
  'pour': 'Paint Pour',
  'city': 'City Vortex',
  'fractal': '3D Fractal',
  '3d-fractal': '3D Fractal',
  'gravity': 'Gravity',
  'balls': 'Gravity',
  'bead': 'Bead Knot',
  'beadknot': 'Bead Knot',
  'knot': 'Bead Knot',
  'mandala': 'Mirror Mandala',
  'mirror': 'Mirror Mandala',
  'feather': 'Feather Vortex',
  'feathervortex': 'Feather Vortex',
};

export function isLineupMode(mode: string): boolean {
  return (LINEUP_MODES as readonly string[]).includes(mode);
}

export function isRetiredMode(mode: string): boolean {
  return (RETIRED_MODES as readonly string[]).includes(mode);
}

/**
 * Resolve a URL, preset or recover mode name.
 * Unknown names and retired modes fall back to DEFAULT_MODE with no throw.
 */
export function resolveMode(name: string | null | undefined, fallback = DEFAULT_MODE): string {
  if (name == null) return fallback;
  const raw = String(name).trim();
  if (!raw) return fallback;
  const lower = raw.toLowerCase();
  const aliased = MODE_ALIASES[lower];
  const resolved = aliased ?? VALID_MODES.find((m) => m.toLowerCase() === lower) ?? null;
  if (!resolved || isRetiredMode(resolved)) return fallback;
  return resolved;
}
