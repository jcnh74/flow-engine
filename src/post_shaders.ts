// Post-processing shaders: physically based bloom, chromatic aberration, color grade, grain

export const POST_VS = `#version 300 es
const vec2 P[3] = vec2[3](vec2(-1,-1), vec2(3,-1), vec2(-1,3));
out vec2 vUv;
void main() {
  vec2 p = P[gl_VertexID];
  vUv = p * 0.5 + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}
`;

// CoD/Jimenez 13-tap downsample with Karis average on first level
export const BLOOM_DOWN_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSrc;
uniform vec2 uTexelSize;
uniform int uLevel; // 0 = first level (Karis average), >0 = standard downsample
uniform float uThreshold; // soft threshold knee

// Karis average (level 0 only): weight by inverse luminance to reduce fireflies
vec3 karisAverage(vec3 c) {
  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return c / (1.0 + luma);
}

void main() {
  vec2 uv = vUv;
  vec2 d = uTexelSize;
  
  // 13-tap pattern: 1 center + 4 cross + 8 diagonal
  vec3 c = texture(uSrc, uv).rgb;
  
  // 4 cross samples (half-texel offset)
  vec3 n = texture(uSrc, uv + vec2(0, d.y)).rgb;
  vec3 s = texture(uSrc, uv - vec2(0, d.y)).rgb;
  vec3 e = texture(uSrc, uv + vec2(d.x, 0)).rgb;
  vec3 w = texture(uSrc, uv - vec2(d.x, 0)).rgb;
  
  // 8 diagonal samples
  vec3 ne = texture(uSrc, uv + d).rgb;
  vec3 nw = texture(uSrc, uv + vec2(-d.x, d.y)).rgb;
  vec3 se = texture(uSrc, uv + vec2(d.x, -d.y)).rgb;
  vec3 sw = texture(uSrc, uv - d).rgb;
  
  // Inner box (half distance)
  vec3 ne2 = texture(uSrc, uv + d * 0.5).rgb;
  vec3 nw2 = texture(uSrc, uv + vec2(-d.x, d.y) * 0.5).rgb;
  vec3 se2 = texture(uSrc, uv + vec2(d.x, -d.y) * 0.5).rgb;
  vec3 sw2 = texture(uSrc, uv - d * 0.5).rgb;
  
  // Level 0: apply Karis average to all samples
  if (uLevel == 0) {
    c = karisAverage(c);
    n = karisAverage(n); s = karisAverage(s); e = karisAverage(e); w = karisAverage(w);
    ne = karisAverage(ne); nw = karisAverage(nw); se = karisAverage(se); sw = karisAverage(sw);
    ne2 = karisAverage(ne2); nw2 = karisAverage(nw2); se2 = karisAverage(se2); sw2 = karisAverage(sw2);
    
    // Soft threshold with knee
    float knee = uThreshold * 0.5;
    vec3 col = c * 0.5 + (n + s + e + w) * 0.125 + (ne + nw + se + sw) * 0.0625 + (ne2 + nw2 + se2 + sw2) * 0.0625;
    float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
    float softCurve = clamp((luma - uThreshold + knee) / (2.0 * knee), 0.0, 1.0);
    softCurve = softCurve * softCurve * (3.0 - 2.0 * softCurve);
    col *= max(softCurve, step(uThreshold + knee, luma));
    
    // Clamp very dark values to prevent underflow
    fragColor = vec4(max(col, vec3(1e-4)), 1.0);
  } else {
    // Standard 13-tap downsample (levels 1+)
    vec3 col = c * 0.5;
    col += (n + s + e + w) * 0.125;
    col += (ne + nw + se + sw) * 0.0625;
    col += (ne2 + nw2 + se2 + sw2) * 0.0625;
    fragColor = vec4(max(col, vec3(1e-4)), 1.0);
  }
}
`;

// 3x3 tent upsample filter
export const BLOOM_UP_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSrc;
uniform vec2 uTexelSize;

void main() {
  vec2 d = uTexelSize;
  
  // 3x3 tent filter (1-2-1 weights)
  vec3 c = texture(uSrc, vUv).rgb * 4.0;
  
  // 4 edge samples (weight 2)
  c += texture(uSrc, vUv + vec2(0, d.y)).rgb * 2.0;
  c += texture(uSrc, vUv - vec2(0, d.y)).rgb * 2.0;
  c += texture(uSrc, vUv + vec2(d.x, 0)).rgb * 2.0;
  c += texture(uSrc, vUv - vec2(d.x, 0)).rgb * 2.0;
  
  // 4 corner samples (weight 1)
  c += texture(uSrc, vUv + d).rgb;
  c += texture(uSrc, vUv + vec2(-d.x, d.y)).rgb;
  c += texture(uSrc, vUv + vec2(d.x, -d.y)).rgb;
  c += texture(uSrc, vUv - d).rgb;
  
  fragColor = vec4(c / 16.0, 1.0);
}
`;

// Chromatic aberration + barrel distortion
export const CA_DISTORT_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSrc;
uniform float uCAStrength; // chromatic aberration (radial, 0-0.02)
uniform float uDistortion; // barrel distortion (-0.3 to 0.3)

vec2 distort(vec2 uv, float k) {
  vec2 t = uv - 0.5;
  float r2 = dot(t, t);
  float f = 1.0 + k * r2;
  return 0.5 + t * f;
}

void main() {
  vec2 uv = vUv;
  vec2 dir = uv - 0.5;
  float dist = length(dir);
  
  // Apply barrel distortion
  uv = distort(vUv, uDistortion);
  
  // Spectral CA: shift R outward, B inward
  vec2 uvR = distort(vUv, uDistortion + uCAStrength * dist);
  vec2 uvB = distort(vUv, uDistortion - uCAStrength * dist);
  
  float r = texture(uSrc, uvR).r;
  float g = texture(uSrc, uv).g;
  float b = texture(uSrc, uvB).b;
  
  fragColor = vec4(r, g, b, 1.0);
}
`;

// Color grade + vignette + film grain
export const COLOR_GRADE_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSrc;
uniform vec3 uLift;    // shadows
uniform vec3 uGamma;   // midtones
uniform vec3 uGain;    // highlights
uniform float uSaturation;
uniform float uVibrance;
uniform float uVignetteStrength;
uniform float uVignetteRadius;
uniform float uGrainStrength;
uniform float uFrame;

// Hash for grain noise
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec3 col = texture(uSrc, vUv).rgb;
  
  // Lift-gamma-gain color grade
  col = col + uLift;
  col = pow(max(col, vec3(0.0)), 1.0 / uGamma);
  col = col * uGain;
  
  // Saturation
  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(luma), col, uSaturation);
  
  // Vibrance (desaturate already-saturated colors less)
  float maxC = max(max(col.r, col.g), col.b);
  float minC = min(min(col.r, col.g), col.b);
  float sat = (maxC - minC) / (maxC + 1e-5);
  float vibBoost = (1.0 - sat) * uVibrance;
  col = mix(vec3(luma), col, 1.0 + vibBoost);
  
  // Vignette
  vec2 vignUv = vUv - 0.5;
  float vign = smoothstep(uVignetteRadius, uVignetteRadius - 0.3, length(vignUv));
  col *= mix(1.0, vign, uVignetteStrength);
  
  // Animated luma-weighted film grain
  vec2 grainUv = vUv * 1024.0 + vec2(uFrame * 0.1, uFrame * 0.07);
  float noise = hash12(grainUv) - 0.5;
  float lumaWeight = smoothstep(0.0, 0.3, luma) * smoothstep(1.0, 0.7, luma);
  col += noise * uGrainStrength * lumaWeight;
  
  fragColor = vec4(max(col, vec3(0.0)), 1.0);
}
`;

// Composite bloom layers
// MilkDrop-style feedback/warp shader (inspired by Butterchurn MIT licensed)
// Per-pixel UV warp with decay, zoom, rotation, kaleido fold, and noise displacement
export const FEEDBACK_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uPrev;    // Previous feedback frame
uniform sampler2D uCurrent; // Current rendered frame
uniform float uDecay;
uniform float uZoom;
uniform float uRotate;
uniform vec2 uTranslate;
uniform float uMix;
uniform float uTime;
uniform float uKaleido;     // Kaleidoscope fold count
uniform float uNoiseAmt;    // Displacement noise amount
uniform float uHueDrift;    // Hue shift per frame

// FBM noise for displacement (from IQ techniques)
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0,0)), hash(i + vec2(1,0)), f.x),
    mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x),
    f.y
  );
}

vec2 fbm(vec2 p) {
  float a = 1.0, f = 1.0;
  vec2 d = vec2(0.0);
  for (int i = 0; i < 3; i++) {
    d += a * vec2(noise(p * f), noise(p * f + 100.0));
    a *= 0.5;
    f *= 2.0;
  }
  return d;
}

// Hue shift
vec3 hueShift(vec3 color, float shift) {
  const vec3 k = vec3(0.57735, 0.57735, 0.57735);
  float cosAngle = cos(shift);
  return color * cosAngle + cross(k, color) * sin(shift) + k * dot(k, color) * (1.0 - cosAngle);
}

void main() {
  vec2 uv = vUv - 0.5;
  
  // Kaleidoscope fold
  if (uKaleido > 0.5) {
    float angle = atan(uv.y, uv.x);
    float folds = floor(uKaleido);
    float sector = 6.28318 / folds;
    angle = mod(angle, sector);
    if (mod(floor(angle / sector * folds), 2.0) > 0.5) {
      angle = sector - angle;
    }
    float r = length(uv);
    uv = vec2(cos(angle), sin(angle)) * r;
  }
  
  // Displacement noise
  if (uNoiseAmt > 0.001) {
    vec2 displacement = fbm(uv * 3.0 + uTime * 0.2) - 0.5;
    uv += displacement * uNoiseAmt;
  }
  
  // Apply zoom
  uv /= uZoom;
  
  // Apply rotation
  float c = cos(uRotate);
  float s = sin(uRotate);
  uv = mat2(c, -s, s, c) * uv;
  
  // Apply translation
  uv += uTranslate;
  
  uv += 0.5;
  
  // Clamp UV to [0,1] to avoid sampling CLAMP_TO_EDGE gray borders
  uv = clamp(uv, vec2(0.0), vec2(1.0));
  
  // Sample previous frame with warp and apply decay
  vec3 echo = texture(uPrev, uv).rgb;
  
  // Apply decay to echo only (not to current frame)
  // Decays toward black (0,0,0) preserving contrast
  echo *= uDecay;
  
  // MilkDrop-style contrast on echo to prevent blur/wash
  // Apply on COMPRESSED value to prevent runaway above 1.0
  // Compress: e/(1+e), apply contrast, expand: e/(1-e)
  float echoLuma = dot(echo, vec3(0.2126, 0.7152, 0.0722));
  if (echoLuma > 0.01) {
    // Compress to [0,1) range
    vec3 compressed = echo / (vec3(1.0) + echo);
    // Apply contrast in safe range (pow >1 darkens shadows)
    compressed = pow(compressed, vec3(1.2));
    // Expand back, with epsilon to prevent div-by-zero
    echo = compressed / (vec3(1.0) - compressed + vec3(1e-4));
    // Clamp to sane max to prevent runaway
    echo = min(echo, vec3(4.0));
  }
  
  // Sanitize NaN/Inf that can occur from extreme warps or math
  if (any(isnan(echo)) || any(isinf(echo))) {
    echo = vec3(0.0);
  }
  
  // Apply hue drift to echo
  if (abs(uHueDrift) > 0.001) {
    echo = hueShift(echo, uHueDrift);
  }
  
  vec3 curr = texture(uCurrent, vUv).rgb;
  
  // Lighten blend: keep curr at full strength, echo added where brighter
  // This prevents dimming sparse scenes while allowing bright trails
  vec3 result = max(curr, echo * uMix);
  
  // Output DISPLAY version (unkeyed) - luma key applied separately to feedback buffer
  // This prevents erasing dark scenes like Fractal Echo and Wall Studio
  fragColor = vec4(result, 1.0);
}
`;

export const BLOOM_COMPOSITE_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSrc;
uniform sampler2D uBloom0;
uniform sampler2D uBloom1;
uniform sampler2D uBloom2;
uniform sampler2D uBloom3;
uniform sampler2D uBloom4;
uniform sampler2D uBloom5;
uniform float uBloomStrength;

void main() {
  vec3 col = texture(uSrc, vUv).rgb;
  
  // Additive bloom from all mip levels
  vec3 bloom = vec3(0.0);
  bloom += texture(uBloom0, vUv).rgb * 1.0;
  bloom += texture(uBloom1, vUv).rgb * 0.8;
  bloom += texture(uBloom2, vUv).rgb * 0.6;
  bloom += texture(uBloom3, vUv).rgb * 0.4;
  bloom += texture(uBloom4, vUv).rgb * 0.2;
  bloom += texture(uBloom5, vUv).rgb * 0.1;
  
  col += bloom * uBloomStrength;
  
  fragColor = vec4(col, 1.0);
}
`;

// Simple passthrough/blit shader (for copying textures)
export const BLIT_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSrc;

void main() {
  fragColor = texture(uSrc, vUv);
}
`;

// Luma key shader: creates sparse emissive layer for feedback
export const LUMA_KEY_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSrc;

void main() {
  vec3 color = texture(uSrc, vUv).rgb;
  
  // Create sparse emissive layer: only bright elements
  // MilkDrop-style: sparse bright on dark background, not dense full-frame
  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  
  // Soft threshold: fade out below 0.25, preserve above 0.65
  // This creates sparse bright trails on black, not dense gray
  float key = smoothstep(0.25, 0.65, luma);
  color *= key;
  
  // Clamp stored feedback to prevent runaway (mix 0.88 * decay 0.97 = 0.85 < 1 for bounded values)
  // But need hard limit for safety
  color = min(color, vec3(4.0));
  
  // Sanitize NaN/Inf
  if (any(isnan(color)) || any(isinf(color))) {
    color = vec3(0.0);
  }
  
  fragColor = vec4(color, 1.0);
}
`;
