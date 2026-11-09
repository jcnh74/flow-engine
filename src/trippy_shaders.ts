// Trippy visualizer shaders for DJ use

export const trippyVert = `#version 300 es
in vec2 position;
out vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

export const trippyFrag = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

// Uniforms
uniform float uTime;
uniform int uMode; // 0=Tunnel, 1=Kaleido, 2=Plasma, 3=Morph
uniform vec2 uResolution;
uniform float uKickStrength;
uniform float uBassLevel;
uniform float uSpeed;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform float uHueShift;
uniform int uPaletteSize;
uniform vec3 uPalette[8];

// HSV to RGB
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// Palette lookup with cycling
vec3 getPaletteColor(float t) {
  if (uPaletteSize < 1) return vec3(0.5);
  t = fract(t + uHueShift);
  float idx = t * float(uPaletteSize - 1);
  int i0 = int(floor(idx));
  int i1 = (i0 + 1) % uPaletteSize;
  return mix(uPalette[i0], uPalette[i1], fract(idx));
}

// ===== TUNNEL MODE =====
vec3 renderTunnel(vec2 uv) {
  vec2 p = (uv - 0.5) * 2.0;
  float aspect = uResolution.x / uResolution.y;
  p.x *= aspect;
  
  // Polar coordinates
  float r = length(p);
  float a = atan(p.y, p.x);
  
  // Tunnel depth (kick-driven speed)
  float speed = uSpeed * (1.0 + uKickStrength * 2.0);
  float z = uTime * speed + r;
  
  // Tunnel layers
  float tunnel = mod(z * 2.0, 1.0);
  float rings = smoothstep(0.3, 0.7, tunnel);
  
  // Rotating segments
  float segments = 8.0;
  float seg = mod(a / (3.14159 * 2.0) * segments + z * 0.5, 1.0);
  float pattern = smoothstep(0.4, 0.6, seg);
  
  // Color from palette
  vec3 col = getPaletteColor(z * 0.1 + r * 0.3);
  col *= (0.5 + rings * 0.5 + pattern * 0.3);
  
  // Glow at center
  float glow = 1.0 / (1.0 + r * r * 4.0);
  col += glow * getPaletteColor(uTime * 0.1) * 0.5;
  
  return col;
}

// ===== KALEIDOSCOPE MODE =====
vec3 renderKaleido(vec2 uv) {
  vec2 p = (uv - 0.5) * 2.0;
  float aspect = uResolution.x / uResolution.y;
  p.x *= aspect;
  
  // Polar coords
  float r = length(p);
  float a = atan(p.y, p.x);
  
  // Kaleidoscope mirrors
  float segments = 6.0 + floor(uBassLevel * 4.0);
  a = mod(a, 3.14159 * 2.0 / segments);
  a = abs(a - 3.14159 / segments);
  
  // Reconstruct position
  vec2 kp = vec2(cos(a), sin(a)) * r;
  
  // Animated pattern
  float pattern = sin(kp.x * 10.0 + uTime) * sin(kp.y * 10.0 - uTime * 0.7);
  pattern += sin(length(kp) * 8.0 - uTime * 2.0) * 0.5;
  pattern = pattern * 0.5 + 0.5;
  
  // Color
  vec3 col = getPaletteColor(pattern * 0.5 + uTime * 0.05 + r * 0.2);
  
  // Pulse on kick
  col *= 1.0 + uKickStrength * 0.5;
  
  return col;
}

// ===== PLASMA/LIQUID MODE =====
vec3 renderPlasma(vec2 uv) {
  vec2 p = (uv - 0.5) * 3.0;
  float aspect = uResolution.x / uResolution.y;
  p.x *= aspect;
  
  float t = uTime * uSpeed;
  
  // Domain warping
  p += vec2(sin(p.y * 2.0 + t), cos(p.x * 2.0 + t * 0.7)) * 0.3;
  p += vec2(sin(p.x * 3.0 - t * 0.5), sin(p.y * 3.0 + t * 0.3)) * 0.2;
  
  // Layered sine waves
  float plasma = 0.0;
  plasma += sin(p.x * 3.0 + t);
  plasma += sin(p.y * 4.0 - t * 0.7);
  plasma += sin((p.x + p.y) * 2.5 + t * 0.5);
  plasma += sin(length(p) * 5.0 - t * 2.0);
  plasma /= 4.0;
  plasma = plasma * 0.5 + 0.5;
  
  // Bass modulation
  plasma += uBassLevel * 0.2;
  
  // Color from palette
  vec3 col = getPaletteColor(plasma + uTime * 0.02);
  
  return col;
}

// ===== MORPH MODE (metaballs) =====
vec3 renderMorph(vec2 uv) {
  vec2 p = (uv - 0.5) * 4.0;
  float aspect = uResolution.x / uResolution.y;
  p.x *= aspect;
  
  float t = uTime * uSpeed;
  
  // Animated blob centers
  vec2 b1 = vec2(sin(t) * 1.5, cos(t * 0.7) * 1.2);
  vec2 b2 = vec2(cos(t * 0.5) * 1.3, sin(t * 0.3) * 1.5);
  vec2 b3 = vec2(sin(t * 0.3) * 1.0, cos(t * 0.5) * 1.0);
  
  // Metaball formula
  float d1 = 1.0 / length(p - b1);
  float d2 = 1.0 / length(p - b2);
  float d3 = 1.0 / length(p - b3);
  
  float field = d1 + d2 + d3;
  field *= 1.0 + uBassLevel * 0.5;
  
  // Threshold for shape
  float shape = smoothstep(2.0, 3.0, field);
  float edge = smoothstep(2.5, 2.7, field);
  
  // Color
  vec3 col = getPaletteColor(field * 0.1 + uTime * 0.05);
  col = mix(col * 0.2, col, shape);
  col += edge * getPaletteColor(uTime * 0.1) * 2.0;
  
  // Kick pulse
  col *= 1.0 + uKickStrength * 0.3;
  
  return col;
}

void main() {
  vec3 col = vec3(0.0);
  
  if (uMode == 0) {
    col = renderTunnel(vUv);
  } else if (uMode == 1) {
    col = renderKaleido(vUv);
  } else if (uMode == 2) {
    col = renderPlasma(vUv);
  } else if (uMode == 3) {
    col = renderMorph(vUv);
  }
  
  fragColor = vec4(col, 1.0);
}
`;
