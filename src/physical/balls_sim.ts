// Pass 4 "Gravity Fall" physics: a live rigid-sphere simulation (CPU, typed arrays, uniform-grid broadphase,
// sequential impulses with restitution, Coulomb friction and rolling, 8 substeps) against a machine of
// surfaces that each have their own restitution / friction: clay ramps, steps, steel pegs, a bowl with a drain,
// spinning paddles, glass shelves and soft jelly cushions (a damped spring membrane that the balls dent).
// Emitters pour colour *sections* (each emitter owns a palette band; the band sequence rotates over the loop)
// and balls that leave the frame are recycled into the emitters, so the flow runs forever without a seam.
// Original MIT-licensed work for flow-engine.

export type V2 = [number, number];
export type Collider = {
  kind: 'ramp' | 'steps' | 'peg' | 'bowl' | 'glass' | 'paddle';
  pts: V2[]; r: number; e: number; mu: number;
  // paddle
  c?: V2; len?: number; ang?: number; w?: number;
  bb?: [number, number, number, number];
};
export type Jelly = { x0: number; x1: number; y: number; slope: number; n: number; d: Float32Array; v: Float32Array; k: number; tension: number; damp: number; thick: number };
export type Emitter = { x: number; y: number; vx: number; vy: number; spread: number; rate: number; phase: number };

export const SLAB = 0.75;        // half depth of the machine (balls live in z in [-SLAB, SLAB])
export const G = 9.81 * 0.72;    // slightly slowed gravity for a calmer, more readable flow

export const SECTIONS: Record<string, string[]> = {
  coral: ['#ff5a4a', '#ff7c62', '#ff9b7c', '#ffb59a'],
  cobalt: ['#1f45e0', '#3560f0', '#5a86ff', '#2a3db8'],
  mint: ['#2fc79f', '#56dcb6', '#8deacf', '#1fa98d'],
  gold: ['#ffbf3f', '#ffd36e', '#f2a52a', '#ffe39a'],
  lilac: ['#a070ff', '#b993ff', '#8a5cf0', '#cdb2ff'],
};
export const SECTION_ORDER = ['coral', 'cobalt', 'mint', 'gold', 'lilac'];

function hash(n: number) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

/** The machine layout (2D profile; every surface is extruded through the slab depth). Frame is ~x[-8.6,8.6] y[-4.8,4.8]. */
export function buildMachine(): { colliders: Collider[]; jellies: Jelly[]; emitters: Emitter[] } {
  const C: Collider[] = [];
  // column 1 (left): long clay ramp into a field of steel pegs
  C.push({ kind: 'ramp', pts: [[-8.9, 2.75], [-4.6, 1.55]], r: 0.11, e: 0.32, mu: 0.45 });
  for (let row = 0; row < 4; row++) for (let i = 0; i < 5; i++) {
    const x = -4.3 + i * 0.78 + (row % 2) * 0.39, y = 1.0 - row * 0.66;
    C.push({ kind: 'peg', pts: [[x, y]], r: 0.075, e: 0.62, mu: 0.15 });
  }
  // column 2 (centre): two counter-rotating paddles
  C.push({ kind: 'paddle', pts: [], r: 0.09, e: 0.5, mu: 0.4, c: [-0.55, 2.55], len: 1.15, ang: 0, w: 1.9 });
  C.push({ kind: 'paddle', pts: [], r: 0.09, e: 0.5, mu: 0.4, c: [1.25, 1.35], len: 1.05, ang: 1.2, w: -2.4 });
  // column 3 (right): glass shelves zig-zag, then steps down to the jelly
  C.push({ kind: 'glass', pts: [[2.9, 3.05], [6.5, 2.45]], r: 0.05, e: 0.55, mu: 0.08 });
  C.push({ kind: 'glass', pts: [[8.9, 1.75], [5.4, 1.05]], r: 0.05, e: 0.55, mu: 0.08 });
  const st: V2[] = []; let sx = 4.9, sy = 0.45;
  for (let i = 0; i < 5; i++) { st.push([sx, sy]); st.push([sx - 0.62, sy]); sx -= 0.62; sy -= 0.38; st.push([sx, sy]); }
  C.push({ kind: 'steps', pts: st, r: 0.06, e: 0.38, mu: 0.35 });
  // bottom left: bowl with a drain gap at the bottom (balls pile, crowd and trickle out)
  const bowl = (a0: number, a1: number) => { const p: V2[] = []; for (let i = 0; i <= 20; i++) { const a = (a0 + (a1 - a0) * i / 20) * Math.PI / 180; p.push([-3.0 + 2.0 * Math.cos(a), -1.6 + 2.0 * Math.sin(a)]); } return p; };
  C.push({ kind: 'bowl', pts: bowl(192, 250), r: 0.09, e: 0.3, mu: 0.3 });
  C.push({ kind: 'bowl', pts: bowl(290, 348), r: 0.09, e: 0.3, mu: 0.3 });
  for (const c of C) {
    if (c.kind === 'paddle') continue;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [x, y] of c.pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const m = c.r + 0.25; c.bb = [x0 - m, y0 - m, x1 + m, y1 + m];
  }
  const jelly = (x0: number, x1: number, y: number, n: number, slope: number): Jelly => ({ x0, x1, y, slope, n, d: new Float32Array(n), v: new Float32Array(n), k: 60, tension: 900, damp: 4.5, thick: 0.5 });
  const jellies = [jelly(-0.2, 6.6, -2.95, 96, -0.075), jelly(-4.9, -1.3, -4.6, 48, 0.1)];
  const emitters: Emitter[] = [
    { x: -6.8, y: 5.4, vx: 0.9, vy: -0.5, spread: 0.55, rate: 30, phase: 0.0 },
    { x: -0.3, y: 5.4, vx: 0.15, vy: -0.6, spread: 0.6, rate: 27, phase: 1.1 },
    { x: 4.3, y: 5.4, vx: 0.35, vy: -0.4, spread: 0.6, rate: 27, phase: 2.2 },
  ];
  return { colliders: C, jellies, emitters };
}

export class BallSim {
  N: number; alive: Uint8Array; px: Float32Array; py: Float32Array; pz: Float32Array; vx: Float32Array; vy: Float32Array; vz: Float32Array;
  wx: Float32Array; wy: Float32Array; wz: Float32Array; q: Float32Array; r: Float32Array; im: Float32Array; e: Float32Array;
  col: Float32Array; mat: Uint8Array; occ: Float32Array; section: Uint8Array;
  colliders: Collider[]; jellies: Jelly[]; emitters: Emitter[];
  t = 0; private emitAcc: number[]; private seed = 1;
  private cell = 0.55; private gx = 39; private gy = 25; private gz = 4; private head: Int32Array; private next: Int32Array;
  palettes: Record<string, [number, number, number][]> = {};
  stats = { alive: 0, contacts: 0, stepMs: 0 };
  constructor(N = 1400) {
    this.N = N;
    const f = () => new Float32Array(N);
    this.alive = new Uint8Array(N); this.px = f(); this.py = f(); this.pz = f(); this.vx = f(); this.vy = f(); this.vz = f();
    this.wx = f(); this.wy = f(); this.wz = f(); this.q = new Float32Array(N * 4); this.r = f(); this.im = f(); this.e = f();
    this.col = new Float32Array(N * 3); this.mat = new Uint8Array(N); this.occ = new Float32Array(N * 4); this.section = new Uint8Array(N);
    const m = buildMachine(); this.colliders = m.colliders; this.jellies = m.jellies; this.emitters = m.emitters;
    this.emitAcc = this.emitters.map(() => 0);
    this.head = new Int32Array(this.gx * this.gy * this.gz); this.next = new Int32Array(N);
    for (const [k, hexes] of Object.entries(SECTIONS)) this.palettes[k] = hexes.map((h) => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; });
  }
  private rnd() { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647; }
  /** Section owned by emitter k at time t: the sequence rotates every 9 s, so the colour bands cycle over a 45 s loop. */
  sectionOf(k: number, t: number) { return (k + Math.floor(t / 9)) % SECTION_ORDER.length; }
  private spawn(k: number) {
    let i = -1; for (let j = 0; j < this.N; j++) if (!this.alive[j]) { i = j; break; }
    if (i < 0) return;
    const E = this.emitters[k];
    const sz = this.rnd();
    const r = 1.2 * (sz < 0.35 ? 0.075 + 0.02 * this.rnd() : sz < 0.7 ? 0.11 + 0.025 * this.rnd() : sz < 0.92 ? 0.15 + 0.025 * this.rnd() : 0.19 + 0.025 * this.rnd());
    this.alive[i] = 1; this.r[i] = r;
    this.px[i] = E.x + (this.rnd() - 0.5) * E.spread; this.py[i] = E.y + this.rnd() * 0.4; this.pz[i] = (this.rnd() * 2 - 1) * (SLAB - r);
    this.vx[i] = E.vx + (this.rnd() - 0.5) * 0.4; this.vy[i] = E.vy - this.rnd() * 0.4; this.vz[i] = (this.rnd() - 0.5) * 0.3;
    this.wx[i] = this.wy[i] = this.wz[i] = 0; this.q.set([0, 0, 0, 1], i * 4);
    const mr = this.rnd(); const mat = mr < 0.45 ? 0 : mr < 0.7 ? 1 : mr < 0.9 ? 2 : 3;   // gloss, matte, pearl, glass
    this.mat[i] = mat;
    const dens = mat === 3 ? 2.5 : mat === 1 ? 1.1 : 1.4;
    this.im[i] = 1 / (dens * r * r * r * 4.19);
    this.e[i] = mat === 1 ? 0.42 : mat === 3 ? 0.7 : 0.6;
    const s = this.sectionOf(k, this.t); this.section[i] = s;
    const pal = this.palettes[SECTION_ORDER[s]]; const c = pal[Math.floor(this.rnd() * pal.length) % pal.length];
    this.col.set(c, i * 3);
  }
  /** Advance by dt (seconds of sim time) using `sub` substeps. */
  step(dt: number, sub = 8) {
    const t0 = performance.now();
    // emitters: pulsing waves (1.8 s on / 0.7 s off, staggered) so sections arrive as distinct waves
    this.emitters.forEach((E, k) => {
      const ph = (this.t + E.phase) % 2.5;
      const on = ph < 1.8 ? 1 : 0;
      this.emitAcc[k] += E.rate * on * dt;
      while (this.emitAcc[k] >= 1) { this.spawn(k); this.emitAcc[k] -= 1; }
    });
    const h = dt / sub;
    for (let s = 0; s < sub; s++) this.substep(h);
    this.t += dt;
    // recycle anything that has left the frame
    let alive = 0;
    for (let i = 0; i < this.N; i++) if (this.alive[i]) {
      if (this.py[i] < -6.2 || this.px[i] < -10.5 || this.px[i] > 10.5 || !Number.isFinite(this.px[i] + this.py[i] + this.pz[i])) this.alive[i] = 0; else alive++;
    }
    this.computeOcclusion();
    this.stats.alive = alive; this.stats.stepMs = performance.now() - t0;
  }
  private substep(h: number) {
    const { N, px, py, pz, vx, vy, vz, r, alive } = this;
    for (const c of this.colliders) if (c.kind === 'paddle') c.ang! += c.w! * h;
    // jelly membranes
    for (const J of this.jellies) {
      const n = J.n;
      for (let i = 0; i < n; i++) {
        const l = i > 0 ? J.d[i - 1] : 0, rr = i < n - 1 ? J.d[i + 1] : 0;
        const a = -J.k * J.d[i] + J.tension * (l + rr - 2 * J.d[i]) * (1 / (n * n)) * 40 - J.damp * J.v[i];
        J.v[i] += a * h;
      }
      for (let i = 0; i < n; i++) { J.d[i] += J.v[i] * h; J.d[i] = Math.max(-0.3, Math.min(0.12, J.d[i])); }
    }
    for (let i = 0; i < N; i++) if (alive[i]) {
      vy[i] -= G * h;
      // light air drag keeps tiny balls from rattling forever
      vx[i] *= 0.9996; vy[i] *= 0.9996; vz[i] *= 0.998;
      px[i] += vx[i] * h; py[i] += vy[i] * h; pz[i] += vz[i] * h;
      // slab walls (back glass + front glass)
      const lim = SLAB - r[i];
      if (pz[i] > lim) { pz[i] = lim; if (vz[i] > 0) vz[i] *= -0.3; }
      if (pz[i] < -lim) { pz[i] = -lim; if (vz[i] < 0) vz[i] *= -0.3; }
      // integrate orientation (for rolling)
      const wx = this.wx[i], wy = this.wy[i], wz = this.wz[i];
      const wl = Math.hypot(wx, wy, wz);
      if (wl > 1e-5) {
        const a = wl * h * 0.5, s = Math.sin(a) / wl; const dx = wx * s, dy = wy * s, dz = wz * s, dw = Math.cos(a);
        const o = i * 4, qx = this.q[o], qy = this.q[o + 1], qz = this.q[o + 2], qw = this.q[o + 3];
        let nx = dw * qx + dx * qw + dy * qz - dz * qy, ny = dw * qy - dx * qz + dy * qw + dz * qx, nz = dw * qz + dx * qy - dy * qx + dz * qw, nw = dw * qw - dx * qx - dy * qy - dz * qz;
        const ql = Math.hypot(nx, ny, nz, nw) || 1; this.q[o] = nx / ql; this.q[o + 1] = ny / ql; this.q[o + 2] = nz / ql; this.q[o + 3] = nw / ql;
      }
      this.wx[i] *= 0.9995; this.wy[i] *= 0.9995; this.wz[i] *= 0.9995;
      this.collideStatic(i, h);
    }
    this.collidePairs();
  }
  private contact(i: number, nx: number, ny: number, nz: number, pen: number, e: number, mu: number, svx = 0, svy = 0) {
    // static/kinematic surface contact with normal n (pointing toward the ball)
    const r = this.r[i];
    this.px[i] += nx * pen; this.py[i] += ny * pen; this.pz[i] += nz * pen;
    // velocity of the contact point on the ball, relative to the surface
    const cx = -nx * r, cy = -ny * r, cz = -nz * r;
    let rvx = this.vx[i] + (this.wy[i] * cz - this.wz[i] * cy) - svx;
    let rvy = this.vy[i] + (this.wz[i] * cx - this.wx[i] * cz) - svy;
    let rvz = this.vz[i] + (this.wx[i] * cy - this.wy[i] * cx);
    const vn = rvx * nx + rvy * ny + rvz * nz;
    if (vn >= 0) return;
    const ee = vn > -0.35 ? 0 : Math.min(e, this.e[i] + 0.1) * (e / Math.max(e, 1e-3)) ; // no micro-bounce at rest
    const im = this.im[i];
    const jn = -(1 + ee) * vn / im;
    let tx = rvx - vn * nx, ty = rvy - vn * ny, tz = rvz - vn * nz; const tl = Math.hypot(tx, ty, tz);
    let jt = 0; if (tl > 1e-6) { jt = Math.min(tl / (3.5 * im), mu * jn); tx /= tl; ty /= tl; tz /= tl; }
    const Px = jn * nx - jt * tx, Py = jn * ny - jt * ty, Pz = jn * nz - jt * tz;
    this.vx[i] += Px * im; this.vy[i] += Py * im; this.vz[i] += Pz * im;
    const iI = im / (0.4 * r * r);
    this.wx[i] += (cy * Pz - cz * Py) * iI; this.wy[i] += (cz * Px - cx * Pz) * iI; this.wz[i] += (cx * Py - cy * Px) * iI;
    const o = i * 4; this.occ[o] += nx * 0.6; this.occ[o + 1] += ny * 0.6; this.occ[o + 3] += 0.35;
  }
  private collideStatic(i: number, h: number) {
    const x = this.px[i], y = this.py[i], r = this.r[i];
    for (const c of this.colliders) {
      if (c.kind === 'paddle') {
        const ca = Math.cos(c.ang!), sa = Math.sin(c.ang!), L = c.len!;
        const ax = c.c![0] - ca * L, ay = c.c![1] - sa * L, bx = c.c![0] + ca * L, by = c.c![1] + sa * L;
        const res = segDist(x, y, ax, ay, bx, by);
        if (res.d < c.r + r) {
          const d = Math.max(res.d, 1e-5), nx = (x - res.x) / d, ny = (y - res.y) / d;
          // surface velocity of the spinning paddle at the contact point: w x (p - c)
          const svx = -c.w! * (res.y - c.c![1]), svy = c.w! * (res.x - c.c![0]);
          this.contact(i, nx, ny, 0, c.r + r - d, c.e, c.mu, svx, svy);
        }
        continue;
      }
      const bb = c.bb!; if (x < bb[0] || x > bb[2] || y < bb[1] || y > bb[3]) continue;
      if (c.pts.length === 1) {
        const dx = x - c.pts[0][0], dy = y - c.pts[0][1], d = Math.hypot(dx, dy);
        if (d < c.r + r) this.contact(i, dx / Math.max(d, 1e-5), dy / Math.max(d, 1e-5), 0, c.r + r - d, c.e, c.mu);
        continue;
      }
      let best = 1e9, bx = 0, by = 0;
      for (let k = 0; k < c.pts.length - 1; k++) {
        const res = segDist(this.px[i], this.py[i], c.pts[k][0], c.pts[k][1], c.pts[k + 1][0], c.pts[k + 1][1]);
        if (res.d < best) { best = res.d; bx = res.x; by = res.y; }
      }
      if (best < c.r + r) {
        const d = Math.max(best, 1e-5);
        this.contact(i, (this.px[i] - bx) / d, (this.py[i] - by) / d, 0, c.r + r - d, c.e, c.mu);
      }
    }
    // jelly cushions: soft penalty contact; the reaction dents the membrane (waves propagate along it)
    for (const J of this.jellies) {
      const xx = this.px[i]; if (xx < J.x0 || xx > J.x1) continue;
      const u = (xx - J.x0) / (J.x1 - J.x0) * (J.n - 1); const k = Math.floor(u), f = u - k;
      const d = J.d[k] * (1 - f) + J.d[Math.min(J.n - 1, k + 1)] * f;
      const top = J.y + J.slope * (xx - J.x0) + J.thick * 0.5 + d;
      const pen = top - (this.py[i] - this.r[i]);
      if (pen > 0 && this.py[i] > top - J.thick - 0.2) {
        // spring accel (stiffness 2600/s^2) + impact damping; reaction pushes the membrane down
        const acc = 2600 * pen - (this.vy[i] < 0 ? 6 * this.vy[i] : 0);
        this.vy[i] += acc * h; this.vx[i] *= 0.9992;
        const share = -acc * h * 0.045 * Math.min(2.5, (1 / this.im[i]) / 0.012);
        J.v[k] += share * (1 - f); if (k + 1 < J.n) J.v[k + 1] += share * f;
        if (pen > 0.25) this.py[i] += pen - 0.25;
        const o = i * 4; this.occ[o + 1] -= 0.6; this.occ[o + 3] += 0.35;
      }
    }
  }
  private collidePairs() {
    const { N, px, py, pz, vx, vy, vz, r, im, alive, head, next, cell, gx, gy, gz } = this;
    head.fill(-1);
    const X0 = -10.6, Y0 = -6.4, Z0 = -SLAB;
    const ci = (x: number, y: number, z: number) => {
      const a = Math.min(gx - 1, Math.max(0, Math.floor((x - X0) / cell))), b = Math.min(gy - 1, Math.max(0, Math.floor((y - Y0) / cell))), c = Math.min(gz - 1, Math.max(0, Math.floor((z - Z0) / cell)));
      return (c * gy + b) * gx + a;
    };
    for (let i = 0; i < N; i++) if (alive[i]) { const k = ci(px[i], py[i], pz[i]); next[i] = head[k]; head[k] = i; }
    let contacts = 0;
    for (let i = 0; i < N; i++) {
      if (!alive[i]) continue;
      const a0 = Math.floor((px[i] - X0) / cell), b0 = Math.floor((py[i] - Y0) / cell), c0 = Math.floor((pz[i] - Z0) / cell);
      for (let c = c0 - 1; c <= c0 + 1; c++) { if (c < 0 || c >= gz) continue;
        for (let b = b0 - 1; b <= b0 + 1; b++) { if (b < 0 || b >= gy) continue;
          for (let a = a0 - 1; a <= a0 + 1; a++) { if (a < 0 || a >= gx) continue;
            for (let j = head[(c * gy + b) * gx + a]; j >= 0; j = next[j]) {
              if (j <= i) continue;
              const dx = px[j] - px[i], dy = py[j] - py[i], dz = pz[j] - pz[i];
              const rs = r[i] + r[j]; const d2 = dx * dx + dy * dy + dz * dz;
              if (d2 >= rs * rs || d2 < 1e-12) continue;
              contacts++;
              const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, nz = dz / d, pen = rs - d;
              const wi = im[i] / (im[i] + im[j]), wj = 1 - wi;
              px[i] -= nx * pen * wi; py[i] -= ny * pen * wi; pz[i] -= nz * pen * wi;
              px[j] += nx * pen * wj; py[j] += ny * pen * wj; pz[j] += nz * pen * wj;
              // relative velocity of j wrt i at the contact point (with spin)
              const ri = r[i], rj = r[j];
              const cix = nx * ri, ciy = ny * ri, ciz = nz * ri, cjx = -nx * rj, cjy = -ny * rj, cjz = -nz * rj;
              const rvx = (vx[j] + this.wy[j] * cjz - this.wz[j] * cjy) - (vx[i] + this.wy[i] * ciz - this.wz[i] * ciy);
              const rvy = (vy[j] + this.wz[j] * cjx - this.wx[j] * cjz) - (vy[i] + this.wz[i] * cix - this.wx[i] * ciz);
              const rvz = (vz[j] + this.wx[j] * cjy - this.wy[j] * cjx) - (vz[i] + this.wx[i] * ciy - this.wy[i] * cix);
              const vn = rvx * nx + rvy * ny + rvz * nz;
              const o1 = i * 4, o2 = j * 4;
              this.occ[o1] += nx; this.occ[o1 + 1] += ny; this.occ[o1 + 2] += nz; this.occ[o1 + 3] += 0.3;
              this.occ[o2] -= nx; this.occ[o2 + 1] -= ny; this.occ[o2 + 2] -= nz; this.occ[o2 + 3] += 0.3;
              if (vn >= 0) continue;
              const e = vn > -0.3 ? 0 : 0.5 * (this.e[i] + this.e[j]);
              const sm = im[i] + im[j];
              const jn = -(1 + e) * vn / sm;
              let tx = rvx - vn * nx, ty = rvy - vn * ny, tz = rvz - vn * nz; const tl = Math.hypot(tx, ty, tz);
              let jt = 0; if (tl > 1e-6) { jt = Math.min(tl / (3.5 * sm), 0.25 * jn); tx /= tl; ty /= tl; tz /= tl; }
              const Px = jn * nx - jt * tx, Py = jn * ny - jt * ty, Pz = jn * nz - jt * tz;
              vx[j] += Px * im[j]; vy[j] += Py * im[j]; vz[j] += Pz * im[j];
              vx[i] -= Px * im[i]; vy[i] -= Py * im[i]; vz[i] -= Pz * im[i];
              const iIj = im[j] / (0.4 * rj * rj), iIi = im[i] / (0.4 * ri * ri);
              this.wx[j] += (cjy * Pz - cjz * Py) * iIj; this.wy[j] += (cjz * Px - cjx * Pz) * iIj; this.wz[j] += (cjx * Py - cjy * Px) * iIj;
              this.wx[i] -= (ciy * Pz - ciz * Py) * iIi; this.wy[i] -= (ciz * Px - cix * Pz) * iIi; this.wz[i] -= (cix * Py - ciy * Px) * iIi;
            }
          }
        }
      }
    }
    this.stats.contacts = contacts;
  }
  /** Per-ball directional occlusion (direction of crowding, amount) accumulated by contacts, smoothed over time. */
  private computeOcclusion() {
    for (let i = 0; i < this.N; i++) {
      const o = i * 4; const l = Math.hypot(this.occ[o], this.occ[o + 1], this.occ[o + 2]);
      // the raw accumulators grow with substeps; normalise into a smoothed (dir, amount)
      const amt = Math.min(1, this.occ[o + 3] / 8);
      if (!this.occ2) this.occ2 = new Float32Array(this.N * 4);
      const s = this.occ2; const k = 0.25;
      const dx = l > 1e-6 ? this.occ[o] / l : 0, dy = l > 1e-6 ? this.occ[o + 1] / l : 0, dz = l > 1e-6 ? this.occ[o + 2] / l : 0;
      s[o] += (dx - s[o]) * k; s[o + 1] += (dy - s[o + 1]) * k; s[o + 2] += (dz - s[o + 2]) * k; s[o + 3] += (amt - s[o + 3]) * k;
      this.occ[o] = this.occ[o + 1] = this.occ[o + 2] = this.occ[o + 3] = 0;
    }
  }
  occ2: Float32Array | null = null;
}

export function segDist(x: number, y: number, ax: number, ay: number, bx: number, by: number) {
  const ex = bx - ax, ey = by - ay; const l2 = ex * ex + ey * ey;
  let t = l2 > 0 ? ((x - ax) * ex + (y - ay) * ey) / l2 : 0; t = Math.max(0, Math.min(1, t));
  const cx = ax + ex * t, cy = ay + ey * t;
  return { d: Math.hypot(x - cx, y - cy), x: cx, y: cy };
}
