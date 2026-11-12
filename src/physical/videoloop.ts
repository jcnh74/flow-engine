// Pre-rendered (Blender Cycles) seamless loops played back as a mode via a video texture, with live grade
// controls (saturation, hue shift, exposure, slow push-in + drift). Clips: Paint Splash (pass 6), Paint Pour (pass 5).
// Original MIT-licensed work for flow-engine.
import { compile, QUAD_VS, type PhysFrame, type PhysScene, type Prog } from './common';
const FS = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D uTex; uniform float uAspect, uVidAspect, uSat, uHue, uExp, uZoom; uniform vec2 uPan;
vec3 lin(vec3 c){ return pow(c, vec3(2.2)); }
vec3 hueRot(vec3 c, float h){ // rotate hue around the grey axis (Rodrigues)
  const vec3 k = vec3(0.57735); float a = h*6.2831853; float ca = cos(a), sa = sin(a);
  return c*ca + cross(k, c)*sa + k*dot(k, c)*(1.0-ca); }
void main(){ vec2 uv = vUv; float k = uAspect/uVidAspect; if (k > 1.0) uv.y = (uv.y-0.5)/k+0.5; else uv.x = (uv.x-0.5)*k+0.5;
  uv = (uv - 0.5)/uZoom + 0.5 + uPan;
  vec3 c = texture(uTex, vec2(uv.x, 1.0-uv.y)).rgb;
  if (abs(uHue) > 1e-3) c = clamp(hueRot(c, uHue), 0.0, 1.0);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); c = clamp(mix(vec3(l), c, uSat), 0.0, 1.0);
  o = vec4(lin(c)*uExp, 3.0); }`;
export const VIDEO_CLIPS: Record<string, string> = { Splash: '/pass4/paint_splash.mp4', Pour: '/pass4/paint_pour.mp4' };
export class VideoLoopScene implements PhysScene {
  name = 'pour'; ready = false; error: string | null = null; stats: Record<string, any> = {};
  private videos: Record<string, HTMLVideoElement> = {}; private cur = ''; private tex: WebGLTexture; private p: Prog; private vao: WebGLVertexArrayObject;
  constructor(private gl: WebGL2RenderingContext, private url: string) {
    this.p = compile(gl, QUAD_VS, FS, 'videoloop'); this.vao = gl.createVertexArray()!;
    this.tex = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  private video(url: string): HTMLVideoElement | null {
    if (typeof document === 'undefined') return null;
    if (this.videos[url]) return this.videos[url];
    const v = document.createElement('video'); v.src = url; v.loop = true; v.muted = true; v.playsInline = true; v.crossOrigin = 'anonymous';
    v.addEventListener('canplay', () => { this.ready = true; v.play().catch(() => {}); });
    v.addEventListener('error', () => { this.error = `video ${url} failed`; console.warn(this.error); });
    this.videos[url] = v; return v;
  }
  load() { this.video(this.url); }
  render(f: PhysFrame) {
    const gl = this.gl; const P = f.params;
    const url = VIDEO_CLIPS[P.ppClip as string] ?? this.url;
    const v = this.video(url);
    if (url !== this.cur) { for (const [k, o] of Object.entries(this.videos)) if (k !== url) o.pause(); this.cur = url; }
    if (v && v.readyState >= 2) {
      gl.bindTexture(gl.TEXTURE_2D, this.tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, v);
      if (P.paused && !v.paused) v.pause(); else if (!P.paused && v.paused) v.play().catch(() => {});
      v.playbackRate = Math.max(0.25, Math.min(2, P.speed));
    }
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, f.target); gl.viewport(0, 0, f.w, f.h);
    const u = this.p.u; gl.useProgram(this.p.p); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex); gl.uniform1i(u.uTex, 0);
    gl.uniform1f(u.uAspect, f.aspect); gl.uniform1f(u.uVidAspect, v && v.videoWidth ? v.videoWidth / v.videoHeight : 16 / 9);
    const drift = P.ppDrift ?? 0; const z = (P.ppZoom ?? 1) * (1 + 0.04 * drift * (0.5 + 0.5 * Math.sin(f.time * 0.21)));
    gl.uniform1f(u.uSat, P.ppSat ?? 1); gl.uniform1f(u.uHue, P.ppHue ?? 0); gl.uniform1f(u.uExp, P.ppExposure ?? 1); gl.uniform1f(u.uZoom, Math.max(1, z));
    gl.uniform2f(u.uPan, 0.02 * drift * Math.sin(f.time * 0.13), 0.012 * drift * Math.sin(f.time * 0.17));
    gl.bindVertexArray(this.vao); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.bindVertexArray(null);
    this.stats = { video: url, t: v ? +v.currentTime.toFixed(2) : 0 };
  }
}
