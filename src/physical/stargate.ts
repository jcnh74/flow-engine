// Pass 4 "Stargate": an original real-time slit-scan corridor (after Douglas Trumbull's 1968 technique).
// Two infinite planes (above/below, or left/right walls) carry procedural "backlit artwork". The slit-scan
// streak is reproduced by integrating that artwork along the direction of travel over an exposure window that
// grows with distance (what a camera dollying toward a moving slit records in one long exposure), plus
// per-pixel stochastic sub-frame time (true motion blur) and a short temporal accumulation.
// Original MIT-licensed work for flow-engine. No Shadertoy code.
import { compile, fbo, deleteFB, QUAD_VS, lookOf, lin, type FB, type PhysFrame, type PhysScene, type Prog } from './common';

const FS = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform vec2 uRes; uniform float uTime, uSpeed, uStreak, uDt, uAspect, uPlanes, uFamily, uExposure, uBands;
uniform vec3 uPal[7];
uniform sampler2D uHist; uniform float uHistW;
float h11(float p){ p = fract(p*0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec3 pal(float x){ x = fract(x)*7.0; int i = int(x); float f = fract(x); f = f*f*(3.0-2.0*f); return mix(uPal[i%7], uPal[(i+1)%7], f); }
// soft emissive line of half-width w (in band units), AA width aa
float line(float x, float w, float aa){ return 1.0 - smoothstep(w, w+aa, abs(x)); }
// The "artwork" behind the slit: lateral coordinate a (across the plane), travel coordinate s.
vec3 art(float a, float s, float side, float aa, float fam){
  float B = a*uBands; float b = floor(B); float x = fract(B)-0.5;
  float seg = 1.6 + 2.5*h11(b*3.1 + side*17.0);
  float k = floor(s/seg + h11(b+side*5.0)*7.0);
  float on = step(0.32, h21(vec2(b, k) + side*13.0));
  float lum = on*(0.35 + 1.4*pow(h21(vec2(k, b*1.7)), 2.0));
  vec3 c = pal(b*0.073 + k*0.021 + side*0.31 + uTime*0.012);
  // family 0: luminous ribbons of different widths
  float w0 = 0.06 + 0.3*h11(b*7.7+k);
  vec3 r0 = c*lum*line(x, w0, aa);
  // family 1: lattice of dots (streaks into dashes) on a finer grid
  float B2 = a*uBands*2.6; float x2 = fract(B2)-0.5; float s2 = fract(s*2.2 + h11(floor(B2))*3.0)-0.5;
  vec3 r1 = pal(floor(B2)*0.05 + side*0.4 + uTime*0.02) * line(length(vec2(x2, s2)), 0.11, aa) * step(0.45, h11(floor(B2)*1.3 + floor(s*2.2)));
  // family 2: moire wave bands (interference of two gratings)
  float m = 0.5 + 0.5*sin(a*uBands*6.2831*0.9 + 3.0*sin(s*0.35 + side*2.0)) * sin(a*uBands*6.2831*1.13 - s*0.7);
  vec3 r2 = pal(a*0.11 + s*0.01 + side*0.2) * smoothstep(0.55, 0.95, m) * 1.2;
  float f0 = clamp(1.0-abs(fam-0.0), 0.0, 1.0) + clamp(1.0-abs(fam-3.0), 0.0, 1.0), f1 = clamp(1.0-abs(fam-1.0), 0.0, 1.0), f2 = clamp(1.0-abs(fam-2.0), 0.0, 1.0);
  return r0*f0 + r1*f1*1.6 + r2*f2;
}
void main(){
  vec2 uv = vUv*2.0-1.0; uv.x *= uAspect;
  // ordered (4x4 Bayer) jitter rotated every frame instead of white noise: the sub-frame / exposure offsets are
  // spread evenly over each 4x4 block and the temporal history averages them out -> no grain at the vanishing point
  ivec2 bp = ivec2(gl_FragCoord.xy) & 3;
  const float BAYER[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  float bay = (BAYER[bp.y*4 + bp.x] + 0.5)/16.0;
  float jit = fract(bay + fract(uTime*7.31)*0.618);
  float tt = uTime + (jit-0.5)*uDt*uExposure;            // stochastic sub-frame time = motion blur
  float sway = 0.035*sin(tt*0.23);
  vec3 rd = normalize(vec3(uv.x*0.62 + sway, uv.y*0.62, 1.0));
  float vert = step(0.5, uPlanes);
  float across = mix(rd.y, rd.x, vert);                  // axis that hits a plane
  float lateral = mix(rd.x, rd.y, vert);
  float side = across > 0.0 ? 1.0 : 0.0;
  float t = 1.0/max(abs(across), 1e-4);
  float z = rd.z*t;                                      // distance along the corridor
  float a = lateral*t;
  float travel = tt*uSpeed;
  float aa = clamp(fwidth(a)*uBands*1.5, 0.002, 0.5);
  // slit-scan exposure: integrate the artwork forward along travel; the window grows with depth
  float E = uStreak*(0.6 + 0.12*z);
  vec3 acc = vec3(0.0); float wsum = 0.0;
  float j2 = fract(bay*0.73 + 0.381*floor(uTime*60.0));
  for (int i=0;i<28;i++){
    float u = (float(i)+j2)/28.0;
    float w = exp(-2.2*u);
    acc += art(a, z + travel + u*E, side, aa, uFamily)*w; wsum += w;
  }
  vec3 col = acc/wsum;
  // far field: the pattern is finer than a pixel, so resolve it to its average colour instead of aliasing
  float far = max(smoothstep(0.06, 0.3, aa), smoothstep(16.0, 42.0, z));
  col = mix(col, pal(a*0.05 + side*0.3 + uTime*0.02)*0.45, far);
  // distance: streaks converge into a bright horizon line; near streaks rush past and blow out
  float near = exp(-z*0.09);
  col *= 0.5 + 1.5*near;
  float horizon = exp(-abs(across)*28.0);
  col += pal(uTime*0.03 + 0.5)*horizon*0.9 + vec3(1.0)*exp(-abs(across)*140.0)*0.8;
  col *= smoothstep(0.0, 0.02, abs(across)) * 0.85 + 0.15;
  col = max(col, 0.0);
  vec3 prev = texture(uHist, vUv).rgb;
  float hw = uHistW > 0.0 ? mix(uHistW, 0.82, smoothstep(8.0, 40.0, z)) : 0.0;   // more temporal averaging where motion is slow
  o = vec4(mix(col, prev, hw), 1.0);
}`;
const COPY_FS = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D uSrc; uniform float uGain;
void main(){ vec3 c = texture(uSrc, vUv).rgb; o = vec4(c*uGain, 1.0); }`;

export const STARGATE_PALETTES: Record<string, string[]> = {
  'Kubrick': ['#ff2a1a', '#ffb000', '#1fd2ff', '#ff3fd0', '#3cff6a', '#3a3cff', '#ffe9a0'],
  'Jupiter': ['#ff6a00', '#ffcf3a', '#c2185b', '#7b1fff', '#00b8d4', '#ff3d00', '#ffe0b2'],
};

export class StargateScene implements PhysScene {
  name = 'stargate'; ready = false; error: string | null = null; stats: Record<string, any> = {};
  private p: Prog; private copy: Prog; private hist: [FB, FB] | null = null; private vao: WebGLVertexArrayObject; private i = 0;
  constructor(private gl: WebGL2RenderingContext) {
    this.p = compile(gl, QUAD_VS, FS, 'stargate'); this.copy = compile(gl, QUAD_VS, COPY_FS, 'stargate-copy');
    this.vao = gl.createVertexArray()!; this.ready = true;
  }
  load() {}
  render(f: PhysFrame) {
    const gl = this.gl, P = f.params;
    if (!this.hist || this.hist[0].w !== f.w || this.hist[0].h !== f.h) {
      if (this.hist) { deleteFB(gl, this.hist[0]); deleteFB(gl, this.hist[1]); }
      this.hist = [fbo(gl, f.w, f.h), fbo(gl, f.w, f.h)];
    }
    const src = this.hist[this.i], dst = this.hist[1 - this.i]; this.i = 1 - this.i;
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.f); gl.viewport(0, 0, f.w, f.h);
    gl.useProgram(this.p.p); const u = this.p.u;
    gl.uniform2f(u.uRes, f.w, f.h); gl.uniform1f(u.uTime, f.time); gl.uniform1f(u.uAspect, f.aspect);
    gl.uniform1f(u.uSpeed, 9.0 * P.speed); gl.uniform1f(u.uStreak, 3.0 * (P.streak ?? 1)); gl.uniform1f(u.uDt, Math.max(f.dt, 1 / 60));
    gl.uniform1f(u.uExposure, 1.0); gl.uniform1f(u.uBands, P.bands ?? 1.4);
    gl.uniform1f(u.uPlanes, P.variant === 'Walls' ? 1 : 0);
    // artwork family crossfades every ~10 s (0 -> 1 -> 2 -> 3(=0)), seamless 40 s cycle
    const cyc = (f.time / 10) % 4; const fr = cyc - Math.floor(cyc); const fam = Math.floor(cyc) + Math.min(1, Math.max(0, (fr - 0.75) / 0.25));
    gl.uniform1f(u.uFamily, P.family >= 0 ? P.family : fam);
    const palName = P.palette && STARGATE_PALETTES[P.palette] ? P.palette : null;
    const hexes = palName ? STARGATE_PALETTES[palName] : lookOf(P.look).slots;
    const flat = new Float32Array(21); hexes.forEach((h, k) => flat.set(lin(h, 1.0), k * 3)); gl.uniform3fv(u['uPal[0]'], flat);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.t); gl.uniform1i(u.uHist, 0); gl.uniform1f(u.uHistW, P.paused ? 0.0 : 0.45);
    gl.bindVertexArray(this.vao); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, f.target); gl.viewport(0, 0, f.w, f.h);
    gl.useProgram(this.copy.p); gl.bindTexture(gl.TEXTURE_2D, dst.t); gl.uniform1i(this.copy.u.uSrc, 0); gl.uniform1f(this.copy.u.uGain, P.exposure ?? 1.0);
    gl.drawArrays(gl.TRIANGLES, 0, 3); gl.bindVertexArray(null);
    this.stats = { family: +fam.toFixed(2), planes: P.variant === 'Walls' ? 'walls' : 'floor+ceiling' };
  }
}
