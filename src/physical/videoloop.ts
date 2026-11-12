// Pass 4 fallback: a pre-rendered (Blender Cycles) seamless loop played back as a mode via a video texture.
// Original MIT-licensed work for flow-engine.
import { compile, QUAD_VS, type PhysFrame, type PhysScene, type Prog } from './common';
const FS = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D uTex; uniform float uAspect, uVidAspect;
vec3 lin(vec3 c){ return pow(c, vec3(2.2)); }
void main(){ vec2 uv = vUv; float k = uAspect/uVidAspect; if (k > 1.0) uv.y = (uv.y-0.5)/k+0.5; else uv.x = (uv.x-0.5)*k+0.5;
  o = vec4(lin(texture(uTex, vec2(uv.x, 1.0-uv.y)).rgb), 3.0); }`;
export class VideoLoopScene implements PhysScene {
  name = 'pour'; ready = false; error: string | null = null; stats: Record<string, any> = {};
  private video: HTMLVideoElement | null = null; private tex: WebGLTexture; private p: Prog; private vao: WebGLVertexArrayObject;
  constructor(private gl: WebGL2RenderingContext, private url: string) {
    this.p = compile(gl, QUAD_VS, FS, 'videoloop'); this.vao = gl.createVertexArray()!;
    this.tex = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  load() {
    if (this.video || typeof document === 'undefined') return;
    const v = document.createElement('video'); v.src = this.url; v.loop = true; v.muted = true; v.playsInline = true; v.crossOrigin = 'anonymous';
    v.addEventListener('canplay', () => { this.ready = true; v.play().catch(() => {}); });
    v.addEventListener('error', () => { this.error = `video ${this.url} failed`; console.warn(this.error); });
    this.video = v;
  }
  render(f: PhysFrame) {
    const gl = this.gl; const v = this.video;
    if (v && this.ready && v.readyState >= 2) {
      gl.bindTexture(gl.TEXTURE_2D, this.tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, v);
      if (f.params.paused && !v.paused) v.pause(); else if (!f.params.paused && v.paused) v.play().catch(() => {});
      v.playbackRate = Math.max(0.25, Math.min(2, f.params.speed));
    }
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, f.target); gl.viewport(0, 0, f.w, f.h);
    gl.useProgram(this.p.p); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex); gl.uniform1i(this.p.u.uTex, 0);
    gl.uniform1f(this.p.u.uAspect, f.aspect); gl.uniform1f(this.p.u.uVidAspect, v && v.videoWidth ? v.videoWidth / v.videoHeight : 16 / 9);
    gl.bindVertexArray(this.vao); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.bindVertexArray(null);
    this.stats = { video: this.url, t: v ? +v.currentTime.toFixed(2) : 0 };
  }
}
