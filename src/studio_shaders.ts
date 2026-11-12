// Studio scene shaders (pass 3): real-time "Cinema 4D studio abstract" look for Blender-authored GLB scenes.
// Baked Cycles AO (vertex), PCF soft shadows, GGX gloss + Schlick fresnel, studio-environment reflections
// (gradient cove + two softboxes), fresnel rim, thin-film style iridescence, infinite-cove floor fade,
// MSAA, and a cheap gather depth-of-field.
// Original MIT-licensed work for flow-engine. GGX / Schlick / Smith follow the published papers
// (Walter et al. 2007, Schlick 1994); no Shadertoy code.

export const ST_MESH_VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in vec4 aCol;
uniform mat4 uVP;
uniform vec3 uLAxis[8];
uniform vec3 uLPivot[8];
uniform float uLAngle[8];
out vec3 vW; out vec3 vN; out vec4 vC;
vec3 rotA(vec3 v, vec3 k, float a){ float c=cos(a), s=sin(a); return v*c + cross(k,v)*s + k*dot(k,v)*(1.0-c); }
void main(){
  int L = int(aCol.a*7.0+0.5);
  vec3 p = aPos; vec3 n = aNrm;
  if (L > 0) { vec3 k = normalize(uLAxis[L]); p = uLPivot[L] + rotA(p - uLPivot[L], k, uLAngle[L]); n = rotA(n, k, uLAngle[L]); }
  vW = p; vN = n; vC = aCol;
  gl_Position = uVP * vec4(p, 1.0);
}`;

export const ST_SHADOW_FS = `#version 300 es
precision highp float;
out vec4 o;
void main(){ o = vec4(1.0); }`;

// Shared studio environment (used by the backdrop, reflections and the floor fade)
const ENV = `
uniform vec3 uBgTop, uBgBottom, uBgGlow, uKeyCol, uFillCol, uLightDir, uFillDir, uCamFwd;
uniform float uBoxI;
vec3 backdrop(vec3 rd){
  float h = smoothstep(-0.08, 0.75, rd.y);
  vec3 c = mix(uBgBottom, uBgTop, h);
  float g = max(dot(rd, uCamFwd), 0.0);
  c += uBgGlow * pow(g, 6.0);
  return c;
}
vec3 envMap(vec3 rd, float rough){
  vec3 c = backdrop(rd);
  float sharp = mix(90.0, 6.0, rough);
  c += uKeyCol * uBoxI * pow(max(dot(rd, uLightDir), 0.0), sharp) * mix(5.0, 0.6, rough);
  c += uFillCol * uBoxI * pow(max(dot(rd, uFillDir), 0.0), sharp * 0.7) * mix(2.2, 0.3, rough);
  return c;
}`;

export const ST_BACK_FS = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform mat4 uInvVP;
uniform vec3 uCamPos;
${ENV}
void main(){
  vec4 a = uInvVP * vec4(vUv*2.0-1.0, 1.0, 1.0);
  vec3 rd = normalize(a.xyz/a.w - uCamPos);
  o = vec4(backdrop(rd), 1000.0);
}`;

export const ST_QUAD_VS = `#version 300 es
out vec2 vUv;
void main(){ vec2 p = vec2((gl_VertexID<<1)&2, gl_VertexID&2); vUv = p; gl_Position = vec4(p*2.0-1.0, 1.0, 1.0); }`;

export const ST_MESH_FS = `#version 300 es
precision highp float;
precision highp sampler2DShadow;
in vec3 vW; in vec3 vN; in vec4 vC;
out vec4 o;
uniform vec3 uCamPos;
uniform mat4 uLightVP;
uniform sampler2DShadow uShadow;
uniform float uShadowSoft, uShadowTexel;
uniform vec3 uSlots[8];
uniform vec3 uDomeCol, uGroundCol, uRimCol;
uniform float uKeyI, uDomeI, uRim, uAO, uGloss, uIrid, uFloorFade, uFog, uMatOverride, uTime, uSpecI;
${ENV}
const vec2 PD[12] = vec2[12](vec2(-0.326,-0.406),vec2(-0.840,-0.074),vec2(-0.696,0.457),vec2(-0.203,0.621),vec2(0.962,-0.195),vec2(0.473,-0.480),
  vec2(0.519,0.767),vec2(0.185,-0.893),vec2(0.507,0.064),vec2(0.896,0.412),vec2(-0.322,-0.933),vec2(-0.792,-0.598));
float shadowAt(vec3 p, vec3 n){
  vec4 lp = uLightVP * vec4(p + n*0.02, 1.0);
  vec3 s = lp.xyz/lp.w*0.5+0.5;
  if (s.x<0.0||s.x>1.0||s.y<0.0||s.y>1.0||s.z>1.0) return 1.0;
  float r = uShadowSoft*uShadowTexel;
  float a = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233)))*43758.5453)*6.2831;
  mat2 R = mat2(cos(a),-sin(a),sin(a),cos(a));
  float acc = 0.0;
  for (int i=0;i<12;i++) acc += texture(uShadow, vec3(s.xy + R*PD[i]*r, s.z - 0.0015));
  return acc/12.0;
}
float D_GGX(float nh, float a){ float a2=a*a; float d=nh*nh*(a2-1.0)+1.0; return a2/(3.14159*d*d); }
float V_Smith(float nv, float nl, float a){ float k=a*0.5; return 0.25/((nv*(1.0-k)+k)*(nl*(1.0-k)+k)); }
vec3 F_Schlick(vec3 f0, float c){ return f0 + (1.0-f0)*pow(1.0-c, 5.0); }
void main(){
  vec3 N = normalize(vN);
  vec3 V = normalize(uCamPos - vW);
  if (dot(N, V) < 0.0) N = -N;
  int slot = int(vC.g*7.0+0.5);
  int mat = int(vC.b*3.0+0.5);
  bool isFloor = slot == 7;
  if (!isFloor && uMatOverride >= 0.0) mat = int(uMatOverride+0.5);
  vec3 albedo = uSlots[slot];
  float ao = pow(clamp(vC.r, 0.0, 1.0), uAO);
  float rough = mat==0 ? 0.62 : mat==1 ? 0.14 : mat==2 ? 0.24 : 0.32;
  rough = clamp(rough / max(uGloss, 0.05), 0.05, 0.9);
  vec3 f0 = vec3(mat==0 ? 0.03 : 0.05);
  float nv = max(dot(N,V), 1e-3);
  if (mat==2) {
    // thin-film style iridescence: hue walks with the view angle (cosine palette)
    vec3 film = 0.5 + 0.5*cos(6.2831*(vec3(0.0,0.33,0.67) + nv*1.35 + 0.15));
    albedo = mix(albedo, albedo*0.55 + film*0.6, 0.55*uIrid);
    f0 = mix(f0, film*0.35, uIrid);
  }
  if (mat==3) { f0 = albedo*0.8; albedo *= 0.25; }
  vec3 Ld = normalize(uLightDir);
  float nl = max(dot(N, Ld), 0.0);
  float sh = shadowAt(vW, N);
  float wrap = clamp((dot(N, Ld)+0.25)/1.25, 0.0, 1.0);
  vec3 dome = mix(uGroundCol, uDomeCol, N.y*0.5+0.5);
  vec3 diff = albedo * (uKeyCol*uKeyI*wrap*sh + dome*uDomeI*ao);
  vec3 H = normalize(Ld + V);
  float a = rough*rough;
  vec3 Fk = F_Schlick(f0, max(dot(H,V),0.0));
  vec3 spec = D_GGX(max(dot(N,H),0.0), a) * V_Smith(nv, nl, a) * Fk * nl * uKeyCol*uKeyI*sh * uSpecI;
  vec3 Fe = f0 + (max(vec3(1.0-rough), f0) - f0)*pow(1.0-nv, 5.0);
  vec3 refl = envMap(reflect(-V, N), rough) * Fe * mix(ao, 1.0, 0.25) * (mat==0 ? 0.35 : 1.0) * uSpecI;
  vec3 rim = uRimCol * uRim * pow(1.0-nv, 3.0) * mix(0.4, 1.0, ao);
  vec3 col = diff*(1.0 - Fe*0.5) + spec + refl + rim*(isFloor ? 0.0 : 1.0);
  vec3 rd = -V;
  float dist = length(vW - uCamPos);
  if (isFloor) {
    float r = length(vW.xz);
    col = mix(col, backdrop(rd), smoothstep(uFloorFade*0.3, uFloorFade, r));
  }
  col = mix(col, backdrop(rd), 1.0 - exp(-max(dist-3.0, 0.0)*uFog));
  o = vec4(col, dist);
}`;

// Gather DOF: alpha carries view distance. Golden-angle disk, background-safe weights.
export const ST_DOF_FS = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uSrc;
uniform vec2 uTexel;
uniform float uFocus, uAperture, uMaxR;
float coc(float d){ return clamp(uAperture*abs(d-uFocus)/max(d,0.05), 0.0, uMaxR); }
void main(){
  vec4 c0 = texture(uSrc, vUv);
  float r0 = coc(c0.a);
  if (uAperture <= 0.0 || r0 < 0.5) { o = vec4(c0.rgb, 1.0); return; }
  vec3 acc = c0.rgb; float wsum = 1.0;
  for (int i=1;i<32;i++){
    float fi = float(i);
    float rr = sqrt(fi/32.0)*r0;
    float th = fi*2.39996;
    vec2 off = vec2(cos(th), sin(th))*rr;
    vec4 s = texture(uSrc, vUv + off*uTexel);
    float rs = coc(s.a);
    // a sharp foreground/background sample may not bleed into a blurred one beyond its own CoC
    float w = smoothstep(rr-1.5, rr+0.5, s.a > c0.a ? min(rs, r0) : rs);
    acc += s.rgb*w; wsum += w;
  }
  o = vec4(acc/wsum, 1.0);
}`;
