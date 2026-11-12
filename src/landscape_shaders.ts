// Landscape mode shaders (pass 2): sculpted pigment relief in a C4D-style AO studio look.
// Original MIT-licensed work for flow-engine. No Shadertoy code.
// - OKLab conversion follows Björn Ottosson's public OKLab definition (2020, public domain / MIT).
// - Surface-gradient bump mapping follows Morten Mikkelsen's published "Bump Mapping Unparametrized
//   Surfaces on the GPU" (2010) math.
// - snoise() is the existing Ashima Arts / Stefan Gustavson simplex noise in ./shaders (MIT).
// Terrain is kept in ~0-1.1 pre-tonemap; only sparse pigment glints exceed 1.

import { QUAD_VS, NOISE } from './shaders';

export const LAND_QUAD_VS = QUAD_VS;

const OKLAB = `
vec3 lin2oklab(vec3 c){
  float l=0.4122214708*c.r+0.5363325363*c.g+0.0514459929*c.b;
  float m=0.2119034982*c.r+0.6806995451*c.g+0.1073969566*c.b;
  float s=0.0883024619*c.r+0.2817188376*c.g+0.6299787005*c.b;
  l=pow(max(l,0.0),1.0/3.0); m=pow(max(m,0.0),1.0/3.0); s=pow(max(s,0.0),1.0/3.0);
  return vec3(0.2104542553*l+0.7936177850*m-0.0040720468*s,
              1.9779984951*l-2.4285922050*m+0.4505937099*s,
              0.0259040371*l+0.7827717662*m-0.8086757660*s);
}
vec3 oklab2lin(vec3 c){
  float l=c.x+0.3963377774*c.y+0.2158037573*c.z;
  float m=c.x-0.1055613458*c.y-0.0638541728*c.z;
  float s=c.x-0.0894841775*c.y-1.2914855480*c.z;
  l=l*l*l; m=m*m*m; s=s*s*s;
  return vec3(4.0767416621*l-3.3077115913*m+0.2309699292*s,
             -1.2684380046*l+2.6097574011*m-0.3413193965*s,
             -0.0041960863*l-0.7034186147*m+1.7076147010*s);
}
uniform vec3 uPal[6];
uniform int uPalN;
uniform float uHue, uSat;
// Palette lookup interpolated in OKLab, then hue-rotated / chroma-scaled in OKLab
vec3 palette(float t){
  t=clamp(t,0.0,1.0)*float(uPalN-1);
  int i=int(min(floor(t),float(uPalN-2)));
  float f=t-float(i);
  f=f*f*(3.0-2.0*f);
  vec3 a=lin2oklab(uPal[i]), b=lin2oklab(uPal[i+1]);
  vec3 o=mix(a,b,f);
  float ang=uHue*6.2831853; float ca=cos(ang), sa=sin(ang);
  o.yz=mat2(ca,sa,-sa,ca)*o.yz*uSat;
  return max(oklab2lin(o),0.0);
}
`;

const BACKDROP = `
uniform vec3 uBgTop, uBgBottom, uBgGlow;
uniform vec2 uRes;
vec3 backdrop(vec2 uv){
  vec3 c=mix(uBgBottom,uBgTop,smoothstep(0.0,1.0,uv.y));
  vec2 d=(uv-vec2(0.5,0.62))*vec2(1.5,1.0);
  c+=uBgGlow*exp(-dot(d,d)*3.2);
  return c;
}
`;

// Studio backdrop: soft gradient cyclorama + glow, like a C4D render on an infinite sweep
export const LAND_SKY_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
${BACKDROP}
void main(){ o=vec4(backdrop(vUv),1.0); }
`;

export const LAND_TERRAIN_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in vec4 aCol; // R=AO (Cycles bake) G=cavity B=height01 A=pigment zone
uniform mat4 uVP;
uniform mat4 uLightVP;
uniform float uBassLift, uBass, uKick;
out vec3 vW;
out vec3 vN;
out vec4 vCol;
out vec4 vLS;
void main(){
  vec3 p=aPos;
  // Audio lift (inactive while audio reactivity is off: uBass = uKick = 0)
  p.y+=uBassLift*(uBass+uKick*0.35)*(0.2+1.4*aCol.b*aCol.b);
  vW=p; vN=aNrm; vCol=aCol;
  vLS=uLightVP*vec4(p,1.0);
  gl_Position=uVP*vec4(p,1.0);
}
`;

export const LAND_SHADOW_FS = `#version 300 es
precision highp float;
out vec4 o;
void main(){ o=vec4(1.0); }
`;

export const LAND_TERRAIN_FS = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2DShadow;
uniform vec3 uEye;
uniform vec3 uKeyDir, uKeyCol, uSkyCol, uGroundCol, uRimCol;
uniform float uAmbient, uAOPow, uFog, uFogNear, uTime, uFlow, uPigment, uGrain, uBands;
uniform sampler2DShadow uShadow;
uniform float uShadowTexel, uShadowSoft;
in vec3 vW;
in vec3 vN;
in vec4 vCol;
in vec4 vLS;
out vec4 o;
${NOISE}
${OKLAB}
${BACKDROP}

const vec2 POIS[12]=vec2[12](vec2(-0.326,-0.406),vec2(-0.840,-0.074),vec2(-0.696,0.457),vec2(-0.203,0.621),
  vec2(0.962,-0.195),vec2(0.473,-0.480),vec2(0.519,0.767),vec2(0.185,-0.893),vec2(0.507,0.064),
  vec2(0.896,0.412),vec2(-0.322,-0.933),vec2(-0.792,-0.598));

float shadowAt(vec4 ls, float ndl){
  vec3 sc=ls.xyz/ls.w*0.5+0.5;
  if(any(lessThan(sc.xy,vec2(0.0)))||any(greaterThan(sc.xy,vec2(1.0)))) return 1.0;
  float bias=0.0006+0.0025*(1.0-ndl);
  float s=0.0;
  for(int i=0;i<12;i++) s+=texture(uShadow,vec3(sc.xy+POIS[i]*uShadowTexel*uShadowSoft,sc.z-bias));
  return s/12.0;
}

void main(){
  vec4 d=vCol;
  float ao=pow(clamp(d.r,0.0,1.0),uAOPow);
  float cav=d.g, h=d.b, zone=d.a;
  vec3 N=normalize(vN);
  vec3 V=normalize(uEye-vW);
  float dist=length(uEye-vW);

  // Fine sculpt detail: surface-gradient bump from a soft noise field, faded with distance
  float bumpAmt=0.22*smoothstep(140.0,30.0,dist);
  float hb=snoise(vW*0.55)*0.6+snoise(vW*1.4)*0.25;
  vec3 dpdx=dFdx(vW), dpdy=dFdy(vW);
  float dhx=dFdx(hb), dhy=dFdy(hb);
  vec3 r1=cross(dpdy,N), r2=cross(N,dpdx);
  float det=dot(dpdx,r1);
  vec3 grad=sign(det)*(dhx*r1+dhy*r2);
  N=normalize(abs(det)*N-grad*bumpAmt);

  // Flowing pigment: domain-warped noise advected slowly over the baked zones
  float tt=uTime*uFlow;
  vec2 q=vW.xz*0.019;
  vec2 w=vec2(snoise(vec3(q*1.2,tt*0.06)),snoise(vec3(q*1.2+5.2,tt*0.06+3.0)));
  vec2 qq=q*0.8+w*0.85+vec2(tt*0.025,-tt*0.015);
  float f=snoise(vec3(qq,tt*0.04))*0.75+snoise(vec3(qq*2.3+7.1,tt*0.05))*0.25;
  float t=0.5+0.85*f+(zone-0.5)*0.35+(h-0.5)*0.08;
  // Poured-paint banding: hold each pigment, then turn quickly into the next
  float tb=t*uBands; float fb=fract(tb);
  t=mix(t,(floor(tb)+smoothstep(0.15,0.85,fb))/uBands,0.45);
  t=clamp(t,0.0,1.0);
  vec3 albedo=palette(t);
  // Crests catch the light pigment, creases fall to the deepest one
  float crest=smoothstep(0.46,0.30,cav);
  float crease=smoothstep(0.54,0.75,cav);
  albedo=mix(albedo,palette(clamp(t+0.2,0.0,1.0)),crest*0.12);
  albedo=mix(albedo,palette(0.0),crease*0.22);
  albedo=mix(vec3(dot(albedo,vec3(0.2126,0.7152,0.0722))),albedo,uPigment);
  // Granular pigment (point-cloud feel from the references), world-locked
  uvec3 cell=uvec3(ivec3(floor(vW*7.0))+ivec3(4096));
  float g=h01(cell.x*73856093u^cell.y*19349663u^cell.z*83492791u);
  albedo*=1.0+(g-0.5)*uGrain;

  // Lighting: soft key with real shadows, AO-weighted sky dome, rim
  vec3 L=normalize(uKeyDir);
  float ndl=dot(N,L);
  float wrap=clamp((ndl+0.25)/1.25,0.0,1.0);
  float sh=shadowAt(vLS,max(ndl,0.0));
  vec3 key=uKeyCol*wrap*mix(0.18,1.0,sh)*mix(0.6,1.0,ao);
  vec3 dome=mix(uGroundCol,uSkyCol,N.y*0.5+0.5)*uAmbient*ao;
  vec3 col=albedo*(key+dome+0.015);
  vec3 Hh=normalize(L+V);
  float spec=pow(max(dot(N,Hh),0.0),48.0)*(0.04+0.96*pow(1.0-max(dot(V,Hh),0.0),5.0));
  col+=uKeyCol*spec*sh*0.35*ao;
  float rim=pow(1.0-max(dot(N,V),0.0),4.0);
  col+=uRimCol*rim*ao*0.35;
  // Sparse pigment glints: the only HDR peaks
  col+=albedo*step(0.995,g)*sh*0.9*smoothstep(60.0,15.0,dist);

  // Distance fade into the studio backdrop (an infinite cyc), plus thin low haze
  vec2 suv=gl_FragCoord.xy/uRes;
  float fogAmt=1.0-exp(-max(dist-uFogNear,0.0)*uFog*0.012);
  fogAmt=clamp(fogAmt,0.0,1.0);
  col=mix(col,backdrop(suv),fogAmt);
  o=vec4(col,1.0);
}
`;

// Optional curl-noise particle cloud (off by default in pass 2; style-first).
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

export const LAND_OKLAB = OKLAB;
