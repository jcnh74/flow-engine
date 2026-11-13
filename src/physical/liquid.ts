// Pass 7 "Gravity — Liquid": no room, just balls. 12k+ glossy balls behave like a viscous fluid made of balls.
// Pour heads wander above the frame and pulse out streams of colour sections. The streams coat a few floating
// chrome/pearl forms and run off a tilted lip as sheets, then neck into rivulets and drips that stretch and break.
// Sim (CPU, uniform hash grid): hard-sphere contacts plus pairwise cohesion (short-range attraction that gives
// stretching necks and pinch-off), XSPH-style viscosity (neighbour velocity blending), adhesion to the forms
// (drips hang, then let go), an analytic curl-like turbulence field and the odd clump burst for randomness.
// Fallen balls recycle into the pour heads, so it loops forever. Renderer = Cascade pieces: glossy lacquer balls,
// neighbour occlusion and colour bleed, 4096 PCF shadows, studio env reflections, DOF.
// Original MIT-licensed work for flow-engine. No Shadertoy code.
import { SECTIONS, SECTION_ORDER } from './balls_sim';
import { ROOM_ORDERS } from './colorroom';
import { rbox, sphereGeo, icosphere, newGeo, type Col, SURF_VS, SURF_FS, BALL_VS, BALL_FS, BG_VS, BG_FS, SHADOW_FS, SPLAT_VS, SPLAT_FS } from './cascade';
import { compile, MsTarget, ShadowMap, setStudioEnv, lookOf, lookAt, perspective, ortho, mul, norm, srgbHex,
  type PhysFrame, type PhysScene, type Prog, type Vec3 } from './common';

export const LIQUID_N = 12500;
// pass 8 framing: tight camera on three layers of flow in front of a leaning backdrop wall that catches their shadows
const WALL_TILT = 1.05;
export const LQ = { tgtY: 2.4, tgtZ: -1.6, camDist: 10.2, aspect: 16 / 9, frontZ: 0.3, midZ: -1.3, wallZ: -3.4, wallY: 2.4,
  wallCT: Math.cos(WALL_TILT), wallST: Math.sin(WALL_TILT), target: 9800, filmShare: 0.42, maxHeads: 15, layers: [2, 1, 0, 2, 1, 2, 1, 0, 2, 1, 2, 1, 0, 2, 1] };
export const LIQUID_BACKDROPS: Record<string, { bgTop: string; bgBottom: string; chrome: string; pearl: string; wall: string }> = {
  'Ink Studio': { bgTop: '#2a2438', bgBottom: '#0d0b14', chrome: '#c9ccd6', pearl: '#f4ece6', wall: '#7a6c84' },
  'Blush Void': { bgTop: '#ffe6ee', bgBottom: '#f3b8c9', chrome: '#e8e3ea', pearl: '#fff7f0', wall: '#e2a2b6' },
  'Deep Teal': { bgTop: '#14444c', bgBottom: '#041519', chrome: '#bfe3e0', pearl: '#f1fbf8', wall: '#3d7a7e' },
  'Sunlit Cream': { bgTop: '#fff4e2', bgBottom: '#f0d2a8', chrome: '#e6dccd', pearl: '#ffffff', wall: '#dcb88a' },
};
export type LiquidParams = { zoom: number; tanV: number; pour: number; streams: number; cohesion: number; viscosity: number; turbulence: number; drip: number; gravity: number; ballSize: number; order: string; bursts: number };
export const LIQUID_DEFAULTS: LiquidParams = { zoom: 1, tanV: Math.tan(18 * Math.PI / 180), pour: 1, streams: 15, cohesion: 1, viscosity: 1, turbulence: 1, drip: 1, gravity: 9.8, ballSize: 1, order: 'Rainbow', bursts: 1 };

function forms(): Col[] {
  const L: Col[] = [];
  const box = (cx: number, cy: number, cz: number, bx: number, by: number, bz: number, rad: number, tilt: number, mat: number) => {
    const ext = Math.hypot(by + rad, bz + rad); L.push({ sph: false, cx, cy, cz, bx, by, bz, rad, ct: Math.cos(tilt), st: Math.sin(tilt), z0: cz - ext, z1: cz + ext, mat, vis: true });
  };
  const sph = (cx: number, cy: number, cz: number, R: number, mat: number) => L.push({ sph: true, cx, cy, cz, bx: 0, by: 0, bz: 0, rad: R, ct: 1, st: 0, z0: cz - R, z1: cz + R, mat, vis: true });
  box(0, LQ.wallY, LQ.wallZ, 11, 0.12, 6.2, 0.12, WALL_TILT, 0);  // leaning backdrop wall right behind the flow: film runs down it, catches shadows
  sph(-2.0, 4.7, -1.5, 0.55, 2);                        // high chrome bead splits the mid streams
  sph(2.4, 2.2, -2.2, 0.9, 2);                          // chrome orb between mid layer and wall
  sph(-3.4, 1.0, 0.2, 0.6, 4);                          // pearl bead the front streams split around
  box(2.0, 0.6, 0.0, 1.3, 0.06, 0.7, 0.1, -0.45, 1);     // low pearl lip tipped back toward the wall
  return L;
}

export class LiquidSim {
  N: number; px: Float32Array; py: Float32Array; pz: Float32Array; vx: Float32Array; vy: Float32Array; vz: Float32Array; r: Float32Array; r0: Float32Array;
  alive: Uint8Array; mat: Uint8Array; col: Float32Array; occ: Float32Array; ncol: Float32Array; gap: Float32Array;
  cols = forms(); t = 0; stats = { stepMs: 0, contacts: 0, alive: 0, avgMs: 0, budget: 1 }; P: LiquidParams = { ...LIQUID_DEFAULTS };
  private seed = 424242; private dead: number[] = [];
  private heads: { x: number; z: number; ph: number; sec: number; acc: number; w: number }[] = [];
  film: Uint8Array = new Uint8Array(0); private cs: Int32Array; private cc: Int32Array; private so: Int32Array; private ky: Int32Array;
    private static STENCIL = (() => { const o = [0, 0, 0]; for (let z = -1; z <= 1; z++) for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) { if (x === 0 && y === 0 && z === 0) continue; if (z > 0 || (z === 0 && (y > 0 || (y === 0 && x > 0)))) o.push(x, y, z); } return o; })();
  private pal: Record<string, number[][]> = {}; private nextBurst = 3; private secTick = 0;
  constructor(N = LIQUID_N) {
    this.N = N; const f = () => new Float32Array(N);
    this.px = f(); this.py = f(); this.pz = f(); this.vx = f(); this.vy = f(); this.vz = f(); this.r = f(); this.r0 = f(); this.gap = f();
    this.alive = new Uint8Array(N); this.film = new Uint8Array(N); this.mat = new Uint8Array(N); this.col = new Float32Array(N * 3); this.occ = new Float32Array(N * 4); this.ncol = new Float32Array(N * 3);
    const NC = Math.ceil(28 / 0.26) * Math.ceil(17 / 0.26) * Math.ceil(21 / 0.26); this.cs = new Int32Array(NC); this.cc = new Int32Array(NC); this.so = new Int32Array(N); this.ky = new Int32Array(N);
    for (const k of Object.keys(SECTIONS)) this.pal[k] = SECTIONS[k].map((h) => srgbHex(h) as unknown as number[]);
    for (let i = N - 1; i >= 0; i--) { this.dead.push(i); const u = this.rnd(); this.r0[i] = 0.068 + 0.035 * u * u; this.py[i] = -100; }
    for (let k = 0; k < LQ.maxHeads; k++) this.heads.push({ x: -4 + k * 0.9, z: -1.5 + this.rnd() * 2, ph: this.rnd() * 10, sec: k, acc: 0, w: 0.8 + this.rnd() * 0.6 });
  }
  pack(d: Float32Array): number {
    let n = 0;
    for (let i = 0; i < this.N; i++) if (this.alive[i]) {
      const o = n * 16;
      d[o] = this.px[i]; d[o + 1] = this.py[i]; d[o + 2] = this.pz[i]; d[o + 3] = this.r[i] * (this.film[i] ? 1.8 : 1);   // film on the wall drawn as flattened puddles: covers with fewer balls
      d[o + 4] = this.col[i * 3]; d[o + 5] = this.col[i * 3 + 1]; d[o + 6] = this.col[i * 3 + 2]; d[o + 7] = this.mat[i];
      d[o + 8] = this.occ[i * 4]; d[o + 9] = this.occ[i * 4 + 1]; d[o + 10] = this.occ[i * 4 + 2]; d[o + 11] = this.occ[i * 4 + 3];
      d[o + 12] = this.ncol[i * 3]; d[o + 13] = this.ncol[i * 3 + 1]; d[o + 14] = this.ncol[i * 3 + 2]; d[o + 15] = this.gap[i];
      n++;
    }
    return n;
  }
  rnd() { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647; }
  private sortTick = 0;
  // cache locality: every 20 steps permute particle storage into grid-cell order (alive first) so neighbour reads hit nearby memory
  private reorder() {
    // permutation straight from the grid's counting sort (cell order, alive first): O(N), no comparator sort hitch
    const N = this.N; const idx = new Int32Array(N); let q = 0;
    const GXYZ = this.lastCells; for (let c = 0; c < GXYZ; c++) { const s0 = this.cs[c], s1 = s0 + this.cc[c]; for (let t = s0; t < s1; t++) { const i = this.so[t]; if (this.alive[i]) idx[q++] = i; } }
    const seen = new Uint8Array(N); for (let t = 0; t < q; t++) seen[idx[t]] = 1; for (let i = 0; i < N; i++) if (!seen[i]) idx[q++] = i;
    const perm1 = (a: Float32Array | Uint8Array) => { const c = a.slice(); for (let t = 0; t < N; t++) a[t] = c[idx[t]]; };
    const permK = (a: Float32Array, k: number) => { const c = a.slice(); for (let t = 0; t < N; t++) for (let m = 0; m < k; m++) a[t * k + m] = c[idx[t] * k + m]; };
    for (const a of [this.px, this.py, this.pz, this.vx, this.vy, this.vz, this.r, this.r0, this.gap, this.alive, this.mat, this.film]) perm1(a);
    permK(this.col, 3); permK(this.ncol, 3); permK(this.occ, 4);
    this.dead = []; for (let i = N - 1; i >= 0; i--) if (!this.alive[i]) this.dead.push(i);
  }
  private filmAlive = 0; private lastCells = 0; private emaMs = 8; budgetK = 1;
  private kill(i: number) { this.alive[i] = 0; this.film[i] = 0; this.dead.push(i); this.py[i] = -100; }
  private emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, sec: string) {
    const i = this.dead.pop(); if (i === undefined) return;
    const pal = this.pal[sec] ?? this.pal.coral; const s = this.P.ballSize;
    this.px[i] = x; this.py[i] = y; this.pz[i] = z; this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz; this.r[i] = this.r0[i] * s; this.alive[i] = 1; this.gap[i] = 1;
    const c = pal[Math.floor(this.rnd() * pal.length) % pal.length]; this.col[i * 3] = c[0]; this.col[i * 3 + 1] = c[1]; this.col[i * 3 + 2] = c[2];
    const m = this.rnd(); this.mat[i] = m < 0.94 ? 0 : m < 0.97 ? 1 : m < 0.995 ? 2 : 3;   // mostly lacquer: fewer odd beads in the flow
  }
  /** camera-space framing shared by the sim (frustum spawn/cull) and the scene camera */
  eyeZ() { return LQ.tgtZ + LQ.camDist * this.P.zoom; }
  private inView(x: number, y: number, z: number, m: number) {
    const dz = this.eyeZ() - z; const tv = this.P.tanV, th = tv * LQ.aspect;
    return dz > 0.6 && Math.abs(y - LQ.tgtY) < dz * tv + m && Math.abs(x) < dz * th + m;
  }
  step(dt: number, gather = true) {
    const t0 = performance.now(); const P = this.P; const order = ROOM_ORDERS[P.order] ?? SECTION_ORDER;
    this.secTick += dt; if (this.secTick > 2.6) { this.secTick = 0; const h = this.heads[Math.floor(this.rnd() * this.heads.length)]; h.sec++; }
    // pour heads in three depth layers (front stream, mid stream, back film running down the wall), spaced densely
    // across exactly the visible width at their depth so streams merge into a curtain; spawn just above the view top
    const nh = Math.max(3, Math.min(LQ.maxHeads, Math.round(P.streams)));
    const ez = this.eyeZ(), tv = P.tanV, th = tv * LQ.aspect;
    const target = Math.min(this.N - 400, LQ.target * Math.sqrt(Math.max(0.2, P.pour)) / (P.ballSize * P.ballSize)) * this.budgetK;   // fixed physics budget + governor
    // steady count: separate feedback for the wall film and the free streams so neither starves the other
    const fbOf = (n: number, tg: number) => Math.max(0.05, Math.min(2.5, 2.6 * (1 - n / tg) + 0.15));
    const fbFilm = fbOf(this.filmAlive, target * LQ.filmShare), fbStream = fbOf(this.stats.alive - this.filmAlive, target * (1 - LQ.filmShare));
    const LAY = LQ.layers; const perLayer = [0, 0, 0], idxIn: number[] = []; for (let k = 0; k < nh; k++) { idxIn.push(perLayer[LAY[k]]); perLayer[LAY[k]]++; }
    for (let k = 0; k < nh; k++) {
      const h = this.heads[k]; const layer = LAY[k], j = idxIn[k], nl = perLayer[layer];
      const tt = this.t * 0.31 * h.w + h.ph;
      const pulse = 0.55 + 0.45 * Math.max(0, Math.sin(this.t * (0.8 + 0.27 * k) + h.ph * 3) + 0.3 * Math.sin(this.t * 2.1 + k)) ** 0.8;
      const sec = order[h.sec % order.length];
      let zc = layer === 0 ? LQ.frontZ : layer === 1 ? LQ.midZ : LQ.wallZ;
      const dz = ez - zc; const halfW = dz * th * 1.04; const sp = 2 * halfW / nl;
      const x0 = -halfW + sp * (j + 0.5 + (layer === 1 ? 0.5 : 0)) + Math.sin(tt) * sp * 0.45;
      let y0 = LQ.tgtY + dz * tv + (layer === 2 ? 1.0 : 0.35);
      const rate = (layer === 2 ? 3400 : 2400) * P.pour * pulse * (layer === 2 ? fbFilm : fbStream) * (15 / nh);
      h.acc += dt * rate;
      if (layer === 2) {                                   // back film: spawn on the wall face, sliding down it
        const s_ = -(y0 - LQ.wallY) / LQ.wallST; zc = LQ.wallZ + s_ * LQ.wallCT + LQ.wallCT * 0.0 + 0.32 * LQ.wallST; y0 = LQ.wallY - s_ * LQ.wallST + 0.32 * LQ.wallCT;
      }
      const nz = layer === 2 ? 0.25 : 0.2 + 0.14 * pulse;   // narrow nozzles: streams leave packed, so cohesion keeps them one body
      while (h.acc >= 1) { h.acc -= 1;
        const xs = layer === 2 ? (this.rnd() - 0.5) * sp * 1.3 : (this.rnd() - 0.5) * 2 * nz * 1.3;
        const zs = layer === 2 ? 0 : (this.rnd() - 0.5) * 2 * nz;
        this.emit(x0 + xs, y0 + this.rnd() * 0.25, zc + zs, Math.sin(tt * 1.3) * 0.3, layer === 2 ? -1.0 : -2.2 - this.rnd() * 0.6, 0, sec); }
    }
    // the odd clump burst into the front / mid layers for a splashy beat
    if (this.t > this.nextBurst && P.bursts > 0) {
      this.nextBurst = this.t + (4 + this.rnd() * 5) / P.bursts;
      const sec = order[Math.floor(this.rnd() * order.length)]; const cz = LQ.midZ + this.rnd() * (LQ.frontZ - LQ.midZ); const dz = ez - cz;
      const cx = (this.rnd() * 2 - 1) * dz * th * 0.7; const n = Math.max(0, Math.min(700, Math.floor((target - this.stats.alive) + 400)));
      for (let k = 0; k < n; k++) { let x = 0, y = 0, z = 0; do { x = this.rnd() * 2 - 1; y = this.rnd() * 2 - 1; z = this.rnd() * 2 - 1; } while (x * x + y * y + z * z > 1);
        this.emit(cx + x * 0.7, LQ.tgtY + dz * tv + 0.9 + y * 0.7, cz + z * 0.5, x * 0.3, -5, z * 0.2, sec); }
    }
    const contacts = this.substep(dt, gather);
    if (++this.sortTick % 20 === 0) this.reorder();
    this.t += dt;
    let a = 0, fa = 0; for (let i = 0; i < this.N; i++) { a += this.alive[i]; fa += this.alive[i] & this.film[i]; } this.filmAlive = fa;
    const ms = performance.now() - t0; this.emaMs += (ms - this.emaMs) * 0.05;
    // perf governor: keep the step comfortably under one 60 Hz frame (no slow motion) by trimming the live-ball target
    if (gather) { if (this.emaMs > 13) this.budgetK = Math.max(0.55, this.budgetK * 0.996); else if (this.emaMs < 11) this.budgetK = Math.min(1, this.budgetK * 1.004); }
    this.stats = { stepMs: ms, contacts, alive: a, avgMs: this.emaMs, budget: this.budgetK };
  }
  private substep(h: number, gather: boolean): number {
    const { N, px, py, pz, vx, vy, vz, r, alive } = this; const cols = this.cols; const P = this.P;
    const g = P.gravity, drag = 1 - 2.4 * h; const turb = P.turbulence * 3.5, t = this.t;
    const adh = 7 * P.drip;
    for (let i = 0; i < N; i++) {
      if (!alive[i]) continue;
      // turbulence: divergence-light swirl from crossed sines, drifting in time
      const x = px[i], y = py[i], z = pz[i];
      const ax = Math.sin(y * 0.9 + t * 0.7) * Math.cos(z * 1.1 - t * 0.4), ay = Math.sin(z * 0.8 + t * 0.5) * Math.cos(x * 0.7 + t * 0.3) * 0.5, az = Math.sin(x * 0.85 - t * 0.6) * Math.cos(y * 0.75 + t * 0.35);
      vx[i] += (ax * turb) * h; vy[i] += (ay * turb - g) * h; vz[i] += (az * turb * 0.6) * h;
      vx[i] *= drag; vy[i] *= drag; vz[i] *= drag;
      px[i] += vx[i] * h; py[i] += vy[i] * h; pz[i] += vz[i] * h;
      let gmin = 9;
      for (let c = 0; c < cols.length; c++) {
        const C = cols[c]; const ri = r[i]; if (pz[i] < C.z0 - ri - 0.3 || pz[i] > C.z1 + ri + 0.3) continue;
        let nx: number, ny: number, nz: number, d: number;
        if (C.sph) { const dx = px[i] - C.cx, dy = py[i] - C.cy, dz = pz[i] - C.cz; const l = Math.hypot(dx, dy, dz) || 1e-6; d = l - C.rad; nx = dx / l; ny = dy / l; nz = dz / l; }
        else {
          const dx = px[i] - C.cx, wy = py[i] - C.cy, wz = pz[i] - C.cz; const ly = wy * C.ct + wz * C.st, lz = -wy * C.st + wz * C.ct;
          if (Math.abs(dx) > C.bx + C.rad + ri + 0.3 || Math.abs(ly) > C.by + C.rad + ri + 0.3) continue;
          const qx = Math.max(-C.bx, Math.min(C.bx, dx)), qy = Math.max(-C.by, Math.min(C.by, ly)), qz = Math.max(-C.bz, Math.min(C.bz, lz));
          let ex = dx - qx, ey = ly - qy, ez = lz - qz; let l = Math.hypot(ex, ey, ez);
          if (l < 1e-6) { ex = 0; ey = 1; ez = 0; l = 1; d = -(C.by - ly) - C.rad; } else d = l - C.rad;
          ex /= l; ey /= l; ez /= l; nx = ex; ny = ey * C.ct - ez * C.st; nz = ey * C.st + ez * C.ct;
        }
        const sep = d - r[i]; gmin = Math.min(gmin, sep); if (c === 0) this.film[i] = sep < 0.12 ? 1 : 0;
        if (sep < 0) {
          px[i] -= nx * sep; py[i] -= ny * sep; pz[i] -= nz * sep;
          const vn = vx[i] * nx + vy[i] * ny + vz[i] * nz;
          if (vn < 0) { const e = vn < -2.5 ? 1.25 : 1.0; vx[i] -= e * vn * nx; vy[i] -= e * vn * ny; vz[i] -= e * vn * nz; }
          const f = Math.max(0.5, 1 - (c === 0 ? 6.0 : 2.2) * h * P.viscosity); /* c 0 = backdrop wall: thick slow film */ const vn2 = vx[i] * nx + vy[i] * ny + vz[i] * nz;   // viscous wall friction: slow runny film
          vx[i] = (vx[i] - vn2 * nx) * f + vn2 * nx; vy[i] = (vy[i] - vn2 * ny) * f + vn2 * ny; vz[i] = (vz[i] - vn2 * nz) * f + vn2 * nz;
        } else if (sep < 0.25) {                    // adhesion: a thin band that holds drips until their weight wins
          const k = adh * (1 - sep / 0.25) * h; vx[i] -= nx * k; vy[i] -= ny * k; vz[i] -= nz * k;
        }
      }
      this.gap[i] = gmin;
      if (pz[i] < -9 || pz[i] > LQ.frontZ + 1.1 || !this.inView(px[i], py[i], pz[i], 0.6)) this.kill(i);   // frustum cull (+margin): no work spent off screen
    }
    // dense uniform grid (cell >= interaction range) + half-stencil pair loop: each pair visited once, no hashing
    const RANGE = 0.09; const H = Math.max(0.26, 2 * 0.103 * P.ballSize + RANGE + 0.005), OX = -14, OY = -5, OZ = -12;
    const GX = Math.ceil(28 / H), GY = Math.ceil(17 / H), GZ = Math.ceil(21 / H);
    const cs = this.cs, cc = this.cc, so = this.so, ky = this.ky; cc.fill(0, 0, GX * GY * GZ);
    for (let i = 0; i < N; i++) {
      if (!alive[i]) { ky[i] = -1; continue; }
      let cx = ((px[i] - OX) / H) | 0, cy = ((py[i] - OY) / H) | 0, cz = ((pz[i] - OZ) / H) | 0;
      cx = cx < 0 ? 0 : cx >= GX ? GX - 1 : cx; cy = cy < 0 ? 0 : cy >= GY ? GY - 1 : cy; cz = cz < 0 ? 0 : cz >= GZ ? GZ - 1 : cz;
      const k = (cz * GY + cy) * GX + cx; ky[i] = k; cc[k]++;
    }
    let acc = 0; const NC = GX * GY * GZ; this.lastCells = NC; for (let k = 0; k < NC; k++) { cs[k] = acc; acc += cc[k]; cc[k] = 0; }
    for (let i = 0; i < N; i++) { const k = ky[i]; if (k >= 0) { so[cs[k] + cc[k]] = i; cc[k]++; } }
    const occ = this.occ, ncol = this.ncol, col = this.col; const film = this.film;
    if (gather) { occ.fill(0); ncol.fill(0); }
    const coh = 20 * P.cohesion * h, visc = Math.min(0.45, 3.2 * P.viscosity * h);
    const ST = LiquidSim.STENCIL;
    let contacts = 0;
    for (let i = 0; i < N; i++) {
      const ki = ky[i]; if (ki < 0) continue;
      const cx = ki % GX, cy = ((ki / GX) | 0) % GY, cz = (ki / (GX * GY)) | 0;
      const pxi = px[i], pyi = py[i], pzi = pz[i], ri = r[i];
      for (let st = 0; st < ST.length; st += 3) {
        const nx_ = cx + ST[st], ny_ = cy + ST[st + 1], nz_ = cz + ST[st + 2];
        if (nx_ < 0 || ny_ < 0 || nz_ < 0 || nx_ >= GX || ny_ >= GY || nz_ >= GZ) continue;
        const k = (nz_ * GY + ny_) * GX + nx_; const s0 = cs[k], s1 = s0 + cc[k]; const self = st === 0;
        for (let q = s0; q < s1; q++) {
          const j = so[q]; if (self && j <= i) continue;
          const dx = px[j] - pxi, dy = py[j] - pyi, dz = pz[j] - pzi; const R = ri + r[j];
          const d2 = dx * dx + dy * dy + dz * dz; const near = R + RANGE;
          if (d2 >= near * near || d2 < 1e-10) continue;
          const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, nz = dz / d;
          const w = d > R ? 1 - (d - R) / RANGE : 1;
          if (gather) {
            occ[i * 4] += nx * w; occ[i * 4 + 1] += ny * w; occ[i * 4 + 2] += nz * w; occ[i * 4 + 3] += w;
            occ[j * 4] -= nx * w; occ[j * 4 + 1] -= ny * w; occ[j * 4 + 2] -= nz * w; occ[j * 4 + 3] += w;
            ncol[i * 3] += col[j * 3] * w; ncol[i * 3 + 1] += col[j * 3 + 1] * w; ncol[i * 3 + 2] += col[j * 3 + 2] * w;
            ncol[j * 3] += col[i * 3] * w; ncol[j * 3 + 1] += col[i * 3 + 1] * w; ncol[j * 3 + 2] += col[i * 3 + 2] * w;
          }
          // viscosity (XSPH): blend velocities of neighbours -> coherent streams, sheets and slow necks
          const vb = visc * w * 0.5; const rvx = (vx[j] - vx[i]) * vb, rvy = (vy[j] - vy[i]) * vb, rvz = (vz[j] - vz[i]) * vb;
          vx[i] += rvx; vy[i] += rvy; vz[i] += rvz; vx[j] -= rvx; vy[j] -= rvy; vz[j] -= rvz;
          if (d >= R) {                         // cohesion: pull the pair together, strongest mid-range, zero at range end
            const x = (d - R) / RANGE; const f = coh * (film[i] & film[j] ? 0.25 : 1) * (2 * x * (1 - x) + 0.15 * w);   // film on the wall spreads instead of beading up
            vx[i] += nx * f; vy[i] += ny * f; vz[i] += nz * f; vx[j] -= nx * f; vy[j] -= ny * f; vz[j] -= nz * f;
            continue;
          }
          contacts++;
          const pen = (R - d) * 0.5; px[i] -= nx * pen; py[i] -= ny * pen; pz[i] -= nz * pen; px[j] += nx * pen; py[j] += ny * pen; pz[j] += nz * pen;
          const vn = (vx[j] - vx[i]) * nx + (vy[j] - vy[i]) * ny + (vz[j] - vz[i]) * nz;
          if (vn < 0) { const imp = -vn * 0.55; vx[i] -= nx * imp; vy[i] -= ny * imp; vz[i] -= nz * imp; vx[j] += nx * imp; vy[j] += ny * imp; vz[j] += nz * imp; }
        }
      }
    }
    return contacts;
  }
}

export const LIQUID_CAMERAS = ['Drift', 'Still', 'Slow Pan', 'Low Angle'];
// liquid ball shader: radius inflation + neighbour-gradient normals so a packed stream reads as one smooth glossy body
const LBALL_VS = BALL_VS.replace('uniform mat4 uVP;', 'uniform mat4 uVP; uniform float uInflate;').replace('aPos*iPR.w', 'aPos*iPR.w*uInflate');
const LBALL_FS = BALL_FS.replace('uniform vec3 uCamPos;', 'uniform vec3 uCamPos; uniform float uSmooth;').replace('vec3 N = normalize(vN);', 'vec3 N = normalize(vN); { float c_ = vOcc.w; vec3 d_ = c_ > 1e-3 ? vOcc.xyz/c_ : vec3(0.0); N = normalize(N - d_*uSmooth*1.1*clamp(c_/3.0, 0.0, 1.0)); }');

export class LiquidScene implements PhysScene {
  name = 'liquid'; ready = false; error: string | null = null; stats: Record<string, any> = {};
  sim = new LiquidSim();
  private ms: MsTarget; private sm: ShadowMap;
  private pSurf: Prog; private pBall: Prog; private pBg: Prog; private pShS: Prog; private pShB: Prog; private pSplat: Prog;
  private surfVao!: WebGLVertexArrayObject; private surfCount = 0;
  private ball!: WebGLVertexArrayObject; private ballCount = 0; private ballLo!: WebGLVertexArrayObject; private ballLoCount = 0;
  private splatVao!: WebGLVertexArrayObject; private inst!: WebGLBuffer; private instData: Float32Array;
  private ao: { f: WebGLFramebuffer; t: WebGLTexture } | null = null; private blank: WebGLTexture;
  private acc = 0; private prerolled = false; private ct = 0;
  private static AO_W = 512; private static AO_H = 512; private static AO_RECT = [-8, -8, 16, 16];
  constructor(private gl: WebGL2RenderingContext) {
    this.ms = new MsTarget(gl, 4); this.sm = new ShadowMap(gl, 4096);
    this.pSurf = compile(gl, SURF_VS, SURF_FS, 'liq-surf'); this.pBall = compile(gl, LBALL_VS, LBALL_FS, 'liq-ball');
    this.pBg = compile(gl, BG_VS, BG_FS, 'liq-bg'); this.pShS = compile(gl, SURF_VS, SHADOW_FS, 'liq-sh-s');
    this.pShB = compile(gl, LBALL_VS, SHADOW_FS, 'liq-sh-b'); this.pSplat = compile(gl, SPLAT_VS, SPLAT_FS, 'liq-splat');
    this.instData = new Float32Array(this.sim.N * 16);
    this.blank = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, this.blank); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    this.build(); this.ready = true;
  }
  load() {}
  private build() {
    const gl = this.gl; const g = newGeo();
    for (const C of this.sim.cols) (C.sph ? sphereGeo : rbox)(g, C);
    let vao = gl.createVertexArray()!; gl.bindVertexArray(vao);
    const vb = (d: ArrayBufferView, loc: number, n: number) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, d, gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 0, 0); };
    vb(new Float32Array(g.pos), 0, 3); vb(new Float32Array(g.nrm), 1, 3); vb(new Float32Array(g.mat), 2, 1);
    const eb = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, eb); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(g.idx), gl.STATIC_DRAW);
    this.surfVao = vao; this.surfCount = g.idx.length; gl.bindVertexArray(null);
    this.inst = gl.createBuffer()!; gl.bindBuffer(gl.ARRAY_BUFFER, this.inst); gl.bufferData(gl.ARRAY_BUFFER, this.instData.byteLength, gl.DYNAMIC_DRAW);
    const mk = (sub: number) => {
      const s = icosphere(sub); const v = gl.createVertexArray()!; gl.bindVertexArray(v);
      vb(s.pos, 0, 3); gl.bindBuffer(gl.ARRAY_BUFFER, this.inst);
      for (let k = 0; k < 4; k++) { gl.enableVertexAttribArray(3 + k); gl.vertexAttribPointer(3 + k, 4, gl.FLOAT, false, 64, k * 16); gl.vertexAttribDivisor(3 + k, 1); }
      const e = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, e); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, s.idx, gl.STATIC_DRAW);
      gl.bindVertexArray(null); return { v, n: s.idx.length };
    };
    let r = mk(2); this.ball = r.v; this.ballCount = r.n; r = mk(1); this.ballLo = r.v; this.ballLoCount = r.n;
    vao = gl.createVertexArray()!; gl.bindVertexArray(vao);
    vb(new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), 0, 2);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.inst);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 64, 0); gl.vertexAttribDivisor(3, 1);
    gl.enableVertexAttribArray(6); gl.vertexAttribPointer(6, 4, gl.FLOAT, false, 64, 48); gl.vertexAttribDivisor(6, 1);
    this.splatVao = vao; gl.bindVertexArray(null);
    const t = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, LiquidScene.AO_W, LiquidScene.AO_H, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer()!; gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); this.ao = { f: fb, t };
  }
  // physics runs in a Web Worker (liquidWorker.ts) so the ~10 ms CPU step overlaps rendering instead of adding to it;
  // the worker ping-pongs packed instance buffers back. Falls back to stepping inline when Worker is unavailable.
  private worker: Worker | null = null; private pending = false; private spare: ArrayBuffer[] = []; private nInst = 0;
  private wstats = { stepMs: 0, contacts: 0, alive: 0, avgMs: 0, budget: 1, t: 0 };
  private initWorker() {
    try {
      this.worker = new Worker(new URL('./liquidWorker.ts', import.meta.url), { type: 'module' });
      this.spare = [new ArrayBuffer(this.sim.N * 64), new ArrayBuffer(this.sim.N * 64)];
      this.worker.onmessage = (e: MessageEvent) => {
        const { buf, n, stats } = e.data as { buf: ArrayBuffer; n: number; stats: LiquidScene['wstats'] };
        const gl = this.gl; gl.bindBuffer(gl.ARRAY_BUFFER, this.inst); gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(buf), 0, n * 16);
        this.nInst = n; this.wstats = stats; this.spare.push(buf); this.pending = false;
      };
      this.worker.onerror = (e) => { console.warn('liquid worker failed, stepping inline', e.message); this.worker?.terminate(); this.worker = null; this.pending = false; };
    } catch { this.worker = null; }
  }
  private upload(): number {
    const n = this.sim.pack(this.instData);
    const gl = this.gl; gl.bindBuffer(gl.ARRAY_BUFFER, this.inst); gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.instData, 0, n * 16);
    return n;
  }
  render(f: PhysFrame) {
    const gl = this.gl, P = f.params; const sp = this.sim.P;
    sp.pour = P.grPour ?? sp.pour; sp.streams = P.grStreams ?? sp.streams; sp.cohesion = P.grCohesion ?? sp.cohesion; sp.viscosity = P.grViscosity ?? sp.viscosity;
    sp.turbulence = P.grTurbulence ?? sp.turbulence; sp.drip = P.grDrip ?? sp.drip; sp.gravity = P.grGravity ?? sp.gravity; sp.ballSize = P.grBallSize ?? sp.ballSize;
    sp.order = P.grOrder ?? sp.order; sp.bursts = P.grBursts ?? sp.bursts;
    sp.zoom = P.grZoom ?? sp.zoom; sp.tanV = Math.tan((P.grLens ?? 36) * Math.PI / 360);   // own long lens: compresses the layers, smaller beads
    const inflate = 1 + 0.26 * (P.grSmooth ?? 1), smooth = P.grSmooth ?? 1;
    const bd = LIQUID_BACKDROPS[P.grBackdrop as string] ?? LIQUID_BACKDROPS['Ink Studio'];
    if (!this.prerolled) { this.prerolled = true; if (typeof Worker !== 'undefined') this.initWorker(); if (!this.worker) for (let i = 0; i < 60 * 5; i++) this.sim.step(1 / 60, false); }
    if (!P.paused) { this.acc += Math.min(0.05, f.dt) * P.speed; this.ct += Math.min(0.05, f.dt) * P.speed; }
    let nInst: number;
    if (this.worker) {
      const steps = Math.min(2, Math.floor(this.acc * 60));
      if (!this.pending && (steps > 0 || this.wstats.t === 0)) {
        const buf = this.spare.pop()!; this.pending = true; this.acc = Math.max(0, this.acc - steps / 60); if (steps === 2) this.acc = Math.min(this.acc, 1 / 60);
        this.worker.postMessage({ P: { ...sp }, steps, buf }, [buf]);
      }
      nInst = this.nInst;
    } else {
      let n = 0; while (this.acc >= 1 / 60 && n < 2) { this.sim.step(1 / 60); this.acc -= 1 / 60; n++; }
      if (n === 2) this.acc = 0;
      nInst = this.upload();
    }
    const t = this.ct; const cam = (P.grLqCamera as string) ?? 'Drift'; const en = P.grCamEnergy ?? 1;
    let eye: Vec3, tgt: Vec3;
    const ez = LQ.tgtZ + LQ.camDist * sp.zoom, ty = LQ.tgtY;    // same framing the sim culls / spawns against
    if (cam === 'Still') { eye = [0, ty + 0.25, ez]; tgt = [0, ty, LQ.tgtZ]; }
    else if (cam === 'Slow Pan') { eye = [Math.sin(t * 0.07) * 1.0 * en, ty + 0.25, ez]; tgt = [Math.sin(t * 0.07) * 0.8 * en, ty, LQ.tgtZ]; }
    else if (cam === 'Low Angle') { eye = [Math.sin(t * 0.1) * 0.4 * en, ty - 0.9, ez]; tgt = [0, ty + 0.3, LQ.tgtZ]; }
    else { eye = [Math.sin(t * 0.13) * 0.5 * en, ty + 0.25 + Math.sin(t * 0.21) * 0.2 * en, ez + Math.sin(t * 0.07) * 0.25 * en]; tgt = [Math.sin(t * 0.09) * 0.25 * en, ty + Math.sin(t * 0.17) * 0.12 * en, LQ.tgtZ]; }
    const fovy = (P.grLens ?? 36) * Math.PI / 180;
    const view = lookAt(eye, tgt); const proj = perspective(fovy, f.aspect, 0.2, 140); const vp = mul(proj, view);
    const az = (P.grKeyAz ?? -28) * Math.PI / 180, el = (P.grKeyEl ?? 34) * Math.PI / 180;
    const Ld = norm([Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)]);
    const ctr: Vec3 = [0, 2.5, -1];
    const lview = lookAt([ctr[0] + Ld[0] * 40, ctr[1] + Ld[1] * 40, ctr[2] + Ld[2] * 40], ctr);
    const lvp = mul(ortho(-11, 11, -11, 11, 5, 85), lview);
    const fwd = norm([tgt[0] - eye[0], tgt[1] - eye[1], tgt[2] - eye[2]]);
    const look = { ...lookOf('Coral Peach'), bgTop: bd.bgTop, bgBottom: bd.bgBottom, glow: bd.bgTop };
    const env = { look, L: Ld, F: norm([0.6, 0.5, 0.6]) as Vec3, fwd };
    const matCols = new Float32Array(15); [bd.wall, bd.pearl, bd.chrome, bd.chrome, bd.pearl].forEach((h, i) => matCols.set(srgbHex(h), i * 3));
    this.sm.begin(); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
    gl.useProgram(this.pShS.p); gl.uniformMatrix4fv(this.pShS.u.uVP, false, lvp); gl.uniform1f(this.pShS.u.uMirror, 0);
    gl.bindVertexArray(this.surfVao); gl.drawElements(gl.TRIANGLES, this.surfCount, gl.UNSIGNED_INT, 0);
    gl.useProgram(this.pShB.p); gl.uniformMatrix4fv(this.pShB.u.uVP, false, lvp); gl.uniform1f(this.pShB.u.uMirror, 0); gl.uniform1f(this.pShB.u.uInflate, inflate);
    gl.bindVertexArray(this.ballLo); gl.drawElementsInstanced(gl.TRIANGLES, this.ballLoCount, gl.UNSIGNED_SHORT, 0, nInst);
    this.sm.end();
    const R = LiquidScene.AO_RECT;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.ao!.f); gl.viewport(0, 0, LiquidScene.AO_W, LiquidScene.AO_H); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(this.pSplat.p); gl.uniform4fv(this.pSplat.u.uAORect, R);
    gl.bindVertexArray(this.splatVao); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, nInst);
    gl.disable(gl.BLEND);
    const fogTint: Vec3 = [1, 1, 1];
    const common = (pr: Prog, w: number, h: number) => {
      const u = pr.u; gl.useProgram(pr.p); setStudioEnv(gl, u, env);
      gl.uniformMatrix4fv(u.uVP, false, vp); gl.uniform3fv(u.uCamPos, eye);
      gl.uniform1f(u.uMirror, 0); gl.uniform1f(u.uIrid, P.irid ?? 0.8);
      gl.uniform1f(u.uFogK, 0.01); gl.uniform1f(u.uFogStart, 16); gl.uniform3fv(u.uFogTint, fogTint);
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.sm.tex); gl.uniform1i(u.uShadow, 3); gl.uniformMatrix4fv(u.uLightVP, false, lvp);
      gl.uniform1f(u.uShadowSoft, 2.0); gl.uniform1f(u.uShadowTexel, 1 / 4096);
      if (u.uAOTex) { gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, this.ao!.t); gl.uniform1i(u.uAOTex, 4); gl.uniform4fv(u.uAORect, R); }
      if (u.uRefl) { gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, this.blank); gl.uniform1i(u.uRefl, 5); }
      if (u.uMatCol) gl.uniform3fv(u.uMatCol, matCols);
      if (u.uRes) gl.uniform2f(u.uRes, w, h);
      return u;
    };
    this.ms.ensure(f.w, f.h); this.ms.begin();
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.depthMask(true);
    { const u = this.pBg.u; gl.useProgram(this.pBg.p); setStudioEnv(gl, u, env); gl.uniform3fv(u.uFogTint, fogTint);
      const right = norm([-fwd[2], 0, fwd[0]]) as Vec3; const up: Vec3 = [right[1] * fwd[2] - right[2] * fwd[1], right[2] * fwd[0] - right[0] * fwd[2], right[0] * fwd[1] - right[1] * fwd[0]];
      gl.uniform3fv(u.uCR, right); gl.uniform3fv(u.uCU, up); gl.uniform3fv(u.uCF, fwd); gl.uniform2f(u.uTan, Math.tan(fovy / 2) * f.aspect, Math.tan(fovy / 2));
      gl.depthMask(false); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.depthMask(true); }
    common(this.pSurf, f.w, f.h); gl.bindVertexArray(this.surfVao); gl.drawElements(gl.TRIANGLES, this.surfCount, gl.UNSIGNED_INT, 0);
    { const ub = common(this.pBall, f.w, f.h); gl.uniform1f(ub.uInflate, inflate); gl.uniform1f(ub.uSmooth, smooth); } gl.bindVertexArray(this.ball); gl.drawElementsInstanced(gl.TRIANGLES, this.ballCount, gl.UNSIGNED_SHORT, 0, nInst);
    gl.disable(gl.DEPTH_TEST); gl.bindVertexArray(null); gl.activeTexture(gl.TEXTURE0);
    const tex = this.ms.resolve();
    const focus = eye[2] - LQ.midZ;
    f.dof(tex, f.target, f.w, f.h, P.grFocus ?? focus, P.grDof ?? 0.5);
    const st = this.worker ? this.wstats : { ...this.sim.stats, t: this.sim.t };
    this.stats = { balls: nInst, contacts: st.contacts, physicsMs: +st.stepMs.toFixed(2), physicsAvgMs: +st.avgMs.toFixed(2), budget: +st.budget.toFixed(2), simTime: +st.t.toFixed(1), worker: this.worker ? 1 : 0 };
  }
}
