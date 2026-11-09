// Trippy visualizer shaders for DJ use

export const trippyVert = `#version 300 es
const vec2 P[3] = vec2[3](vec2(-1,-1), vec2(3,-1), vec2(-1,3));
out vec2 vUv;
void main() {
  vec2 p = P[gl_VertexID];
  vUv = p * 0.5 + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
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

// VJ Controls
uniform float uTunnelTwist;
uniform float uTunnelRings;
uniform float uTunnelFov;
uniform float uTunnelWarp;
uniform float uKaleidoSegments;
uniform float uKaleidoZoom;
uniform float uKaleidoRotation;
uniform float uKaleidoFeedback;
uniform float uPlasmaScale;
uniform float uPlasmaWarp;
uniform float uPlasmaFlow;
uniform float uPlasmaContrast;
uniform float uMorphBlobs;
uniform float uMorphSmooth;
uniform float uMorphRate;
uniform float uMorphGlow;

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
  
  // Apply FOV control
  p /= uTunnelFov;
  
  // Polar coordinates
  float r = length(p);
  float a = atan(p.y, p.x);
  
  // Tunnel depth (kick-driven speed)
  float speed = uSpeed * (1.0 + uKickStrength * 2.0);
  float z = uTime * speed + r;
  
  // Apply twist
  a += z * uTunnelTwist;
  
  // Domain warp
  r += sin(z * 5.0) * uTunnelWarp * 0.1;
  
  // Tunnel layers with controllable rings
  float tunnel = mod(z * uTunnelRings * 0.25, 1.0);
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
  
  // Apply zoom
  p /= uKaleidoZoom;
  
  // Polar coords
  float r = length(p);
  float a = atan(p.y, p.x);
  
  // Apply rotation
  a += uTime * uKaleidoRotation;
  
  // Kaleidoscope mirrors with controllable segments
  float segments = uKaleidoSegments;
  a = mod(a, 3.14159 * 2.0 / segments);
  a = abs(a - 3.14159 / segments);
  
  // Reconstruct position
  vec2 kp = vec2(cos(a), sin(a)) * r;
  
  // Animated pattern with feedback
  float fb = uKaleidoFeedback;
  float pattern = sin(kp.x * 10.0 * fb + uTime) * sin(kp.y * 10.0 * fb - uTime * 0.7);
  pattern += sin(length(kp) * 8.0 * fb - uTime * 2.0) * 0.5;
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
  
  // Apply scale
  p *= uPlasmaScale;
  
  float t = uTime * uSpeed * uPlasmaFlow;
  
  // Domain warping with controllable strength
  p += vec2(sin(p.y * 2.0 + t), cos(p.x * 2.0 + t * 0.7)) * uPlasmaWarp * 0.3;
  p += vec2(sin(p.x * 3.0 - t * 0.5), sin(p.y * 3.0 + t * 0.3)) * uPlasmaWarp * 0.2;
  
  // Layered sine waves
  float plasma = 0.0;
  plasma += sin(p.x * 3.0 + t);
  plasma += sin(p.y * 4.0 - t * 0.7);
  plasma += sin((p.x + p.y) * 2.5 + t * 0.5);
  plasma += sin(length(p) * 5.0 - t * 2.0);
  plasma /= 4.0;
  plasma = plasma * 0.5 + 0.5;
  
  // Apply contrast
  plasma = pow(plasma, 1.0 / uPlasmaContrast);
  
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
  
  float t = uTime * uSpeed * uMorphRate;
  
  // Animated blob centers based on blob count
  int blobCount = int(uMorphBlobs);
  float field = 0.0;
  
  for (int i = 0; i < 6; i++) {
    if (i >= blobCount) break;
    float fi = float(i);
    vec2 center = vec2(
      sin(t * (0.5 + fi * 0.2)) * 1.5,
      cos(t * (0.3 + fi * 0.15)) * 1.2
    );
    float dist = length(p - center);
    field += 1.0 / max(dist, 0.1);
  }
  
  field *= 1.0 + uBassLevel * 0.5;
  
  // Smoothness control
  float threshold = 2.0 + uMorphSmooth * 2.0;
  float shape = smoothstep(threshold, threshold + 1.0, field);
  float edge = smoothstep(threshold + 0.5, threshold + 0.7, field);
  
  // Color
  vec3 col = getPaletteColor(field * 0.1 + uTime * 0.05);
  col = mix(col * 0.2, col, shape);
  col += edge * getPaletteColor(uTime * 0.1) * uMorphGlow;
  
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
