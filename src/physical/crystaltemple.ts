// Crystal Temple: a kaleidoscopic prism-ridge tunnel with a traveling axial pulse.
// Original MIT-licensed work for flow-engine. No Shadertoy code.
import type { PhysScene, PhysFrame, Vec3, FB } from './common';
import { compile, QUAD_VS, STUDIO_GLSL, PCF_GLSL, MsTarget, ShadowMap, setStudioEnv, lookOf, dirFromAzEl, srgbHex, lookAt, perspective, mul, norm, invert, fbo, deleteFB } from './common';

export const TEMPLE_PALETTES: Record<string, {
  body: string[]; gold: string[]; accent: string[]; tendril: string[];
  emit: string; pulse: string; fillA: string; fillB: string;
}> = {
  'Cyan Processional': {
    body: ['#0c121c', '#101820', '#141e2c', '#182636', '#0e1622', '#122030'],
    gold: ['#b08a40', '#c9a45a', '#8a6828', '#d4b46a'],
    accent: ['#3a1828', '#4a2038', '#5a2840', '#2a1424'],
    tendril: ['#121a28', '#182030', '#1c2838', '#141c2c'],
    emit: '#7ef6ff', pulse: '#e8ffff', fillA: '#c04880', fillB: '#c49848',
  },
  'Magenta Night': {
    body: ['#120c18', '#1a101e', '#221428', '#2a1830', '#160e1c', '#1c1224'],
    gold: ['#c070a0', '#d890b8', '#a05080', '#e8b0c8'],
    accent: ['#5a1840', '#6a2050', '#8a2870', '#3a1430'],
    tendril: ['#1a1020', '#221428', '#2a1830', '#160e1c'],
    emit: '#ff9ad8', pulse: '#ffe8ff', fillA: '#e040a0', fillB: '#e09050',
  },
  'Ice Temple': {
    body: ['#0c1218', '#101820', '#141e28', '#182430', '#0e161c', '#122028'],
    gold: ['#90a8b8', '#b8c8d8', '#708898', '#d0dce8'],
    accent: ['#1a3040', '#284858', '#305060', '#142838'],
    tendril: ['#101820', '#182028', '#1c2830', '#141c24'],
    emit: '#b8f6ff', pulse: '#f0ffff', fillA: '#5890c0', fillB: '#a0c0d8',
  },
  'Amber Sanctum': {
    body: ['#140e08', '#1c140c', '#24180e', '#2c1c10', '#18120a', '#20160c'],
    gold: ['#d09030', '#e8b050', '#b07018', '#f0c878'],
    accent: ['#5a200c', '#6a2810', '#8a3014', '#3a1808'],
    tendril: ['#1a120a', '#22160c', '#2a1a10', '#181008'],
    emit: '#ffe08a', pulse: '#fff4d0', fillA: '#d05020', fillB: '#e0a040',
  },
};

const SEG = 22;
const NSEG = 4;
const STRIDE = 16;
const MAX = 32000;
const MAX_STARS = 1600;

const fract = (x: number) => x - Math.floor(x);
const hash11 = (n: number) => fract(Math.sin(n * 19.19 + 7.13) * 51.7913);
const hash21 = (i: number, j: number) => hash11(i * 13.71 + j * 27.13 + 4.19);

function unitCube() {
  const F: Array<{ n: [number, number, number]; v: Array<[number, number, number]> }> = [
    { n: [0, 0, 1], v: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
    { n: [0, 0, -1], v: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]] },
    { n: [1, 0, 0], v: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]] },
    { n: [-1, 0, 0], v: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]] },
    { n: [0, 1, 0], v: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]] },
    { n: [0, -1, 0], v: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] },
  ];
  const pos: number[] = [], nrm: number[] = [], idx: number[] = [];
  for (const f of F) {
    const b = pos.length / 3;
    for (const p of f.v) { pos.push(p[0], p[1], p[2]); nrm.push(f.n[0], f.n[1], f.n[2]); }
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), idx: new Uint16Array(idx) };
}

type Pal = (typeof TEMPLE_PALETTES)[string];
type Box = {
  x: number; y: number; z: number; sx: number; sy: number; sz: number;
  r: number; g: number; b: number; ao: number; em: number; kind: number;
  tx: number; ty: number; tz: number;
};

function colOf(hexes: string[], i: number, j = 0): [number, number, number] {
  const c = srgbHex(hexes[Math.abs((i + j * 3) | 0) % hexes.length]);
  return [c[0], c[1], c[2]];
}

/** Shared per-block motion (spin, drift, cascade, echo). Used by color and shadow VS. */
const MOTION_GLSL = `
uniform float uTime, uAmp, uSpin, uPhase, uDrift, uSpread, uCascade;
vec3 rotAxis(vec3 v, vec3 ax, float a){
  float c = cos(a), s = sin(a);
  return v * c + cross(ax, v) * s + ax * dot(ax, v) * (1.0 - c);
}
void orientYP(float yaw, float pitch, inout vec3 loc, inout vec3 n){
  float cy = cos(yaw), sy = sin(yaw), cp = cos(pitch), sp = sin(pitch);
  vec3 l = loc;
  loc = vec3(cy * l.x + sy * l.z, l.y, -sy * l.x + cy * l.z);
  loc = vec3(loc.x, cp * loc.y - sp * loc.z, sp * loc.y + cp * loc.z);
  vec3 m = n;
  n = vec3(cy * m.x + sy * m.z, m.y, -sy * m.x + cy * m.z);
  n = vec3(n.x, cp * n.y - sp * n.z, sp * n.y + cp * n.z);
}
`;

const VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in vec4 aA;
layout(location=3) in vec4 aB;
layout(location=4) in vec4 aC;
layout(location=5) in vec4 aD;
uniform mat4 uVP;
${MOTION_GLSL}
out vec3 vP, vN, vCol, vT;
out float vAo, vEm, vKind, vFade, vPlate;
void main(){
  float seed = aA.w;
  vec3 loc = aPos * aB.xyz;
  vec3 ns = aNrm / max(aB.xyz, vec3(1e-3));
  if (abs(aD.z) + abs(aD.w) > 1e-5) orientYP(aD.z, aD.w, loc, ns);
  float casc = sin(uTime * uCascade * 2.15 - aA.z * 0.58 + seed * 6.2831);
  float ph = seed * 6.2831 * uPhase + casc * 0.85 * uPhase;
  vec3 ax = normalize(vec3(sin(seed * 19.19), 0.40 + 0.60 * cos(seed * 7.13), sin(seed * 13.71)));
  float ang = uTime * uSpin * (0.65 + 1.05 * seed) * 1.85 + ph + casc * 0.55;
  loc = rotAxis(loc, ax, ang);
  ns = rotAxis(ns, ax, ang);
  vec3 drift = vec3(
    sin(uTime * 0.71 + ph) * 0.13,
    sin(uTime * 0.53 + ph * 1.27) * 0.08,
    sin(uTime * 0.41 + ph * 0.73) * 0.11
  ) * uDrift * (1.0 + 0.35 * casc);
  float fade = 1.0;
  vec3 eoff = vec3(0.0);
  if (aD.y > 0.5) {
    float life = fract(uTime * 0.17 * (0.75 + 0.5 * seed) + seed + aD.y * 0.29);
    float split = sin(life * 3.14159265);
    vec3 dir = normalize(vec3(cos(seed * 8.13), sin(seed * 5.27) * 0.7, sin(seed * 3.71)));
    eoff = dir * uSpread * aD.y * split * 0.55;
    fade = mix(0.12, 0.72, max(split, 0.0));
    loc *= mix(0.62, 0.95, max(split, 0.0));
  }
  vec3 knock = vec3(casc * 0.07 * (0.4 + abs(aA.x) * 0.15), casc * 0.045, 0.0) * uCascade;
  // tendrils keep a little extra sway
  if (aD.x > 1.5 && aD.x < 2.5) {
    drift.x += sin(uTime * 0.62 + aA.z * 0.41) * uAmp * 0.08;
    drift.y += sin(uTime * 0.48 + aA.z * 0.33) * uAmp * 0.06;
  }
  vec3 wp = aA.xyz + loc + drift + eoff + knock;
  vec3 wn = normalize(ns);
  vec3 t0 = abs(wn.y) < 0.9 ? vec3(1,0,0) : vec3(0,0,1);
  t0 = normalize(t0 - wn * dot(t0, wn));
  vP = wp; vN = wn; vT = t0; vCol = aC.rgb * fade; vAo = aB.w; vEm = aC.w * fade; vKind = aD.x;
  vFade = fade; vPlate = aB.x;
  gl_Position = uVP * vec4(wp, 1.0);
}`;

const SH_VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=2) in vec4 aA;
layout(location=3) in vec4 aB;
layout(location=5) in vec4 aD;
uniform mat4 uVP;
${MOTION_GLSL}
void main(){
  float seed = aA.w;
  vec3 loc = aPos * aB.xyz;
  vec3 dummy = vec3(0.0);
  if (abs(aD.z) + abs(aD.w) > 1e-5) orientYP(aD.z, aD.w, loc, dummy);
  float casc = sin(uTime * uCascade * 2.15 - aA.z * 0.58 + seed * 6.2831);
  float ph = seed * 6.2831 * uPhase + casc * 0.85 * uPhase;
  vec3 ax = normalize(vec3(sin(seed * 19.19), 0.40 + 0.60 * cos(seed * 7.13), sin(seed * 13.71)));
  float ang = uTime * uSpin * (0.65 + 1.05 * seed) * 1.85 + ph + casc * 0.55;
  loc = rotAxis(loc, ax, ang);
  vec3 drift = vec3(
    sin(uTime * 0.71 + ph) * 0.13,
    sin(uTime * 0.53 + ph * 1.27) * 0.08,
    sin(uTime * 0.41 + ph * 0.73) * 0.11
  ) * uDrift * (1.0 + 0.35 * casc);
  vec3 eoff = vec3(0.0);
  if (aD.y > 0.5) {
    float life = fract(uTime * 0.17 * (0.75 + 0.5 * seed) + seed + aD.y * 0.29);
    float split = sin(life * 3.14159265);
    vec3 dir = normalize(vec3(cos(seed * 8.13), sin(seed * 5.27) * 0.7, sin(seed * 3.71)));
    eoff = dir * uSpread * aD.y * split * 0.55;
    loc *= mix(0.62, 0.95, max(split, 0.0));
  }
  vec3 knock = vec3(casc * 0.07 * (0.4 + abs(aA.x) * 0.15), casc * 0.045, 0.0) * uCascade;
  if (aD.x > 1.5 && aD.x < 2.5) {
    drift.x += sin(uTime * 0.62 + aA.z * 0.41) * uAmp * 0.08;
    drift.y += sin(uTime * 0.48 + aA.z * 0.33) * uAmp * 0.06;
  }
  vec3 wp = aA.xyz + loc + drift + eoff + knock;
  gl_Position = uVP * vec4(wp, 1.0);
}`;
const SH_FS = `#version 300 es
void main(){}`;

const FS = `#version 300 es
precision highp float;
in vec3 vP, vN, vCol, vT;
in float vAo, vEm, vKind, vFade, vPlate;
uniform vec3 uCamPos, uPulsePos, uPulseCol, uFillA, uFillB, uGold;
uniform float uGloss, uIrid, uAniso, uPulseI, uFog;
out vec4 o;
${STUDIO_GLSL}
${PCF_GLSL}
float D_GGX_aniso(float Th, float Bh, float Nh, float ax, float ay){
  float d = Th*Th/(ax*ax) + Bh*Bh/(ay*ay) + Nh*Nh;
  return 1.0 / max(PI * ax * ay * d * d, 1e-6);
}
float V_Smith_aniso(float Tv, float Bv, float Tl, float Bl, float Nv, float Nl, float ax, float ay){
  float lv = Nl * length(vec3(ax*Tv, ay*Bv, Nv));
  float vv = Nv * length(vec3(ax*Tl, ay*Bl, Nl));
  return 0.5 / max(lv + vv, 1e-5);
}
void main(){
  vec3 N = normalize(vN);
  vec3 V = normalize(uCamPos - vP);
  vec3 T = normalize(vT - N * dot(vT, N));
  vec3 B = cross(N, T);
  vec3 albedo = vCol;
  if (vKind < 0.5 && N.y > 0.65) albedo = mix(albedo, uGold, 0.55);
  float distP = length(uPulsePos - vP);
  float prox = exp(-distP * distP * 0.055);
  albedo = mix(albedo, mix(uGold, uPulseCol, 0.5), prox * uPulseI * 0.38);
  float rough = mix(0.20, 0.06, clamp(uGloss * 0.6, 0.0, 1.0));
  if (vKind > 1.5 && vKind < 2.5) rough = mix(rough, 0.26, 0.45);
  float ax = rough * (1.0 + uAniso * 3.6);
  float ay = max(rough / (1.0 + uAniso * 2.8), 0.035);
  vec3 f0 = mix(vec3(0.18, 0.20, 0.22), vec3(0.72, 0.62, 0.38), vKind > 0.5 && vKind < 1.5 ? 1.0 : 0.12);
  f0 = mix(f0, vec3(0.45, 0.7, 0.78), clamp(uIrid, 0.0, 1.0) * 0.35);
  float sh = shadowAt(vP, N);
  float ao = clamp(vAo, 0.25, 1.0);
  float side = abs(N.x);
  vec3 Lvec = uPulsePos - vP;
  float ld = max(length(Lvec), 1e-3);
  vec3 L = Lvec / ld;
  float att = uPulseI * 0.95 / (1.0 + ld * ld * 0.26);
  float nl = max(dot(N, L), 0.0);
  vec3 H = normalize(L + V);
  float nv = max(dot(N, V), 1e-3);
  float nh = max(dot(N, H), 0.0);
  vec3 spec = D_GGX_aniso(dot(T,H), dot(B,H), nh, ax, ay)
            * V_Smith_aniso(dot(T,V), dot(B,V), dot(T,L), dot(B,L), nv, nl, ax, ay)
            * F_Schlick(f0, max(dot(H,V), 0.0)) * nl * uPulseCol * att * sh;
  // long terrace plates get glossy horizontal streaks; small wall cubes stay dim
  float plate = (vKind < 1.5 && abs(N.y) > 0.4) ? smoothstep(0.12, 0.40, vPlate) : 0.0;
  plate = max(plate, (vKind < 0.5 && abs(N.z) > 0.5) ? smoothstep(0.18, 0.5, vPlate) * 0.45 : 0.0);
  spec = min(spec * mix(0.05, 0.70, plate), mix(vec3(0.07), vec3(0.85), plate));
  vec3 Lk = normalize(vec3(0.15, 0.7, 0.5));
  float wrap = 0.22 + 0.78 * max(dot(N, Lk), 0.0);
  vec3 col = albedo * (0.42 + 0.40 * ao) * wrap;
  col *= 1.0 + uFillA * (0.08 * side + 0.04) + uFillB * 0.07 * max(N.y, 0.0);
  col += albedo * att * mix(0.18, 0.70, nl) * sh;
  col += spec;
  col += uPulseCol * vEm * (0.28 + 0.55 * prox) * (0.55 + 0.5 * uPulseI);
  col *= 1.0 + prox * uPulseI * 0.32;
  float edge = pow(1.0 - nv, 2.2) * 0.10 * (0.4 + 0.6 * uPulseI);
  col += mix(uPulseCol, uFillA, 0.2) * edge * (0.4 + 0.5 * prox);
  float fog = 1.0 - exp(-max(length(vP - uCamPos) - 4.0, 0.0) * uFog);
  col = mix(col, vec3(0.0), clamp(fog, 0.0, 1.0));
  col *= vFade;
  col = min(col, vec3(6.0));
  o = vec4(col, 1.0);
}`;

const BACK_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform mat4 uInvVP;
uniform vec3 uCamPos, uPulseCol;
uniform float uTime, uCamZ;
out vec4 o;
float h13(vec3 p){
  return fract(sin(dot(p, vec3(19.19, 7.13, 13.71))) * 51.7913);
}
void main(){
  vec4 h = uInvVP * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
  vec3 rd = normalize(h.xyz / h.w - uCamPos);
  vec3 col = vec3(0.0);
  vec3 d = rd * 90.0 + vec3(0.0, 0.0, uCamZ * 0.035);
  float n = h13(floor(d));
  float spark = smoothstep(0.992, 0.999, n);
  spark *= spark;
  float tw = 0.65 + 0.35 * sin(uTime * (2.0 + h13(floor(d) + 2.7)) + n * 20.0);
  col += vec3(0.85, 0.92, 1.0) * spark * tw * 1.4;
  float n2 = h13(floor(d * 0.47) + 9.1);
  col += vec3(1.0, 0.92, 0.8) * smoothstep(0.996, 0.9995, n2) * 0.7;
  col += uPulseCol * 0.018 * pow(max(rd.z, 0.0), 8.0);
  o = vec4(col, 1000.0);
}`;

const STAR_VS = `#version 300 es
layout(location=0) in vec3 aPos;
uniform mat4 uVP;
uniform float uCamZ, uPeriod;
out float vB;
void main(){
  float z = aPos.z;
  float p = uPeriod;
  z = z - p * floor((z - (uCamZ - p * 0.5)) / p);
  vec3 wp = vec3(aPos.x, aPos.y, z);
  vB = 0.45 + 0.55 * fract(sin(dot(aPos, vec3(7.13, 13.71, 19.19))) * 51.7913);
  gl_Position = uVP * vec4(wp, 1.0);
  gl_PointSize = mix(1.2, 2.6, vB);
}`;
const STAR_FS = `#version 300 es
precision highp float;
in float vB;
out vec4 o;
void main(){
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d = dot(p, p);
  if (d > 1.0) discard;
  float a = exp(-d * 3.2) * vB;
  o = vec4(vec3(0.85, 0.92, 1.0) * a, 1.0);
}`;

/** Barrel / fisheye post (Brown–Conrady). Chromatic fringe at the edges, optional breathe. */
const FISH_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
uniform float uFish, uTime, uBreathe, uAspect;
out vec4 o;
vec2 distort(vec2 p, float k, float k2){
  float r2 = dot(p, p);
  return p * (1.0 + k * r2 + k2 * r2 * r2);
}
void main(){
  vec2 uv = vUv * 2.0 - 1.0;
  float br = 1.0 + uBreathe * 0.16 * sin(uTime * 0.65);
  vec2 wob = uBreathe * 0.035 * vec2(sin(uTime * 0.43), cos(uTime * 0.37));
  uv -= wob;
  float amt = max(uFish, 0.0) * br;
  if (amt < 0.001) {
    o = texture(uTex, vUv);
    return;
  }
  float k = amt * 0.52;
  float k2 = amt * 0.18;
  // zoom so mid-edges stay in-source and the bent image fills the 16:9 frame
  float zm = mix(1.0, 0.62, clamp(amt / 2.2, 0.0, 1.0));
  uv *= zm;
  vec2 pr = distort(uv, k * 1.10, k2);
  vec2 pg = distort(uv, k, k2);
  vec2 pb = distort(uv, k * 0.90, k2);
  pr = pr * 0.5 + 0.5; pg = pg * 0.5 + 0.5; pb = pb * 0.5 + 0.5;
  vec3 col = vec3(
    texture(uTex, clamp(pr, 0.0, 1.0)).r,
    texture(uTex, clamp(pg, 0.0, 1.0)).g,
    texture(uTex, clamp(pb, 0.0, 1.0)).b
  );
  float r = length(uv / zm);
  float vig = 1.0 - smoothstep(0.78, 1.18, r);
  col *= mix(1.0, vig, clamp(amt * 0.28, 0.0, 1.0));
  o = vec4(col, 1.0);
}`;

function buildPeriod(pal: Pal, density: number, amp: number): Box[] {
  const body = pal.body, gold = pal.gold, accent = pal.accent, tendril = pal.tendril;
  const emitC = srgbHex(pal.emit);
  const out: Box[] = [];
  const AXIS = 1.15;
  const push = (
    x: number, y: number, z: number, sx: number, sy: number, sz: number,
    rgb: [number, number, number], ao: number, em: number, kind: number,
    tx = 0, ty = 0, tz = 1,
  ) => {
    if (sx < 0.016 || sy < 0.01 || sz < 0.016) return;
    out.push({ x, y: y - AXIS, z, sx, sy, sz, r: rgb[0], g: rgb[1], b: rgb[2], ao, em, kind, tx, ty, tz });
  };
  const den = Math.max(0.5, Math.min(1.8, density));
  const nZ = Math.round(18 * den);
  const aisle = 0.52;

  // Lit nave walkway so the aisle is a path, not a dark hole. Center strip is not mirrored.
  for (let zi = 0; zi < nZ; zi++) {
    const z = (zi + 0.5) * (SEG / nZ);
    const slatW = 0.14 + 0.08 * hash21(zi, 2);
    push(slatW * 0.5 + 0.06, -0.30, z, slatW * 0.48, 0.035, 0.28 + 0.12 * hash21(zi, 4), colOf(body, zi, 9), 0.7, 0, 0);
    if (hash21(zi, 6) > 0.4) {
      push(slatW * 0.5 + 0.06, -0.26, z, slatW * 0.44, 0.011, 0.26, colOf(gold, zi, 1), 0.9, 0.06, 1);
    }
    if (zi % 2 === 0) {
      push(0.0, -0.285, z, 0.055, 0.028, 0.16, [emitC[0], emitC[1], emitC[2]], 1, 0.55, 3);
    }
  }

  // Floor banks: smaller, more size variety.
  for (let zi = 0; zi < nZ; zi++) {
    const z = (zi + 0.5) * (SEG / nZ);
    const h = hash21(zi, 3);
    const layers = 2 + ((h * 3 * den) | 0);
    const plateH = 0.036 + 0.028 * hash21(zi, 8);
    const zJitter = (hash21(zi, 11) - 0.5) * 0.10;
    let x = aisle + 0.02;
    let k = 0;
    const xMax = 3.5 + 0.5 * hash21(zi, 14);
    while (x < xMax && k < 14) {
      const w = 0.22 + 0.50 * hash21(zi, k + 20);
      const d = 0.16 + 0.38 * hash21(zi, k + 40);
      for (let ly = 0; ly < layers; ly++) {
        const y = -0.22 + ly * (plateH * 2 * 1.08);
        const rgb = colOf(body, zi + ly, k);
        const ao = 0.55 + 0.35 * (ly / Math.max(layers - 1, 1));
        push(x + w * 0.5, y, z + zJitter, w * 0.48, plateH, d * 0.48, rgb, ao, 0, 0);
        if (ly === layers - 1 && hash21(zi, k + 60) > 0.22) {
          push(x + w * 0.5, y + plateH + 0.01, z + zJitter, w * 0.46, 0.012, d * 0.46, colOf(gold, zi, k), 0.9, 0.06, 1);
        }
      }
      x += w + 0.02;
      k++;
    }
    if (zi % Math.max(1, Math.round(2 / den)) === 0) {
      push(aisle + 0.08, 0.00, z, 0.045, 0.035, 0.05, [emitC[0], emitC[1], emitC[2]], 1, 0.5, 3);
    }
  }

  // Ceiling plates.
  for (let zi = 0; zi < nZ; zi++) {
    const z = (zi + 0.35) * (SEG / nZ);
    const h = hash21(zi, 90);
    const layers = 2 + ((h * 3 * den) | 0);
    const plateH = 0.034 + 0.022 * hash21(zi, 91);
    let x = aisle + 0.12 + 0.35 * hash21(zi, 92);
    let k = 0;
    while (x < 3.3 && k < 12) {
      const w = 0.26 + 0.55 * hash21(zi, k + 100);
      const d = 0.18 + 0.34 * hash21(zi, k + 110);
      for (let ly = 0; ly < layers; ly++) {
        const y = 3.15 - ly * (plateH * 2 * 1.1);
        push(x + w * 0.5, y, z, w * 0.48, plateH, d * 0.48, colOf(body, zi + 17 + ly, k), 0.6 + 0.3 * (1 - ly / Math.max(layers, 1)), 0, 0);
        if (ly === 0 && hash21(zi, k + 120) > 0.32) {
          push(x + w * 0.5, y + plateH + 0.01, z, w * 0.45, 0.011, d * 0.45, colOf(gold, zi, k + 2), 0.9, 0.04, 1);
        }
      }
      x += w + 0.025;
      k++;
    }
  }

  const gateAt = (gateZ: number, scale: number, seed: number) => {
    const layers = Math.round(8 * Math.min(1.4, den) * scale);
    for (let i = 0; i < layers; i++) {
      const inset = i * 0.22 * scale;
      const z = gateZ + i * 0.32 * scale;
      const halfW = (1.45 - inset * 0.28) * scale + 0.15;
      const y0 = 0.12 + inset * 0.12;
      const y1 = (2.85 - inset * 0.22) * (0.88 + 0.12 * scale);
      const thick = 0.14 * scale;
      const lintelLayers = 2 + ((hash21(seed, i) * 2) | 0);
      for (let ly = 0; ly < lintelLayers; ly++) {
        const yh = y1 + 0.08 + ly * 0.11;
        const span = halfW + 0.45 + 0.15 * ly;
        push(span * 0.5, yh, z, span * 0.5, 0.045, thick, colOf(body, seed + i, ly), 0.7, 0, 0);
        if (ly === lintelLayers - 1) {
          push(span * 0.5, yh + 0.055, z, span * 0.48, 0.012, thick * 0.92, colOf(gold, seed, i), 0.95, 0.1, 1);
        }
      }
      push(halfW * 0.55, y0 - 0.04, z, halfW * 0.55, 0.042, thick, colOf(body, seed + 3, i), 0.55, 0, 0);
      push(halfW * 0.55, y0 + 0.02, z, halfW * 0.52, 0.011, thick * 0.9, colOf(gold, seed + 1, i), 0.85, 0.18, 1);
      push(halfW * 0.55, y0 + 0.07, z + thick * 0.55, halfW * 0.5, 0.014, 0.028, [emitC[0], emitC[1], emitC[2]], 1, 0.7, 3);
      push(halfW * 0.55, y1 - 0.04, z + thick * 0.55, halfW * 0.5, 0.014, 0.028, [emitC[0], emitC[1], emitC[2]], 1, 0.55, 3);
      const jambX = halfW + 0.18;
      const nJ = Math.round(6 * den);
      for (let j = 0; j < nJ; j++) {
        const t = j / Math.max(nJ - 1, 1);
        const y = y0 + 0.1 + t * (y1 - y0 - 0.1);
        const jw = 0.10 + 0.12 * hash21(seed + i, j);
        const jh = 0.06 + 0.05 * hash21(seed + i, j + 4);
        push(jambX, y, z, jw, jh, thick * 0.9, colOf(body, seed + i, j + 8), 0.65, 0, 0);
      }
      push(halfW + 0.04, (y0 + y1) * 0.5, z + thick * 0.5, 0.018, (y1 - y0) * 0.42, 0.022, [emitC[0], emitC[1], emitC[2]], 1, 0.4, 3);
    }
    const pipes = Math.round(8 * den);
    for (let p = 0; p < pipes; p++) {
      const x = 3.15 * scale + p * 0.26;
      const nStack = 7 + ((hash21(seed, p + 40) * 6 * den) | 0);
      const z0 = gateZ - 0.4 + hash21(seed, p) * 1.2;
      for (let s = 0; s < nStack; s++) {
        const y = 0.15 + s * 0.18;
        const sx = 0.07 + 0.08 * hash21(seed, p + s);
        const sz = 0.08 + 0.09 * hash21(seed, p + s + 9);
        const rgb = hash21(seed, p + s) > 0.8 ? colOf(accent, p, s) : colOf(body, seed + p, s);
        push(x, y, z0 + (hash21(seed, s) - 0.5) * 0.18, sx, 0.08, sz, rgb, 0.5 + 0.4 * (s / nStack), 0, 0);
        if (s === nStack - 1) push(x, y + 0.09, z0, sx * 0.9, 0.011, sz * 0.9, colOf(gold, p, s), 0.9, 0.05, 1);
      }
    }
  };
  gateAt(3.2, 1.0, 1);
  gateAt(13.4, 0.88, 17);

  const nCliff = Math.round(16 * den);
  for (let i = 0; i < nCliff; i++) {
    const z = (i + 0.5) * (SEG / nCliff);
    const x0 = 4.15 + 0.7 * hash21(i, 200);
    const h = 1.4 + 2.2 * hash21(i, 201);
    const nS = Math.round(h / 0.16);
    for (let s = 0; s < nS; s++) {
      const y = 0.1 + s * 0.16;
      const rgb = hash21(i, s + 210) > 0.84 ? colOf(accent, i, s) : colOf(body, i + 30, s);
      push(x0 + (hash21(i, s) - 0.5) * 0.32, y, z, 0.09 + 0.10 * hash21(i, s + 3), 0.07, 0.09 + 0.10 * hash21(i, s + 7), rgb, 0.5 + 0.35 * (s / nS), 0, 0);
    }
  }

  // Curving organic tendril arms: elongated segments oriented along a smooth curve.
  const nRib = 3;
  const nStep = Math.round(70 * den);
  for (let r = 0; r < nRib; r++) {
    const phase = r * 1.7 + 0.3;
    const freq = 1.05 + r * 0.32;
    const yBase = 0.75 + r * 0.42;
    const xBase = 2.35 + r * 0.45;
    const pts: Array<{ x: number; y: number; z: number }> = [];
    for (let i = 0; i <= nStep; i++) {
      const u = i / nStep;
      const z = u * SEG;
      const w1 = Math.sin(u * Math.PI * 2 * freq + phase);
      const w2 = Math.sin(u * Math.PI * 2 * (freq * 1.7) + phase * 1.3);
      const w3 = Math.sin(u * Math.PI * 2 * 0.7 + phase * 0.6);
      pts.push({
        x: xBase + amp * (0.95 * w1 + 0.35 * w2),
        y: yBase + amp * (1.05 * Math.sin(u * Math.PI * 2 * 1.15 + phase + 0.4) + 0.35 * w3),
        z,
      });
    }
    for (let i = 0; i < nStep; i++) {
      const a = pts[i], b = pts[i + 1];
      const tx = b.x - a.x, ty = b.y - a.y, tz = b.z - a.z;
      const len = Math.hypot(tx, ty, tz) || 1;
      const u = i / nStep;
      const taper = 0.55 + 0.45 * Math.sin(u * Math.PI);
      const rad = (0.045 + 0.03 * hash21(r, i) + (r === 0 ? 0.015 : 0)) * taper;
      const rgb = colOf(tendril, r, i);
      push((a.x + b.x) * 0.5, (a.y + b.y) * 0.5 + AXIS, (a.z + b.z) * 0.5, rad, rad, len * 0.55, rgb, 0.8, 0.05, 2, tx / len, ty / len, tz / len);
    }
  }
  return out;
}

function expand(base: Box[], mirror: boolean, fold: number): Box[] {
  const f = Math.max(2, Math.min(8, fold | 0));
  const mid: Box[] = [];
  for (const b of base) {
    mid.push(b);
    if (mirror && f <= 2 && Math.abs(b.x) > 0.02) mid.push({ ...b, x: -b.x, tx: -b.tx });
    if (!mirror && f <= 2 && Math.abs(b.x) > 0.02) {
      const jx = (hash11(b.z * 3.1 + b.y * 5.7) - 0.5) * 0.18;
      const jy = (hash11(b.z * 2.7 + b.x * 4.3) - 0.5) * 0.08;
      mid.push({ ...b, x: -b.x + jx, y: b.y + jy, tx: -b.tx });
    }
  }
  if (f <= 2) return mid;
  const span = Math.PI * 2 / f;
  const start = -Math.PI / 2;
  const wedge: Box[] = [];
  for (const b of mid) {
    let a = Math.atan2(b.y, b.x) - start;
    while (a < 0) a += Math.PI * 2;
    while (a >= Math.PI * 2) a -= Math.PI * 2;
    if (a <= span + 0.1) wedge.push(b);
  }
  const out: Box[] = [];
  for (const b of wedge) {
    for (let k = 0; k < f; k++) {
      const ang = k * span;
      const c = Math.cos(ang), s = Math.sin(ang);
      out.push({
        ...b,
        x: c * b.x - s * b.y,
        y: s * b.x + c * b.y,
        tx: c * b.tx - s * b.ty,
        ty: s * b.tx + c * b.ty,
      });
    }
  }
  return out;
}

function yawPitch(tx: number, ty: number, tz: number): [number, number] {
  const h = Math.hypot(tx, tz);
  return [Math.atan2(tx, tz), -Math.atan2(ty, Math.max(h, 1e-6))];
}

function pack(boxes: Box[], startZ: number, nSeg: number, echo: number, buf: Float32Array): number {
  let n = 0;
  const echos = Math.max(0, Math.min(3, echo | 0));
  for (let s = 0; s < nSeg; s++) {
    const zOff = startZ + s * SEG;
    for (const b of boxes) {
      const [yaw, pitch] = (b.kind > 1.5 && b.kind < 2.5) ? yawPitch(b.tx, b.ty, b.tz) : [0, 0];
      const seed = hash11(b.x * 13.71 + b.y * 7.13 + (b.z + zOff) * 19.19);
      for (let ei = 0; ei <= echos; ei++) {
        if (n >= MAX) return n;
        const o = n * STRIDE;
        buf[o] = b.x; buf[o + 1] = b.y; buf[o + 2] = b.z + zOff; buf[o + 3] = seed;
        buf[o + 4] = b.sx; buf[o + 5] = b.sy; buf[o + 6] = b.sz; buf[o + 7] = b.ao;
        buf[o + 8] = b.r; buf[o + 9] = b.g; buf[o + 10] = b.b; buf[o + 11] = b.em;
        buf[o + 12] = b.kind; buf[o + 13] = ei; buf[o + 14] = yaw; buf[o + 15] = pitch;
        n++;
      }
    }
  }
  return n;
}

function makeStars(): Float32Array {
  const p = new Float32Array(MAX_STARS * 3);
  for (let i = 0; i < MAX_STARS; i++) {
    const a = hash11(i * 1.17 + 2.3) * Math.PI * 2;
    const r = 4.5 + hash11(i * 2.41 + 0.7) * 10.0;
    const y = (hash11(i * 3.11 + 4.9) - 0.5) * 14.0;
    p[i * 3] = Math.cos(a) * r;
    p[i * 3 + 1] = y;
    p[i * 3 + 2] = hash11(i * 4.27 + 8.1) * SEG * NSEG;
  }
  return p;
}

export class CrystalTempleScene implements PhysScene {
  name = 'Crystal Temple'; ready = true; error: string | null = null; stats: Record<string, any> = {};
  private p: ReturnType<typeof compile>; private sh: ReturnType<typeof compile>;
  private back: ReturnType<typeof compile>; private star: ReturnType<typeof compile>;
  private fish: ReturnType<typeof compile>;
  private vao: WebGLVertexArrayObject; private starVao: WebGLVertexArrayObject;
  private instBuf: WebGLBuffer; private nIdx: number; private nInst = 0;
  private ms: MsTarget; private sm: ShadowMap; private fishFb: FB | null = null; private t = 0;
  private buf = new Float32Array(MAX * STRIDE);
  private key = '';
  constructor(private gl: WebGL2RenderingContext) {
    const g = unitCube();
    this.nIdx = g.idx.length;
    this.vao = gl.createVertexArray()!; gl.bindVertexArray(this.vao);
    const pb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, pb); gl.bufferData(gl.ARRAY_BUFFER, g.pos, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    const nb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, nb); gl.bufferData(gl.ARRAY_BUFFER, g.nrm, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, g.idx, gl.STATIC_DRAW);
    this.instBuf = gl.createBuffer()!; gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.buf.byteLength, gl.DYNAMIC_DRAW);
    const stride = STRIDE * 4;
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, stride, 0); gl.vertexAttribDivisor(2, 1);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, stride, 16); gl.vertexAttribDivisor(3, 1);
    gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 4, gl.FLOAT, false, stride, 32); gl.vertexAttribDivisor(4, 1);
    gl.enableVertexAttribArray(5); gl.vertexAttribPointer(5, 4, gl.FLOAT, false, stride, 48); gl.vertexAttribDivisor(5, 1);
    gl.bindVertexArray(null);
    this.starVao = gl.createVertexArray()!; gl.bindVertexArray(this.starVao);
    const sb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, sb); gl.bufferData(gl.ARRAY_BUFFER, makeStars(), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this.p = compile(gl, VS, FS, 'crystaltemple');
    this.sh = compile(gl, SH_VS, SH_FS, 'crystaltemple-shadow');
    this.back = compile(gl, QUAD_VS, BACK_FS, 'crystaltemple-back');
    this.star = compile(gl, STAR_VS, STAR_FS, 'crystaltemple-stars');
    this.fish = compile(gl, QUAD_VS, FISH_FS, 'crystaltemple-fisheye');
    this.ms = new MsTarget(gl, 4); this.sm = new ShadowMap(gl, 2048);
  }
  load() { this.ready = true; }
  private rebuild(P: Record<string, any>) {
    const palName = P.ctPalette ?? 'Cyan Processional';
    const pal = TEMPLE_PALETTES[palName] ?? TEMPLE_PALETTES['Cyan Processional'];
    const density = P.ctDensity ?? 1;
    const amp = P.ctAmp ?? 1;
    const mirror = P.ctMirror !== false && P.ctMirror !== 0;
    const fold = Number(P.ctFold ?? 2);
    const echo = Math.max(0, Math.min(3, Math.round(Number(P.ctEcho ?? 1))));
    const key = `${palName}|${density}|${amp}|${mirror}|${fold}|${echo}`;
    if (key === this.key) return pal;
    this.key = key;
    const base = buildPeriod(pal, density, amp);
    const one = expand(base, mirror, fold);
    const copies = 1 + echo;
    const segs = Math.max(3, Math.min(NSEG, Math.floor(MAX / Math.max(one.length * copies, 1))));
    this.nInst = pack(one, 0, segs, echo, this.buf);
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.buf.subarray(0, this.nInst * STRIDE));
    return pal;
  }
  private motionU(prog: ReturnType<typeof compile>, P: Record<string, any>, t: number) {
    const gl = this.gl;
    const u = prog.u;
    gl.uniform1f(u.uTime, t);
    gl.uniform1f(u.uAmp, P.ctAmp ?? 1);
    gl.uniform1f(u.uSpin, P.ctBlockSpin ?? 1);
    gl.uniform1f(u.uPhase, P.ctPhase ?? 1);
    gl.uniform1f(u.uDrift, P.ctDrift ?? 1);
    gl.uniform1f(u.uSpread, P.ctSpread ?? 1);
    gl.uniform1f(u.uCascade, P.ctCascade ?? 1);
  }
  render(f: PhysFrame) {
    const gl = this.gl; const P = f.params as Record<string, any>;
    if (!P.paused) this.t += Math.min(0.1, f.dt) * (P.speed ?? 1) * (P.ctSpeed ?? 1);
    const t = this.t;
    const pal = this.rebuild(P);
    const fold = Number(P.ctFold ?? 2);
    const speed = 4.0;
    const worldPeriod = SEG;
    const camZ = t * speed;
    const axis = fold >= 4 ? 0 : 0.12;
    const eye: Vec3 = [0, axis, camZ];
    const tgt: Vec3 = [0, fold >= 4 ? 0 : -0.08, camZ + 8];
    const fov = (P.fov ?? 74) * Math.PI / 180;
    const view = lookAt(eye, tgt);
    const proj = perspective(fov, f.aspect, 0.12, 80);
    const vp = mul(proj, view);

    const pulseRate = P.ctPulseRate ?? 1;
    const pulseI = P.ctPulse ?? 1;
    const pulseZ = camZ + 7.0 - worldPeriod * ((t * pulseRate * 0.22) - Math.floor(t * pulseRate * 0.22));
    const pulsePos: Vec3 = [0, fold >= 4 ? 0 : -1.05, pulseZ];
    const pulseCol = srgbHex(pal.pulse);
    const fillA = srgbHex(pal.fillA);
    const fillB = srgbHex(pal.fillB);
    const gold = srgbHex(pal.gold[0]);

    const lEye: Vec3 = [pulsePos[0], pulsePos[1] + 1.15, pulsePos[2] + 0.35];
    const lTgt: Vec3 = [0, fold >= 4 ? 0 : -1.20, pulsePos[2] - 5];
    const lview = lookAt(lEye, lTgt);
    const lvp = mul(perspective(1.15, 1, 0.35, 20), lview);
    const baseZ = Math.floor(camZ / SEG) * SEG - SEG;

    gl.bindVertexArray(this.vao);
    this.sm.begin(); gl.disable(gl.CULL_FACE);
    gl.useProgram(this.sh.p); this.motionU(this.sh, P, t);
    gl.uniformMatrix4fv(this.sh.u.uVP, false, shiftVP(lvp, baseZ));
    gl.drawElementsInstanced(gl.TRIANGLES, this.nIdx, gl.UNSIGNED_SHORT, 0, this.nInst);
    this.sm.end();

    this.ms.ensure(f.w, f.h); this.ms.begin(1000);
    const look = lookOf(P.look ?? 'Cobalt Orange');
    const fwd = norm([tgt[0] - eye[0], tgt[1] - eye[1], tgt[2] - eye[2]]);
    const Ld = dirFromAzEl(P.keyAz ?? -20, P.keyEl ?? 48);
    const env = { look, L: Ld, F: dirFromAzEl((P.keyAz ?? -20) + 140, 18), fwd };

    gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
    gl.useProgram(this.back.p); setStudioEnv(gl, this.back.u, env);
    gl.uniformMatrix4fv(this.back.u.uInvVP, false, invert(vp));
    gl.uniform3fv(this.back.u.uCamPos, eye);
    gl.uniform3fv(this.back.u.uPulseCol, pulseCol);
    gl.uniform1f(this.back.u.uTime, t);
    gl.uniform1f(this.back.u.uCamZ, camZ);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.depthFunc(gl.LESS);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.depthMask(false);
    gl.useProgram(this.star.p);
    gl.bindVertexArray(this.starVao);
    gl.uniformMatrix4fv(this.star.u.uVP, false, vp);
    gl.uniform1f(this.star.u.uCamZ, camZ);
    gl.uniform1f(this.star.u.uPeriod, SEG * NSEG);
    gl.drawArrays(gl.POINTS, 0, MAX_STARS);
    gl.disable(gl.BLEND); gl.depthMask(true);
    gl.bindVertexArray(this.vao);

    gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
    const u = this.p.u; gl.useProgram(this.p.p); setStudioEnv(gl, u, env); this.motionU(this.p, P, t);
    gl.uniformMatrix4fv(u.uVP, false, shiftVP(vp, baseZ));
    gl.uniform3fv(u.uCamPos, [eye[0], eye[1], eye[2] - baseZ]);
    gl.uniform3fv(u.uPulsePos, [pulsePos[0], pulsePos[1], pulsePos[2] - baseZ]);
    gl.uniform3fv(u.uPulseCol, pulseCol);
    gl.uniform3fv(u.uFillA, fillA);
    gl.uniform3fv(u.uFillB, fillB);
    gl.uniform3fv(u.uGold, gold);
    gl.uniform1f(u.uGloss, P.gloss ?? 1.2);
    gl.uniform1f(u.uIrid, P.irid ?? 0.3);
    gl.uniform1f(u.uAniso, P.ctAniso ?? 1);
    gl.uniform1f(u.uPulseI, pulseI);
    gl.uniform1f(u.uFog, 0.11);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.sm.tex); gl.uniform1i(u.uShadow, 3);
    gl.uniformMatrix4fv(u.uLightVP, false, shiftVP(lvp, baseZ));
    gl.uniform1f(u.uShadowSoft, 2.2); gl.uniform1f(u.uShadowTexel, 1 / 2048);
    const pulseInst = Math.min(this.nInst + 3, MAX);
    if (pulseInst > this.nInst) {
      const pz = pulsePos[2] - baseZ;
      const py = pulsePos[1];
      const pc = pulseCol;
      for (let i = 0; i < pulseInst - this.nInst; i++) {
        const o = (this.nInst + i) * STRIDE;
        const s = 0.06 + i * 0.035;
        this.buf[o] = 0; this.buf[o + 1] = py; this.buf[o + 2] = pz; this.buf[o + 3] = 0.17 * (i + 1);
        this.buf[o + 4] = s; this.buf[o + 5] = s * 0.55; this.buf[o + 6] = s; this.buf[o + 7] = 1;
        this.buf[o + 8] = pc[0]; this.buf[o + 9] = pc[1]; this.buf[o + 10] = pc[2]; this.buf[o + 11] = 1.15 - i * 0.25;
        this.buf[o + 12] = 3; this.buf[o + 13] = 0; this.buf[o + 14] = 0; this.buf[o + 15] = 0;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, this.nInst * STRIDE * 4, this.buf.subarray(this.nInst * STRIDE, pulseInst * STRIDE));
    }
    gl.drawElementsInstanced(gl.TRIANGLES, this.nIdx, gl.UNSIGNED_SHORT, 0, pulseInst);
    gl.bindVertexArray(null); gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.activeTexture(gl.TEXTURE0);

    const tex = this.ms.resolve();
    if (!this.fishFb || this.fishFb.w !== f.w || this.fishFb.h !== f.h) {
      if (this.fishFb) deleteFB(gl, this.fishFb);
      this.fishFb = fbo(gl, f.w, f.h);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fishFb.f); gl.viewport(0, 0, f.w, f.h);
    gl.useProgram(this.fish.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(this.fish.u.uTex, 0);
    gl.uniform1f(this.fish.u.uFish, P.ctFish ?? 1.45);
    gl.uniform1f(this.fish.u.uBreathe, P.ctBreathe ?? 1);
    gl.uniform1f(this.fish.u.uTime, t);
    gl.uniform1f(this.fish.u.uAspect, f.aspect);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    f.dof(this.fishFb.t, f.target, f.w, f.h, 7.2, P.dof ?? 0.12);
    this.stats = { ready: true, boxes: this.nInst, tris: (this.nIdx / 3) * this.nInst, camZ, pulseZ, echo: P.ctEcho ?? 1 };
  }
}

function shiftVP(vp: number[], zOff: number): number[] {
  const m = vp.slice();
  m[12] += m[8] * zOff;
  m[13] += m[9] * zOff;
  m[14] += m[10] * zOff;
  m[15] += m[11] * zOff;
  return m;
}
