// Pass 6 Fabric "Drift": 5-10 silk / satin ribbons and sheets stream out of the haze and float past the lens in an
// endless loop. Each ribbon travels through a slowly evolving standing-wave field (so it snakes, twists and billows
// as it comes toward you); geometry is generated analytically in the vertex shader (no CPU cloth). Cloth shading:
// procedural plain/satin weave as a bump map (warp/weft threads, over-under), Kajiya-Kay style anisotropic sheen
// along whichever thread is on top, velvet grazing sheen, thin-film option, translucency, PCF shadows.
// Original MIT-licensed implementation for flow-engine (no third-party code). No Shadertoy code.
import { compile, QUAD_VS, STUDIO_GLSL, PCF_GLSL, MsTarget, ShadowMap, setStudioEnv, lookOf, dirFromAzEl, srgbHex, lookAt, perspective, ortho, mul, norm, invert,
  type PhysFrame, type PhysScene, type Prog, type Vec3 } from './common';

export const FABRIC_PALETTES: Record<string, string[]> = {
  'Complementary Coral/Teal': ['#ff6f61', '#1fb5ad', '#ff9e80', '#0f7c8c', '#ffd3c4', '#5fd4c9'],
  'Triad Jewel': ['#7b2cbf', '#e0a800', '#0f9d58', '#c2185b', '#1e88e5', '#ffca28'],
  'Analog Sunset': ['#ff5e62', '#ff9966', '#ffc371', '#f857a6', '#ff7b54', '#ffb26b'],
  'Split Lilac/Gold': ['#b39ddb', '#f4c430', '#7e57c2', '#ffe082', '#d1c4e9', '#c9a227'],
  'Monochrome Pearl': ['#f3efe9', '#e6ddd3', '#d9cfc4', '#efe6f2', '#e2ecef', '#f7f1e3'],
};
const GU = 260, GV = 28, MAXR = 10;

const RIB_GLSL = `
uniform float uTime, uFlutter, uWidth, uTwist, uZFar, uZNear, uLen;
uniform int uCount;
float h1(float n){ return fract(sin(n*127.1)*43758.5453); }
// ribbon i: world position of (s along length 0..1, w across -1..1)
vec3 ribbon(int i, float s, float w, out float zc){
  float fi = float(i); float R = uZNear - uZFar + uLen;
  float v = 1.6 + 0.9*h1(fi+3.1);
  float head = uZFar + mod(uTime*v + h1(fi+7.7)*R, R);              // head travels toward the lens, loops behind the haze
  float z = head - s*uLen; zc = z;
  float n = float(uCount);
  float X = ((fi + 0.5)/n*2.0 - 1.0)*5.2 + (h1(fi+1.3)-0.5)*1.6;
  float Y = (h1(fi+2.9)*2.0 - 1.0)*2.6;
  float ph = h1(fi+5.5)*6.283, ph2 = h1(fi+9.1)*6.283;
  float t = uTime;
  vec3 c = vec3(X + 2.2*sin(0.21*z + 0.45*t + ph) + 0.45*uFlutter*sin(0.83*z + 1.4*t + ph2),
                Y + 1.2*cos(0.17*z + 0.38*t + ph2) + 0.35*uFlutter*sin(1.07*z + 1.9*t + ph), z);
  float W = (1.0 + 1.1*h1(fi+4.4))*uWidth * (h1(fi+8.8) > 0.6 ? 1.8 : 1.0);
  W *= smoothstep(0.0, 0.06, s)*0.6 + 0.4; W *= smoothstep(1.0, 0.94, s)*0.6 + 0.4;
  float th = uTwist*(0.11*z + 0.3*t + ph) + 0.22*uFlutter*sin(0.9*z + 1.8*t + ph2);
  vec3 b = vec3(cos(th), sin(th), 0.0);
  vec3 nrm = vec3(-sin(th), cos(th), 0.0);
  float bil = uFlutter*(0.22*W)*sin(w*2.4 + 1.3*z + 3.1*t + ph) + 0.25*W*w*w*sin(0.7*z + t + ph2);   // billow across the width
  return c + b*w*W + nrm*bil;
}`;
const VS = `#version 300 es
uniform mat4 uVP; uniform ivec2 uG;
${RIB_GLSL}
out vec3 vW; out vec3 vN; out vec3 vT; out vec2 vUV; flat out int vI;
void main(){
  int i = gl_InstanceID; vI = i;
  int gx = gl_VertexID % uG.x, gy = gl_VertexID / uG.x;
  float s = float(gx)/float(uG.x-1), w = float(gy)/float(uG.y-1)*2.0 - 1.0;
  float zc; vec3 p = ribbon(i, s, w, zc);
  float e = 1.0/float(uG.x-1), f = 2.0/float(uG.y-1); float z2;
  vec3 ps = ribbon(i, s + e, w, z2), pw = ribbon(i, s, w + f, z2);
  vec3 T = normalize(p - ps); vec3 Bw = normalize(pw - p);
  vN = normalize(cross(T, Bw)); vT = T; vW = p;
  float hw = length(pw - p)/f;
  vUV = vec2(s*uLen, w*hw);
  if (i >= uCount) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  gl_Position = uVP*vec4(p, 1.0);
}`;
const SH_FS = `#version 300 es
precision highp float; out vec4 o; void main(){ o = vec4(1.0); }`;
const BACK_FS = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o;
uniform mat4 uInvVP; uniform vec3 uCamPos;
${STUDIO_GLSL}
void main(){ vec4 a = uInvVP*vec4(vUv*2.0-1.0, 1.0, 1.0); vec3 rd = normalize(a.xyz/a.w - uCamPos); o = vec4(backdrop(rd), 1000.0); }`;
const FS = `#version 300 es
precision highp float;
in vec3 vW; in vec3 vN; in vec3 vT; in vec2 vUV; flat in int vI; out vec4 o;
uniform vec3 uCamPos; uniform vec3 uPal[6]; uniform int uNPal; uniform float uMat, uIrid, uGloss, uWeave, uSheen, uThreads, uFogNear, uFogFar;
${STUDIO_GLSL}
${PCF_GLSL}
// plain weave height field: warp threads along u, weft along v, alternating over/under per cell
float weaveH(vec2 q, out float warpTop){
  vec2 c = floor(q); vec2 fq = fract(q);
  float p = mod(c.x + c.y, 2.0); warpTop = 1.0 - p;
  float warp = sin(3.14159*fq.y), weft = sin(3.14159*fq.x);
  float hw = warp*(0.55 + 0.45*sin(3.14159*fq.x)), hf = weft*(0.55 + 0.45*sin(3.14159*fq.y));
  return p < 0.5 ? max(hw, hf*0.6) : max(hf, hw*0.6);
}
void main(){
  vec3 N = normalize(vN); vec3 V = normalize(uCamPos - vW);
  bool front = dot(N, V) > 0.0; if (!front) N = -N;
  int k = vI % uNPal; int kb = (vI + uNPal/2) % uNPal;
  float g = smoothstep(-1.0, 1.0, sin(vUV.x*0.35 + float(vI)));
  vec3 alb = front ? mix(uPal[k], uPal[(k+1)%uNPal], 0.18*g) : mix(uPal[kb], uPal[k], 0.15*g);
  vec3 T = normalize(vT - N*dot(vT, N)); vec3 B = cross(N, T);
  // weave bump (fades out once threads are sub-pixel)
  vec2 q = vUV*uThreads; float lod = max(fwidth(q.x), fwidth(q.y));
  float bumpAmt = uWeave*(1.0 - smoothstep(0.08, 0.26, lod));
  float wt; float h = weaveH(q, wt); float d1; float hu = weaveH(q + vec2(0.06, 0.0), d1); float hv = weaveH(q + vec2(0.0, 0.06), d1);
  vec3 Nb = normalize(N - bumpAmt*0.55*((hu - h)/0.06*T + (hv - h)/0.06*B)*0.1);
  vec3 At = mix(B, T, wt);                         // anisotropy follows the thread on top
  vec3 L = normalize(uLightDir); vec3 H = normalize(L + V);
  float nl = dot(Nb, L), nv = max(dot(Nb, V), 1e-3);
  float sh = shadowAt(vW, N);
  float wrap = clamp((nl + 0.2)/1.2, 0.0, 1.0);
  vec3 dome = mix(uGroundCol, uDomeCol, Nb.y*0.5 + 0.5);
  float thr = mix(1.0, 0.8 + 0.2*h, bumpAmt) * mix(0.92, 1.0, 1.0 - bumpAmt);    // thread valleys darker
  vec3 diff = alb*thr*(uKeyCol*uKeyI*1.2*wrap*mix(0.22, 1.0, sh) + dome*uDomeI*0.6);
  float ta = dot(At, H); float ex = mix(18.0, 110.0, clamp(uGloss*0.6, 0.0, 1.0));
  float sA = pow(sqrt(max(0.0, 1.0 - ta*ta)), ex);
  float tb = dot(cross(Nb, At), H); float sB = pow(sqrt(max(0.0, 1.0 - tb*tb)), ex*0.35);
  float satin = uMat < 0.5 ? 1.0 : uMat < 1.5 ? 0.6 : uMat < 2.5 ? 0.85 : 0.12;   // satin, silk, iridescent, velvet
  vec3 hiCol = mix(alb, vec3(1.0), 0.28);
  vec3 spec = (hiCol*sA*1.0 + alb*sB*0.4) * satin * uSheen * uKeyCol*uKeyI*2.1 * max(nl, 0.0) * sh;
  float sheen = pow(1.0 - nv, uMat > 2.5 ? 1.6 : 4.0) * (uMat > 2.5 ? 1.0 : 0.3);
  vec3 col = diff + spec + alb*sheen + uRimCol*pow(1.0 - nv, 3.0)*0.2;
  col += envMap(reflect(-V, Nb), 0.35) * (0.02 + 0.22*pow(1.0 - nv, 5.0)) * satin;
  if (uMat > 1.5 && uMat < 2.5) { vec3 film = thinFilm(nv*1.1 + 0.03*vUV.x); col = mix(col, col*0.55 + film*(0.35*diff + 1.2*spec + 0.25), 0.6*uIrid); }
  col += alb*uKeyCol*max(-dot(N, L), 0.0)*0.4*(uMat > 2.5 ? 0.2 : 1.0)*mix(0.4, 1.0, sh);   // thin silk glows when back-lit
  float dist = length(vW - uCamPos);
  vec3 rd = -V; vec3 fogC = backdrop(rd);
  col = mix(col, fogC, smoothstep(uFogNear, uFogFar, dist));                               // ribbons emerge from the haze
  o = vec4(col, dist);
}`;

export class FabricDriftScene implements PhysScene {
  name = 'Fabric Drift'; ready = false; error: string | null = null; stats: Record<string, any> = {};
  private p: Prog; private sh: Prog; private back: Prog; private ibo: WebGLBuffer; private vao: WebGLVertexArrayObject; private nIdx: number;
  private ms: MsTarget; private sm: ShadowMap; private t = 0;
  constructor(private gl: WebGL2RenderingContext) {
    this.p = compile(gl, VS, FS, 'fabric-drift'); this.sh = compile(gl, VS, SH_FS, 'fabric-drift-sh'); this.back = compile(gl, QUAD_VS, BACK_FS, 'fabric-drift-bg');
    const idx = new Uint32Array((GU - 1) * (GV - 1) * 6); let n = 0;
    for (let y = 0; y < GV - 1; y++) for (let x = 0; x < GU - 1; x++) { const a = y * GU + x, b = a + 1, c = a + GU, d = c + 1; idx.set([a, c, b, b, c, d], n); n += 6; }
    this.nIdx = n;
    this.vao = gl.createVertexArray()!; gl.bindVertexArray(this.vao);
    this.ibo = gl.createBuffer()!; gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    this.ms = new MsTarget(gl, 4); this.sm = new ShadowMap(gl, 2048);
  }
  load() { this.ready = true; }
  private ribUniforms(u: Record<string, WebGLUniformLocation | null>, P: Record<string, any>) {
    const gl = this.gl;
    gl.uniform1f(u.uTime, this.t); gl.uniform1f(u.uFlutter, P.fbFlutter ?? 1); gl.uniform1f(u.uWidth, P.fbWidth ?? 1); gl.uniform1f(u.uTwist, P.fbTwist ?? 1);
    gl.uniform1f(u.uZFar, -34); gl.uniform1f(u.uZNear, 9); gl.uniform1f(u.uLen, 18); gl.uniform1i(u.uCount, Math.max(1, Math.min(MAXR, Math.round(P.fbCount ?? 8))));
    gl.uniform2i(u.uG, GU, GV);
  }
  render(f: PhysFrame) {
    const gl = this.gl; const P = f.params as Record<string, any>;
    if (!P.paused) this.t += Math.min(0.1, f.dt) * (P.speed ?? 1);
    const t = this.t;
    const eye: Vec3 = [Math.sin(t * 0.11) * 0.6, Math.sin(t * 0.083) * 0.35, 6.5];
    const tgt: Vec3 = [Math.sin(t * 0.07) * 0.8, Math.sin(t * 0.05) * 0.4, -8];
    const view = lookAt(eye, tgt); const proj = perspective((P.fov ?? 50) * Math.PI / 180, f.aspect, 0.2, 80); const vp = mul(proj, view);
    const Ld = dirFromAzEl(P.keyAz ?? -60, P.keyEl ?? 40);
    const ctr: Vec3 = [0, 0, -6];
    const lview = lookAt([ctr[0] + Ld[0] * 30, ctr[1] + Ld[1] * 30, ctr[2] + Ld[2] * 30], ctr, Math.abs(Ld[1]) > 0.95 ? [0, 0, 1] : [0, 1, 0]);
    const lvp = mul(ortho(-14, 14, -14, 14, 1, 70), lview);
    gl.bindVertexArray(this.vao);
    // shadow
    this.sm.begin(); gl.disable(gl.CULL_FACE);
    gl.useProgram(this.sh.p); this.ribUniforms(this.sh.u, P); gl.uniformMatrix4fv(this.sh.u.uVP, false, lvp);
    gl.drawElementsInstanced(gl.TRIANGLES, this.nIdx, gl.UNSIGNED_INT, 0, MAXR);
    this.sm.end();
    // main
    this.ms.ensure(f.w, f.h); this.ms.begin(1000);
    const look = lookOf(P.look ?? 'Cobalt Orange');
    const fwd = norm([tgt[0] - eye[0], tgt[1] - eye[1], tgt[2] - eye[2]]);
    const env = { look, L: Ld, F: dirFromAzEl((P.keyAz ?? -60) + 150, 20), fwd };
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
    gl.useProgram(this.back.p); setStudioEnv(gl, this.back.u, env); gl.uniformMatrix4fv(this.back.u.uInvVP, false, invert(vp)); gl.uniform3fv(this.back.u.uCamPos, eye);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.depthFunc(gl.LESS);
    const u = this.p.u; gl.useProgram(this.p.p); setStudioEnv(gl, u, env); this.ribUniforms(u, P);
    gl.uniformMatrix4fv(u.uVP, false, vp); gl.uniform3fv(u.uCamPos, eye);
    const pal = (FABRIC_PALETTES[P.fbPalette] ?? FABRIC_PALETTES['Complementary Coral/Teal']);
    const pa = new Float32Array(18); pal.slice(0, 6).forEach((h, i) => pa.set(srgbHex(h), i * 3));
    gl.uniform3fv(u.uPal, pa); gl.uniform1i(u.uNPal, Math.min(6, pal.length));
    const MATS = ['Satin', 'Silk', 'Iridescent', 'Velvet']; gl.uniform1f(u.uMat, Math.max(0, MATS.indexOf(P.mat)));
    gl.uniform1f(u.uIrid, P.irid ?? 0.9); gl.uniform1f(u.uGloss, P.gloss ?? 1); gl.uniform1f(u.uWeave, P.fbWeave ?? 1); gl.uniform1f(u.uSheen, P.fbSheen ?? 1);
    gl.uniform1f(u.uThreads, 36); gl.uniform1f(u.uFogNear, 16); gl.uniform1f(u.uFogFar, 40);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.sm.tex); gl.uniform1i(u.uShadow, 3);
    gl.uniformMatrix4fv(u.uLightVP, false, lvp); gl.uniform1f(u.uShadowSoft, 3.0); gl.uniform1f(u.uShadowTexel, 1 / 2048);
    gl.drawElementsInstanced(gl.TRIANGLES, this.nIdx, gl.UNSIGNED_INT, 0, MAXR);
    gl.bindVertexArray(null); gl.disable(gl.DEPTH_TEST); gl.activeTexture(gl.TEXTURE0);
    const tex = this.ms.resolve();
    f.dof(tex, f.target, f.w, f.h, P.fbFocus ?? 9, P.dof ?? 0.25);
    this.stats = { ribbons: Math.round(P.fbCount ?? 8), tris: this.nIdx / 3 * Math.round(P.fbCount ?? 8) };
  }
}
