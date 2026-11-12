// Pass 4 "Thick Paint" (live): a GPU stable-fluids solver (after Jos Stam, "Stable Fluids", SIGGRAPH 1999:
// semi-Lagrangian advection + Jacobi pressure projection) on a vertical canvas. Gravity acts on the paint mass,
// thin films adhere (so drips run and leave a trail), and paint is carried as premultiplied pigment + thickness
// so colours mix by mass like acrylic. Rendered as a glossy impasto heightfield: wet GGX highlights, cavity AO,
// self-shadowing toward the key light and advected "bristle" grain.
// Original MIT-licensed implementation for flow-engine (no third-party code). No Shadertoy code.
import { compile, fbo, deleteFB, QUAD_VS, STUDIO_GLSL, setStudioEnv, lookOf, lin, dirFromAzEl, srgbHex, type FB, type PhysFrame, type PhysScene, type Prog } from './common';

const HEAD = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o;`;
const ADVECT = `${HEAD}
uniform sampler2D uVel, uSrc; uniform vec2 uVelTexel; uniform float uDt, uDiss, uOpenBottom;
void main(){
  vec2 v = texture(uVel, vUv).xy;
  vec2 p = vUv - uDt*v;
  if (uOpenBottom > 0.5 && (p.y < 0.002 || p.y > 0.998 || p.x < 0.002 || p.x > 0.998)) { o = vec4(0.0); return; }
  vec4 c = texture(uSrc, clamp(p, vec2(0.0), vec2(1.0))) * uDiss;
  if (uOpenBottom > 0.5) { float k = 1.0 - 0.006*uDt*60.0*(1.0 - smoothstep(0.05, 0.35, c.a)); c *= k; }
  o = c;
}`;
// body forces: gravity on paint mass, adhesion of thin films, viscous smoothing, splats
const FORCES = `${HEAD}
uniform sampler2D uVel, uDye; uniform vec2 uTexel; uniform float uDt, uAdh, uVisc, uAspect; uniform vec2 uGravV;
uniform int uN; uniform vec4 uSp[12]; uniform vec4 uSv[12];
void main(){
  vec2 v = texture(uVel, vUv).xy;
  vec2 avg = 0.25*(texture(uVel, vUv+vec2(uTexel.x,0.)).xy + texture(uVel, vUv-vec2(uTexel.x,0.)).xy + texture(uVel, vUv+vec2(0.,uTexel.y)).xy + texture(uVel, vUv-vec2(0.,uTexel.y)).xy);
  float h = texture(uDye, vUv).a;
  float mass = smoothstep(0.03, 0.9, h);
  v = mix(v, avg, uVisc);                                   // viscosity (explicit diffusion)
  v += uGravV*mass*uDt;                                     // heavy paint flows downhill (canvas tilt)
  v *= mix(uAdh, 0.995, smoothstep(0.08, 0.55, h));          // thin films stick to the canvas
  for (int i=0;i<12;i++){ if (i>=uN) break;
    vec2 d = vUv - uSp[i].xy; d.x *= uAspect; float r = uSp[i].z;
    float w = exp(-dot(d,d)/(r*r));
    v += w*(uSv[i].xy + uSv[i].z*normalize(d+1e-6)*0.6);     // directed + radial (splash) impulse
  }
  o = vec4(v, 0.0, 1.0);
}`;
const DYE_SPLAT = `${HEAD}
uniform sampler2D uSrc; uniform float uAspect; uniform int uN; uniform vec4 uSp[12]; uniform vec4 uSc[12];
uniform sampler2D uGrain; uniform float uGrainMode, uTime;
float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
void main(){
  vec4 c = texture(uSrc, vUv);
  for (int i=0;i<12;i++){ if (i>=uN) break;
    vec2 d = vUv - uSp[i].xy; d.x *= uAspect; float r = uSp[i].z;
    float w = exp(-dot(d,d)/(r*r)) * uSc[i].a;
    if (uGrainMode > 0.5) { c.r = mix(c.r, h21(floor(vUv*vec2(900.0, 500.0)) + uTime*13.0), clamp(w*3.0,0.0,1.0)); continue; }
    c += vec4(uSc[i].rgb, 1.0)*w;                           // premultiplied pigment + thickness
  }
  if (uGrainMode < 0.5) c.a = min(c.a, 2.2), c.rgb = min(c.rgb, vec3(c.a));
  o = c;
}`;
const DIVERGENCE = `${HEAD}
uniform sampler2D uVel; uniform vec2 uTexel;
void main(){
  float L = texture(uVel, vUv-vec2(uTexel.x,0.)).x, R = texture(uVel, vUv+vec2(uTexel.x,0.)).x;
  float B = texture(uVel, vUv-vec2(0.,uTexel.y)).y, T = texture(uVel, vUv+vec2(0.,uTexel.y)).y;
  o = vec4(0.5*(R-L+T-B), 0., 0., 1.);
}`;
const JACOBI = `${HEAD}
uniform sampler2D uP, uDiv; uniform vec2 uTexel;
void main(){
  float L = texture(uP, vUv-vec2(uTexel.x,0.)).x, R = texture(uP, vUv+vec2(uTexel.x,0.)).x;
  float B = texture(uP, vUv-vec2(0.,uTexel.y)).x, T = texture(uP, vUv+vec2(0.,uTexel.y)).x;
  if (vUv.y < uTexel.y) B = 0.0; if (vUv.y > 1.0-uTexel.y) T = 0.0; if (vUv.x < uTexel.x) L = 0.0; if (vUv.x > 1.0-uTexel.x) R = 0.0; // open edges
  o = vec4((L+R+B+T - texture(uDiv, vUv).x)*0.25, 0., 0., 1.);
}`;
const GRADSUB = `${HEAD}
uniform sampler2D uP, uVel; uniform vec2 uTexel;
void main(){
  float L = texture(uP, vUv-vec2(uTexel.x,0.)).x, R = texture(uP, vUv+vec2(uTexel.x,0.)).x;
  float B = texture(uP, vUv-vec2(0.,uTexel.y)).x, T = texture(uP, vUv+vec2(0.,uTexel.y)).x;
  vec2 v = texture(uVel, vUv).xy - 0.5*vec2(R-L, T-B);
  o = vec4(v, 0., 1.);
}`;
// impasto render
const RENDER = `${HEAD}
uniform sampler2D uDye, uGrain; uniform vec2 uTexel; uniform float uHScale, uAspect, uGloss, uTime;
uniform vec3 uCanvasA, uCanvasB;
${STUDIO_GLSL}
float H(vec2 p){ vec4 d = texture(uDye, p); float g = texture(uGrain, p).r; float h = d.a/(1.0 + 0.6*d.a); return h*uHScale*(0.75 + 0.5*g); }
void main(){
  vec4 d = texture(uDye, vUv);
  float h = d.a;
  float cov = smoothstep(0.015, 0.09, h);
  vec3 pig = d.rgb/max(h, 1e-3);
  vec2 e = uTexel*1.25;
  float hl = H(vUv-vec2(e.x,0.)), hr = H(vUv+vec2(e.x,0.)), hb = H(vUv-vec2(0.,e.y)), ht = H(vUv+vec2(0.,e.y));
  vec3 N = normalize(vec3((hl-hr)/(2.0*e.x*uAspect), (hb-ht)/(2.0*e.y), 1.0));
  // cavity AO from the local height deficit
  float hc = H(vUv), blur = 0.0;
  for (int i=0;i<8;i++){ float a = float(i)*0.785; blur += H(vUv + vec2(cos(a)/uAspect, sin(a))*0.012); }
  blur /= 8.0;
  float ao = clamp(1.0 - (blur-hc)*2.2, 0.35, 1.0);
  // heightfield self-shadow toward the key light
  vec3 Ld = normalize(uLightDir);
  vec2 sd = normalize(Ld.xy)*vec2(1.0/uAspect, 1.0); float sh = 1.0;
  for (int i=1;i<=10;i++){ float s = float(i)*0.0035; float hh = H(vUv + sd*s); float ray = hc + s*Ld.z/max(length(Ld.xy),0.2)*0.9;
    sh = min(sh, clamp(1.0 - (hh-ray)*14.0, 0.0, 1.0)); }
  sh = mix(1.0, sh, 0.8);
  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 P = vec3(vUv, hc);
  // canvas: matte cove-coloured primed canvas with a fine weave
  vec2 wv = vUv*vec2(uAspect, 1.0)*420.0;
  float weave = 0.5 + 0.5*sin(wv.x)*sin(wv.y);
  vec3 canvas = mix(uCanvasB, uCanvasA, vUv.y) * (0.96 + 0.05*weave);
  vec3 albedo = mix(canvas, pig, cov);
  float rough = mix(0.75, clamp(0.10/max(uGloss,0.05), 0.04, 0.8), cov);
  vec3 col = studioShade(P, N, V, albedo, rough, vec3(mix(0.02, 0.05, cov)), ao, sh, 0.15*cov);
  // big studio softbox seen in the wet paint: the reflection vector sweeps across it wherever the surface tilts
  vec3 R = reflect(-V, N);
  vec2 bc = vec2(-0.32, 0.34);
  vec2 q = (R.xy - bc)/vec2(0.20, 0.13);
  float box = (1.0 - smoothstep(0.75, 1.0, max(abs(q.x), abs(q.y))));
  float Fr = 0.04 + 0.96*pow(1.0 - max(dot(N,V),0.0), 5.0);
  col += uKeyCol*box*cov*(0.35 + 2.5*Fr)*mix(0.6, 1.0, sh)*0.9;
  o = vec4(col, 3.0);
}`;

type Sp = { x: number; y: number; r: number; vx: number; vy: number; rad: number; c: [number, number, number]; amt: number };

export class PaintScene implements PhysScene {
  name = 'paint'; ready = false; error: string | null = null; stats: Record<string, any> = {};
  private pr: Record<string, Prog> = {};
  private vel: [FB, FB] | null = null; private pre: [FB, FB] | null = null; private div: FB | null = null;
  private dye: [FB, FB] | null = null; private grain: [FB, FB] | null = null;
  private vao: WebGLVertexArrayObject; private t = 0; private acc = 0; private dyeRes = [0, 0];
  constructor(private gl: WebGL2RenderingContext) {
    for (const [k, fs] of Object.entries({ ADVECT, FORCES, DYE_SPLAT, DIVERGENCE, JACOBI, GRADSUB, RENDER })) this.pr[k] = compile(gl, QUAD_VS, fs, 'paint-' + k);
    this.vao = gl.createVertexArray()!; this.ready = true;
  }
  load() {}
  private alloc(q: number) {
    const gl = this.gl;
    const dw = Math.round(1280 * q), dh = Math.round(720 * q);
    if (this.dye && this.dyeRes[0] === dw) return;
    for (const b of [this.vel, this.pre, this.dye, this.grain]) if (b) { deleteFB(gl, b[0]); deleteFB(gl, b[1]); }
    deleteFB(gl, this.div);
    const vw = 320, vh = 180;
    this.vel = [fbo(gl, vw, vh, gl.RG16F), fbo(gl, vw, vh, gl.RG16F)];
    this.pre = [fbo(gl, vw, vh, gl.R16F), fbo(gl, vw, vh, gl.R16F)];
    this.div = fbo(gl, vw, vh, gl.R16F);
    this.dye = [fbo(gl, dw, dh, gl.RGBA16F), fbo(gl, dw, dh, gl.RGBA16F)];
    this.grain = [fbo(gl, dw, dh, gl.R16F), fbo(gl, dw, dh, gl.R16F)];
    for (const b of [...this.dye, ...this.grain, ...this.vel, ...this.pre]) { gl.bindFramebuffer(gl.FRAMEBUFFER, b.f); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
    this.dyeRes = [dw, dh]; this.t = 0;
    // pre-roll so the canvas starts already painted (the loop has no visible start)
    for (let i = 0; i < 420; i++) this.step(1 / 60, this.palette);
  }
  private palette: [number, number, number][] = [];
  private pass(p: Prog, out: FB, set: (u: Record<string, WebGLUniformLocation | null>) => void) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, out.f); gl.viewport(0, 0, out.w, out.h);
    gl.useProgram(p.p); set(p.u); gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  private bind(unit: number, t: WebGLTexture, loc: WebGLUniformLocation | null) { const gl = this.gl; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(loc, unit); }
  variant = 'Pour';
  /** Canvas tilt (gravity in canvas plane). Pour: the tilt walks around a 24 s cycle so the poured paint keeps changing direction. */
  gravity(t: number): [number, number] {
    if (this.variant === 'Drip Wall') return [0, -0.75];
    const a = t * (2 * Math.PI / 24) + 0.6 * Math.sin(t * (2 * Math.PI / 12));
    const m = 0.26 + 0.12 * Math.sin(t * (2 * Math.PI / 8));
    return [Math.cos(a) * m, Math.sin(a) * m];
  }
  /** Emitter schedule (period 24 s): cups pour colour sections that rotate through the palette, plus periodic splashes. */
  private emitters(t: number, pal: [number, number, number][]): Sp[] {
    const out: Sp[] = []; const n = pal.length;
    const hs = (k: number, a: number) => { const s = Math.sin(k * 12.9898 + a * 78.233) * 43758.5453; return s - Math.floor(s); };
    if (this.variant === 'Drip Wall') {
      for (let k = 0; k < 4; k++) {
        const ph = t * 0.21 + k * 1.7;
        const x = 0.14 + k * 0.24 + 0.07 * Math.sin(ph) + 0.03 * Math.sin(ph * 2.3 + 1);
        const wave = Math.floor((t + k * 1.5) / 3.0);
        if (((t + k * 1.5) % 3.0) >= 2.4) continue;
        out.push({ x, y: 0.985, r: 0.016, vx: 0.05 * Math.cos(ph), vy: -0.35, rad: 0, c: pal[(wave + k * 2) % n], amt: 0.22 });
      }
    } else {
      // three cups circle the canvas pouring thick ribbons; each pours one colour section, then switches
      for (let k = 0; k < 4; k++) {
        const ph = t * (2 * Math.PI / 24) * (k % 2 ? -1 : 1) + k * 1.6;
        const x = 0.5 + (0.22 + 0.06 * k) * Math.cos(ph) * 0.95, y = 0.5 + (0.2 + 0.05 * k) * Math.sin(ph * (k === 2 ? 2 : 1));
        const wave = Math.floor((t + k * 2.0) / 4.0);
        const on = ((t + k * 2.0) % 4.0) < 3.2;
        if (!on) continue;
        out.push({ x, y, r: 0.03 + 0.01 * Math.sin(t * 2.1 + k), vx: 0.25 * -Math.sin(ph), vy: 0.25 * Math.cos(ph), rad: 0.25, c: pal[(wave * 2 + k * 3) % n], amt: 0.6 });
      }
    }
    // splash: every 1.6 s a heavy dollop lands and bursts outward
    const sIdx = Math.floor(t / 1.2), sT = t - sIdx * 1.2;
    if (sT < 0.1) {
      out.push({ x: 0.15 + 0.7 * hs(sIdx, 1), y: 0.2 + 0.6 * hs(sIdx, 2), r: 0.03 + 0.03 * hs(sIdx, 3), vx: (hs(sIdx, 4) - 0.5) * 0.8, vy: (hs(sIdx, 5) - 0.5) * 0.8, rad: 2.4 + 1.5 * hs(sIdx, 6), c: pal[(sIdx * 3) % n], amt: 0.7 });
    }
    return out;
  }
  private step(dt: number, pal: [number, number, number][]) {
    const gl = this.gl; const vt = [1 / this.vel![0].w, 1 / this.vel![0].h]; const aspect = 16 / 9;
    if (!pal.length) return;
    const sps = this.emitters(this.t, pal);
    const spA = new Float32Array(48), svA = new Float32Array(48), scA = new Float32Array(48);
    sps.slice(0, 12).forEach((s, i) => { spA.set([s.x, s.y, s.r, 0], i * 4); svA.set([s.vx, s.vy, s.rad, 0], i * 4); scA.set([s.c[0] * s.amt, s.c[1] * s.amt, s.c[2] * s.amt, s.amt], i * 4); });
    const N = Math.min(12, sps.length);
    const swap = (b: [FB, FB]) => { const t = b[0]; b[0] = b[1]; b[1] = t; };
    // velocity: advect, forces
    this.pass(this.pr.ADVECT, this.vel![1], (u) => { this.bind(0, this.vel![0].t, u.uVel); this.bind(1, this.vel![0].t, u.uSrc); gl.uniform1f(u.uDt, dt); gl.uniform1f(u.uDiss, 0.995); gl.uniform1f(u.uOpenBottom, 0); });
    swap(this.vel!);
    this.pass(this.pr.FORCES, this.vel![1], (u) => { this.bind(0, this.vel![0].t, u.uVel); this.bind(1, this.dye![0].t, u.uDye); gl.uniform2fv(u.uTexel, vt); gl.uniform1f(u.uDt, dt);
      const gv = this.gravity(this.t); gl.uniform2f(u.uGravV, gv[0], gv[1]); gl.uniform1f(u.uAdh, 0.88); gl.uniform1f(u.uVisc, 0.35); gl.uniform1f(u.uAspect, aspect);
      gl.uniform1i(u.uN, N); gl.uniform4fv(u['uSp[0]'], spA); gl.uniform4fv(u['uSv[0]'], svA.map((v, i) => (i % 4 === 3 ? 0 : v * dt * 6))); });
    swap(this.vel!);
    // projection
    this.pass(this.pr.DIVERGENCE, this.div!, (u) => { this.bind(0, this.vel![0].t, u.uVel); gl.uniform2fv(u.uTexel, vt); });
    for (let i = 0; i < 24; i++) { this.pass(this.pr.JACOBI, this.pre![1], (u) => { this.bind(0, this.pre![0].t, u.uP); this.bind(1, this.div!.t, u.uDiv); gl.uniform2fv(u.uTexel, vt); }); swap(this.pre!); }
    this.pass(this.pr.GRADSUB, this.vel![1], (u) => { this.bind(0, this.pre![0].t, u.uP); this.bind(1, this.vel![0].t, u.uVel); gl.uniform2fv(u.uTexel, vt); });
    swap(this.vel!);
    // paint: splat then advect (open bottom so paint drains and the canvas stays fresh)
    this.pass(this.pr.DYE_SPLAT, this.dye![1], (u) => { this.bind(0, this.dye![0].t, u.uSrc); gl.uniform1f(u.uAspect, aspect); gl.uniform1i(u.uN, N); gl.uniform4fv(u['uSp[0]'], spA); gl.uniform4fv(u['uSc[0]'], scA); gl.uniform1f(u.uGrainMode, 0); });
    swap(this.dye!);
    this.pass(this.pr.DYE_SPLAT, this.grain![1], (u) => { this.bind(0, this.grain![0].t, u.uSrc); gl.uniform1f(u.uAspect, aspect); gl.uniform1i(u.uN, N); gl.uniform4fv(u['uSp[0]'], spA); gl.uniform4fv(u['uSc[0]'], scA); gl.uniform1f(u.uGrainMode, 1); gl.uniform1f(u.uTime, this.t); });
    swap(this.grain!);
    this.pass(this.pr.ADVECT, this.dye![1], (u) => { this.bind(0, this.vel![0].t, u.uVel); this.bind(1, this.dye![0].t, u.uSrc); gl.uniform1f(u.uDt, dt); gl.uniform1f(u.uDiss, 0.9993); gl.uniform1f(u.uOpenBottom, 1); });
    swap(this.dye!);
    this.pass(this.pr.ADVECT, this.grain![1], (u) => { this.bind(0, this.vel![0].t, u.uVel); this.bind(1, this.grain![0].t, u.uSrc); gl.uniform1f(u.uDt, dt); gl.uniform1f(u.uDiss, 1.0); gl.uniform1f(u.uOpenBottom, 0); });
    swap(this.grain!);
    this.t += dt;
  }
  render(f: PhysFrame) {
    const gl = this.gl, P = f.params;
    const look = lookOf(P.look);
    this.variant = P.variant === 'Drip Wall' ? 'Drip Wall' : 'Pour';
    // skip the near-white slot so pigments stay saturated when they mix
    this.palette = [0, 1, 2, 3, 5, 6].map((i) => srgbHex(look.slots[i]) as [number, number, number]);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.bindVertexArray(this.vao);
    this.alloc(P.quality >= 1 ? 1 : 0.75);
    if (!P.paused) {
      this.acc += Math.min(0.1, f.dt) * P.speed;
      let n = 0; while (this.acc >= 1 / 60 && n < 3) { this.step(1 / 60, this.palette); this.acc -= 1 / 60; n++; }
      if (n === 3) this.acc = 0;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, f.target); gl.viewport(0, 0, f.w, f.h);
    const r = this.pr.RENDER; gl.useProgram(r.p); const u = r.u;
    setStudioEnv(gl, u, { look, L: dirFromAzEl(P.keyAz ?? -35, P.keyEl ?? 40).map((v, i) => (i === 2 ? Math.abs(v) : v)) as any, F: [0.6, 0.2, 0.75], fwd: [0, 0, -1] });
    // in canvas space the key comes from the upper left, in front of the canvas
    const az = (P.keyAz ?? -35) * Math.PI / 180, el = (P.keyEl ?? 40) * Math.PI / 180;
    gl.uniform3f(u.uLightDir, Math.sin(az) * Math.cos(el) * 0.9, 0.55, Math.max(0.35, Math.sin(el)));
    this.bind(0, this.dye![0].t, u.uDye); this.bind(1, this.grain![0].t, u.uGrain);
    gl.uniform2f(u.uTexel, 1 / this.dyeRes[0], 1 / this.dyeRes[1]); gl.uniform1f(u.uHScale, 0.03 * (P.thickness ?? 1));
    gl.uniform1f(u.uAspect, f.aspect); gl.uniform1f(u.uGloss, P.gloss ?? 1); gl.uniform1f(u.uTime, f.time);
    gl.uniform3fv(u.uCanvasA, lin(look.bgTop)); gl.uniform3fv(u.uCanvasB, lin(look.bgBottom));
    gl.drawArrays(gl.TRIANGLES, 0, 3); gl.bindVertexArray(null);
    this.stats = { sim: `${this.vel![0].w}x${this.vel![0].h} vel, ${this.dyeRes[0]}x${this.dyeRes[1]} paint`, t: +this.t.toFixed(1) };
  }
}
