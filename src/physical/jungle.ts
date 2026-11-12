// Pass 4 "Jungle / Flower Vortex": thousands of instances of Blender-authored flora (tools/blender/pass4/jungle_flora.py:
// 6 flowers + 4 leaves, Cycles AO in the vertices) swirling in a spiral vortex around a static camera. Everything
// moves on the GPU: the field flows toward the camera along spiral arms (periodic in depth, so it loops forever),
// petals open and close around their hinges, leaves sway and flutter. Shading: satin petals with veins and back-lit
// translucency, waxy leaves with midrib + secondary veins, baked AO, depth haze into a glowing vortex core, DOF.
// Original MIT-licensed work for flow-engine. No Shadertoy code.
import { compile, MsTarget, QUAD_VS, STUDIO_GLSL, setStudioEnv, lookOf, lin, dirFromAzEl, lookAt, perspective, mul, norm, srgbHex,
  type PhysFrame, type PhysScene, type Prog, type Vec3 } from './common';

const VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm; layout(location=2) in vec2 aUV; layout(location=3) in vec4 aAttr; layout(location=4) in vec2 aToneAO;
layout(location=5) in vec4 iA; layout(location=6) in vec4 iB; layout(location=7) in vec4 iC;
uniform mat4 uVP; uniform float uTime, uFlow, uSpin, uTwist, uDepth, uLeaf, uCanopy;
out vec3 vW; out vec3 vN; out vec2 vUV; flat out float vPart; out float vBend; out float vTone; out float vAO; flat out vec4 vInst; out float vDist;
vec3 rotA(vec3 v, vec3 k, float a){ float c=cos(a), s=sin(a); return v*c + cross(k,v)*s + k*dot(k,v)*(1.0-c); }
void main(){
  float R = iA.x, th0 = iA.y, d0 = iA.z, sc = iA.w;
  float roll = iB.x, tilt = iB.y, ph = iB.z, sv = iB.w;
  float D = uDepth;
  float d = mod(d0 - uTime*uFlow*(0.75 + 0.5*sv), D) - 4.0;                 // depth in front of the camera (wraps behind it)
  float th = th0 + uTime*uSpin*(0.35 + 1.4/(R+0.6)) + d*uTwist;             // spiral arms: angle grows with depth
  vec3 radial = vec3(cos(th), sin(th), 0.0);
  vec3 c = vec3(R*radial.xy, -d);
  if (uCanopy > 0.5) { c = vec3(R*1.6*cos(th0) + sin(uTime*0.05+th0)*0.6, -3.0 + 0.9*sin(th0*3.0) + R*0.25, -d); radial = vec3(0.0,-1.0,0.0); }
  // orientation: flowers face the vortex axis / camera; leaves lie along the spiral tangent with their face to the axis
  vec3 tang = normalize(vec3(-radial.y, radial.x, 0.0)*sign(uSpin+1e-4) + vec3(0.0, 0.0, 0.35));
  vec3 Y, Z;
  if (iC.z < 0.5) { Y = normalize(-radial*0.85 + vec3(0.0,0.0,0.75) + 0.35*vec3(sin(roll*3.1), cos(tilt*2.3), sin(ph))); Z = normalize(cross(Y, tang + vec3(0.001))); Z = normalize(cross(cross(Y, Z), Y)); }
  else { Z = tang; Y = normalize(-radial - Z*dot(-radial, Z)); }
  Z = rotA(Z, Y, roll*6.2831); vec3 X = cross(Y, Z);
  if (iC.z > 0.5) { // leaf: tilt around its own length + droop variety
    Y = rotA(Y, Z, tilt*0.9-0.45); X = cross(Y, Z);
  }
  float s = sc*(0.55 + 0.11*R) * smoothstep(-4.0, -1.5, d) * (1.0 - smoothstep(D-12.0, D-4.5, d));
  vec3 p = aPos, n = aNrm;
  float part = aAttr.x, bend = aAttr.y;
  if (part < 0.5) { // petals open and close around their hinge (progressive curl toward the tip)
    float open = 0.5 + 0.5*sin(uTime*0.55*(0.7+0.6*sv) + ph*6.2831);
    vec3 ax = normalize(vec3(aAttr.w, 0.0, -aAttr.z));
    float a = -(1.0-open)*0.95*bend;
    p = rotA(p, ax, a); n = rotA(n, ax, a);
  } else if (part > 1.5 && part < 2.5) { // leaves sway and flutter along their length
    float sw = sin(uTime*1.6*(0.8+0.4*sv) + ph*6.2831 + p.z*1.7)*0.22*bend*bend;
    p = rotA(p, vec3(1.0,0.0,0.0), sw); n = rotA(n, vec3(1.0,0.0,0.0), sw);
    float tw = sin(uTime*2.3 + ph*9.0 + p.z*3.0)*0.12*bend;
    p = rotA(p, vec3(0.0,0.0,1.0), tw); n = rotA(n, vec3(0.0,0.0,1.0), tw);
  }
  vec3 w = c + (X*p.x + Y*p.y + Z*p.z)*s;
  vW = w; vN = X*n.x + Y*n.y + Z*n.z; vUV = aUV; vPart = part; vBend = bend; vTone = aToneAO.x; vAO = aToneAO.y; vInst = iC; vDist = d;
  gl_Position = uVP*vec4(w, 1.0);
}`;
const FS = `#version 300 es
precision highp float;
in vec3 vW; in vec3 vN; in vec2 vUV; flat in float vPart; in float vBend; in float vTone; in float vAO; flat in vec4 vInst; in float vDist;
out vec4 o;
uniform vec3 uCamPos; uniform vec3 uPal[7]; uniform vec3 uLeafCol[4]; uniform vec3 uHaze, uCore; uniform float uMat, uIrid, uHazeK;
${STUDIO_GLSL}
void main(){
  vec3 N = normalize(vN); vec3 V = normalize(uCamPos - vW); if (dot(N,V) < 0.0) N = -N;
  int ia = int(vInst.x), ib = int(vInst.y);
  vec3 alb; float rough; float trans;
  if (vPart < 0.5) {               // petal: base->tip gradient, fine longitudinal veins, darker throat
    vec3 a = uPal[ia%7], b = uPal[ib%7];
    alb = mix(b*0.8, a, smoothstep(0.0, 0.85, vBend));
    alb = mix(alb, alb*vec3(1.05,0.95,1.0), vTone*0.4);
    float vein = pow(1.0 - abs(sin(vUV.x*3.14159*11.0)), 10.0) * smoothstep(0.05, 0.6, vBend);
    alb *= 1.0 - 0.16*vein; alb *= mix(0.55, 1.0, smoothstep(0.0, 0.25, vBend));
    rough = 0.42; trans = 0.75;
  } else if (vPart < 1.5) {        // centre / stamens
    alb = mix(vec3(0.16,0.07,0.02), vec3(1.0,0.72,0.16), vTone*0.8 + 0.2*vBend); rough = 0.5; trans = 0.1;
  } else if (vPart < 2.5) {        // leaf: midrib + secondary veins, lighter margin
    vec3 g = uLeafCol[int(vInst.w*3.99)];
    float ax = abs(vUV.x-0.5);
    float mid = 1.0 - smoothstep(0.0, 0.025, ax);
    float sec = (1.0 - smoothstep(0.0, 0.05, abs(fract(vUV.y*9.0 - ax*4.0) - 0.5)*2.0 - 0.9)) * smoothstep(0.04, 0.1, ax) * (1.0-smoothstep(0.42,0.5,ax));
    alb = g * (0.85 + 0.25*vBend) * (1.0 + 0.45*mid + 0.18*sec);
    rough = 0.32; trans = 0.55;
  } else { alb = uLeafCol[1]*0.8; rough = 0.5; trans = 0.2; }
  float ao = pow(clamp(vAO, 0.0, 1.0), 1.3);
  float nv = max(dot(N,V), 1e-3);
  vec3 f0 = vec3(0.04);
  if (uMat > 1.5) { vec3 film = thinFilm(nv + 0.2*vBend); alb = mix(alb, alb*0.5 + film*0.6, 0.5*uIrid); f0 = mix(f0, film*0.25, uIrid); }
  vec3 col = studioShade(vW, N, V, alb, rough, f0, ao, 1.0, 0.25);
  vec3 L = normalize(uLightDir);
  col += alb*uKeyCol*uKeyI*max(-dot(N, L), 0.0)*trans*0.8*ao;            // light through thin petals / leaves
  float dist = length(vW - uCamPos);
  float haze = 1.0 - exp(-max(dist - 2.0, 0.0)*uHazeK);
  vec3 rd = -V; float core = exp(-dot(rd.xy, rd.xy)*14.0);
  col = mix(col, mix(uHaze, uCore, core), haze);
  o = vec4(col, dist);
}`;
const BACK_FS = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o; uniform vec3 uHaze, uCore, uEdge; uniform float uAspect, uTime;
void main(){ vec2 p = (vUv*2.0-1.0)*vec2(uAspect, 1.0); float r = length(p);
  float rays = 0.5 + 0.5*sin(atan(p.y, p.x)*9.0 + uTime*0.2 + r*3.0);
  vec3 c = mix(uHaze, uCore, exp(-r*r*3.0)); c = mix(c, uEdge, smoothstep(0.5, 1.6, r)); c += uCore*0.06*rays*exp(-r*1.5);
  o = vec4(c, 1000.0); }`;

export class JungleScene implements PhysScene {
  name = 'jungle'; ready = false; error: string | null = null; stats: Record<string, any> = {};
  private prog: Prog; private back: Prog; private ms: MsTarget; private emptyVao: WebGLVertexArrayObject;
  private draws: { vao: WebGLVertexArrayObject; iOff: number; iCount: number; inst: number; name: string; tris: number }[] = [];
  private loading = false; private totalInst = 0; private totalTris = 0;
  constructor(private gl: WebGL2RenderingContext, private base = '/pass4', private count = 4400) {
    this.prog = compile(gl, VS, FS, 'jungle'); this.back = compile(gl, QUAD_VS, BACK_FS, 'jungle-back');
    this.ms = new MsTarget(gl, 4); this.emptyVao = gl.createVertexArray()!;
  }
  async load() {
    if (this.ready || this.loading) return; this.loading = true;
    try {
      const [meta, buf] = await Promise.all([
        fetch(`${this.base}/jungle.json`).then((r) => { if (!r.ok) throw new Error(`jungle.json HTTP ${r.status}`); return r.json(); }),
        fetch(`${this.base}/jungle.bin`).then((r) => { if (!r.ok) throw new Error(`jungle.bin HTTP ${r.status}`); return r.arrayBuffer(); }),
      ]);
      const gl = this.gl;
      const vdata = new Float32Array(buf, 0, meta.vertexBytes / 4); const idata = new Uint32Array(buf, meta.vertexBytes, meta.indexCount);
      const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, vdata, gl.STATIC_DRAW);
      const eb = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, eb); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idata, gl.STATIC_DRAW);
      // instances, grouped per prototype: flowers 40 %, leaves 60 %
      const protos = meta.protos as any[]; const flowers = protos.filter((p) => p.kind === 'flower'), leaves = protos.filter((p) => p.kind === 'leaf');
      let seed = 1234; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      const D = 56; const per: Record<string, number> = {};
      for (const p of flowers) per[p.name] = Math.round(this.count * 0.4 / flowers.length);
      for (const p of leaves) per[p.name] = Math.round(this.count * 0.6 / leaves.length * (p.name === 'fern' ? 0.7 : p.name === 'banana' ? 1.2 : 1));
      const instAll: number[] = []; let ioff = 0;
      for (const p of protos) {
        const n = per[p.name]; const isLeaf = p.kind === 'leaf';
        for (let i = 0; i < n; i++) {
          const R = 1.3 + Math.pow(rnd(), 0.7) * 7.5; const th = rnd() * Math.PI * 2; const d0 = rnd() * D;
          const sc = (isLeaf ? 0.75 : 0.5) * (0.7 + 0.6 * rnd()) / Math.max(0.8, p.radius * 0.6);
          const fi = Math.floor(rnd() * 7); let fj = Math.floor(rnd() * 7); if (fj === fi) fj = (fj + 3) % 7;
          instAll.push(R, th, d0, sc, rnd(), rnd(), rnd(), rnd(), fi, fj, isLeaf ? 1 : 0, rnd());
        }
        const vao = gl.createVertexArray()!; gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, vb); const S = meta.stride * 4; const vo = p.vOff * S;
        gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, S, vo);
        gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, S, vo + 12);
        gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, S, vo + 24);
        gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, S, vo + 32);
        gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 2, gl.FLOAT, false, S, vo + 48);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, eb);
        this.draws.push({ vao, iOff: p.iOff, iCount: p.iCount, inst: n, name: p.name, tris: p.tris });
        (this.draws[this.draws.length - 1] as any).instStart = ioff; ioff += n;
      }
      const ib = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, ib); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(instAll), gl.STATIC_DRAW);
      for (const d of this.draws) {
        gl.bindVertexArray(d.vao); const st = (d as any).instStart * 48;
        for (let k = 0; k < 3; k++) { gl.enableVertexAttribArray(5 + k); gl.vertexAttribPointer(5 + k, 4, gl.FLOAT, false, 48, st + k * 16); gl.vertexAttribDivisor(5 + k, 1); }
      }
      gl.bindVertexArray(null);
      this.totalInst = ioff; this.totalTris = this.draws.reduce((a, d) => a + d.inst * d.tris, 0);
      this.ready = true;
      console.log(`Jungle: ${protos.length} prototypes, ${this.totalInst} instances, ${(this.totalTris / 1e6).toFixed(1)}M tris/frame`);
    } catch (e) { this.error = e instanceof Error ? e.message : String(e); console.warn('Jungle load failed: ' + this.error); }
    finally { this.loading = false; }
  }
  render(f: PhysFrame) {
    const gl = this.gl, P = f.params, look = lookOf(P.look);
    if (!this.ready) { void this.load(); const c = srgbHex(look.bgBottom); gl.bindFramebuffer(gl.FRAMEBUFFER, f.target); gl.viewport(0, 0, f.w, f.h); gl.clearColor(c[0], c[1], c[2], 1); gl.clear(gl.COLOR_BUFFER_BIT); return; }
    const canopy = P.variant === 'Canopy';
    const eye: Vec3 = [0.15 * Math.sin(f.time * 0.11), 0.1 * Math.sin(f.time * 0.07), 0];
    const tgt: Vec3 = [0, canopy ? -0.6 : 0, -10];
    const view = lookAt(eye, tgt, [Math.sin(f.time * 0.03) * 0.15, 1, 0]); const proj = perspective((P.fov ?? 62) * Math.PI / 180, f.aspect, 0.1, 80); const vp = mul(proj, view);
    const L = dirFromAzEl(P.keyAz ?? -30, P.keyEl ?? 55); const Ld = norm([L[0], L[1], -Math.abs(L[2]) * 0.6 + 0.4]);
    const env = { look, L: Ld, F: norm([-Ld[0], 0.2, 0.7]) as Vec3, fwd: [0, 0, -1] as Vec3 };
    const natural = P.mat === 'Natural' || !P.mat;
    const haze = natural ? lin('#163a33') : lin(look.bgBottom, 0.9); const core = natural ? lin('#fff1c9', 1.6) : lin(look.glow, 1.6); const edge = natural ? lin('#071512') : lin(look.bgTop, 0.7);
    this.ms.ensure(f.w, f.h); this.ms.begin();
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.BLEND);
    gl.useProgram(this.back.p); gl.uniform3fv(this.back.u.uHaze, haze); gl.uniform3fv(this.back.u.uCore, core); gl.uniform3fv(this.back.u.uEdge, edge);
    gl.uniform1f(this.back.u.uAspect, f.aspect); gl.uniform1f(this.back.u.uTime, f.time);
    gl.bindVertexArray(this.emptyVao); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.depthFunc(gl.LESS); gl.disable(gl.CULL_FACE);
    const u = this.prog.u; gl.useProgram(this.prog.p); setStudioEnv(gl, u, env);
    if (natural) { gl.uniform3fv(u.uBgTop, lin('#3f7a68')); gl.uniform3fv(u.uBgBottom, lin('#12332b')); gl.uniform3fv(u.uDomeCol, lin('#cfe9d9')); gl.uniform3fv(u.uKeyCol, lin('#fff2d8')); }
    gl.uniformMatrix4fv(u.uVP, false, vp); gl.uniform3fv(u.uCamPos, eye);
    gl.uniform1f(u.uTime, f.time); gl.uniform1f(u.uFlow, 2.2); gl.uniform1f(u.uSpin, 0.32); gl.uniform1f(u.uTwist, 0.09); gl.uniform1f(u.uDepth, 56); gl.uniform1f(u.uCanopy, canopy ? 1 : 0);
    const pal = new Float32Array(21);
    const flowerHex = natural ? ['#ff3d6e', '#ff8a3d', '#ffd23f', '#e8f0ff', '#c13bff', '#ff6fb5', '#ff4a2a'] : look.slots;
    flowerHex.forEach((h, i) => pal.set(srgbHex(h), i * 3)); gl.uniform3fv(u['uPal[0]'], pal);
    const leafHex = natural ? ['#0f7a3a', '#22a04a', '#52c24f', '#0b5a3c'] : ['#5fb39a', '#7fcfb3', '#3f9a86', '#a6e3c9'];
    const lf = new Float32Array(12); leafHex.forEach((h, i) => lf.set(srgbHex(h), i * 3)); gl.uniform3fv(u['uLeafCol[0]'], lf);
    gl.uniform3fv(u.uHaze, haze); gl.uniform3fv(u.uCore, core); gl.uniform1f(u.uHazeK, 0.03);
    gl.uniform1f(u.uMat, ['Natural', 'Pastel', 'Iridescent'].indexOf(P.mat)); gl.uniform1f(u.uIrid, P.irid ?? 0.8);
    for (const d of this.draws) { gl.bindVertexArray(d.vao); gl.drawElementsInstanced(gl.TRIANGLES, d.iCount, gl.UNSIGNED_INT, d.iOff * 4, d.inst); }
    gl.bindVertexArray(null); gl.disable(gl.DEPTH_TEST);
    const tex = this.ms.resolve();
    f.dof(tex, f.target, f.w, f.h, 7.0, P.dof ?? 0.35);
    this.stats = { instances: this.totalInst, prototypes: this.draws.length, trisPerFrame: this.totalTris };
  }
}
