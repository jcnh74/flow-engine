// Grass Field mode shaders: single undulating ground plane, instanced curved blades, sun shadows, sky + haze.
import { COLOR } from './shaders';
export const G_COMMON = `
uniform float uT,uTerrA,uWind,uGustK,uGustSpeed,uFlutter; uniform vec2 uWindDir;
float gh1(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float gvn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(gh1(i),gh1(i+vec2(1,0)),f.x),mix(gh1(i+vec2(0,1)),gh1(i+vec2(1,1)),f.x),f.y); }
float hgt(vec2 p){ return uTerrA*(sin(p.x*.33+uT*.12)*.55+sin(p.y*.26-uT*.09+1.3)*.5+sin((p.x+p.y)*.55+uT*.17)*.22+(gvn(p*.4)-.5)*.5); }
vec3 tnorm(vec2 p){ float e=.05; return normalize(vec3(hgt(p-vec2(e,0))-hgt(p+vec2(e,0)),2.*e,hgt(p-vec2(0,e))-hgt(p+vec2(0,e)))); }
// rolling gusts travelling across the field + small-scale turbulence; returns bend vector in xz
vec2 windAt(vec2 p){ vec2 d=normalize(uWindDir); float ph=dot(p,d)*uGustK-uT*uGustSpeed;
  float g=.5+.5*sin(ph); g=g*g; float n=gvn(p*.35-d*uT*uGustSpeed*.3/max(uGustK,.01)); float gust=(.35+.65*g)*(.6+.8*n);
  vec2 side=vec2(-d.y,d.x)*(gvn(p*1.3+uT*.7)-.5)*.5; return (d*gust+side)*uWind; }
`;
export const BLADE_VS = `#version 300 es
precision highp float; precision highp int;
uniform mat4 uVP; uniform int uGN,uSeg; uniform float uGR,uH,uHR,uBW,uCurv,uStiff,uLean,uTwist,uClump;
${G_COMMON}
out vec3 vW; out vec3 vN; out vec3 vTg; out float vt; out float vHs; out vec2 vUV;
void main(){
  int inst=gl_InstanceID; int i=inst%uGN, j=inst/uGN; vec2 cid=vec2(i,j);
  float h1=gh1(cid*1.13+.5), h2=gh1(cid*2.71+3.1), h3=gh1(cid*.37+7.7), h4=gh1(cid*5.3+1.9);
  float cell=2.*uGR/float(uGN);
  vec2 p=vec2(-uGR)+(cid+vec2(h1,h2))*cell;
  // clumping: pull towards clump centres (0.35 m cells)
  vec2 cc=(floor(p/.35)+.5+ (vec2(gh1(floor(p/.35)),gh1(floor(p/.35)+9.))-.5)*.6)*.35; float cv=gh1(floor(p/.35)+4.);
  p=mix(p,cc,uClump*.45*h3);
  float H=uH*(1.+uHR*(h3-.5)*1.6)*(1.+uClump*(cv-.5)*.6); float W=uBW*(.75+.5*h4);
  float yaw=h1*6.2831853; 
  int r=gl_VertexID/2; float sg=(gl_VertexID%2==0)?-1.:1.; float t=float(r)/float(uSeg);
  vec3 root=vec3(p.x,hgt(p),p.y); vec3 tn=tnorm(p); vec3 up=normalize(mix(vec3(0,1,0),tn,.6));
  vec2 wv=windAt(p)/max(uStiff,.05); float fl=sin(uT*7.+h2*40.)*uFlutter*(.3+length(wv));
  vec2 lean=vec2(cos(yaw*1.7),sin(yaw*1.7))*uLean*(.4+h4)+wv;
  float bend=clamp(length(lean)+uCurv*.5,0.,1.6); vec2 ld=length(lean)>1e-4?normalize(lean):vec2(cos(yaw),sin(yaw));
  // spine: rises along 'up', bends over along lean direction (approx. length-preserving)
  float a=bend*t*1.15; vec3 bdir=normalize(vec3(ld.x,0.,ld.y)-up*dot(vec3(ld.x,0.,ld.y),up));
  vec3 spine=root+H*(up*(sin(max(a,1e-4))/max(bend*1.15,1e-4))+bdir*((1.-cos(a))/max(bend*1.15,1e-4)));
  if(bend<1e-3) spine=root+up*H*t;
  float a2=bend*min(t+.02,1.)*1.15; vec3 sp2=root+H*(up*(sin(max(a2,1e-4))/max(bend*1.15,1e-4))+bdir*((1.-cos(a2))/max(bend*1.15,1e-4)));
  vec3 Tg=normalize(sp2-spine+up*1e-5);
  float ang=yaw+uTwist*t*1.5; vec3 sideA=vec3(cos(ang),0.,sin(ang)); vec3 side=normalize(sideA-Tg*dot(sideA,Tg));
  spine+=side*fl*t*t*H*.3;
  float w=W*pow(max(1.-t,0.),.75)*(r==uSeg?0.:1.);
  vec3 pos=spine+side*sg*w*.5;
  vec3 N=normalize(cross(side,Tg)); N=normalize(N+side*sg*.45);
  vW=pos; vN=N; vTg=Tg; vt=t; vHs=h4; vUV=p/max(uGR,1.);
  gl_Position=uVP*vec4(pos,1.);
}`;
const LIGHT = `
uniform vec3 uEye,uSunDir,uSunCol,uSkyCol,uGndCol,uHazeCol; uniform float uHaze,uShSoft,uShTex,uAOMin,uTrans,uSpec,uSpecP;
uniform highp sampler2DShadow uShadow; uniform mat4 uLVP;
float shadowAt(vec3 wp,vec3 N){ vec4 c=uLVP*vec4(wp+N*.004+uSunDir*.006,1.); vec3 q=c.xyz/c.w*.5+.5; if(any(lessThan(q.xy,vec2(0)))||any(greaterThan(q.xy,vec2(1)))) return 1.;
  float s=0.; float k=uShTex*uShSoft; for(int y=-2;y<=2;y++) for(int x=-2;x<=2;x++) s+=texture(uShadow,vec3(q.xy+vec2(x,y)*k,q.z-.0015)); return s/25.; }
vec3 haze(vec3 col,vec3 wp){ float d=length(uEye-wp); float f=1.-exp(-d*uHaze); return mix(col,uHazeCol,f); }
`;
export const BLADE_FS = `#version 300 es
precision highp float; precision highp int; precision highp sampler2DShadow;
${COLOR}
${LIGHT}
uniform int uGrassColor; uniform float uColRand,uDry; uniform vec3 uGBase,uGTip,uGDry;
in vec3 vW; in vec3 vN; in vec3 vTg; in float vt; in float vHs; in vec2 vUV; out vec4 o;
void main(){
  vec3 N=normalize(vN); vec3 V=normalize(uEye-vW); if(dot(N,V)<0.) N=-N; vec3 T=normalize(vTg);
  vec3 alb;
  if(uGrassColor==1){ alb=patchCol(2,vUV)*mix(.45,1.,vt); }
  else { alb=mix(uGBase,uGTip,pow(vt,.8)); alb*=1.+(vHs-.5)*uColRand; alb=mix(alb,uGDry,smoothstep(.55,1.,vt)*uDry*smoothstep(.4,1.,vHs)); }
  vec3 Ld=normalize(uSunDir); float nl=dot(N,Ld); float wrap=clamp((nl+.35)/1.35,0.,1.);
  float sh=shadowAt(vW,N); float ao=mix(uAOMin,1.,pow(vt,.65));
  float back=pow(clamp(dot(-V,Ld),0.,1.),3.)*(.35+.65*vt)*uTrans;
  vec3 Hh=normalize(Ld+V); float th=dot(T,Hh); float kaj=pow(sqrt(max(0.,1.-th*th)),uSpecP)*uSpec*step(0.,nl+.2);
  vec3 sky=mix(uGndCol,uSkyCol,.5+.5*N.y);
  vec3 col=alb*(uSunCol*wrap*sh*ao + sky*ao) + alb*uSunCol*back*(.25+.75*sh)*1.4 + uSunCol*kaj*sh*ao;
  o=vec4(haze(col,vW),1.);
}`;
export const DEPTHONLY_FS = `#version 300 es
precision highp float; out vec4 o; void main(){ o=vec4(0); }`;
export const GROUND_VS = `#version 300 es
precision highp float; uniform mat4 uVP; uniform int uGRes; uniform float uGExt;
${G_COMMON}
out vec3 vW; out vec3 vN; out vec2 vUV;
void main(){ int R=uGRes+1; int vid=gl_VertexID; int q=vid%6, cellI=vid/6; int ci=cellI%uGRes, cj=cellI/uGRes;
  ivec2 off[6]=ivec2[6](ivec2(0,0),ivec2(1,0),ivec2(1,1),ivec2(0,0),ivec2(1,1),ivec2(0,1));
  vec2 g=vec2(ivec2(ci,cj)+off[q])/float(uGRes)*2.-1.; vec2 p=g*uGExt;
  vW=vec3(p.x,hgt(p),p.y); vN=tnorm(p); vUV=p; gl_Position=uVP*vec4(vW,1.); }`;
export const GROUND_FS = `#version 300 es
precision highp float; precision highp int; precision highp sampler2DShadow;
${COLOR}
${LIGHT}
uniform int uGrassOn; uniform float uGR; uniform vec3 uSoil,uGBase;
in vec3 vW; in vec3 vN; in vec2 vUV; out vec4 o;
float gn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); float a=fract(sin(dot(i,vec2(127.1,311.7)))*43758.5),b=fract(sin(dot(i+vec2(1,0),vec2(127.1,311.7)))*43758.5),c=fract(sin(dot(i+vec2(0,1),vec2(127.1,311.7)))*43758.5),d=fract(sin(dot(i+vec2(1,1),vec2(127.1,311.7)))*43758.5); return mix(mix(a,b,f.x),mix(c,d,f.x),f.y); }
void main(){ vec3 N=normalize(vN); vec3 V=normalize(uEye-vW);
  vec3 alb; float n=gn(vUV*6.)*.5+gn(vUV*23.)*.3+gn(vUV*90.)*.2;
  if(uGrassOn==1){ alb=uSoil*(.7+.6*n);
    // beyond the instanced field the ground reads as distant turf (no bald edge)
    float inF=1.-smoothstep(uGR*.82,uGR*.98,max(abs(vUV.x),abs(vUV.y))); alb=mix(uGBase*(.75+.5*n),alb*.55,inF); }
  else alb=lcol(0,.25+.6*n);
  vec3 Ld=normalize(uSunDir); float sh=shadowAt(vW,N); float nl=max(dot(N,Ld),0.);
  vec3 sky=mix(uGndCol,uSkyCol,.5+.5*N.y);
  vec3 col=alb*(uSunCol*nl*sh+sky*(uGrassOn==1?.55:1.));
  o=vec4(haze(col,vW),1.); }`;
export const SKY_VS = `#version 300 es
out vec2 vP; void main(){ vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2)*2.-1.; vP=p; gl_Position=vec4(p,.9999,1.); }`;
export const SKY_FS = `#version 300 es
precision highp float; uniform mat4 uInvVP; uniform vec3 uEye,uSunDir,uSunCol,uSkyCol,uHazeCol; uniform vec2 uSubOff,uSubScale; in vec2 vP; out vec4 o;
void main(){ vec2 ndc=vP; vec4 a=uInvVP*vec4(ndc,-1.,1.), b=uInvVP*vec4(ndc,1.,1.); vec3 d=normalize(b.xyz/b.w-a.xyz/a.w);
  float up=max(d.y,0.); vec3 col=mix(uHazeCol,uSkyCol,pow(up,.45));
  float sd=max(dot(d,normalize(uSunDir)),0.); col+=uSunCol*(pow(sd,900.)*6.+pow(sd,24.)*.18+pow(sd,4.)*.05);
  if(d.y<0.) col=uHazeCol; o=vec4(col,1.); }`;
