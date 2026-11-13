// Mirror Mandala: a bilateral (or radial) 3D tendril mask of beaded dotted lines and
// glossy bubble lobes on black, with a slight RGB fringe, a breathing grow, and a
// slow inward zoom. Real sphere lighting, depth, and occlusion — not a flat 2D
// kaleidoscope. Original MIT-licensed work for flow-engine. No Shadertoy code.
import { compile, QUAD_VS, STUDIO_GLSL, MsTarget, setStudioEnv, lookOf, dirFromAzEl, srgbHex, lookAt, perspective, mul, norm, invert,
  fbo, type FB, type PhysFrame, type PhysScene, type Prog, type Vec3 } from './common';

export const MANDALA_PALETTES: Record<string, string[]> = {
  'Poison Garden': ['#b6ff2a', '#3cff6a', '#ff5a7a', '#d4ff4a', '#ff8ab0', '#7cff3a'],
  'Neon Coral': ['#ff4d6d', '#ff9f1c', '#2ec4b6', '#ff6b6b', '#ffe066', '#4cc9f0'],
  'Violet Relic': ['#c77dff', '#7b2cbf', '#ff6bd6', '#4cc9f0', '#e0aaff', '#80ffdb'],
  'Ice Orchid': ['#7ef0ff', '#bde0fe', '#ff7eb6', '#48cae4', '#caf0f8', '#ffc2d1'],
};

const MAX = 28000;

function hash(n: number) { const x = Math.sin(n * 19.19 + 7.13) * 51.7913; return x - Math.floor(x); }

/** Resample a polyline by approximate arc length and emit beads. */
function stroke(dst: number[], pts: Vec3[], radius: number, color: number, spacing: number, zLift: number) {
  if (pts.length < 2) return;
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz) || 1e-6;
    const steps = Math.max(1, Math.round(len / spacing));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const x = a[0] + dx * t, y = a[1] + dy * t, z = a[2] + dz * t + zLift;
      const nx = -dy / len, ny = dx / len;
      // skip the exact centre so the mask keeps a dark void
      if (Math.hypot(x, y) < 0.12) continue;
      if (dst.length / 8 >= MAX) return;
      dst.push(x, y, z, radius * (0.85 + 0.3 * hash(acc + 3.2)), color, nx, ny, 0);
      acc++;
    }
  }
}

function arch(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n: number, z: number): Vec3[] {
  const o: Vec3[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * (i / n);
    o.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, z]);
  }
  return o;
}

function curl(x0: number, y0: number, z0: number, ang: number, len: number, bend: number, n: number): Vec3[] {
  const o: Vec3[] = [];
  let x = x0, y = y0, z = z0, a = ang;
  const ds = len / n;
  for (let i = 0; i <= n; i++) {
    o.push([x, y, z]);
    a += bend;
    x += Math.cos(a) * ds; y += Math.sin(a) * ds; z += 0.015 * Math.sin(i * 0.5);
  }
  return o;
}

/** Original bilateral "guardian" mask: arches, orbital lobes, curling tendrils and bubble clusters. */
function buildMask(density: number, lobes: number, seed: number) {
  const dst: number[] = [];
  const sp = 0.048 / Math.max(0.5, density);
  const zRel = (x: number, y: number) => 0.55 * Math.exp(-(x * x + y * y) * 0.18);
  const lift = (pts: Vec3[]) => pts.map(([x, y, z]) => [x, y, z + zRel(x, y)] as Vec3);

  // nested crown arches
  for (let k = 0; k < 5; k++) {
    const ry = 1.55 + k * 0.16, rx = 1.15 + k * 0.22, cy = 0.15 + k * 0.04;
    stroke(dst, lift(arch(0, cy, rx, ry, 0.15, Math.PI - 0.15, 48, 0)), 0.028 - k * 0.002, k % 3, sp, 0);
  }
  // brow ridge
  stroke(dst, lift(arch(0, 0.85, 1.05, 0.28, 0.2, Math.PI - 0.2, 36, 0)), 0.032, 0, sp * 0.9, 0);

  // two orbital lobes (right half only; mirrored later) — rings + inner bubbles
  const ex = 0.55, ey = 0.22;
  for (let r = 0; r < 3; r++) {
    stroke(dst, lift(arch(ex, ey, 0.34 + r * 0.07, 0.26 + r * 0.05, -0.4, Math.PI + 0.4, 28, 0)), 0.026, 1, sp * 0.8, 0);
  }
  // pupil-adjacent beads
  stroke(dst, lift(arch(ex, ey, 0.16, 0.13, 0, Math.PI * 2, 18, 0.05)), 0.02, 2, sp, 0);

  // cheek curls and jaw
  stroke(dst, lift(curl(0.7, -0.15, 0, -0.6, 1.3, -0.13, 28)), 0.024, 0, sp, 0);
  stroke(dst, lift(curl(0.85, -0.05, 0, -0.9, 1.1, -0.16, 22)), 0.022, 2, sp, 0);
  stroke(dst, lift(curl(0.35, -0.7, 0, -1.6, 0.9, 0.14, 20)), 0.024, 1, sp, 0);
  stroke(dst, lift(arch(0, -0.55, 0.7, 0.4, Math.PI + 0.2, -0.2, 24, 0)), 0.026, 0, sp, 0);

  // descending whisker / beard tendrils
  for (let i = 0; i < 6; i++) {
    const a0 = -0.4 - i * 0.18;
    stroke(dst, lift(curl(0.15 + i * 0.12, -0.85, 0, a0, 1.0 + i * 0.08, 0.09 + i * 0.02, 22)), 0.02, i % 3, sp * 1.05, 0);
  }
  // rising crown tendrils
  for (let i = 0; i < 7; i++) {
    const x = 0.15 + i * 0.18;
    stroke(dst, lift(curl(x, 1.35, 0, 1.1 - i * 0.12, 0.85, 0.11, 20)), 0.021, i % 2, sp, 0);
  }
  // side flares
  for (let i = 0; i < 5; i++) {
    stroke(dst, lift(curl(1.15, 0.4 - i * 0.25, 0, 0.15 - i * 0.2, 0.95, 0.16, 18)), 0.02, 2, sp, 0);
  }

  // bubble lobes: larger spheres clustered at junctions
  const bubbles: Vec3[] = [
    [0.0, 1.55, 0.35], [0.55, 1.35, 0.3], [1.05, 0.7, 0.22], [0.95, -0.2, 0.2],
    [0.55, 0.22, 0.45], [0.0, 0.95, 0.4], [0.35, -0.95, 0.18], [1.25, 0.15, 0.15],
  ];
  const nL = Math.max(0, Math.min(1, lobes));
  for (const [x, y, z] of bubbles) {
    const R = (0.07 + 0.08 * hash(x * 9.1 + seed)) * (0.6 + 1.2 * nL);
    if (dst.length / 8 >= MAX) break;
    dst.push(x, y, z + zRel(x, y), R, 2, 0, 1, 0);
    // satellite dots around the lobe
    const sat = Math.round(8 * density);
    for (let i = 0; i < sat; i++) {
      const a = i / sat * Math.PI * 2 + seed;
      const rr = R * 1.35;
      dst.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8, z + zRel(x, y) + 0.02, 0.018, 1, Math.cos(a), Math.sin(a), 0);
    }
  }
  return new Float32Array(dst);
}

function mirrorAndFold(base: Float32Array, fold: number) {
  // Keep the right half (and the midline), then mirror, then rotate the bilateral mask.
  const bi: number[] = [];
  for (let i = 0; i < base.length; i += 8) {
    const x = base[i], y = base[i + 1], z = base[i + 2], r = base[i + 3], c = base[i + 4], nx = base[i + 5], ny = base[i + 6], nz = base[i + 7];
    if (x < -0.02) continue;
    bi.push(x, y, z, r, c, nx, ny, nz);
    if (x > 0.02) bi.push(-x, y, z, r, c, -nx, ny, nz);
  }
  const angles = fold >= 8 ? [0, Math.PI / 4, Math.PI / 2, 3 * Math.PI / 4] : fold >= 4 ? [0, Math.PI / 2] : [0];
  if (angles.length === 1) return new Float32Array(bi);
  const src: number[] = [];
  for (let i = 0; i < bi.length; i += 8) {
    const x = bi[i], y = bi[i + 1], z = bi[i + 2], r = bi[i + 3], c = bi[i + 4], nx = bi[i + 5], ny = bi[i + 6], nz = bi[i + 7];
    for (const ang of angles) {
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const X = x * ca - y * sa, Y = x * sa + y * ca;
      const NX = nx * ca - ny * sa, NY = nx * sa + ny * ca;
      if (src.length / 8 >= MAX) return new Float32Array(src);
      src.push(X, Y, z, r, c, NX, NY, nz);
    }
  }
  return new Float32Array(src);
}

const VS = `#version 300 es
layout(location=0) in vec2 aCorner;
layout(location=1) in vec4 aPosR;
layout(location=2) in vec4 aCN;
uniform mat4 uVP; uniform vec3 uCamPos, uCamR, uCamU;
uniform float uTime, uBreathe, uGrow;
out vec2 vQ; out vec3 vC; out float vRad; flat out int vCol;
void main(){
  float breathe = 1.0 + 0.05 * uBreathe * sin(uTime * 1.15 + aPosR.x * 1.3 + aPosR.y * 0.9);
  float grow = 0.82 + 0.18 * uGrow * (0.5 + 0.5 * sin(uTime * 0.55));
  vec3 C = aPosR.xyz * grow;
  // tendril wriggle along the stored 2D normal, plus a slow z pulse
  C.x += aCN.y * (0.045 * uBreathe * sin(uTime * 1.7 + aPosR.y * 3.0));
  C.y += aCN.z * (0.045 * uBreathe * sin(uTime * 1.5 + aPosR.x * 3.0));
  C.z += 0.06 * uBreathe * sin(uTime * 1.3 + length(aPosR.xy) * 2.0);
  float rad = aPosR.w * breathe;
  vC = C; vRad = rad; vCol = int(aCN.x + 0.5); vQ = aCorner;
  vec3 w = C + (uCamR * aCorner.x + uCamU * aCorner.y) * rad * 1.6;
  gl_Position = uVP * vec4(w, 1.0);
}`;

const FS = `#version 300 es
precision highp float;
in vec2 vQ; in vec3 vC; in float vRad; flat in int vCol; out vec4 o;
uniform mat4 uVP; uniform vec3 uCamPos; uniform vec3 uPal[6]; uniform float uGloss, uIrid;
${STUDIO_GLSL}
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
  float rough = clamp(0.14 / max(uGloss, 0.2), 0.05, 0.45);
  vec3 f0 = mix(vec3(0.06), alb, 0.22 + 0.35 * uIrid);
  float ao = 0.55 + 0.45 * N.z;
  vec3 col = studioShade(vC, NW, V, alb, rough, f0, ao, 1.0, 0.55);
  col += alb * 0.15 * pow(max(N.z, 0.0), 4.0);
  if (uIrid > 0.01) col += thinFilm(max(dot(NW, V), 0.0)) * uIrid * 0.2;
  vec3 H = vC + NW * vRad;
  vec4 clip = uVP * vec4(H, 1.0);
  gl_FragDepth = clip.z / clip.w * 0.5 + 0.5;
  o = vec4(col, length(uCamPos - H));
}`;

const BACK_FS = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o;
uniform mat4 uInvVP; uniform vec3 uCamPos; uniform vec3 uGlow;
void main(){
  vec4 a = uInvVP * vec4(vUv*2.0-1.0, 1.0, 1.0);
  vec3 rd = normalize(a.xyz/a.w - uCamPos);
  float core = pow(max(dot(rd, normalize(-uCamPos + vec3(0.0, 0.1, 0.0))), 0.0), 40.0);
  vec3 col = uGlow * core * 0.25;
  o = vec4(col, 1000.0);
}`;

const FRINGE_FS = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o;
uniform sampler2D uTex; uniform float uFringe; uniform vec2 uRes;
void main(){
  vec2 px = 1.0 / uRes;
  vec4 c = texture(uTex, vUv);
  if (uFringe < 0.001) { o = c; return; }
  // edge-weighted RGB fringe (a slight prism at contrast boundaries)
  float l = dot(c.rgb, vec3(0.3, 0.59, 0.11));
  float e = abs(l - dot(texture(uTex, vUv + vec2(px.x*2.0, 0.0)).rgb, vec3(0.3, 0.59, 0.11)));
  float w = uFringe * (0.35 + 1.8 * e);
  float r = texture(uTex, vUv + vec2(w * px.x, 0.0)).r;
  float g = c.g;
  float b = texture(uTex, vUv - vec2(w * px.x, 0.0)).b;
  o = vec4(r, g, b, c.a);
}`;

export class MandalaScene implements PhysScene {
  name = 'Mirror Mandala'; ready = true; error: string | null = null; stats: Record<string, any> = {};
  private p: Prog; private back: Prog; private fringe: Prog;
  private vao: WebGLVertexArrayObject; private inst: WebGLBuffer;
  private ms: MsTarget; private fringeFb: FB | null = null; private t = 0;
  private base: Float32Array = new Float32Array(0);
  private folded: Float32Array = new Float32Array(0);
  private lastKey = '';
  private nInst = 0;
  constructor(private gl: WebGL2RenderingContext) {
    // unit quad
    const quad = new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]);
    this.vao = gl.createVertexArray()!; gl.bindVertexArray(this.vao);
    const qb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, qb); gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.inst = gl.createBuffer()!; gl.bindBuffer(gl.ARRAY_BUFFER, this.inst);
    gl.bufferData(gl.ARRAY_BUFFER, MAX * 8 * 4, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 0); gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 16); gl.vertexAttribDivisor(2, 1);
    gl.bindVertexArray(null);
    this.p = compile(gl, VS, FS, 'mandala');
    this.back = compile(gl, QUAD_VS, BACK_FS, 'mandala-back');
    this.fringe = compile(gl, QUAD_VS, FRINGE_FS, 'mandala-fringe');
    this.ms = new MsTarget(gl, 4);
  }
  load() { this.ready = true; }
  private rebuild(P: Record<string, any>) {
    const density = P.mmDensity ?? 1;
    const lobes = P.mmLobes ?? 1;
    const sym = P.mmSym ?? 'Bilateral';
    const fold = sym === '8-fold' ? 8 : sym === '4-fold' ? 4 : 2;
    const key = `${density}|${lobes}|${fold}`;
    if (key === this.lastKey && this.folded.length) return;
    this.lastKey = key;
    this.base = buildMask(density, lobes, 7.3);
    this.folded = mirrorAndFold(this.base, fold);
    this.nInst = Math.min(MAX, Math.floor(this.folded.length / 8));
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.inst);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.folded.subarray(0, this.nInst * 8));
  }
  render(f: PhysFrame) {
    const gl = this.gl; const P = f.params as Record<string, any>;
    if (!P.paused) this.t += Math.min(0.1, f.dt) * (P.speed ?? 1);
    this.rebuild(P);
    const t = this.t;
    // wrap zoom softly: ping-pong the dolly so the inward zoom loops
    const zCycle = 0.7 + 0.7 * Math.sin(t * 0.12 * (P.mmZoom ?? 1));
    const dist = 4.6 - zCycle * 0.9;
    const eye: Vec3 = [Math.sin(t * 0.05) * 0.15, 0.08, dist];
    const tgt: Vec3 = [0, 0.05, 0];
    const view = lookAt(eye, tgt); const proj = perspective((P.fov ?? 42) * Math.PI / 180, f.aspect, 0.12, 30); const vp = mul(proj, view);
    const fwd = norm([tgt[0] - eye[0], tgt[1] - eye[1], tgt[2] - eye[2]]);
    const right = norm([fwd[2], 0, -fwd[0]]);
    const up: Vec3 = [right[1] * fwd[2] - right[2] * fwd[1], right[2] * fwd[0] - right[0] * fwd[2], right[0] * fwd[1] - right[1] * fwd[0]];
    const Ld = dirFromAzEl(P.keyAz ?? -20, P.keyEl ?? 48);
    const look = lookOf(P.look ?? 'Cobalt Orange');
    const env = { look, L: Ld, F: dirFromAzEl((P.keyAz ?? -20) + 130, 20), fwd };
    const pal = MANDALA_PALETTES[P.mmPalette] ?? MANDALA_PALETTES['Poison Garden'];
    this.ms.ensure(f.w, f.h); this.ms.begin(1000);
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
    gl.useProgram(this.back.p); gl.uniformMatrix4fv(this.back.u.uInvVP, false, invert(vp));
    gl.uniform3fv(this.back.u.uCamPos, eye); gl.uniform3fv(this.back.u.uGlow, srgbHex(pal[0]));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.depthFunc(gl.LESS);
    gl.disable(gl.CULL_FACE);
    const u = this.p.u; gl.useProgram(this.p.p);
    // setStudioEnv needs the PROGRAM's uniforms — studioShade uses uLightDir etc.
    setStudioEnv(gl, u, env);
    gl.uniformMatrix4fv(u.uVP, false, vp);
    gl.uniform3fv(u.uCamPos, eye); gl.uniform3fv(u.uCamR, right); gl.uniform3fv(u.uCamU, up);
    gl.uniform1f(u.uTime, t); gl.uniform1f(u.uBreathe, P.mmBreathe ?? 1); gl.uniform1f(u.uGrow, P.mmGrow ?? 1);
    gl.uniform3fv(u.uLightDir, Ld); gl.uniform1f(u.uGloss, P.gloss ?? 1.15); gl.uniform1f(u.uIrid, P.irid ?? 0.4);
    const pa = new Float32Array(18); pal.slice(0, 6).forEach((h, i) => pa.set(srgbHex(h), i * 3));
    gl.uniform3fv(u.uPal, pa);
    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.nInst);
    gl.bindVertexArray(null); gl.disable(gl.DEPTH_TEST);
    const tex = this.ms.resolve();
    if (!this.fringeFb || this.fringeFb.w !== f.w || this.fringeFb.h !== f.h) this.fringeFb = fbo(gl, f.w, f.h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fringeFb.f); gl.viewport(0, 0, f.w, f.h);
    gl.useProgram(this.fringe.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(this.fringe.u.uTex, 0);
    gl.uniform1f(this.fringe.u.uFringe, (P.mmFringe ?? 1) * 1.8); gl.uniform2f(this.fringe.u.uRes, f.w, f.h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    f.dof(this.fringeFb.t, f.target, f.w, f.h, dist * 0.85, P.dof ?? 0.12);
    this.stats = { ready: true, beads: this.nInst, fold: P.mmSym ?? 'Bilateral' };
  }
}

