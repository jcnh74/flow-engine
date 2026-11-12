// Landscape mode: fly a Blender-authored canyon on a camera path,
// lift the terrain with bass, and advect a curl-noise particle cloud with mids/highs.
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

function camAxes(view: number[]): { fwd: Vec3; right: Vec3; up: Vec3 } {
  // View is column-major lookAt; camera axes are the rows of the rotation part
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
  private sim: Prog;
  private particle: Prog;
  private vao: WebGLVertexArrayObject | null = null;
  private vboPos: WebGLBuffer | null = null;
  private vboNrm: WebGLBuffer | null = null;
  private vboCol: WebGLBuffer | null = null;
  private ebo: WebGLBuffer | null = null;
  private indexCount = 0;
  private grid: ParticleGrid | null = null;
  private loading = false;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.sky = compile(gl, LS.LAND_QUAD_VS, LS.LAND_SKY_FS, 'land-sky');
    this.terrain = compile(gl, LS.LAND_TERRAIN_VS, LS.LAND_TERRAIN_FS, 'land-terrain');
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
      this.ready = true;
      this.error = null;
      console.log(`Landscape loaded: ${this.mesh.positions.length / 3} verts, ${this.mesh.indices.length / 3} tris, path ${this.path.sampleCount}`);
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
    this.vboPos = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vboPos);
    gl.bufferData(gl.ARRAY_BUFFER, m.positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    this.vboNrm = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vboNrm);
    gl.bufferData(gl.ARRAY_BUFFER, m.normals, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    this.vboCol = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vboCol);
    gl.bufferData(gl.ARRAY_BUFFER, m.colors, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 0, 0);
    this.ebo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ebo);
    this.indexCount = m.indices.length;
    const maxIdx = this.indexCount ? m.indices.reduce((a, b) => (a > b ? a : b), 0) : 0;
    // Always upload 32-bit indices; WebGL2 supports OES_element_index_uint by default.
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, m.indices, gl.STATIC_DRAW);
    void maxIdx;
    gl.bindVertexArray(null);
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
    const gl = this.gl;
    const pos: [LandFB, LandFB] = [this.makeStateTex(side, side), this.makeStateTex(side, side)];
    const vel: [LandFB, LandFB] = [this.makeStateTex(side, side), this.makeStateTex(side, side)];
    // Shared FBOs with MRT: pos + vel as COLOR0/COLOR1. We bind textures at sim time.
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

  private palStops(palette: [number, number, number][]): [[number, number, number], [number, number, number], [number, number, number]] {
    const n = palette.length;
    if (n === 0) return [[0.15, 0.08, 0.05], [0.7, 0.4, 0.18], [0.95, 0.7, 0.35]];
    const pick = (t: number) => palette[Math.min(n - 1, Math.max(0, Math.round(t * (n - 1))))];
    return [pick(0.1), pick(0.5), pick(0.9)];
  }

  render(opts: LandRenderOpts) {
    if (!this.ready || !this.mesh || !this.path || !this.vao) return;
    const gl = this.gl;
    const P = opts.params;
    const count = P.landParticleCount ?? 65536;
    this.ensureParticles(count);

    const speed = P.landSpeed ?? 0.7;
    const fovDeg = P.landFov ?? this.path.fovDeg ?? 55;
    // Start ~18% into the canyon so the first frame isn't at the mesh edge
    const cam = sampleCameraPath(this.path, opts.time + this.path.durationSec * 0.18, speed);
    // Ride above the trough and aim the look point up so the horizon and sky stay in frame
    cam.position[1] += 2.2;
    cam.target[1] += 3.2;
    const aspect = Math.max(0.1, opts.aspect);
    const view = lookAt(cam.position, cam.target, [0, 1, 0]);
    const proj = perspective((fovDeg * Math.PI) / 180, aspect, 0.15, 220);
    const vp = mul(proj, view);
    const axes = camAxes(view);
    const [p0, p1, p2] = this.palStops(opts.palette);
    const hueTurns = (((P.hueShift ?? 0) / 360) + ((P.cHueCycle ?? 0) / 60) * opts.time);
    const hue = ((hueTurns % 1) + 1) % 1;
    const sat = P.saturation ?? 1.3;
    const fog = P.landFog ?? 0.45;
    const bass = opts.audio.bassEnv;
    const mid = opts.audio.midEnv;
    const high = opts.audio.highEnv;
    const kick = opts.audio.kickEnv;

    // Lighting: warm key from high right, cool fill
    const sunDir: Vec3 = norm([0.55, 0.62, 0.45]);
    const sunCol: Vec3 = [0.95, 0.74, 0.52];
    const fillCol: Vec3 = [0.28, 0.36, 0.52];
    const horizon: Vec3 = [0.48, 0.38, 0.30];
    const zenith: Vec3 = [0.14, 0.20, 0.36];
    const fogCol: Vec3 = [
      opts.background[0] * 0.4 + 0.35,
      opts.background[1] * 0.4 + 0.32,
      opts.background[2] * 0.4 + 0.36,
    ];

    const tanHalf = Math.tan((fovDeg * Math.PI) / 180 / 2);

    if (this.debugFrames < 3) {
      const xform = (p: Vec3) => {
        const x = vp[0]*p[0]+vp[4]*p[1]+vp[8]*p[2]+vp[12];
        const y = vp[1]*p[0]+vp[5]*p[1]+vp[9]*p[2]+vp[13];
        const z = vp[2]*p[0]+vp[6]*p[1]+vp[10]*p[2]+vp[14];
        const w = vp[3]*p[0]+vp[7]*p[1]+vp[11]*p[2]+vp[15];
        return { ndc: w !== 0 ? [+(x/w).toFixed(3), +(y/w).toFixed(3), +(z/w).toFixed(3)] : [x, y, z], w: +w.toFixed(3) };
      };
      const mid: Vec3 = [
        (this.mesh.min[0]+this.mesh.max[0])/2,
        (this.mesh.min[1]+this.mesh.max[1])/2,
        (this.mesh.min[2]+this.mesh.max[2])/2,
      ];
      this.lastDebug = {
        pos: cam.position.map((n: number) => +n.toFixed(3)),
        target: cam.target.map((n: number) => +n.toFixed(3)),
        fovDeg, aspect,
        axes: { fwd: axes.fwd.map((n) => +n.toFixed(3)), right: axes.right.map((n) => +n.toFixed(3)), up: axes.up.map((n) => +n.toFixed(3)) },
        min: this.mesh.min, max: this.mesh.max,
        ndcEyeFwd10: xform(add(cam.position, scl(norm(sub(cam.target, cam.position)), 10))),
        ndcTarget: xform(cam.target),
        ndcMeshMid: xform(mid),
        ndcMin: xform(this.mesh.min),
        ndcMax: xform(this.mesh.max),
        ndcFloorAhead: xform([cam.position[0], this.mesh.min[1], cam.position[2] - 8]),
        indexCount: this.indexCount,
        verts: this.mesh.positions.length/3,
      };
      this.debugFrames++;
    }

    // --- particle sim (offscreen, doesn't touch the scene FBO) ---
    this.stepParticles(opts.dt, opts.time, cam.position, axes, bass, mid, high, kick, speed, P.seed ?? 1977);

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

    // Sky
    gl.useProgram(this.sky.p);
    const su = this.sky.u;
    gl.uniform3f(su.uCamPos, cam.position[0], cam.position[1], cam.position[2]);
    gl.uniform3f(su.uCamFwd, axes.fwd[0], axes.fwd[1], axes.fwd[2]);
    gl.uniform3f(su.uCamRight, axes.right[0], axes.right[1], axes.right[2]);
    gl.uniform3f(su.uCamUp, axes.up[0], axes.up[1], axes.up[2]);
    gl.uniform1f(su.uTanHalfFov, tanHalf);
    gl.uniform1f(su.uAspect, aspect);
    gl.uniform3f(su.uSunDir, sunDir[0], sunDir[1], sunDir[2]);
    gl.uniform3f(su.uSunCol, sunCol[0], sunCol[1], sunCol[2]);
    gl.uniform3f(su.uHorizon, horizon[0], horizon[1], horizon[2]);
    gl.uniform3f(su.uZenith, zenith[0], zenith[1], zenith[2]);
    gl.uniform3f(su.uFogCol, fogCol[0], fogCol[1], fogCol[2]);
    gl.uniform1f(su.uTime, opts.time);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Terrain
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.frontFace(gl.CCW);
    gl.useProgram(this.terrain.p);
    const tu = this.terrain.u;
    gl.uniformMatrix4fv(tu.uVP, false, vp);
    gl.uniformMatrix4fv(tu.uView, false, view);
    gl.uniform1f(tu.uBassLift, P.landBassLift ?? 1.2);
    gl.uniform1f(tu.uBass, bass);
    gl.uniform1f(tu.uKick, kick);
    gl.uniform3f(tu.uEye, cam.position[0], cam.position[1], cam.position[2]);
    gl.uniform3f(tu.uSunDir, sunDir[0], sunDir[1], sunDir[2]);
    gl.uniform3f(tu.uSunCol, sunCol[0], sunCol[1], sunCol[2]);
    gl.uniform3f(tu.uFillCol, fillCol[0], fillCol[1], fillCol[2]);
    gl.uniform3f(tu.uFogCol, fogCol[0], fogCol[1], fogCol[2]);
    gl.uniform1f(tu.uFog, fog);
    gl.uniform1f(tu.uHue, hue);
    gl.uniform1f(tu.uSat, sat);
    gl.uniform3f(tu.uPal0, p0[0], p0[1], p0[2]);
    gl.uniform3f(tu.uPal1, p1[0], p1[1], p1[2]);
    gl.uniform3f(tu.uPal2, p2[0], p2[1], p2[2]);
    gl.uniform1f(tu.uTime, opts.time);
    gl.bindVertexArray(this.vao);
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
    gl.disable(gl.CULL_FACE);

    // Particles (additive, depth-tested, no depth write)
    const g = this.grid!;
    const cur = g.cur;
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
    gl.uniform1f(pu.uSize, P.landParticleSize ?? 2.4);
    gl.uniform1f(pu.uHigh, high);
    gl.uniform1f(pu.uGlow, P.landParticleGlow ?? 1.0);
    gl.uniform2f(pu.uRes, opts.w, opts.h);
    gl.uniform1f(pu.uHue, hue);
    gl.uniform1f(pu.uSat, sat);
    gl.uniform3f(pu.uPal0, p0[0], p0[1], p0[2]);
    gl.uniform3f(pu.uPal1, p1[0], p1[1], p1[2]);
    gl.uniform3f(pu.uPal2, p2[0], p2[1], p2[2]);
    gl.drawArrays(gl.POINTS, 0, g.n);

    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
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
