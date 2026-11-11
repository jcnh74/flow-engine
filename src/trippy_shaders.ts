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
uniform float uSat;
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

// YIQ hue rotation (proper hue shift that moves color bins)
vec3 rotateHue(vec3 col, float degrees) {
  if (abs(degrees) < 0.001) return col;
  float angle = radians(degrees);
  float s = sin(angle);
  float c = cos(angle);
  
  // RGB to YIQ
  float y = dot(col, vec3(0.299, 0.587, 0.114));
  float i = dot(col, vec3(0.596, -0.274, -0.322));
  float q = dot(col, vec3(0.211, -0.523, 0.312));
  
  // Rotate I and Q
  float i2 = i * c - q * s;
  float q2 = i * s + q * c;
  
  // YIQ to RGB
  vec3 result = vec3(
    y + 0.956 * i2 + 0.621 * q2,
    y - 0.272 * i2 - 0.647 * q2,
    y - 1.106 * i2 + 1.703 * q2
  );
  
  return max(result, vec3(0.0)); // Clamp negative values
}

// OKLab RGB-to-Lab conversion for perceptual saturation scaling
vec3 rgbToOklab(vec3 rgb) {
  // Linear RGB to LMS
  float l = 0.4122214708 * rgb.r + 0.5363325363 * rgb.g + 0.0514459929 * rgb.b;
  float m = 0.2119034982 * rgb.r + 0.6806995451 * rgb.g + 0.1073969566 * rgb.b;
  float s = 0.0883024619 * rgb.r + 0.2817188376 * rgb.g + 0.6299787005 * rgb.b;
  
  // Nonlinear transform
  l = pow(l, 1.0 / 3.0);
  m = pow(m, 1.0 / 3.0);
  s = pow(s, 1.0 / 3.0);
  
  // LMS to Lab
  return vec3(
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
  );
}

vec3 oklabToRgb(vec3 lab) {
  // Lab to LMS
  float l = lab.x + 0.3963377774 * lab.y + 0.2158037573 * lab.z;
  float m = lab.x - 0.1055613458 * lab.y - 0.0638541728 * lab.z;
  float s = lab.x - 0.0894841775 * lab.y - 1.2914855480 * lab.z;
  
  // Nonlinear inverse
  l = l * l * l;
  m = m * m * m;
  s = s * s * s;
  
  // LMS to RGB
  return vec3(
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  );
}

// SHARED COLOR FINISH: Apply saturation and hue rotation to ANY color
// This ensures ALL code paths (Tunnel/Kaleido/Plasma/Morph) get transforms
// No early returns allowed - all branches must flow through this
vec3 applyColorTransforms(vec3 col) {
  // Apply scene saturation using OKLab chroma scaling for uSat > 1.0
  // This gives perceptually strong saturation without RGB clamping artifacts
  // R25: Strengthened scaling (squared) to achieve dS >= 0.08 for sat=2
  if (uSat > 1.01) {
    vec3 lab = rgbToOklab(max(col, vec3(0.0)));
    float chroma = sqrt(lab.y * lab.y + lab.z * lab.z);
    if (chroma > 0.001) {
      // Stronger chroma boost: use uSat^1.5 instead of linear uSat
      // This gives sat=2.0 → chroma *= 2.83 instead of 2.0
      float chromaScale = pow(uSat, 1.5);
      float newChroma = chroma * chromaScale;
      lab.y *= newChroma / chroma;
      lab.z *= newChroma / chroma;
    }
    col = max(oklabToRgb(lab), vec3(0.0));
  } else {
    // Linear saturation for uSat <= 1.0 (desaturation or neutral)
    float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = max(mix(vec3(luma), col, uSat), vec3(0.0));
  }
  
  // Apply hue rotation (moves dominant hue bin)
  col = rotateHue(col, uHueShift * 360.0);
  
  return col;
}

// Palette lookup with cycling
// Note: uHueShift is now applied via YIQ rotation at the end, not here
vec3 getPaletteColor(float t) {
  if (uPaletteSize < 1) return vec3(0.5);
  t = fract(t); // No hueShift offset - rotateHue() handles that at the end
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
  
  // Sample palette by depth and radius
  vec3 paletteColor = getPaletteColor(z * 0.1 + r * 0.3);
  
  // Apply structure mask (creates black background with bright arms/rings)
  vec3 col = paletteColor * structure * (1.0 + uKickEnv * 1.5 + uOnset * 2.5);
  
  // Smaller center glow (not dominant)
  float glow = 1.0 / (1.0 + r * r * 4.0);
  vec3 glowColor = getPaletteColor(uTime * 0.1);
  col += glow * glowColor * structure * (0.5 + uOnset * 1.0);
  
  // SHARED FINISH: Apply saturation and hue rotation
  return applyColorTransforms(col);
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
  
  // Radial lines (bright spokes) - softer falloff for more coverage
  float spokeAngle = mod(a * segments * 2.0, 6.28318);
  float spokes = pow(1.0 - abs(sin(spokeAngle * 0.5)), 8.0);  // Was 12.0, now 8.0 for wider spokes
  
  // Concentric rings (bright circles) - softer falloff
  float rings = pow(1.0 - abs(sin(r * 8.0 * fb - uTime * 2.0)), 6.0);  // Was 8.0, now 6.0 for wider rings
  
  // Combine: softer pattern for better base coverage
  float pattern = max(spokes * 0.8, rings * 0.6);  // Increased from 0.7/0.5 to 0.8/0.6
  
  // Animated modulation - gentler for more stable base
  pattern *= (0.6 + 0.4 * sin(kp.x * 5.0 * fb + uTime)) * (0.6 + 0.4 * sin(kp.y * 5.0 * fb - uTime * 0.7));  // Was 0.5+0.5, now 0.6+0.4
  
  // Sample palette by angle and radius (with hueShift applied)
  // This colors the lines BEFORE feedback so they aren't white
  float paletteCoord = fract(a / 6.28318 + r * 0.3 + uTime * 0.05);
  vec3 paletteColor = getPaletteColor(paletteCoord);
  
  // DO NOT apply saturation here - applyColorTransforms does it at the end
  // Applying it twice would square the effect (uSat=2 becomes uSat=4)
  
  // Multiply pattern mask by colored palette (lines are now colored, not white)
  vec3 col = paletteColor * pattern;
  
  // HDR boost with visible base at silence (0.9) and audio punch
  // R23 was too dim at silence (0.5 base), R24 needs 25-60% pixels lit at silence
  // Base 0.9 ensures visibility, audio can push to 2.5 for punch without white blowout
  col *= (0.9 + uKickEnv * 0.6 + uOnset * 0.8 + uHighEnv * 0.4);
  
  // Clamp to prevent white saturation collapse (tonemap keeps colors vibrant at 2.5)
  col = min(col, vec3(2.5));
  
  // RED TINT REMOVED after GPU verification confirmed renderKaleido is live path
  
  // SHARED FINISH: Apply saturation and hue rotation
  return applyColorTransforms(col);
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
  
  // Sample palette
  vec3 paletteColor = getPaletteColor(plasma * 0.5 + 0.5 + uTime * 0.02);
  
  // HDR boost (lower, exposure will be ~1.0)
  vec3 col = paletteColor * ridges * (1.0 + uMidEnv * 1.0 + uHighEnv * 1.0);
  
  // SHARED FINISH: Apply saturation and hue rotation
  return applyColorTransforms(col);
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
  
  // Sample palette
  vec3 paletteColor = getPaletteColor(field * 0.1 + uTime * 0.05);
  
  // Color - linear HDR
  vec3 col = mix(paletteColor * 0.3, paletteColor * 1.5, shape);
  
  // HDR edge glow (emissive 2-8 range)
  vec3 glowColor = getPaletteColor(uTime * 0.1);
  col += edge * glowColor * uMorphGlow * (2.0 + uOnset * 6.0);
  
  // Kick pulse (HDR boost)
  col *= (1.2 + uKickEnv * 1.5 + uSnareEnv * 0.8);
  
  // SHARED FINISH: Apply saturation and hue rotation
  return applyColorTransforms(col);
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
  
  // Saturation now applied inside each render function to palette colors
  // (removed redundant final pass that was double-applying)
  fragColor = vec4(col, 1.0);
}
`;
