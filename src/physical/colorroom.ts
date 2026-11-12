// Pass 6 "Gravity — Color Room": a sculptural, brightly painted art room. Big single-colour clumps of balls
// (hundreds to thousands each) drop from above in turn, hit the floor and sculptures, splash outward, bounce
// high, mix with the previous colour group and fly off past the camera; settled balls dissolve and are recycled
// into the next drop, so the loop never ends. CPU sim (uniform hash grid) + the Cascade renderer pieces:
// 4096 PCF shadows, contact-AO splats, planar-reflection floor, clear-coat lacquer walls, neighbour occlusion.
// Live controls: drop size, drop interval, bounciness, gravity, ball size, palette order, room colours, camera.
// Original MIT-licensed work for flow-engine. No Shadertoy code.
import { SECTIONS, SECTION_ORDER } from './balls_sim';
import { rbox, sphereGeo, icosphere, newGeo, type Col, SURF_VS, SURF_FS, BALL_VS, BALL_FS, BG_VS, BG_FS, SHADOW_FS, SPLAT_VS, SPLAT_FS } from './cascade';
import { compile, MsTarget, ShadowMap, setStudioEnv, lookOf, lookAt, perspective, ortho, mul, norm, srgbHex,
  type PhysFrame, type PhysScene, type Prog, type Vec3 } from './common';

export const ROOM_N = 5200;
const RX = 9, RZ0 = -12, RZ1 = 3, RH = 12;
export const ROOM_PALETTES: Record<string, { back: string; side: string; floor: string; sculpt: string; accent: string; bgTop: string; bgBottom: string }> = {
  'Pop Gallery': { back: '#ff3f7a', side: '#2f5bff', floor: '#1ec9a0', sculpt: '#fff3e6', accent: '#ffc21a', bgTop: '#ffd9e6', bgBottom: '#ff9fbf' },
  'Candy Loft': { back: '#ffb3c7', side: '#9fd8ff', floor: '#ffe28a', sculpt: '#ffffff', accent: '#c9a6ff', bgTop: '#fff0f5', bgBottom: '#ffd0e0' },
  'Neon Noir': { back: '#1a1030', side: '#0f1a3a', floor: '#120c22', sculpt: '#ff3fb4', accent: '#3fe0ff', bgTop: '#2a1650', bgBottom: '#0b0618' },
  'Sunset Clay': { back: '#ff7a3d', side: '#ffb347', floor: '#c2412d', sculpt: '#fff1dc', accent: '#3a6bff', bgTop: '#ffd2a8', bgBottom: '#ff9a6b' },
};
export const ROOM_ORDERS: Record<string, string[]> = {
  'Rainbow': SECTION_ORDER,
  'Warm / Cool': ['coral', 'cobalt', 'gold', 'mint', 'lilac'],
  'Duo Coral-Cobalt': ['coral', 'cobalt'],
  'Mint & Gold': ['mint', 'gold', 'lilac'],
};
export type RoomParams = { dropSize: number; dropEvery: number; bounce: number; gravity: number; ballSize: number; order: string; spread: number; rest: number };
export const ROOM_DEFAULTS: RoomParams = { dropSize: 1100, dropEvery: 2.4, bounce: 0.78, gravity: 9.8, ballSize: 1, order: 'Rainbow', spread: 1, rest: 2.5 };

function layout(): Col[] {
  const L: Col[] = [];
  const box = (cx: number, cy: number, cz: number, bx: number, by: number, bz: number, rad: number, tilt: number, mat: number, vis = true) => {
    const ext = Math.hypot(by + rad, bz + rad); L.push({ sph: false, cx, cy, cz, bx, by, bz, rad, ct: Math.cos(tilt), st: Math.sin(tilt), z0: cz - ext, z1: cz + ext, mat, vis });
  };
  const sph = (cx: number, cy: number, cz: number, R: number, mat: number) => L.push({ sph: true, cx, cy, cz, bx: 0, by: 0, bz: 0, rad: R, ct: 1, st: 0, z0: cz - R, z1: cz + R, mat, vis: true });
  box(0, -0.65, (RZ0 + RZ1) / 2, RX, 0.5, (RZ1 - RZ0) / 2, 0.15, 0, 3);                 // glossy floor, front edge open to the lens
  box(0, RH / 2, RZ0 - 0.4, RX + 0.4, RH / 2, 0.3, 0.1, 0, 0);                            // back wall
  box(-RX - 0.4, RH / 2, (RZ0 + RZ1) / 2 - 2, 0.3, RH / 2, (RZ1 - RZ0) / 2 - 1, 0.1, 0, 1); // side walls stop short of the front
  box(RX + 0.4, RH / 2, (RZ0 + RZ1) / 2 - 2, 0.3, RH / 2, (RZ1 - RZ0) / 2 - 1, 0.1, 0, 1);
  // sculptures the splashes ricochet off
  sph(-3.6, -0.6, -5.5, 2.3, 4);                       // big half-sunk dome
  box(3.8, 0.7, -5.2, 1.5, 0.7, 1.5, 0.35, 0, 4);       // plinth
  box(3.8, 2.1, -5.2, 0.8, 0.5, 0.8, 0.3, 0, 2);        // plinth top (satin metal)
  box(0.6, 0.55, -8.8, 3.0, 0.15, 1.6, 0.4, -0.45, 4);  // tilted launch ramp tipped toward the camera
  sph(1.2, 0.0, -1.6, 0.9, 2);                          // small chrome bumper near the front
  return L;
}

export class ColorRoomSim {
  N: number; px: Float32Array; py: Float32Array; pz: Float32Array; vx: Float32Array; vy: Float32Array; vz: Float32Array; r: Float32Array; r0: Float32Array;
  alive: Uint8Array; mat: Uint8Array; col: Float32Array; occ: Float32Array; ncol: Float32Array; gap: Float32Array; restT: Float32Array;
  cols = layout(); t = 0; drop = 0; stats = { stepMs: 0, contacts: 0, alive: 0 };
  P: RoomParams = { ...ROOM_DEFAULTS };
  private seed = 987654; private dead: number[] = []; private nextDrop = 0.2;
  private cs: Int32Array; private cc: Int32Array; private so: Int32Array; private ky: Int32Array;
  private static T = 1 << 15; private static H = 0.42;
  private pal: Record<string, number[][]> = {};
  constructor(N = ROOM_N) {
    this.N = N; const f = () => new Float32Array(N);
    this.px = f(); this.py = f(); this.pz = f(); this.vx = f(); this.vy = f(); this.vz = f(); this.r = f(); this.r0 = f(); this.gap = f(); this.restT = f();
    this.alive = new Uint8Array(N); this.mat = new Uint8Array(N); this.col = new Float32Array(N * 3); this.occ = new Float32Array(N * 4); this.ncol = new Float32Array(N * 3);
    this.cs = new Int32Array(ColorRoomSim.T); this.cc = new Int32Array(ColorRoomSim.T); this.so = new Int32Array(N); this.ky = new Int32Array(N);
    for (const k of Object.keys(SECTIONS)) this.pal[k] = SECTIONS[k].map((h) => srgbHex(h) as unknown as number[]);
    for (let i = N - 1; i >= 0; i--) { this.dead.push(i); const u = this.rnd(); this.r0[i] = 0.14 + 0.09 * u * u; }
    for (let i = 0; i < N; i++) this.py[i] = -100;
  }
  rnd() { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647; }
  private kill(i: number) { this.alive[i] = 0; this.dead.push(i); this.py[i] = -100; }
  /** Drop one clump: a packed ball of a single colour section, released above the room. */
  private spawnDrop() {
    const order = ROOM_ORDERS[this.P.order] ?? SECTION_ORDER;
    const sec = order[this.drop % order.length]; const pal = this.pal[sec] ?? this.pal.coral;
    this.drop++;
    const want = Math.min(Math.round(this.P.dropSize), this.dead.length);
    if (want < 20) return;
    const s = this.P.ballSize; const meanR = 0.19 * s;
    const R = Math.cbrt(want * (2 * meanR) ** 3 / 0.55 * 3 / (4 * Math.PI));
    const cx = (this.rnd() * 2 - 1) * 4.2 * this.P.spread, cz = -2.5 - this.rnd() * 6.5, cy = RH + R * 0.4;
    const vx0 = -cx * 0.15, vz0 = 0.6 + this.rnd() * 1.2;
    for (let k = 0; k < want; k++) {
      const i = this.dead.pop()!;
      let x = 0, y = 0, z = 0; do { x = this.rnd() * 2 - 1; y = this.rnd() * 2 - 1; z = this.rnd() * 2 - 1; } while (x * x + y * y + z * z > 1);
      this.px[i] = cx + x * R; this.py[i] = cy + y * R; this.pz[i] = cz + z * R;
      this.vx[i] = vx0 + x * 0.6; this.vy[i] = -7 - this.rnd() * 1.5; this.vz[i] = vz0 + z * 0.6;
      this.r[i] = this.r0[i] * s; this.alive[i] = 1; this.restT[i] = 0; this.gap[i] = 1;
      const c = pal[Math.floor(this.rnd() * pal.length) % pal.length]; this.col[i * 3] = c[0]; this.col[i * 3 + 1] = c[1]; this.col[i * 3 + 2] = c[2];
      const m = this.rnd(); this.mat[i] = m < 0.72 ? 0 : m < 0.82 ? 1 : m < 0.95 ? 2 : 3;
    }
  }
  step(dt: number, sub = 1, gather = true) {
    const t0 = performance.now();
    if (this.t >= this.nextDrop) { this.spawnDrop(); this.nextDrop = this.t + Math.max(0.6, this.P.dropEvery); }
    const h = dt / sub; let contacts = 0;
    for (let s = 0; s < sub; s++) contacts = this.substep(h, gather && s === sub - 1);
    this.t += dt;
    let a = 0; for (let i = 0; i < this.N; i++) a += this.alive[i];
    this.stats = { stepMs: performance.now() - t0, contacts, alive: a };
  }
  private substep(h: number, gather: boolean): number {
    const { N, px, py, pz, vx, vy, vz, r, alive } = this; const cols = this.cols; const P = this.P;
    const drag = 1 - 0.05 * h; const eW = 1 + P.bounce, eB = 1 + P.bounce * 0.85; const g = P.gravity;
    for (let i = 0; i < N; i++) {
      if (!alive[i]) continue;
      vy[i] -= g * h; vx[i] *= drag; vy[i] *= drag; vz[i] *= drag;
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
            const e = vn < -1.2 ? eW : 1.05;   // quiet resting contacts, lively impacts
            vx[i] -= e * vn * nx; vy[i] -= e * vn * ny; vz[i] -= e * vn * nz;
            const f = 1 - 0.8 * h; const vn2 = vx[i] * nx + vy[i] * ny + vz[i] * nz;
            vx[i] = (vx[i] - vn2 * nx) * f + vn2 * nx; vy[i] = (vy[i] - vn2 * ny) * f + vn2 * ny; vz[i] = (vz[i] - vn2 * nz) * f + vn2 * nz;
          }
        }
      }
      this.gap[i] = gmin;
      // settled balls dissolve after `rest` seconds so the floor never clogs and the next drop has balls
      const sp2 = vx[i] * vx[i] + vy[i] * vy[i] + vz[i] * vz[i];
      if (sp2 < 0.6 && gmin < 0.05) this.restT[i] += h; else this.restT[i] = Math.max(0, this.restT[i] - h * 0.5);
      if (this.restT[i] > P.rest) { r[i] *= 1 - 1.6 * h; if (r[i] < 0.03) { this.kill(i); continue; } }
      if (pz[i] > 16 || py[i] < -8 || Math.abs(px[i]) > 20 || py[i] > 40) this.kill(i);
    }
    const T = ColorRoomSim.T, H = ColorRoomSim.H, cs = this.cs, cc = this.cc, so = this.so, ky = this.ky;
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
          const mi = r[i] ** 3, mj = r[j] ** 3, wi = mj / (mi + mj), wj = 1 - wi; const pen = R - d;
          px[i] -= nx * pen * wi; py[i] -= ny * pen * wi; pz[i] -= nz * pen * wi; px[j] += nx * pen * wj; py[j] += ny * pen * wj; pz[j] += nz * pen * wj;
          const vn = (vx[j] - vx[i]) * nx + (vy[j] - vy[i]) * ny + (vz[j] - vz[i]) * nz;
          if (vn < 0) { const imp = -(vn < -1 ? eB : 1.1) * vn; vx[i] -= nx * imp * wi; vy[i] -= ny * imp * wi; vz[i] -= nz * imp * wi; vx[j] += nx * imp * wj; vy[j] += ny * imp * wj; vz[j] += nz * imp * wj; }
        }
      }
    }
    return contacts;
  }
}

export const ROOM_CAMERAS = ['Low Wide', 'Orbit', 'Overhead Dive', 'Front Row'];

export class ColorRoomScene implements PhysScene {
  name = 'colorroom'; ready = false; error: string | null = null; stats: Record<string, any> = {};
  sim = new ColorRoomSim();
  private ms: MsTarget; private msR: MsTarget; private sm: ShadowMap;
  private pSurf: Prog; private pBall: Prog; private pBg: Prog; private pShS: Prog; private pShB: Prog; private pSplat: Prog;
  private surfVao!: WebGLVertexArrayObject; private surfCount = 0;
  private ballHi!: WebGLVertexArrayObject; private ballHiCount = 0; private ballLo!: WebGLVertexArrayObject; private ballLoCount = 0;
  private splatVao!: WebGLVertexArrayObject; private inst!: WebGLBuffer; private instData: Float32Array;
  private ao: { f: WebGLFramebuffer; t: WebGLTexture } | null = null;
  private acc = 0; private prerolled = false;
  private static AO_W = 768; private static AO_H = 640; private static AO_RECT = [-9.6, -12.6, 19.2, 16];
  constructor(private gl: WebGL2RenderingContext) {
    this.ms = new MsTarget(gl, 4); this.msR = new MsTarget(gl, 0); this.sm = new ShadowMap(gl, 4096);
    this.pSurf = compile(gl, SURF_VS, SURF_FS, 'room-surf'); this.pBall = compile(gl, BALL_VS, BALL_FS, 'room-ball');
    this.pBg = compile(gl, BG_VS, BG_FS, 'room-bg'); this.pShS = compile(gl, SURF_VS, SHADOW_FS, 'room-sh-s');
    this.pShB = compile(gl, BALL_VS, SHADOW_FS, 'room-sh-b'); this.pSplat = compile(gl, SPLAT_VS, SPLAT_FS, 'room-splat');
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
      vb(s.pos, 0, 3); gl.bindBuffer(gl.ARRAY_BUFFER, this.inst);
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
    const t = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, ColorRoomScene.AO_W, ColorRoomScene.AO_H, 0, gl.RGBA, gl.HALF_FLOAT, null);
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
    const gl = this.gl, P = f.params;
    const sp = this.sim.P;
    sp.dropSize = P.grDropSize ?? sp.dropSize; sp.dropEvery = P.grDropEvery ?? sp.dropEvery; sp.bounce = P.grBounce ?? sp.bounce;
    sp.gravity = P.grGravity ?? sp.gravity; sp.ballSize = P.grBallSize ?? sp.ballSize; sp.order = P.grOrder ?? sp.order; sp.spread = P.grSpread ?? sp.spread; sp.rest = P.grRest ?? sp.rest;
    const room = ROOM_PALETTES[P.grRoom as string] ?? ROOM_PALETTES['Pop Gallery'];
    if (!this.prerolled) { for (let i = 0; i < 60 * 6; i++) this.sim.step(1 / 60, 1, false); this.prerolled = true; }
    if (!P.paused) {
      this.acc += Math.min(0.05, f.dt) * P.speed;
      let n = 0; while (this.acc >= 1 / 60 && n < 2) { this.sim.step(1 / 60, 1); this.acc -= 1 / 60; n++; }
      if (n === 2) this.acc = 0;
    }
    const nInst = this.upload();
    const t = f.time; const cam = (P.grCamera as string) ?? 'Low Wide'; const shake = (P.grCamEnergy ?? 1);
    let eye: Vec3, tgt: Vec3;
    if (cam === 'Orbit') { const a = t * 0.12 * shake; eye = [Math.sin(a) * 9, 3.2, -4 + Math.cos(a) * 13]; tgt = [0, 2.0, -5]; }
    else if (cam === 'Overhead Dive') { eye = [Math.sin(t * 0.1) * 2, 13.5 + Math.sin(t * 0.21) * shake, 6.5]; tgt = [0, 0, -5]; }
    else if (cam === 'Front Row') { eye = [Math.sin(t * 0.17) * 1.2 * shake, 1.1, 5.5]; tgt = [0, 2.6, -6]; }
    else { eye = [Math.sin(t * 0.13) * 2.4 * shake, 2.3 + Math.sin(t * 0.23) * 0.4 * shake, 10.5]; tgt = [Math.sin(t * 0.09) * 1.2 * shake, 3.0, -5]; }
    const fovy = (P.fov ?? 58) * Math.PI / 180;
    const view = lookAt(eye, tgt); const proj = perspective(fovy, f.aspect, 0.2, 140); const vp = mul(proj, view);
    const az = (P.keyAz ?? -30) * Math.PI / 180, el = (P.keyEl ?? 55) * Math.PI / 180;
    const Ld = norm([Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)]);
    const ctr: Vec3 = [0, 3, -4.5];
    const lview = lookAt([ctr[0] + Ld[0] * 40, ctr[1] + Ld[1] * 40, ctr[2] + Ld[2] * 40], ctr);
    const lvp = mul(ortho(-15, 15, -15, 15, 5, 85), lview);
    const fwd = norm([tgt[0] - eye[0], tgt[1] - eye[1], tgt[2] - eye[2]]);
    const look = { ...lookOf('Coral Peach'), bgTop: room.bgTop, bgBottom: room.bgBottom, glow: room.bgTop };
    const env = { look, L: Ld, F: norm([0.6, 0.5, 0.6]) as Vec3, fwd };
    const matCols = new Float32Array(15);
    [room.back, room.side, room.accent, room.floor, room.sculpt].forEach((h, i) => matCols.set(srgbHex(h), i * 3));
    // shadow
    this.sm.begin(); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
    gl.useProgram(this.pShS.p); gl.uniformMatrix4fv(this.pShS.u.uVP, false, lvp); gl.uniform1f(this.pShS.u.uMirror, 0);
    gl.bindVertexArray(this.surfVao); gl.drawElements(gl.TRIANGLES, this.surfCount, gl.UNSIGNED_INT, 0);
    gl.useProgram(this.pShB.p); gl.uniformMatrix4fv(this.pShB.u.uVP, false, lvp); gl.uniform1f(this.pShB.u.uMirror, 0);
    gl.bindVertexArray(this.ballLo); gl.drawElementsInstanced(gl.TRIANGLES, this.ballLoCount, gl.UNSIGNED_SHORT, 0, nInst);
    this.sm.end();
    // contact AO
    this.ensureAO(); const R = ColorRoomScene.AO_RECT;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.ao!.f); gl.viewport(0, 0, ColorRoomScene.AO_W, ColorRoomScene.AO_H); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(this.pSplat.p); gl.uniform4fv(this.pSplat.u.uAORect, R);
    gl.bindVertexArray(this.splatVao); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, nInst);
    gl.disable(gl.BLEND);
    const fogTint: Vec3 = [1, 1, 1];
    const common = (pr: Prog, mirror: boolean, w: number, h: number) => {
      const u = pr.u; gl.useProgram(pr.p); setStudioEnv(gl, u, env);
      gl.uniformMatrix4fv(u.uVP, false, vp); gl.uniform3fv(u.uCamPos, mirror ? [eye[0], -eye[1], eye[2]] : eye);
      gl.uniform1f(u.uMirror, mirror ? 1 : 0); gl.uniform1f(u.uIrid, P.irid ?? 0.8);
      gl.uniform1f(u.uFogK, 0.012); gl.uniform1f(u.uFogStart, 18); gl.uniform3fv(u.uFogTint, fogTint);
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.sm.tex); gl.uniform1i(u.uShadow, 3); gl.uniformMatrix4fv(u.uLightVP, false, lvp);
      gl.uniform1f(u.uShadowSoft, 2.2); gl.uniform1f(u.uShadowTexel, 1 / 4096);
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
    const rw = Math.max(2, f.w >> 1), rh = Math.max(2, f.h >> 1);
    this.msR.ensure(rw, rh); this.msR.begin();
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS);
    drawBg();
    common(this.pSurf, true, rw, rh); gl.bindVertexArray(this.surfVao); gl.drawElements(gl.TRIANGLES, this.surfCount, gl.UNSIGNED_INT, 0);
    common(this.pBall, true, rw, rh); gl.bindVertexArray(this.ballLo); gl.drawElementsInstanced(gl.TRIANGLES, this.ballLoCount, gl.UNSIGNED_SHORT, 0, nInst);
    const reflTex = this.msR.resolve();
    this.ms.ensure(f.w, f.h); this.ms.begin();
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.depthMask(true);
    drawBg();
    let u = common(this.pSurf, false, f.w, f.h); gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, reflTex); gl.uniform1i(u.uRefl, 5);
    gl.bindVertexArray(this.surfVao); gl.drawElements(gl.TRIANGLES, this.surfCount, gl.UNSIGNED_INT, 0);
    u = common(this.pBall, false, f.w, f.h); gl.bindVertexArray(this.ballHi); gl.drawElementsInstanced(gl.TRIANGLES, this.ballHiCount, gl.UNSIGNED_SHORT, 0, nInst);
    gl.disable(gl.DEPTH_TEST); gl.bindVertexArray(null); gl.activeTexture(gl.TEXTURE0);
    const tex = this.ms.resolve();
    f.dof(tex, f.target, f.w, f.h, P.focus ?? 12, P.dof ?? 0.25);
    this.stats = { balls: nInst, contacts: this.sim.stats.contacts, physicsMs: +this.sim.stats.stepMs.toFixed(2), simTime: +this.sim.t.toFixed(1), drop: this.sim.drop };
  }
}
