// Pass 4 "Fabric in Wind": a Blender cloth simulation (tools/blender/pass4/fabric_cloth.py) baked as a grid
// vertex-animation texture (one RGB16F position image per frame, 2D texture array). Each frame the engine
// Catmull-Rom upsamples the 192x128 sim grid onto a 576x384 render grid (221k verts), blends neighbouring
// frames for 60 fps playback of the 30 fps bake (the loop is crossfaded in the bake), derives normals and fold
// cavity, and shades it as satin/silk: anisotropic dual-lobe highlights along the weave, sheen, wrap diffuse,
// self-shadowing and an optional thin-film iridescence. Original MIT-licensed work for flow-engine.
import { compile, MsTarget, ShadowMap, QUAD_VS, STUDIO_GLSL, PCF_GLSL, setStudioEnv, lookOf, dirFromAzEl, lookAt, perspective, ortho, mul, norm, srgbHex, invert,
  type PhysFrame, type PhysScene, type Prog, type Vec3, fbo, type FB } from './common';

const UP_FS = `#version 300 es
precision highp float; precision highp sampler2DArray;
in vec2 vUv; out vec4 o;
uniform sampler2DArray uVat; uniform ivec2 uSim; uniform int uF0, uF1; uniform float uFr; uniform vec2 uGrid;
vec3 tf(ivec2 p, int f){ p = clamp(p, ivec2(0), uSim-1); return texelFetch(uVat, ivec3(p, f), 0).xyz; }
vec4 cr(float t){ float t2=t*t, t3=t2*t; return vec4(-0.5*t3+t2-0.5*t, 1.5*t3-2.5*t2+1.0, -1.5*t3+2.0*t2+0.5*t, 0.5*t3-0.5*t2); }
vec3 bicubic(vec2 g, int f){
  ivec2 b = ivec2(floor(g)); vec2 fr = g - vec2(b);
  vec4 wx = cr(fr.x), wy = cr(fr.y); vec3 acc = vec3(0.0);
  for (int j=0;j<4;j++){ vec3 row = vec3(0.0); for (int i=0;i<4;i++) row += tf(b+ivec2(i-1,j-1), f)*wx[i]; acc += row*wy[j]; }
  return acc;
}
void main(){
  vec2 g = floor(gl_FragCoord.xy)/(uGrid-1.0)*vec2(uSim-1);
  vec3 a = bicubic(g, uF0), b = bicubic(g, uF1);
  o = vec4(mix(a, b, uFr), 1.0);
}`;

// "Flow" variant: GPU wave cloth. A large silk sheet driven by a periodic (12 s) sum of travelling Gerstner waves:
// the horizontal Gerstner displacement pinches every crest into a thin, crisp fold, long waves give the slow
// billow, short waves ripple near the free edges. Every frequency is a multiple of 2pi/12 s, so it loops exactly.
const GEN_FS = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform vec2 uGrid; uniform float uTime, uW, uH;
const float TAU = 6.2831853;
void main(){
  vec2 uv = floor(gl_FragCoord.xy)/(uGrid-1.0);
  vec3 p = vec3((uv.x-0.5)*uW, (uv.y-0.5)*uH, 0.0);
  float edge = 0.35 + 0.65*smoothstep(0.0, 1.0, uv.x);           // the leeward end flutters more
  vec3 d = vec3(0.0);
  // dir(x,y), wavelength (m), amplitude (m), steepness, cycles per 12 s, phase
  const int NW = 7;
  vec4 W[NW] = vec4[NW](vec4(1.0, 0.12, 3.6, 0.46), vec4(0.95, -0.22, 2.3, 0.28), vec4(0.9, 0.3, 1.45, 0.15), vec4(1.0, -0.06, 0.9, 0.07),
                         vec4(0.9, 0.35, 0.6, 0.016), vec4(0.95, -0.2, 0.4, 0.007), vec4(0.85, -0.45, 0.27, 0.0035));
  vec3 Q[NW] = vec3[NW](vec3(0.55, 1.0, 0.0), vec3(0.7, 2.0, 1.3), vec3(0.85, 3.0, 2.1), vec3(0.9, 4.0, 0.7), vec3(0.8, 6.0, 4.0), vec3(0.75, 8.0, 2.9), vec3(0.6, 11.0, 5.3));
  for (int i=0;i<NW;i++){
    vec2 dir = normalize(W[i].xy); float k = TAU/W[i].z; float A = W[i].w*(i > 2 ? edge : 1.0);
    float ph = k*dot(dir, p.xy) - TAU*Q[i].y*uTime/12.0 + Q[i].z;
    float qq = Q[i].x/(k*A*float(NW)+1e-4);
    d.xy += -qq*A*dir*cos(ph)*0.9;                                // Gerstner pinch -> sharp folds
    d.z  += A*sin(ph);
  }
  // global sculpting: a soft S-curve billow and a slow lift of the free corner
  d.z += 0.55*sin(uv.x*3.1416)*sin(uv.y*3.1416*0.9+0.4) + 0.35*sin(TAU*uTime/12.0 + uv.x*2.0)*uv.x*uv.y;
  d.y += 0.25*sin(TAU*uTime/12.0*1.0 + uv.x*3.0)*uv.x;
  o = vec4(p + d, 1.0);
}`;

// "Ribbon" variant (pass 5): a free-flying silk scarf. Its spine rides a closed 3D Lissajous loop (one lap per
// 12 s, so the motion repeats exactly), the cross-section twists with periodic torsion, the long edges curl and
// flutter with travelling waves (all frequencies are multiples of 1/12 Hz), and both ends taper to soft points,
// so no straight or rectangular edge is ever shown.
const RIB_FS = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform vec2 uGrid; uniform float uTime;
const float TAU = 6.2831853;
vec3 spine(float th){ return vec3(3.5*sin(th), 1.35*sin(2.0*th + 0.5) + 0.25*sin(3.0*th), 1.7*cos(th) + 0.45*sin(3.0*th + 1.0)); }
void main(){
  vec2 uv = floor(gl_FragCoord.xy)/(uGrid-1.0);
  float u = uv.x, v = uv.y - 0.5;
  float ph = TAU*uTime/12.0;
  float th = ph - u*3.4;                                     // head leads, tail trails along the loop
  vec3 c = spine(th);
  vec3 T = normalize(spine(th + 0.01) - spine(th - 0.01));
  vec3 N0 = normalize(cross(T, vec3(0.15, 1.0, 0.1)));
  vec3 B0 = cross(N0, T);
  float tw = 1.15*sin(2.0*th + 0.3) + 0.7*sin(3.0*th - 2.0*ph) + 0.35*u;
  vec3 W = cos(tw)*B0 + sin(tw)*N0;
  vec3 ND = cross(T, W);
  float taper = pow(sin(3.14159*clamp(u, 0.0, 1.0)), 0.55) * (0.85 + 0.15*sin(u*9.0 - 4.0*ph));
  float wid = 2.5*taper;
  float e = abs(v)*2.0;
  float dn = 0.15*sin(u*36.0 - 18.0*ph + v*1.6)*(0.4 + 0.6*u)
           + 0.06*sin(u*90.0 - 30.0*ph + v*3.0)*(0.3 + u)
           + 0.45*pow(e, 2.2)*sin(u*13.0 - 6.0*ph + sign(v)*1.4)
           + 0.18*v*v*4.0*sin(u*7.0 - 2.0*ph);                   // edges curl
  float dw = -0.05*pow(e, 3.0)*sign(v)*(1.0 + sin(u*20.0 - 8.0*ph));  // curling edges pull in slightly
  vec3 pos = c + W*(v*wid + dw) + ND*dn;
  o = vec4(pos, 1.0);
}`;
const NRM_FS = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uPos; uniform ivec2 uGridI;
vec3 P(ivec2 p){ return texelFetch(uPos, clamp(p, ivec2(0), uGridI-1), 0).xyz; }
void main(){
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec3 c = P(p), l = P(p-ivec2(1,0)), r = P(p+ivec2(1,0)), d = P(p-ivec2(0,1)), u = P(p+ivec2(0,1));
  vec3 n = normalize(cross(r-l, u-d));
  // fold cavity: second difference over a wider stencil, signed along the normal
  vec3 l2 = P(p-ivec2(4,0)), r2 = P(p+ivec2(4,0)), d2 = P(p-ivec2(0,4)), u2 = P(p+ivec2(0,4));
  float lap = dot((l2+r2+d2+u2)*0.25 - c, n);
  o = vec4(n, lap);
}`;
const MESH_VS = `#version 300 es
precision highp float;
uniform sampler2D uPos, uNrm; uniform ivec2 uGridI; uniform mat4 uVP;
out vec3 vW; out vec3 vN; out vec3 vT; out vec2 vUV; out float vCav;
void main(){
  ivec2 p = ivec2(gl_VertexID % uGridI.x, gl_VertexID / uGridI.x);
  vec3 w = texelFetch(uPos, p, 0).xyz; vec4 nn = texelFetch(uNrm, p, 0);
  vec3 r = texelFetch(uPos, min(p+ivec2(1,0), uGridI-1), 0).xyz, l = texelFetch(uPos, max(p-ivec2(1,0), ivec2(0)), 0).xyz;
  vW = w; vN = nn.xyz; vT = normalize(r-l + 1e-6); vUV = vec2(p)/vec2(uGridI-1); vCav = nn.w;
  gl_Position = uVP*vec4(w,1.0);
}`;
const SH_FS = `#version 300 es
precision highp float; out vec4 o; void main(){ o = vec4(1.0); }`;
const BACK_FS = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o;
uniform mat4 uInvVP; uniform vec3 uCamPos;
${STUDIO_GLSL}
void main(){ vec4 a = uInvVP*vec4(vUv*2.0-1.0, 1.0, 1.0); vec3 rd = normalize(a.xyz/a.w - uCamPos); o = vec4(backdrop(rd), 1000.0); }`;
const FAB_FS = `#version 300 es
precision highp float;
in vec3 vW; in vec3 vN; in vec3 vT; in vec2 vUV; in float vCav; out vec4 o;
uniform vec3 uCamPos; uniform vec3 uFront0, uFront1, uBack0, uBack1; uniform float uMat, uIrid, uGloss, uAO, uWeave;
${STUDIO_GLSL}
${PCF_GLSL}
void main(){
  vec3 N = normalize(vN); vec3 V = normalize(uCamPos - vW);
  bool front = gl_FrontFacing;
  if (dot(N,V) < 0.0) N = -N;
  // dip-dyed silk: two palette colours graded across the sheet, a different pair on the reverse side
  float g = smoothstep(0.0, 1.0, vUV.y*0.75 + 0.25*sin(vUV.x*3.0 + vUV.y*2.0));
  vec3 alb = front ? mix(uFront0, uFront1, g) : mix(uBack0, uBack1, g);
  vec3 T = normalize(vT - N*dot(vT,N)); vec3 B = cross(N, T);
  vec3 L = normalize(uLightDir); vec3 H = normalize(L+V);
  float nl = dot(N,L), nv = max(dot(N,V),1e-3);
  float sh = shadowAt(vW, N);
  float cav = clamp(vCav*60.0, -1.0, 1.0);
  float ao = clamp(1.0 - max(cav,0.0)*0.65*uAO, 0.25, 1.0) * mix(1.0, 0.85, uAO*smoothstep(0.0,-1.0,-max(-cav,0.0)));
  // fine weave modulates the highlight direction a little (satin sheen breaks up like real cloth)
  float weave = 0.5;
  float wrap = clamp((nl+0.15)/1.15, 0.0, 1.0);
  vec3 dome = mix(uGroundCol, uDomeCol, N.y*0.5+0.5);
  vec3 diff = alb*(uKeyCol*uKeyI*1.25*wrap*mix(0.2,1.0,sh) + dome*uDomeI*0.55*ao);
  // anisotropic dual-lobe (Kajiya-Kay style) along the warp T and weft B
  float th = dot(T, H), tb = dot(B, H);
  float ex = mix(40.0, 220.0, clamp(uGloss*0.6, 0.0, 1.0));
  float sT = pow(sqrt(max(0.0, 1.0 - th*th)), ex), sB = pow(sqrt(max(0.0, 1.0 - tb*tb)), ex*0.5);
  float satin = uMat < 0.5 ? 1.0 : uMat < 1.5 ? 0.55 : uMat < 2.5 ? 0.8 : 0.15;   // satin, silk, iridescent, velvet
  vec3 hiCol = mix(alb, vec3(1.0), 0.55);
  vec3 spec = (hiCol*sT*0.9 + alb*sB*0.35) * satin * uKeyCol*uKeyI * 1.6 * max(nl,0.0) * sh * (0.85+0.3*weave*uWeave);
  // sheen (velvet / grazing scattering)
  float sheen = pow(1.0-nv, uMat > 2.5 ? 2.0 : 4.0) * (uMat > 2.5 ? 0.9 : 0.35);
  vec3 col = diff + spec + alb*sheen*mix(0.5,1.0,ao) + uRimCol*pow(1.0-nv,3.0)*0.25*ao;
  vec3 refl = envMap(reflect(-V,N), 0.35) * (0.02 + 0.2*pow(1.0-nv,5.0)) * satin * ao;
  col += refl;
  if (uMat > 1.5 && uMat < 2.5) { vec3 film = thinFilm(nv*1.1 + 0.25*vUV.y); col = mix(col, col*0.55 + film*(0.35*diff + 1.2*spec + 0.25), 0.6*uIrid); }
  // translucency: thin silk glows when lit from behind
  float trans = max(-nl, 0.0)*0.35*(uMat > 2.5 ? 0.2 : 1.0);
  col += alb*uKeyCol*trans*mix(0.4,1.0,sh);
  o = vec4(col, length(vW-uCamPos));
}`;

export class FabricScene implements PhysScene {
  name = 'fabric'; ready = false; error: string | null = null; stats: Record<string, any> = {};
  private meta: any = null; private vat: WebGLTexture | null = null; private loading = false;
  private up: Prog; private gen: Prog; private rib: Prog; private nr: Prog; private mesh: Prog; private sh: Prog; private back: Prog;
  private posFB: FB | null = null; private nrmFB: FB | null = null; private gw = 576; private gh = 384; private ebo: WebGLBuffer | null = null; private ecount = 0;
  private vao: WebGLVertexArrayObject; private ms: MsTarget; private smap: ShadowMap; private t = 0;
  constructor(private gl: WebGL2RenderingContext, private base = '/pass4') {
    this.up = compile(gl, QUAD_VS, UP_FS, 'fabric-up'); this.gen = compile(gl, QUAD_VS, GEN_FS, 'fabric-gen'); this.rib = compile(gl, QUAD_VS, RIB_FS, 'fabric-ribbon'); this.nr = compile(gl, QUAD_VS, NRM_FS, 'fabric-nrm');
    this.mesh = compile(gl, MESH_VS, FAB_FS, 'fabric-mesh'); this.sh = compile(gl, MESH_VS, SH_FS, 'fabric-shadow'); this.back = compile(gl, QUAD_VS, BACK_FS, 'fabric-back');
    this.vao = gl.createVertexArray()!; this.ms = new MsTarget(gl, 4); this.smap = new ShadowMap(gl, 2048);
  }
  async load() {
    if (this.ready || this.loading) return; this.loading = true;
    try {
      const [meta, buf] = await Promise.all([
        fetch(`${this.base}/fabric.json`).then((r) => { if (!r.ok) throw new Error(`fabric.json HTTP ${r.status}`); return r.json(); }),
        fetch(`${this.base}/fabric.vat`).then((r) => { if (!r.ok) throw new Error(`fabric.vat HTTP ${r.status}`); return r.arrayBuffer(); }),
      ]);
      const gl = this.gl; const { nx, ny, frames } = meta;
      if (buf.byteLength !== nx * ny * frames * 6) throw new Error(`fabric.vat size ${buf.byteLength} != ${nx * ny * frames * 6}`);
      this.vat = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.vat);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 2);
      gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGB16F, nx, ny, frames, 0, gl.RGB, gl.HALF_FLOAT, new Uint16Array(buf));
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
      this.meta = meta;
      this.posFB = fbo(gl, this.gw, this.gh, gl.RGBA32F, gl.NEAREST); this.nrmFB = fbo(gl, this.gw, this.gh, gl.RGBA16F, gl.NEAREST);
      const idx = new Uint32Array((this.gw - 1) * (this.gh - 1) * 6); let k = 0;
      for (let j = 0; j < this.gh - 1; j++) for (let i = 0; i < this.gw - 1; i++) { const a = j * this.gw + i; idx.set([a, a + 1, a + this.gw + 1, a, a + this.gw + 1, a + this.gw], k); k += 6; }
      this.ebo = gl.createBuffer(); gl.bindVertexArray(this.vao); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ebo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW); gl.bindVertexArray(null);
      this.ecount = idx.length; this.ready = true;
      console.log(`Fabric VAT: ${nx}x${ny} sim grid, ${frames} frames -> ${this.gw}x${this.gh} render grid (${this.gw * this.gh} verts)`);
    } catch (e) { this.error = e instanceof Error ? e.message : String(e); console.warn('Fabric load failed: ' + this.error); }
    finally { this.loading = false; }
  }
  render(f: PhysFrame) {
    const gl = this.gl, P = f.params, look = lookOf(P.look);
    if (!this.ready) { void this.load(); const c = srgbHex(look.bgBottom); gl.bindFramebuffer(gl.FRAMEBUFFER, f.target); gl.viewport(0, 0, f.w, f.h); gl.clearColor(c[0], c[1], c[2], 1); gl.clear(gl.COLOR_BUFFER_BIT); return; }
    const m = this.meta; if (!P.paused) this.t += Math.min(0.1, f.dt) * P.speed;
    const fr = (this.t * m.fps) % m.frames; const f0 = Math.floor(fr), f1 = (f0 + 1) % m.frames;
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.bindVertexArray(this.vao);
    const flow = P.variant !== 'Blender Bake';
    // upsample
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.posFB!.f); gl.viewport(0, 0, this.gw, this.gh);
    const ribbon = P.variant === 'Ribbon' || !P.variant;
    if (ribbon) {
      gl.useProgram(this.rib.p); gl.uniform2f(this.rib.u.uGrid, this.gw, this.gh); gl.uniform1f(this.rib.u.uTime, this.t % 12);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    } else if (flow) {
      gl.useProgram(this.gen.p); gl.uniform2f(this.gen.u.uGrid, this.gw, this.gh); gl.uniform1f(this.gen.u.uTime, this.t % 12); gl.uniform1f(this.gen.u.uW, 6.4); gl.uniform1f(this.gen.u.uH, 3.6);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    } else {
    gl.useProgram(this.up.p); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.vat); gl.uniform1i(this.up.u.uVat, 0);
    gl.uniform2i(this.up.u.uSim, m.nx, m.ny); gl.uniform1i(this.up.u.uF0, f0); gl.uniform1i(this.up.u.uF1, f1); gl.uniform1f(this.up.u.uFr, fr - f0); gl.uniform2f(this.up.u.uGrid, this.gw, this.gh);
    gl.drawArrays(gl.TRIANGLES, 0, 3); gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.nrmFB!.f);
    gl.useProgram(this.nr.p); gl.bindTexture(gl.TEXTURE_2D, this.posFB!.t); gl.uniform1i(this.nr.u.uPos, 0); gl.uniform2i(this.nr.u.uGridI, this.gw, this.gh);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // camera on the convex (billowing) side, slow drift
    const bmin = m.bounds.min as Vec3, bmax = m.bounds.max as Vec3;
    let c: Vec3 = [(bmin[0] + bmax[0]) / 2, (bmin[1] + bmax[1]) / 2 - 0.15, (bmin[2] + bmax[2]) / 2];
    let side = -1;
    let eye: Vec3 = [c[0] + 2.4 + 0.3 * Math.sin(f.time * 0.05), c[1] - 0.35, c[2] + side * 4.3];
    c[1] -= 0.25;
    if (flow) { c = [0.2, 0, 0.2]; side = 1; eye = [-2.2 + 0.3 * Math.sin(f.time * 0.05), 1.0, 5.1]; }
    if (ribbon) { c = [0, 0, 0]; side = 1; eye = [0.6 * Math.sin(f.time * 0.04), 1.0, 8.4]; }
    const view = lookAt(eye, c); const proj = perspective((P.fov ?? 36) * Math.PI / 180, f.aspect, 0.3, 40); const vp = mul(proj, view);
    const L0 = dirFromAzEl(P.keyAz ?? -40, P.keyEl ?? 48); const Ld = norm([L0[0], L0[1], side * Math.abs(L0[2])]);
    const lview = lookAt([c[0] + Ld[0] * 10, c[1] + Ld[1] * 10, c[2] + Ld[2] * 10], c, [0, 1, 0]);
    const ext = ribbon ? 6.5 : 4.5; const lvp = mul(ortho(-ext, ext, -ext, ext, 1, 26), lview);
    const env = { look, L: Ld, F: norm([-Ld[0], 0.3, side * 0.8]) as Vec3, fwd: norm([c[0] - eye[0], c[1] - eye[1], c[2] - eye[2]]) as Vec3 };
    // shadow
    this.smap.begin(); gl.disable(gl.CULL_FACE);
    gl.useProgram(this.sh.p); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.posFB!.t); gl.uniform1i(this.sh.u.uPos, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.nrmFB!.t); gl.uniform1i(this.sh.u.uNrm, 1);
    gl.uniform2i(this.sh.u.uGridI, this.gw, this.gh); gl.uniformMatrix4fv(this.sh.u.uVP, false, lvp);
    gl.drawElements(gl.TRIANGLES, this.ecount, gl.UNSIGNED_INT, 0); this.smap.end();
    // main
    this.ms.ensure(f.w, f.h); this.ms.begin();
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
    gl.useProgram(this.back.p); setStudioEnv(gl, this.back.u, env); gl.uniformMatrix4fv(this.back.u.uInvVP, false, invert(vp)); gl.uniform3fv(this.back.u.uCamPos, eye);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.depthFunc(gl.LESS);
    const u = this.mesh.u; gl.useProgram(this.mesh.p); setStudioEnv(gl, u, env);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.posFB!.t); gl.uniform1i(u.uPos, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.nrmFB!.t); gl.uniform1i(u.uNrm, 1);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.smap.tex); gl.uniform1i(u.uShadow, 3);
    gl.uniformMatrix4fv(u.uLightVP, false, lvp); gl.uniform1f(u.uShadowSoft, 3.0); gl.uniform1f(u.uShadowTexel, 1 / 2048);
    gl.uniform2i(u.uGridI, this.gw, this.gh); gl.uniformMatrix4fv(u.uVP, false, vp); gl.uniform3fv(u.uCamPos, eye);
    const sl = look.slots; const pick = (i: number) => srgbHex(sl[i % 7]);
    gl.uniform3fv(u.uFront0, pick(0)); gl.uniform3fv(u.uFront1, pick(2)); gl.uniform3fv(u.uBack0, pick(1)); gl.uniform3fv(u.uBack1, pick(5));
    const MATS = ['Satin', 'Silk', 'Iridescent', 'Velvet']; const mi = Math.max(0, MATS.indexOf(P.mat));
    gl.uniform1f(u.uMat, mi); gl.uniform1f(u.uIrid, P.irid ?? 0.9); gl.uniform1f(u.uGloss, P.gloss ?? 1); gl.uniform1f(u.uAO, P.ao ?? 1); gl.uniform1f(u.uWeave, 1);
    gl.drawElements(gl.TRIANGLES, this.ecount, gl.UNSIGNED_INT, 0);
    gl.disable(gl.DEPTH_TEST); gl.bindVertexArray(null); gl.activeTexture(gl.TEXTURE0);
    const tex = this.ms.resolve();
    f.dof(tex, f.target, f.w, f.h, Math.hypot(eye[0] - c[0], eye[1] - c[1], eye[2] - c[2]), P.dof ?? 0.25);
    this.stats = { simGrid: `${m.nx}x${m.ny}`, renderVerts: this.gw * this.gh, tris: this.ecount / 3, frame: +fr.toFixed(1), frames: m.frames };
  }
}
