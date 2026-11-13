// Pass 4 "physical" scenes: shared GL helpers, matrices and the C4D studio shading snippets.
// Original MIT-licensed work for flow-engine. GGX / Smith / Schlick follow the published papers
// (Walter et al. 2007, Schlick 1994). No Shadertoy code.
import { STUDIO_LOOKS, srgbHex, invert, type StudioLook } from '../studio';
export { invert, srgbHex };
export type Vec3 = [number, number, number];
export type Prog = { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null> };

export function compile(gl: WebGL2RenderingContext, vs: string, fs: string, name: string): Prog {
  const prog = gl.createProgram()!;
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]] as const) {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(`${name}: ${gl.getShaderInfoLog(sh)}`);
    gl.attachShader(prog, sh);
  }
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`${name} link: ${gl.getProgramInfoLog(prog)}`);
  const u: Record<string, WebGLUniformLocation | null> = {};
  const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const a = gl.getActiveUniform(prog, i)!;
    u[a.name] = gl.getUniformLocation(prog, a.name);
    if (a.name.endsWith('[0]')) u[a.name.slice(0, -3)] = u[a.name];
  }
  return { p: prog, u };
}

export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm = (a: Vec3): Vec3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export function mul(a: number[], b: number[]): number[] {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}
export function lookAt(e: Vec3, t: Vec3, up: Vec3 = [0, 1, 0]): number[] {
  const z = norm(sub(e, t)), x = norm(cross(up, z)), y = cross(z, x);
  return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1];
}
export function perspective(fovy: number, aspect: number, near: number, far: number): number[] {
  const f = 1 / Math.tan(fovy / 2);
  return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, (2 * far * near) / (near - far), 0];
}
export function ortho(l: number, r: number, b: number, t: number, n: number, f: number): number[] {
  return [2 / (r - l), 0, 0, 0, 0, 2 / (t - b), 0, 0, 0, 0, -2 / (f - n), 0, -(r + l) / (r - l), -(t + b) / (t - b), -(f + n) / (f - n), 1];
}
let _colorP: Record<string, any> | null = null;
/** Push the current params so lookOf / setStudioEnv can apply Color section overrides. */
export function setColorParams(P: Record<string, any> | null) { _colorP = P; }
function pickHex(P: Record<string, any> | null, key: string, fallback: string): string {
  const v = P && P[key];
  return (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) ? v : fallback;
}
export function lookOf(name: string): StudioLook {
  const base = STUDIO_LOOKS[name] ?? STUDIO_LOOKS['Coral Peach'];
  const P = _colorP;
  if (!P) return base;
  return {
    ...base,
    key: pickHex(P, 'colKey', base.key),
    fill: pickHex(P, 'colFill', base.fill),
    rim: pickHex(P, 'colRim', base.rim),
    dome: pickHex(P, 'colAmbient', base.dome),
    bgTop: pickHex(P, 'colBgTop', base.bgTop),
    bgBottom: pickHex(P, 'colBgBottom', base.bgBottom),
    glow: pickHex(P, 'colGlow', base.glow),
  };
}
export function lin(h: string, s = 1): Vec3 { const v = srgbHex(h); return [v[0] * s, v[1] * s, v[2] * s]; }
export function dirFromAzEl(azDeg: number, elDeg: number): Vec3 {
  const az = azDeg * Math.PI / 180, el = elDeg * Math.PI / 180;
  return norm([Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)]);
}

export function tex2D(gl: WebGL2RenderingContext, w: number, h: number, ifmt: number, fmt: number, type: number, filter: number, data: ArrayBufferView | null = null, wrap: number = gl.CLAMP_TO_EDGE) {
  const t = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, type, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  return t;
}
export type FB = { f: WebGLFramebuffer; t: WebGLTexture; w: number; h: number };
export function fbo(gl: WebGL2RenderingContext, w: number, h: number, ifmt: number = gl.RGBA16F, filter: number = gl.LINEAR, wrap: number = gl.CLAMP_TO_EDGE): FB {
  const fmt = ifmt === gl.RG16F || ifmt === gl.RG32F ? gl.RG : ifmt === gl.R16F || ifmt === gl.R32F ? gl.RED : gl.RGBA;
  const type = ifmt === gl.RGBA32F || ifmt === gl.RG32F || ifmt === gl.R32F ? gl.FLOAT : gl.HALF_FLOAT;
  const t = tex2D(gl, w, h, ifmt, fmt, type, filter, null, wrap);
  const f = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { f, t, w, h };
}
export function deleteFB(gl: WebGL2RenderingContext, b: FB | null) { if (!b) return; gl.deleteFramebuffer(b.f); gl.deleteTexture(b.t); }

/** MSAA colour+depth target that resolves into a float texture (alpha = view distance for the shared DOF pass). */
export class MsTarget {
  ms: WebGLFramebuffer | null = null; col: WebGLRenderbuffer | null = null; dep: WebGLRenderbuffer | null = null;
  res: FB | null = null; w = 0; h = 0; samples: number;
  constructor(private gl: WebGL2RenderingContext, samples = 4) { this.samples = Math.max(0, Math.min(samples, gl.getParameter(gl.MAX_SAMPLES) as number)); }
  ensure(w: number, h: number) {
    const gl = this.gl;
    if (this.w === w && this.h === h && this.ms) return;
    if (this.ms) { gl.deleteFramebuffer(this.ms); gl.deleteRenderbuffer(this.col); gl.deleteRenderbuffer(this.dep); deleteFB(gl, this.res); }
    this.w = w; this.h = h;
    this.ms = gl.createFramebuffer(); this.col = gl.createRenderbuffer(); this.dep = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.col); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, this.samples, gl.RGBA16F, w, h);
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.dep); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, this.samples, gl.DEPTH_COMPONENT24, w, h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.ms);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, this.col);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.dep);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.res = fbo(gl, w, h);
  }
  begin(clearDist = 1000) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.ms); gl.viewport(0, 0, this.w, this.h);
    gl.clearColor(0, 0, 0, clearDist); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }
  resolve(): WebGLTexture {
    const gl = this.gl;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.ms); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.res!.f);
    gl.blitFramebuffer(0, 0, this.w, this.h, 0, 0, this.w, this.h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    return this.res!.t;
  }
}

/** Depth-only shadow map with hardware comparison. */
export class ShadowMap {
  tex: WebGLTexture; fb: WebGLFramebuffer;
  constructor(private gl: WebGL2RenderingContext, public res = 2048) {
    this.tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, res, res);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    this.fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.tex, 0);
    gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  begin() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb); gl.viewport(0, 0, this.res, this.res);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1.5, 3.0);
  }
  end() { this.gl.disable(this.gl.POLYGON_OFFSET_FILL); }
}

export const QUAD_VS = `#version 300 es
out vec2 vUv;
void main(){ vec2 p = vec2((gl_VertexID<<1)&2, gl_VertexID&2); vUv = p; gl_Position = vec4(p*2.0-1.0, 0.0, 1.0); }`;

/** Studio environment + BRDF helpers (cove gradient, two softboxes, GGX, PCF). */
export const STUDIO_GLSL = `
uniform vec3 uBgTop, uBgBottom, uBgGlow, uKeyCol, uFillCol, uLightDir, uFillDir, uCamFwd, uDomeCol, uGroundCol, uRimCol;
uniform float uKeyI, uDomeI;
uniform vec3 uWallCol, uObjectTint, uGlowCol;
uniform float uObjectMix, uGlowI;
const float PI = 3.14159265;
vec3 backdrop(vec3 rd){
  float h = smoothstep(-0.08, 0.75, rd.y);
  vec3 c = mix(uBgBottom, uBgTop, h);
  c += uBgGlow * pow(max(dot(rd, uCamFwd), 0.0), 6.0);
  return c;
}
vec3 envMap(vec3 rd, float rough){
  vec3 c = backdrop(rd);
  float sharp = mix(90.0, 6.0, rough);
  c += uKeyCol * pow(max(dot(rd, uLightDir), 0.0), sharp) * mix(5.0, 0.6, rough);
  c += uFillCol * pow(max(dot(rd, uFillDir), 0.0), sharp * 0.7) * mix(2.2, 0.3, rough);
  return c;
}
float D_GGX(float nh, float a){ float a2=a*a; float d=nh*nh*(a2-1.0)+1.0; return a2/(PI*d*d); }
float V_Smith(float nv, float nl, float a){ float k=a*0.5; return 0.25/((nv*(1.0-k)+k)*(nl*(1.0-k)+k)); }
vec3 F_Schlick(vec3 f0, float c){ return f0 + (1.0-f0)*pow(1.0-c, 5.0); }
vec3 thinFilm(float nv){ return 0.5 + 0.5*cos(6.2831*(vec3(0.0,0.33,0.67) + nv*1.35 + 0.15)); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
/** Lit studio surface: wrap diffuse key + dome, GGX key highlight, env reflection, fresnel rim. */
vec3 studioShade(vec3 P, vec3 N, vec3 V, vec3 albedo, float rough, vec3 f0, float ao, float sh, float rimAmt){
  albedo *= mix(vec3(1.0), uObjectTint, uObjectMix);
  vec3 L = normalize(uLightDir);
  float nl = max(dot(N, L), 0.0), nv = max(dot(N, V), 1e-3);
  float wrap = clamp((dot(N, L)+0.25)/1.25, 0.0, 1.0);
  vec3 dome = mix(uGroundCol, uDomeCol, N.y*0.5+0.5);
  vec3 diff = albedo * (uKeyCol*uKeyI*wrap*sh + dome*uDomeI*ao);
  vec3 H = normalize(L + V); float a = rough*rough;
  vec3 spec = D_GGX(max(dot(N,H),0.0), a) * V_Smith(nv, nl, a) * F_Schlick(f0, max(dot(H,V),0.0)) * nl * uKeyCol*uKeyI*sh;
  vec3 Fe = f0 + (max(vec3(1.0-rough), f0) - f0)*pow(1.0-nv, 5.0);
  vec3 refl = envMap(reflect(-V, N), rough) * Fe * mix(ao, 1.0, 0.25);
  vec3 rim = uRimCol * rimAmt * pow(1.0-nv, 3.0) * mix(0.4, 1.0, ao);
  return diff*(1.0 - Fe*0.5) + spec + refl + rim;
}`;

export const PCF_GLSL = `
uniform highp sampler2DShadow uShadow; uniform mat4 uLightVP; uniform float uShadowSoft, uShadowTexel;
const vec2 PD[12] = vec2[12](vec2(-0.326,-0.406),vec2(-0.840,-0.074),vec2(-0.696,0.457),vec2(-0.203,0.621),vec2(0.962,-0.195),vec2(0.473,-0.480),
  vec2(0.519,0.767),vec2(0.185,-0.893),vec2(0.507,0.064),vec2(0.896,0.412),vec2(-0.322,-0.933),vec2(-0.792,-0.598));
float shadowAt(vec3 p, vec3 n){
  vec4 lp = uLightVP * vec4(p + n*0.015, 1.0);
  vec3 s = lp.xyz/lp.w*0.5+0.5;
  if (s.x<0.0||s.x>1.0||s.y<0.0||s.y>1.0||s.z>1.0) return 1.0;
  float r = uShadowSoft*uShadowTexel;
  float a = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233)))*43758.5453)*6.2831;
  mat2 R = mat2(cos(a),-sin(a),sin(a),cos(a));
  float acc = 0.0;
  for (int i=0;i<12;i++) acc += texture(uShadow, vec3(s.xy + R*PD[i]*r, s.z - 0.0012));
  return acc/12.0;
}`;

export type StudioEnv = { look: StudioLook; L: Vec3; F: Vec3; fwd: Vec3 };
/** Upload the STUDIO_GLSL uniforms for a look. */
export function setStudioEnv(gl: WebGL2RenderingContext, u: Record<string, WebGLUniformLocation | null>, e: StudioEnv) {
  const k = e.look;
  gl.uniform3fv(u.uBgTop, lin(k.bgTop)); gl.uniform3fv(u.uBgBottom, lin(k.bgBottom)); gl.uniform3fv(u.uBgGlow, lin(k.glow, 0.25));
  gl.uniform3fv(u.uKeyCol, lin(k.key)); gl.uniform3fv(u.uFillCol, lin(k.fill)); gl.uniform3fv(u.uLightDir, e.L); gl.uniform3fv(u.uFillDir, e.F);
  gl.uniform3fv(u.uCamFwd, e.fwd); gl.uniform3fv(u.uDomeCol, lin(k.dome)); const bb = lin(k.bgBottom);
  const P = _colorP;
  const floorHex = P && pickHex(P, 'colFloor', '');
  const ground = floorHex ? lin(floorHex) : [bb[0] * 0.8, bb[1] * 0.8, bb[2] * 0.8] as [number, number, number];
  gl.uniform3fv(u.uGroundCol, ground);
  gl.uniform3fv(u.uRimCol, lin(k.rim)); gl.uniform1f(u.uKeyI, k.keyI); gl.uniform1f(u.uDomeI, k.domeI);
  if (u.uWallCol) {
    const wallHex = P && pickHex(P, 'colWalls', '');
    gl.uniform3fv(u.uWallCol, wallHex ? lin(wallHex) : lin(k.bgTop));
  }
  if (u.uObjectTint) {
    const objHex = P && pickHex(P, 'colObject', '');
    gl.uniform3fv(u.uObjectTint, objHex ? lin(objHex) : [1, 1, 1]);
    gl.uniform1f(u.uObjectMix, objHex ? 0.45 : 0);
  }
  if (u.uGlowCol) {
    gl.uniform3fv(u.uGlowCol, lin(k.glow));
    const gi = P && typeof P.colGlowI === 'number' ? P.colGlowI : 1;
    gl.uniform1f(u.uGlowI, gi);
  }
}
export function slotsOf(look: StudioLook): Float32Array { const s = new Float32Array(21); look.slots.forEach((h, i) => s.set(srgbHex(h), i * 3)); return s; }

export type PhysParams = {
  look: string; speed: number; mat: string; dof: number; keyAz: number; keyEl: number; quality: number; variant: string; density: number; [k: string]: any;
};
export type PhysFrame = { target: WebGLFramebuffer; w: number; h: number; aspect: number; dt: number; time: number; params: PhysParams;
  dof: (src: WebGLTexture, target: WebGLFramebuffer, w: number, h: number, focus: number, amount: number) => void };
export interface PhysScene { name: string; ready: boolean; error: string | null; stats: Record<string, any>; load(): Promise<void> | void; render(f: PhysFrame): void; }
