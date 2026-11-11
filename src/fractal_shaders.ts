// 3D Fractal shaders: Mandelbulb and Mandelbox
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
uniform int uFractalType; // 0=Mandelbulb, 1=Mandelbox
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

// Menger Sponge distance estimator
float deMenger(vec3 p) {
  vec3 z = p;
  float d = 1e10;
  float s = 1.0;
  
  for (int i = 0; i < 12; i++) {
    if (i >= uIterations) break;
    
    z = abs(z);
    if (z.x < z.y) z.xy = z.yx;
    if (z.x < z.z) z.xz = z.zx;
    if (z.y < z.z) z.yz = z.zy;
    
    z = z * 3.0 - vec3(2.0);
    s *= 3.0;
    
    if (z.z < -1.0) z.z += 2.0;
  }
  
  // Box distance
  vec3 a = abs(z) - vec3(1.0);
  return (min(max(max(a.x, a.y), a.z), 0.0) + length(max(a, 0.0))) / s;
}

// Sierpinski Tetrahedron distance estimator
float deSierpinski(vec3 p) {
  vec3 z = p;
  float scale = 2.0;
  float s = 1.0;
  
  for (int i = 0; i < 16; i++) {
    if (i >= uIterations) break;
    
    // Tetrahedral folding
    if (z.x + z.y < 0.0) z.xy = -z.yx;
    if (z.x + z.z < 0.0) z.xz = -z.zx;
    if (z.y + z.z < 0.0) z.yz = -z.zy;
    
    // Scale and translate
    z = z * scale - vec3(scale - 1.0);
    s *= scale;
  }
  
  return (length(z) - 2.0) / s;
}

// Kaleidoscopic IFS distance estimator (Mandelbox-style)
float deKaleidoscopic(vec3 p) {
  vec3 z = p;
  float scale = 2.0;
  float minRadius2 = 0.5;
  float fixedRadius2 = 1.0;
  float dr = 1.0;
  
  for (int i = 0; i < 16; i++) {
    if (i >= uIterations) break;
    
    // Box fold (creates kaleidoscopic symmetry)
    z = clamp(z, -1.0, 1.0) * 2.0 - z;
    
    // Spherical fold (creates recursive detail)
    float r2 = dot(z, z);
    if (r2 < minRadius2) {
      float temp = fixedRadius2 / minRadius2;
      z *= temp;
      dr *= temp;
    } else if (r2 < fixedRadius2) {
      float temp = fixedRadius2 / r2;
      z *= temp;
      dr *= temp;
    }
    
    // Scale and translate
    z = z * scale + p;
    dr = dr * abs(scale) + 1.0;
  }
  
  return length(z) / abs(dr);
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

// Quaternion Julia distance estimator
float deQuaternionJulia(vec3 p) {
  vec4 z = vec4(p, 0.0);
  
  // Animated constant using uScale and uFoldLimit for variation
  // DISTINCT from Mandelbulb/Mandelbox - quaternion Julia set structure
  // Use completely different base values to ensure visual distinctness
  float t = uTime * 0.2;
  vec4 c = vec4(
    0.18 + sin(t) * 0.4 * abs(uScale),
    0.6 + cos(t * 0.8) * 0.35 * abs(uFoldLimit),
    0.35 + sin(t * 1.5) * 0.25,
    -0.15 + cos(t * 0.6) * 0.2
  );
  
  vec4 dz = vec4(1.0, 0.0, 0.0, 0.0);
  
  for (int i = 0; i < 20; i++) {
    if (i >= uIterations) break;
    
    float r2 = dot(z, z);
    if (r2 > uBailout * uBailout * 16.0) break;
    
    // dz = 2 * qMul(z, dz)
    dz = 2.0 * qMul(z, dz);
    
    // z = qMul(z, z) + c
    z = qMul(z, z) + c;
  }
  
  float r = length(z);
  float dr = length(dz);
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
    d = deMenger(p);
  } else if (uFractalType == 3) {
    d = deSierpinski(p);
  } else if (uFractalType == 4) {
    d = deKaleidoscopic(p);
  } else if (uFractalType == 5) {
    d = deQuaternionJulia(p);
  } else {
    d = deMandelbulb(p); // Fallback
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
      vec3 colStops = mix(uColor1, uColor2, fract(trap + uPaletteOffset));
      col = mix(col, colStops, 0.65);
      
      // Combine lighting
      float light = uAmbient + diffuse * shadow;
      col = col * light * ao;
      
      // Add glow
      col += vec3(0.3, 0.5, 1.0) * glow * uGlow;
      
      // Fog (exponential distance-based)
      if (uFogDensity > 0.0) {
        float fogAmount = 1.0 - exp(-uFogDensity * max(0.0, t - uFogStart));
        vec3 fogColor = vec3(0.05, 0.06, 0.08);
        col = mix(col, fogColor, fogAmount);
      }
      
      return vec4(col, 1.0);
    }
    
    t += d;
    if (t > uMaxDist) break;
  }
  
  // Background with glow
  vec3 bg = vec3(0.01, 0.02, 0.03);
  bg += vec3(0.3, 0.5, 1.0) * glow * uGlow * 0.5;
  return vec4(bg, 0.0);
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
  fragColor = col;
}`;

export default { FRACTAL_VS, FRACTAL_FS };
