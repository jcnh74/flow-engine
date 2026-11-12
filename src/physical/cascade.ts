// Pass 5 "Gravity — Cascade": thousands of balls surging toward the camera down a deep 3D cascade of terraces.
// Live CPU sim (uniform-grid hashing, ~4k balls, 2 substeps) + WebGL2 renderer: instanced spheres, 4096 PCF
// cast shadows from a back key (rim light), top-down contact-AO splats on every surface, per-ball neighbour
// occlusion and an approximate neighbour-colour reflection term, a planar-reflection lacquer floor, glossy
// clear-coat terraces, palette fog for atmospheric depth, DOF from the shared post.
// Original MIT-licensed work for flow-engine. No Shadertoy code.
import { SECTIONS, SECTION_ORDER } from './balls_sim';
import { compile, MsTarget, ShadowMap, STUDIO_GLSL, PCF_GLSL, setStudioEnv, lookOf, lookAt, perspective, ortho, mul, norm, srgbHex,
  type PhysFrame, type PhysScene, type Prog, type Vec3 } from './common';

// ---------------- layout ----------------
const K = 6;                 // terraces, back (k=0, highest) to front
const STEP = 1.3;            // drop per terrace
const TILT = 0.105;          // forward tilt of each terrace (rad, front edge lower)
const HALF_W = 6.0;          // half width of the run
const TIER_HL = 2.1;         // half depth of a terrace
const Z0 = -21;              // centre z of the back terrace
const FLOOR_Z1 = 10;         // front edge of the floor (balls roll off toward the lens)
export const CASCADE_N = 4200;

export type Col = { sph: boolean; cx: number; cy: number; cz: number; bx: number; by: number; bz: number; rad: number; ct: number; st: number; z0: number; z1: number; mat: number; vis: boolean };
function tierTop(k: number) { return STEP * (K - k) + 0.1; }
function buildLayout(): Col[] {
  const L: Col[] = [];
  const box = (cx: number, cy: number, cz: number, bx: number, by: number, bz: number, rad: number, tilt: number, mat: number, vis = true) => {
    const ext = Math.hypot(by + rad, bz + rad);
    L.push({ sph: false, cx, cy, cz, bx, by, bz, rad, ct: Math.cos(tilt), st: Math.sin(tilt), z0: cz - ext, z1: cz + ext, mat, vis });
  };
  const rot = (t: number, y: number, z: number): [number, number] => [y * Math.cos(t) - z * Math.sin(t), y * Math.sin(t) + z * Math.cos(t)];
  for (let k = 0; k < K; k++) {
    const T = tierTop(k), zc = Z0 + k * 4.2, rad = 0.24;
    const hy = (T + 1.6) / 2; const by = hy - rad;
    const [oy, oz] = rot(TILT, hy, 0);
    const cy = T - oy, cz = zc - oz;
    box(0, cy, cz, HALF_W - rad, by, TIER_HL - rad, rad, TILT, k % 2);
    // low rounded rails on both sides, riding the terrace
    for (const sx of [-1, 1]) { const [ry, rz] = rot(TILT, hy + 0.12, 0); box(sx * (HALF_W + 0.16), cy + ry, cz + rz, 0.1, 0.3, TIER_HL - 0.1, 0.1, TILT, 2); }
  }
  // floor (lacquer pool) — top at y = 0
  box(0, -0.65, -7, 9.5, 0.5, 17 - 0.15, 0.15, 0, 3);
  // domes the flow splits around
  const dome = (x: number, k: number, R: number) => { const zc = Z0 + k * 4.2 + 0.4; const T = tierTop(k) - Math.tan(TILT) * 0.4; L.push({ sph: true, cx: x, cy: T - R * 0.45, cz: zc, bx: 0, by: 0, bz: 0, rad: R, ct: 1, st: 0, z0: zc - R, z1: zc + R, mat: 4, vis: true }); };
  dome(-2.9, 1, 0.95); dome(2.9, 1, 0.95); dome(0, 3, 1.15); dome(-3.6, 4, 0.8); dome(3.6, 4, 0.8);
  L.push({ sph: true, cx: -2.2, cy: -0.55, cz: 5.0, bx: 0, by: 0, bz: 0, rad: 1.0, ct: 1, st: 0, z0: 4.0, z1: 6.0, mat: 4, vis: true });
  L.push({ sph: true, cx: 3.0, cy: -0.6, cz: 2.6, bx: 0, by: 0, bz: 0, rad: 0.9, ct: 1, st: 0, z0: 1.7, z1: 3.5, mat: 4, vis: true });
  return L;
}

// ---------------- sim ----------------
export class CascadeSim {
  N: number; px: Float32Array; py: Float32Array; pz: Float32Array; vx: Float32Array; vy: Float32Array; vz: Float32Array; r: Float32Array;
  alive: Uint8Array; mat: Uint8Array; col: Float32Array; occ: Float32Array; ncol: Float32Array; gap: Float32Array;
  cols = buildLayout(); t = 0; wave = 0; stats = { stepMs: 0, contacts: 0, alive: 0 };
  private seed = 1234567; private dead: number[] = []; private spawnLeft = 0; private nextWave = 0;
  private cellStart: Int32Array; private cellCount: Int32Array; private sorted: Int32Array; private keys: Int32Array;
  private static T = 1 << 15; private static H = 0.36;
  private pal: number[][][];
  constructor(N = CASCADE_N) {
    this.N = N; const f = () => new Float32Array(N);
    this.px = f(); this.py = f(); this.pz = f(); this.vx = f(); this.vy = f(); this.vz = f(); this.r = f(); this.gap = f();
    this.alive = new Uint8Array(N); this.mat = new Uint8Array(N); this.col = new Float32Array(N * 3); this.occ = new Float32Array(N * 4); this.ncol = new Float32Array(N * 3);
    this.cellStart = new Int32Array(CascadeSim.T); this.cellCount = new Int32Array(CascadeSim.T); this.sorted = new Int32Array(N); this.keys = new Int32Array(N);
    this.pal = SECTION_ORDER.map((k) => SECTIONS[k].map((h) => srgbHex(h) as unknown as number[]));
    for (let i = 0; i < N; i++) { this.dead.push(i); const u = this.rnd(); this.r[i] = 0.12 + 0.07 * u * u; }
  }
  rnd() { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647; }
  /** One surge: up to ~1000 balls released across the back terrace, coloured by the current palette section. */
  private spawnOne() {
    const i = this.dead.pop(); if (i === undefined) return;
    const sec = this.wave % this.pal.length; const p = this.pal[this.rnd() < 0.82 ? sec : (sec + 1) % this.pal.length];
    const c = p[Math.floor(this.rnd() * p.length) % p.length]; this.col[i * 3] = c[0]; this.col[i * 3 + 1] = c[1]; this.col[i * 3 + 2] = c[2];
    const m = this.rnd(); this.mat[i] = m < 0.68 ? 0 : m < 0.8 ? 1 : m < 0.95 ? 2 : 3;   // gloss / satin / pearl / glass
    this.px[i] = (this.rnd() * 2 - 1) * (HALF_W - 0.4); this.pz[i] = Z0 - 1.6 + this.rnd() * 1.4; this.py[i] = tierTop(0) + 0.5 + this.rnd() * 1.6;
    this.vx[i] = (this.rnd() - 0.5) * 0.4; this.vy[i] = -0.5; this.vz[i] = 2.2 + this.rnd() * 0.6; this.alive[i] = 1; this.gap[i] = 1;
  }
  step(dt: number, sub = 2, gather = true) {
    const t0 = performance.now();
    // wave emitter: every 2.8 s a fresh surge
    if (this.t >= this.nextWave) { this.wave++; this.nextWave = this.t + 3.2; this.spawnLeft = Math.min(this.dead.length, 1000); }
    if (this.spawnLeft > 0) { const n = Math.min(this.spawnLeft, Math.ceil(1000 * dt / 0.45)); for (let k = 0; k < n; k++) this.spawnOne(); this.spawnLeft -= n; }
    const h = dt / sub; let contacts = 0;
    for (let s = 0; s < sub; s++) contacts = this.substep(h, gather && s === sub - 1);
    this.t += dt;
    let a = 0; for (let i = 0; i < this.N; i++) a += this.alive[i];
    this.stats = { stepMs: performance.now() - t0, contacts, alive: a };
  }
  private substep(h: number, gather: boolean): number {
    const { N, px, py, pz, vx, vy, vz, r, alive } = this; const cols = this.cols;
    const drag = 1 - 0.18 * h;
    for (let i = 0; i < N; i++) {
      if (!alive[i]) continue;
      vy[i] -= 9.8 * h; vx[i] *= drag; vy[i] *= drag; vz[i] *= drag;
      // gentle current across the floor so the surge keeps coming at the lens
      if (py[i] < 1.2 && pz[i] > 1.5) vz[i] += 2.2 * h;
      px[i] += vx[i] * h; py[i] += vy[i] * h; pz[i] += vz[i] * h;
      let gmin = 9;
      for (let c = 0; c < cols.length; c++) {
        const C = cols[c]; const ri = r[i]; if (pz[i] < C.z0 - ri || pz[i] > C.z1 + ri) continue;
        let nx: number, ny: number, nz: number, d: number;
        if (C.sph) {
          const dx = px[i] - C.cx, dy = py[i] - C.cy, dz = pz[i] - C.cz; const l = Math.hypot(dx, dy, dz) || 1e-6;
          d = l - C.rad; nx = dx / l; ny = dy / l; nz = dz / l;
        } else {
          const dx = px[i] - C.cx, wy = py[i] - C.cy, wz = pz[i] - C.cz;
          const ly = wy * C.ct + wz * C.st, lz = -wy * C.st + wz * C.ct;
          if (Math.abs(dx) > C.bx + C.rad + ri + 0.01 || Math.abs(ly) > C.by + C.rad + ri + 0.01) continue;
          const qx = Math.max(-C.bx, Math.min(C.bx, dx)), qy = Math.max(-C.by, Math.min(C.by, ly)), qz = Math.max(-C.bz, Math.min(C.bz, lz));
          let ex = dx - qx, ey = ly - qy, ez = lz - qz; let l = Math.hypot(ex, ey, ez);
          if (l < 1e-6) { ex = 0; ey = 1; ez = 0; l = 1; d = -(C.by - ly) - C.rad; } else d = l - C.rad;
          ex /= l; ey /= l; ez /= l;
          nx = ex; ny = ey * C.ct - ez * C.st; nz = ey * C.st + ez * C.ct;
        }
        const pen = r[i] - d; gmin = Math.min(gmin, -pen);
        if (pen > 0) {
          px[i] += nx * pen; py[i] += ny * pen; pz[i] += nz * pen;
          const vn = vx[i] * nx + vy[i] * ny + vz[i] * nz;
          if (vn < 0) {
            const e = 1.45; vx[i] -= e * vn * nx; vy[i] -= e * vn * ny; vz[i] -= e * vn * nz;
            const f = 1 - 1.2 * h; const vn2 = vx[i] * nx + vy[i] * ny + vz[i] * nz;
            vx[i] = (vx[i] - vn2 * nx) * f + vn2 * nx; vy[i] = (vy[i] - vn2 * ny) * f + vn2 * ny; vz[i] = (vz[i] - vn2 * nz) * f + vn2 * nz;
          }
        }
      }
      this.gap[i] = gmin;
      if (pz[i] > FLOOR_Z1 + 0.8 || py[i] < -2.5 || Math.abs(px[i]) > 12) { alive[i] = 0; this.dead.push(i); py[i] = -100; }
    }
    // ---- ball-ball (uniform grid, counting sort into a hashed table)
    const T = CascadeSim.T, H = CascadeSim.H, cs = this.cellStart, cc = this.cellCount, so = this.sorted, ky = this.keys;
    cc.fill(0);
    const hk = (ix: number, iy: number, iz: number) => (((ix * 73856093) ^ (iy * 19349663) ^ (iz * 83492791)) >>> 0) & (T - 1);
    for (let i = 0; i < N; i++) { if (!alive[i]) { ky[i] = -1; continue; } const k = hk(Math.floor(px[i] / H), Math.floor(py[i] / H), Math.floor(pz[i] / H)); ky[i] = k; cc[k]++; }
    let acc = 0; for (let k = 0; k < T; k++) { cs[k] = acc; acc += cc[k]; cc[k] = 0; }
    for (let i = 0; i < N; i++) { const k = ky[i]; if (k >= 0) { so[cs[k] + cc[k]] = i; cc[k]++; } }
    const occ = this.occ, ncol = this.ncol, col = this.col;
    if (gather) { occ.fill(0); ncol.fill(0); }
    let contacts = 0;
    for (let i = 0; i < N; i++) {
      if (!alive[i]) continue;
      const ix = Math.floor(px[i] / H), iy = Math.floor(py[i] / H), iz = Math.floor(pz[i] / H);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
        const k = hk(ix + a, iy + b, iz + c); const s0 = cs[k], s1 = s0 + cc[k];
        for (let q = s0; q < s1; q++) {
          const j = so[q]; if (j <= i) continue;
          const dx = px[j] - px[i], dy = py[j] - py[i], dz = pz[j] - pz[i]; const R = r[i] + r[j];
          const d2 = dx * dx + dy * dy + dz * dz; const near = R + 0.08;
          if (d2 >= near * near || d2 < 1e-10) continue;
          const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, nz = dz / d;
          if (gather) {
            const w = 1 - Math.max(0, d - R) / 0.08;
            occ[i * 4] += nx * w; occ[i * 4 + 1] += ny * w; occ[i * 4 + 2] += nz * w; occ[i * 4 + 3] += w;
            occ[j * 4] -= nx * w; occ[j * 4 + 1] -= ny * w; occ[j * 4 + 2] -= nz * w; occ[j * 4 + 3] += w;
            for (let e = 0; e < 3; e++) { ncol[i * 3 + e] += col[j * 3 + e] * w; ncol[j * 3 + e] += col[i * 3 + e] * w; }
          }
          if (d >= R) continue;
          contacts++;
          const mi = r[i] * r[i] * r[i], mj = r[j] * r[j] * r[j], wi = mj / (mi + mj), wj = 1 - wi; const pen = R - d;
          px[i] -= nx * pen * wi; py[i] -= ny * pen * wi; pz[i] -= nz * pen * wi; px[j] += nx * pen * wj; py[j] += ny * pen * wj; pz[j] += nz * pen * wj;
          const vn = (vx[j] - vx[i]) * nx + (vy[j] - vy[i]) * ny + (vz[j] - vz[i]) * nz;
          if (vn < 0) { const imp = -1.3 * vn; vx[i] -= nx * imp * wi; vy[i] -= ny * imp * wi; vz[i] -= nz * imp * wi; vx[j] += nx * imp * wj; vy[j] += ny * imp * wj; vz[j] += nz * imp * wj; }
        }
      }
    }
    return contacts;
  }
}

// ---------------- geometry ----------------
export type Geo = { pos: number[]; nrm: number[]; mat: number[]; idx: number[] };
export const newGeo = (): Geo => ({ pos: [], nrm: [], mat: [], idx: [] });
/** Rounded box (core half extents b, fillet rad) tilted about x — every edge is a true radius. */
export function rbox(g: Geo, C: Col) {
  const vals = (b: number, segMid: number) => {
    const v: number[] = []; const nb = 6;
    for (let i = 0; i < nb; i++) v.push(-b - C.rad + C.rad * i / nb);
    for (let i = 0; i <= segMid; i++) v.push(-b + 2 * b * i / segMid);
    for (let i = 1; i <= nb; i++) v.push(b + C.rad * i / nb);
    return v;
  };
  const B = [C.bx, C.by, C.bz]; const E = B.map((b) => b + C.rad);
  const ax = B.map((b) => vals(b, Math.max(2, Math.min(48, Math.ceil(2 * b / 0.35)))));
  for (let a = 0; a < 3; a++) for (const s of [-1, 1]) {
    const u = (a + 1) % 3, w = (a + 2) % 3; const U = ax[u], W = ax[w]; const base = g.pos.length / 3;
    for (const pu of U) for (const pw of W) {
      const P = [0, 0, 0]; P[a] = s * E[a]; P[u] = pu; P[w] = pw;
      const q = P.map((x, i) => Math.max(-B[i], Math.min(B[i], x)));
      let n = P.map((x, i) => x - q[i]); const l = Math.hypot(n[0], n[1], n[2]) || 1; n = n.map((x) => x / l);
      const lx = q[0] + n[0] * C.rad, ly = q[1] + n[1] * C.rad, lz = q[2] + n[2] * C.rad;
      g.pos.push(C.cx + lx, C.cy + ly * C.ct - lz * C.st, C.cz + ly * C.st + lz * C.ct);
      g.nrm.push(n[0], n[1] * C.ct - n[2] * C.st, n[1] * C.st + n[2] * C.ct); g.mat.push(C.mat);
    }
    const nw = W.length;
    for (let i = 0; i < U.length - 1; i++) for (let j = 0; j < nw - 1; j++) { const p = base + i * nw + j; g.idx.push(p, p + nw, p + nw + 1, p, p + nw + 1, p + 1); }
  }
}
export function icosphere(sub: number) {
  const t = (1 + Math.sqrt(5)) / 2;
  const v: number[][] = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map((p) => { const l = Math.hypot(p[0], p[1], p[2]); return p.map((x) => x / l); });
  let f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let s = 0; s < sub; s++) {
    const cache = new Map<string, number>(); const nf: number[][] = [];
    const mid = (a: number, b: number) => { const k = a < b ? `${a},${b}` : `${b},${a}`; let i = cache.get(k); if (i === undefined) { const p = v[a].map((x, j) => (x + v[b][j]) / 2); const l = Math.hypot(p[0], p[1], p[2]); v.push(p.map((x) => x / l)); i = v.length - 1; cache.set(k, i); } return i; };
    for (const [a, b, c] of f) { const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); nf.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
    f = nf;
  }
  return { pos: new Float32Array(v.flat()), idx: new Uint16Array(f.flat()) };
}
export function sphereGeo(g: Geo, C: Col) {
  const s = icosphere(4); const base = g.pos.length / 3;
  for (let i = 0; i < s.pos.length; i += 3) { g.pos.push(C.cx + s.pos[i] * C.rad, C.cy + s.pos[i + 1] * C.rad, C.cz + s.pos[i + 2] * C.rad); g.nrm.push(s.pos[i], s.pos[i + 1], s.pos[i + 2]); g.mat.push(C.mat); }
  for (const k of s.idx) g.idx.push(base + k);
}

// ---------------- shaders ----------------
export const FOG_GLSL = `
uniform float uFogK, uFogStart; uniform vec3 uFogTint;
vec3 fogged(vec3 col, vec3 P, vec3 cam){
  vec3 d = P - cam; float l = length(d);
  float f = 1.0 - exp(-max(l - uFogStart, 0.0)*uFogK);
  return mix(col, backdrop(normalize(d))*uFogTint, clamp(f, 0.0, 0.85));
}`;
export const SURF_VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm; layout(location=2) in float aMat;
uniform mat4 uVP; uniform float uMirror; out vec3 vW; out vec3 vN; flat out float vMat;
void main(){ vW = aPos; vN = aNrm; vMat = aMat; vec3 p = aPos; if (uMirror > 0.5) p.y = -p.y; gl_Position = uVP*vec4(p,1.0); }`;
export const SURF_FS = `#version 300 es
precision highp float;
in vec3 vW; in vec3 vN; flat in float vMat; out vec4 o;
uniform vec3 uCamPos; uniform vec3 uMatCol[5]; uniform float uMirror; uniform vec2 uRes;
uniform sampler2D uAOTex; uniform vec4 uAORect; uniform sampler2D uRefl;
${STUDIO_GLSL}
${PCF_GLSL}
${FOG_GLSL}
void main(){
  int m = int(vMat+0.5);
  if (uMirror > 0.5 && (vW.y < -0.02 || m == 3)) discard;
  vec3 N = normalize(vN); vec3 V = normalize(uCamPos - vW); if (dot(N,V) < 0.0) N = -N;
  vec3 alb = uMatCol[m];
  // 0/1 terraces: glazed lacquer; 2 rails: satin metal; 3 floor: dark mirror lacquer; 4 domes: pearl lacquer
  float rough = m<=1 ? 0.3 : m==2 ? 0.22 : m==3 ? 0.08 : 0.14;
  vec3 f0 = vec3(0.04); if (m==2) { f0 = alb; alb *= 0.15; }
  float sh = shadowAt(vW, N);
  vec2 auv = (vW.xz - uAORect.xy)/uAORect.zw;
  float contact = texture(uAOTex, auv).r * smoothstep(0.2, 0.9, N.y);
  float ao = clamp(1.0 - contact, 0.22, 1.0);
  float grain = hash12(floor(vW.xz*120.0));
  if (m<=1) alb *= 0.97 + 0.05*grain;
  vec3 col = studioShade(vW, N, V, alb, rough, f0, ao, sh*mix(1.0, 0.6, contact), 0.35);
  if (m<=1 || m==4) col += studioShade(vW, N, V, vec3(0.0), 0.05, vec3(0.04), ao, sh, 0.0)*0.6;   // clear coat
  if (m==3 && uMirror < 0.5) {
    // planar reflection (real mirrored render of balls + terraces), fresnel weighted, slightly blurred by distance
    vec2 suv = gl_FragCoord.xy/uRes; float nv = max(dot(N,V),0.0);
    float F = 0.06 + 0.94*pow(1.0-nv, 5.0);
    vec3 R = texture(uRefl, suv).rgb;
    col = col*(1.0 - 0.55*mix(0.35, 1.0, F)) + R*mix(0.35, 1.0, F)*ao;
  }
  col = fogged(col, vW, uCamPos);
  o = vec4(col, length(vW-uCamPos));
}`;
export const BALL_VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=3) in vec4 iPR; layout(location=4) in vec4 iCM; layout(location=5) in vec4 iOcc; layout(location=6) in vec4 iNC;
uniform mat4 uVP; uniform float uMirror;
out vec3 vW; out vec3 vN; flat out vec4 vCM; flat out vec4 vOcc; flat out vec4 vNC; flat out float vR;
void main(){ vec3 w = iPR.xyz + aPos*iPR.w; vW = w; vN = aPos; vCM = iCM; vOcc = iOcc; vNC = iNC; vR = iPR.w;
  vec3 p = w; if (uMirror > 0.5) p.y = -p.y; gl_Position = uVP*vec4(p,1.0); }`;
export const BALL_FS = `#version 300 es
precision highp float;
in vec3 vW; in vec3 vN; flat in vec4 vCM; flat in vec4 vOcc; flat in vec4 vNC; flat in float vR; out vec4 o;
uniform vec3 uCamPos; uniform float uMirror, uIrid;
${STUDIO_GLSL}
${PCF_GLSL}
${FOG_GLSL}
void main(){
  if (uMirror > 0.5 && vW.y < -0.02) discard;
  vec3 N = normalize(vN); vec3 V = normalize(uCamPos - vW);
  int m = int(vCM.a+0.5); vec3 alb = vCM.rgb; float nv = max(dot(N,V),1e-3);
  // neighbour occlusion (direction-weighted) + ground contact darkening of the lower hemisphere
  float cnt = vOcc.w; vec3 od = cnt > 1e-3 ? vOcc.xyz/cnt : vec3(0.0);
  float occ = clamp(cnt/5.0, 0.0, 1.0)*clamp(dot(N, normalize(od + vec3(0.0,-0.35,0.0)))*0.7 + 0.35, 0.0, 1.0);
  float grd = (1.0 - smoothstep(0.0, 2.0*vR, vNC.w)) * clamp(-N.y, 0.0, 1.0);
  float ao = clamp(1.0 - 0.72*occ - 0.5*grd, 0.18, 1.0);
  float sh = shadowAt(vW, N);
  float rough = m==0 ? 0.1 : m==1 ? 0.42 : m==2 ? 0.2 : 0.04;
  vec3 f0 = vec3(0.04);
  if (m==2) { vec3 film = thinFilm(nv); alb = mix(alb, alb*0.55 + film*0.6, 0.55*uIrid); f0 = mix(f0, film*0.3, uIrid); }
  vec3 col;
  if (m==3) {
    vec3 R = refract(-V, N, 1.0/1.5);
    vec3 trans = backdrop(normalize(R)) * mix(vec3(1.0), alb, 0.7);
    float F = 0.04 + 0.96*pow(1.0-nv, 5.0);
    col = trans*(1.0-F)*mix(0.6, 1.0, sh)*ao + envMap(reflect(-V,N), 0.03)*F + alb*pow(max(dot(-N, normalize(uLightDir)), 0.0), 6.0)*0.9*sh;
  } else {
    col = studioShade(vW, N, V, alb, rough, f0, ao, sh, 0.0);
  }
  // reflections of neighbouring balls (approximation): reflected rays that point into the crowd pick up the
  // average neighbour colour, lit by the dome/key, instead of the open environment
  vec3 Rv = reflect(-V, N); float Fr = 0.04 + 0.96*pow(1.0-nv, 5.0);
  vec3 nc = cnt > 1e-3 ? vNC.rgb/cnt : alb;
  float into = clamp(cnt/4.0, 0.0, 1.0)*smoothstep(-0.2, 0.7, dot(Rv, normalize(od + vec3(0.0,-0.25,0.0))));
  col += (nc*(uDomeCol*uDomeI*0.6 + uKeyCol*uKeyI*0.25*sh) - envMap(Rv, rough)*0.6)*Fr*into*(m==1 ? 0.4 : 1.0);
  // rim from the back key
  col += uRimCol*pow(1.0-nv, 3.0)*pow(max(dot(-V, normalize(uLightDir))*0.5+0.5, 0.0), 2.0)*0.9*(0.4 + 0.6*sh);
  col = fogged(col, vW, uCamPos);
  o = vec4(max(col, 0.0), length(vW-uCamPos));
}`;
export const BG_VS = `#version 300 es
uniform vec3 uCR, uCU, uCF; uniform vec2 uTan; out vec3 vD;
void main(){ vec2 p = vec2((gl_VertexID<<1)&2, gl_VertexID&2)*2.0-1.0; vD = uCF + uCR*p.x*uTan.x + uCU*p.y*uTan.y; gl_Position = vec4(p, 0.9999, 1.0); }`;
export const BG_FS = `#version 300 es
precision highp float; in vec3 vD; out vec4 o;
uniform vec3 uFogTint;
${STUDIO_GLSL}
void main(){ vec3 d = normalize(vD); o = vec4(backdrop(d)*uFogTint*mix(1.0, 0.62, smoothstep(0.05, 0.7, d.y)), 1000.0); }   // studio ceiling falls off: depth above the cascade`;
export const SHADOW_FS = `#version 300 es
precision mediump float; void main(){}`;
export const SPLAT_VS = `#version 300 es
layout(location=0) in vec2 aQ; layout(location=3) in vec4 iPR; layout(location=6) in vec4 iNC;
uniform vec4 uAORect; out vec2 vQ; out float vI;
void main(){ float s = iPR.w*2.4; vec2 p = iPR.xz + aQ*s; vQ = aQ; vI = exp(-max(iNC.w, 0.0)/(0.9*iPR.w));
  gl_Position = vec4((p - uAORect.xy)/uAORect.zw*2.0-1.0, 0.0, 1.0); }`;
export const SPLAT_FS = `#version 300 es
precision highp float; in vec2 vQ; in float vI; out vec4 o;
void main(){ float r2 = dot(vQ,vQ); o = vec4(vI*0.5*exp(-r2*3.0)*(1.0-smoothstep(0.75,1.0,r2)), 0.0, 0.0, 1.0); }`;

export class CascadeScene implements PhysScene {
  name = 'cascade'; ready = false; error: string | null = null; stats: Record<string, any> = {};
  sim = new CascadeSim();
  private ms: MsTarget; private msR: MsTarget; private sm: ShadowMap;
  private pSurf: Prog; private pBall: Prog; private pBg: Prog; private pShS: Prog; private pShB: Prog; private pSplat: Prog;
  private surfVao!: WebGLVertexArrayObject; private surfCount = 0;
  private ballHi!: WebGLVertexArrayObject; private ballHiCount = 0; private ballLo!: WebGLVertexArrayObject; private ballLoCount = 0;
  private splatVao!: WebGLVertexArrayObject; private inst!: WebGLBuffer; private instData: Float32Array;
  private ao: { f: WebGLFramebuffer; t: WebGLTexture } | null = null;
  private acc = 0; private prerolled = false;
  private static AO_W = 512; private static AO_H = 1280; private static AO_RECT = [-7.5, -26, 15, 37.5];
  constructor(private gl: WebGL2RenderingContext) {
    this.ms = new MsTarget(gl, 4); this.msR = new MsTarget(gl, 0); this.sm = new ShadowMap(gl, 4096);
    this.pSurf = compile(gl, SURF_VS, SURF_FS, 'cascade-surf'); this.pBall = compile(gl, BALL_VS, BALL_FS, 'cascade-ball');
    this.pBg = compile(gl, BG_VS, BG_FS, 'cascade-bg'); this.pShS = compile(gl, SURF_VS, SHADOW_FS, 'cascade-sh-s');
    this.pShB = compile(gl, BALL_VS, SHADOW_FS, 'cascade-sh-b'); this.pSplat = compile(gl, SPLAT_VS, SPLAT_FS, 'cascade-splat');
    this.instData = new Float32Array(this.sim.N * 16);
    this.build(); this.ready = true;
  }
  load() {}
  private build() {
    const gl = this.gl; const g = newGeo();
    for (const C of this.sim.cols) if (C.vis) (C.sph ? sphereGeo : rbox)(g, C);
    let vao = gl.createVertexArray()!; gl.bindVertexArray(vao);
    const vb = (d: ArrayBufferView, loc: number, n: number) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, d, gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 0, 0); };
    vb(new Float32Array(g.pos), 0, 3); vb(new Float32Array(g.nrm), 1, 3); vb(new Float32Array(g.mat), 2, 1);
    const eb = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, eb); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(g.idx), gl.STATIC_DRAW);
    this.surfVao = vao; this.surfCount = g.idx.length; gl.bindVertexArray(null);
    this.inst = gl.createBuffer()!; gl.bindBuffer(gl.ARRAY_BUFFER, this.inst); gl.bufferData(gl.ARRAY_BUFFER, this.instData.byteLength, gl.DYNAMIC_DRAW);
    const mk = (sub: number) => {
      const s = icosphere(sub); const v = gl.createVertexArray()!; gl.bindVertexArray(v);
      vb(s.pos, 0, 3);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.inst);
      for (let k = 0; k < 4; k++) { gl.enableVertexAttribArray(3 + k); gl.vertexAttribPointer(3 + k, 4, gl.FLOAT, false, 64, k * 16); gl.vertexAttribDivisor(3 + k, 1); }
      const e = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, e); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, s.idx, gl.STATIC_DRAW);
      gl.bindVertexArray(null); return { v, n: s.idx.length };
    };
    let r = mk(3); this.ballHi = r.v; this.ballHiCount = r.n; r = mk(2); this.ballLo = r.v; this.ballLoCount = r.n;
    vao = gl.createVertexArray()!; gl.bindVertexArray(vao);
    vb(new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), 0, 2);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.inst);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 64, 0); gl.vertexAttribDivisor(3, 1);
    gl.enableVertexAttribArray(6); gl.vertexAttribPointer(6, 4, gl.FLOAT, false, 64, 48); gl.vertexAttribDivisor(6, 1);
    this.splatVao = vao; gl.bindVertexArray(null);
  }
  private ensureAO() {
    const gl = this.gl; if (this.ao) return;
    const t = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, CascadeScene.AO_W, CascadeScene.AO_H, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const f = gl.createFramebuffer()!; gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    this.ao = { f, t };
  }
  private upload(): number {
    const s = this.sim, d = this.instData; let n = 0;
    for (let i = 0; i < s.N; i++) if (s.alive[i]) {
      const o = n * 16;
      d[o] = s.px[i]; d[o + 1] = s.py[i]; d[o + 2] = s.pz[i]; d[o + 3] = s.r[i];
      d[o + 4] = s.col[i * 3]; d[o + 5] = s.col[i * 3 + 1]; d[o + 6] = s.col[i * 3 + 2]; d[o + 7] = s.mat[i];
      d[o + 8] = s.occ[i * 4]; d[o + 9] = s.occ[i * 4 + 1]; d[o + 10] = s.occ[i * 4 + 2]; d[o + 11] = s.occ[i * 4 + 3];
      d[o + 12] = s.ncol[i * 3]; d[o + 13] = s.ncol[i * 3 + 1]; d[o + 14] = s.ncol[i * 3 + 2]; d[o + 15] = s.gap[i];
      n++;
    }
    const gl = this.gl; gl.bindBuffer(gl.ARRAY_BUFFER, this.inst); gl.bufferSubData(gl.ARRAY_BUFFER, 0, d, 0, n * 16);
    return n;
  }
  render(f: PhysFrame) {
    const gl = this.gl, P = f.params, look = lookOf(P.look);
    if (!this.prerolled) { for (let i = 0; i < 60 * 9; i++) this.sim.step(1 / 60, 1, false); this.prerolled = true; }
    if (!P.paused) {
      this.acc += Math.min(0.05, f.dt) * P.speed;
      let n = 0; while (this.acc >= 1 / 60 && n < 2) { this.sim.step(1 / 60, 1); this.acc -= 1 / 60; n++; }
      if (n === 2) this.acc = 0;
    }
    const nInst = this.upload();
    const t = f.time;
    // low, slightly elevated wide-angle camera looking up the cascade
    const eye: Vec3 = [0.8 * Math.sin(t * 0.06), 2.6 + 0.15 * Math.sin(t * 0.05), 12.5];
    const tgt: Vec3 = [0, 3.4, -10];
    const fovy = (P.fov ?? 46) * Math.PI / 180;
    const view = lookAt(eye, tgt); const proj = perspective(fovy, f.aspect, 0.3, 120); const vp = mul(proj, view);
    // key behind-left and high: shadows rake toward the lens, balls get a rim
    const az = (P.keyAz ?? 150) * Math.PI / 180, el = (P.keyEl ?? 42) * Math.PI / 180;
    const Ld = norm([Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)]);
    const ctr: Vec3 = [0, 3.0, -7];
    const lview = lookAt([ctr[0] + Ld[0] * 40, ctr[1] + Ld[1] * 40, ctr[2] + Ld[2] * 40], ctr);
    const lvp = mul(ortho(-17, 17, -17, 17, 5, 80), lview);
    const fwd = norm([tgt[0] - eye[0], tgt[1] - eye[1], tgt[2] - eye[2]]);
    const env = { look, L: Ld, F: norm([0.7, 0.4, 0.6]) as Vec3, fwd };
    const sl = look.slots; const matCols = new Float32Array(15);
    [sl[0], sl[2], '#d9d4cc', sl[5] ?? sl[2], sl[3]].forEach((h, i) => matCols.set(srgbHex(h), i * 3));
    // floor reads as a deep lacquer: darken it
    for (let k = 9; k < 12; k++) matCols[k] *= 0.35;
    // ---- shadow pass
    this.sm.begin(); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
    gl.useProgram(this.pShS.p); gl.uniformMatrix4fv(this.pShS.u.uVP, false, lvp); gl.uniform1f(this.pShS.u.uMirror, 0);
    gl.bindVertexArray(this.surfVao); gl.drawElements(gl.TRIANGLES, this.surfCount, gl.UNSIGNED_INT, 0);
    gl.useProgram(this.pShB.p); gl.uniformMatrix4fv(this.pShB.u.uVP, false, lvp); gl.uniform1f(this.pShB.u.uMirror, 0);
    gl.bindVertexArray(this.ballLo); gl.drawElementsInstanced(gl.TRIANGLES, this.ballLoCount, gl.UNSIGNED_SHORT, 0, nInst);
    this.sm.end();
    // ---- contact AO splats (top-down)
    this.ensureAO(); const R = CascadeScene.AO_RECT;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.ao!.f); gl.viewport(0, 0, CascadeScene.AO_W, CascadeScene.AO_H); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(this.pSplat.p); gl.uniform4fv(this.pSplat.u.uAORect, R);
    gl.bindVertexArray(this.splatVao); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, nInst);
    gl.disable(gl.BLEND);
    const fogTint: Vec3 = [1, 1, 1];
    const common = (pr: Prog, mirror: boolean, w: number, h: number) => {
      const u = pr.u; gl.useProgram(pr.p); setStudioEnv(gl, u, env);
      gl.uniformMatrix4fv(u.uVP, false, vp); gl.uniform3fv(u.uCamPos, mirror ? [eye[0], -eye[1], eye[2]] : eye);
      gl.uniform1f(u.uMirror, mirror ? 1 : 0); gl.uniform1f(u.uIrid, P.irid ?? 0.8);
      gl.uniform1f(u.uFogK, 0.02); gl.uniform1f(u.uFogStart, 16); gl.uniform3fv(u.uFogTint, fogTint);
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.sm.tex); gl.uniform1i(u.uShadow, 3); gl.uniformMatrix4fv(u.uLightVP, false, lvp);
      gl.uniform1f(u.uShadowSoft, 3.0); gl.uniform1f(u.uShadowTexel, 1 / 4096);
      if (u.uAOTex) { gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, this.ao!.t); gl.uniform1i(u.uAOTex, 4); gl.uniform4fv(u.uAORect, R); }
      if (u.uMatCol) gl.uniform3fv(u.uMatCol, matCols);
      if (u.uRes) gl.uniform2f(u.uRes, w, h);
      return u;
    };
    const drawBg = () => {
      const u = this.pBg.u; gl.useProgram(this.pBg.p); setStudioEnv(gl, u, env); gl.uniform3fv(u.uFogTint, fogTint);
      const right = norm([-fwd[2], 0, fwd[0]]) as Vec3; const up: Vec3 = [right[1] * fwd[2] - right[2] * fwd[1], right[2] * fwd[0] - right[0] * fwd[2], right[0] * fwd[1] - right[1] * fwd[0]];
      gl.uniform3fv(u.uCR, right); gl.uniform3fv(u.uCU, up); gl.uniform3fv(u.uCF, fwd); gl.uniform2f(u.uTan, Math.tan(fovy / 2) * f.aspect, Math.tan(fovy / 2));
      gl.depthMask(false); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.depthMask(true);
    };
    // ---- planar reflection (half res): balls + terraces mirrored in the floor plane y = 0
    const rw = Math.max(2, f.w >> 1), rh = Math.max(2, f.h >> 1);
    this.msR.ensure(rw, rh); this.msR.begin();
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS);
    drawBg();
    common(this.pSurf, true, rw, rh); gl.bindVertexArray(this.surfVao); gl.drawElements(gl.TRIANGLES, this.surfCount, gl.UNSIGNED_INT, 0);
    common(this.pBall, true, rw, rh); gl.bindVertexArray(this.ballLo); gl.drawElementsInstanced(gl.TRIANGLES, this.ballLoCount, gl.UNSIGNED_SHORT, 0, nInst);
    const reflTex = this.msR.resolve();
    // ---- main pass
    this.ms.ensure(f.w, f.h); this.ms.begin();
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.depthMask(true);
    drawBg();
    let u = common(this.pSurf, false, f.w, f.h); gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, reflTex); gl.uniform1i(u.uRefl, 5);
    gl.bindVertexArray(this.surfVao); gl.drawElements(gl.TRIANGLES, this.surfCount, gl.UNSIGNED_INT, 0);
    u = common(this.pBall, false, f.w, f.h); gl.bindVertexArray(this.ballHi); gl.drawElementsInstanced(gl.TRIANGLES, this.ballHiCount, gl.UNSIGNED_SHORT, 0, nInst);
    gl.disable(gl.DEPTH_TEST); gl.bindVertexArray(null); gl.activeTexture(gl.TEXTURE0);
    const tex = this.ms.resolve();
    f.dof(tex, f.target, f.w, f.h, P.focus ?? 14, P.dof ?? 0.35);
    this.stats = { balls: nInst, contacts: this.sim.stats.contacts, physicsMs: +this.sim.stats.stepMs.toFixed(2), simTime: +this.sim.t.toFixed(1), wave: this.sim.wave };
  }
}
