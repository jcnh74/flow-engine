// "Sculpt" Morph: ray-marched metaball sculpture on a studio cyclorama (pass 3: GGX gloss, iridescent
// pearl and satin-metal options, studio env reflections, fresnel rim; alpha = distance for DOF), shaded like a
// Cinema 4D ambient-occlusion render (sampled AO along the normal, soft penumbra shadows,
// white dome + softbox key, pigment colors per blob blended through OKLab).
// Original MIT-licensed work for flow-engine. No Shadertoy code. The SDF / soft-shadow /
// AO formulas follow the published distance-field rendering literature (Hart 1996 sphere
// tracing; smooth-min and penumbra estimates as described in Inigo Quilez's articles),
// re-implemented from the math, not copied.

import { LAND_OKLAB } from './landscape_shaders';

export const SCULPT_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform vec2 uRes;
uniform float uTime, uSpeed, uBlend, uAO, uOrbit;
uniform vec3 uBgTop, uBgBottom, uFloor, uKeyCol, uDomeCol, uRimCol, uGlowCol;
uniform int uMat;          // 0 matte clay, 1 gloss, 2 iridescent pearl, 3 satin metal
uniform float uIrid, uRim, uGloss;
${LAND_OKLAB}

const int NB=9;
vec3 bp[NB]; float br[NB];

void setup(float t){
  for(int i=0;i<NB;i++){
    float fi=float(i);
    float a=t*(0.21+0.037*fi)+fi*1.7;
    float b=t*(0.17+0.029*fi)+fi*2.3;
    bp[i]=vec3(sin(a)*1.7+sin(b*0.7)*0.5, 1.25+0.6*sin(b+fi)+0.25*sin(a*1.3), cos(a*0.8+fi)*1.2);
    br[i]=0.6+0.38*fract(sin(fi*12.9898)*43758.5453);
  }
}
float smin(float a,float b,float k){ float h=clamp(0.5+0.5*(b-a)/k,0.0,1.0); return mix(b,a,h)-k*h*(1.0-h); }
// Returns distance to the sculpture; w = blended pigment coordinate
float sculpt(vec3 p, out float w){
  float d=1e9; float ws=0.0, wt=0.0;
  for(int i=0;i<NB;i++){
    float di=length(p-bp[i])-br[i];
    float k=exp(-max(di,0.0)*4.0);
    ws+=k*float(i)/float(NB-1); wt+=k;
    d=smin(d,di,uBlend);
  }
  // gentle organic surface ripple
  d+=0.035*sin(p.x*5.0+uTime*0.6)*sin(p.y*4.0-uTime*0.4)*sin(p.z*5.0);
  w=ws/max(wt,1e-4);
  return d;
}
float map(vec3 p, out float w, out int mat){
  float d=sculpt(p,w); mat=1;
  float fl=p.y; // studio floor
  if(fl<d){ d=fl; mat=0; }
  return d;
}
float mapD(vec3 p){ float w; int m; return map(p,w,m); }
vec3 calcN(vec3 p){
  vec2 e=vec2(0.0015,0.0);
  return normalize(vec3(mapD(p+e.xyy)-mapD(p-e.xyy),mapD(p+e.yxy)-mapD(p-e.yxy),mapD(p+e.yyx)-mapD(p-e.yyx)));
}
float softShadow(vec3 ro, vec3 rd){
  float res=1.0, t=0.02;
  for(int i=0;i<40;i++){
    float h=mapD(ro+rd*t);
    res=min(res,10.0*h/t);
    t+=clamp(h,0.02,0.35);
    if(res<0.002||t>12.0) break;
  }
  res=clamp(res,0.0,1.0);
  return res*res*(3.0-2.0*res);
}
float ambientOcc(vec3 p, vec3 n){
  float occ=0.0, sc=1.0;
  for(int i=0;i<6;i++){
    float h=0.03+0.16*float(i);
    occ+=(h-mapD(p+n*h))*sc;
    sc*=0.82;
  }
  return clamp(1.0-occ*1.4*uAO,0.0,1.0);
}
void main(){
  vec2 frag=vUv*uRes;
  vec2 q=(2.0*frag-uRes)/uRes.y;
  float t=uTime*uSpeed;
  setup(t);
  float ang=0.6+uTime*0.05*uOrbit;
  vec3 ro=vec3(sin(ang)*5.4,2.3,cos(ang)*5.4);
  vec3 ta=vec3(0.0,1.1,0.0);
  vec3 cw=normalize(ta-ro), cu=normalize(cross(cw,vec3(0,1,0))), cv=cross(cu,cw);
  vec3 rd=normalize(q.x*cu+q.y*cv+2.1*cw);
  vec3 bg=mix(uBgBottom,uBgTop,smoothstep(-0.08,0.75,rd.y))+uGlowCol*pow(max(dot(rd,cw),0.0),6.0);
  float tt=0.0; float w=0.0; int mat=-1;
  for(int i=0;i<110;i++){
    vec3 p=ro+rd*tt;
    float ww; int mm;
    float d=map(p,ww,mm);
    if(d<0.0008*tt){ w=ww; mat=mm; break; }
    tt+=d*0.9;
    if(tt>40.0) break;
  }
  vec3 col=bg;
  float dist=1000.0;
  if(mat>=0){
    dist=tt;
    vec3 p=ro+rd*tt;
    vec3 n=calcN(p);
    vec3 L=normalize(vec3(-0.55,0.85,0.45));
    float sh=softShadow(p+n*0.004,L);
    float ao=ambientOcc(p,n);
    int m = mat==1 ? uMat : 0;
    vec3 albedo = mat==1 ? palette(clamp(0.04+0.92*clamp(w+0.08*sin(p.y*3.0+uTime*0.3),0.0,1.0),0.0,1.0)) : uFloor;
    float nv=max(dot(n,-rd),1e-3);
    float rough = m==0 ? 0.6 : m==1 ? 0.13 : m==2 ? 0.22 : 0.3;
    rough = clamp(rough/max(uGloss,0.05),0.05,0.9);
    vec3 f0=vec3(m==0?0.03:0.05);
    if(m==2){ vec3 film=0.5+0.5*cos(6.2831*(vec3(0.0,0.33,0.67)+nv*1.35+0.15)); albedo=mix(albedo,albedo*0.55+film*0.6,0.55*uIrid); f0=mix(f0,film*0.35,uIrid); }
    if(m==3){ f0=albedo*0.8; albedo*=0.25; }
    float dif=clamp((dot(n,L)+0.25)/1.25,0.0,1.0);
    float dome=0.55+0.45*n.y;
    vec3 diffc=albedo*(uDomeCol*dome*mix(0.38,1.0,ao)+uKeyCol*dif*sh*mix(0.6,1.0,ao));
    vec3 hh=normalize(L-rd); float a2=rough*rough; a2*=a2;
    float nh=max(dot(n,hh),0.0); float dd=nh*nh*(a2-1.0)+1.0;
    vec3 Fk=f0+(1.0-f0)*pow(1.0-max(dot(hh,-rd),0.0),5.0);
    vec3 spec=a2/(3.14159*dd*dd)*Fk*max(dot(n,L),0.0)*0.25*uKeyCol*sh;
    vec3 R=reflect(rd,n);
    vec3 env=mix(uBgBottom,uBgTop,smoothstep(-0.08,0.75,R.y))+uKeyCol*pow(max(dot(R,L),0.0),mix(90.0,6.0,rough))*mix(5.0,0.6,rough);
    vec3 Fe=f0+(max(vec3(1.0-rough),f0)-f0)*pow(1.0-nv,5.0);
    col=diffc*(1.0-Fe*0.5)+spec+env*Fe*mix(ao,1.0,0.25)*(m==0?0.35:1.0);
    if(mat==1) col+=uRimCol*uRim*pow(1.0-nv,3.0)*mix(0.4,1.0,ao);
    // fade the floor into the cyc (seamless infinite cove)
    float fog=1.0-exp(-max(tt-9.0,0.0)*0.12);
    col=mix(col,bg,fog);
  }
  o=vec4(col,dist);
}
`;
