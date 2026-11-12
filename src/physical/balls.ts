// Pass 4 "Gravity Fall" renderer: live BallSim (balls_sim.ts) drawn as instanced spheres in the C4D studio look:
// gloss / matte / pearl / glass balls, soft PCF shadows from a big key, per-ball directional contact occlusion,
// ball-on-wall AO splats, clay ramps & steps, satin pegs, a lacquer bowl, spinning paddles, jelly cushions that
// visibly dent and ripple, and transparent glass shelves.
// Original MIT-licensed work for flow-engine. No Shadertoy code.
import { BallSim, SLAB, type Collider, type Jelly } from './balls_sim';
import { compile, MsTarget, ShadowMap, QUAD_VS, STUDIO_GLSL, PCF_GLSL, setStudioEnv, lookOf, lin, dirFromAzEl, lookAt, perspective, ortho, mul, norm, cross, srgbHex,
  type PhysFrame, type PhysScene, type Prog, type Vec3 } from './common';

// ---------- geometry helpers ----------
type Geo = { pos: number[]; nrm: number[]; mat: number[]; idx: number[] };
const newGeo = (): Geo => ({ pos: [], nrm: [], mat: [], idx: [] });
/** Stadium (capsule profile a->b with radius r) extruded from z0 to z1 with a rounded front bevel. */
function stadium(g: Geo, ax: number, ay: number, bx: number, by: number, r: number, z0: number, z1: number, mat: number) {
  const th = Math.atan2(by - ay, bx - ax);
  const ns = 14; const loop: [number, number, number, number][] = []; // x,y,nx,ny
  for (let i = 0; i <= ns; i++) { const a = th - Math.PI / 2 + Math.PI * i / ns; loop.push([bx + Math.cos(a) * r, by + Math.sin(a) * r, Math.cos(a), Math.sin(a)]); }
  for (let i = 0; i <= ns; i++) { const a = th + Math.PI / 2 + Math.PI * i / ns; loop.push([ax + Math.cos(a) * r, ay + Math.sin(a) * r, Math.cos(a), Math.sin(a)]); }
  const n = loop.length; const bev = Math.min(0.045, r * 0.45);
  const rings: { z: number; s: number; nz: number }[] = [{ z: z0, s: 0, nz: 0 }, { z: z1 - bev, s: 0, nz: 0 }, { z: z1 - bev * 0.3, s: bev * 0.3, nz: 0.55 }, { z: z1, s: bev, nz: 1 }];
  const base = g.pos.length / 3;
  for (const R of rings) for (const [x, y, nx, ny] of loop) {
    g.pos.push(x - nx * R.s, y - ny * R.s, R.z); const k = Math.sqrt(Math.max(0, 1 - R.nz * R.nz)); g.nrm.push(nx * k, ny * k, R.nz); g.mat.push(mat);
  }
  for (let k = 0; k < rings.length - 1; k++) for (let i = 0; i < n; i++) {
    const a = base + k * n + i, b = base + k * n + (i + 1) % n, c = a + n, d = b + n;
    g.idx.push(a, b, d, a, d, c);
  }
  const cc = g.pos.length / 3; g.pos.push((ax + bx) / 2, (ay + by) / 2, z1); g.nrm.push(0, 0, 1); g.mat.push(mat);
  const last = base + (rings.length - 1) * n;
  for (let i = 0; i < n; i++) g.idx.push(cc, last + i, last + (i + 1) % n);
}
function chain(g: Geo, c: Collider, mat: number) {
  if (c.pts.length === 1) { stadium(g, c.pts[0][0], c.pts[0][1], c.pts[0][0] + 1e-4, c.pts[0][1], c.r, -SLAB - 0.05, SLAB + 0.02, mat); return; }
  for (let k = 0; k < c.pts.length - 1; k++) stadium(g, c.pts[k][0], c.pts[k][1], c.pts[k + 1][0], c.pts[k + 1][1], c.r, -SLAB - 0.05, SLAB + 0.02, mat);
}
function icosphere(sub: number) {
  const t = (1 + Math.sqrt(5)) / 2;
  let v: number[][] = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map((p) => { const l = Math.hypot(p[0], p[1], p[2]); return p.map((x) => x / l); });
  let f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let s = 0; s < sub; s++) {
    const cache = new Map<string, number>(); const nf: number[][] = [];
    const mid = (a: number, b: number) => { const k = a < b ? `${a},${b}` : `${b},${a}`; let i = cache.get(k); if (i === undefined) { const p = v[a].map((x, j) => (x + v[b][j]) / 2); const l = Math.hypot(p[0], p[1], p[2]); v.push(p.map((x) => x / l)); i = v.length - 1; cache.set(k, i); } return i; };
    for (const [a, b, c] of f) { const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); nf.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
    f = nf;
  }
  return { pos: new Float32Array(v.flat()), idx: new Uint16Array(f.flat()) };
}

// ---------- shaders ----------
const STATIC_VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm; layout(location=2) in float aMat;
uniform mat4 uVP, uModel; out vec3 vW; out vec3 vN; flat out float vMat;
void main(){ vec4 w = uModel*vec4(aPos,1.0); vW = w.xyz; vN = mat3(uModel)*aNrm; vMat = aMat; gl_Position = uVP*w; }`;
const BALL_VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=3) in vec4 iPR; layout(location=4) in vec4 iQ; layout(location=5) in vec4 iCM; layout(location=6) in vec4 iOcc;
uniform mat4 uVP; out vec3 vW; out vec3 vN; out vec3 vLocal; flat out vec4 vCM; flat out vec4 vOcc; flat out vec3 vCenter; flat out float vR;
vec3 qrot(vec4 q, vec3 v){ return v + 2.0*cross(q.xyz, cross(q.xyz, v) + q.w*v); }
void main(){ vec3 n = aPos; vec3 w = iPR.xyz + n*iPR.w; vW = w; vN = n; vLocal = qrot(vec4(-iQ.xyz, iQ.w), n); vCM = iCM; vOcc = iOcc; vCenter = iPR.xyz; vR = iPR.w; gl_Position = uVP*vec4(w,1.0); }`;
const JELLY_VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm;   // aPos: (u, cross-section y, z), aNrm: cross-section normal (0,ny,nz) + top weight in x
uniform mat4 uVP; uniform float uX0, uX1, uY, uSlope, uN; uniform float uD[96];
out vec3 vW; out vec3 vN; flat out float vMat;
float D(float u){ float x = clamp(u, 0.0, 1.0)*(uN-1.0); int k = int(floor(x)); float f = x-float(k); return mix(uD[k], uD[min(k+1, int(uN)-1)], f); }
void main(){
  float u = aPos.x; float top = aNrm.x;
  float x = mix(uX0, uX1, u);
  float d = D(u)*top;
  float du = 1.0/(uN-1.0);
  float slope = uSlope + (D(u+du)-D(u-du))*top/(2.0*du*(uX1-uX0));
  vec3 p = vec3(x, uY + uSlope*(x-uX0) + aPos.y + d, aPos.z);
  vec3 n = normalize(vec3(-slope*max(aNrm.y,0.0), aNrm.y, aNrm.z));
  vW = p; vN = n; vMat = 6.0; gl_Position = uVP*vec4(p,1.0);
}`;
const SHADOW_FS = `#version 300 es
precision highp float; out vec4 o; void main(){ o = vec4(1.0); }`;
const SURF_FS = `#version 300 es
precision highp float;
in vec3 vW; in vec3 vN; flat in float vMat; out vec4 o;
uniform vec3 uCamPos; uniform vec3 uMatCol[8]; uniform float uGloss;
${STUDIO_GLSL}
${PCF_GLSL}
void main(){
  vec3 N = normalize(vN); vec3 V = normalize(uCamPos - vW); if (dot(N,V) < 0.0) N = -N;
  int m = int(vMat+0.5);
  vec3 alb = uMatCol[m];
  // 0 ramp clay, 1 steps clay, 2 pegs satin metal, 3 bowl lacquer, 4 paddle gloss, 5 glass (unused here), 6 jelly
  float rough = m==0||m==1 ? 0.55 : m==2 ? 0.28 : m==3 ? 0.12 : m==4 ? 0.16 : 0.08;
  rough = clamp(rough/max(uGloss,0.05), 0.04, 0.9);
  vec3 f0 = vec3(0.04); if (m==2) { f0 = alb*0.9; alb *= 0.2; }
  float sh = shadowAt(vW, N);
  float ao = clamp(0.55 + 0.45*smoothstep(-${SLAB.toFixed(2)}-0.05, -${SLAB.toFixed(2)}+0.6, vW.z), 0.0, 1.0);
  vec3 col = studioShade(vW, N, V, alb, rough, f0, ao, sh, 0.3);
  if (m==6) { // jelly: translucent body glow (light scattered through the cushion)
    float back = pow(clamp(1.0-dot(N,V),0.0,1.0), 1.5);
    col = mix(col, alb*0.55 + uKeyCol*0.05, 0.25);
    col += alb*uKeyCol*0.45*(0.6+0.4*sh) + alb*back*0.45 + uRimCol*pow(1.0-max(dot(N,V),0.0), 4.0)*0.6;
  }
  o = vec4(col, length(vW-uCamPos));
}`;
const BALL_FS = `#version 300 es
precision highp float;
in vec3 vW; in vec3 vN; in vec3 vLocal; flat in vec4 vCM; flat in vec4 vOcc; flat in vec3 vCenter; flat in float vR; out vec4 o;
uniform vec3 uCamPos; uniform float uGloss, uIrid;
${STUDIO_GLSL}
${PCF_GLSL}
void main(){
  vec3 N = normalize(vN); vec3 V = normalize(uCamPos - vW);
  int m = int(vCM.a+0.5);
  vec3 alb = vCM.rgb;
  float nv = max(dot(N,V),1e-3);
  // directional contact occlusion (crowding) + contact with the back wall
  float occ = vOcc.w*clamp(dot(N, normalize(vOcc.xyz+1e-5))*0.6+0.4, 0.0, 1.0);
  float wallD = vW.z + ${SLAB.toFixed(2)};
  float ao = clamp(1.0 - 0.75*occ, 0.25, 1.0) * mix(0.55, 1.0, smoothstep(0.0, 0.5, wallD + max(-N.z,0.0)*0.0)) ;
  ao *= mix(1.0, 0.75, smoothstep(0.0, -1.0, N.z)*(1.0-smoothstep(0.0, 0.6, wallD)));
  float sh = shadowAt(vW, N);
  float rough = m==0 ? 0.13 : m==1 ? 0.6 : m==2 ? 0.22 : 0.04;
  rough = clamp(rough/max(uGloss,0.05), 0.03, 0.9);
  vec3 f0 = vec3(0.04);
  if (m==2) { vec3 film = thinFilm(nv + 0.15*vLocal.y); alb = mix(alb, alb*0.55 + film*0.6, 0.55*uIrid); f0 = mix(f0, film*0.3, uIrid); }
  vec3 col;
  if (m==3) {
    // glass: refracted (tinted) studio behind + fresnel reflection + a bright caustic core
    vec3 R = refract(-V, N, 1.0/1.5);
    vec3 trans = backdrop(normalize(R + vec3(0.0, 0.0, -0.3))) * mix(vec3(1.0), alb, 0.65);
    float F = 0.04 + 0.96*pow(1.0-nv, 5.0);
    vec3 refl = envMap(reflect(-V,N), 0.03);
    vec3 L = normalize(uLightDir);
    float caustic = pow(max(dot(-N, L), 0.0), 6.0);
    col = trans*(1.0-F)*mix(0.7, 1.0, sh)*ao + refl*F + alb*caustic*0.9*sh;
    col += uKeyCol*pow(max(dot(reflect(-L,N),V),0.0), 400.0)*6.0*sh;
  } else {
    col = studioShade(vW, N, V, alb, rough, f0, ao, sh, 0.35);
  }
  o = vec4(col, length(vW-uCamPos));
}`;
const WALL_FS = `#version 300 es
precision highp float;
in vec3 vW; in vec3 vN; flat in float vMat; out vec4 o;
uniform vec3 uCamPos; uniform sampler2D uAOTex; uniform vec4 uAORect;
${STUDIO_GLSL}
${PCF_GLSL}
void main(){
  float h = clamp((vW.y + 5.0)/11.0, 0.0, 1.0);
  vec3 base = mix(uBgBottom, uBgTop, smoothstep(0.0, 1.0, h));
  float sh = shadowAt(vW, vec3(0.0,0.0,1.0));
  vec2 auv = (vW.xy - uAORect.xy)/uAORect.zw;
  float ao = 1.0 - clamp(texture(uAOTex, auv).r, 0.0, 0.7);
  vec3 col = base*(0.62 + 0.38*sh)*ao + uBgGlow*0.4*exp(-dot(vW.xy-vec2(0.0,1.0), vW.xy-vec2(0.0,1.0))*0.02);
  o = vec4(col, length(vW-uCamPos));
}`;
const GLASS_FS = `#version 300 es
precision highp float;
in vec3 vW; in vec3 vN; flat in float vMat; out vec4 o;
uniform vec3 uCamPos;
${STUDIO_GLSL}
void main(){
  vec3 N = normalize(vN); vec3 V = normalize(uCamPos - vW); if (dot(N,V) < 0.0) N = -N;
  float nv = max(dot(N,V),1e-3);
  float F = 0.05 + 0.95*pow(1.0-nv, 4.0);
  vec3 refl = envMap(reflect(-V,N), 0.04);
  float edge = 1.0 - smoothstep(0.0, 0.6, abs(N.z));
  vec3 tint = vec3(0.85, 0.97, 1.0);
  vec3 col = refl*F + tint*0.04 + vec3(0.9,1.0,1.0)*edge*0.25;
  o = vec4(col, clamp(0.06 + F*0.5 + edge*0.2, 0.0, 0.8));
}`;
const SPLAT_VS = `#version 300 es
layout(location=0) in vec2 aQ; layout(location=3) in vec4 iPR;
uniform vec4 uAORect; out vec2 vQ; out float vI;
void main(){ float s = iPR.w*2.6; vec2 p = iPR.xy + aQ*s; vQ = aQ; float dz = iPR.z + ${SLAB.toFixed(2)} - iPR.w; vI = exp(-dz/0.28);
  gl_Position = vec4((p - uAORect.xy)/uAORect.zw*2.0-1.0, 0.0, 1.0); }`;
const SPLAT_FS = `#version 300 es
precision highp float; in vec2 vQ; in float vI; out vec4 o;
void main(){ float r2 = dot(vQ,vQ); o = vec4(vI*0.42*exp(-r2*3.2)*(1.0-smoothstep(0.8,1.0,r2)), 0.0, 0.0, 1.0); }`;

export class BallsScene implements PhysScene {
  name = 'balls'; ready = false; error: string | null = null; stats: Record<string, any> = {};
  sim = new BallSim(1100);
  private ms: MsTarget; private sm: ShadowMap;
  private pStatic: Prog; private pBall: Prog; private pJelly: Prog; private pWall: Prog; private pGlass: Prog; private pShadowS: Prog; private pShadowB: Prog; private pShadowJ: Prog; private pSplat: Prog;
  private staticVao!: WebGLVertexArrayObject; private staticCount = 0; private glassVao!: WebGLVertexArrayObject; private glassCount = 0;
  private wallVao!: WebGLVertexArrayObject; private paddles: { vao: WebGLVertexArrayObject; count: number; c: Collider }[] = [];
  private ballVao!: WebGLVertexArrayObject; private ballCount = 0; private inst!: WebGLBuffer; private instData: Float32Array;
  private jellyVao!: WebGLVertexArrayObject; private jellyCount = 0;
  private splatVao!: WebGLVertexArrayObject; private aoFB: { f: WebGLFramebuffer; t: WebGLTexture } | null = null;
  private acc = 0; private prerolled = false;
  constructor(private gl: WebGL2RenderingContext) {
    this.ms = new MsTarget(gl, 4); this.sm = new ShadowMap(gl, 2048);
    this.pStatic = compile(gl, STATIC_VS, SURF_FS, 'balls-static'); this.pBall = compile(gl, BALL_VS, BALL_FS, 'balls-ball');
    this.pJelly = compile(gl, JELLY_VS, SURF_FS, 'balls-jelly'); this.pWall = compile(gl, STATIC_VS, WALL_FS, 'balls-wall');
    this.pGlass = compile(gl, STATIC_VS, GLASS_FS, 'balls-glass'); this.pShadowS = compile(gl, STATIC_VS, SHADOW_FS, 'balls-sh-s');
    this.pShadowB = compile(gl, BALL_VS, SHADOW_FS, 'balls-sh-b'); this.pShadowJ = compile(gl, JELLY_VS, SHADOW_FS, 'balls-sh-j');
    this.pSplat = compile(gl, SPLAT_VS, SPLAT_FS, 'balls-splat');
    this.instData = new Float32Array(this.sim.N * 16);
    this.build(); this.ready = true;
  }
  load() {}
  private vaoOf(g: Geo) {
    const gl = this.gl; const vao = gl.createVertexArray()!; gl.bindVertexArray(vao);
    const vb = (d: Float32Array, loc: number, n: number) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, d, gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 0, 0); };
    vb(new Float32Array(g.pos), 0, 3); vb(new Float32Array(g.nrm), 1, 3); vb(new Float32Array(g.mat), 2, 1);
    const eb = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, eb); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(g.idx), gl.STATIC_DRAW);
    gl.bindVertexArray(null); return { vao, count: g.idx.length };
  }
  private build() {
    const gl = this.gl;
    const sg = newGeo(), gg = newGeo();
    const MAT: Record<string, number> = { ramp: 0, steps: 1, peg: 2, bowl: 3, glass: 5 };
    for (const c of this.sim.colliders) {
      if (c.kind === 'paddle') { const g = newGeo(); stadium(g, -c.len!, 0, c.len!, 0, c.r, -SLAB - 0.05, SLAB + 0.02, 4);
        // hub
        stadium(g, 0, 0, 1e-4, 0, 0.16, -SLAB - 0.05, SLAB + 0.08, 2);
        const v = this.vaoOf(g); this.paddles.push({ ...v, c }); continue; }
      chain(c.kind === 'glass' ? gg : sg, c, MAT[c.kind]);
    }
    let v = this.vaoOf(sg); this.staticVao = v.vao; this.staticCount = v.count;
    v = this.vaoOf(gg); this.glassVao = v.vao; this.glassCount = v.count;
    const wg = newGeo(); const z = -SLAB - 0.02;
    wg.pos.push(-14, -9, z, 14, -9, z, 14, 9, z, -14, 9, z); wg.nrm.push(0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1); wg.mat.push(0, 0, 0, 0); wg.idx.push(0, 1, 2, 0, 2, 3);
    v = this.vaoOf(wg); this.wallVao = v.vao;
    // balls
    const s = icosphere(3);
    this.ballVao = gl.createVertexArray()!; gl.bindVertexArray(this.ballVao);
    const pb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, pb); gl.bufferData(gl.ARRAY_BUFFER, s.pos, gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    this.inst = gl.createBuffer()!; gl.bindBuffer(gl.ARRAY_BUFFER, this.inst); gl.bufferData(gl.ARRAY_BUFFER, this.instData.byteLength, gl.DYNAMIC_DRAW);
    for (let k = 0; k < 4; k++) { gl.enableVertexAttribArray(3 + k); gl.vertexAttribPointer(3 + k, 4, gl.FLOAT, false, 64, k * 16); gl.vertexAttribDivisor(3 + k, 1); }
    const eb = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, eb); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, s.idx, gl.STATIC_DRAW); this.ballCount = s.idx.length;
    gl.bindVertexArray(null);
    // splat quads share the instance buffer (only iPR is read)
    this.splatVao = gl.createVertexArray()!; gl.bindVertexArray(this.splatVao);
    const qb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, qb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.inst); gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 64, 0); gl.vertexAttribDivisor(3, 1);
    gl.bindVertexArray(null);
    // jelly: rounded-rectangle cross-section swept along u
    const jg = newGeo(); const NU = 96, cs: [number, number, number, number, number][] = []; // y, z, ny, nz, top
    const th = 0.5, cr = 0.18, dz = SLAB + 0.02;
    const corner = (cy: number, cz: number, a0: number, top: number) => { for (let i = 0; i <= 5; i++) { const a = a0 + (Math.PI / 2) * i / 5; cs.push([cy + Math.sin(a) * cr, cz + Math.cos(a) * cr, Math.sin(a), Math.cos(a), top]); } };
    corner(th / 2 - cr, dz - cr, 0, 1);          // front-top: a=0 -> +z ... a=pi/2 -> +y
    cs.reverse();
    const cs2: typeof cs = [[th / 2, -dz, 1, 0, 1], ...cs, [-th / 2, dz, 0, 1, 0]]; // back-top, rounded front-top edge, front-bottom
    for (let i = 0; i < NU; i++) for (const [y, zz, ny, nz, top] of cs2) { jg.pos.push(i / (NU - 1), y, zz); jg.nrm.push(top, ny, nz); jg.mat.push(6); }
    const M = cs2.length;
    for (let i = 0; i < NU - 1; i++) for (let k = 0; k < M - 1; k++) { const a = i * M + k, b = a + 1, c = a + M, d = c + 1; jg.idx.push(a, c, d, a, d, b); }
    v = this.vaoOf(jg); this.jellyVao = v.vao; this.jellyCount = v.count;
  }
  private ensureAO() {
    const gl = this.gl; if (this.aoFB) return;
    const t = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, 640, 360, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const f = gl.createFramebuffer()!; gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    this.aoFB = { f, t };
  }
  private uploadInstances(): number {
    const s = this.sim, d = this.instData; let n = 0; const o2 = s.occ2;
    for (let i = 0; i < s.N; i++) if (s.alive[i]) {
      const o = n * 16;
      d[o] = s.px[i]; d[o + 1] = s.py[i]; d[o + 2] = s.pz[i]; d[o + 3] = s.r[i];
      d[o + 4] = s.q[i * 4]; d[o + 5] = s.q[i * 4 + 1]; d[o + 6] = s.q[i * 4 + 2]; d[o + 7] = s.q[i * 4 + 3];
      const c = srgbLin(s.col[i * 3]), c1 = srgbLin(s.col[i * 3 + 1]), c2 = srgbLin(s.col[i * 3 + 2]);
      d[o + 8] = c; d[o + 9] = c1; d[o + 10] = c2; d[o + 11] = s.mat[i];
      if (o2) { d[o + 12] = o2[i * 4]; d[o + 13] = o2[i * 4 + 1]; d[o + 14] = o2[i * 4 + 2]; d[o + 15] = o2[i * 4 + 3]; }
      n++;
    }
    const gl = this.gl; gl.bindBuffer(gl.ARRAY_BUFFER, this.inst); gl.bufferSubData(gl.ARRAY_BUFFER, 0, d, 0, n * 16);
    return n;
  }
  render(f: PhysFrame) {
    const gl = this.gl, P = f.params, look = lookOf(P.look);
    if (!this.prerolled) { for (let i = 0; i < 60 * 14; i++) this.sim.step(1 / 60, 4); this.prerolled = true; }
    if (!P.paused) {
      this.acc += Math.min(0.05, f.dt) * P.speed;
      let n = 0; while (this.acc >= 1 / 60 && n < 2) { this.sim.step(1 / 60, 6); this.acc -= 1 / 60; n++; }
      if (n === 2) this.acc = 0;
    }
    const nInst = this.uploadInstances();
    // camera: static, a slow breathing drift only (the motion is the balls)
    const t = f.time;
    const eye: Vec3 = [0.6 * Math.sin(t * 0.07), 0.3 + 0.2 * Math.sin(t * 0.05), 34];
    const tgt: Vec3 = [0, 0.05, 0];
    const view = lookAt(eye, tgt); const proj = perspective(16.6 * Math.PI / 180, f.aspect, 5, 80); const vp = mul(proj, view);
    const L = dirFromAzEl(P.keyAz ?? -38, P.keyEl ?? 52); const Lv: Vec3 = [L[0], L[1], Math.abs(L[2]) * 0.9 + 0.35];
    const Ld = norm(Lv);
    const lview = lookAt([Ld[0] * 20, Ld[1] * 20, Ld[2] * 20], [0, 0, 0], Math.abs(Ld[1]) > 0.95 ? [0, 0, 1] : [0, 1, 0]);
    const lvp = mul(ortho(-12, 12, -10, 10, 1, 45), lview);
    const env = { look, L: Ld, F: norm([0.7, 0.25, 0.65]) as Vec3, fwd: norm([tgt[0] - eye[0], tgt[1] - eye[1], tgt[2] - eye[2]]) as Vec3 };
    const sl = look.slots; const matCols = new Float32Array(24);
    [sl[4], sl[3], '#e8e8ee', sl[1], sl[0], '#ffffff', '#ff7fa8', '#ffffff'].forEach((h, i) => matCols.set(srgbHex(h), i * 3));
    const J0 = this.sim.jellies;
    const setJelly = (u: Record<string, WebGLUniformLocation | null>, J: Jelly) => {
      gl.uniform1f(u.uX0, J.x0); gl.uniform1f(u.uX1, J.x1); gl.uniform1f(u.uY, J.y); gl.uniform1f(u.uSlope, J.slope); gl.uniform1f(u.uN, J.n);
      const d = new Float32Array(96); d.set(J.d.subarray(0, Math.min(96, J.n))); gl.uniform1fv(u['uD[0]'], d);
    };
    const I4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const rotZ = (a: number, c: [number, number]) => [Math.cos(a), Math.sin(a), 0, 0, -Math.sin(a), Math.cos(a), 0, 0, 0, 0, 1, 0, c[0], c[1], 0, 1];
    // ---- shadow pass
    this.sm.begin(); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
    gl.useProgram(this.pShadowS.p); gl.uniformMatrix4fv(this.pShadowS.u.uVP, false, lvp); gl.uniformMatrix4fv(this.pShadowS.u.uModel, false, I4);
    gl.bindVertexArray(this.staticVao); gl.drawElements(gl.TRIANGLES, this.staticCount, gl.UNSIGNED_INT, 0);
    for (const p of this.paddles) { gl.uniformMatrix4fv(this.pShadowS.u.uModel, false, rotZ(p.c.ang!, p.c.c!)); gl.bindVertexArray(p.vao); gl.drawElements(gl.TRIANGLES, p.count, gl.UNSIGNED_INT, 0); }
    gl.useProgram(this.pShadowB.p); gl.uniformMatrix4fv(this.pShadowB.u.uVP, false, lvp);
    gl.bindVertexArray(this.ballVao); gl.drawElementsInstanced(gl.TRIANGLES, this.ballCount, gl.UNSIGNED_SHORT, 0, nInst);
    gl.useProgram(this.pShadowJ.p); gl.uniformMatrix4fv(this.pShadowJ.u.uVP, false, lvp);
    for (const J of J0) { setJelly(this.pShadowJ.u, J); gl.bindVertexArray(this.jellyVao); gl.drawElements(gl.TRIANGLES, this.jellyCount, gl.UNSIGNED_INT, 0); }
    this.sm.end();
    // ---- wall AO splats
    this.ensureAO(); const aoRect = [-12, -7, 24, 13.5];
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.aoFB!.f); gl.viewport(0, 0, 640, 360); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(this.pSplat.p); gl.uniform4fv(this.pSplat.u.uAORect, aoRect);
    gl.bindVertexArray(this.splatVao); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, nInst);
    gl.disable(gl.BLEND);
    // ---- main pass
    this.ms.ensure(f.w, f.h); this.ms.begin();
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.depthMask(true);
    const common = (pr: Prog) => {
      const u = pr.u; gl.useProgram(pr.p); setStudioEnv(gl, u, env);
      gl.uniformMatrix4fv(u.uVP, false, vp); gl.uniform3fv(u.uCamPos, eye); gl.uniform1f(u.uGloss, P.gloss ?? 1); gl.uniform1f(u.uIrid, P.irid ?? 0.8);
      if (u.uShadow !== undefined) { gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.sm.tex); gl.uniform1i(u.uShadow, 3); gl.uniformMatrix4fv(u.uLightVP, false, lvp); gl.uniform1f(u.uShadowSoft, 2.5); gl.uniform1f(u.uShadowTexel, 1 / 2048); }
      if (u['uMatCol[0]']) gl.uniform3fv(u['uMatCol[0]'], matCols);
      if (u.uModel) gl.uniformMatrix4fv(u.uModel, false, I4);
      return u;
    };
    let u = common(this.pWall); gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, this.aoFB!.t); gl.uniform1i(u.uAOTex, 4); gl.uniform4fv(u.uAORect, aoRect);
    gl.bindVertexArray(this.wallVao); gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_INT, 0);
    u = common(this.pStatic); gl.bindVertexArray(this.staticVao); gl.drawElements(gl.TRIANGLES, this.staticCount, gl.UNSIGNED_INT, 0);
    for (const p of this.paddles) { gl.uniformMatrix4fv(u.uModel, false, rotZ(p.c.ang!, p.c.c!)); gl.bindVertexArray(p.vao); gl.drawElements(gl.TRIANGLES, p.count, gl.UNSIGNED_INT, 0); }
    u = common(this.pJelly); for (const J of J0) { setJelly(u, J); gl.bindVertexArray(this.jellyVao); gl.drawElements(gl.TRIANGLES, this.jellyCount, gl.UNSIGNED_INT, 0); }
    u = common(this.pBall); gl.bindVertexArray(this.ballVao); gl.drawElementsInstanced(gl.TRIANGLES, this.ballCount, gl.UNSIGNED_SHORT, 0, nInst);
    // glass shelves last (blended, no depth write)
    gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE); gl.depthMask(false);
    u = common(this.pGlass); gl.bindVertexArray(this.glassVao); gl.drawElements(gl.TRIANGLES, this.glassCount, gl.UNSIGNED_INT, 0);
    gl.disable(gl.BLEND); gl.depthMask(true); gl.disable(gl.DEPTH_TEST);
    gl.bindVertexArray(null); gl.activeTexture(gl.TEXTURE0);
    const tex = this.ms.resolve();
    f.dof(tex, f.target, f.w, f.h, 34, P.dof ?? 0.0);
    this.stats = { balls: nInst, contacts: this.sim.stats.contacts, physicsMs: +this.sim.stats.stepMs.toFixed(2), simTime: +this.sim.t.toFixed(1) };
  }
}
function srgbLin(c: number) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
