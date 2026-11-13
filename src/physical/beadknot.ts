// Bead Knot: thick glossy torus-knot ribbons of segmented beads wrapping a glowing
// crystal core, on black, with real 3D GGX shading, PCF shadows, AO, bloom-ready
// emissive highlights, a slow camera orbit and a continuous knot morph.
// Original MIT-licensed work for flow-engine. Torus-knot parametrisation is
// standard public-domain mathematics. Shading follows Walter et al. 2007 (GGX),
// Schlick 1994 and Smith. No Shadertoy code and no third-party assets.
import { compile, QUAD_VS, STUDIO_GLSL, PCF_GLSL, MsTarget, ShadowMap, setStudioEnv, lookOf, dirFromAzEl, srgbHex, lookAt, perspective, ortho, mul, norm, invert,
  type PhysFrame, type PhysScene, type Prog, type Vec3 } from './common';

export const KNOT_PALETTES: Record<string, { beads: string[]; core: string }> = {
  'Ember Core': { beads: ['#ff2a1a', '#ff6a12', '#ffb000', '#ff3d2e', '#ff8a1c', '#ffe14a'], core: '#3cf0ff' },
  'Magenta Sun': { beads: ['#ff1e6e', '#ff5a2a', '#ffc43a', '#ff47a0', '#ff7a3a', '#ffe36a'], core: '#66fff0' },
  'Neon Ice': { beads: ['#2ee0ff', '#7a5cff', '#ff4ad8', '#1aa8ff', '#c07dff', '#7ef7ff'], core: '#fff4a8' },
  'Electric Lime': { beads: ['#b8ff1a', '#4dff7a', '#ffe14a', '#7cff2a', '#1fd49a', '#f6ff6a'], core: '#ff4ad2' },
};

function unitCube() {
  const F: Array<[[number, number, number], [number, number, number][]]> = [
    [[0, 0, 1], [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]],
    [[0, 0, -1], [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]]],
    [[0, 1, 0], [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]]],
    [[0, -1, 0], [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]]],
    [[1, 0, 0], [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]]],
    [[-1, 0, 0], [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]]],
  ];
  const pos: number[] = [], nrm: number[] = [], idx: number[] = [];
  for (const [n, q] of F) {
    const b = pos.length / 3;
    for (const p of q) { pos.push(...p); nrm.push(...n); }
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), idx: new Uint16Array(idx) };
}

const KNOT_GLSL = `
uniform float uTime, uP, uQ, uR, uRad, uMorph, uSize, uGap, uCore;
uniform int uStrands, uBeads;
vec3 kn(float t, float p, float q, float R, float r){
  float cq = cos(q*t), sq = sin(q*t);
  return vec3((R + r*cq)*cos(p*t), r*sq, (R + r*cq)*sin(p*t));
}
void frameAt(float t, float p, float q, float R, float r, out vec3 P, out vec3 T, out vec3 N, out vec3 B){
  float d = 0.01;
  P = kn(t,p,q,R,r);
  vec3 P2 = kn(t+d,p,q,R,r);
  T = normalize(P2 - P);
  vec3 ref = abs(T.y) < 0.92 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  N = normalize(cross(ref, T));
  B = cross(T, N);
  // morph: a slow travelling wrinkle along the knot, plus a gentle radius pulse
  float w = uMorph * (0.22 * sin(3.0*t + uTime*0.55) + 0.12 * sin(5.0*t - uTime*0.37));
  P += N*w + B*(uMorph*0.10*sin(2.0*t + uTime*0.29));
}
`;

const BEAD_VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm;
uniform mat4 uVP;
${KNOT_GLSL}
out vec3 vW; out vec3 vN; flat out int vKind; flat out int vStrand;
void main(){
  int id = gl_InstanceID;
  int nB = max(uBeads, 1), nS = max(uStrands, 1);
  int coreN = 28;
  vec3 P,T,N,B;
  if (id >= nS * nB) {
    // crystal core cubes
    int c = id - nS * nB;
    vKind = 1; vStrand = c;
    float fi = float(c);
    float a = fi * 2.399963;                      // golden-angle packing
    float z = (fi + 0.5) / float(coreN) * 2.0 - 1.0;
    float r = 0.55 * uCore * sqrt(max(0.0, 1.0 - z*z));
    vec3 C = vec3(cos(a)*r, z * 0.62 * uCore, sin(a)*r);
    C += 0.08 * uCore * vec3(sin(fi*3.1), cos(fi*2.3), sin(fi*4.7));
    float ang = fi * 0.7 + uTime * 0.15;
    float cs = cos(ang), sn = sin(ang);
    mat3 rot = mat3(cs, 0.0, sn, 0.0, 1.0, 0.0, -sn, 0.0, cs);
    float s = (0.11 + 0.05 * fract(fi * 0.37)) * uCore;
    vec3 lp = aPos * s;
    vW = C + rot * lp;
    vN = normalize(rot * aNrm);
    gl_Position = uVP * vec4(vW, 1.0);
    return;
  }
  vKind = 0;
  int s = id / nB; int b = id - s * nB; vStrand = s;
  float t = (float(b) + 0.5) / float(nB) * 6.2831853;
  float p = uP, q = uQ, R = uR, r0 = uRad;
  frameAt(t, p, q, R, r0, P, T, N, B);
  // pack strands around the tube in a slightly flattened ring
  float ns = float(nS);
  float ang = (float(s) + 0.15 * sin(t * 3.0 + float(s))) / ns * 6.2831853;
  float pack = r0 * 0.95;
  vec3 C = P + (N * cos(ang) + B * sin(ang)) * pack;
  // bead scale: short along the tangent so they read as segmented tiles, with a small gap
  float gap = clamp(uGap, 0.0, 0.8);
  float along = (6.2831853 * length(kn(t+0.01,p,q,R,r0) - kn(t-0.01,p,q,R,r0)) / 0.02) / float(nB);
  float halfT = along * 0.5 * (1.0 - gap) * 0.92;
  float halfW = uSize * 0.22;
  float halfH = uSize * 0.13;
  vec3 lp = aPos;
  vW = C + T * (lp.z * halfT) + N * (lp.x * halfW) + B * (lp.y * halfH);
  vN = normalize(T * (aNrm.z) + N * (aNrm.x) + B * (aNrm.y));
  gl_Position = uVP * vec4(vW, 1.0);
}`;

const SH_VS = `#version 300 es
layout(location=0) in vec3 aPos;
uniform mat4 uVP;
${KNOT_GLSL}
void main(){
  int id = gl_InstanceID;
  int nB = max(uBeads, 1), nS = max(uStrands, 1);
  int coreN = 28;
  vec3 P,T,N,B, vW;
  if (id >= nS * nB) {
    int c = id - nS * nB; float fi = float(c);
    float a = fi * 2.399963; float z = (fi + 0.5) / float(coreN) * 2.0 - 1.0;
    float r = 0.55 * uCore * sqrt(max(0.0, 1.0 - z*z));
    vec3 C = vec3(cos(a)*r, z * 0.62 * uCore, sin(a)*r);
    C += 0.08 * uCore * vec3(sin(fi*3.1), cos(fi*2.3), sin(fi*4.7));
    float ang = fi * 0.7 + uTime * 0.15; float cs = cos(ang), sn = sin(ang);
    mat3 rot = mat3(cs, 0.0, sn, 0.0, 1.0, 0.0, -sn, 0.0, cs);
    float s = (0.11 + 0.05 * fract(fi * 0.37)) * uCore;
    vW = C + rot * (aPos * s);
  } else {
    int s = id / nB; int b = id - s * nB;
    float t = (float(b) + 0.5) / float(nB) * 6.2831853;
    frameAt(t, uP, uQ, uR, uRad, P, T, N, B);
    float ns = float(nS);
    float ang = (float(s) + 0.15 * sin(t * 3.0 + float(s))) / ns * 6.2831853;
    vec3 C = P + (N * cos(ang) + B * sin(ang)) * (uRad * 0.95);
    float gap = clamp(uGap, 0.0, 0.8);
    float along = (6.2831853 * length(kn(t+0.01,uP,uQ,uR,uRad) - kn(t-0.01,uP,uQ,uR,uRad)) / 0.02) / float(nB);
    float halfT = along * 0.5 * (1.0 - gap) * 0.92;
    vW = C + T * (aPos.z * halfT) + N * (aPos.x * uSize * 0.22) + B * (aPos.y * uSize * 0.13);
  }
  gl_Position = uVP * vec4(vW, 1.0);
}`;

const SH_FS = `#version 300 es
precision highp float; out vec4 o; void main(){ o = vec4(1.0); }`;

const BACK_FS = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o;
uniform mat4 uInvVP; uniform vec3 uCamPos; uniform vec3 uCoreCol; uniform float uTime, uGrid;
${STUDIO_GLSL}
float hash21(vec2 p){ p = fract(p*vec2(73.17, 51.79)); p += dot(p, p+31.17); return fract(p.x*p.y); }
void main(){
  vec4 a = uInvVP * vec4(vUv*2.0-1.0, 1.0, 1.0);
  vec3 rd = normalize(a.xyz/a.w - uCamPos);
  vec3 col = vec3(0.0);
  // faint perspective grid on a receding floor and a far wall, inspired by a dark studio, not a copied asset
  if (uGrid > 0.001) {
    if (abs(rd.y) > 0.02) {
      float t = (-3.6 - uCamPos.y) / rd.y;
      if (t > 0.0) {
        vec3 p = uCamPos + rd * t;
        vec2 g = p.xz * 0.55;
        vec2 f = abs(fract(g) - 0.5);
        float line = 1.0 - smoothstep(0.0, 0.04, min(f.x, f.y));
        float fade = exp(-0.08 * t) * uGrid;
        col += vec3(0.10, 0.16, 0.22) * line * fade;
      }
    }
    if (abs(rd.z) > 0.02) {
      float t = (-14.0 - uCamPos.z) / rd.z;
      if (t > 0.0) {
        vec3 p = uCamPos + rd * t;
        vec2 g = p.xy * 0.45;
        vec2 f = abs(fract(g) - 0.5);
        float line = 1.0 - smoothstep(0.0, 0.04, min(f.x, f.y));
        col += vec3(0.08, 0.12, 0.18) * line * exp(-0.06*t) * uGrid * 0.7;
      }
    }
  }
  // dust motes
  vec2 uv = rd.xy / (rd.z + 1.4);
  float d = hash21(floor(uv * 90.0 + uTime * 0.05));
  if (d > 0.985) col += vec3(0.35) * (d - 0.985) * 40.0;
  // core bloom in the far field, so the crystal reads through gaps
  float core = pow(max(dot(rd, normalize(-uCamPos)), 0.0), 80.0);
  col += uCoreCol * core * 0.45;
  o = vec4(col, 1000.0);
}`;

const FS = `#version 300 es
precision highp float;
in vec3 vW; in vec3 vN; flat in int vKind; flat in int vStrand; out vec4 o;
uniform vec3 uCamPos; uniform vec3 uPal[6]; uniform vec3 uCoreCol; uniform float uGloss, uIrid, uTime;
${STUDIO_GLSL}
${PCF_GLSL}
void main(){
  vec3 N = normalize(vN); vec3 V = normalize(uCamPos - vW); if (dot(N, V) < 0.0) N = -N;
  float sh = shadowAt(vW, N);
  float ao = 0.55 + 0.45 * (0.5 + 0.5 * N.y);
  if (vKind == 1) {
    // emissive crystal, tight GGX coat
    float pulse = 0.7 + 0.3 * sin(uTime * 1.6 + float(vStrand));
    vec3 alb = uCoreCol * 0.25;
    vec3 col = studioShade(vW, N, V, alb, 0.08, vec3(0.9), ao, sh, 0.8);
    col += uCoreCol * (1.6 * pulse + 0.8 * pow(max(dot(N, V), 0.0), 3.0));
    o = vec4(col, length(uCamPos - vW));
    return;
  }
  vec3 alb = uPal[vStrand % 6];
  float rough = clamp(0.16 / max(uGloss, 0.2), 0.04, 0.4);
  vec3 f0 = mix(vec3(0.06), alb, 0.18 + 0.4 * uIrid);
  vec3 col = studioShade(vW, N, V, alb, rough, f0, ao, sh, 0.45);
  if (uIrid > 0.01) col += thinFilm(max(dot(N, V), 0.0)) * uIrid * 0.18 * alb;
  // tight coat so the beads read as wet plastic / lacquer
  col += studioShade(vW, N, V, vec3(0.0), 0.05, vec3(0.08), ao, sh, 0.0) * 0.55;
  o = vec4(col, length(uCamPos - vW));
}`;

const MAX_STRANDS = 14;
const MAX_BEADS = 280;
const CORE_N = 28;

export class BeadKnotScene implements PhysScene {
  name = 'Bead Knot'; ready = true; error: string | null = null; stats: Record<string, any> = {};
  private p: Prog; private sh: Prog; private back: Prog;
  private vao: WebGLVertexArrayObject; private nIdx: number;
  private ms: MsTarget; private sm: ShadowMap; private t = 0;
  constructor(private gl: WebGL2RenderingContext) {
    const g = unitCube();
    this.nIdx = g.idx.length;
    this.vao = gl.createVertexArray()!; gl.bindVertexArray(this.vao);
    const pb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, pb); gl.bufferData(gl.ARRAY_BUFFER, g.pos, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    const nb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, nb); gl.bufferData(gl.ARRAY_BUFFER, g.nrm, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, g.idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    this.p = compile(gl, BEAD_VS, FS, 'beadknot');
    this.sh = compile(gl, SH_VS, SH_FS, 'beadknot-shadow');
    this.back = compile(gl, QUAD_VS, BACK_FS, 'beadknot-back');
    this.ms = new MsTarget(gl, 4); this.sm = new ShadowMap(gl, 2048);
  }
  load() { this.ready = true; }
  private knotUniforms(u: Record<string, WebGLUniformLocation | null>, P: Record<string, any>, nS: number, nB: number) {
    const gl = this.gl;
    gl.uniform1f(u.uTime, this.t);
    gl.uniform1f(u.uP, P.bkP ?? 3);
    gl.uniform1f(u.uQ, P.bkQ ?? 2);
    gl.uniform1f(u.uR, 1.55);
    gl.uniform1f(u.uRad, 0.42 * (P.bkTube ?? 1));
    gl.uniform1f(u.uMorph, P.bkMorph ?? 1);
    gl.uniform1f(u.uSize, P.bkSize ?? 1);
    gl.uniform1f(u.uGap, P.bkGap ?? 0.18);
    gl.uniform1f(u.uCore, P.bkCore ?? 1);
    gl.uniform1i(u.uStrands, nS);
    gl.uniform1i(u.uBeads, nB);
  }
  render(f: PhysFrame) {
    const gl = this.gl; const P = f.params as Record<string, any>;
    if (!P.paused) this.t += Math.min(0.1, f.dt) * (P.speed ?? 1);
    const t = this.t;
    const nS = Math.max(3, Math.min(MAX_STRANDS, Math.round(P.bkStrands ?? 8)));
    const nB = Math.max(40, Math.min(MAX_BEADS, Math.round(P.bkBeads ?? 180)));
    const inst = nS * nB + CORE_N;
    const orbit = (P.bkOrbit ?? 1) * 0.18;
    const dist = 5.4;
    const eye: Vec3 = [Math.sin(t * orbit) * dist, 1.35 + Math.sin(t * orbit * 0.55) * 0.55, Math.cos(t * orbit) * dist];
    const tgt: Vec3 = [0, 0.05 * Math.sin(t * 0.23), 0];
    const view = lookAt(eye, tgt); const proj = perspective((P.fov ?? 48) * Math.PI / 180, f.aspect, 0.15, 60); const vp = mul(proj, view);
    const Ld = dirFromAzEl(P.keyAz ?? -30, P.keyEl ?? 42);
    const lview = lookAt([Ld[0] * 10, Ld[1] * 10, Ld[2] * 10], [0, 0, 0], Math.abs(Ld[1]) > 0.95 ? [0, 0, 1] : [0, 1, 0]);
    const lvp = mul(ortho(-5, 5, -5, 5, 1, 24), lview);
    const pal = KNOT_PALETTES[P.bkPalette] ?? KNOT_PALETTES['Ember Core'];
    const core = srgbHex(pal.core);
    gl.bindVertexArray(this.vao);
    this.sm.begin(); gl.disable(gl.CULL_FACE);
    gl.useProgram(this.sh.p); this.knotUniforms(this.sh.u, P, nS, nB); gl.uniformMatrix4fv(this.sh.u.uVP, false, lvp);
    gl.drawElementsInstanced(gl.TRIANGLES, this.nIdx, gl.UNSIGNED_SHORT, 0, inst);
    this.sm.end();
    this.ms.ensure(f.w, f.h); this.ms.begin(1000);
    const look = lookOf(P.look ?? 'Cobalt Orange');
    const fwd = norm([tgt[0] - eye[0], tgt[1] - eye[1], tgt[2] - eye[2]]);
    const env = { look, L: Ld, F: dirFromAzEl((P.keyAz ?? -30) + 140, 18), fwd };
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
    gl.useProgram(this.back.p); setStudioEnv(gl, this.back.u, env);
    gl.uniformMatrix4fv(this.back.u.uInvVP, false, invert(vp));
    gl.uniform3fv(this.back.u.uCamPos, eye); gl.uniform3fv(this.back.u.uCoreCol, core);
    gl.uniform1f(this.back.u.uTime, t); gl.uniform1f(this.back.u.uGrid, P.bkGrid ?? 0.7);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.depthFunc(gl.LESS); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
    const u = this.p.u; gl.useProgram(this.p.p); setStudioEnv(gl, u, env); this.knotUniforms(u, P, nS, nB);
    gl.uniformMatrix4fv(u.uVP, false, vp); gl.uniform3fv(u.uCamPos, eye);
    const pa = new Float32Array(18); pal.beads.slice(0, 6).forEach((h, i) => pa.set(srgbHex(h), i * 3));
    gl.uniform3fv(u.uPal, pa); gl.uniform3fv(u.uCoreCol, core);
    gl.uniform1f(u.uGloss, P.gloss ?? 1.2); gl.uniform1f(u.uIrid, P.irid ?? 0.35);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.sm.tex); gl.uniform1i(u.uShadow, 3);
    gl.uniformMatrix4fv(u.uLightVP, false, lvp); gl.uniform1f(u.uShadowSoft, 2.4); gl.uniform1f(u.uShadowTexel, 1 / 2048);
    gl.drawElementsInstanced(gl.TRIANGLES, this.nIdx, gl.UNSIGNED_SHORT, 0, inst);
    gl.bindVertexArray(null); gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.activeTexture(gl.TEXTURE0);
    const tex = this.ms.resolve();
    f.dof(tex, f.target, f.w, f.h, 5.2, P.dof ?? 0.18);
    this.stats = { ready: true, strands: nS, beads: nS * nB, crystals: CORE_N, tris: this.nIdx / 3 * inst };
  }
}

