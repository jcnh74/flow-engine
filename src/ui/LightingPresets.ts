// Unified lighting and studio setups for 3D modes
export interface LightingRig {
  name: string;
  lights: Array<{
    on: boolean;
    type: 'directional' | 'spot' | 'point';
    az: number;
    el: number;
    dist: number;
    intensity: number;
    color: string;
    shadow: boolean;
    cone: number;
  }>;
  envIntensity: number;
  envRot: number;
  shadowSoft: number;
  shadowBias: number;
  ao: number;
  ssaoRadius: number;
  fog: number;
  toneMap: string;
}

export const LIGHTING_RIGS: Record<string, LightingRig> = {
  'Softbox': {
    name: 'Softbox',
    lights: [
      { on: true, type: 'directional', az: 45, el: 45, dist: 8, intensity: 1.2, color: '#ffffff', shadow: true, cone: 30 },
      { on: true, type: 'directional', az: -135, el: 30, dist: 8, intensity: 0.6, color: '#e8f4ff', shadow: false, cone: 30 },
      { on: true, type: 'directional', az: 0, el: -20, dist: 6, intensity: 0.3, color: '#fff8e8', shadow: false, cone: 30 },
      { on: false, type: 'point', az: 0, el: 0, dist: 5, intensity: 1, color: '#ffffff', shadow: false, cone: 30 },
    ],
    envIntensity: 0.8,
    envRot: 0,
    shadowSoft: 0.6,
    shadowBias: 0.003,
    ao: 0.8,
    ssaoRadius: 0.15,
    fog: 0.1,
    toneMap: 'Filmic (AgX-style)',
  },
  'Three-Point': {
    name: 'Three-Point',
    lights: [
      { on: true, type: 'directional', az: 45, el: 40, dist: 8, intensity: 1.8, color: '#ffffff', shadow: true, cone: 30 },
      { on: true, type: 'directional', az: -45, el: 35, dist: 8, intensity: 0.4, color: '#d4e4ff', shadow: false, cone: 30 },
      { on: true, type: 'directional', az: 180, el: 10, dist: 6, intensity: 1.2, color: '#ffe8d4', shadow: false, cone: 30 },
      { on: false, type: 'point', az: 0, el: 0, dist: 5, intensity: 1, color: '#ffffff', shadow: false, cone: 30 },
    ],
    envIntensity: 0.3,
    envRot: 0,
    shadowSoft: 0.8,
    shadowBias: 0.002,
    ao: 1.0,
    ssaoRadius: 0.2,
    fog: 0,
    toneMap: 'ACES',
  },
  'Rim Light': {
    name: 'Rim Light',
    lights: [
      { on: true, type: 'directional', az: 0, el: 30, dist: 8, intensity: 0.8, color: '#ffffff', shadow: true, cone: 30 },
      { on: true, type: 'directional', az: 135, el: 20, dist: 8, intensity: 2.5, color: '#ffd4ff', shadow: false, cone: 30 },
      { on: true, type: 'directional', az: -135, el: 20, dist: 8, intensity: 2.5, color: '#d4ffff', shadow: false, cone: 30 },
      { on: false, type: 'point', az: 0, el: 0, dist: 5, intensity: 1, color: '#ffffff', shadow: false, cone: 30 },
    ],
    envIntensity: 0.2,
    envRot: 0,
    shadowSoft: 0.4,
    shadowBias: 0.003,
    ao: 1.2,
    ssaoRadius: 0.25,
    fog: 0.05,
    toneMap: 'Filmic (AgX-style)',
  },
  'Club Strobe': {
    name: 'Club Strobe',
    lights: [
      { on: true, type: 'spot', az: 0, el: 80, dist: 6, intensity: 3.0, color: '#ff00ff', shadow: true, cone: 20 },
      { on: true, type: 'spot', az: 120, el: 75, dist: 6, intensity: 2.8, color: '#00ffff', shadow: false, cone: 25 },
      { on: true, type: 'spot', az: -120, el: 75, dist: 6, intensity: 2.8, color: '#ffff00', shadow: false, cone: 25 },
      { on: false, type: 'point', az: 0, el: 0, dist: 5, intensity: 1, color: '#ffffff', shadow: false, cone: 30 },
    ],
    envIntensity: 0.1,
    envRot: 0,
    shadowSoft: 0.2,
    shadowBias: 0.005,
    ao: 0.6,
    ssaoRadius: 0.1,
    fog: 0.3,
    toneMap: 'Exponential',
  },
  'Sunset': {
    name: 'Sunset',
    lights: [
      { on: true, type: 'directional', az: -60, el: 15, dist: 10, intensity: 2.5, color: '#ff6347', shadow: true, cone: 30 },
      { on: true, type: 'directional', az: 120, el: 60, dist: 8, intensity: 0.8, color: '#ffa07a', shadow: false, cone: 30 },
      { on: true, type: 'directional', az: 0, el: -10, dist: 6, intensity: 0.4, color: '#4169e1', shadow: false, cone: 30 },
      { on: false, type: 'point', az: 0, el: 0, dist: 5, intensity: 1, color: '#ffffff', shadow: false, cone: 30 },
    ],
    envIntensity: 1.2,
    envRot: -60,
    shadowSoft: 1.0,
    shadowBias: 0.001,
    ao: 0.7,
    ssaoRadius: 0.3,
    fog: 0.4,
    toneMap: 'ACES',
  },
};

// Apply a lighting rig to params
export function applyLightingRig(rig: LightingRig, params: any): void {
  // Apply light settings
  rig.lights.forEach((light, i) => {
    if (params.lights && params.lights[i]) {
      Object.assign(params.lights[i], light);
    }
  });
  
  // Apply environment and effects
  params.envIntensity = rig.envIntensity;
  params.envRot = rig.envRot;
  params.shadowSoft = rig.shadowSoft;
  params.shadowBias = rig.shadowBias;
  params.ao = rig.ao;
  params.ssaoRadius = rig.ssaoRadius;
  params.fog = rig.fog;
  params.toneMap = rig.toneMap;
}
