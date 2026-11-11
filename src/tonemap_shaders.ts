// Tonemapping and output pass: exposure, tonemap, sRGB encode, dither

export const TONEMAP_VS = `#version 300 es
const vec2 P[3] = vec2[3](vec2(-1,-1), vec2(3,-1), vec2(-1,3));
out vec2 vUv;
void main() {
  vec2 p = P[gl_VertexID];
  vUv = p * 0.5 + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}
`;

export const TONEMAP_FS = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uInput;
uniform float uExposure;
uniform int uTonemapMode; // 0=AgX, 1=ACES, 2=Neutral
uniform vec2 uResolution;
uniform float uTime;

// Dither noise
float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

// AgX tonemap (Blender 4.0+)
vec3 agx(vec3 x) {
  const mat3 agx_mat = mat3(
    0.842479062253094, 0.0423282422610123, 0.0423756549057051,
    0.0784335999999992, 0.878468636469772, 0.0784336,
    0.0792237451477643, 0.0791661274605434, 0.879142973793104
  );
  const float min_ev = -12.47393;
  const float max_ev = 4.026069;
  
  x = agx_mat * x;
  x = clamp(log2(x), min_ev, max_ev);
  x = (x - min_ev) / (max_ev - min_ev);
  
  // Polynomial approximation
  vec3 x2 = x * x;
  vec3 x4 = x2 * x2;
  vec3 x6 = x4 * x2;
  
  // Remove constant term (0.0349) to make true black map to near-zero
  // Original had 0.0349 constant which lifted blacks to ~52/255
  return -0.76883 * x6 + 2.80726 * x4 - 3.29279 * x2 + 1.76465 * x;
}

// ACES filmic tonemap
vec3 aces(vec3 x) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

// Khronos Neutral tonemap (glTF reference)
vec3 neutral(vec3 x) {
  const float start_compression = 0.8 - 0.04;
  const float desaturation = 0.15;
  
  float peak = max(x.r, max(x.g, x.b));
  
  if (peak < start_compression) return x;
  
  const float d = 1.0 - start_compression;
  float new_peak = 1.0 - d * d / (peak + d - start_compression);
  x *= new_peak / peak;
  
  float g = 1.0 - 1.0 / (desaturation * (peak - new_peak) + 1.0);
  return mix(x, vec3(new_peak), g);
}

// Linear to sRGB
vec3 linearToSRGB(vec3 linear) {
  bvec3 cutoff = lessThan(linear, vec3(0.0031308));
  vec3 higher = vec3(1.055) * pow(linear, vec3(1.0/2.4)) - vec3(0.055);
  vec3 lower = linear * vec3(12.92);
  return mix(higher, lower, cutoff);
}

void main() {
  vec3 hdr = texture(uInput, vUv).rgb;
  
  // Apply exposure
  hdr *= uExposure;
  
  // Tonemap
  vec3 color;
  if (uTonemapMode == 0) {
    color = agx(hdr);
  } else if (uTonemapMode == 1) {
    color = aces(hdr);
  } else {
    color = neutral(hdr);
  }
  
  // sRGB encode
  color = linearToSRGB(color);
  
  // Dither (temporal + spatial)
  vec2 ditherCoord = gl_FragCoord.xy + vec2(uTime * 1000.0);
  float dither = (rand(ditherCoord) - 0.5) / 255.0;
  color += dither;
  
  fragColor = vec4(color, 1.0);
}
`;
