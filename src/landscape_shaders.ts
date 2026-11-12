// Landscape mode shaders: terrain mesh, sky, GPGPU curl-noise particles.
// Original MIT-licensed work for flow-engine. No Shadertoy code.
// Lighting is a simple wrap + fill + fog model. Palette / hue live here;
// ACES/AgX tonemap, bloom and color-grade stay in the existing finish stack.
// Keep terrain pre-tonemap in ~0.2-1.0 and reserve HDR peaks (~1.0-1.6) for particles.

import { QUAD_VS, NOISE } from './shaders';

export const LAND_QUAD_VS = QUAD_VS;

export const LAND_SKY_FS = `#version 300 es
precision highp float;
uniform vec3 uCamPos, uCamFwd, uCamRight, uCamUp;
uniform float uTanHalfFov, uAspect;
uniform vec3 uSunDir, uSunCol, uHorizon, uZenith, uFogCol;
uniform float uTime;
in vec2 vUv;
out vec4 o;

void main() {
  vec2 ndc = vUv * 2.0 - 1.0;
  vec3 rd = normalize(uCamFwd + uCamRight * ndc.x * uTanHalfFov * uAspect + uCamUp * ndc.y * uTanHalfFov);
  float he = rd.y * 0.5 + 0.5;
  vec3 sky = mix(uHorizon, uZenith, smoothstep(0.0, 1.0, he));
  // Soft sun disc (cheap, no God-rays)
  float sun = pow(max(0.0, dot(rd, normalize(uSunDir))), 48.0);
  sky += uSunCol * sun * 0.55;
  // Thin horizon haze
  float haze = exp(-max(rd.y, 0.0) * 4.0);
  sky = mix(sky, uFogCol, haze * 0.35);
  // Keep sky in the lower HDR band so terrain / particles read in front of it
  o = vec4(sky * 0.55, 1.0);
}
`;

export const LAND_TERRAIN_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in vec4 aCol;
uniform mat4 uVP;
uniform mat4 uView;
uniform float uBassLift;
uniform float uBass;
uniform float uKick;
out vec3 vW;
out vec3 vN;
out vec4 vCol;
out vec3 vView;
void main() {
  vec3 p = aPos;
  // Bass lifts the whole field; ridges (high alpha / height) lift more.
  float lift = uBassLift * (uBass * 1.0 + uKick * 0.35);
  p.y += lift * (0.35 + 0.9 * aCol.a);
  vW = p;
  vN = normalize(aNrm);
  vCol = aCol;
  vView = (uView * vec4(p, 1.0)).xyz;
  gl_Position = uVP * vec4(p, 1.0);
}
`;

export const LAND_TERRAIN_FS = `#version 300 es
precision highp float;
uniform vec3 uEye;
uniform vec3 uSunDir, uSunCol, uFillCol, uFogCol;
uniform float uFog;
uniform float uHue, uSat;
uniform vec3 uPal0, uPal1, uPal2;
uniform float uTime;
in vec3 vW;
in vec3 vN;
in vec4 vCol;
in vec3 vView;
out vec4 o;

vec3 hueRot(vec3 c, float turns) {
  float a = turns * 6.2831853;
  float ca = cos(a), sa = sin(a);
  float y = 0.299*c.r + 0.587*c.g + 0.114*c.b;
  float i = 0.596*c.r - 0.274*c.g - 0.322*c.b;
  float q = 0.211*c.r - 0.523*c.g + 0.312*c.b;
  float i2 = i*ca - q*sa, q2 = i*sa + q*ca;
  return vec3(
    y + 0.956*i2 + 0.621*q2,
    y - 0.272*i2 - 0.647*q2,
    y - 1.106*i2 + 1.703*q2
  );
}

void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(uEye - vW);
  vec3 L = normalize(uSunDir);
  float ndl = max(0.0, dot(N, L));
  float wrap = max(0.0, dot(N, L) * 0.5 + 0.5);
  float hemi = N.y * 0.5 + 0.5;
  // Vertex albedo mixed with a punchy palette along height (alpha)
  float h = clamp(vCol.a, 0.0, 1.0);
  vec3 pal = h < 0.5 ? mix(uPal0, uPal1, h * 2.0) : mix(uPal1, uPal2, (h - 0.5) * 2.0);
  // Keep baked rock/sand colors dominant; palette tints, it does not replace
  vec3 albedo = mix(vCol.rgb, pal, 0.22);
  albedo = hueRot(albedo, uHue);
  albedo = mix(vec3(dot(albedo, vec3(0.299, 0.587, 0.114))), albedo, uSat);

  vec3 lit = albedo * (uSunCol * ndl * 0.85 + uFillCol * hemi * 0.35 + uSunCol * wrap * 0.12);
  // Cool rim so ridges catch the sky
  float rim = pow(1.0 - max(0.0, dot(N, V)), 2.5);
  lit += uFillCol * rim * 0.22;
  // Gentle height shading keeps the trough readable
  lit *= 0.78 + 0.32 * h;

  float dist = length(vW - uEye);
  float fogAmt = 1.0 - exp(-dist * uFog * 0.018);
  fogAmt = clamp(fogAmt, 0.0, 0.92);
  vec3 col = mix(lit, uFogCol, fogAmt);
  // Terrain stays in the mid HDR band (~0.2-1.1)
  col = clamp(col, 0.0, 1.25);
  o = vec4(col, 1.0);
}
`;

export const LAND_SIM_FS = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uPos;
uniform sampler2D uVel;
uniform int uInit;
uniform int uTexW;
uniform float uDt, uTime;
uniform vec3 uCamPos, uCamFwd, uCamRight, uCamUp;
uniform vec3 uBoundsMin, uBoundsMax;
uniform float uBass, uMid, uHigh, uKick;
uniform float uSpeed;
uniform uint uSeed;
layout(location=0) out vec4 o;
layout(location=1) out vec4 oVel;
${NOISE}

uint idFromCoord() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  return uint(c.y * uTexW + c.x);
}

vec3 pot(vec3 p) {
  return vec3(
    snoise(p),
    snoise(p + vec3(17.1, 9.3, 3.7)),
    snoise(p + vec3(31.7, -4.1, 13.2))
  );
}

vec3 curl3(vec3 p) {
  float e = 0.18;
  vec3 dx = (pot(p + vec3(e, 0, 0)) - pot(p - vec3(e, 0, 0))) / (2.0 * e);
  vec3 dy = (pot(p + vec3(0, e, 0)) - pot(p - vec3(0, e, 0))) / (2.0 * e);
  vec3 dz = (pot(p + vec3(0, 0, e)) - pot(p - vec3(0, 0, e))) / (2.0 * e);
  return vec3(dy.z - dz.y, dz.x - dx.z, dx.y - dy.x);
}

vec4 spawn(uint id, uint k) {
  float a = h01(id * 7u + k * 1315423911u + uSeed);
  float b = h01(id * 13u + k * 2246822519u + uSeed + 1u);
  float c = h01(id * 17u + k * 3266489917u + uSeed + 2u);
  // Spawn in a volume ahead of the camera, slightly above the terrain
  float ahead = 2.0 + a * 22.0;
  float side = (b - 0.5) * 18.0;
  float up = 0.4 + c * 7.0 + uBass * 1.5;
  vec3 p = uCamPos + uCamFwd * ahead + uCamRight * side + uCamUp * up;
  return vec4(p, 0.0);
}

void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  uint id = idFromCoord();
  if (uInit == 1) {
    o = spawn(id, 0u);
    o.w = h01(id * 31u + uSeed); // life
    oVel = vec4(0.0, 0.0, 0.0, h01(id * 47u + uSeed));
    return;
  }
  vec4 s = texelFetch(uPos, c, 0);
  vec4 v = texelFetch(uVel, c, 0);
  float mid = uMid;
  float high = uHigh;
  // Curl field: mid drives advection speed, high drives smaller-scale turbulence
  vec3 field = curl3(s.xyz * 0.07 + vec3(0.0, uTime * 0.11, 0.0));
  field += curl3(s.xyz * 0.22 + vec3(11.0, -uTime * 0.23, 5.0)) * (0.35 + high * 0.9);
  // A gentle lift so particles loft out of the canyon on kicks
  field.y += 0.25 + uKick * 1.4 + uBass * 0.5;
  // Attract slightly toward the flight corridor so they stay on screen
  vec3 corridor = uCamPos + uCamFwd * 10.0 + uCamUp * 2.5;
  field += (corridor - s.xyz) * 0.015;
  v.xyz = mix(v.xyz, field, 0.18);
  float vmax = 3.0 + mid * 8.0 + high * 4.0;
  float vl = length(v.xyz);
  if (vl > vmax) v.xyz *= vmax / vl;
  s.xyz += v.xyz * uDt * (0.9 + mid * 2.2) * max(0.25, uSpeed);
  // Energy (used as particle brightness) follows high + speed
  v.w = mix(v.w, clamp(0.25 + high * 0.7 + mid * 0.3 + vl * 0.08, 0.0, 1.0), 0.15);
  s.w += uDt * (0.12 + mid * 0.08 + high * 0.05);
  bool dead = s.w >= 1.0 || any(isnan(s.xyz)) || any(isinf(s.xyz));
  // Recycle if far behind the camera or out of a loose world box
  float behind = dot(s.xyz - uCamPos, uCamFwd);
  if (behind < -6.0 || s.x < uBoundsMin.x - 8.0 || s.x > uBoundsMax.x + 8.0 ||
      s.z < uBoundsMin.z - 8.0 || s.z > uBoundsMax.z + 8.0) dead = true;
  if (dead) {
    vec4 n = spawn(id, uint(floor(uTime * 60.0)) + 1u);
    n.w = 0.0;
    s = n;
    v = vec4(0.0, 0.6 + uBass, 0.0, 0.4 + high * 0.4);
  }
  o = s;
  oVel = v;
}
`;

export const LAND_PARTICLE_VS = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uPos;
uniform sampler2D uVel;
uniform int uTexW;
uniform mat4 uVP;
uniform mat4 uView;
uniform float uSize;
uniform float uHigh;
uniform float uGlow;
uniform vec2 uRes;
out float vLife;
out float vEnergy;
out float vSize;
void main() {
  int id = gl_VertexID;
  ivec2 c = ivec2(id % uTexW, id / uTexW);
  vec4 s = texelFetch(uPos, c, 0);
  vec4 v = texelFetch(uVel, c, 0);
  vLife = s.w;
  vEnergy = v.w;
  vec4 clip = uVP * vec4(s.xyz, 1.0);
  gl_Position = clip;
  float fade = smoothstep(0.0, 0.08, s.w) * smoothstep(1.0, 0.82, s.w);
  // Near-camera soft shrink so the cloud doesn't fill the lens
  float pz = max(1.2, abs(clip.w));
  float px = uSize * (0.35 + v.w * 0.55 + uHigh * 0.25) * fade * (90.0 / pz);
  gl_PointSize = clamp(px, 0.8, 5.5);
  vSize = gl_PointSize;
}
`;

export const LAND_PARTICLE_FS = `#version 300 es
precision highp float;
uniform float uHue, uSat, uGlow;
uniform vec3 uPal0, uPal1, uPal2;
in float vLife;
in float vEnergy;
out vec4 o;

vec3 hueRot(vec3 c, float turns) {
  float a = turns * 6.2831853;
  float ca = cos(a), sa = sin(a);
  float y = 0.299*c.r + 0.587*c.g + 0.114*c.b;
  float i = 0.596*c.r - 0.274*c.g - 0.322*c.b;
  float q = 0.211*c.r - 0.523*c.g + 0.312*c.b;
  float i2 = i*ca - q*sa, q2 = i*sa + q*ca;
  return vec3(
    y + 0.956*i2 + 0.621*q2,
    y - 0.272*i2 - 0.647*q2,
    y - 1.106*i2 + 1.703*q2
  );
}

void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(p, p);
  if (r2 > 1.0) discard;
  float a = exp(-r2 * 2.6) * smoothstep(1.0, 0.15, r2);
  float fade = smoothstep(0.0, 0.08, vLife) * smoothstep(1.0, 0.82, vLife);
  vec3 pal = vEnergy < 0.5 ? mix(uPal1, uPal2, vEnergy * 2.0) : mix(uPal2, vec3(1.15, 0.95, 0.75), (vEnergy - 0.5) * 2.0);
  pal = hueRot(pal, uHue);
  pal = mix(vec3(dot(pal, vec3(0.299, 0.587, 0.114))), pal, uSat);
  // HDR peaks reserved for particles (pre-tonemap ~0.7-1.5), sparse enough that bloom has something to catch
  float peak = (0.65 + vEnergy * 0.7) * uGlow;
  vec3 col = pal * peak * a * fade;
  o = vec4(col, a * fade);
}
`;
