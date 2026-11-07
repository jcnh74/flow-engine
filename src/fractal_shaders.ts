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

// Animation
uniform float uRotSpeed;
uniform float uMorphAmt;

const float PI = 3.14159265359;

// Hash function for randomization
float hash(vec3 p) {
  p = fract(p * vec3(443.897, 441.423, 437.195));
  p += dot(p, p.yzx + 19.19);
  return fract((p.x + p.y) * p.z);
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

// Main distance function
float map(vec3 p) {
  // Apply rotation animation
  float a = uTime * uRotSpeed;
  float c = cos(a), s = sin(a);
  mat2 rot = mat2(c, -s, s, c);
  p.xz *= rot;
  
  if (uFractalType == 0) {
    return deMandelbulb(p) * uSurfDist;
  } else {
    return deMandelbox(p) * uSurfDist;
  }
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

// Ambient occlusion from iteration count approximation
float calcAO(vec3 p, vec3 n) {
  float ao = 0.0;
  float scale = 1.0;
  for (int i = 0; i < 5; i++) {
    float h = 0.01 + 0.12 * float(i) / 4.0;
    float d = map(p + n * h);
    ao += (h - d) * scale;
    scale *= 0.95;
  }
  return clamp(1.0 - 3.0 * ao, 0.0, 1.0);
}

// Soft shadow via cone tracing
float calcShadow(vec3 ro, vec3 rd, float mint, float maxt, float k) {
  float res = 1.0;
  float t = mint;
  for (int i = 0; i < 32; i++) {
    float h = map(ro + rd * t);
    if (h < 0.001) return 0.0;
    res = min(res, k * h / t);
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
      float shadow = uShadowStr > 0.0 ? calcShadow(p, uLightDir, 0.02, 2.5, 8.0) : 1.0;
      shadow = mix(1.0, shadow, uShadowStr);
      
      // Orbit trap coloring (distance from origin during iteration)
      float trap = length(p);
      vec3 col = mix(uColor1, uColor2, sin(trap * uColorMix) * 0.5 + 0.5);
      
      // Combine lighting
      float light = uAmbient + diffuse * shadow;
      col = col * light * ao;
      
      // Add glow
      col += vec3(0.3, 0.5, 1.0) * glow * uGlow;
      
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
  
  // Gamma correction
  col.rgb = pow(col.rgb, vec3(0.4545));
  
  fragColor = col;
}`;

export default { FRACTAL_VS, FRACTAL_FS };
