// Feather Vortex: a dense 3D swirl of fur / feather blades in orange, red, teal and
// deep blue, plunging into a dark centre, with real anisotropic shading, depth
// occlusion and a decaying feedback trail. Original MIT-licensed work for
// flow-engine. Anisotropic sheen follows Kajiya and Kay, SIGGRAPH 1989. No Shadertoy code.
import { compile, QUAD_VS, STUDIO_GLSL, MsTarget, setStudioEnv, lookOf, dirFromAzEl, srgbHex, lookAt, perspective, mul, norm, invert, fbo,
  type FB, type PhysFrame, type PhysScene, type Prog, type Vec3 } from './common';

export const FEATHER_PALETTES: Record<string, { warm: string[]; cool: string[] }> = {
  'Ember Tide': { warm: ['#ff4b1f', '#ff7a18', '#ffb347'], cool: ['#00c2c7', '#0077b6', '#023e8a'] },
  'Solar Flare': { warm: ['#ff3d00', '#ff9100', '#ffc107'], cool: ['#1de9b6', '#00acc1', '#1565c0'] },
  'Magenta Deep': { warm: ['#ff1744', '#f50057', '#ff80ab'], cool: ['#7c4dff', '#304ffe', '#1a237e'] },
  'Jade Fire': { warm: ['#ff6d00', '#ffab00', '#ff8a65'], cool: ['#00e676', '#00bfa5', '#00695c'] },
};

const MAXB = 9000;

function bladeMesh() {
  // a slightly cambered, tapered feather vane in the XY plane, length along +Y, thin in Z
  const pos: number[] = [], nrm: number[] = [], uv: number[] = [], idx: number[] = [];
  const segs = 9;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const y = t * 2.0 - 0.15;
    const w = (0.18 + 0.62 * Math.sin(t * Math.PI)) * (1.0 - t * 0.55);
    const camber = 0.12 * Math.sin(t * Math.PI);
    // two edges
    pos.push(-w, y, camber,  w, y, camber);
    nrm.push(0, 0, 1, 0, 0, 1);
    uv.push(0, t, 1, t);
  }
  for (let i = 0; i < segs; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    idx.push(a, c, b, b, c, d);
  }
  return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), uv: new Float32Array(uv), idx: new Uint16Array(idx) };
}

const VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm; layout(location=2) in vec2 aUv;
uniform mat4 uVP; uniform float uTime, uSpin, uMelt, uInward, uBlade, uCore;
uniform int uCount;
out vec3 vW; out vec3 vN; out vec3 vT; out vec2 vUv; flat out float vWarm;
float h1(float n){ return fract(sin(n * 19.19 + 7.13) * 51.7913); }
void main(){
  int i = gl_InstanceID;
  if (i >= uCount) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float fi = float(i);
  float h = h1(fi + 3.1), h2 = h1(fi + 8.7), h3 = h1(fi + 14.2), h4 = h1(fi + 21.5);
  // layers in radius and depth: a hollow vortex, denser toward the rim
  float r = mix(0.35, 3.6, pow(h, 0.55));
  float z = mix(-3.8, 3.2, h2);
  float a0 = h3 * 6.2831853;
  // inward spiral + spin (faster near the core)
  float spin = uSpin * (0.55 + 0.9 / (0.35 + r));
  float a = a0 + uTime * spin + uInward * 0.35 * z;
  // melting undulation
  float melt = uMelt * (0.18 * sin(3.0 * a + r * 2.2 + uTime * 1.4) + 0.10 * sin(5.0 * r - uTime * 0.9 + a));
  a += melt;
  r += uMelt * 0.22 * sin(2.0 * a + uTime * 0.7);
  z += uInward * 0.15 * sin(a * 2.0 + uTime * 0.5);
  vec3 C = vec3(cos(a) * r, sin(a) * r, z);
  // blade frame: tangent to the swirl, pitched slightly inward, plus a roll
  vec3 T = normalize(vec3(-sin(a), cos(a), 0.35 * uSpin));
  vec3 In = normalize(vec3(-C.x, -C.y, 0.0));
  vec3 B = normalize(cross(T, In));
  In = cross(B, T);
  float roll = 0.4 * sin(a * 2.0 + uTime * 1.1 + h4 * 6.283);
  vec3 Bp = B * cos(roll) + In * sin(roll);
  vec3 Np = In * cos(roll) - B * sin(roll);
  float len = (0.55 + 0.75 * h4) * uBlade;
  float wid = (0.22 + 0.35 * h2) * uBlade;
  vec3 lp = aPos;
  vW = C + T * (lp.y * len) + Bp * (lp.x * wid) + Np * (lp.z * wid * 0.8);
  vN = normalize(T * aNrm.y + Bp * aNrm.x + Np * aNrm.z);
  vT = T; vUv = aUv;
  // warm vs cool by angle, with a soft seam
  vWarm = smoothstep(-0.25, 0.25, sin(a + 0.4));
  gl_Position = uVP * vec4(vW, 1.0);
}`;

const FS = `#version 300 es
precision highp float;
in vec3 vW; in vec3 vN; in vec3 vT; in vec2 vUv; flat in float vWarm; out vec4 o;
uniform vec3 uCamPos; uniform vec3 uWarm[3]; uniform vec3 uCool[3];
uniform float uGloss, uCore;
${STUDIO_GLSL}
// Kajiya-Kay style anisotropic highlight along the blade rachis (the tangent).
vec3 aniso(vec3 N, vec3 T, vec3 V, vec3 L, vec3 tint, float rough){
  vec3 H = normalize(L + V);
  float TdotH = dot(normalize(T), H);
  float sinTH = sqrt(max(0.0, 1.0 - TdotH * TdotH));
  float dir = pow(sinTH, mix(48.0, 8.0, rough));
  float ndl = max(dot(N, L), 0.0);
  return tint * dir * ndl;
}
void main(){
  vec3 N = normalize(vN); vec3 V = normalize(uCamPos - vW); if (dot(N, V) < 0.0) N = -N;
  vec3 T = normalize(vT);
  vec3 alb = mix(mix(uCool[0], uCool[1], vUv.y), mix(uCool[1], uCool[2], vUv.y), 0.5);
  vec3 wrm = mix(mix(uWarm[0], uWarm[1], vUv.y), mix(uWarm[1], uWarm[2], vUv.y), 0.5);
  alb = mix(alb, wrm, vWarm);
  // slightly darker toward the rachis
  alb *= 0.75 + 0.35 * sin(vUv.x * 3.14159);
  float rough = clamp(0.28 / max(uGloss, 0.2), 0.08, 0.55);
  vec3 f0 = mix(vec3(0.04), alb, 0.12);
  float sh = 1.0;
  float ao = 0.5 + 0.5 * abs(N.z);
  vec3 col = studioShade(vW, N, V, alb, rough, f0, ao, sh, 0.25);
  col += aniso(N, T, V, uLightDir, alb * 1.4 + vec3(0.15), rough) * 0.85 * uGloss;
  // darken the hollow core so the vortex reads
  float rad = length(vW.xy);
  float hole = smoothstep(0.12 * uCore, 0.9 * uCore, rad);
  col *= mix(0.08, 1.0, hole);
  col *= mix(1.0, 0.55, smoothstep(2.6, 3.8, abs(vW.z)));
  o = vec4(col, length(uCamPos - vW));
}`;

const SH_VS = `#version 300 es
layout(location=0) in vec3 aPos;
uniform mat4 uVP; uniform float uTime, uSpin, uMelt, uInward, uBlade; uniform int uCount;
float h1(float n){ return fract(sin(n * 19.19 + 7.13) * 51.7913); }
void main(){
  int i = gl_InstanceID; if (i >= uCount) { gl_Position = vec4(2.0); return; }
  float fi = float(i);
  float h = h1(fi + 3.1), h2 = h1(fi + 8.7), h3 = h1(fi + 14.2), h4 = h1(fi + 21.5);
  float r = mix(0.35, 3.6, pow(h, 0.55)); float z = mix(-3.8, 3.2, h2); float a0 = h3 * 6.2831853;
  float spin = uSpin * (0.55 + 0.9 / (0.35 + r));
  float a = a0 + uTime * spin + uInward * 0.35 * z;
  a += uMelt * (0.18 * sin(3.0 * a + r * 2.2 + uTime * 1.4));
  r += uMelt * 0.22 * sin(2.0 * a + uTime * 0.7);
  vec3 C = vec3(cos(a) * r, sin(a) * r, z);
  vec3 T = normalize(vec3(-sin(a), cos(a), 0.35 * uSpin));
  vec3 In = normalize(vec3(-C.x, -C.y, 0.0));
  vec3 B = normalize(cross(T, In)); In = cross(B, T);
  float len = (0.55 + 0.75 * h4) * uBlade; float wid = (0.22 + 0.35 * h2) * uBlade;
  vec3 w = C + T * (aPos.y * len) + B * (aPos.x * wid) + In * (aPos.z * wid * 0.8);
  gl_Position = uVP * vec4(w, 1.0);
}`;
const SH_FS = `#version 300 es
precision highp float; out vec4 o; void main(){ o = vec4(1.0); }`;

const BACK_FS = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o;
uniform mat4 uInvVP; uniform vec3 uCamPos; uniform vec3 uWarm0, uCool0;
void main(){
  vec4 a = uInvVP * vec4(vUv*2.0-1.0, 1.0, 1.0);
  vec3 rd = normalize(a.xyz/a.w - uCamPos);
  // dark well with a faint warm/cool rim, no cheap texture
  float z = rd.z;
  float v = pow(max(0.0, 1.0 - length(rd.xy) * 0.85), 2.0);
  vec3 col = mix(uCool0, uWarm0, 0.5 + 0.5 * rd.x) * 0.07 * v;
  col *= 0.25 + 0.75 * smoothstep(0.05, 0.55, length(rd.xy));
  o = vec4(col, 1000.0);
}`;

const TRAIL_FS = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o;
uniform sampler2D uCurr; uniform sampler2D uPrev; uniform float uTrail, uSpin;
void main(){
  vec2 d = vUv - 0.5;
  float ca = cos(-0.008 * uSpin), sa = sin(-0.008 * uSpin);
  vec2 p = vec2(ca * d.x - sa * d.y, sa * d.x + ca * d.y) * 0.985 + 0.5;
  vec4 curr = texture(uCurr, vUv);
  vec4 prev = texture(uPrev, p);
  float k = clamp(uTrail, 0.0, 0.92);
  // keep the trail from blowing out: decay highlights a little faster
  prev.rgb *= 0.92;
  o = vec4(curr.rgb + prev.rgb * k, curr.a);
}`;

export class FeatherVortexScene implements PhysScene {
  name = 'Feather Vortex'; ready = true; error: string | null = null; stats: Record<string, any> = {};
  private p: Prog; private sh: Prog; private back: Prog; private trail: Prog;
  private vao: WebGLVertexArrayObject; private nIdx: number;
  private ms: MsTarget; private prev: FB | null = null; private acc: FB | null = null;
  private t = 0; private first = true;
  constructor(private gl: WebGL2RenderingContext) {
    const g = bladeMesh(); this.nIdx = g.idx.length;
    this.vao = gl.createVertexArray()!; gl.bindVertexArray(this.vao);
    const pb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, pb); gl.bufferData(gl.ARRAY_BUFFER, g.pos, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    const nb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, nb); gl.bufferData(gl.ARRAY_BUFFER, g.nrm, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    const ub = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, ub); gl.bufferData(gl.ARRAY_BUFFER, g.uv, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, g.idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    this.p = compile(gl, VS, FS, 'feather');
    this.sh = compile(gl, SH_VS, SH_FS, 'feather-depth'); // unused placeholder kept for symmetry; no shadow pass (too dense)
    this.back = compile(gl, QUAD_VS, BACK_FS, 'feather-back');
    this.trail = compile(gl, QUAD_VS, TRAIL_FS, 'feather-trail');
    this.ms = new MsTarget(gl, 4);
  }
  load() { this.ready = true; }
  private bladeU(u: Record<string, WebGLUniformLocation | null>, P: Record<string, any>, n: number) {
    const gl = this.gl;
    gl.uniform1f(u.uTime, this.t);
    gl.uniform1f(u.uSpin, P.fvSpin ?? 1);
    gl.uniform1f(u.uMelt, P.fvMelt ?? 1);
    gl.uniform1f(u.uInward, P.fvInward ?? 1);
    gl.uniform1f(u.uBlade, P.fvBlade ?? 1);
    gl.uniform1f(u.uCore, P.fvCore ?? 1);
    gl.uniform1i(u.uCount, n);
  }
  render(f: PhysFrame) {
    const gl = this.gl; const P = f.params as Record<string, any>;
    if (!P.paused) this.t += Math.min(0.1, f.dt) * (P.speed ?? 1);
    const n = Math.max(800, Math.min(MAXB, Math.round((P.fvDensity ?? 1) * 6400)));
    const t = this.t;
    const eye: Vec3 = [Math.sin(t * 0.07) * 0.35, Math.cos(t * 0.06) * 0.25, 6.2];
    const tgt: Vec3 = [0, 0, -0.4];
    const view = lookAt(eye, tgt); const proj = perspective((P.fov ?? 52) * Math.PI / 180, f.aspect, 0.2, 40); const vp = mul(proj, view);
    const Ld = dirFromAzEl(P.keyAz ?? 25, P.keyEl ?? 38);
    const look = lookOf(P.look ?? 'Cobalt Orange');
    const fwd = norm([tgt[0] - eye[0], tgt[1] - eye[1], tgt[2] - eye[2]]);
    const env = { look, L: Ld, F: dirFromAzEl((P.keyAz ?? 25) + 140, 16), fwd };
    const pal = FEATHER_PALETTES[P.fvPalette] ?? FEATHER_PALETTES['Ember Tide'];
    this.ms.ensure(f.w, f.h); this.ms.begin(1000);
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
    gl.useProgram(this.back.p); gl.uniformMatrix4fv(this.back.u.uInvVP, false, invert(vp));
    gl.uniform3fv(this.back.u.uCamPos, eye);
    gl.uniform3fv(this.back.u.uWarm0, srgbHex(pal.warm[0])); gl.uniform3fv(this.back.u.uCool0, srgbHex(pal.cool[2]));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.depthFunc(gl.LESS);
    gl.disable(gl.CULL_FACE);
    const u = this.p.u; gl.useProgram(this.p.p); setStudioEnv(gl, u, env); this.bladeU(u, P, n);
    gl.uniformMatrix4fv(u.uVP, false, vp); gl.uniform3fv(u.uCamPos, eye); gl.uniform3fv(u.uLightDir, Ld);
    gl.uniform1f(u.uGloss, P.gloss ?? 1);
    const wr = new Float32Array(9), cl = new Float32Array(9);
    pal.warm.slice(0, 3).forEach((h, i) => wr.set(srgbHex(h), i * 3));
    pal.cool.slice(0, 3).forEach((h, i) => cl.set(srgbHex(h), i * 3));
    gl.uniform3fv(u.uWarm, wr); gl.uniform3fv(u.uCool, cl);
    gl.bindVertexArray(this.vao);
    gl.drawElementsInstanced(gl.TRIANGLES, this.nIdx, gl.UNSIGNED_SHORT, 0, n);
    gl.bindVertexArray(null); gl.disable(gl.DEPTH_TEST);
    const curr = this.ms.resolve();
    if (!this.prev || this.prev.w !== f.w || this.prev.h !== f.h) {
      this.prev = fbo(gl, f.w, f.h); this.acc = fbo(gl, f.w, f.h); this.first = true;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.acc!.f); gl.viewport(0, 0, f.w, f.h);
    gl.useProgram(this.trail.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, curr); gl.uniform1i(this.trail.u.uCurr, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.prev!.t); gl.uniform1i(this.trail.u.uPrev, 1);
    gl.uniform1f(this.trail.u.uTrail, this.first ? 0 : (P.fvTrail ?? 0.65));
    gl.uniform1f(this.trail.u.uSpin, P.fvSpin ?? 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // copy acc -> prev for next frame
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.acc!.f); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.prev!.f);
    gl.blitFramebuffer(0, 0, f.w, f.h, 0, 0, f.w, f.h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    this.first = false;
    f.dof(this.acc!.t, f.target, f.w, f.h, 5.8, P.dof ?? 0.16);
    this.stats = { ready: true, blades: n, tris: this.nIdx / 3 * n };
  }
}
