// Pass 5 "City Vortex": an abstract city wrapped around the camera. The city floor is curled into a cylinder
// (radius RW) that flows toward the camera and turns slowly; streets spiral along it, glass towers stand on it
// pointing at the axis, taxis and buses drive their lanes, traffic lights cycle, lamps and windows glow, and a few
// props tumble through the open core. Everything is GPU-instanced from a Blender-authored kit
// (tools/blender/pass5/city_parts.py, Cycles AO in the vertices). The layout is periodic in depth and the
// spiral twist is chosen so a full depth period maps streets onto streets, so it loops forever.
// Glass: Schlick fresnel between a procedural sky/skyline environment and a lit-window interior with mullions and
// spandrels; GGX key highlight. Original MIT-licensed work for flow-engine. No Shadertoy code.
import { compile, MsTarget, QUAD_VS, STUDIO_GLSL, setStudioEnv, lookOf, lin, dirFromAzEl, lookAt, perspective, mul, norm,
  type PhysFrame, type PhysScene, type Prog, type Vec3 } from './common';

const RW = 9.0, D = 56.0, NS = 6;
const TWIST = (2 * Math.PI / NS) * 2 / D;

const VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm; layout(location=2) in vec2 aUV; layout(location=3) in vec4 aAttr; layout(location=4) in vec2 aToneAO;
layout(location=5) in vec4 iA; layout(location=6) in vec4 iB; layout(location=7) in vec4 iC;
uniform mat4 uVP; uniform float uTime, uFlow, uSpin;
out vec3 vW; out vec3 vN; out vec2 vUV; flat out float vPart; flat out float vCode; out float vTone; out float vAO; flat out vec4 vInst; out vec3 vL;
const float RW = ${RW.toFixed(1)}, D = ${D.toFixed(1)}, TW = ${TWIST.toFixed(6)};
vec3 rotA(vec3 v, vec3 k, float a){ float c=cos(a), s=sin(a); return v*c + cross(k,v)*s + k*dot(k,v)*(1.0-c); }
void frameAt(float th, float d, out vec3 X, out vec3 Y, out vec3 Z){
  vec3 rad = vec3(cos(th), sin(th), 0.0);
  Y = -rad;                                                     // "up" points at the vortex axis
  Z = normalize(vec3(-sin(th)*RW*TW, cos(th)*RW*TW, -1.0));     // along the spiral street, away from camera
  X = normalize(cross(Y, Z)); Z = cross(X, Y);
}
void main(){
  float th0 = iA.x, d0 = iA.y, sc = iA.z, mode = iA.w;
  float yaw = iB.x, lift = iB.y, ph = iB.z, sv = iB.w;
  float spin = uTime*uSpin;
  float speed = mode > 1.5 && mode < 2.5 ? sv : 0.0;            // cars: signed lane speed
  float d = mod(d0 - uTime*(uFlow + speed), D) - 6.0;
  vec3 p = aPos, n = aNrm, w, nw; vec3 X, Y, Z;
  if (mode < 0.5) {                     // rigid on the wall (towers, props)
    float th = th0 + spin + TW*d; frameAt(th, d, X, Y, Z);
    vec3 Xr = rotA(X, Y, yaw), Zr = rotA(Z, Y, yaw);
    vec3 c = vec3(RW*cos(th), RW*sin(th), -d) + Y*lift;
    vec3 q = p*vec3(sc, sc*sv, sc);
    w = c + Xr*q.x + Y*q.y + Zr*q.z; nw = Xr*n.x/sc + Y*n.y/(sc*sv) + Zr*n.z/sc;
  } else if (mode < 2.5) { // bent onto the wall (streets, ground) / cars follow the curve too
    float dv = d + p.z*sc; float th = th0 + spin + TW*dv + p.x*sc/RW;
    if (mode > 1.5) { float c_ = cos(yaw), s_ = sin(yaw); vec2 xz = mat2(c_, -s_, s_, c_)*p.xz; dv = d + xz.y*sc; th = th0 + spin + TW*dv + xz.x*sc/RW; n.xz = mat2(c_, -s_, s_, c_)*n.xz; }
    frameAt(th, dv, X, Y, Z);
    float r = RW - (p.y*sc + lift);
    w = vec3(r*cos(th), r*sin(th), -dv); nw = X*n.x + Y*n.y + Z*n.z;
  } else {                              // floating debris in the core: tumbling, slow spiral
    float R = lift; float th = th0 + spin*1.6 + d*0.08;
    vec3 c = vec3(R*cos(th), R*sin(th), -d);
    vec3 ax = normalize(vec3(sin(ph*6.3), cos(ph*4.1), sin(ph*2.7)+0.3));
    float a = uTime*(0.25 + 0.3*sv) + ph*6.28;
    w = c + rotA(p*sc, ax, a); nw = rotA(n, ax, a);
  }
  float fade = smoothstep(-6.0, -3.5, d) * (1.0 - smoothstep(D - 14.0, D - 7.0, d));
  vW = w; vN = nw; vUV = aUV; vPart = aAttr.x; vCode = aAttr.y; vTone = aToneAO.x; vAO = aToneAO.y; vInst = vec4(iC.xyz, fade);
  vL = vec3(d, ph, sv);
  gl_Position = uVP*vec4(w, 1.0);
}`;
const FS = `#version 300 es
precision highp float;
in vec3 vW; in vec3 vN; in vec2 vUV; flat in float vPart; flat in float vCode; in float vTone; in float vAO; flat in vec4 vInst; in vec3 vL;
out vec4 o;
uniform vec3 uCamPos; uniform float uTime;
uniform vec3 uSkyTop, uSkyHor, uCoreCol, uFog, uGlassTint, uWinWarm, uWinCool, uBusCol, uAccent[4];
uniform float uLit, uLampOn, uFogK, uEmis, uGlassRefl, uAmb;
${STUDIO_GLSL}
float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
vec3 cityEnv(vec3 R){
  // sky gradient toward the vortex core (-z) with a soft sun-core and a band of distant skyline silhouettes
  float t = clamp(-R.z*0.5 + 0.5, 0.0, 1.0);
  vec3 c = mix(uSkyTop, uSkyHor, pow(t, 1.6));
  c += uCoreCol*pow(max(-R.z, 0.0), 24.0)*1.5;
  float az = atan(R.y, R.x); float el = -R.z;
  float sky = step(el, 0.25 + 0.35*h21(vec2(floor(az*14.0), 3.0)) - 0.25) * smoothstep(-0.4, 0.2, el);
  c = mix(c, uSkyTop*0.35 + uWinWarm*0.05*step(0.6, h21(floor(vec2(az*90.0, el*60.0)))), sky*0.85);
  return c;
}
void main(){
  vec3 N = normalize(vN); vec3 V = normalize(uCamPos - vW); if (dot(N, V) < 0.0) N = -N;
  float nv = max(dot(N, V), 1e-3); vec3 R = reflect(-V, N);
  float ao = pow(clamp(vAO, 0.0, 1.0), 1.2);
  int part = int(vPart + 0.5); vec3 col; float rough = 0.5;
  vec3 L = normalize(uLightDir);
  if (part == 0) {                                   // curtain wall
    vec2 g = vUV/vec2(0.2, 0.16);                     // bay width x floor height (metres in the kit)
    vec2 cell = floor(g), f = fract(g);
    float mull = max(1.0 - smoothstep(0.0, 0.06, min(f.x, 1.0 - f.x)), 1.0 - smoothstep(0.0, 0.05, min(f.y, 1.0 - f.y)));
    float spandrel = 1.0 - step(0.2, f.y);
    float r = h21(cell + vInst.z*31.0); float r2 = h21(cell.yx*1.7 + 9.0 + vInst.z*13.0);
    float lit = step(r, uLit) * (0.6 + 0.4*sin(uTime*0.15 + r2*40.0) * step(0.85, r2) + 0.4);
    vec3 interior = mix(uGlassTint*0.05, mix(uWinWarm, uWinCool, step(0.7, r2))*(0.55 + 0.6*r2), lit) * (1.0 - spandrel);
    interior += uGlassTint*0.12*spandrel;
    float F = 0.06 + 0.94*pow(1.0 - nv, 5.0); F = mix(uGlassRefl, 1.0, F);
    vec3 env = cityEnv(R) * mix(vec3(1.0), uGlassTint*1.8, 0.45) * 1.25;
    vec3 H = normalize(L + V); float spec = pow(max(dot(N, H), 0.0), 220.0)*3.0;
    col = mix(interior*uEmis, env, F) + uKeyCol*spec*uKeyI;
    vec3 metal = studioShade(vW, N, V, vec3(0.18), 0.3, vec3(0.55), ao, 1.0, 0.2) * uAmb;
    col = mix(col, metal, mull*0.8);
    col *= mix(0.65, 1.0, ao);
  } else if (part == 6) {                            // emissive
    float c = vCode; vec3 e;
    float cyc = fract(uTime/9.0 + vL.y);
    if (c < 0.5) e = vec3(1.0, 0.08, 0.05) * (cyc > 0.55 ? 1.0 : 0.08);
    else if (c < 1.5) e = vec3(1.0, 0.55, 0.05) * (cyc > 0.45 && cyc <= 0.55 ? 1.0 : 0.08);
    else if (c < 2.5) e = vec3(0.1, 1.0, 0.45) * (cyc <= 0.45 ? 1.0 : 0.08);
    else if (c < 3.5) e = uWinWarm*mix(0.25, 1.4, uLampOn);
    else if (c < 4.5) e = vec3(1.0, 0.95, 0.85)*mix(0.4, 1.6, uLampOn);
    else if (c < 5.5) e = vec3(1.0, 0.1, 0.08)*mix(0.5, 1.2, uLampOn);
    else e = vec3(1.0, 0.85, 0.4)*(0.8 + 0.2*sin(uTime*3.0 + vL.y*20.0));
    col = e*uEmis*2.2;
  } else {
    vec3 alb; vec3 f0 = vec3(0.04); float rim = 0.25;
    if (part == 1) { alb = vec3(0.16, 0.17, 0.19); rough = 0.32; f0 = vec3(0.5); }
    else if (part == 2) { float sp = h21(floor(vUV*60.0)); alb = vec3(0.075, 0.078, 0.085)*(0.85 + 0.3*sp); rough = 0.75 - 0.4*uLampOn; }
    else if (part == 3) { alb = vec3(0.92, 0.9, 0.84); rough = 0.5; }
    else if (part == 4) { alb = vec3(1.0, 0.72, 0.05); rough = 0.18; f0 = vec3(0.06); }
    else if (part == 5) { alb = uBusCol; rough = 0.22; }
    else if (part == 7) { alb = vec3(0.72, 0.69, 0.66); rough = 0.7; }
    else if (part == 8) { alb = vec3(0.03); rough = 0.6; }
    else if (part == 9) { alb = vec3(0.6); rough = 0.15; f0 = vec3(0.85); }
    else if (part == 10) { alb = uGlassTint*0.06; rough = 0.05; f0 = vec3(0.08); }
    else if (part == 11) { alb = vTone < 0.15 ? vec3(0.85, 0.08, 0.06) : vTone < 0.45 ? uAccent[1] : vTone < 0.7 ? vec3(0.55, 0.33, 0.18) : uAccent[2]; rough = 0.35; }
    else { vec2 t = fract(vUV*1.25); float joint = 1.0 - smoothstep(0.0, 0.03, min(min(t.x, 1.0 - t.x), min(t.y, 1.0 - t.y)));
           float v = h21(floor(vUV*1.25)); alb = mix(vec3(0.52, 0.5, 0.48), vec3(0.62, 0.6, 0.57), v) * (1.0 - 0.35*joint); rough = 0.8; }
    col = studioShade(vW, N, V, alb, rough, f0, ao, 1.0, rim) * uAmb;
    if (part == 9 || part == 10 || part == 4 || part == 5) col += cityEnv(R)*(0.04 + 0.5*pow(1.0 - nv, 4.0))*(part == 9 ? 2.0 : 1.0);
    if (part == 2 && uLampOn > 0.5) col += cityEnv(R)*0.08*pow(1.0 - nv, 2.0);   // wet-street sheen at night
  }
  float dist = length(vW - uCamPos);
  float fog = 1.0 - exp(-max(dist - 6.0, 0.0)*uFogK);
  fog = max(fog, 1.0 - vInst.w);
  vec3 rd = -V; float core = exp(-dot(rd.xy, rd.xy)*10.0);
  col = mix(col, mix(uFog, uCoreCol, core), fog);
  o = vec4(col, dist);
}`;
const BACK_FS = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o; uniform vec3 uFog, uCore, uEdge; uniform float uAspect;
void main(){ vec2 p = (vUv*2.0-1.0)*vec2(uAspect, 1.0); float r = length(p);
  vec3 c = mix(uFog, uCore, exp(-r*r*5.0)); c = mix(c, uEdge, smoothstep(0.4, 1.5, r)); o = vec4(c, 1000.0); }`;

type Pal = { skyTop: string; skyHor: string; core: string; fog: string; edge: string; glass: string; warm: string; cool: string; bus: string; acc: string[]; lit: number; lamp: number; refl: number; amb: number; fogK: number; emis: number; key: string; dome: string; keyI: number };
export const CITY_PALETTES: Record<string, Pal> = {
  'Dusk Gold': { skyTop: '#5a3f7a', skyHor: '#ff9d5c', core: '#ffd7a0', fog: '#5b3a58', edge: '#1d1630', glass: '#d7a46c', warm: '#ffc27a', cool: '#ffe3b8', bus: '#e2483a',
    acc: ['#ff6a4a', '#2f6bd8', '#f2b233', '#7a4bd0'], lit: 0.22, lamp: 1, fogK: 0.04, emis: 1.0, refl: 0.5, amb: 0.8, key: '#ffcf9a', dome: '#9a7ab8', keyI: 1.3 },
  'Cobalt Night': { skyTop: '#040817', skyHor: '#2c56c9', core: '#a9c8ff', fog: '#0a1736', edge: '#02050d', glass: '#3b6fd6', warm: '#ffcf8f', cool: '#bfe2ff', bus: '#1f8ad9',
    acc: ['#ff4a6a', '#18b0ff', '#ffd23f', '#6affc8'], lit: 0.5, lamp: 1, fogK: 0.045, emis: 1.25, refl: 0.35, amb: 0.3, key: '#9fc0ff', dome: '#2a3f7a', keyI: 0.7 },
  'Pastel Morning': { skyTop: '#bfe3f4', skyHor: '#ffe2d2', core: '#ffe9d6', fog: '#e9cfc8', edge: '#bcd6e2', glass: '#6fc4bd', warm: '#ffe6c0', cool: '#e8f6ff', bus: '#ff8f8a',
    acc: ['#ff9b8a', '#6fa8ff', '#ffd27a', '#b79cff'], lit: 0.06, lamp: 0, fogK: 0.022, emis: 0.7, refl: 0.6, amb: 1.0, key: '#fff3e2', dome: '#cfe8f2', keyI: 1.5 },
};

export class CityScene implements PhysScene {
  name = 'city'; ready = false; error: string | null = null; stats: Record<string, any> = {};
  private prog: Prog; private back: Prog; private ms: MsTarget; private emptyVao: WebGLVertexArrayObject;
  private draws: { vao: WebGLVertexArrayObject; iOff: number; iCount: number; inst: number; name: string; tris: number }[] = [];
  private loading = false; private totalInst = 0; private totalTris = 0;
  constructor(private gl: WebGL2RenderingContext, private base = '/pass4') {
    this.prog = compile(gl, VS, FS, 'city'); this.back = compile(gl, QUAD_VS, BACK_FS, 'city-back');
    this.ms = new MsTarget(gl, 4); this.emptyVao = gl.createVertexArray()!;
  }
  async load() {
    if (this.ready || this.loading) return; this.loading = true;
    try {
      const [meta, buf] = await Promise.all([
        fetch(`${this.base}/city.json`).then((r) => { if (!r.ok) throw new Error(`city.json HTTP ${r.status}`); return r.json(); }),
        fetch(`${this.base}/city.bin`).then((r) => { if (!r.ok) throw new Error(`city.bin HTTP ${r.status}`); return r.arrayBuffer(); }),
      ]);
      const gl = this.gl;
      const vdata = new Float32Array(buf, 0, meta.vertexBytes / 4); const idata = new Uint32Array(buf, meta.vertexBytes, meta.indexCount);
      const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, vdata, gl.STATIC_DRAW);
      const eb = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, eb); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idata, gl.STATIC_DRAW);
      const inst = this.layout(meta.protos);
      const all: number[] = []; let ioff = 0;
      for (const p of meta.protos) {
        const list = inst[p.name] ?? []; if (!list.length) continue;
        for (const v of list) all.push(...v);
        const vao = gl.createVertexArray()!; gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, vb); const S = meta.stride * 4; const vo = p.vOff * S;
        gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, S, vo);
        gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, S, vo + 12);
        gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, S, vo + 24);
        gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, S, vo + 32);
        gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 2, gl.FLOAT, false, S, vo + 48);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, eb);
        this.draws.push({ vao, iOff: p.iOff, iCount: p.iCount, inst: list.length, name: p.name, tris: p.tris });
        (this.draws[this.draws.length - 1] as any).instStart = ioff; ioff += list.length;
      }
      const ib = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, ib); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(all), gl.STATIC_DRAW);
      for (const d of this.draws) {
        gl.bindVertexArray(d.vao); const st = (d as any).instStart * 48;
        for (let k = 0; k < 3; k++) { gl.enableVertexAttribArray(5 + k); gl.vertexAttribPointer(5 + k, 4, gl.FLOAT, false, 48, st + k * 16); gl.vertexAttribDivisor(5 + k, 1); }
      }
      gl.bindVertexArray(null);
      this.totalInst = ioff; this.totalTris = this.draws.reduce((a, d) => a + d.inst * d.tris, 0);
      this.ready = true;
      console.log(`City: ${this.draws.length} prototypes, ${this.totalInst} instances, ${(this.totalTris / 1e6).toFixed(2)}M tris/frame`);
    } catch (e) { this.error = e instanceof Error ? e.message : String(e); console.warn('City load failed: ' + this.error); }
    finally { this.loading = false; }
  }
  /** Instance layout: [th0, d0, scale, mode, yaw, lift, phase, sv(yScale|carSpeed|tumble), kind, tint, seed, 0]. */
  private layout(protos: any[]) {
    let seed = 2024; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const out: Record<string, number[][]> = {}; const push = (n: string, v: number[]) => { (out[n] ??= []).push(v); };
    const towers = protos.filter((p) => p.kind === 'tower').map((p) => p.name);
    const sector = 2 * Math.PI / NS; const circ = 2 * Math.PI * RW;
    // ground tiles (bent): 4 m tiles, slightly stretched to close the ring exactly
    const nT = Math.round(circ / 4), sx = circ / (nT * 4);
    for (let i = 0; i < nT; i++) for (let j = 0; j < D / 4; j++) push('ground', [i * 2 * Math.PI / nT, j * 4 + 2, sx, 1, 0, -0.002, 0, 1, 0, 0, rnd(), 0]);
    for (let s = 0; s < NS; s++) {
      const th = s * sector;
      // street segments (bent), a crosswalk every 4th
      for (let j = 0; j < D / 4; j++) push(j % 4 === 1 ? 'crosswalk' : 'street', [th, j * 4 + 2, 1.15, 1, 0, 0.01, 0, 1, 0, 0, rnd(), 0]);
      // lamps both sides, traffic lights at crosswalks
      for (let j = 0; j < D / 8; j++) for (const side of [-1, 1]) push('street_lamp', [th + side * 1.0 / RW, j * 8 + (side > 0 ? 1 : 5), 1, 0, side > 0 ? Math.PI : 0, 0.08, rnd(), 1, 0, 0, rnd(), 0]);
      for (let j = 0; j < D / 16; j++) for (const side of [-1, 1]) push('traffic_light', [th + side * 1.0 / RW, j * 16 + 4 + side * 1.6, 1, 0, side > 0 ? Math.PI : 0, 0.08, (s * 0.37 + j * 0.21) % 1, 1, 0, 0, rnd(), 0]);
      // cars: two lanes, opposite directions
      for (const lane of [-1, 1]) {
        const n = 7;
        for (let k = 0; k < n; k++) {
          const isBus = rnd() < 0.22; const v = (lane > 0 ? 1 : -1) * (1.3 + rnd() * 0.9);
          push(isBus ? 'bus' : 'taxi', [th + lane * 0.4 / RW, (k + rnd() * 0.5) * D / n, 1, 2, lane > 0 ? 0 : Math.PI, 0.004, rnd(), v, 0, 0, rnd(), 0]);
        }
      }
      // street furniture on the sidewalks
      for (let k = 0; k < 9; k++) {
        const side = rnd() < 0.5 ? -1 : 1; const kind = ['hydrant', 'sign', 'bench'][Math.floor(rnd() * 3)];
        push(kind, [th + side * 0.95 / RW, rnd() * D, 1, 0, side > 0 ? -Math.PI / 2 : Math.PI / 2, 0.08, rnd(), 1, 0, 0, rnd(), 0]);
      }
      // building lots between this street and the next: 3 columns, 4.6 m rows
      const span = sector * RW - 2.6; const cols = 3;
      for (let j = 0; j < Math.floor(D / 4.67); j++) for (let c = 0; c < cols; c++) {
        if (rnd() < 0.08) continue;                                     // the odd plaza
        const x = 1.3 + (c + 0.5) * span / cols + (rnd() - 0.5) * 0.4;
        const name = towers[Math.floor(rnd() * towers.length)];
        const sc = 0.52 + rnd() * 0.12; const sy = 0.55 + rnd() * 0.45 * (c === 1 ? 1.0 : 0.8);
        push(name, [th + x / RW, j * 4.67 + 2.3 + (rnd() - 0.5) * 0.6, sc, 0, Math.floor(rnd() * 4) * Math.PI / 2 + (rnd() - 0.5) * 0.1, 0, rnd(), sy, 0, 0, rnd(), 0]);
      }
    }
    // floating props in the open core
    const floaters = ['taxi', 'taxi', 'bus', 'sign', 'hydrant', 'bench', 'street_lamp', 'traffic_light'];
    for (let k = 0; k < 48; k++) push(floaters[k % floaters.length], [rnd() * 2 * Math.PI, 8 + rnd() * (D - 8), 0.8 + rnd() * 0.5, 3, 0, 3.4 + rnd() * 2.4, rnd(), rnd(), 0, 0, rnd(), 0]);
    return out;
  }
  render(f: PhysFrame) {
    const gl = this.gl, P = f.params; const pal = CITY_PALETTES[P.mat] ?? CITY_PALETTES['Dusk Gold'];
    if (!this.ready) { void this.load(); const c = lin(pal.fog); gl.bindFramebuffer(gl.FRAMEBUFFER, f.target); gl.viewport(0, 0, f.w, f.h); gl.clearColor(c[0], c[1], c[2], 1); gl.clear(gl.COLOR_BUFFER_BIT); return; }
    const eye: Vec3 = [0.25 * Math.sin(f.time * 0.09), 0.18 * Math.sin(f.time * 0.06), 0];
    const view = lookAt(eye, [0, 0, -10], [Math.sin(f.time * 0.025) * 0.2, 1, 0]); const proj = perspective((P.fov ?? 62) * Math.PI / 180, f.aspect, 0.1, 90);
    const vp = mul(proj, view);
    const L = dirFromAzEl(P.keyAz ?? -30, P.keyEl ?? 55); const Ld = norm([L[0], L[1], -Math.abs(L[2]) * 0.6 + 0.4]);
    const look = lookOf(P.look);
    this.ms.ensure(f.w, f.h); this.ms.begin();
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.BLEND);
    gl.useProgram(this.back.p); gl.uniform3fv(this.back.u.uFog, lin(pal.fog)); gl.uniform3fv(this.back.u.uCore, lin(pal.core, 1.4)); gl.uniform3fv(this.back.u.uEdge, lin(pal.edge));
    gl.uniform1f(this.back.u.uAspect, f.aspect); gl.bindVertexArray(this.emptyVao); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.depthFunc(gl.LESS); gl.disable(gl.CULL_FACE);
    const u = this.prog.u; gl.useProgram(this.prog.p);
    setStudioEnv(gl, u, { look, L: Ld, F: norm([-Ld[0], 0.2, 0.7]) as Vec3, fwd: [0, 0, -1] });
    gl.uniform3fv(u.uBgTop, lin(pal.skyTop)); gl.uniform3fv(u.uBgBottom, lin(pal.fog)); gl.uniform3fv(u.uDomeCol, lin(pal.dome)); gl.uniform3fv(u.uKeyCol, lin(pal.key)); gl.uniform1f(u.uKeyI, pal.keyI);
    gl.uniformMatrix4fv(u.uVP, false, vp); gl.uniform3fv(u.uCamPos, eye);
    gl.uniform1f(u.uTime, f.time); gl.uniform1f(u.uFlow, 2.4); gl.uniform1f(u.uSpin, 0.07);
    gl.uniform3fv(u.uSkyTop, lin(pal.skyTop)); gl.uniform3fv(u.uSkyHor, lin(pal.skyHor)); gl.uniform3fv(u.uCoreCol, lin(pal.core, 1.3)); gl.uniform3fv(u.uFog, lin(pal.fog));
    gl.uniform3fv(u.uGlassTint, lin(pal.glass)); gl.uniform3fv(u.uWinWarm, lin(pal.warm, 1.6)); gl.uniform3fv(u.uWinCool, lin(pal.cool, 1.4)); gl.uniform3fv(u.uBusCol, lin(pal.bus));
    const acc = new Float32Array(12); pal.acc.forEach((h, i) => acc.set(lin(h), i * 3)); gl.uniform3fv(u['uAccent[0]'], acc);
    gl.uniform1f(u.uLit, pal.lit); gl.uniform1f(u.uLampOn, pal.lamp); gl.uniform1f(u.uFogK, pal.fogK); gl.uniform1f(u.uEmis, pal.emis); gl.uniform1f(u.uGlassRefl, pal.refl); gl.uniform1f(u.uAmb, pal.amb);
    for (const d of this.draws) { gl.bindVertexArray(d.vao); gl.drawElementsInstanced(gl.TRIANGLES, d.iCount, gl.UNSIGNED_INT, d.iOff * 4, d.inst); }
    gl.bindVertexArray(null); gl.disable(gl.DEPTH_TEST);
    const tex = this.ms.resolve();
    f.dof(tex, f.target, f.w, f.h, 9.0, P.dof ?? 0.2);
    this.stats = { instances: this.totalInst, prototypes: this.draws.length, trisPerFrame: this.totalTris, palette: P.mat };
  }
}
