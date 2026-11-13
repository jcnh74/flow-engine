// Crystal Temple: a kaleidoscopic prism-ridge tunnel with a traveling axial pulse.
// Original MIT-licensed work for flow-engine. No Shadertoy code.
import type { PhysScene, PhysFrame, Vec3 } from './common';
import { compile, QUAD_VS, STUDIO_GLSL, PCF_GLSL, MsTarget, ShadowMap, setStudioEnv, lookOf, dirFromAzEl, srgbHex, lookAt, perspective, mul, norm, invert } from './common';

export const TEMPLE_PALETTES: Record<string, {
  body: string[]; gold: string[]; accent: string[]; tendril: string[];
  emit: string; pulse: string; fillA: string; fillB: string;
}> = {
  'Cyan Processional': {
    body: ['#152438', '#1a3250', '#1e3c5c', '#274868', '#163044', '#1c3854'],
    gold: ['#c9a45a', '#e2c07a', '#a87c38', '#f0d8a0'],
    accent: ['#5a2a48', '#7a3a62', '#8a4860', '#3a2048'],
    tendril: ['#2a2448', '#3a2a58', '#4a3868', '#243050'],
    emit: '#7ef6ff', pulse: '#e8ffff', fillA: '#ff6aad', fillB: '#e0b25a',
  },
  'Magenta Night': {
    body: ['#1a1024', '#241430', '#301c3c', '#3a2248', '#1c1430', '#281838'],
    gold: ['#e090c0', '#f0b0d0', '#c06090', '#ffd0e8'],
    accent: ['#6a2050', '#8a2870', '#a03880', '#4a1838'],
    tendril: ['#3a1840', '#4a2050', '#5a2860', '#2a1838'],
    emit: '#ff9ad8', pulse: '#ffe8ff', fillA: '#ff58c0', fillB: '#ffb070',
  },
  'Ice Temple': {
    body: ['#141c28', '#1a2838', '#223040', '#2a3c50', '#182028', '#1c3044'],
    gold: ['#c8d8e8', '#e0f0ff', '#98b0c4', '#f4fbff'],
    accent: ['#2a4860', '#3a6080', '#4a7090', '#203848'],
    tendril: ['#203040', '#284056', '#305060', '#1c2838'],
    emit: '#b8f6ff', pulse: '#f0ffff', fillA: '#80c8ff', fillB: '#d0e8ff',
  },
  'Amber Sanctum': {
    body: ['#1c140c', '#281c10', '#342414', '#3c2a18', '#20180c', '#2c2010'],
    gold: ['#f0b040', '#ffd070', '#c88820', '#ffe8a0'],
    accent: ['#6a2810', '#8a3814', '#a04818', '#4a200c'],
    tendril: ['#3a2410', '#4a2c14', '#5a3418', '#2c1c0c'],
    emit: '#ffe08a', pulse: '#fff4d0', fillA: '#ff6a30', fillB: '#ffc050',
  },
};

const SEG = 22;
const NSEG = 5;
const STRIDE = 16;
const MAX = 28000;
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
type Box = { x: number; y: number; z: number; sx: number; sy: number; sz: number; r: number; g: number; b: number; ao: number; em: number; kind: number };

function colOf(hexes: string[], i: number, j = 0): [number, number, number] {
  const c = srgbHex(hexes[Math.abs((i + j * 3) | 0) % hexes.length]);
  return [c[0], c[1], c[2]];
}

const VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in vec4 aA;
layout(location=3) in vec4 aB;
layout(location=4) in vec4 aC;
layout(location=5) in vec4 aD;
uniform mat4 uVP;
uniform float uTime, uAmp;
out vec3 vP, vN, vCol, vT;
out float vAo, vEm, vKind;
void main(){
  float c = cos(aA.w), s = sin(aA.w);
  vec3 loc = aPos * aB.xyz;
  vec3 wp = aA.xyz + vec3(c*loc.x - s*loc.y, s*loc.x + c*loc.y, loc.z);
  if (aD.x > 1.5 && aD.x < 2.5) {
    wp.x += sin(uTime * 0.62 + wp.z * 0.41) * uAmp * 0.10;
    wp.y += sin(uTime * 0.48 + wp.z * 0.33) * uAmp * 0.07;
  }
  vec3 ns = aNrm / max(aB.xyz, vec3(1e-3));
  vec3 wn = normalize(vec3(c*ns.x - s*ns.y, s*ns.x + c*ns.y, ns.z));
  vec3 t0 = abs(aNrm.y) < 0.9 ? vec3(1,0,0) : vec3(0,0,1);
  t0 = normalize(t0 - wn * dot(t0, wn));
  vec3 wt = normalize(vec3(c*t0.x - s*t0.y, s*t0.x + c*t0.y, t0.z));
  vP = wp; vN = wn; vT = wt; vCol = aC.rgb; vAo = aB.w; vEm = aC.w; vKind = aD.x;
  gl_Position = uVP * vec4(wp, 1.0);
}`;

const SH_VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=2) in vec4 aA;
layout(location=3) in vec4 aB;
layout(location=5) in vec4 aD;
uniform mat4 uVP;
uniform float uTime, uAmp;
void main(){
  float c = cos(aA.w), s = sin(aA.w);
  vec3 loc = aPos * aB.xyz;
  vec3 wp = aA.xyz + vec3(c*loc.x - s*loc.y, s*loc.x + c*loc.y, loc.z);
  if (aD.x > 1.5 && aD.x < 2.5) {
    wp.x += sin(uTime * 0.62 + wp.z * 0.41) * uAmp * 0.10;
    wp.y += sin(uTime * 0.48 + wp.z * 0.33) * uAmp * 0.07;
  }
  gl_Position = uVP * vec4(wp, 1.0);
}`;
const SH_FS = `#version 300 es
void main(){}`;

const FS = `#version 300 es
precision highp float;
in vec3 vP, vN, vCol, vT;
in float vAo, vEm, vKind;
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
  float prox = exp(-distP * distP * 0.085);
  albedo = mix(albedo, mix(uGold, uPulseCol, 0.45), prox * uPulseI * 0.35);
  float rough = mix(0.22, 0.08, clamp(uGloss * 0.55, 0.0, 1.0));
  if (vKind > 1.5 && vKind < 2.5) rough = mix(rough, 0.28, 0.4);
  float ax = rough * (1.0 + uAniso * 3.2);
  float ay = max(rough / (1.0 + uAniso * 2.4), 0.04);
  vec3 f0 = mix(vec3(0.22, 0.24, 0.26), vec3(0.7, 0.62, 0.4), vKind > 0.5 && vKind < 1.5 ? 1.0 : 0.15);
  f0 = mix(f0, vec3(0.55, 0.75, 0.8), clamp(uIrid, 0.0, 1.0) * 0.4);
  float sh = shadowAt(vP, N);
  float ao = clamp(vAo, 0.25, 1.0);
  float side = abs(N.x);
  vec3 Lvec = uPulsePos - vP;
  float ld = max(length(Lvec), 1e-3);
  vec3 L = Lvec / ld;
  float att = uPulseI * 0.55 / (1.0 + ld * ld * 0.55);
  float nl = max(dot(N, L), 0.0);
  vec3 H = normalize(L + V);
  float nv = max(dot(N, V), 1e-3);
  float nh = max(dot(N, H), 0.0);
  vec3 spec = D_GGX_aniso(dot(T,H), dot(B,H), nh, ax, ay)
            * V_Smith_aniso(dot(T,V), dot(B,V), dot(T,L), dot(B,L), nv, nl, ax, ay)
            * F_Schlick(f0, max(dot(H,V), 0.0)) * nl * uPulseCol * att * sh;
  spec = min(spec * 0.08, vec3(0.12));
  vec3 Lk = normalize(vec3(0.15, 0.7, 0.5));
  float wrap = 0.35 + 0.65 * max(dot(N, Lk), 0.0);
  vec3 col = albedo * (0.62 + 0.38 * ao) * wrap;
  col *= 1.0 + uFillA * (0.12 * side + 0.06) + uFillB * 0.10 * max(N.y, 0.0);
  col += albedo * att * mix(0.12, 0.45, nl) * sh;
  col += spec;
  col += uPulseCol * vEm * (0.18 + 0.28 * prox) * (0.45 + 0.25 * uPulseI);
  col *= 1.0 + prox * uPulseI * 0.22;
  float edge = pow(1.0 - nv, 2.4) * 0.08 * (0.3 + 0.4 * uPulseI);
  col += mix(uPulseCol, uFillA, 0.3) * edge * (0.3 + 0.35 * prox);
  float fog = 1.0 - exp(-max(length(vP - uCamPos) - 4.0, 0.0) * uFog);
  col = mix(col, vec3(0.0), clamp(fog, 0.0, 1.0));
  col = min(col, vec3(2.5));
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
  col += uPulseCol * 0.012 * pow(max(rd.z, 0.0), 8.0);
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

function buildPeriod(pal: Pal, density: number, amp: number): Box[] {
  const body = pal.body, gold = pal.gold, accent = pal.accent, tendril = pal.tendril;
  const emitC = srgbHex(pal.emit);
  const out: Box[] = [];
  const AXIS = 1.15;
  const push = (x: number, y: number, z: number, sx: number, sy: number, sz: number, rgb: [number, number, number], ao: number, em: number, kind: number) => {
    if (sx < 0.02 || sy < 0.012 || sz < 0.02) return;
    out.push({ x, y: y - AXIS, z, sx, sy, sz, r: rgb[0], g: rgb[1], b: rgb[2], ao, em, kind });
  };
  const den = Math.max(0.5, Math.min(1.8, density));
  const nZ = Math.round(18 * den);
  const aisle = 0.52;

  for (let zi = 0; zi < nZ; zi++) {
    const z = (zi + 0.5) * (SEG / nZ);
    const h = hash21(zi, 3);
    const layers = 2 + ((h * 3 * den) | 0);
    const plateH = 0.055 + 0.025 * hash21(zi, 8);
    const zJitter = (hash21(zi, 11) - 0.5) * 0.12;
    let x = aisle + 0.02;
    let k = 0;
    const xMax = 3.6 + 0.5 * hash21(zi, 14);
    while (x < xMax && k < 10) {
      const w = 0.42 + 0.7 * hash21(zi, k + 20);
      const d = 0.28 + 0.42 * hash21(zi, k + 40);
      for (let ly = 0; ly < layers; ly++) {
        const y = -0.22 + ly * (plateH * 2 * 1.08);
        const rgb = colOf(body, zi + ly, k);
        const ao = 0.55 + 0.35 * (ly / Math.max(layers - 1, 1));
        push(x + w * 0.5, y, z + zJitter, w * 0.48, plateH, d * 0.48, rgb, ao, 0, 0);
        if (ly === layers - 1 && hash21(zi, k + 60) > 0.28) {
          const g = colOf(gold, zi, k);
          push(x + w * 0.5, y + plateH + 0.012, z + zJitter, w * 0.46, 0.014, d * 0.46, g, 0.9, 0.05, 1);
        }
      }
      x += w + 0.03;
      k++;
    }
    if (zi % Math.max(1, Math.round(2 / den)) === 0) {
      push(aisle + 0.09, 0.02, z, 0.06, 0.045, 0.06, [emitC[0], emitC[1], emitC[2]], 1, 0.45, 3);
    }
  }

  for (let zi = 0; zi < nZ; zi++) {
    const z = (zi + 0.35) * (SEG / nZ);
    const h = hash21(zi, 90);
    const layers = 2 + ((h * 3 * den) | 0);
    const plateH = 0.05 + 0.02 * hash21(zi, 91);
    let x = aisle + 0.15 + 0.4 * hash21(zi, 92);
    let k = 0;
    while (x < 3.4 && k < 8) {
      const w = 0.5 + 0.7 * hash21(zi, k + 100);
      const d = 0.3 + 0.4 * hash21(zi, k + 110);
      for (let ly = 0; ly < layers; ly++) {
        const y = 3.15 - ly * (plateH * 2 * 1.1);
        const rgb = colOf(body, zi + 17 + ly, k);
        push(x + w * 0.5, y, z, w * 0.48, plateH, d * 0.48, rgb, 0.6 + 0.3 * (1 - ly / Math.max(layers, 1)), 0, 0);
        if (ly === 0 && hash21(zi, k + 120) > 0.35) {
          push(x + w * 0.5, y + plateH + 0.012, z, w * 0.45, 0.013, d * 0.45, colOf(gold, zi, k + 2), 0.9, 0.04, 1);
        }
      }
      x += w + 0.04;
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
        push(span * 0.5, yh, z, span * 0.5, 0.05, thick, colOf(body, seed + i, ly), 0.7, 0, 0);
        if (ly === lintelLayers - 1) {
          push(span * 0.5, yh + 0.06, z, span * 0.48, 0.014, thick * 0.92, colOf(gold, seed, i), 0.95, 0.08, 1);
        }
      }
      push(halfW * 0.55, y0 - 0.04, z, halfW * 0.55, 0.05, thick, colOf(body, seed + 3, i), 0.55, 0, 0);
      push(halfW * 0.55, y0 + 0.02, z, halfW * 0.52, 0.012, thick * 0.9, colOf(gold, seed + 1, i), 0.85, 0.15, 1);
      push(halfW * 0.55, y0 + 0.07, z + thick * 0.55, halfW * 0.5, 0.016, 0.03, [emitC[0], emitC[1], emitC[2]], 1, 0.55, 3);
      push(halfW * 0.55, y1 - 0.04, z + thick * 0.55, halfW * 0.5, 0.016, 0.03, [emitC[0], emitC[1], emitC[2]], 1, 0.4, 3);
      const jambX = halfW + 0.18;
      const nJ = Math.round(6 * den);
      for (let j = 0; j < nJ; j++) {
        const t = j / Math.max(nJ - 1, 1);
        const y = y0 + 0.1 + t * (y1 - y0 - 0.1);
        const jw = 0.16 + 0.12 * hash21(seed + i, j);
        const jh = 0.09 + 0.04 * hash21(seed + i, j + 4);
        push(jambX, y, z, jw, jh, thick * 0.9, colOf(body, seed + i, j + 8), 0.65, 0, 0);
      }
      push(halfW + 0.04, (y0 + y1) * 0.5, z + thick * 0.5, 0.02, (y1 - y0) * 0.42, 0.025, [emitC[0], emitC[1], emitC[2]], 1, 0.3, 3);
    }
    const pipes = Math.round(7 * den);
    for (let p = 0; p < pipes; p++) {
      const x = 3.15 * scale + p * 0.32;
      const nStack = 8 + ((hash21(seed, p + 40) * 8 * den) | 0);
      const z0 = gateZ - 0.4 + hash21(seed, p) * 1.2;
      for (let s = 0; s < nStack; s++) {
        const y = 0.15 + s * 0.22;
        const sx = 0.11 + 0.05 * hash21(seed, p + s);
        const sz = 0.13 + 0.06 * hash21(seed, p + s + 9);
        const rgb = hash21(seed, p + s) > 0.78 ? colOf(accent, p, s) : colOf(body, seed + p, s);
        push(x, y, z0 + (hash21(seed, s) - 0.5) * 0.2, sx, 0.1, sz, rgb, 0.5 + 0.4 * (s / nStack), 0, 0);
        if (s === nStack - 1) push(x, y + 0.11, z0, sx * 0.9, 0.012, sz * 0.9, colOf(gold, p, s), 0.9, 0.05, 1);
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
    const nS = Math.round(h / 0.2);
    for (let s = 0; s < nS; s++) {
      const y = 0.1 + s * 0.2;
      const rgb = hash21(i, s + 210) > 0.82 ? colOf(accent, i, s) : colOf(body, i + 30, s);
      push(x0 + (hash21(i, s) - 0.5) * 0.35, y, z, 0.16 + 0.1 * hash21(i, s + 3), 0.09, 0.16 + 0.1 * hash21(i, s + 7), rgb, 0.5 + 0.35 * (s / nS), 0, 0);
    }
  }

  const nRib = 3;
  const nStep = Math.round(46 * den);
  for (let r = 0; r < nRib; r++) {
    const phase = r * 1.7 + 0.3;
    const freq = 1.1 + r * 0.35;
    const yBase = 0.7 + r * 0.5;
    const xBase = 2.55 + r * 0.42;
    for (let i = 0; i < nStep; i++) {
      const u = i / nStep;
      const z = u * SEG;
      const w1 = Math.sin(u * Math.PI * 2 * freq + phase);
      const w2 = Math.sin(u * Math.PI * 2 * (freq * 1.65) + phase * 1.3);
      const x = xBase + amp * (0.85 * w1 + 0.28 * w2);
      const y = yBase + amp * (0.95 * Math.sin(u * Math.PI * 2 * 1.25 + phase + 0.5) + 0.28 * w2);
      const rgb = colOf(tendril, r, i);
      const s = 0.075 + 0.035 * hash21(r, i);
      push(x, y, z, s, s, s, rgb, 0.75, 0.08, 2);
      if (i % 2 === 0) push(x + 0.09, y + 0.04 * w1, z, s * 0.85, s * 0.85, s * 0.85, colOf(tendril, r + 1, i), 0.7, 0.05, 2);
    }
  }
  return out;
}

function expand(base: Box[], mirror: boolean, fold: number): Box[] {
  const f = Math.max(2, Math.min(8, fold | 0));
  const mid: Box[] = [];
  for (const b of base) {
    mid.push(b);
    if (mirror && f <= 2 && Math.abs(b.x) > 0.02) mid.push({ ...b, x: -b.x });
    if (!mirror && f <= 2 && Math.abs(b.x) > 0.02) {
      const jx = (hash11(b.z * 3.1 + b.y * 5.7) - 0.5) * 0.18;
      const jy = (hash11(b.z * 2.7 + b.x * 4.3) - 0.5) * 0.08;
      mid.push({ ...b, x: -b.x + jx, y: b.y + jy });
    }
  }
  if (f <= 2) return mid;
  // Keep a wedge around the floor (downward) so rotational copies fill the tunnel without overlap.
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
      out.push({ ...b, x: c * b.x - s * b.y, y: s * b.x + c * b.y });
    }
  }
  return out;
}

function pack(boxes: Box[], startZ: number, nSeg: number, buf: Float32Array): number {
  let n = 0;
  for (let s = 0; s < nSeg; s++) {
    const zOff = startZ + s * SEG;
    for (const b of boxes) {
      if (n >= MAX) return n;
      const o = n * STRIDE;
      buf[o] = b.x; buf[o + 1] = b.y; buf[o + 2] = b.z + zOff; buf[o + 3] = 0;
      buf[o + 4] = b.sx; buf[o + 5] = b.sy; buf[o + 6] = b.sz; buf[o + 7] = b.ao;
      buf[o + 8] = b.r; buf[o + 9] = b.g; buf[o + 10] = b.b; buf[o + 11] = b.em;
      buf[o + 12] = b.kind; buf[o + 13] = 0; buf[o + 14] = 0; buf[o + 15] = 0;
      n++;
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
  private vao: WebGLVertexArrayObject; private starVao: WebGLVertexArrayObject;
  private instBuf: WebGLBuffer; private nIdx: number; private nInst = 0;
  private ms: MsTarget; private sm: ShadowMap; private t = 0;
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
    const key = `${palName}|${density}|${amp}|${mirror}|${fold}`;
    if (key === this.key) return pal;
    this.key = key;
    const base = buildPeriod(pal, density, amp);
    const one = expand(base, mirror, fold);
    this.nInst = pack(one, 0, NSEG, this.buf);
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.buf.subarray(0, this.nInst * STRIDE));
    return pal;
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
    // Traveling pulse in the aisle, looping with the segment period.
    const pulseZ = camZ + 7.0 - worldPeriod * ((t * pulseRate * 0.22) - Math.floor(t * pulseRate * 0.22));
    const pulsePos: Vec3 = [0, fold >= 4 ? 0 : -0.72, pulseZ];
    const pulseCol = srgbHex(pal.pulse);
    const fillA = srgbHex(pal.fillA);
    const fillB = srgbHex(pal.fillB);
    const gold = srgbHex(pal.gold[0]);

    // Spotlight from just above the pulse, aimed back toward the camera along the aisle.
    const lEye: Vec3 = [pulsePos[0], pulsePos[1] + 1.15, pulsePos[2] + 0.35];
    const lTgt: Vec3 = [0, fold >= 4 ? 0 : -1.15, pulsePos[2] - 5];
    const lview = lookAt(lEye, lTgt);
    const lvp = mul(perspective(1.15, 1, 0.35, 20), lview);

    // Slide instance block so the camera is always inside segments 1..2 of the packed NSEG.
    const baseZ = Math.floor(camZ / SEG) * SEG - SEG;
    // packed z currently starts at 0; we want it to start at baseZ. Upload a z shift via... 
    // boxes already stamped 0..NSEG*SEG. We need to rebase: easiest is to pass uZOff? 
    // Rebuild pack origin each frame would be expensive (CPU copy). Instead shift in the VS.
    // We'll set uZOff so that instance z + uZOff is around the camera.
    // Instances have z in [0, NSEG*SEG). We want world z = z - floor-mod + baseZ.
    // worldZ = aA.z + uZOff, uZOff = baseZ.
    // When camZ crosses a segment, baseZ jumps by SEG and the wrap is seamless because
    // geometry is periodic. The last segment pops in far ahead, hidden by fog.

    gl.bindVertexArray(this.vao);
    const uploadShift = (prog: ReturnType<typeof compile>) => {
      gl.uniform1f(prog.u.uTime, t);
      gl.uniform1f(prog.u.uAmp, P.ctAmp ?? 1);
    };

    this.sm.begin(); gl.disable(gl.CULL_FACE);
    gl.useProgram(this.sh.p); uploadShift(this.sh);
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
    const u = this.p.u; gl.useProgram(this.p.p); setStudioEnv(gl, u, env); uploadShift(this.p);
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
        const s = 0.055 + i * 0.03;
        this.buf[o] = 0; this.buf[o+1] = py; this.buf[o+2] = pz; this.buf[o+3] = 0;
        this.buf[o+4] = s; this.buf[o+5] = s * 0.55; this.buf[o+6] = s; this.buf[o+7] = 1;
        this.buf[o+8] = pc[0]; this.buf[o+9] = pc[1]; this.buf[o+10] = pc[2]; this.buf[o+11] = 1.1 - i * 0.25;
        this.buf[o+12] = 3; this.buf[o+13] = 0; this.buf[o+14] = 0; this.buf[o+15] = 0;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, this.nInst * STRIDE * 4, this.buf.subarray(this.nInst * STRIDE, pulseInst * STRIDE));
    }
    gl.drawElementsInstanced(gl.TRIANGLES, this.nIdx, gl.UNSIGNED_SHORT, 0, pulseInst);
    gl.bindVertexArray(null); gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.activeTexture(gl.TEXTURE0);

    const tex = this.ms.resolve();
    f.dof(tex, f.target, f.w, f.h, 7.2, P.dof ?? 0.12);
    this.stats = { ready: true, boxes: this.nInst, tris: (this.nIdx / 3) * this.nInst, camZ, pulseZ };
  }
}

/** Translate a view-projection so instanced z (stored in 0..NSEG*SEG) lines up with world z = instZ + zOff. */
function shiftVP(vp: number[], zOff: number): number[] {
  // Right-multiply by a translation of (0,0,zOff): wp' = wp + (0,0,zOff).
  // vp * T(0,0,zOff) = add zOff * column 2 to column 3.
  const m = vp.slice();
  m[12] += m[8] * zOff;
  m[13] += m[9] * zOff;
  m[14] += m[10] * zOff;
  m[15] += m[11] * zOff;
  return m;
}
