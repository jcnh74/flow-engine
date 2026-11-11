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
// Smoothed audio envelopes
uniform float uKickEnv;
uniform float uSnareEnv;
uniform float uHatEnv;
uniform float uBassEnv;
uniform float uMidEnv;
uniform float uHighEnv;
uniform float uOnset;
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
  
  // Tunnel depth (kick-driven speed using smoothed envelope)
  float speed = uSpeed * (1.0 + uKickEnv * 2.0);
  float z = uTime * speed + r;
  
  // Apply twist (hat-driven jitter)
  a += z * uTunnelTwist * (1.0 + uHatEnv * 0.5);
  
  // Domain warp (bass-driven)
  r += sin(z * 5.0) * uTunnelWarp * 0.1 * (1.0 + uBassEnv * 0.3);
  
  // Create SPARSE bright arms/rings on BLACK (like Kaleido/Plasma)
  // This gives luma key dark regions to contrast against
  
  // Thin bright rings: pow(1 - abs(sin(z)), 8)
  float ringPhase = z * uTunnelRings * 0.25;
  float rings = pow(1.0 - abs(sin(ringPhase * 3.14159)), 8.0);
  
  // Thin bright spiral arms: pow(1 - abs(sin(a * segments + z)), 8)
  float segments = 8.0;
  float armPhase = a / (3.14159 * 2.0) * segments + z * 0.5;
  float arms = pow(1.0 - abs(sin(armPhase * 3.14159)), 8.0);
  
  // Combine: sparse bright structure on black
  float structure = max(rings * 0.7, arms * 0.6);
  
  // Color from palette
  vec3 col = getPaletteColor(z * 0.1 + r * 0.3);
  
  // Apply structure mask (creates black background with bright arms/rings)
  col *= structure * (1.0 + uKickEnv * 1.5 + uOnset * 2.5);
  
  // Smaller center glow (not dominant)
  float glow = 1.0 / (1.0 + r * r * 4.0);
  col += glow * getPaletteColor(uTime * 0.1) * structure * (0.5 + uOnset * 1.0);
  
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
  
  // Create SPARSE bright segments on BLACK before kaleido fold
  // This gives the luma key dark regions to contrast against
  float fb = uKaleidoFeedback * (1.0 + uMidEnv * 0.3);
  
  // Radial lines (bright spokes)
  float spokeAngle = mod(a * segments * 2.0, 6.28318);
  float spokes = pow(1.0 - abs(sin(spokeAngle * 0.5)), 12.0);
  
  // Concentric rings (bright circles)
  float rings = pow(1.0 - abs(sin(r * 8.0 * fb - uTime * 2.0)), 8.0);
  
  // Combine: sparse bright lines on black
  float pattern = max(spokes * 0.7, rings * 0.5);
  
  // Animated modulation
  pattern *= (0.5 + 0.5 * sin(kp.x * 5.0 * fb + uTime)) * (0.5 + 0.5 * sin(kp.y * 5.0 * fb - uTime * 0.7));
  
  // Color - linear HDR with emissive highlights
  vec3 col = getPaletteColor(pattern * 0.5 + uTime * 0.05 + r * 0.2);
  
  // HDR boost (lower than before, exposure will be ~1.0 in preset)
  col *= pattern * (1.0 + uKickEnv * 1.5 + uOnset * 3.0 + uHighEnv * 0.8);
  
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
  
  // Key plasma bands into THIN BRIGHT RIDGES instead of full-field wash
  // Creates dark regions for luma key contrast
  float plasma = 0.0;
  plasma += sin(p.x * 3.0 + t);
  plasma += sin(p.y * 4.0 - t * 0.7);
  plasma += sin((p.x + p.y) * 2.5 + t * 0.5);
  plasma += sin(length(p) * 5.0 - t * 2.0);
  plasma /= 4.0;
  
  // Sharpen into thin ridges: pow(1 - abs(sin(v)), 8)
  // This creates sparse bright bands on black background
  float ridges = pow(1.0 - abs(sin(plasma * 3.14159)), 8.0);
  
  // Apply contrast
  ridges = pow(ridges, 1.0 / uPlasmaContrast);
  
  // Bass modulation using envelope
  ridges += uBassEnv * 0.2;
  
  // Color from palette - linear HDR (use original plasma for color variation)
  vec3 col = getPaletteColor(plasma * 0.5 + 0.5 + uTime * 0.02);
  
  // HDR boost (lower, exposure will be ~1.0)
  col *= ridges * (1.0 + uMidEnv * 1.0 + uHighEnv * 1.0);
  
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
  
  field *= 1.0 + uBassEnv * 0.8;
  
  // Smoothness control
  float threshold = 2.0 + uMorphSmooth * 2.0;
  float shape = smoothstep(threshold, threshold + 1.0, field);
  float edge = smoothstep(threshold + 0.5, threshold + 0.7, field);
  
  // Color - linear HDR
  vec3 col = getPaletteColor(field * 0.1 + uTime * 0.05);
  col = mix(col * 0.3, col * 1.5, shape);
  
  // HDR edge glow (emissive 2-8 range)
  col += edge * getPaletteColor(uTime * 0.1) * uMorphGlow * (2.0 + uOnset * 6.0);
  
  // Kick pulse (HDR boost)
  col *= (1.2 + uKickEnv * 1.5 + uSnareEnv * 0.8);
  
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
