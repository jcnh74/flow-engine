// 3D Fractal shaders: Mandelbulb, Mandelbox, Kaleidoscopic IFS, Quaternion Julia
// Original implementation based on well-documented mathematical algorithms
// Distance estimation and ray marching techniques from computer graphics literature

export const FRACTAL_VS = `#version 300 es
precision highp float;
const vec2 P[3] = vec2[3](vec2(-1,-1), vec2(3,-1), vec2(-1,3));
out vec2 vUv;
void main() {
  vec2 p = P[gl_VertexID];
  vUv = p * 0.5 + 0.5;
  gl_Position = vec4(p, 0, 1);
}`;

export const FRACTAL_FS = `#version 300 es
precision highp float;
precision highp int;

in vec2 vUv;
out vec4 fragColor;

uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uCamPos;
uniform vec3 uCamTarget;
uniform float uCamFov;

// Fractal parameters
uniform int uFractalType; // 0=Mandelbulb, 1=Mandelbox, 2=Kaleidoscopic, 3=Quaternion Julia
uniform float uPower;
uniform int uIterations;
uniform float uBailout;
uniform float uScale;
uniform float uFoldLimit;
uniform float uMinRadius;
uniform float uFixedRadius;

// Rendering
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform float uColorMix;
uniform float uAmbient;
uniform float uDiffuse;
uniform vec3 uLightDir;
uniform float uGlow;
uniform float uShadowStr;
uniform int uMaxSteps;
uniform float uMaxDist;
uniform float uSurfDist;

// Color transforms (like trippy mode)
uniform float uHueShift;
uniform float uSat;

// IQ lighting enhancements
uniform float uFogDensity;
uniform float uFogStart;
uniform float uAOStrength;
uniform float uAORadius;
uniform float uShadowSharpness;
uniform vec3 uCosinePaletteA;
uniform vec3 uCosinePaletteB;
uniform vec3 uCosinePaletteC;
uniform vec3 uCosinePaletteD;
uniform float uPaletteOffset;

// Animation
uniform float uRotSpeed;
uniform float uMorphAmt;
uniform bool uSlicePlane;
uniform float uSlicePos;
uniform float uFoldRot;
uniform vec4 uJuliaC;
// Studio look (C4D AO): white dome + key, gradient cyclorama backdrop, fog into the backdrop
uniform float uStudio;
uniform vec3 uBgTop, uBgBottom, uDomeCol;
// pass 3 studio look: third pigment band, key colour, GGX-ish gloss + fresnel rim
uniform vec3 uMid, uKeyColS, uRimCol;
uniform float uGlossS, uRimS;
vec3 studioBg(vec3 rd){ return mix(uBgBottom, uBgTop, smoothstep(-0.35, 0.65, rd.y)); }

const float PI = 3.14159265359;

// Hash function for randomization
float hash(vec3 p) {
  p = fract(p * vec3(443.897, 441.423, 437.195));
  p += dot(p, p.yzx + 19.19);
  return fract((p.x + p.y) * p.z);
}

// Inigo Quilez cosine palette
// https://iquilezles.org/articles/palettes/
vec3 cosinePalette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  return a + b * cos(6.28318 * (c * t + d));
}

// Mandelbulb distance estimator
// Based on spherical coordinate power formula
float deMandelbulb(vec3 pos) {
  vec3 z = pos;
  float dr = 1.0;
  float r = 0.0;
  float power = uPower;
  
  for (int i = 0; i < 32; i++) {
    if (i >= uIterations) break;
    
    r = length(z);
    if (r > uBailout) break;
    
    // Convert to spherical coordinates
    float theta = acos(z.z / r);
    float phi = atan(z.y, z.x);
    dr = pow(r, power - 1.0) * power * dr + 1.0;
    
    // Scale and rotate the point
    float zr = pow(r, power);
    theta = theta * power;
    phi = phi * power;
    
    // Convert back to cartesian coordinates
    z = zr * vec3(
      sin(theta) * cos(phi),
      sin(theta) * sin(phi),
      cos(theta)
    );
    z += pos;
  }
  
  return 0.5 * log(r) * r / dr;
}

// Mandelbox distance estimator
// Based on box folding and sphere folding operations
float deMandelbox(vec3 pos) {
  vec3 offset = pos;
  float dr = 1.0;
  float scale = uScale;
  float mr2 = uMinRadius * uMinRadius;
  float fr2 = uFixedRadius * uFixedRadius;
  
  for (int i = 0; i < 32; i++) {
    if (i >= uIterations) break;
    
    // Apply fold rotation
    float foldAngle = uFoldRot * PI / 180.0;
    float c = cos(foldAngle);
    float s = sin(foldAngle);
    mat2 rot = mat2(c, -s, s, c);
    pos.xy *= rot;
    
    // Box fold
    pos = clamp(pos, -uFoldLimit, uFoldLimit) * 2.0 - pos;
    
    // Sphere fold
    float r2 = dot(pos, pos);
    if (r2 < mr2) {
      pos *= fr2 / mr2;
      dr *= fr2 / mr2;
    } else if (r2 < fr2) {
      pos *= fr2 / r2;
      dr *= fr2 / r2;
    }
    
    // Scale and translate
    pos = pos * scale + offset;
    dr = dr * abs(scale) + 1.0;
    
    if (dot(pos, pos) > uBailout * uBailout) break;
  }
  
  return length(pos) / abs(dr);
}

// Kaleidoscopic IFS distance estimator.
// Octant reflections, a scale/translate, and a fold rotation — a standard
// 3D kaleidoscopic iterated function system (Hart et al.), written here
// from the published folding construction (not from Shadertoy).
float deKaleidoscopic(vec3 p) {
  float scale = abs(uScale) > 1.15 ? clamp(abs(uScale), 1.3, 2.4) : 1.85;
  float offset = 1.0;
  float der = 1.0;
  float foldAngle = uFoldRot * PI / 180.0;
  float c = cos(foldAngle);
  float s = sin(foldAngle);
  mat2 rot = mat2(c, -s, s, c);

  for (int i = 0; i < 16; i++) {
    if (i >= uIterations) break;
    p = abs(p);
    if (p.x < p.y) p.xy = p.yx;
    if (p.x < p.z) p.xz = p.zx;
    if (p.y < p.z) p.yz = p.zy;
    p.xz *= rot;
    p = p * scale - vec3(offset) * (scale - 1.0);
    if (p.z < -0.5 * offset * (scale - 1.0)) p.z += offset * (scale - 1.0);
    der *= scale;
  }

  return (length(p) - 0.8) / der;
}

// Quaternion multiplication
vec4 qMul(vec4 q1, vec4 q2) {
  return vec4(
    q1.w * q2.x + q1.x * q2.w + q1.y * q2.z - q1.z * q2.y,
    q1.w * q2.y - q1.x * q2.z + q1.y * q2.w + q1.z * q2.x,
    q1.w * q2.z + q1.x * q2.y - q1.y * q2.x + q1.z * q2.w,
    q1.w * q2.w - q1.x * q2.x - q1.y * q2.y - q1.z * q2.z
  );
}

// Quaternion Julia, 3D slice (w = 0). Scalar magnitude derivative, which is
// the robust form of the Hart/Whittaker distance estimate for z^2 + c.
float deQuaternionJulia(vec3 p) {
  // 3D slice (re, i, j) with k = 0. qMul stores the real part in .w, so
  // p.x is real, p.yz are i and j. The pure-imaginary slice would be a sphere.
  vec4 z = vec4(p.y, p.z, 0.0, p.x);
  vec4 c = uJuliaC;
  float dr = 1.0;

  for (int i = 0; i < 20; i++) {
    if (i >= uIterations) break;
    float r2 = dot(z, z);
    if (r2 > 16.0) break;
    dr = 2.0 * sqrt(r2) * dr;
    z = qMul(z, z) + c;
  }

  float r = length(z);
  return 0.5 * r * log(max(r, 1e-6)) / max(dr, 1e-6);
}

// Main distance function
float map(vec3 p) {
  // Apply rotation animation
  float a = uTime * uRotSpeed;
  float c = cos(a), s = sin(a);
  mat2 rot = mat2(c, -s, s, c);
  p.xz *= rot;
  
  float d;
  if (uFractalType == 0) {
    d = deMandelbulb(p);
  } else if (uFractalType == 1) {
    d = deMandelbox(p);
  } else if (uFractalType == 2) {
    d = deKaleidoscopic(p);
  } else if (uFractalType == 3) {
    d = deQuaternionJulia(p);
  } else {
    d = deMandelbulb(p);
  }
  
  // Slice plane
  if (uSlicePlane) {
    float planeDist = p.y - uSlicePos;
    d = max(d, planeDist);
  }
  
  return d * uSurfDist;
}

// Estimate normal using tetrahedron method
vec3 calcNormal(vec3 p) {
  const float h = 0.001;
  const vec2 k = vec2(1, -1);
  return normalize(
    k.xyy * map(p + k.xyy * h) +
    k.yyx * map(p + k.yyx * h) +
    k.yxy * map(p + k.yxy * h) +
    k.xxx * map(p + k.xxx * h)
  );
}

// Inigo Quilez ambient occlusion
// https://iquilezles.org/articles/nvscene2008/rwwtt.pdf
float calcAO(vec3 p, vec3 n) {
  float ao = 0.0;
  float scale = 1.0;
  
  // Adaptive sample count for performance (scale with quality)
  int samples = uMaxSteps > 96 ? 5 : (uMaxSteps > 64 ? 3 : 2);
  
  for (int i = 0; i < 5; i++) {
    if (i >= samples) break;
    
    float h = uAORadius * (0.01 + 0.15 * float(i) / float(samples - 1));
    float d = map(p + n * h);
    ao += (h - d) * scale;
    scale *= 0.85;
  }
  
  float occlusion = 1.0 - clamp(ao * uAOStrength, 0.0, 1.0);
  return occlusion;
}

// Inigo Quilez soft shadows with penumbra
// https://iquilezles.org/articles/rmshadows/
float calcShadow(vec3 ro, vec3 rd, float mint, float maxt) {
  float res = 1.0;
  float t = mint;
  float ph = 1e10;
  
  // Adaptive step count for performance (scale with quality)
  int maxShadowSteps = uMaxSteps > 96 ? 24 : (uMaxSteps > 64 ? 12 : 8);
  
  for (int i = 0; i < 32; i++) {
    if (i >= maxShadowSteps) break;
    
    float h = map(ro + rd * t);
    
    // Hard shadow check
    if (h < 0.001) return 0.0;
    
    // Soft shadow penumbra
    float y = h * h / (2.0 * ph);
    float d = sqrt(h * h - y * y);
    res = min(res, uShadowSharpness * d / max(0.0, t - y));
    ph = h;
    
    t += h;
    if (t > maxt) break;
  }
  
  return clamp(res, 0.0, 1.0);
}

// Ray marching
vec4 raymarch(vec3 ro, vec3 rd) {
  float t = 0.0;
  float glow = 0.0;
  
  for (int i = 0; i < 256; i++) {
    if (i >= uMaxSteps) break;
    
    vec3 p = ro + rd * t;
    float d = map(p);
    
    // Accumulate glow
    glow += exp(-10.0 * abs(d)) * 0.01;
    
    if (d < 0.001) {
      // Hit surface
      vec3 n = calcNormal(p);
      
      // Lighting
      float diffuse = max(dot(n, uLightDir), 0.0) * uDiffuse;
      float ao = calcAO(p, n);
      float shadow = uShadowStr > 0.0 ? calcShadow(p, uLightDir, 0.02, 2.5) : 1.0;
      shadow = mix(1.0, shadow, uShadowStr);
      
      // Cosine palette coloring (orbit trap)
      float trap = length(p) * uColorMix;
      vec3 col = cosinePalette(
        trap + uPaletteOffset,
        uCosinePaletteA,
        uCosinePaletteB,
        uCosinePaletteC,
        uCosinePaletteD
      );
      // Mix in the Color 1 / Color 2 pickers (previously uploaded and unused)
      // Increased blend weight from 0.65 to 0.85 so Color 1/2 pickers dominate
      vec3 colStops = mix(uColor1, uColor2, fract(trap + uPaletteOffset));
      col = mix(col, colStops, 0.85);
      
      // Combine lighting
      float light = uAmbient + diffuse * shadow;
      if (uStudio > 0.5) {
        // Pigment bands: Color 1 -> chalk white -> Color 2 (no muddy midpoint)
        float f = fract(trap + uPaletteOffset);
        col = mix(mix(uColor1, uMid, smoothstep(0.3, 0.5, f)), uColor2, smoothstep(0.62, 0.82, f));
        col *= col; // approx sRGB -> linear
        // Dome light weighted by AO does most of the work (never fully black: tinted by the cove); key adds soft shape
        vec3 dome = uDomeCol * (0.55 + 0.45 * n.y) * mix(0.3, 1.0, ao);
        vec3 lit = dome * (uAmbient * 2.2) + uKeyColS * diffuse * shadow * mix(0.6, 1.0, ao);
        float nv = max(dot(n, -rd), 0.0);
        vec3 R = reflect(rd, n);
        vec3 env = studioBg(R) + uKeyColS * pow(max(dot(R, uLightDir), 0.0), 40.0) * 2.0;
        float fr = 0.04 + 0.96 * pow(1.0 - nv, 5.0);
        col = col * lit + env * fr * uGlossS * ao + uRimCol * uRimS * pow(1.0 - nv, 3.0) * ao;
      } else {
      col = col * light * ao;
      }
      
      // Add glow (neutral gray to not interfere with hue rotation)
      // R25: Was blue (0.3,0.5,1.0), now neutral to let hueShift control all color
      col += vec3(0.5) * glow * uGlow;
      
      // Fog (exponential distance-based, neutral gray)
      // R25: Was blue-tinted (0.05,0.06,0.08), now neutral to preserve hue rotation
      if (uFogDensity > 0.0) {
        float fogAmount = 1.0 - exp(-uFogDensity * max(0.0, t - uFogStart));
        vec3 fogColor = uStudio > 0.5 ? studioBg(rd) : vec3(0.06);  // Neutral gray (or the studio cyc)
        col = mix(col, fogColor, fogAmount);
      }
      
      return vec4(col, 1.0);
    }
    
    t += d;
    if (t > uMaxDist) break;
  }
  
  // Background with glow (neutral to not interfere with hue rotation)
  // R25: Was blue-tinted, now neutral gray to let hueShift control color
  vec3 bg = uStudio > 0.5 ? studioBg(rd) : vec3(0.02);
  bg += vec3(0.5) * glow * uGlow * 0.5;
  return vec4(bg, 0.0);
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

// Camera setup
mat3 camera(vec3 ro, vec3 ta, float roll) {
  vec3 cw = normalize(ta - ro);
  vec3 cp = vec3(sin(roll), cos(roll), 0.0);
  vec3 cu = normalize(cross(cw, cp));
  vec3 cv = cross(cu, cw);
  return mat3(cu, cv, cw);
}

void main() {
  // Ray setup
  vec2 uv = (2.0 * gl_FragCoord.xy - uResolution) / uResolution.y;
  
  vec3 ro = uCamPos;
  vec3 ta = uCamTarget;
  mat3 cam = camera(ro, ta, 0.0);
  vec3 rd = cam * normalize(vec3(uv, 1.0 / tan(uCamFov * PI / 360.0)));
  
  // Raymarch
  vec4 col = raymarch(ro, rd);
  
  // Output linear HDR (no gamma - tonemap handles it in Phase 1)
  // Apply color transforms (saturation and hue shift) as FINAL step before output
  // R25: Moved after all lighting to prevent fog/sky re-tinting
  if (col.a > 0.001) {
    // Apply saturation
    float luma = dot(col.rgb, vec3(0.2126, 0.7152, 0.0722));
    col.rgb = max(mix(vec3(luma), col.rgb, uSat), vec3(0.0));
    
    // Apply hue shift as THE VERY LAST operation before fragColor
    col.rgb = rotateHue(col.rgb, uHueShift * 360.0);
  }
  
  fragColor = col;
}`;

export default { FRACTAL_VS, FRACTAL_FS };
