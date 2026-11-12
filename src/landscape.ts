// Landscape mode (pass 2): a Blender-sculpted pigment relief rendered in a
// Cinema 4D-style ambient-occlusion studio look: Cycles-baked AO in the vertex
// colors, a soft key light with real (PCF) shadow-mapped shadows, an AO-weighted
// sky dome, rim light, flowing OKLab pigment and a gradient studio backdrop.
// The pass-1 curl-noise particle cloud is kept but off by default.
// Original MIT-licensed work. No Shadertoy code.

import { parseGlb, parseCameraPath, sampleCameraPath, type GlbMesh, type CameraPath, type Vec3 } from './gltf';
import * as LS from './landscape_shaders';

export type LandFB = { t: WebGLTexture; f: WebGLFramebuffer; w: number; h: number };

export type LandAudio = {
  bassEnv: number;
  midEnv: number;
  highEnv: number;
  kickEnv: number;
};

export type LandRenderOpts = {
  target: WebGLFramebuffer;
  depth: WebGLRenderbuffer;
  w: number;
  h: number;
  aspect: number;
  time: number;
  dt: number;
  audio: LandAudio;
  params: Record<string, any>;
  palette: [number, number, number][]; // linear RGB stops
  background: [number, number, number];
};

/** Lighting + backdrop looks (linear RGB). Pigment colors come from the palette stops. */
export type LandLook = {
  bgTop: Vec3; bgBottom: Vec3; bgGlow: Vec3;
  key: Vec3; sky: Vec3; ground: Vec3; rim: Vec3;
  ambient: number;
};

export const LAND_LOOKS: Record<string, LandLook> = {
  // C4D AO studio: a bright, near-white dome does most of the work (AO carves the folds), a soft key adds shape
  'Living Pigment': {
    bgTop: [0.030, 0.034, 0.040], bgBottom: [0.004, 0.005, 0.007], bgGlow: [0.045, 0.050, 0.055],
    key: [1.05, 0.98, 0.88], sky: [0.95, 1.00, 1.08], ground: [0.40, 0.36, 0.32], rim: [0.35, 0.50, 0.75], ambient: 0.8,
  },
  'Ember Bloom': {
    bgTop: [0.040, 0.020, 0.016], bgBottom: [0.006, 0.003, 0.003], bgGlow: [0.075, 0.032, 0.022],
    key: [1.10, 0.95, 0.78], sky: [1.00, 0.95, 0.95], ground: [0.45, 0.32, 0.26], rim: [0.80, 0.42, 0.30], ambient: 0.8,
  },
  'Glacier Night': {
    bgTop: [0.012, 0.022, 0.048], bgBottom: [0.002, 0.004, 0.010], bgGlow: [0.025, 0.050, 0.095],
    key: [0.85, 0.95, 1.10], sky: [0.80, 0.90, 1.10], ground: [0.25, 0.28, 0.36], rim: [0.45, 0.70, 1.00], ambient: 0.8,
  },
  'Neon Pigment': {
    bgTop: [0.028, 0.012, 0.048], bgBottom: [0.004, 0.002, 0.008], bgGlow: [0.060, 0.020, 0.080],
    key: [1.00, 0.95, 1.05], sky: [0.95, 0.92, 1.08], ground: [0.38, 0.28, 0.40], rim: [0.85, 0.35, 0.80], ambient: 0.8,
  },
  // Pass 3 studio palettes: light pastel / cobalt cove instead of a dark void (pigment comes from the preset stops)
  'Studio Pastel': {
    bgTop: [0.92, 0.62, 0.50], bgBottom: [0.80, 0.42, 0.34], bgGlow: [0.25, 0.18, 0.15],
    key: [1.05, 0.98, 0.92], sky: [1.00, 0.92, 0.90], ground: [0.70, 0.50, 0.45], rim: [1.0, 0.85, 0.80], ambient: 0.9,
  },
  'Studio Cobalt': {
    bgTop: [0.040, 0.095, 0.69], bgBottom: [0.012, 0.035, 0.29], bgGlow: [0.03, 0.06, 0.25],
    key: [1.10, 0.98, 0.85], sky: [0.70, 0.78, 1.05], ground: [0.20, 0.25, 0.50], rim: [1.0, 0.65, 0.35], ambient: 0.85,
  },
};
export const LAND_LOOK_NAMES = Object.keys(LAND_LOOKS);

type Prog = { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null> };

function compile(gl: WebGL2RenderingContext, vs: string, fs: string, name: string): Prog {
  const prog = gl.createProgram()!;
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]] as const) {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh);
      throw new Error(`${name} ${type === gl.VERTEX_SHADER ? 'VS' : 'FS'}: ${log}`);
    }
    gl.attachShader(prog, sh);
  }
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`${name} link: ${gl.getProgramInfoLog(prog)}`);
  }
  const u: Record<string, WebGLUniformLocation | null> = {};
  const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const a = gl.getActiveUniform(prog, i)!;
    u[a.name] = gl.getUniformLocation(prog, a.name);
    if (a.name.endsWith('[0]')) u[a.name.slice(0, -3)] = u[a.name];
  }
  return { p: prog, u };
}

function mul(a: number[], b: number[]): number[] {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}
function sub(a: Vec3, b: Vec3): Vec3 { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function add(a: Vec3, b: Vec3): Vec3 { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function scl(a: Vec3, s: number): Vec3 { return [a[0] * s, a[1] * s, a[2] * s]; }
function dot(a: Vec3, b: Vec3): number { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function norm(a: Vec3): Vec3 { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }

function lookAt(e: Vec3, t: Vec3, up: Vec3): number[] {
  const z = norm(sub(e, t)), x = norm(cross(up, z)), y = cross(z, x);
  return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1];
}

function perspective(fovyRad: number, aspect: number, near: number, far: number): number[] {
  const f = 1 / Math.tan(fovyRad / 2);
  return [
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) / (near - far), -1,
    0, 0, (2 * far * near) / (near - far), 0,
  ];
}

function ortho(l: number, r: number, b: number, t: number, n: number, f: number): number[] {
  return [2 / (r - l), 0, 0, 0, 0, 2 / (t - b), 0, 0, 0, 0, -2 / (f - n), 0, -(r + l) / (r - l), -(t + b) / (t - b), -(f + n) / (f - n), 1];
}

function xform(m: number[], p: Vec3): Vec3 {
  return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
}

function camAxes(view: number[]): { fwd: Vec3; right: Vec3; up: Vec3 } {
  return {
    right: [view[0], view[4], view[8]],
    up: [view[1], view[5], view[9]],
    fwd: [-view[2], -view[6], -view[10]],
  };
}

type ParticleGrid = {
  w: number;
  n: number;
  pos: [LandFB, LandFB];
  vel: [LandFB, LandFB];
  cur: number;
  init: boolean;
};

const SHADOW_RES = 2048;

export class LandscapeRenderer {
  ready = false;
  error: string | null = null;
  mesh: GlbMesh | null = null;
  path: CameraPath | null = null;
  lastDebug: any = null;
  private debugFrames = 0;

  private gl: WebGL2RenderingContext;
  private sky: Prog;
  private terrain: Prog;
  private shadowProg: Prog;
  private sim: Prog;
  private particle: Prog;
  private vao: WebGLVertexArrayObject | null = null;
  private indexCount = 0;
  private grid: ParticleGrid | null = null;
  private loading = false;
  private shadowTex: WebGLTexture | null = null;
  private shadowFB: WebGLFramebuffer | null = null;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.sky = compile(gl, LS.LAND_QUAD_VS, LS.LAND_SKY_FS, 'land-sky');
    this.terrain = compile(gl, LS.LAND_TERRAIN_VS, LS.LAND_TERRAIN_FS, 'land-terrain');
    this.shadowProg = compile(gl, LS.LAND_TERRAIN_VS, LS.LAND_SHADOW_FS, 'land-shadow');
    this.sim = compile(gl, LS.LAND_QUAD_VS, LS.LAND_SIM_FS, 'land-sim');
    this.particle = compile(gl, LS.LAND_PARTICLE_VS, LS.LAND_PARTICLE_FS, 'land-part');
  }

  async load(base = '/landscape'): Promise<void> {
    if (this.loading || this.ready) return;
    this.loading = true;
    try {
      const [glbBuf, pathJson] = await Promise.all([
        fetch(`${base}/terrain.glb`).then((r) => {
          if (!r.ok) throw new Error(`terrain.glb HTTP ${r.status}`);
          return r.arrayBuffer();
        }),
        fetch(`${base}/camera-path.json`).then((r) => {
          if (!r.ok) throw new Error(`camera-path.json HTTP ${r.status}`);
          return r.json();
        }),
      ]);
      this.mesh = parseGlb(glbBuf);
      this.path = parseCameraPath(pathJson);
      this.uploadMesh();
      this.ensureShadow();
      this.ready = true;
      this.error = null;
      console.log(`Landscape loaded: ${this.mesh.positions.length / 3} verts, ${this.mesh.indices.length / 3} tris, path ${this.path.sampleCount}${this.path.loop ? ' (loop)' : ''}`);
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
      console.error('Landscape load failed:', this.error);
      this.ready = false;
    } finally {
      this.loading = false;
    }
  }

  private uploadMesh() {
    const gl = this.gl;
    const m = this.mesh!;
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    const buf = (data: Float32Array, loc: number, size: number) => {
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    };
    buf(m.positions, 0, 3);
    buf(m.normals, 1, 3);
    buf(m.colors, 2, 4);
    const ebo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
    this.indexCount = m.indices.length;
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, m.indices, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
  }

  private ensureShadow() {
    if (this.shadowTex) return;
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, SHADOW_RES, SHADOW_RES);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    const f = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, t, 0);
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.shadowTex = t;
    this.shadowFB = f;
  }

  private makeStateTex(w: number, h: number): LandFB {
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const f = gl.createFramebuffer()!;
    return { t, f, w, h };
  }

  private ensureParticles(count: number) {
    const side = Math.max(8, Math.min(512, Math.ceil(Math.sqrt(Math.max(1024, count)))));
    if (this.grid && this.grid.w === side) return;
    this.freeParticles();
    const pos: [LandFB, LandFB] = [this.makeStateTex(side, side), this.makeStateTex(side, side)];
    const vel: [LandFB, LandFB] = [this.makeStateTex(side, side), this.makeStateTex(side, side)];
    this.grid = { w: side, n: side * side, pos, vel, cur: 0, init: true };
  }

  private freeParticles() {
    if (!this.grid) return;
    const gl = this.gl;
    for (const fb of [...this.grid.pos, ...this.grid.vel]) {
      gl.deleteTexture(fb.t);
      gl.deleteFramebuffer(fb.f);
    }
    this.grid = null;
  }

  /** Up to 6 stops, evenly resampled from the palette (linear RGB). */
  private palStops(palette: [number, number, number][]): [number, number, number][] {
    const n = palette.length;
    if (n === 0) return [[0.01, 0.02, 0.03], [0.02, 0.18, 0.26], [0.05, 0.52, 0.6], [0.9, 0.56, 0.12], [0.95, 0.88, 0.72]];
    if (n === 1) return [palette[0], palette[0]];
    if (n <= 6) return palette.slice();
    const out: [number, number, number][] = [];
    for (let i = 0; i < 6; i++) out.push(palette[Math.round((i / 5) * (n - 1))]);
    return out;
  }

  render(opts: LandRenderOpts) {
    if (!this.ready || !this.mesh || !this.path || !this.vao) return;
    const gl = this.gl;
    const P = opts.params;
    const look = LAND_LOOKS[P.landLook as string] ?? LAND_LOOKS['Living Pigment'];

    const speed = P.landSpeed ?? 1.0;
    const fovDeg = P.landFov ?? this.path.fovDeg ?? 50;
    const cam = sampleCameraPath(this.path, opts.time + (P.landStart ?? 0.2) * this.path.durationSec / Math.max(0.05, speed), speed);
    const aspect = Math.max(0.1, opts.aspect);
    const view = lookAt(cam.position, cam.target, [0, 1, 0]);
    const proj = perspective((fovDeg * Math.PI) / 180, aspect, 0.5, 600);
    const vp = mul(proj, view);
    const axes = camAxes(view);
    const pal = this.palStops(opts.palette);
    const hueTurns = (((P.hueShift ?? 0) / 360) + ((P.cHueCycle ?? 0) / 60) * opts.time);
    const hue = ((hueTurns % 1) + 1) % 1;
    const sat = P.saturation ?? 1.2;
    const bass = opts.audio.bassEnv;
    const mid = opts.audio.midEnv;
    const high = opts.audio.highEnv;
    const kick = opts.audio.kickEnv;

    // Key light: camera-relative studio key (upper-left, slightly in front), like a C4D softbox
    const fwdFlat = norm([axes.fwd[0], 0, axes.fwd[2]]);
    const rightFlat = norm([axes.right[0], 0, axes.right[2]]);
    const el = ((P.landSunEl ?? 38) * Math.PI) / 180;
    const az = ((P.landSunAz ?? -40) * Math.PI) / 180;
    const horiz = add(scl(fwdFlat, -Math.cos(az)), scl(rightFlat, Math.sin(az)));
    const keyDir = norm(add(scl(horiz, Math.cos(el)), [0, Math.sin(el), 0]));

    // --- shadow map: ortho fit around the whole relief ---
    const mn = this.mesh.min, mx = this.mesh.max;
    const center: Vec3 = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
    const lightView = lookAt(add(center, scl(keyDir, 300)), center, Math.abs(keyDir[1]) > 0.98 ? [0, 0, 1] : [0, 1, 0]);
    let lx0 = Infinity, lx1 = -Infinity, ly0 = Infinity, ly1 = -Infinity, lz0 = Infinity, lz1 = -Infinity;
    for (let i = 0; i < 8; i++) {
      const c: Vec3 = [i & 1 ? mx[0] : mn[0], i & 2 ? mx[1] + 6 : mn[1], i & 4 ? mx[2] : mn[2]];
      const q = xform(lightView, c);
      lx0 = Math.min(lx0, q[0]); lx1 = Math.max(lx1, q[0]);
      ly0 = Math.min(ly0, q[1]); ly1 = Math.max(ly1, q[1]);
      lz0 = Math.min(lz0, q[2]); lz1 = Math.max(lz1, q[2]);
    }
    const lightVP = mul(ortho(lx0, lx1, ly0, ly1, -lz1 - 5, -lz0 + 5), lightView);
    const shadowTexel = 1 / SHADOW_RES;

    const bassLift = P.landBassLift ?? 1.2;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFB);
    gl.viewport(0, 0, SHADOW_RES, SHADOW_RES);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.depthMask(true);
    gl.clearDepth(1);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1.5, 3.0);
    gl.useProgram(this.shadowProg.p);
    const shu = this.shadowProg.u;
    gl.uniformMatrix4fv(shu.uVP, false, lightVP);
    gl.uniformMatrix4fv(shu.uLightVP, false, lightVP);
    gl.uniform1f(shu.uBassLift, bassLift);
    gl.uniform1f(shu.uBass, bass);
    gl.uniform1f(shu.uKick, kick);
    gl.bindVertexArray(this.vao);
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
    gl.disable(gl.POLYGON_OFFSET_FILL);

    if (this.debugFrames < 3) {
      this.lastDebug = {
        pos: cam.position.map((n: number) => +n.toFixed(3)),
        target: cam.target.map((n: number) => +n.toFixed(3)),
        keyDir: keyDir.map((n) => +n.toFixed(3)),
        fovDeg, aspect, min: mn, max: mx, indexCount: this.indexCount, verts: this.mesh.positions.length / 3,
        loop: this.path.loop,
      };
      this.debugFrames++;
    }

    const particlesOn = !!P.landParticles && (P.landParticleCount ?? 0) > 0;
    if (particlesOn) {
      this.ensureParticles(P.landParticleCount);
      this.stepParticles(opts.dt, opts.time, cam.position, axes, bass, mid, high, kick, speed, P.seed ?? 1977);
    }

    // --- scene ---
    gl.bindFramebuffer(gl.FRAMEBUFFER, opts.target);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, opts.depth);
    gl.viewport(0, 0, opts.w, opts.h);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.clearColor(0, 0, 0, 1);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const setBackdrop = (u: Record<string, WebGLUniformLocation | null>) => {
      gl.uniform3f(u.uBgTop, look.bgTop[0], look.bgTop[1], look.bgTop[2]);
      gl.uniform3f(u.uBgBottom, look.bgBottom[0], look.bgBottom[1], look.bgBottom[2]);
      gl.uniform3f(u.uBgGlow, look.bgGlow[0], look.bgGlow[1], look.bgGlow[2]);
      gl.uniform2f(u.uRes, opts.w, opts.h);
    };

    // Studio backdrop
    gl.useProgram(this.sky.p);
    setBackdrop(this.sky.u);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Relief
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.useProgram(this.terrain.p);
    const tu = this.terrain.u;
    setBackdrop(tu);
    gl.uniformMatrix4fv(tu.uVP, false, vp);
    gl.uniformMatrix4fv(tu.uLightVP, false, lightVP);
    gl.uniform1f(tu.uBassLift, bassLift);
    gl.uniform1f(tu.uBass, bass);
    gl.uniform1f(tu.uKick, kick);
    gl.uniform3f(tu.uEye, cam.position[0], cam.position[1], cam.position[2]);
    gl.uniform3f(tu.uKeyDir, keyDir[0], keyDir[1], keyDir[2]);
    const ki = P.landKey ?? 1.0;
    gl.uniform3f(tu.uKeyCol, look.key[0] * ki, look.key[1] * ki, look.key[2] * ki);
    gl.uniform3f(tu.uSkyCol, look.sky[0], look.sky[1], look.sky[2]);
    gl.uniform3f(tu.uGroundCol, look.ground[0], look.ground[1], look.ground[2]);
    gl.uniform3f(tu.uRimCol, look.rim[0], look.rim[1], look.rim[2]);
    gl.uniform1f(tu.uAmbient, look.ambient * (P.landAmbient ?? 1.0));
    gl.uniform1f(tu.uAOPow, P.landAO ?? 1.6);
    gl.uniform1f(tu.uFog, P.landFog ?? 0.5);
    gl.uniform1f(tu.uFogNear, 40);
    gl.uniform1f(tu.uTime, opts.time);
    gl.uniform1f(tu.uFlow, P.landFlow ?? 1.0);
    gl.uniform1f(tu.uPigment, P.landPigment ?? 1.0);
    gl.uniform1f(tu.uGrain, P.landGrain ?? 0.35);
    gl.uniform1f(tu.uBands, P.landBands ?? 4.0);
    gl.uniform1f(tu.uHue, hue);
    gl.uniform1f(tu.uSat, sat);
    const palFlat = new Float32Array(18);
    pal.slice(0, 6).forEach((c, i) => palFlat.set(c, i * 3));
    gl.uniform3fv(tu.uPal, palFlat);
    gl.uniform1i(tu.uPalN, Math.min(6, Math.max(2, pal.length)));
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.uniform1i(tu.uShadow, 0);
    gl.uniform1f(tu.uShadowTexel, shadowTexel);
    gl.uniform1f(tu.uShadowSoft, P.landShadowSoft ?? 2.5);
    gl.bindVertexArray(this.vao);
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);

    if (particlesOn) {
      const g = this.grid!;
      const cur = g.cur;
      const p0 = pal[1] ?? pal[0], p1 = pal[Math.floor(pal.length / 2)], p2 = pal[pal.length - 1];
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.depthMask(false);
      gl.useProgram(this.particle.p);
      const pu = this.particle.u;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, g.pos[cur].t);
      gl.uniform1i(pu.uPos, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, g.vel[cur].t);
      gl.uniform1i(pu.uVel, 1);
      gl.uniform1i(pu.uTexW, g.w);
      gl.uniformMatrix4fv(pu.uVP, false, vp);
      gl.uniformMatrix4fv(pu.uView, false, view);
      gl.uniform1f(pu.uSize, P.landParticleSize ?? 1.6);
      gl.uniform1f(pu.uHigh, high);
      gl.uniform1f(pu.uGlow, P.landParticleGlow ?? 0.75);
      gl.uniform2f(pu.uRes, opts.w, opts.h);
      gl.uniform1f(pu.uHue, hue);
      gl.uniform1f(pu.uSat, sat);
      gl.uniform3f(pu.uPal0, p0[0], p0[1], p0[2]);
      gl.uniform3f(pu.uPal1, p1[0], p1[1], p1[2]);
      gl.uniform3f(pu.uPal2, p2[0], p2[1], p2[2]);
      gl.drawArrays(gl.POINTS, 0, g.n);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, null);
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.disable(gl.DEPTH_TEST);
  }

  private stepParticles(dt: number, time: number, camPos: Vec3, axes: { fwd: Vec3; right: Vec3; up: Vec3 }, bass: number, mid: number, high: number, kick: number, speed: number, seed: number) {
    const gl = this.gl;
    const g = this.grid!;
    const src = g.cur;
    const dst = 1 - src;
    const fbo = g.pos[dst].f;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, g.pos[dst].t, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, g.vel[dst].t, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    gl.viewport(0, 0, g.w, g.w);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(this.sim.p);
    const u = this.sim.u;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, g.pos[src].t);
    gl.uniform1i(u.uPos, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, g.vel[src].t);
    gl.uniform1i(u.uVel, 1);
    gl.uniform1i(u.uInit, g.init ? 1 : 0);
    gl.uniform1i(u.uTexW, g.w);
    gl.uniform1f(u.uDt, Math.min(0.05, Math.max(0.001, dt)));
    gl.uniform1f(u.uTime, time);
    gl.uniform3f(u.uCamPos, camPos[0], camPos[1], camPos[2]);
    gl.uniform3f(u.uCamFwd, axes.fwd[0], axes.fwd[1], axes.fwd[2]);
    gl.uniform3f(u.uCamRight, axes.right[0], axes.right[1], axes.right[2]);
    gl.uniform3f(u.uCamUp, axes.up[0], axes.up[1], axes.up[2]);
    const bmin = this.mesh!.min, bmax = this.mesh!.max;
    gl.uniform3f(u.uBoundsMin, bmin[0], bmin[1], bmin[2]);
    gl.uniform3f(u.uBoundsMax, bmax[0], bmax[1], bmax[2]);
    gl.uniform1f(u.uBass, bass);
    gl.uniform1f(u.uMid, mid);
    gl.uniform1f(u.uHigh, high);
    gl.uniform1f(u.uKick, kick);
    gl.uniform1f(u.uSpeed, speed);
    gl.uniform1ui(u.uSeed, seed >>> 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, null, 0);
    g.cur = dst;
    g.init = false;
  }
}
