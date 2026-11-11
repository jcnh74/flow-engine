// Render graph: FBO/texture pool, shared fullscreen triangle, uniform blocks
// Supports linear HDR workflow with RGBA16F targets

export interface RenderTarget {
  fbo: WebGLFramebuffer;
  texture: WebGLTexture;
  width: number;
  height: number;
  format: 'RGBA8' | 'RGBA16F';
}

export interface UniformBlock {
  buffer: WebGLBuffer;
  binding: number;
  data: Float32Array;
}

export class RenderGraph {
  private gl: WebGL2RenderingContext;
  private targetPool: Map<string, RenderTarget> = new Map();
  private vao: WebGLVertexArrayObject;
  
  // Shared uniform blocks
  public timeBlock: UniformBlock;
  public audioBlock: UniformBlock;
  
  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    
    // Create shared fullscreen triangle VAO (no VBO needed with gl_VertexID)
    const vao = gl.createVertexArray();
    if (!vao) throw new Error('Failed to create VAO');
    this.vao = vao;
    gl.bindVertexArray(vao);
    gl.bindVertexArray(null);
    
    // Create uniform blocks
    this.timeBlock = this.createUniformBlock(0, 16); // time, dt, beatPhase, bar, barPhase, phrase, etc.
    this.audioBlock = this.createUniformBlock(1, 32); // kick, snare, hat, bass, mid, high, onset, etc.
  }
  
  private createUniformBlock(binding: number, floatCount: number): UniformBlock {
    const buffer = this.gl.createBuffer();
    if (!buffer) throw new Error('Failed to create uniform buffer');
    
    this.gl.bindBuffer(this.gl.UNIFORM_BUFFER, buffer);
    this.gl.bufferData(this.gl.UNIFORM_BUFFER, floatCount * 4, this.gl.DYNAMIC_DRAW);
    this.gl.bindBufferBase(this.gl.UNIFORM_BUFFER, binding, buffer);
    this.gl.bindBuffer(this.gl.UNIFORM_BUFFER, null);
    
    return {
      buffer,
      binding,
      data: new Float32Array(floatCount)
    };
  }
  
  updateUniformBlock(block: UniformBlock): void {
    this.gl.bindBuffer(this.gl.UNIFORM_BUFFER, block.buffer);
    this.gl.bufferSubData(this.gl.UNIFORM_BUFFER, 0, block.data);
    this.gl.bindBuffer(this.gl.UNIFORM_BUFFER, null);
  }
  
  getOrCreateTarget(key: string, width: number, height: number, format: 'RGBA8' | 'RGBA16F' = 'RGBA16F'): RenderTarget {
    const existing = this.targetPool.get(key);
    if (existing && existing.width === width && existing.height === height && existing.format === format) {
      return existing;
    }
    
    // Clean up old target if exists
    if (existing) {
      this.gl.deleteFramebuffer(existing.fbo);
      this.gl.deleteTexture(existing.texture);
    }
    
    const target = this.createTarget(width, height, format);
    this.targetPool.set(key, target);
    return target;
  }
  
  private createTarget(width: number, height: number, format: 'RGBA8' | 'RGBA16F'): RenderTarget {
    const gl = this.gl;
    
    const texture = gl.createTexture();
    if (!texture) throw new Error('Failed to create texture');
    
    gl.bindTexture(gl.TEXTURE_2D, texture);
    
    const internalFormat = format === 'RGBA16F' ? gl.RGBA16F : gl.RGBA8;
    const dataFormat = gl.RGBA;
    const dataType = format === 'RGBA16F' ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;
    
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, dataFormat, dataType, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    
    const fbo = gl.createFramebuffer();
    if (!fbo) throw new Error('Failed to create framebuffer');
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(`Framebuffer incomplete: ${status}`);
    }
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    
    return { fbo, texture, width, height, format };
  }
  
  bindVAO(): void {
    this.gl.bindVertexArray(this.vao);
  }
  
  drawFullscreenTriangle(): void {
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 3);
  }
  
  cleanup(): void {
    for (const [, target] of this.targetPool) {
      this.gl.deleteFramebuffer(target.fbo);
      this.gl.deleteTexture(target.texture);
    }
    this.targetPool.clear();
    
    this.gl.deleteBuffer(this.timeBlock.buffer);
    this.gl.deleteBuffer(this.audioBlock.buffer);
    this.gl.deleteVertexArray(this.vao);
  }
}

// Convert sRGB color to linear
export function srgbToLinear(srgb: number): number {
  return srgb <= 0.04045 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
}

export function hexToLinear(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];
}
