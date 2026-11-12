// Pass 6 "Paint Splash" (live): screen-filling bursts of thick paint flying toward the camera — crowns with
// finger ropes, Worthington-style jets, rope streams that neck into droplets, and droplet sprays — at many depths.
// Simulation: ballistic paint parcels (CPU, typed arrays) with drag, gravity, and per-burst velocity profiles
// that stretch sheets into ropes and break them into droplets. Rendering: screen-space fluid surfaces
// (after W. J. van der Laan, S. Green, M. Sainz, "Screen Space Fluid Rendering with Curvature Flow", I3D 2009):
// sphere/ellipsoid impostors -> linear depth + pigment MRT -> depth-aware bilateral smoothing (pigments mix where
// splashes touch) -> normals from smoothed depth -> wet acrylic shading (GGX + clear coat + studio env + thickness glow).
// Original MIT-licensed implementation for flow-engine (no third-party code). No Shadertoy code.
import { compile, QUAD_VS, STUDIO_GLSL, setStudioEnv, lookOf, dirFromAzEl, srgbHex, lookAt, perspective, mul, norm, cross, sub, tex2D,
  type PhysFrame, type PhysScene, type Prog, type Vec3 } from './common';

export const SPLASH_PALETTES: Record<string, string[]> = {
  'Carnival': ['#ff3b30', '#ffb300', '#00c2a8', '#1f4fe0', '#ff2d87', '#7b3fe4'],
  'Ocean Sunset': ['#ff6b4a', '#ffd166', '#06d6a0', '#118ab2', '#f78fb3'],
  'Candy': ['#ff8fb1', '#ffe3ec', '#7fdedb', '#b4f8c8', '#ffd59e', '#b79cff'],
  'Primary Pop': ['#e10600', '#ffd400', '#0047ff', '#f4f1ea', '#141414'],
  'Neon': ['#39ff14', '#ff00e6', '#00e5ff', '#fffb00', '#ff5e00'],
  'Earth & Gold': ['#c4572a', '#e9b44c', '#3f6e5a', '#f2e8cf', '#7a3b2e'],
};
export const SPLASH_SHAPES = ['Mixed', 'Crowns', 'Ropes', 'Spray'];
const MAXN = 110000;

const DEPTH_VS = `#version 300 es
layout(location=0) in vec2 aCorner; layout(location=1) in vec4 aPos; layout(location=2) in vec4 aVel; layout(location=3) in vec4 aCol;
uniform mat4 uView, uProj; uniform float uStretch;
out vec2 vL; out vec3 vC; out float vR; out vec3 vCol; flat out mat2 vRot; out float vS;
void main(){
  vec4 c = uView*vec4(aPos.xyz, 1.0); float r = aPos.w;
  r *= smoothstep(0.6, 3.2, -c.z);
  if (r <= 0.002 || c.z > -0.25) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec3 vv = mat3(uView)*aVel.xyz; vec2 sv = vv.xy; float sl = length(sv);
  vec2 ax = sl > 1e-4 ? sv/sl : vec2(1.0, 0.0);
  float s = 1.0 + min(sl*uStretch, 2.2);                       // motion-stretched ellipsoid (ropes read as continuous)
  vec2 q = aCorner; vec2 off = (ax*q.x*s + vec2(-ax.y, ax.x)*q.y)*r*1.02;
  vL = aCorner; vC = c.xyz; vR = r; vCol = aCol.rgb; vS = s;
  vec4 p = c; p.xy += off; gl_Position = uProj*p;
}`;
const DEPTH_FS = `#version 300 es
precision highp float;
in vec2 vL; in vec3 vC; in float vR; in vec3 vCol; in float vS;
uniform mat4 uProj;
layout(location=0) out vec4 oD; layout(location=1) out vec4 oC;
void main(){
  float d2 = dot(vL, vL); if (d2 > 1.0) discard;
  float nz = sqrt(1.0 - d2);
  float z = vC.z + nz*vR*mix(0.85, 0.6, clamp(vS-1.0, 0.0, 1.0));
  vec4 cp = uProj*vec4(vC.xy, z, 1.0);
  gl_FragDepth = cp.z/cp.w*0.5 + 0.5;
  oD = vec4(-z, vR, 0.0, 1.0);
  oC = vec4(vCol, 1.0);
}`;
// separable depth-aware bilateral smoothing of depth + pigment (two MRT outputs)
// depth-aware 2D bilateral smoothing of depth + pigment (ring kernel, no separable streaks; two MRT outputs)
const BLUR_FS = `#version 300 es
precision highp float; in vec2 vUv;
uniform sampler2D uD, uC; uniform vec2 uTexel; uniform float uWorldR, uPxPerUnit, uFall, uRot;
layout(location=0) out vec4 oD; layout(location=1) out vec4 oC;
void main(){
  vec2 dr0 = texture(uD, vUv).rg; float d0 = dr0.r; vec4 c0 = texture(uC, vUv);
  if (d0 <= 0.0) { oD = vec4(0.0); oC = vec4(0.0); return; }
  float rpx = clamp(min(uWorldR, dr0.g*1.5)*uPxPerUnit/d0, 1.5, 150.0); float sig = rpx*0.5;
  float ws = 1.0, ds = d0; vec4 cs = c0;
  float jit = uRot;
  for (int j=1;j<=40;j++){
    float fr = sqrt(float(j)/40.0); float rr = rpx*fr; float a = float(j)*2.3999632 + jit;   // Vogel (golden-angle) disk
    vec2 uv = vUv + vec2(cos(a), sin(a))*rr*uTexel;
    float d = texture(uD, uv).r; if (d <= 0.0) continue;
    float dz = (d - d0)/(uFall*d0);
    float w = exp(-rr*rr/(2.0*sig*sig)) * exp(-dz*dz);
    ws += w; ds += d*w; cs += texture(uC, uv)*w;
  }
  oD = vec4(ds/ws, dr0.g, 0.0, 1.0); oC = cs/ws;
}`;
const COMP_FS = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o;
uniform sampler2D uD, uC, uDraw; uniform vec2 uTexel; uniform vec3 uEye, uFwd, uRight, uUp; uniform vec2 uTan;
uniform float uGloss, uThick, uTime;
${STUDIO_GLSL}
vec3 wpos(vec2 uv, float d){ vec2 n = uv*2.0-1.0; return uEye + (uFwd + uRight*n.x*uTan.x + uUp*n.y*uTan.y)*d; }
void main(){
  vec2 n = vUv*2.0-1.0; vec3 rd = normalize(uFwd + uRight*n.x*uTan.x + uUp*n.y*uTan.y);
  float d = texture(uD, vUv).r;
  vec3 bg = backdrop(rd);
  // soft paint-stained studio backdrop: big blurred pigment clouds far behind
  if (d <= 0.0) { o = vec4(bg, 60.0); return; }
  vec3 P = wpos(vUv, d);
  vec2 tx = uTexel*2.0;
  float dl = texture(uD, vUv - vec2(tx.x, 0.0)).r, dr = texture(uD, vUv + vec2(tx.x, 0.0)).r;
  float db = texture(uD, vUv - vec2(0.0, tx.y)).r, dt = texture(uD, vUv + vec2(0.0, tx.y)).r;
  vec3 ddx = (dr <= 0.0 || (dl > 0.0 && abs(dl-d) < abs(dr-d))) ? P - wpos(vUv - vec2(tx.x,0.0), dl > 0.0 ? dl : d) : wpos(vUv + vec2(tx.x,0.0), dr) - P;
  vec3 ddy = (dt <= 0.0 || (db > 0.0 && abs(db-d) < abs(dt-d))) ? P - wpos(vUv - vec2(0.0,tx.y), db > 0.0 ? db : d) : wpos(vUv + vec2(0.0,tx.y), dt) - P;
  vec3 N = normalize(cross(ddx, ddy)); if (dot(N, -rd) < 0.0) N = -N;
  vec4 cc = texture(uC, vUv); vec3 alb = cc.rgb/max(cc.a, 1e-3); alb = max(mix(vec3(dot(alb, vec3(0.2126,0.7152,0.0722))), alb, 1.25), 0.0);
  // edge/thickness: raw (unsmoothed) coverage near silhouettes reads thinner -> a touch of transmitted glow
  float raw = texture(uDraw, vUv).r; float edge = clamp(abs(raw - d)*3.0/d*8.0, 0.0, 1.0);
  vec3 V = -rd;
  float nv = max(dot(N, V), 0.0);
  // cheap cavity AO from depth neighbourhood
  float ao = 0.0; for (int i=0;i<8;i++){ float a = float(i)*0.785398; vec2 o2 = vec2(cos(a), sin(a))*uTexel*14.0; float dn = texture(uD, vUv+o2).r; ao += dn > 0.0 ? clamp((d - dn)*1.6/d*6.0, 0.0, 1.0) : 0.0; }
  ao = 1.0 - ao/8.0*0.75;
  float hl = clamp(dot(N, normalize(uLightDir))*0.5+0.5, 0.0, 1.0);
  vec3 col = (0.55 + 0.6*hl*hl) * studioShade(P, N, V, alb, mix(0.24, 0.06, clamp(uGloss-0.5, 0.0, 1.0)), vec3(0.045), ao, 1.0, 0.25);
  // clear-coat second lobe: sharp studio softbox streaks on wet paint
  vec3 R = reflect(-V, N);
  float Fc = 0.04 + 0.96*pow(1.0 - nv, 5.0);
  col += envMap(R, 0.02) * Fc * 0.3 * uGloss;
  // subsurface-ish thickness glow (thin rims of thick paint let pigment light through)
  col += alb*alb * pow(1.0 - nv, 2.0) * 0.35 * uThick * (0.5 + 0.5*edge);
  o = vec4(col, d);
}`;

type Emitter = { kind: 0 | 1 | 2; o: Vec3; n: Vec3; u: Vec3; w: Vec3; t: number; T: number; c1: Vec3; c2: Vec3; fingers: Float32Array; speed: number; acc: number; r: number; split: number };

export class SplashScene implements PhysScene {
  name = 'Paint Splash'; ready = false; error: string | null = null; stats: Record<string, any> = {};
  private pDepth: Prog; private pBlur: Prog; private pComp: Prog;
  private vao: WebGLVertexArrayObject; private bPos: WebGLBuffer; private bVel: WebGLBuffer; private bCol: WebGLBuffer;
  private pos = new Float32Array(MAXN * 4); private vel = new Float32Array(MAXN * 4); private col = new Float32Array(MAXN * 4);
  private age = new Float32Array(MAXN); private life = new Float32Array(MAXN);
  private head = 0; private em: Emitter[] = []; private t = 0; private nextBurst = 0; private seed = 1234567;
  private fb: { f: WebGLFramebuffer; d: WebGLTexture; c: WebGLTexture; z?: WebGLRenderbuffer }[] = []; private w = 0; private h = 0;
  constructor(private gl: WebGL2RenderingContext) {
    this.pDepth = compile(gl, DEPTH_VS, DEPTH_FS, 'splash-depth');
    this.pBlur = compile(gl, QUAD_VS, BLUR_FS, 'splash-blur');
    this.pComp = compile(gl, QUAD_VS, COMP_FS, 'splash-comp');
    this.vao = gl.createVertexArray()!; gl.bindVertexArray(this.vao);
    const corner = gl.createBuffer()!; gl.bindBuffer(gl.ARRAY_BUFFER, corner); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const mk = (loc: number) => { const b = gl.createBuffer()!; gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, MAXN * 16, gl.DYNAMIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(loc, 1); return b; };
    this.bPos = mk(1); this.bVel = mk(2); this.bCol = mk(3);
    gl.bindVertexArray(null);
  }
  load() { this.ready = true; }
  private rnd() { this.seed = (this.seed * 1664525 + 1013904223) >>> 0; return this.seed / 4294967296; }
  private ensure(w: number, h: number) {
    const gl = this.gl; if (w === this.w && h === this.h) return;
    for (const b of this.fb) { gl.deleteFramebuffer(b.f); gl.deleteTexture(b.d); gl.deleteTexture(b.c); if (b.z) gl.deleteRenderbuffer(b.z); }
    this.fb = []; this.w = w; this.h = h;
    for (let i = 0; i < 3; i++) {
      const f = gl.createFramebuffer()!; gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      const d = tex2D(gl, w, h, gl.RG32F, gl.RG, gl.FLOAT, gl.NEAREST); const c = tex2D(gl, w, h, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, d, 0); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, c, 0);
      let z: WebGLRenderbuffer | undefined;
      if (i === 0) { z = gl.createRenderbuffer()!; gl.bindRenderbuffer(gl.RENDERBUFFER, z); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, z); }
      gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
      this.fb.push({ f, d, c, z });
    }
    this.out = tex2D(gl, w, h, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR);
    this.outF = gl.createFramebuffer()!; gl.bindFramebuffer(gl.FRAMEBUFFER, this.outF); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.out, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  private out: WebGLTexture | null = null; private outF: WebGLFramebuffer | null = null;

  private spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, r: number, c: Vec3, life: number) {
    const i = this.head; this.head = (this.head + 1) % MAXN; const k = i * 4;
    this.pos[k] = x; this.pos[k + 1] = y; this.pos[k + 2] = z; this.pos[k + 3] = r;
    this.vel[k] = vx; this.vel[k + 1] = vy; this.vel[k + 2] = vz;
    this.col[k] = c[0]; this.col[k + 1] = c[1]; this.col[k + 2] = c[2]; this.col[k + 3] = 1;
    this.age[i] = 0; this.life[i] = life;
  }
  private newBurst(P: Record<string, any>, eye: Vec3) {
    const pal = (SPLASH_PALETTES[P.spPalette] ?? SPLASH_PALETTES['Carnival']).map((h) => srgbHex(h) as Vec3);
    const shape = P.spShape ?? 'Mixed';
    const r = this.rnd();
    const kind: 0 | 1 | 2 = shape === 'Crowns' ? 0 : shape === 'Ropes' ? 1 : shape === 'Spray' ? 2 : (r < 0.5 ? 0 : r < 0.86 ? 1 : 2);
    const depth = 6 + this.rnd() * 13 * (P.spDepth ?? 1);
    const fx = (this.rnd() * 2 - 1) * depth * 0.62, fy = (this.rnd() * 2 - 1) * depth * 0.36;
    const o: Vec3 = [eye[0] + fx, eye[1] + fy, eye[2] - depth];
    // aim roughly at the lens with a sideways bias so paint sweeps across the frame on its way past
    const aim: Vec3 = [eye[0] + (this.rnd() * 2 - 1) * 2.5, eye[1] + (this.rnd() * 2 - 1) * 1.6, eye[2]];
    const n = norm(sub(aim, o));
    const u = norm(cross(Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], n)); const w = cross(n, u);
    const ci = Math.floor(this.rnd() * pal.length); let cj = Math.floor(this.rnd() * pal.length); if (cj === ci) cj = (cj + 1) % pal.length;
    const mix = this.rnd() < (P.spMix ?? 0.5);
    const K = 168; const fingers = new Float32Array(K);
    const nf = 5 + Math.floor(this.rnd() * 7); const ph = this.rnd() * 6.283;
    for (let k = 0; k < K; k++) { const a = k / K * 6.283; let s = 1; for (let j = 0; j < nf; j++) { const fa = ph + j / nf * 6.283 + (this.rnd() - 0.5) * 0.3; const da = Math.atan2(Math.sin(a - fa), Math.cos(a - fa)); s += 0.75 * Math.exp(-da * da / 0.012); } fingers[k] = s; }
    const size = P.spSize ?? 1;
    this.em.push({ kind, o, n, u, w, t: 0, T: kind === 0 ? 0.42 : kind === 1 ? 0.9 : 0.12, c1: pal[ci], c2: mix ? pal[cj] : pal[ci], fingers,
      speed: (P.spSpeed ?? 1) * (0.85 + this.rnd() * 0.4), acc: 0, r: (0.1 + this.rnd() * 0.06) * size, split: this.rnd() * 6.283 });
  }
  private step(dt: number, P: Record<string, any>, eye: Vec3) {
    const rate = P.spRate ?? 2.2; const g = -(P.spGravity ?? 1.6); const drag = 1 - Math.min(0.5, (P.spDrag ?? 0.25) * dt);
    this.nextBurst -= dt;
    while (this.nextBurst <= 0) { this.newBurst(P, eye); this.nextBurst += (0.4 + this.rnd() * 1.2) / Math.max(0.05, rate); }
    const drops = P.spDroplets ?? 1;
    for (let e = this.em.length - 1; e >= 0; e--) {
      const E = this.em[e]; const k = E.t / E.T; const S = E.speed;
      if (E.kind === 0) {
        // crown: an expanding ring sheet; finger slots fly faster and longer -> ropes ending in droplets; late central jet
        const K = E.fingers.length; const rings = Math.max(1, Math.round(dt * 60 * 1.5));
        for (let ri = 0; ri < rings; ri++) for (let s = 0; s < K; s++) {
          const fs = E.fingers[s]; if (k > 0.55 && fs < 1.25) continue;
          const a = (s + this.rnd() * 0.6) / K * 6.283; const ca = Math.cos(a), sa = Math.sin(a);
          const rd: Vec3 = [E.u[0] * ca + E.w[0] * sa, E.u[1] * ca + E.w[1] * sa, E.u[2] * ca + E.w[2] * sa];
          const vr = 2.5 * S * fs * (1 - 0.6 * k), vn = 4.6 * S * (0.75 + 0.35 * fs) * (1 - 0.35 * k);
          const r0 = 0.35 + 0.4 * k; const c = Math.sin(a + E.split) > 0 ? E.c1 : E.c2;
          const rr = E.r * 1.35 * (0.75 + 0.35 * fs) * (1 - 0.35 * k);
          this.spawn(E.o[0] + rd[0] * r0, E.o[1] + rd[1] * r0, E.o[2] + rd[2] * r0, rd[0] * vr + E.n[0] * vn, rd[1] * vr + E.n[1] * vn, rd[2] * vr + E.n[2] * vn, rr, c, 7);
          if (fs > 1.4 && this.rnd() < 0.05 * drops) { const q = 1.1 + this.rnd() * 0.5; this.spawn(E.o[0] + rd[0] * r0, E.o[1] + rd[1] * r0, E.o[2] + rd[2] * r0, (rd[0] * vr + E.n[0] * vn) * q, (rd[1] * vr + E.n[1] * vn) * q, (rd[2] * vr + E.n[2] * vn) * q, rr * (0.6 + this.rnd() * 0.6), c, 7); }
        }
        if (k > 0.45) for (let j = 0; j < 6; j++) { const jv = 9 * S * (1.25 - k); const jx = (this.rnd() - 0.5) * 0.3, jy = (this.rnd() - 0.5) * 0.3;
          this.spawn(E.o[0] + E.u[0] * jx + E.w[0] * jy, E.o[1] + E.u[1] * jx + E.w[1] * jy, E.o[2] + E.u[2] * jx + E.w[2] * jy, E.n[0] * jv, E.n[1] * jv, E.n[2] * jv, E.r * 1.3 * (1.1 - k * 0.6), E.c2, 7); }
      } else if (E.kind === 1) {
        // rope: a wobbling stream whose head is fastest -> it stretches, necks and pinches into droplets
        const per = Math.max(1, Math.round(dt * 60)) * 34;
        for (let j = 0; j < per; j++) {
          const wob = Math.sin(E.t * 9 + E.split) * 0.35, wob2 = Math.cos(E.t * 6.5 + E.split * 1.7) * 0.35;
          const dir = norm([E.n[0] + E.u[0] * wob + E.w[0] * wob2, E.n[1] + E.u[1] * wob + E.w[1] * wob2, E.n[2] + E.u[2] * wob + E.w[2] * wob2]);
          const sp = 9.5 * S * (1 - 0.62 * k) * (1 + (this.rnd() - 0.5) * 0.06);
          const jx = (this.rnd() - 0.5) * 0.22, jy = (this.rnd() - 0.5) * 0.22;
          const c = (k * 3 + Math.sin(E.split)) % 2 < 1 ? E.c1 : E.c2;
          this.spawn(E.o[0] + E.u[0] * jx + E.w[0] * jy, E.o[1] + E.u[1] * jx + E.w[1] * jy, E.o[2] + E.u[2] * jx + E.w[2] * jy, dir[0] * sp, dir[1] * sp, dir[2] * sp, E.r * 1.6, c, 7);
        }
      } else {
        // spray: a fan of droplets of many sizes (power-law) thrown at the lens
        const n = Math.round(120 * drops * Math.max(1, dt * 60));
        for (let j = 0; j < n; j++) {
          const th = this.rnd() * 6.283, cr = Math.pow(this.rnd(), 0.6) * 0.75;
          const dir = norm([E.n[0] + (E.u[0] * Math.cos(th) + E.w[0] * Math.sin(th)) * cr, E.n[1] + (E.u[1] * Math.cos(th) + E.w[1] * Math.sin(th)) * cr, E.n[2] + (E.u[2] * Math.cos(th) + E.w[2] * Math.sin(th)) * cr]);
          const sp = (4 + this.rnd() * 7) * S; const rr = E.r * (0.35 + Math.pow(this.rnd(), 3) * 1.9);
          this.spawn(E.o[0], E.o[1], E.o[2], dir[0] * sp, dir[1] * sp, dir[2] * sp, rr, this.rnd() < 0.5 ? E.c1 : E.c2, 7);
        }
      }
      E.t += dt; if (E.t >= E.T) this.em.splice(e, 1);
    }
    let alive = 0;
    const pos = this.pos, vel = this.vel;
    for (let i = 0; i < MAXN; i++) {
      const k = i * 4; if (pos[k + 3] <= 0) continue;
      this.age[i] += dt;
      vel[k + 1] += g * dt; vel[k] *= drag; vel[k + 1] *= drag; vel[k + 2] *= drag;
      pos[k] += vel[k] * dt; pos[k + 1] += vel[k + 1] * dt; pos[k + 2] += vel[k + 2] * dt;
      if (this.age[i] > this.life[i] || pos[k + 2] > eye[2] - 0.5 || pos[k + 1] < eye[1] - 30) { pos[k + 3] = 0; continue; }
      alive++;
    }
    return alive;
  }

  render(f: PhysFrame) {
    const gl = this.gl; const P = f.params as Record<string, any>;
    this.ensure(f.w, f.h);
    const dt = Math.min(f.dt, 1 / 20) * (P.speed ?? 1);
    this.t += dt;
    const ce = P.spCamDrift ?? 1;
    const eye: Vec3 = [Math.sin(this.t * 0.13) * 0.5 * ce, Math.cos(this.t * 0.11) * 0.3 * ce, 0];
    const tgt: Vec3 = [Math.sin(this.t * 0.07) * 1.2 * ce, Math.sin(this.t * 0.09) * 0.6 * ce, -10];
    const t0 = performance.now();
    const alive = dt > 0 ? this.step(dt, P, eye) : (this.stats.particles ?? 0);
    const simMs = performance.now() - t0;
    const fovy = (P.fov ?? 50) * Math.PI / 180;
    const view = lookAt(eye, tgt), proj = perspective(fovy, f.aspect, 0.1, 200);
    const fwd = norm(sub(tgt, eye)); const right = norm(cross(fwd, [0, 1, 0])); const up = cross(right, fwd);
    // upload
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bPos); gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.pos);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bVel); gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vel);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bCol); gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.col);
    // 1) impostor depth + pigment
    const A = this.fb[0], B = this.fb[1], C = this.fb[2];
    gl.bindFramebuffer(gl.FRAMEBUFFER, A.f); gl.viewport(0, 0, f.w, f.h);
    gl.clearBufferfv(gl.COLOR, 0, [0, 0, 0, 0]); gl.clearBufferfv(gl.COLOR, 1, [0, 0, 0, 0]); gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.disable(gl.BLEND);
    gl.useProgram(this.pDepth.p);
    gl.uniformMatrix4fv(this.pDepth.u.uView, false, view); gl.uniformMatrix4fv(this.pDepth.u.uProj, false, proj);
    gl.uniform1f(this.pDepth.u.uStretch, 0.14 * (P.spStretch ?? 1));
    gl.bindVertexArray(this.vao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, MAXN); gl.bindVertexArray(null);
    gl.disable(gl.DEPTH_TEST);
    // 2) bilateral smoothing (iterated, separable)
    gl.useProgram(this.pBlur.p);
    const pxPerUnit = f.h / (2 * Math.tan(fovy / 2));
    gl.uniform1f(this.pBlur.u.uWorldR, 0.42 * (P.spSmooth ?? 1)); gl.uniform1f(this.pBlur.u.uPxPerUnit, pxPerUnit); gl.uniform1f(this.pBlur.u.uFall, 0.1);
    gl.uniform1i(this.pBlur.u.uD, 0); gl.uniform1i(this.pBlur.u.uC, 1);
    gl.uniform2f(this.pBlur.u.uTexel, 1 / f.w, 1 / f.h);
    let src = A; const iters = 3;
    for (let it = 0; it < iters; it++) {
      const dst = src === B ? C : B;
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.f);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.d); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, src.c);
      gl.uniform1f(this.pBlur.u.uRot, it * 1.1);
      gl.drawArrays(gl.TRIANGLES, 0, 3); src = dst;
    }
    // 3) shade
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.outF); gl.viewport(0, 0, f.w, f.h);
    gl.useProgram(this.pComp.p);
    const look = lookOf(P.look ?? 'Coral Peach');
    setStudioEnv(gl, this.pComp.u, { look, L: dirFromAzEl(P.keyAz ?? -35, P.keyEl ?? 40), F: dirFromAzEl((P.keyAz ?? -35) + 140, 25), fwd });
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.d); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, src.c);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, A.d);
    gl.uniform1i(this.pComp.u.uD, 0); gl.uniform1i(this.pComp.u.uC, 1); gl.uniform1i(this.pComp.u.uDraw, 2);
    gl.uniform2f(this.pComp.u.uTexel, 1 / f.w, 1 / f.h);
    gl.uniform3fv(this.pComp.u.uEye, eye); gl.uniform3fv(this.pComp.u.uFwd, fwd); gl.uniform3fv(this.pComp.u.uRight, right); gl.uniform3fv(this.pComp.u.uUp, up);
    gl.uniform2f(this.pComp.u.uTan, Math.tan(fovy / 2) * f.aspect, Math.tan(fovy / 2));
    gl.uniform1f(this.pComp.u.uGloss, P.gloss ?? 1); gl.uniform1f(this.pComp.u.uThick, P.spGlow ?? 1); gl.uniform1f(this.pComp.u.uTime, this.t);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0);
    f.dof(this.out!, f.target, f.w, f.h, P.spFocus ?? 6, P.dof ?? 0.45);
    void mul;
    this.stats = { particles: alive, emitters: this.em.length, simMs: +simMs.toFixed(2) };
  }
}
