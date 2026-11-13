// Mirror Mandala: a dense, intricate, bilateral 3D tendril medallion of
// thousands of small glossy beads and packed bubble clusters on true black,
// with contact shadows, a slight RGB fringe, organic grow / curl / flow,
// self-similar recursion, and a slow looping inward zoom.
// Original MIT-licensed work for flow-engine. Shading follows Walter et al.
// 2007 (GGX), Schlick 1994 and Smith. No Shadertoy code and no third-party assets.
import { compile, QUAD_VS, STUDIO_GLSL, PCF_GLSL, MsTarget, ShadowMap, setStudioEnv, lookOf, dirFromAzEl, srgbHex, lookAt, perspective, ortho, mul, norm, invert,
  fbo, type FB, type PhysFrame, type PhysScene, type Prog, type Vec3 } from './common';

export const MANDALA_PALETTES: Record<string, string[]> = {
  // teal / lime / coral / magenta — green field with pink accents, not a two-colour face
  'Poison Garden': ['#1ad97a', '#c8ff2a', '#ff3d7a', '#14d0c4', '#ff8a2a', '#7cff4a'],
  'Neon Coral':    ['#ff4d6d', '#2ee0ff', '#ff9f1c', '#7b2cbf', '#4cff8a', '#ff6bd6'],
  'Violet Relic':  ['#c77dff', '#4cc9f0', '#ff6bd6', '#7b2cbf', '#80ffdb', '#e0aaff'],
  'Ice Orchid':    ['#7ef0ff', '#ff7eb6', '#bde0fe', '#48cae4', '#ffc2d1', '#caf0f8'],
};

const MAX = 30000;
const STRIDE = 12; // x y z r  color nx ny nz  tx ty along gen

function hash(n: number) { const x = Math.sin(n * 19.19 + 7.13) * 51.7913; return x - Math.floor(x); }

type Emit = (x: number, y: number, z: number, r: number, color: number, nx: number, ny: number, nz: number, tx: number, ty: number, along: number, gen: number) => boolean;

function makeEmit(dst: number[], budget: number): Emit {
  return (x, y, z, r, color, nx, ny, nz, tx, ty, along, gen) => {
    if (dst.length / STRIDE >= budget) return false;
    // keep a small dark well in the very centre (filled later by the inner cluster)
    if (gen < 0.5 && r < 0.05 && Math.hypot(x, y) < 0.07) return true;
    dst.push(x, y, z, r, color, nx, ny, nz, tx, ty, along, gen);
    return true;
  };
}

/** Walk a polyline and emit several parallel beaded fibers. */
function ribbon(emit: Emit, pts: Vec3[], fibers: number, spacing: number, radius: number, color: number, gen: number) {
  if (pts.length < 2) return;
  const acc: number[] = [0];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    acc.push(acc[i] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
  }
  const total = acc[acc.length - 1] || 1;
  const nF = Math.max(1, fibers);
  for (let f = 0; f < nF; f++) {
    const off = (f - (nF - 1) / 2) * radius * 2.15;
    const col = (color + (f % 3 === 0 ? 0 : f % 2)) % 6;
    let travel = 0;
    const steps = Math.max(2, Math.round(total / spacing));
    for (let s = 0; s <= steps; s++) {
      const target = (s / steps) * total;
      let i = 0;
      while (i < acc.length - 2 && acc[i + 1] < target) i++;
      const a = pts[i], b = pts[Math.min(i + 1, pts.length - 1)];
      const seg = Math.max(1e-6, acc[Math.min(i + 1, acc.length - 1)] - acc[i]);
      const t = (target - acc[i]) / seg;
      const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
      const len = Math.hypot(dx, dy) || 1e-6;
      const nx = -dy / len, ny = dx / len;
      const x = a[0] + dx * t + nx * off;
      const y = a[1] + dy * t + ny * off;
      const z = a[2] + dz * t + 0.01 * Math.sin(f * 1.7 + s * 0.3);
      const rr = radius * (0.82 + 0.28 * hash(s * 1.13 + f * 9.1 + gen * 3.7));
      const along = s / steps;
      if (!emit(x, y, z, rr, col, nx, ny, 0, dx / len, dy / len, along, gen)) return;
      travel += spacing;
    }
  }
}

function curve(x0: number, y0: number, z0: number, ang: number, len: number, bend: number, n: number, wobble: number): Vec3[] {
  const o: Vec3[] = [];
  let x = x0, y = y0, z = z0, a = ang;
  const ds = len / n;
  for (let i = 0; i <= n; i++) {
    o.push([x, y, z]);
    a += bend + wobble * Math.sin(i * 0.37);
    x += Math.cos(a) * ds;
    y += Math.sin(a) * ds;
    z += 0.018 * Math.sin(i * 0.45);
  }
  return o;
}

/** Pointed arch / chevron through the right half, y-up. */
function chevron(y: number, rx: number, lift: number, n: number, point: number, z: number): Vec3[] {
  const o: Vec3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;                 // 0 at the mid-line, 1 at the outside
    const a = t * Math.PI * 0.5;     // 0 .. 90 deg
    const flare = 1.0 + point * t * t;
    const x = Math.sin(a) * rx * flare;
    const yy = y + Math.cos(a) * lift * (1.0 - 0.35 * t) - t * t * lift * 0.35;
    const zz = z + 0.12 * (1.0 - t) * (1.0 - t);
    o.push([x, yy, zz]);
  }
  return o;
}

function cluster(emit: Emit, cx: number, cy: number, cz: number, R: number, count: number, color: number, gen: number) {
  const n = Math.max(5, count);
  if (!emit(cx, cy, cz, R * 0.38, color, 0, 1, 0, 1, 0, 0.5, gen)) return;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + hash(cx * 7.1 + i) * 0.4;
    const rr = R * (0.55 + 0.25 * hash(i * 3.1 + cy));
    const el = (hash(i * 5.7 + cx) - 0.5) * 0.7;
    const x = cx + Math.cos(a) * rr * Math.cos(el);
    const y = cy + Math.sin(a) * rr * Math.cos(el) * 0.85;
    const z = cz + Math.sin(el) * rr * 0.8;
    const rad = R * (0.16 + 0.12 * hash(i * 2.3 + R));
    if (!emit(x, y, z, rad, (color + i) % 6, Math.cos(a), Math.sin(a), 0, -Math.sin(a), Math.cos(a), i / n, gen)) return;
  }
  // tiny satellite ring
  const sat = Math.max(4, Math.round(n * 0.6));
  for (let i = 0; i < sat; i++) {
    const a = (i / sat) * Math.PI * 2;
    const rr = R * 0.95;
    if (!emit(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.8, cz + 0.02, R * 0.09, (color + 2) % 6,
      Math.cos(a), Math.sin(a), 0, -Math.sin(a), Math.cos(a), i / sat, gen + 0.5)) return;
  }
}

function branch(emit: Emit, x0: number, y0: number, z0: number, ang: number, len: number, bend: number,
  fibers: number, spacing: number, radius: number, color: number, gen: number, maxGen: number, wobble: number) {
  const n = Math.max(6, Math.round(len / spacing));
  const pts = curve(x0, y0, z0, ang, len, bend, n, wobble);
  ribbon(emit, pts, fibers, spacing, radius, color, gen);
  if (gen >= maxGen || pts.length < 4) return;
  const forks = gen === 0 ? 3 : 2;
  for (let k = 0; k < forks; k++) {
    const t = 0.35 + k * (0.5 / forks);
    const i = Math.min(pts.length - 1, Math.round(t * (pts.length - 1)));
    const p = pts[i];
    const q = pts[Math.min(i + 1, pts.length - 1)];
    const base = Math.atan2(q[1] - p[1], q[0] - p[0]);
    const side = (k % 2 === 0 ? 1 : -1);
    const childAng = base + side * (0.55 + 0.25 * hash(gen * 8.1 + k + x0));
    branch(emit, p[0], p[1], p[2], childAng, len * 0.52, bend * 1.15 * side,
      Math.max(1, fibers - 1), spacing * 0.92, radius * 0.72, (color + k + 1) % 6,
      gen + 1, maxGen, wobble * 1.1);
  }
}

/** Right-half dense filament medallion. Mirrored / folded later. */
function buildHalf(density: number, lobes: number, seed: number, budget: number, scale: number, depth: number) {
  const dst: number[] = [];
  const emit = makeEmit(dst, budget);
  const sp = (0.026 / Math.max(0.55, density)) * scale;
  const r0 = 0.0155 * scale * (0.85 + 0.2 * density);
  const S = scale;

  // --- packed central medallion FIRST (reserved budget so the well is never empty) ---
  if (depth === 0) {
    const coreN = Math.round(90 + 50 * density);
    for (let i = 0; i < coreN; i++) {
      const a = i * 2.39996 + seed;
      const r = 0.55 * S * Math.sqrt((i + 0.5) / coreN);
      const x = Math.cos(a) * r, y = Math.sin(a) * r * 0.82;
      const z = 0.16 * S * (1.0 - r / (0.55 * S));
      const rad = r0 * (1.4 + 1.3 * hash(i * 1.7)) * (0.85 + 0.5 * lobes);
      emit(x, y, z, rad, i % 6, Math.cos(a), Math.sin(a), 0, -Math.sin(a), Math.cos(a), i / coreN, depth);
    }
    for (let k = 0; k < 7; k++) {
      const rx = (0.18 + k * 0.10) * S, ry = (0.14 + k * 0.08) * S;
      const pts: Vec3[] = [];
      for (let i = 0; i <= 40; i++) {
        const a = (i / 40) * Math.PI;
        const wob = 1.0 + 0.07 * Math.sin(a * 5.0 + k * 0.8);
        pts.push([Math.sin(a) * rx * wob, Math.cos(a) * ry * wob * 0.88, 0.08 * S]);
      }
      ribbon(emit, pts, Math.max(2, Math.round(3 + density * 0.6)), sp * 0.85, r0 * 0.95, k % 6, depth);
    }
    // zip the mirror seam so left and right halves meet
    for (let y = -1.65 * S; y <= 1.65 * S; y += sp * 0.85) {
      emit(0, y, 0.05 * S, r0 * 0.95, Math.abs(y) < 0.4 * S ? 4 : 0, 1, 0, 0, 0, 1, (y + 1.65 * S) / (3.3 * S), depth);
    }
    // fill the brow window above the medallion
    for (let k = 0; k < 4; k++) {
      const y0 = (0.42 + k * 0.09) * S;
      const pts: Vec3[] = [];
      for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        pts.push([t * 0.7 * S, y0 + 0.04 * S * Math.sin(t * 6.0 + k), 0.06 * S]);
      }
      ribbon(emit, pts, 3, sp * 0.85, r0, (k + 1) % 6, depth);
    }
  }

  // --- stacked chevrons (upper field), several parallel fibers each ---
  const nChev = 11;
  for (let k = 0; k < nChev; k++) {
    const y = (1.55 - k * 0.195) * S;
    const rx = (0.55 + k * 0.13) * S;
    const lift = (0.38 + 0.04 * (k % 3)) * S;
    const point = 0.35 + 0.08 * Math.sin(k * 1.3 + seed);
    const fibers = Math.max(2, Math.round((3 + (k % 3) + density) * (depth === 0 ? 1 : 0.85)));
    const col = k % 3 === 0 ? 1 : k % 3 === 1 ? 0 : 2;
    ribbon(emit, chevron(y, rx, lift, 28, point, 0.08 * S * (1 - k / nChev)), fibers, sp, r0 * (k < 3 ? 1.05 : 0.95), col, depth);
  }

  // --- lower hanging tassels / inverted chevrons ---
  for (let k = 0; k < 7; k++) {
    const y = (-0.35 - k * 0.16) * S;
    const rx = (0.45 + k * 0.14) * S;
    const fibers = Math.max(2, Math.round(3 + density * 0.8));
    ribbon(emit, chevron(y, rx, -0.28 * S, 22, 0.45, 0.04 * S), fibers, sp * 1.05, r0 * 0.92, (k + 2) % 6, depth);
  }

  // --- recursive tendrils: crown, temple, cheek, jaw, side flare ---
  const maxGen = depth === 0 ? 2 : 1;
  const sprouts: Array<[number, number, number, number, number, number]> = [
    // x, y, ang, len, bend, color
    [0.08 * S, 1.55 * S, 1.15, 0.95 * S, 0.10, 1],
    [0.28 * S, 1.50 * S, 0.95, 1.05 * S, 0.12, 0],
    [0.50 * S, 1.35 * S, 0.70, 1.00 * S, 0.14, 2],
    [0.72 * S, 1.10 * S, 0.40, 0.95 * S, 0.16, 1],
    [0.95 * S, 0.70 * S, 0.10, 0.90 * S, 0.15, 0],
    [1.05 * S, 0.25 * S, -0.25, 1.00 * S, 0.13, 2],
    [1.00 * S, -0.15 * S, -0.55, 0.95 * S, 0.12, 1],
    [0.85 * S, -0.55 * S, -0.90, 0.90 * S, 0.11, 0],
    [0.55 * S, -0.85 * S, -1.20, 0.85 * S, 0.10, 2],
    [0.22 * S, -1.10 * S, -1.45, 0.75 * S, 0.09, 1],
    [0.12 * S, -1.35 * S, -1.55, 0.70 * S, 0.08, 0],
  ];
  for (let i = 0; i < sprouts.length; i++) {
    const [x, y, ang, len, bend, col] = sprouts[i];
    const fibers = Math.max(2, Math.round((4 - depth) + density * 0.6));
    branch(emit, x, y, 0.06 * S, ang + 0.08 * (hash(seed + i) - 0.5), len, bend,
      fibers, sp, r0 * 1.05, col, 0, maxGen, 0.07);
  }

  // --- side swirl (dense cheek / wing), right half only ---
  for (let s = 0; s < 3; s++) {
    const pts = curve(0.55 * S, (0.35 - s * 0.28) * S, 0.05 * S, 0.15 - s * 0.25, (1.15 - s * 0.1) * S, 0.18, 26, 0.08);
    ribbon(emit, pts, Math.max(3, Math.round(5 + density)), sp * 0.92, r0, (s + 2) % 6, depth);
  }

  // --- packed bubble clusters (small, many, not two giant eyeballs) ---
  const nL = Math.max(0.15, lobes);
  const spots: Array<[number, number, number, number]> = [
    [0.0, 0.15, 0.16, 0],      // centre medallion
    [0.0, 0.55, 0.10, 2],
    [0.28, 0.05, 0.08, 4],
    [0.22, 0.85, 0.07, 1],
    [0.55, 0.45, 0.07, 3],
    [0.70, -0.05, 0.06, 5],
    [0.42, -0.45, 0.06, 2],
    [0.18, -0.15, 0.07, 0],
    [0.90, 0.85, 0.055, 1],
    [0.0, 1.25, 0.08, 4],
    [0.35, 1.45, 0.06, 3],
    [0.0, -0.7, 0.06, 5],
  ];
  for (const [x, y, R, col] of spots) {
    const rad = R * S * (0.7 + 0.7 * nL);
    const cnt = Math.round((9 + 10 * nL * density) * (depth === 0 ? 1 : 0.7));
    cluster(emit, x * S, y * S, 0.12 * S + 0.04 * hash(x * 4 + seed), rad, cnt, col, depth);
  }

  // --- self-similar inner copy, so zooming in reveals a smaller medallion ---
  if (depth === 0) {
    const innerBudget = Math.floor(budget * 0.28);
    const inner = buildHalf(density * 1.05, lobes, seed + 2.7, innerBudget, scale * 0.40, 1);
    for (let i = 0; i < inner.length; i += STRIDE) {
      if (dst.length / STRIDE >= budget) break;
      // sit the inner copy in the central well, slightly forward
      dst.push(inner[i], inner[i + 1], inner[i + 2] + 0.08 * S,
        inner[i + 3], inner[i + 4], inner[i + 5], inner[i + 6], inner[i + 7],
        inner[i + 8], inner[i + 9], inner[i + 10], inner[i + 11] + 1);
    }
  }
  return dst;
}

function buildMask(density: number, lobes: number, seed: number, budget: number) {
  const dst = buildHalf(density, lobes, seed, budget, 1, 0);
  // scale to fill a 16:9 frame without clipping the crown
  let maxX = 0.001, maxY = 0.001;
  for (let i = 0; i < dst.length; i += STRIDE) {
    maxX = Math.max(maxX, Math.abs(dst[i]));
    maxY = Math.max(maxY, Math.abs(dst[i + 1]));
  }
  const s = Math.min(2.65 / maxX, 1.52 / maxY);
  for (let i = 0; i < dst.length; i += STRIDE) {
    dst[i] *= s; dst[i + 1] *= s; dst[i + 2] *= s; dst[i + 3] *= s;
  }
  return new Float32Array(dst);
}

function mirrorAndFold(base: Float32Array, fold: number) {
  const bi: number[] = [];
  for (let i = 0; i < base.length; i += STRIDE) {
    const x = base[i], y = base[i + 1], z = base[i + 2], r = base[i + 3], c = base[i + 4];
    const nx = base[i + 5], ny = base[i + 6], nz = base[i + 7], tx = base[i + 8], ty = base[i + 9];
    const along = base[i + 10], gen = base[i + 11];
    if (x < -0.02) continue;
    bi.push(x, y, z, r, c, nx, ny, nz, tx, ty, along, gen);
    if (x > 0.02) bi.push(-x, y, z, r, c, -nx, ny, nz, -tx, ty, along, gen);
  }
  const angles = fold >= 8 ? [0, Math.PI / 4, Math.PI / 2, 3 * Math.PI / 4] : fold >= 4 ? [0, Math.PI / 2] : [0];
  if (angles.length === 1) return new Float32Array(bi);
  const src: number[] = [];
  for (let i = 0; i < bi.length; i += STRIDE) {
    const x = bi[i], y = bi[i + 1], z = bi[i + 2], r = bi[i + 3], c = bi[i + 4];
    const nx = bi[i + 5], ny = bi[i + 6], nz = bi[i + 7], tx = bi[i + 8], ty = bi[i + 9];
    const along = bi[i + 10], gen = bi[i + 11];
    for (const ang of angles) {
      const ca = Math.cos(ang), sa = Math.sin(ang);
      if (src.length / STRIDE >= MAX) return new Float32Array(src);
      src.push(x * ca - y * sa, x * sa + y * ca, z, r, c,
        nx * ca - ny * sa, nx * sa + ny * ca, nz,
        tx * ca - ty * sa, tx * sa + ty * ca, along, gen);
    }
  }
  return new Float32Array(src);
}

const VS = `#version 300 es
layout(location=0) in vec2 aCorner;
layout(location=1) in vec4 aPosR;
layout(location=2) in vec4 aCN;
layout(location=3) in vec4 aFlow;
uniform mat4 uVP; uniform vec3 uCamPos, uCamR, uCamU;
uniform float uTime, uBreathe, uGrow, uFlow;
out vec2 vQ; out vec3 vC; out float vRad; flat out int vCol;
void main(){
  float along = aFlow.z;
  float gen = aFlow.w;
  vec3 N = vec3(aCN.y, aCN.z, aCN.w);
  vec3 T = vec3(aFlow.x, aFlow.y, 0.0);
  float tlen = length(T); if (tlen > 1e-5) T /= tlen;
  // organic curl, outward flow, and a travelling grow pulse along each strand
  float curl = uGrow * 0.055 * sin(uTime * 1.15 + along * 8.0 + gen * 1.7);
  float flow = uFlow * 0.07 * sin(uTime * 0.85 - along * 10.0 + gen);
  float pulse = 0.85 + 0.15 * uGrow * (0.5 + 0.5 * sin(uTime * 0.65 + along * 6.28318));
  float br = 1.0 + 0.035 * uBreathe * sin(uTime * 1.12 + aPosR.x * 1.1 + aPosR.y * 0.8);
  vec3 C = aPosR.xyz;
  C += N * curl + T * flow;
  C *= br * pulse;
  C.z += 0.035 * uBreathe * sin(uTime * 1.3 + along * 7.0);
  float rad = aPosR.w * br * (0.9 + 0.1 * pulse);
  vC = C; vRad = rad; vCol = int(aCN.x + 0.5); vQ = aCorner;
  vec3 w = C + (uCamR * aCorner.x + uCamU * aCorner.y) * rad * 1.6;
  gl_Position = uVP * vec4(w, 1.0);
}`;

const FS = `#version 300 es
precision highp float;
in vec2 vQ; in vec3 vC; in float vRad; flat in int vCol; out vec4 o;
uniform mat4 uVP; uniform vec3 uCamPos; uniform vec3 uPal[6]; uniform float uGloss, uIrid;
${STUDIO_GLSL}
${PCF_GLSL}
void main(){
  float d = dot(vQ, vQ);
  if (d > 1.0) discard;
  vec3 N = normalize(vec3(vQ, sqrt(max(1e-5, 1.0 - d))));
  vec3 V = normalize(uCamPos - vC);
  vec3 up = abs(V.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 R = normalize(cross(up, V));
  vec3 U = cross(V, R);
  vec3 NW = normalize(R * N.x + U * N.y + V * N.z);
  vec3 alb = uPal[vCol % 6];
  float rough = clamp(0.14 / max(uGloss, 0.2), 0.05, 0.4);
  vec3 f0 = mix(vec3(0.06), alb, 0.20 + 0.3 * uIrid);
  float ao = 0.32 + 0.68 * N.z;
  float sh = shadowAt(vC, NW);
  vec3 col = studioShade(vC, NW, V, alb, rough, f0, ao, sh, 0.45);
  col += alb * 0.18 * pow(max(N.z, 0.0), 6.0);
  col *= 0.82 + 0.18 * sh;
  if (uIrid > 0.01) col += thinFilm(max(dot(NW, V), 0.0)) * uIrid * 0.16;
  vec3 H = vC + NW * vRad;
  vec4 clip = uVP * vec4(H, 1.0);
  gl_FragDepth = clip.z / clip.w * 0.5 + 0.5;
  o = vec4(col, length(uCamPos - H));
}`;

const SH_VS = `#version 300 es
layout(location=0) in vec2 aCorner;
layout(location=1) in vec4 aPosR;
layout(location=2) in vec4 aCN;
layout(location=3) in vec4 aFlow;
uniform mat4 uVP; uniform vec3 uCamPos, uCamR, uCamU;
uniform float uTime, uBreathe, uGrow, uFlow;
out vec2 vQ; out vec3 vC; out float vRad;
void main(){
  float along = aFlow.z; float gen = aFlow.w;
  vec3 N = vec3(aCN.y, aCN.z, aCN.w);
  vec3 T = vec3(aFlow.x, aFlow.y, 0.0);
  float tlen = length(T); if (tlen > 1e-5) T /= tlen;
  float curl = uGrow * 0.055 * sin(uTime * 1.15 + along * 8.0 + gen * 1.7);
  float flow = uFlow * 0.07 * sin(uTime * 0.85 - along * 10.0 + gen);
  float pulse = 0.85 + 0.15 * uGrow * (0.5 + 0.5 * sin(uTime * 0.65 + along * 6.28318));
  float br = 1.0 + 0.035 * uBreathe * sin(uTime * 1.12 + aPosR.x * 1.1 + aPosR.y * 0.8);
  vec3 C = aPosR.xyz + N * curl + T * flow;
  C *= br * pulse;
  float rad = aPosR.w * br * (0.9 + 0.1 * pulse);
  vC = C; vRad = rad; vQ = aCorner;
  vec3 w = C + (uCamR * aCorner.x + uCamU * aCorner.y) * rad * 1.6;
  gl_Position = uVP * vec4(w, 1.0);
}`;

const SH_FS = `#version 300 es
precision highp float;
in vec2 vQ; in vec3 vC; in float vRad;
uniform mat4 uVP; uniform vec3 uCamPos;
void main(){
  float d = dot(vQ, vQ);
  if (d > 1.0) discard;
  vec3 N = normalize(vec3(vQ, sqrt(max(1e-5, 1.0 - d))));
  vec3 V = normalize(uCamPos - vC);
  vec3 up = abs(V.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 R = normalize(cross(up, V));
  vec3 U = cross(V, R);
  vec3 NW = normalize(R * N.x + U * N.y + V * N.z);
  vec3 H = vC + NW * vRad;
  vec4 clip = uVP * vec4(H, 1.0);
  gl_FragDepth = clip.z / clip.w * 0.5 + 0.5;
}`;

const BACK_FS = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o;
void main(){ o = vec4(0.0, 0.0, 0.0, 1000.0); }`;

const FRINGE_FS = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o;
uniform sampler2D uTex; uniform float uFringe; uniform vec2 uRes;
void main(){
  vec2 px = 1.0 / uRes;
  vec4 c = texture(uTex, vUv);
  if (uFringe < 0.001) { o = c; return; }
  float l = dot(c.rgb, vec3(0.3, 0.59, 0.11));
  float e = abs(l - dot(texture(uTex, vUv + vec2(px.x * 2.0, 0.0)).rgb, vec3(0.3, 0.59, 0.11)));
  float w = uFringe * (0.22 + 1.4 * e);
  float r = texture(uTex, vUv + vec2(w * px.x, 0.0)).r;
  float b = texture(uTex, vUv - vec2(w * px.x, 0.0)).b;
  o = vec4(r, c.g, b, c.a);
}`;

export class MandalaScene implements PhysScene {
  name = 'Mirror Mandala'; ready = true; error: string | null = null; stats: Record<string, any> = {};
  private p: Prog; private sh: Prog; private back: Prog; private fringe: Prog;
  private vao: WebGLVertexArrayObject; private inst: WebGLBuffer;
  private ms: MsTarget; private sm: ShadowMap; private fringeFb: FB | null = null; private t = 0;
  private folded: Float32Array = new Float32Array(0);
  private lastKey = '';
  private nInst = 0;
  constructor(private gl: WebGL2RenderingContext) {
    const quad = new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]);
    this.vao = gl.createVertexArray()!; gl.bindVertexArray(this.vao);
    const qb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, qb); gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.inst = gl.createBuffer()!; gl.bindBuffer(gl.ARRAY_BUFFER, this.inst);
    gl.bufferData(gl.ARRAY_BUFFER, MAX * STRIDE * 4, gl.DYNAMIC_DRAW);
    const stride = STRIDE * 4;
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, stride, 0); gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, stride, 16); gl.vertexAttribDivisor(2, 1);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, stride, 32); gl.vertexAttribDivisor(3, 1);
    gl.bindVertexArray(null);
    this.p = compile(gl, VS, FS, 'mandala');
    this.sh = compile(gl, SH_VS, SH_FS, 'mandala-shadow');
    this.back = compile(gl, QUAD_VS, BACK_FS, 'mandala-back');
    this.fringe = compile(gl, QUAD_VS, FRINGE_FS, 'mandala-fringe');
    this.ms = new MsTarget(gl, 4);
    this.sm = new ShadowMap(gl, 2048);
  }
  load() { this.ready = true; }
  private animU(u: Record<string, WebGLUniformLocation | null>, P: Record<string, any>) {
    const gl = this.gl;
    gl.uniform1f(u.uTime, this.t);
    gl.uniform1f(u.uBreathe, P.mmBreathe ?? 1);
    gl.uniform1f(u.uGrow, P.mmGrow ?? 1);
    gl.uniform1f(u.uFlow, P.mmFlow ?? 1);
  }
  private rebuild(P: Record<string, any>) {
    const density = P.mmDensity ?? 1;
    const lobes = P.mmLobes ?? 1;
    const sym = P.mmSym ?? 'Bilateral';
    const fold = sym === '8-fold' ? 8 : sym === '4-fold' ? 4 : 2;
    const key = `${density}|${lobes}|${fold}`;
    if (key === this.lastKey && this.folded.length) return;
    this.lastKey = key;
    const budget = Math.floor(MAX / fold);
    const base = buildMask(density, lobes, 7.3, budget);
    this.folded = mirrorAndFold(base, fold);
    this.nInst = Math.min(MAX, Math.floor(this.folded.length / STRIDE));
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.inst);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.folded.subarray(0, this.nInst * STRIDE));
  }
  render(f: PhysFrame) {
    const gl = this.gl; const P = f.params as Record<string, any>;
    if (!P.paused) this.t += Math.min(0.1, f.dt) * (P.speed ?? 1);
    this.rebuild(P);
    const t = this.t;
    // slow looping inward zoom (cosine ease, seamless)
    const zCycle = 0.5 - 0.5 * Math.cos(t * 0.14 * (P.mmZoom ?? 1));
    const dist = 3.95 - zCycle * 1.0;
    const eye: Vec3 = [Math.sin(t * 0.04) * 0.08, 0.04, dist];
    const tgt: Vec3 = [0, 0.02, 0];
    const view = lookAt(eye, tgt); const proj = perspective((P.fov ?? 40) * Math.PI / 180, f.aspect, 0.1, 24); const vp = mul(proj, view);
    const fwd = norm([tgt[0] - eye[0], tgt[1] - eye[1], tgt[2] - eye[2]]);
    const right = norm([fwd[2], 0, -fwd[0]]);
    const up: Vec3 = [right[1] * fwd[2] - right[2] * fwd[1], right[2] * fwd[0] - right[0] * fwd[2], right[0] * fwd[1] - right[1] * fwd[0]];
    const Ld = dirFromAzEl(P.keyAz ?? -24, P.keyEl ?? 48);
    const lightPos: Vec3 = [Ld[0] * 8, Ld[1] * 8, Ld[2] * 8];
    const lUp: Vec3 = Math.abs(Ld[1]) > 0.95 ? [0, 0, 1] : [0, 1, 0];
    const lview = lookAt(lightPos, [0, 0, 0], lUp);
    const lvp = mul(ortho(-3.4, 3.4, -3.4, 3.4, 1, 20), lview);
    const lFwd = norm([-Ld[0], -Ld[1], -Ld[2]]);
    const lRight = norm([lFwd[2], 0, -lFwd[0]]);
    const lRightU: Vec3 = Math.abs(lFwd[1]) > 0.9 ? [1, 0, 0] : lRight;
    const lUpV: Vec3 = [lRightU[1] * lFwd[2] - lRightU[2] * lFwd[1], lRightU[2] * lFwd[0] - lRightU[0] * lFwd[2], lRightU[0] * lFwd[1] - lRightU[1] * lFwd[0]];
    const look = lookOf(P.look ?? 'Cobalt Orange');
    const env = { look, L: Ld, F: dirFromAzEl((P.keyAz ?? -24) + 130, 18), fwd };
    const pal = MANDALA_PALETTES[P.mmPalette] ?? MANDALA_PALETTES['Poison Garden'];

    gl.bindVertexArray(this.vao);
    this.sm.begin(); gl.disable(gl.CULL_FACE);
    gl.useProgram(this.sh.p); this.animU(this.sh.u, P);
    gl.uniformMatrix4fv(this.sh.u.uVP, false, lvp);
    gl.uniform3fv(this.sh.u.uCamPos, lightPos); gl.uniform3fv(this.sh.u.uCamR, lRightU); gl.uniform3fv(this.sh.u.uCamU, lUpV);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.nInst);
    this.sm.end();

    this.ms.ensure(f.w, f.h); this.ms.begin(1000);
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
    gl.useProgram(this.back.p); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.depthFunc(gl.LESS); gl.disable(gl.CULL_FACE);
    const u = this.p.u; gl.useProgram(this.p.p);
    setStudioEnv(gl, u, env); this.animU(u, P);
    gl.uniformMatrix4fv(u.uVP, false, vp);
    gl.uniform3fv(u.uCamPos, eye); gl.uniform3fv(u.uCamR, right); gl.uniform3fv(u.uCamU, up);
    gl.uniform1f(u.uGloss, P.gloss ?? 1.15); gl.uniform1f(u.uIrid, P.irid ?? 0.4);
    const pa = new Float32Array(18); pal.slice(0, 6).forEach((h, i) => pa.set(srgbHex(h), i * 3));
    gl.uniform3fv(u.uPal, pa);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.sm.tex); gl.uniform1i(u.uShadow, 3);
    gl.uniformMatrix4fv(u.uLightVP, false, lvp); gl.uniform1f(u.uShadowSoft, 2.0); gl.uniform1f(u.uShadowTexel, 1 / 2048);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.nInst);
    gl.bindVertexArray(null); gl.disable(gl.DEPTH_TEST); gl.activeTexture(gl.TEXTURE0);
    const tex = this.ms.resolve();
    if (!this.fringeFb || this.fringeFb.w !== f.w || this.fringeFb.h !== f.h) this.fringeFb = fbo(gl, f.w, f.h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fringeFb.f); gl.viewport(0, 0, f.w, f.h);
    gl.useProgram(this.fringe.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(this.fringe.u.uTex, 0);
    gl.uniform1f(this.fringe.u.uFringe, (P.mmFringe ?? 1) * 1.15); gl.uniform2f(this.fringe.u.uRes, f.w, f.h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    f.dof(this.fringeFb.t, f.target, f.w, f.h, dist * 0.92, P.dof ?? 0.1);
    this.stats = { ready: true, beads: this.nInst, fold: P.mmSym ?? 'Bilateral' };
  }
}
