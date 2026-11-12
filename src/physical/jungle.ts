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
uniform vec3 uCamPos; uniform vec3 uHaze, uCore; uniform float uMat, uIrid, uHazeK, uSat;
${STUDIO_GLSL}
vec3 unpackC(float v){ float r = floor(v/65536.0); float g = floor((v - r*65536.0)/256.0); float b = v - r*65536.0 - g*256.0; vec3 c = vec3(r, g, b)/255.0; return c*(c*(c*0.305306 + 0.682171) + 0.012522); }
float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float cellEdge(vec2 p){ vec2 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
  for (int y=-1; y<=1; y++) for (int x=-1; x<=1; x++){ vec2 g = vec2(x,y); vec2 o2 = vec2(h21(i+g), h21(i+g+7.1)); float d = length(g + o2 - f); if (d < d1){ d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
  return d2 - d1; }
void main(){
  vec3 N = normalize(vN); vec3 V = normalize(uCamPos - vW); bool back = dot(N,V) < 0.0; if (back) N = -N;
  vec3 tipC = unpackC(vInst.x), baseC = unpackC(vInst.y);
  vec3 alb; float rough; float trans; float sheen = 0.0;
  if (vPart < 0.5) {               // petal / bract: base->tip gradient, fan venation from the base, darker throat, lip tone
    float t = vBend;
    alb = mix(baseC, tipC, smoothstep(0.02, 0.75, t));
    vec2 q = vec2((vUV.x - 0.5)*2.0, vUV.y);
    float fan = atan(q.x*0.9, q.y + 0.08);
    float vein = pow(1.0 - abs(sin(fan*13.0)), 14.0) * smoothstep(0.04, 0.4, t) * (1.0 - smoothstep(0.85, 1.0, t));
    float vein2 = pow(1.0 - abs(sin(fan*39.0 + t*2.0)), 18.0) * smoothstep(0.2, 0.7, t) * 0.5;
    alb = mix(alb, baseC*0.85, 0.35*vein + 0.15*vein2);
    alb *= mix(0.62, 1.0, smoothstep(0.0, 0.22, t));
    if (vTone > 0.9) alb = mix(baseC*0.7, vec3(1.0, 0.82, 0.25), smoothstep(0.55, 0.95, t)*0.6);       // orchid lip
    float speck = step(0.93, h21(floor(vUV*vec2(22.0, 30.0)))) * (1.0 - smoothstep(0.1, 0.45, t)) * step(0.5, vTone + 0.6);
    alb = mix(alb, baseC*0.45, speck*0.6);
    rough = 0.38; trans = 0.85; sheen = 0.35;
  } else if (vPart < 1.5) {        // centre / stamens / column
    alb = mix(vec3(0.2, 0.08, 0.02), vec3(1.0, 0.78, 0.2), vTone*0.8 + 0.2*vBend); rough = 0.45; trans = 0.15;
  } else if (vPart < 2.5) {        // leaf: midrib, secondary + reticulate veins, lighter margin, colour drift
    float ax = abs(vUV.x - 0.5);
    float mid = 1.0 - smoothstep(0.0, 0.022, ax);
    float sec = (1.0 - smoothstep(0.0, 0.06, abs(fract(vUV.y*10.0 - ax*3.5) - 0.5)*2.0 - 0.88)) * smoothstep(0.03, 0.08, ax) * (1.0 - smoothstep(0.43, 0.5, ax));
    vec2 rq = vec2(vUV.x*26.0, vUV.y*48.0); float ret = (1.0 - smoothstep(0.0, 0.12, abs(fract(rq.x + 0.35*sin(rq.y*1.7)) - 0.5)*2.0 - 0.8)) * (1.0 - smoothstep(0.0, 0.12, abs(fract(rq.y + 0.35*sin(rq.x*1.3)) - 0.5)*2.0 - 0.8));
    alb = mix(baseC, tipC, smoothstep(0.0, 1.0, vBend*0.8 + 0.25*ax));
    alb *= 1.0 + 0.55*mid + 0.22*sec + 0.08*ret;
    alb *= 1.0 - 0.18*smoothstep(0.38, 0.5, ax)*(1.0 - vTone);       // darker margin
    rough = 0.5; trans = 0.7; sheen = 0.25;
  } else { alb = baseC*0.7; rough = 0.5; trans = 0.2; }
  float ao = pow(clamp(vAO, 0.0, 1.0), 1.4);
  float nv = max(dot(N,V), 1e-3);
  vec3 f0 = vec3(0.04);
  if (uMat > 1.5) { vec3 film = thinFilm(nv + 0.2*vBend); alb = mix(alb, alb*0.5 + film*0.6, 0.5*uIrid); f0 = mix(f0, film*0.25, uIrid); }
  vec3 col = studioShade(vW, N, V, alb, rough, f0*(vPart > 1.5 ? 0.6 : 1.0), ao, 1.0, vPart > 1.5 ? 0.08 : 0.18);
  vec3 L = normalize(uLightDir);
  float bl = max(-dot(N, L), 0.0) + 0.35*max(dot(V, L)*-1.0, 0.0);
  vec3 tcol = vPart < 1.5 ? alb*1.15 : alb*vec3(1.05, 1.25, 0.55);                // leaves transmit warm yellow-green
  col += tcol*uKeyCol*uKeyI*bl*trans*0.9*mix(0.5, 1.0, ao);
  col += uKeyCol*sheen*0.12*pow(1.0 - nv, 3.0)*ao;                                // waxy / velvet sheen at grazing angles
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722)); col = max(mix(vec3(lum), col, uSat), 0.0);
  float dist = length(vW - uCamPos);
  float haze = 1.0 - exp(-max(dist - 9.0, 0.0)*uHazeK);
  vec3 rd = -V; float core = exp(-dot(rd.xy, rd.xy)*30.0);
  col = mix(col, mix(uHaze, uCore, core*0.6), haze);
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
  private loading = false; private totalInst = 0; private totalTris = 0; private look = 'Natural'; private lookSlots: string[] = [];
  constructor(private gl: WebGL2RenderingContext, private base = '/pass4', private count = 3000) {
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
      // instances, grouped per prototype. Natural growth: clumps on the spiral arms (a few big leaves + smaller
      // flowers around them), log-normal scale variety, species-true colours (packed sRGB per instance)
      const protos = meta.protos as any[];
      let seed = 1234; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      const D = 56; const pk = (h: string) => parseInt(h.slice(1), 16);
      const natural = this.look === 'Natural';
      const SPECIES: Record<string, [string, string][]> = {
        orchid: [['#fbf4ff', '#c2378a'], ['#f58ac8', '#9c1f62'], ['#fff6e6', '#e0567a']],
        hibiscus: [['#ff3b3b', '#7a0a24'], ['#ff7a52', '#9a1030'], ['#ffb347', '#c0202a'], ['#ff5aa8', '#7a0c40']],
        heliconia: [['#ffd23a', '#e0202a'], ['#ffe066', '#ff4a1a']],
        plumeria: [['#fffaf0', '#ffbf2a'], ['#ff9cbc', '#ffcf5a'], ['#fff2e0', '#ff8a5a']],
        bromeliad: [['#ff2d55', '#ff8a3a'], ['#ff5a1f', '#ffc23a']],
        monstera: [['#1f7a34', '#06381c']], palm: [['#3f9a24', '#0f4a1a']], banana: [['#5fb02a', '#1a5a1c']],
        alocasia: [['#1a5a36', '#041f14']], fern: [['#4aa82a', '#0f5a1c']],
      };
      const lookHex = this.lookSlots;
      const share: Record<string, number> = { orchid: 0.08, hibiscus: 0.07, heliconia: 0.06, plumeria: 0.08, bromeliad: 0.05, monstera: 0.15, palm: 0.13, banana: 0.12, alocasia: 0.11, fern: 0.15 };
      const nClumps = Math.round(this.count / 9); const clumps: [number, number, number][] = [];
      for (let c = 0; c < nClumps; c++) clumps.push([1.6 + Math.pow(rnd(), 0.6) * 7.2, rnd() * Math.PI * 2, rnd() * D]);
      const instAll: number[] = []; let ioff = 0;
      for (const p of protos) {
        const n = Math.round(this.count * (share[p.name] ?? 0.1)); const isLeaf = p.kind === 'leaf';
        const big = ['monstera', 'palm', 'banana', 'alocasia'].includes(p.name);
        for (let i = 0; i < n; i++) {
          const cl = clumps[Math.floor(rnd() * clumps.length)];
          const R = Math.max(1.2, cl[0] + (rnd() - 0.5) * (isLeaf ? 1.6 : 1.0)); const th = cl[1] + (rnd() - 0.5) * 0.5 / Math.max(1, cl[0] * 0.25); const d0 = (cl[2] + (rnd() - 0.5) * 3.0 + D) % D;
          const ln = Math.exp((rnd() + rnd() + rnd() - 1.5) * 0.45);
          const sc = (big ? 0.95 : isLeaf ? 0.7 : 0.48) * ln / Math.max(0.8, p.radius * 0.6);
          let tip: string, base: string;
          if (natural) { const opts = SPECIES[p.name] ?? [['#ff6688', '#aa2244']]; [tip, base] = opts[Math.floor(rnd() * opts.length)]; }
          else if (isLeaf) { tip = lookHex[(i % 3) + 3] ?? '#7fcfb3'; base = '#3f9a86'; }
          else { tip = lookHex[Math.floor(rnd() * lookHex.length)]; base = lookHex[Math.floor(rnd() * lookHex.length)]; }
          instAll.push(R, th, d0, sc, rnd(), rnd(), rnd(), rnd(), pk(tip), pk(base), isLeaf ? 1 : 0, rnd());
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
    const want = P.mat || 'Natural';
    if (this.ready && want !== this.look) { for (const d of this.draws) gl.deleteVertexArray(d.vao); this.look = want; this.lookSlots = look.slots; this.ready = false; this.draws = []; }
    if (!this.ready) { this.look = want; this.lookSlots = look.slots; void this.load(); const c = srgbHex(look.bgBottom); gl.bindFramebuffer(gl.FRAMEBUFFER, f.target); gl.viewport(0, 0, f.w, f.h); gl.clearColor(c[0], c[1], c[2], 1); gl.clear(gl.COLOR_BUFFER_BIT); return; }
    const canopy = P.variant === 'Canopy';
    const eye: Vec3 = [0.15 * Math.sin(f.time * 0.11), 0.1 * Math.sin(f.time * 0.07), 0];
    const tgt: Vec3 = [0, canopy ? -0.6 : 0, -10];
    const view = lookAt(eye, tgt, [Math.sin(f.time * 0.03) * 0.15, 1, 0]); const proj = perspective((P.fov ?? 62) * Math.PI / 180, f.aspect, 0.1, 80); const vp = mul(proj, view);
    const L = dirFromAzEl(P.keyAz ?? -30, P.keyEl ?? 55); const Ld = norm([L[0], L[1], -Math.abs(L[2]) * 0.6 + 0.4]);
    const env = { look, L: Ld, F: norm([-Ld[0], 0.2, 0.7]) as Vec3, fwd: [0, 0, -1] as Vec3 };
    const natural = P.mat === 'Natural' || !P.mat;
    const haze = natural ? lin('#0b2a22') : lin(look.bgBottom, 0.55); const core = natural ? lin('#ffd98a', 0.85) : lin(look.glow, 1.1); const edge = natural ? lin('#03100c') : lin(look.bgTop, 0.4);
    this.ms.ensure(f.w, f.h); this.ms.begin();
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.BLEND);
    gl.useProgram(this.back.p); gl.uniform3fv(this.back.u.uHaze, haze); gl.uniform3fv(this.back.u.uCore, core); gl.uniform3fv(this.back.u.uEdge, edge);
    gl.uniform1f(this.back.u.uAspect, f.aspect); gl.uniform1f(this.back.u.uTime, f.time);
    gl.bindVertexArray(this.emptyVao); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.depthFunc(gl.LESS); gl.disable(gl.CULL_FACE);
    const u = this.prog.u; gl.useProgram(this.prog.p); setStudioEnv(gl, u, env);
    if (natural) { gl.uniform3fv(u.uBgTop, lin('#2f6a52')); gl.uniform3fv(u.uBgBottom, lin('#0b2a22')); gl.uniform3fv(u.uDomeCol, lin('#a9d6b8')); gl.uniform3fv(u.uKeyCol, lin('#fff0d0')); gl.uniform1f(u.uKeyI, 1.6); gl.uniform1f(u.uDomeI, 0.45); }
    gl.uniformMatrix4fv(u.uVP, false, vp); gl.uniform3fv(u.uCamPos, eye);
    gl.uniform1f(u.uTime, f.time); gl.uniform1f(u.uFlow, 2.2); gl.uniform1f(u.uSpin, 0.32); gl.uniform1f(u.uTwist, 0.09); gl.uniform1f(u.uDepth, 56); gl.uniform1f(u.uCanopy, canopy ? 1 : 0);
    gl.uniform3fv(u.uHaze, haze); gl.uniform3fv(u.uCore, core); gl.uniform1f(u.uHazeK, 0.022); gl.uniform1f(u.uSat, 1.25);
    gl.uniform1f(u.uMat, ['Natural', 'Pastel', 'Iridescent'].indexOf(P.mat)); gl.uniform1f(u.uIrid, P.irid ?? 0.8);
    for (const d of this.draws) { gl.bindVertexArray(d.vao); gl.drawElementsInstanced(gl.TRIANGLES, d.iCount, gl.UNSIGNED_INT, d.iOff * 4, d.inst); }
    gl.bindVertexArray(null); gl.disable(gl.DEPTH_TEST);
    const tex = this.ms.resolve();
    f.dof(tex, f.target, f.w, f.h, 7.0, P.dof ?? 0.35);
    this.stats = { instances: this.totalInst, prototypes: this.draws.length, trisPerFrame: this.totalTris };
  }
}
