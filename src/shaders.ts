export const QUAD_VS = `#version 300 es
const vec2 P[3]=vec2[3](vec2(-1,-1),vec2(3,-1),vec2(-1,3));
out vec2 vUv; void main(){ vec2 p=P[gl_VertexID]; vUv=p*.5+.5; gl_Position=vec4(p,0,1);} `;
export const NOISE = `
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
 const vec2 C=vec2(1./6.,1./3.); const vec4 D=vec4(0.,.5,1.,2.);
 vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
 vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
 vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
 i=mod289(i);
 vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
 float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
 vec4 j=p-49.*floor(p*ns.z*ns.z);
 vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.*x_);
 vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.-abs(x)-abs(y);
 vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
 vec4 s0=floor(b0)*2.+1.; vec4 s1=floor(b1)*2.+1.; vec4 sh=-step(h,vec4(0.));
 vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
 vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
 vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
 p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
 vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.); m=m*m;
 return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
uint hsh(uint x){x^=x>>16;x*=0x7feb352dU;x^=x>>15;x*=0x846ca68bU;x^=x>>16;return x;}
float h01(uint x){return float(hsh(x))/4294967295.;}
`;
export const SIM_FS = `#version 300 es
precision highp float; precision highp int;
uniform sampler2D uState; uniform int uInit; uniform uint uSeed; uniform uint uFrame; uniform int uTexW;
uniform vec2 uHalf; uniform float uDt,uTime,uScale,uCurl,uTurb,uSpeed,uLife,uStretch,uBias; uniform int uOct; uniform vec2 uAxis; uniform vec2 uOffset;
out vec4 o;
${NOISE}
float fbm(vec3 p){ float a=.5,s=0.; for(int i=0;i<8;i++){ if(i>=uOct)break; s+=a*snoise(p); p=p*2.03+vec3(17.1,-9.3,3.7); a*=.5;} return s; }
vec2 curl(vec2 p,float t,float sc,vec3 off){
  // anisotropic sampling: stretch features along the long axis
  vec2 q=(p+uOffset)*sc; vec2 ax=uAxis, pe=vec2(-ax.y,ax.x);
  q=vec2(dot(q,ax)/uStretch,dot(q,pe));
  float e=.01; vec3 b=vec3(q,t)+off;
  float n1=fbm(b+vec3(0,e,0)),n2=fbm(b-vec3(0,e,0)),n3=fbm(b+vec3(e,0,0)),n4=fbm(b-vec3(e,0,0));
  vec2 v=vec2((n1-n2),-(n3-n4))/(2.*e); // in rotated frame
  return v.x*ax/uStretch+v.y*pe;
}
vec4 spawn(uint id,uint k){
  vec2 r=vec2(h01(id*7u+k*1315423911u+uSeed*2654435761u),h01(id*13u+k*2246822519u+uSeed*3266489917u+1u));
  return vec4((r*2.-1.)*uHalf, h01(id*31u+k+uSeed)*.999, h01(id*17u+uSeed));
}
void main(){
  ivec2 c=ivec2(gl_FragCoord.xy); uint id=uint(c.y*uTexW+c.x);
  if(uInit==1){ o=spawn(id,0u); return; }
  vec4 s=texelFetch(uState,c,0);
  vec2 v=curl(s.xy,uTime,uScale,vec3(float(uSeed%997u)*1.7))*uCurl;
  if(uTurb>0.) v+=curl(s.xy,uTime*1.7,uScale*3.1,vec3(41.,7.,float(uSeed%613u)))*uTurb;
  v+=uAxis*uBias;
  if(any(isnan(v))||any(isinf(v))) v=vec2(0); float vl=length(v); if(vl>40.) v*=40./vl;
  s.xy+=v*uSpeed*uDt*.05;
  s.z+=uDt*uLife*(.5+h01(id*5u+uSeed));
  s.w=mix(s.w,clamp(length(v)*.25,0.,1.),.08);
  vec2 lim=uHalf*1.05;
  bool bad=any(isnan(s))||any(isinf(s));
  if(bad||s.z>=1.||abs(s.x)>lim.x||abs(s.y)>lim.y){ vec4 n=spawn(id,uFrame+1u); n.z=0.; n.w=s.w; s=n; }
  o=s;
}`;
export const DRAW_VS = `#version 300 es
precision highp float; precision highp int;
uniform sampler2D uState; uniform sampler2D uPal; uniform int uTexW; uniform vec2 uC,uH; uniform float uPt,uSpeedMix,uPalOff;
out vec3 vCol; out float vA;
uint hsh(uint x){x^=x>>16;x*=0x7feb352dU;x^=x>>15;x*=0x846ca68bU;x^=x>>16;return x;}
void main(){
  int id=gl_VertexID; vec4 s=texelFetch(uState,ivec2(id%uTexW,id/uTexW),0);
  gl_Position=vec4((s.xy-uC)/uH,0,1); gl_PointSize=uPt;
  float t=fract(mix(float(hsh(uint(id))&1023u)/1023.,s.w,uSpeedMix)+uPalOff);
  vCol=texture(uPal,vec2(t,.5)).rgb;
  vA=smoothstep(0.,.08,s.z)*smoothstep(1.,.85,s.z);
}`;
export const DRAW_FS = `#version 300 es
precision highp float; in vec3 vCol; in float vA; uniform float uGain; out vec4 o;
void main(){ vec2 p=gl_PointCoord*2.-1.; float d=dot(p,p); if(d>1.)discard; float a=(1.-d)*vA*uGain; o=vec4(vCol*a,a);}`;
export const FADE_FS = `#version 300 es
precision highp float; uniform sampler2D uT; uniform float uDecay; in vec2 vUv; out vec4 o;
void main(){ vec4 t=texture(uT,vUv); if(any(isnan(t))||any(isinf(t))) t=vec4(0); o=min(t*uDecay,vec4(2000.)); }`;
export const BRIGHT_FS = `#version 300 es
precision highp float; uniform sampler2D uT; uniform float uExp,uThr; in vec2 vUv; out vec4 o;
void main(){ vec3 r=texture(uT,vUv).rgb; if(any(isnan(r))) r=vec3(0); vec3 c=1.-exp(-max(r,0.)*uExp); o=vec4(max(c-uThr,0.),1); }`;
export const BLUR_FS = `#version 300 es
precision highp float; uniform sampler2D uT; uniform vec2 uDir; in vec2 vUv; out vec4 o;
void main(){ float w[5]=float[5](.227,.1945,.1216,.054,.0162); vec3 c=texture(uT,vUv).rgb*w[0];
 for(int i=1;i<5;i++){ vec2 d=uDir*float(i); c+=(texture(uT,vUv+d).rgb+texture(uT,vUv-d).rgb)*w[i]; } o=vec4(c,1);}`;
export const COMP_FS = `#version 300 es
precision highp float; uniform sampler2D uT,uB1,uB2; uniform vec2 uOff,uFull; uniform float uExp,uBloom; uniform vec3 uBg; uniform int uCmyk,uFlip,uTone,uCyc; uniform vec3 uCycA,uCycB; uniform float uGrain,uGSeed;
vec3 aces(vec3 x){ return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.); }
vec3 filmic(vec3 x){ float L=dot(x,vec3(.2126,.7152,.0722)); vec3 c=x/(1.+L); float w=smoothstep(.6,4.,L); return clamp(mix(c,vec3(L/(1.+L)),w*.6)*1.15,0.,1.); }
out vec4 o;
void main(){
  vec2 uv=(gl_FragCoord.xy+uOff)/uFull;
  vec3 r=texture(uT,uv).rgb; if(any(isnan(r))) r=vec3(0); vec3 x=max(r,0.)*uExp; vec3 c=uTone==1?aces(x):uTone==2?filmic(x):1.-exp(-x);
  vec3 bl=texture(uB1,uv).rgb*.6+texture(uB2,uv).rgb*.8; if(any(isnan(bl))) bl=vec3(0); c+=max(bl,0.)*uBloom;
  if(uCyc==1){ float a=clamp(texture(uT,uv).a,0.,1.); vec2 q=uv-.5; vec3 bg=mix(uCycB,uCycA,clamp(uv.y*1.1,0.,1.))*(1.-dot(q,q)*.35); c=mix(bg,c,a); }
  else c=clamp(uBg+c,0.,1.);
  if(uGrain>0.){ float n=fract(sin(dot(gl_FragCoord.xy+uOff+uGSeed*vec2(17.,31.),vec2(12.9898,78.233)))*43758.5453)-.5; c+=n*uGrain*(.5+.5*(1.-c)); }
  if(uCmyk==1){ // conservative print gamut: cap chroma, avoid pure primaries, keep ink off 0/100
    float l=dot(c,vec3(.299,.587,.114)); vec3 d=c-l; float m=max(max(abs(d.r),abs(d.g)),abs(d.b));
    float lim=.42*(1.-abs(l-.5)*.9); if(m>lim) c=l+d*(lim/m);
    c.b=min(c.b,c.r*.5+c.g*.5+.55); c.g=min(c.g,.88);
    c=clamp(c,.035,.93);
  }
  o=vec4(c,1);
}`;

export const FABRIC = `
uniform vec2 uExt; uniform float uTime,uFold,uWarp,uScale,uSep,uStretch; uniform int uOct,uLayers; uniform vec3 uSeedOff; uniform vec2 uAxis;
uniform vec3 uGrav; uniform float uSag,uSettle,uFloor,uStiffFreq; uniform vec3 uWind;
vec3 vn(vec3 p){ return vec3(snoise(p),snoise(p+vec3(31.4,-12.1,7.7)),snoise(p+vec3(-5.3,19.9,-27.1))); }
vec3 field(vec3 b){
  vec2 ax=uAxis, pe=vec2(-ax.y,ax.x); vec2 r=vec2(dot(b.xy,ax)/uStretch,dot(b.xy,pe));
  vec3 q=vec3(r,b.z)*uScale+uSeedOff;
  q+=uWarp*vn(q*.55+vec3(0,0,uTime*.35));
  q+=uWarp*.5*vn(q*1.1-vec3(uTime*.21,0,uTime*.17));
  vec3 d=vec3(0); float a=1.;
  for(int i=0;i<6;i++){ if(i>=uOct)break; d+=a*vn(q+vec3(0,0,uTime*.25*float(i+1))); q=q*2.02+vec3(3.1,-1.7,5.3); a*=.38; }
  vec3 dr=vec3(d.x*ax+d.y*pe, d.z);
  return dr/uScale;
}
// gravity drape: sheet hangs from low-frequency "support" ridges, sags between them, wrinkles, and pools on a soft floor
vec3 drape(vec3 p,vec2 uv,float layer){
  float gs=length(uGrav); if(gs<1e-4&&dot(uWind,uWind)<1e-6) return p;
  vec3 gd=gs>1e-4?uGrav/gs:vec3(0,-1,0);
  float sup=smoothstep(.25,.75,snoise(vec3(uv*uExt*.32*uStiffFreq,layer*3.1)+uSeedOff*.013)*.5+.5);
  float sag=uSag*gs*uSettle*(1.-sup);
  p+=gd*sag*(1.+.35*snoise(vec3(uv*uExt*.9,layer+7.)));
  p+=vn(p*1.4+uSeedOff*.01)*.07*sag;                              // wrinkles from compression
  p+=uWind*(1.-sup)*(.6+.4*snoise(vec3(uv*uExt*.5,uTime*.8+layer)));  // wind / noise forcing
  float h=dot(p,gd), over=h-uFloor;
  if(over>0.){ float k=over/(1.+over*1.8);                           // soft floor: pile up instead of passing through
    p-=gd*(over-k*.25); vec3 lat=p-gd*dot(p,gd); p+=normalize(lat+1e-4)*k*.3+vn(p*1.2+uSeedOff*.02)*k*.22; }
  return p;
}
vec3 P(vec2 uv,float layer){ vec3 b=vec3(uv*uExt,(layer-float(uLayers-1)*.5)*uSep); vec3 p=b+uFold*field(b+vec3(0,0,layer*1.7)); return drape(p,uv,layer); }
`;
export const SURF_VS = `#version 300 es
precision highp float; precision highp int;
uniform ivec2 uRes; uniform mat4 uVP; uniform mat4 uView; uniform int uDepthOnly;
out vec3 vW; out vec3 vN; out float vH; out float vL; out vec3 vV; out vec2 vUV; out float vSh;
uniform int uShellN; uniform float uFurLen,uComb,uFurWind,uWT;
${NOISE}
${FABRIC}
void main(){
  int R=uRes.x+1; int i=gl_VertexID%R, j=gl_VertexID/R; vec2 uv=vec2(i,j)/vec2(uRes)*2.-1.; float L=float(gl_InstanceID); vUV=uv; vSh=0.; if(uShellN>0){ vSh=float(gl_InstanceID+1)/float(uShellN); L=0.; }
  if(uDepthOnly==1){ vec3 q=P(uv,L); vW=q; vN=vec3(0,0,1); vH=0.; vL=L; vV=vec3(0); gl_Position=uVP*vec4(q,1); return; }
  vec2 e=1.5/vec2(uRes);
  vec3 p=P(uv,L), pu=P(uv+vec2(e.x,0),L), pv=P(uv+vec2(0,e.y),L);
  vN=normalize(cross(pu-p,pv-p)); if(vSh>0.){ vec3 nn=vN; if(nn.z<0.) nn=-nn; vec3 g=vec3(0,-1,0); vec3 comb=normalize(g-nn*dot(g,nn)+vec3(1e-4,0,0)); float wv=sin(uWT*1.7+p.x*1.3+p.y*.7)*uFurWind; p+=nn*uFurLen*vSh+(comb*uComb+vec3(wv,0,0))*uFurLen*vSh*vSh; }
  vW=p; vH=(p.z-(L-float(uLayers-1)*.5)*uSep)/max(uFold,.01); vL=L; vV=(uView*vec4(p,1)).xyz;
  gl_Position=uVP*vec4(p,1);
}`;
export const DEPTH_FS = `#version 300 es
precision highp float; uniform float uClipY; in vec3 vW; out vec4 o; void main(){ if(vW.y<uClipY) discard; o=vec4(1); }`;
export const COLOR = `
uniform sampler2D uPalL; uniform vec4 uLC0,uLC1,uLC2; uniform int uMix1,uMixO,uGrad,uBeadMode; uniform float uMixA1,uMixAO,uHueT; uniform vec3 uBeadSolid;
float lum3(vec3 c){ return dot(c,vec3(.299,.587,.114)); }
vec3 hueR(vec3 c,float h){ float a=h*6.2831853; vec3 k=vec3(.57735); float ca=cos(a); return c*ca+cross(k,c)*sin(a)+k*dot(k,c)*(1.-ca); }
vec3 lcol(int row,float t){ vec4 k=row==0?uLC0:(row==1?uLC1:uLC2); vec3 c=texture(uPalL,vec2(fract(t),(float(row)+.5)/3.)).rgb;
  c=hueR(c,k.x+uHueT); float l=lum3(c); c=mix(vec3(l),c,k.y); c=(c-.5)*k.z+.5; return clamp(c,0.,4.); }
vec3 setLum(vec3 c,float l){ return clamp(c+(l-lum3(c)),0.,1.); }
float sat3(vec3 c){ return max(c.r,max(c.g,c.b))-min(c.r,min(c.g,c.b)); }
vec3 blendM(int m,vec3 b,vec3 s){
  if(m==1) return b+s; if(m==2) return 1.-(1.-b)*(1.-s); if(m==3) return b*s;
  if(m==4) return mix(2.*b*s,1.-2.*(1.-b)*(1.-s),step(.5,b));
  if(m==5) return mix(b-(1.-2.*s)*b*(1.-b), b+(2.*s-1.)*(sqrt(max(b,0.))-b), step(.5,s));
  if(m==6){ float sb=sat3(b), ss=sat3(s); vec3 h=ss>1e-4?(s-min(s.r,min(s.g,s.b)))/ss*sb:vec3(0); return setLum(h,lum3(b)); }
  if(m==7) return setLum(s,lum3(b));
  return s; }

uniform int uPShape; uniform float uPScale,uPSoft,uPSeed,uPJit,uPDrift,uPTime,uPFab,uPOff;
vec2 ph2(vec2 c){ c+=uPSeed*17.13; vec2 q=vec2(dot(c,vec2(127.1,311.7)),dot(c,vec2(269.5,183.3))); return fract(sin(q)*43758.5453); }
float vn2(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(ph2(i).x,ph2(i+vec2(1,0)).x,f.x),mix(ph2(i+vec2(0,1)).x,ph2(i+vec2(1,1)).x,f.x),f.y); }
// returns: x=palette t of region A, y=t of region B, z=blend A->B, w=region hash (jitter)
vec4 patchF(vec2 uv){
  vec2 p=uv*uPScale+vec2(.37,.11)*uPDrift*uPTime; float K=5.;
  if(uPShape==0){ vec2 ip=floor(p),fp=fract(p); float d1=9.,d2=9.; vec2 c1=vec2(0),c2=vec2(0);
    for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){ vec2 g=vec2(i,j); vec2 o=ph2(ip+g); float d=length(g+o-fp); if(d<d1){ d2=d1; c2=c1; d1=d; c1=ip+g; } else if(d<d2){ d2=d; c2=ip+g; } }
    float ia=mod(c1.x+2.*c1.y+floor(ph2(c1+3.1).x*2.)*2.,K), ib=mod(c2.x+2.*c2.y+floor(ph2(c2+3.1).x*2.)*2.,K);
    if(ib==ia) ib=mod(ia+2.,K);
    float bl=.5*(1.-smoothstep(0.,max(uPSoft,1e-3)*.6+1e-3,d2-d1)); return vec4(ia/K,ib/K,bl,ph2(c1+9.7).x); }
  if(uPShape==1){ float n=vn2(p*.8)*.6+vn2(p*1.7+5.)*.3+vn2(p*3.4+9.)*.1; float b=n*K*1.4; float ia=floor(b), fr=fract(b);
    float bl=smoothstep(1.-max(uPSoft,1e-3)*.5,1.,fr); return vec4(mod(ia,K)/K,mod(ia+1.,K)/K,bl,ph2(vec2(ia,1.)).x); }
  float b=(p.x*.8+p.y*.45+vn2(p*.6)*.8)*1.2; float ia=floor(b), fr=fract(b);
  float bl=smoothstep(1.-max(uPSoft,1e-3)*.5,1.,fr); return vec4(mod(ia,K)/K,mod(ia+1.,K)/K,bl,ph2(vec2(ia,7.)).x); }
vec3 patchCol(int row,vec2 uv){ vec4 f=patchF(uv); float j=(f.w-.5)*uPJit;
  vec3 a=lcol(row,.3+.7*(f.x+.1)), b=lcol(row,.3+.7*(f.y+.1)); vec3 c=mix(a,b,f.z); c=hueR(c,j*.12); return c*(1.+j*.5); }
`;
export const LIGHTING = `uniform sampler2D uPal; uniform vec3 uEye; uniform mat4 uView;
uniform float uGloss,uSpec,uIrid,uRim,uFog,uFogStart,uSat,uBright,uPalOff,uPx;
uniform int uNL; uniform int uLType[4]; uniform vec3 uLPos[4]; uniform vec3 uLCol[4]; uniform float uLCos[4]; uniform int uLSh[4]; uniform mat4 uLVP[4];
uniform sampler2DShadow uSC0,uSC1,uSC2,uSC3; uniform sampler2D uSD0,uSD1,uSD2,uSD3; uniform float uShSoft,uShBias,uShTexel[4];
uniform float uEnvI,uEnvRot;
const float PI=3.14159265;
vec3 pal(float t){ return texture(uPal,vec2(fract(t),.5)).rgb; }
float hash12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
// procedural studio environment: dark gradient room + softbox strips
float box(float a,float a0,float w,float s){ return smoothstep(w+s,w-s,abs(a-a0)); }
vec3 env(vec3 d,float rough){
  float c=cos(uEnvRot),s=sin(uEnvRot); d=vec3(c*d.x+s*d.z,d.y,-s*d.x+c*d.z);
  float az=atan(d.x,d.z), el=asin(clamp(d.y,-1.,1.)); float sf=.03+rough*.5;
  vec3 col=mix(vec3(.012,.012,.016),vec3(.07,.075,.09),smoothstep(-.4,.9,d.y));
  col+=vec3(5.)*box(el,1.15,.18,sf)*box(az,0.,1.1,sf);              // overhead strip
  col+=vec3(3.6,3.4,3.2)*box(az,1.25,.10,sf)*box(el,.25,.55,sf);   // right vertical strip
  col+=vec3(2.6,2.8,3.2)*box(az,-1.35,.13,sf)*box(el,.2,.5,sf);    // left vertical strip
  col+=vec3(1.4)*box(az,3.0,.35,sf)*box(el,.35,.25,sf);            // back kicker
  return col;
}
float pcss(sampler2DShadow sc,sampler2D sd,vec3 wp,mat4 vp,float texel,vec3 N){
  vec4 lp=vp*vec4(wp,1); vec3 p=lp.xyz/lp.w*.5+.5; if(p.x<0.||p.x>1.||p.y<0.||p.y>1.||p.z>1.) return 1.;
  float z=p.z-uShBias; float a=hash12(wp.xy*913.+wp.z*71.)*6.2831; mat2 R=mat2(cos(a),sin(a),-sin(a),cos(a));
  // blocker search
  float sr=texel*(4.+uShSoft*60.), bs=0., bn=0.;
  for(int i=0;i<12;i++){ float fi=float(i)+.5; vec2 off=R*vec2(cos(fi*2.39996),sin(fi*2.39996))*sqrt(fi/12.); float d=texture(sd,p.xy+off*sr).r; if(d<z){bs+=d;bn+=1.;} }
  if(bn<1.) return 1.;
  float pen=clamp((z-bs/bn)*uShSoft*40.,0.,1.); float fr=texel*(1.5+pen*80.*uShSoft);
  float sh=0.;
  for(int i=0;i<16;i++){ float fi=float(i)+.5; vec2 off=R*vec2(cos(fi*2.39996),sin(fi*2.39996))*sqrt(fi/16.); sh+=texture(sc,vec3(p.xy+off*fr,z)); }
  return sh/16.;
}
float shadowAt(int k,vec3 wp,vec3 N){
  if(k==0) return pcss(uSC0,uSD0,wp,uLVP[0],uShTexel[0],N);
  if(k==1) return pcss(uSC1,uSD1,wp,uLVP[1],uShTexel[1],N);
  if(k==2) return pcss(uSC2,uSD2,wp,uLVP[2],uShTexel[2],N);
  if(k==3) return pcss(uSC3,uSD3,wp,uLVP[3],uShTexel[3],N);
  return 1.;
}

vec3 shade(vec3 wp,vec3 N,vec3 V,vec3 alb,float rough,vec3 F0,vec3 rimCol,float rimAmt){
  float NdV=clamp(dot(N,V),1e-3,1.); float a=rough*rough, a2=a*a; vec3 col=vec3(0); vec3 swp=wp+N*.004;
  for(int i=0;i<4;i++){ if(i>=uNL) break;
    vec3 Lv; float att=1.;
    if(uLType[i]==0){ Lv=normalize(uLPos[i]); }
    else { vec3 d=uLPos[i]-wp; float dl=length(d); Lv=d/dl; float r0=length(uLPos[i]); att=r0*r0/(dl*dl+.05);
      if(uLType[i]==1){ float cd=dot(-Lv,normalize(-uLPos[i])); att*=smoothstep(uLCos[i],mix(uLCos[i],1.,.25),cd); } }
    float NdL=dot(N,Lv); if(NdL<=0.) continue;
    float sh=uLSh[i]>=0?shadowAt(uLSh[i],swp,N):1.;
    vec3 H=normalize(Lv+V); float NdH=max(dot(N,H),0.), VdH=max(dot(V,H),0.);
    float D=a2/(PI*pow(NdH*NdH*(a2-1.)+1.,2.)); float k=a*.5; float G=.25/((NdL*(1.-k)+k)*(NdV*(1.-k)+k));
    vec3 F=F0+(1.-F0)*pow(1.-VdH,5.);
    col+=(alb*(1.-F)/PI*1.6+D*G*F*uSpec)*uLCol[i]*NdL*att*sh;
  }
  vec3 R=reflect(-V,N); vec3 Fe=F0+(max(vec3(1.-rough),F0)-F0)*pow(1.-NdV,5.);
  col+=env(R,rough)*Fe*uEnvI*uSpec*.6 + alb*env(N,1.)*uEnvI*.25;
  col+=rimAmt*pow(1.-NdV,4.)*rimCol*.6*(.3+uEnvI);
  return col;
}
`;
export const SURF_FS = `#version 300 es
precision highp float; precision highp int; precision highp sampler2DShadow;
${LIGHTING}
in vec3 vW; in vec3 vN; in float vH; in float vL; in vec3 vV; in vec2 vUV; in float vSh;
layout(location=0) out vec4 o; layout(location=1) out vec4 oPos; layout(location=2) out vec4 oNrm;
uniform float uClipY; uniform int uMat,uWallPatch,uShellN2; uniform float uWT2,uFurDens,uRough2,uAbsorb2,uDisp; uniform vec3 uMatCol;
float mh(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
vec3 studio(vec3 d,float r){ float y=d.y; vec3 c=mix(vec3(.42),vec3(.85),smoothstep(-.4,.6,y)); vec2 sb=vec2(atan(d.x,d.z),y); float k=smoothstep(.35+r,.15,length((sb-vec2(.6,.55))*vec2(1.,1.4))); float k2=smoothstep(.3+r,.1,length((sb-vec2(-2.4,.3))*vec2(1.6,1.))); return c+vec3(6.)*k*(1.-r*1.5)+vec3(2.5)*k2*(1.-r*1.5); }
float mn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(mh(i),mh(i+vec2(1,0)),f.x),mix(mh(i+vec2(0,1)),mh(i+vec2(1,1)),f.x),f.y); }
${COLOR}
void main(){
  if(vW.y<uClipY) discard;
  vec3 N=normalize(vN); if(any(isnan(N))) N=vec3(0,0,1);
  vec3 V=normalize(uEye-vW); if(dot(N,V)<0.) N=-N;
  float NdV=clamp(dot(N,V),1e-3,1.);
  float curv=clamp(length(fwidth(N))*4.*uPx,0.,1.);
  float t=uPalOff+.32*vH+.22*dot(N,vec3(.3,.55,.78))+.25*curv+vL*.19;
  if(uGrad==1) t=uPalOff+length(uEye-vW)*.22+vL*.19; else if(uGrad==2) t=uPalOff+vW.y*.35+.5+vL*.19; else if(uGrad==3) t=uPalOff+.5+.5*dot(N,normalize(vec3(.4,.7,.5)));
  vec3 alb=lcol(0,t); if(vL>.5){ vec3 top=lcol(1,t); alb=mix(top,blendM(uMix1,alb,top),uMixA1); }
  if(uPFab>0.) alb=mix(alb,patchCol(vL>.5?1:0,vUV+vec2(uPOff)),uPFab);
  if(uMat>0){ alb=uWallPatch==1?patchCol(0,vUV):uMatCol; }
  float l=dot(alb,vec3(.299,.587,.114)); alb=max(mix(vec3(l),alb,uSat),0.)*uBright;
  if(uMat>0){ vec3 col; float dd=length(uEye-vW); float fg=1.-exp(-max(dd-uFogStart,0.)*uFog);
    if(uMat==1){ // water
      vec2 q=vUV*38.+vec2(uWT2*.6,uWT2*.4); float e=.05; float h0=mn(q)+mn(q*2.3+3.)*.5; vec2 gr=vec2(mn(q+vec2(e,0))+mn((q+vec2(e,0))*2.3+3.)*.5-h0, mn(q+vec2(0,e))+mn((q+vec2(0,e))*2.3+3.)*.5-h0)/e;
      vec3 Nw=normalize(N+(vec3(gr,0.)*.04)); float fr=.02+.98*pow(1.-clamp(dot(Nw,V),0.,1.),5.);
      vec3 tr=studio(refract(-V,Nw,1./1.33),.05)*exp(-uAbsorb2*(1.-alb)*.8); float ca=pow(mn(q*.7+uWT2*.3)*mn(q*1.3-uWT2*.2),3.)*3.;
      col=tr*(1.+ca*.6)+studio(reflect(-V,Nw),.02)*fr*1.4+shade(vW,Nw,V,alb*.05,.04,vec3(.02),vec3(0),0.);
    } else if(uMat==2){ // glass
      vec3 tr; float rg=uRough2; tr.r=studio(refract(-V,N,1./(1.47-uDisp)),rg).r; tr.g=studio(refract(-V,N,1./1.5),rg).g; tr.b=studio(refract(-V,N,1./(1.53+uDisp)),rg).b;
      float th=1./max(NdV,.2); vec3 tint=pow(max(alb,vec3(.02)),vec3(th*uAbsorb2*.35));
      float fr=.04+.96*pow(1.-NdV,5.); col=tr*tint*(1.-fr)+studio(reflect(-V,N),rg)*fr*1.3+shade(vW,N,V,vec3(0),max(rg,.03),vec3(.04),vec3(0),0.);
    } else if(uMat==3){ // clay
      float mb=mn(vUV*180.)*.6+mn(vUV*520.)*.4; float fp=sin(length(fract(vUV*9.)-.5)*220.)*.5+.5; vec3 Nc=normalize(N+vec3(mb-.5,fp*.2-.1,0.)*.06);
      col=shade(vW,Nc,V,alb*(.9+.15*mb),.88,vec3(.03),vec3(0),0.); col+=alb*.06*pow(1.-NdV,2.);
    } else { // fur (4) / grass (5): base under the shells, shells discard outside strands
      float isG=uMat==5?1.:0.; float dens=uFurDens*(isG>0.?.35:1.); vec2 cell=vUV*dens; vec2 ci=floor(cell); vec2 cf=fract(cell)-.5; vec2 jo=(vec2(mh(ci),mh(ci+7.))-.5)*.6;
      float rr=length(cf-jo); float taper=isG>0.?(1.-vSh)*.42:(1.-vSh*.7)*.45;
      if(vSh>0.&&rr>taper*(.6+.6*mh(ci+3.))) discard;
      vec3 a2=isG>0.?mix(alb*.35,alb*1.2,vSh):alb*mix(.45,1.1,vSh); a2*=.85+.3*mh(ci+11.);
      vec3 Tn=normalize(N+vec3(0,-.6,0)); vec3 Hh=normalize(normalize(uLPos[0])+V); float th=dot(Tn,Hh); float kaj=pow(sqrt(max(0.,1.-th*th)),isG>0.?40.:90.)*.35;
      vec3 Ld=normalize(uLPos[0]); col=(vSh>0.?a2*(uLCol[0]*max(dot(N,Ld)*.5+.5,0.)*.9+studio(N,.8)*.35):shade(vW,N,V,a2,.75,vec3(.03),vec3(0),0.))*mix(.45,1.15,vSh)+kaj*mix(a2,vec3(1),.4)*mix(.2,1.,vSh)+a2*.18*studio(N,.6).g*vSh;
    }
    col*=1.-fg; o=vec4(max(col,0.),1); oPos=vec4(vV,1); oNrm=vec4(normalize(mat3(uView)*N),1); return; }
  vec3 irid=.5+.5*cos(6.2831*(vec3(0.,.33,.67)+NdV*1.6+vH*.4));
  float rough=clamp(sqrt(2./(uGloss+2.))*1.6,.05,1.);
  vec3 F0=mix(vec3(.05),irid*.9,uIrid*.7);
  vec3 col=shade(vW,N,V,alb,rough,F0,mix(pal(t+.35),irid*1.2,uIrid),uRim);
  col+=alb*irid*uIrid*.03;
  float d=length(uEye-vW); float f=1.-exp(-max(d-uFogStart,0.)*uFog); col*=1.-f;
  o=vec4(max(col,0.),1); oPos=vec4(vV,1); oNrm=vec4(normalize(mat3(uView)*N),1);
}`;
export const SSAO_FS = `#version 300 es
precision highp float;
uniform sampler2D uPos,uNrm; uniform mat4 uProj; uniform vec2 uFull,uPixOff; uniform float uRadius,uMaxPx,uStrength; in vec2 vUv; out vec4 o;
float h(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
void main(){
  vec4 P4=texture(uPos,vUv); if(P4.w<.5){ o=vec4(1); return; }
  vec3 P=P4.xyz, N=normalize(texture(uNrm,vUv).xyz);
  float focal=uProj[1][1]*uFull.y*.5; float R=min(uRadius,uMaxPx*(-P.z)/focal);
  vec2 g=gl_FragCoord.xy+uPixOff; float a=h(g)*6.2831;
  vec3 rv=vec3(cos(a),sin(a),0.); vec3 T=normalize(rv-N*dot(rv,N)); vec3 B=cross(N,T);
  float occ=0.;
  for(int i=0;i<16;i++){
    float fi=float(i); float r1=h(vec2(fi,1.7)), r2=h(vec2(fi,9.3)), r3=h(vec2(fi,4.1));
    vec3 s=normalize(vec3(r1*2.-1.,r2*2.-1.,r3*.9+.1)); float sc=fi/16.; s*=mix(.1,1.,sc*sc)*(.5+.5*h(g+fi));
    vec3 sp=P+(T*s.x+B*s.y+N*s.z)*R;
    vec4 c=uProj*vec4(sp,1); vec2 su=c.xy/c.w*.5+.5;
    vec4 q=texture(uPos,su); if(q.w<.5) continue;
    float rc=smoothstep(0.,1.,R/abs(P.z-q.z));
    occ+=(q.z>=sp.z+.02*R?1.:0.)*rc;
  }
  float ao=1.-occ/16.; o=vec4(vec3(mix(1.,ao*ao,uStrength)),1);
}`;
export const APPLYAO_FS = `#version 300 es
precision highp float; uniform sampler2D uT,uAO; in vec2 vUv; out vec4 o;
void main(){ vec4 c=texture(uT,vUv); o=vec4(c.rgb*texture(uAO,vUv).r,c.a); }`;

// ---------- Particle Fabric: 3D particles bound to the fabric + gravity wells ----------
export const PSIM_FS = `#version 300 es
precision highp float; precision highp int;
uniform sampler2D uPos,uVel,uUv; uniform int uInit,uTexW; uniform uint uSeed,uFrame; uniform float uDt;
uniform float uCoh,uBlend,uStream,uLifeR,uVmax,uTurb,uGWell; uniform int uNW; uniform vec4 uW[4]; uniform vec2 uWP[4]; uniform vec3 uBound;
layout(location=0) out vec4 oPos; layout(location=1) out vec4 oVel; layout(location=2) out vec4 oUv;
${NOISE}
${FABRIC}
vec4 seedUv(uint id,uint k){ return vec4((h01(id*7u+k*1315423911u+uSeed*2654435761u)*2.-1.)*.62, (h01(id*13u+k*2246822519u+uSeed*3266489917u+1u)*2.-1.)*.62, floor(h01(id*29u+k*97u+uSeed)*float(uLayers)), h01(id*17u+uSeed)); }
void main(){
  ivec2 c=ivec2(gl_FragCoord.xy); uint id=uint(c.y*uTexW+c.x);
  vec4 U, X, Vv;
  if(uInit==1){ U=seedUv(id,0u); X=vec4(P(U.xy,U.z),h01(id*31u+uSeed)); Vv=vec4(0); oPos=X; oVel=Vv; oUv=U; return; }
  X=texelFetch(uPos,c,0); Vv=texelFetch(uVel,c,0); U=texelFetch(uUv,c,0);
  // stream along the long axis over the surface
  U.xy+=uAxis*uStream*uDt*(.5+U.w)*.12;
  vec3 tgt=P(U.xy,U.z);
  float k=60.*uCoh; vec3 Ff=(tgt-X.xyz)*k-Vv.xyz*2.*sqrt(k)*.8;
  vec3 Fg=uGrav;
  for(int i=0;i<4;i++){ if(i>=uNW)break; vec3 d=uW[i].xyz-X.xyz; float soft=uWP[i].x; float r2=dot(d,d)+soft*soft; float r=sqrt(r2);
    Fg+=uGWell*uW[i].w*d/(r2*r); vec3 ax=vec3(0,1,0); Fg+=uGWell*abs(uW[i].w)*uWP[i].y*cross(ax,d/r)/(r2); }
  vec3 Fn=vn(X.xyz*1.3+vec3(0,0,uTime))*uTurb;
  vec3 A=Ff*(1.-uBlend)+Fg*uBlend+Fn;
  Vv.xyz+=A*uDt; float vl=length(Vv.xyz); if(vl>uVmax) Vv.xyz*=uVmax/vl;
  X.xyz+=Vv.xyz*uDt; X.w+=uDt*uLifeR*(.6+.8*U.w);
  Vv.w=length(Vv.xyz);
  bool bad=any(isnan(X))||any(isinf(X))||any(isnan(Vv))||any(isinf(Vv));
  bool esc=any(greaterThan(abs(X.xyz),uBound)); bool uvout=abs(U.x)>.75||abs(U.y)>.75;
  bool sink=false; for(int i=0;i<4;i++){ if(i>=uNW)break; if(uW[i].w>0.&&length(uW[i].xyz-X.xyz)<uWP[i].x*.25) sink=true; }
  if(bad||esc||X.w>=1.||sink||uvout){ U=seedUv(id,uFrame+1u); if(uvout&&!bad){ /* wrap streams back to the start edge */ } X=vec4(P(U.xy,U.z),0); Vv=vec4(0); }
  oPos=X; oVel=Vv; oUv=U;
}`;
export const PDRAW_VS = `#version 300 es
precision highp float; precision highp int;
uniform sampler2D uPos,uVel,uPal; uniform int uTexW; uniform mat4 uVP,uView; uniform vec2 uRes; uniform float uW,uStreak,uGain,uSpeedMix,uPalOff,uFog,uFogStart,uFocus,uDof,uPx; uniform vec3 uEye;
out vec3 vC; out float vS;
uint hsh(uint x){x^=x>>16;x*=0x7feb352dU;x^=x>>15;x*=0x846ca68bU;x^=x>>16;return x;}
void main(){
  int id=gl_VertexID/6, cn=gl_VertexID%6; ivec2 t=ivec2(id%uTexW,id/uTexW);
  vec4 X=texelFetch(uPos,t,0), Vv=texelFetch(uVel,t,0);
  int e=(cn==1||cn==3||cn==4)?1:0; float sd=(cn==2||cn==4||cn==5)?1.:-1.;
  vec3 head=X.xyz, tail=X.xyz-Vv.xyz*uStreak;
  vec4 a=uVP*vec4(tail,1), b=uVP*vec4(head,1);
  if(a.w<=.01||b.w<=.01){ gl_Position=vec4(2,2,2,1); vC=vec3(0); vS=0.; return; }
  vec2 sa=a.xy/a.w*uRes*.5, sb=b.xy/b.w*uRes*.5; vec2 d=sb-sa; float L=length(d);
  float vz=-(uView*vec4(head,1)).z; float coc=abs(vz-uFocus)*uDof*uPx;
  float w=uW*uPx+coc; vec2 dir=L>1e-3?d/L:vec2(1,0); vec2 nrm=vec2(-dir.y,dir.x);
  if(L<w){ sa-=dir*(w-L)*.5; sb+=dir*(w-L)*.5; }
  vec4 P=e==1?b:a; vec2 sp=(e==1?sb:sa)+nrm*sd*w*.5;
  gl_Position=vec4(sp/(uRes*.5)*P.w,P.z,P.w);
  float tc=fract(mix(float(hsh(uint(id))&1023u)/1023.,clamp(Vv.w*.3,0.,1.),uSpeedMix)+uPalOff);
  float life=smoothstep(0.,.1,X.w)*smoothstep(1.,.8,X.w);
  float fog=exp(-max(length(uEye-head)-uFogStart,0.)*uFog);
  float area=(uW*uPx)*(uW*uPx)/(w*max(L,w)); // energy conserving under DOF / long streaks
  vC=texture(uPal,vec2(tc,.5)).rgb*uGain*life*fog*area*(.6+.4*clamp(Vv.w*.2,0.,2.)); vS=sd;
}`;
export const PDRAW_FS = `#version 300 es
precision highp float; in vec3 vC; in float vS; out vec4 o; void main(){ float a=1.-vS*vS; o=vec4(vC*a,a); }`;

// ---------- Liquid Spheres: PBD-lite spheres on a uniform grid ----------
const SPH_COMMON = `
uniform sampler2D uPos,uVel,uAux,uXp; uniform int uTexW,uN; uniform float uR,uDt,uTNow;
uniform vec3 uGMin; uniform float uCell; uniform ivec3 uGDim; uniform int uTilesX;
ivec2 tcOf(int id){ return ivec2(id%uTexW,id/uTexW); }
ivec2 cellTex(ivec3 c){ return ivec2(c.x+(c.z%uTilesX)*uGDim.x, c.y+(c.z/uTilesX)*uGDim.y); }
`;
export const SPRED_FS = `#version 300 es
precision highp float; precision highp int;
${NOISE}
${FABRIC}
${SPH_COMMON}
uniform vec3 uG; out vec4 o;
vec3 clingN(vec2 uv,float L,out vec3 Pu,out vec3 Pv){ float e=.004; Pu=(P(uv+vec2(e,0),L)-P(uv-vec2(e,0),L))/(2.*e); Pv=(P(uv+vec2(0,e),L)-P(uv-vec2(0,e),L))/(2.*e);
  vec3 N=normalize(cross(Pu,Pv)); if(any(isnan(N))) N=vec3(0,0,1); return N; }
float LY(float z){ return mod(z,4.); } float SD(float z){ return z>=3.5?-1.:1.; }
vec3 clingP(vec4 A,float ri){ vec3 Pu,Pv; vec3 N=clingN(A.xy,LY(A.z),Pu,Pv); return P(A.xy,LY(A.z))+N*SD(A.z)*ri*1.6; }
void main(){ ivec2 c=ivec2(gl_FragCoord.xy); vec4 X=texelFetch(uPos,c,0), Vv=texelFetch(uVel,c,0), A=texelFetch(uAux,c,0);
  if(X.w<.5){ o=vec4(clingP(A,uR*A.w),0); return; }
  vec3 v=Vv.xyz+uG*uDt; o=vec4(X.xyz+v*uDt,1); }`;
export const SGRID_VS = `#version 300 es
precision highp float; precision highp int;
${SPH_COMMON}
uniform vec2 uGridRes; flat out float vId;
void main(){ int id=gl_VertexID; vec4 X=texelFetch(uXp,tcOf(id),0); gl_PointSize=1.;
  ivec3 c=ivec3(floor((X.xyz-uGMin)/uCell));
  if(X.w<.5||any(lessThan(c,ivec3(0)))||any(greaterThanEqual(c,uGDim))){ gl_Position=vec4(2,2,2,1); vId=0.; return; }
  vec2 t=(vec2(cellTex(c))+.5)/uGridRes*2.-1.; gl_Position=vec4(t,float(id)/float(uN)*2.-1.,1); vId=float(id+1); }`;
export const SGRID_FS = `#version 300 es
precision highp float; uniform sampler2D uPrev; uniform int uLayer; flat in float vId; out vec4 o;
void main(){ if(uLayer>0){ float p=texelFetch(uPrev,ivec2(gl_FragCoord.xy),0).r; if(vId<=p+.5) discard; } o=vec4(vId,0,0,1); }`;
export const SSOLVE_FS = `#version 300 es
precision highp float; precision highp int;
${NOISE}
${FABRIC}
${SPH_COMMON}
uniform sampler2D uG0,uG1,uG2,uG3; uniform int uInit; uniform uint uSeed; uniform float uRand,uSpan,uCoh,uCohR,uVisc,uBounce,uFric,uDamp,uTurn,uFloorY,uSlide; uniform vec2 uBox; uniform vec3 uGv; uniform mat4 uCamVP; uniform vec3 uCamEye; uniform float uDripPer,uDripLen,uDripAmt,uFlowOn,uDetach; uniform vec2 uFlowV;
layout(location=0) out vec4 oPos; layout(location=1) out vec4 oVel; layout(location=2) out vec4 oAux;
vec3 clingN(vec2 uv,float L,out vec3 Pu,out vec3 Pv){ float e=.004; Pu=(P(uv+vec2(e,0),L)-P(uv-vec2(e,0),L))/(2.*e); Pv=(P(uv+vec2(0,e),L)-P(uv-vec2(0,e),L))/(2.*e);
  vec3 N=normalize(cross(Pu,Pv)); if(any(isnan(N))) N=vec3(0,0,1); return N; }
float LY(float z){ return mod(z,4.); } float SD(float z){ return z>=3.5?-1.:1.; }
vec3 clingP(vec4 A,float ri){ vec3 Pu,Pv; vec3 N=clingN(A.xy,LY(A.z),Pu,Pv); return P(A.xy,LY(A.z))+N*SD(A.z)*ri*1.6; }
float gid(int k,ivec2 t){ if(k==0) return texelFetch(uG0,t,0).r; if(k==1) return texelFetch(uG1,t,0).r; if(k==2) return texelFetch(uG2,t,0).r; return texelFetch(uG3,t,0).r; }
void main(){
  ivec2 c=ivec2(gl_FragCoord.xy); int id=c.y*uTexW+c.x; uint uid=uint(id);
  if(uInit==1){
    float G=ceil(sqrt(float(uN))); vec4 A=vec4(0,0,0,max(.3,1.+uRand*(h01(uid*17u+uSeed)*2.-1.)));
    vec3 p=vec3(0);
    for(int k=0;k<32;k++){ uint q=uid*12u+uint(k)+uSeed*977u;
      vec2 cell=vec2(mod(float(id),G),floor(float(id)/G)); vec2 j=vec2(h01(q*7u+3u),h01(q*13u+5u));
      vec2 uv=k==0?((cell+j)/G*2.-1.)*.64:(vec2(h01(q*29u),h01(q*31u))*2.-1.)*.64;
      float Lr=floor(h01(q*47u+2u)*float(uLayers)); vec3 Pu,Pv; vec3 N=clingN(uv,Lr,Pu,Pv); vec3 pp=P(uv,Lr); vec4 cl=uCamVP*vec4(pp,1);
      vec2 nd=cl.xy/max(cl.w,1e-4); bool vis=cl.w>0.&&all(lessThan(abs(nd),vec2(1.08)))&&dot(N,normalize(uCamEye-pp))>.05;
      float jac=length(cross(Pu,Pv)); float acc=clamp(jac/(uExt.x*uExt.y*2.5),0.,1.); A.xy=uv; A.z=Lr+(dot(N,uCamEye-pp)<0.?4.:0.); p=pp+N*(dot(N,uCamEye-pp)<0.?-1.:1.)*A.w*uR*1.6; if(vis&&h01(q*43u+9u)<acc) break; }
    oPos=vec4(p,0); oVel=vec4(-100.,0,1,0); oAux=A; return;
  }
  vec4 X=texelFetch(uPos,c,0), Vv=texelFetch(uVel,c,0), A=texelFetch(uAux,c,0), Xp=texelFetch(uXp,c,0);
  oAux=A;
  if(X.w<.5){ // dormant: rides the fabric until its release time, then drips
    if(uFlowOn>0.){ A.xy+=uFlowV*uDt*(.7+.6*h01(uid*71u)); A.xy=mod(A.xy+.64,1.28)-.64; }
    float ri0=uR*A.w; vec3 Pu,Pv; vec3 N=clingN(A.xy,LY(A.z),Pu,Pv)*SD(A.z); oAux=A;
    vec3 sp=clingP(A,ri0); vec3 dn=normalize(uGv+vec3(0,-1e-4,0));
    float fade=0., scl=1.; vec3 No=N; float hwPrev=clamp(X.w/.45,0.,1.), hwOut=0.;
    if(h01(uid*23u+uSeed)<uDripAmt){
      vec2 an=(floor(A.xy*24.)+.5)/24.; vec3 aPu,aPv; vec3 aN=clingN(an,LY(A.z),aPu,aPv)*SD(A.z);
      float hang=smoothstep(.1,-.7,aN.y);
      if(hang>0.||hwPrev>0.){
        uint ah=uint(floor(A.xy.x*24.)+40.)*131u+uint(floor(A.xy.y*24.)+40.);
        float rank=floor(h01(uid*37u)*8.); float nb=3.+floor(h01(ah*7u)*6.);
        if(rank<nb){
          float ph=uDetach>0.?fract(uTNow/(uDripPer*(.7+.6*h01(ah*11u)))+h01(ah*13u)):.55+.1*sin(uTNow*.7+h01(ah*13u)*6.28); float grow=uDetach>0.?smoothstep(0.,.8,ph):1.;
          float f=rank/(nb-1.); float L=uDripLen*(hwPrev+clamp(hang-hwPrev,-.6*uDt,.6*uDt))*grow;
          vec3 base=P(an,LY(A.z))+aN*ri0*1.6;
          vec3 q=base+dn*(L*pow(f,1.3));
          float drop=uDetach>0.?smoothstep(.8,1.,ph):0.; if(f>.6) q+=dn*drop*uDripLen*1.2;
          float hw=hwPrev+clamp(hang-hwPrev,-.6*uDt,.6*uDt); hwOut=hw; sp=mix(sp,q,hw); scl=mix(1.,mix(1.,.5,f)*(f>.95?1.25:1.)*(1.+.15*grow*(1.-f)),hw);
          fade=uDetach>0.&&f>.6?max(drop,1.-smoothstep(0.,.2,ph)):0.; No=-dn;
        }
      }
    }
    if(uFlowOn>0.){ vec2 e=abs(A.xy); float ef=smoothstep(.64,.5,max(e.x,e.y)); fade=max(fade,1.-ef); }
    vec3 n01=clamp(No*.5+.5,0.,1.); float pk=floor(n01.x*1023.)*1024.+floor(n01.y*1023.)+(No.z<0.?1048576.:0.);
    oPos=vec4(sp,hwOut*.45); oVel=vec4(Vv.x,fade,scl,pk);
    return;
  }
  float ri=uR*A.w; vec3 xi=Xp.xyz, vi=Vv.xyz; vec3 dl=vec3(0); float cnt=0.; vec3 vs=vec3(0); float vw=0.;
  ivec3 cc=ivec3(floor((xi-uGMin)/uCell));
  for(int dz=-1;dz<=1;dz++) for(int dy=-1;dy<=1;dy++) for(int dx=-1;dx<=1;dx++){
    ivec3 q=cc+ivec3(dx,dy,dz); if(any(lessThan(q,ivec3(0)))||any(greaterThanEqual(q,uGDim))) continue; ivec2 t=cellTex(q);
    for(int k=0;k<4;k++){ float g=gid(k,t); if(g<.5) break; int j=int(g+.5)-1; if(j==id) continue;
      ivec2 tj=tcOf(j); vec3 xj=texelFetch(uXp,tj,0).xyz; float rj=uR*texelFetch(uAux,tj,0).w;
      vec3 d=xi-xj; float dist=length(d); float R=ri+rj; if(dist<1e-6) { d=vec3(h01(uid)-.5,.5,h01(uid+9u)-.5)*1e-3; dist=length(d); }
      vec3 n=d/dist;
      if(dist<R){ dl+=n*(R-dist)*.5; cnt+=1.; }
      float Rc=R*(1.+uCohR);
      if(dist<Rc){ float w=1.-dist/Rc; vs+=(texelFetch(uVel,tj,0).xyz-vi)*w; vw+=w; if(dist>R*.97) dl-=n*(dist-R)*uCoh*.25*w; }
    }
  }
  vec3 dc=dl*(cnt>1.?1.4/sqrt(cnt):1.); float dcl=length(dc); if(dcl>ri*.25) dc*=ri*.25/dcl; vec3 xn=xi+dc;
  bool hitF=false;
  if(xn.y<uFloorY+ri){ xn.y=uFloorY+ri; hitF=true; xn.xz=mix(xn.xz,X.xz,uFric); }
  if(abs(xn.x)>uBox.x-ri){ xn.x=sign(xn.x)*(uBox.x-ri); }
  if(abs(xn.z)>uBox.y-ri){ xn.z=sign(xn.z)*(uBox.y-ri); }
  vec3 v=(xn-X.xyz)/uDt;
  if(vw>0.) v+=uVisc*vs/vw;
  if(hitF&&Vv.y<-.5) v.y=max(v.y,-Vv.y*uBounce);
  v*=1.-min(.5,uDamp*uDt);
  float vl=length(v); if(vl>3.) v*=3./vl;
  float age=Vv.w+uDt;
  bool bad=any(isnan(xn))||any(isinf(xn))||any(isnan(v))||any(isinf(v));
  if(bad||xn.y<uFloorY-1.||(uTurn>0.&&age>uTurn*(.7+.6*h01(uid*3u+uint(uTNow*7.))))){
    uint q=uid*31u+uint(uTNow*97.); vec4 An=vec4((h01(q*7u)*2.-1.)*.6,(h01(q*13u+1u)*2.-1.)*.6,A.z,A.w); oAux=An;
    oPos=vec4(clingP(An,uR*A.w),0); oVel=vec4(uTNow,0,0,0); return; }
  oPos=vec4(xn,1); oVel=vec4(v,age);
}`;
export const SPHERE_VS = `#version 300 es
precision highp float; precision highp int;
uniform sampler2D uSPos,uSVel,uSAux; uniform int uSTexW; uniform float uSR,uInflate; uniform mat4 uSVP,uSV,uSProj; uniform vec2 uSRes; uniform int uSMode; uniform float uSPalOff,uSSpeedMix;
uniform sampler2D uPal2; uniform float uSTime; uniform int uPrim; uniform float uRotRand,uSizeRand;
${COLOR}
flat out vec3 vAx; flat out vec3 vT1; flat out int vPr;
out vec3 vC; out float vRad; out vec3 vCol; out float vSpd;
uint hsh(uint x){x^=x>>16;x*=0x7feb352dU;x^=x>>15;x*=0x846ca68bU;x^=x>>16;return x;}
void main(){
  int id=gl_VertexID; ivec2 t=ivec2(id%uSTexW,id/uSTexW); vec4 X=texelFetch(uSPos,t,0); vec4 A=texelFetch(uSAux,t,0); vec4 Vv=texelFetch(uSVel,t,0);
  float fin=X.w<.5?smoothstep(0.,.3,uSTime-Vv.x)*(1.-Vv.y):1.; float r=uSR*A.w*uInflate*fin*(X.w<.5&&Vv.z>0.?Vv.z:1.)*(1.+uSizeRand*(float((hsh(uint(id)*3u+7u)>>4u)&255u)/255.-.5)); if(fin<=0.001){ gl_Position=vec4(2,2,2,1); gl_PointSize=1.; vC=vec3(0); vRad=0.; vCol=vec3(0); vSpd=0.; return; } vec4 cv=uSV*vec4(X.xyz,1); vC=cv.xyz; vRad=r;
  gl_Position=uSVP*vec4(X.xyz,1);
  if(uSMode==1){ gl_PointSize=clamp(2.*r*uSProj[0][0]*.5*uSRes.x,1.,511.); }
  else { float f=uSProj[1][1]*uSRes.y*.5; gl_PointSize=clamp(2.*r*f/max(-cv.z,.05)*1.08,1.,511.); if(-cv.z<.06) gl_Position=vec4(2,2,2,1); }
  float sp=X.w>.5?length(Vv.xyz):0.; vSpd=sp;
  float tc=fract(mix(float(hsh(uint(id))&1023u)/1023.,clamp(sp*.25,0.,1.),uSSpeedMix)+uSPalOff);
  uint hh=hsh(uint(id)*3u+7u); float hr=float(hh&1023u)/1023.;
  vec3 ob; float tb=.35+.65*tc;
  if(uBeadMode==4) ob=patchCol(2,A.xy); else if(uBeadMode==1) ob=lcol(int(min(mod(A.z,4.),1.)),A.y*.5+.5+tc*.25); else if(uBeadMode==2) ob=uBeadSolid; else if(uBeadMode==3) ob=lcol(2,X.y*.4+.5); else ob=lcol(2,tb);
  vec3 fb=lcol(int(min(mod(A.z,4.),1.)),A.y*.5+.5); vCol=mix(ob,blendM(uMixO,fb,ob),uMixAO);
  float pk=X.w<.5?Vv.w:0.; float zs=pk>=1048576.?-1.:1.; pk-=zs<0.?1048576.:0.; vec3 n=vec3(floor(pk/1024.)/1023.,mod(pk,1024.)/1023.,0.)*2.-1.; n.z=zs*sqrt(max(0.,1.-dot(n.xy,n.xy)));
  if(X.w>.5||dot(n,n)<.5) n=vec3(0,1,0);
  vec3 a=normalize(mat3(uSV)*n); vec3 t0=normalize(cross(a,abs(a.y)<.9?vec3(0,1,0):vec3(1,0,0))); vec3 t1=cross(a,t0);
  float ang=hr*6.2831*uRotRand; vAx=a; vT1=t0*cos(ang)+t1*sin(ang);
  vPr=uPrim==5?int(hh>>12u)%5:uPrim;
  vRad*=1.+uSizeRand*(float((hh>>4u)&255u)/255.-.5); if(uBeadMode==4) vRad*=1.+(patchF(A.xy).w-.5)*uPJit*.4;
}`;
export const SPHERE_FS = `#version 300 es
precision highp float; precision highp int; precision highp sampler2DShadow;
${LIGHTING}
uniform mat4 uSProj,uSInvV; uniform int uSMode; uniform float uSSat,uSBright;
in vec3 vC; in float vRad; in vec3 vCol; in float vSpd; flat in vec3 vAx; flat in vec3 vT1; flat in int vPr;
uniform float uSSSS; uniform int uObjMat;
float sdRC(vec3 p,float r1,float r2,float h){ vec2 q=vec2(length(p.xy),p.z); float b=(r1-r2)/h; float a=sqrt(max(1.-b*b,0.)); float k=dot(q,vec2(-b,a)); if(k<0.) return length(q)-r1; if(k>a*h) return length(q-vec2(0,h))-r2; return dot(q,vec2(a,b))-r1; }
float sdP(vec3 p,int k){ if(k==1){ vec3 q=abs(p)-vec3(.5); return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.)-.18; }
  if(k==2){ vec3 q=p; q.z-=clamp(q.z,-.5,.5); return length(q)-.42; }
  if(k==3){ vec2 q=vec2(length(p.xy)-.6,p.z); return length(q)-.27; }
  if(k==4) return sdRC(p+vec3(0,0,.42),.5,.1,1.15);
  return length(p)-1.; }
layout(location=0) out vec4 o; layout(location=1) out vec4 oPos; layout(location=2) out vec4 oNrm;
void main(){
  vec2 c=gl_PointCoord*2.-1.; c.y=-c.y; float r2=dot(c,c); if(r2>1.) discard; float nz=sqrt(1.-r2);
  vec3 Nv=vec3(c,nz); vec3 pv=vC+Nv*vRad;
  if(vPr>0 && (uSMode==0||uSMode==3)){
    vec3 rd=normalize(vC+vec3(c*vRad*1.08,0.)); vec3 B2=cross(vAx,vT1); mat3 Mi=transpose(mat3(vT1,B2,vAx));
    float t=max(length(vC)-1.3*vRad,0.); bool hit=false; vec3 lp;
    for(int i=0;i<40;i++){ lp=Mi*(rd*t-vC)/vRad; float d=sdP(lp,vPr)*vRad; if(d<vRad*.004){ hit=true; break; } t+=d; if(t>length(vC)+1.4*vRad) break; }
    if(!hit) discard;
    vec2 e=vec2(.002,-.002); vec3 gn=normalize(e.xyy*sdP(lp+e.xyy,vPr)+e.yyx*sdP(lp+e.yyx,vPr)+e.yxy*sdP(lp+e.yxy,vPr)+e.xxx*sdP(lp+e.xxx,vPr));
    Nv=normalize(transpose(Mi)*gn); pv=rd*t; nz=max(Nv.z,0.);
  }
  if(uSMode==1){ vec4 cl=uSProj*vec4(pv,1); gl_FragDepth=cl.z/cl.w*.5+.5; o=vec4(0); oPos=vec4(0); oNrm=vec4(0); return; }
  vec4 cl=uSProj*vec4(pv,1); gl_FragDepth=cl.z/cl.w*.5+.5;
  if(uSMode==2){ o=vec4(-pv.z,0,0,1); oPos=vec4(0); oNrm=vec4(0); return; }                 // liquid: depth splat
  if(uSMode==3){ o=vec4(vCol*nz,nz); oPos=vec4(0); oNrm=vec4(0); return; }                 // liquid: thickness/color
  vec3 wp=(uSInvV*vec4(pv,1)).xyz; vec3 N=normalize(mat3(uSInvV)*Nv); vec3 V=normalize(uEye-wp);
  float NdV=clamp(dot(N,V),1e-3,1.);
  vec3 alb=vCol; float l=dot(alb,vec3(.299,.587,.114)); alb=max(mix(vec3(l),alb,uSSat),0.)*uSBright;
  vec3 irid=.5+.5*cos(6.2831*(vec3(0.,.33,.67)+NdV*1.8));
  float rough=clamp(sqrt(2./(uGloss+2.))*1.2,.04,1.); vec3 F0=mix(vec3(.04),irid*.9,uIrid*.6);
  if(uObjMat==1){ rough=.05; F0=alb*.85+.1; alb=vec3(0); } else if(uObjMat==3){ rough=.9; F0=vec3(.03); }
  vec3 col=shade(wp,N,V,alb,rough,F0,mix(alb,irid,uIrid),uRim);
  if(uObjMat==2){ float fr2=.04+.96*pow(1.-NdV,5.); col=env(refract(-V,N,1./1.5),.02)*pow(max(vCol,vec3(.05)),vec3(.6))*(1.-fr2)+env(reflect(-V,N),.02)*fr2*1.4+shade(wp,N,V,vec3(0),.03,vec3(.04),vec3(0),0.); }
  if(uObjMat==1) col+=env(reflect(-V,N),.05)*F0*1.2;
  float fr=.04+.96*pow(1.-NdV,5.); col+=env(reflect(-V,N),.04)*mix(vec3(1),alb,.35)*(.25+fr)*uSSSS;
  col+=alb*(.25+.55*pow(1.-NdV,2.))*uSSSS*.6;
  float d=length(uEye-wp); float f=1.-exp(-max(d-uFogStart,0.)*uFog); col*=1.-f;
  o=vec4(max(col,0.),1); oPos=vec4(pv,1); oNrm=vec4(Nv,1);
}`;
export const FLOOR_VS = `#version 300 es
precision highp float; uniform mat4 uFVP,uFV; uniform float uFY,uFS; out vec3 vW; out vec3 vV;
void main(){ vec2 q[6]=vec2[6](vec2(-1,-1),vec2(1,-1),vec2(1,1),vec2(-1,-1),vec2(1,1),vec2(-1,1)); vec3 p=vec3(q[gl_VertexID].x*uFS,uFY,q[gl_VertexID].y*uFS);
  vW=p; vV=(uFV*vec4(p,1)).xyz; gl_Position=uFVP*vec4(p,1); }`;
export const FLOOR_FS = `#version 300 es
precision highp float; precision highp int; precision highp sampler2DShadow;
${LIGHTING}
uniform vec3 uFCol; uniform float uFRough; in vec3 vW; in vec3 vV;
layout(location=0) out vec4 o; layout(location=1) out vec4 oPos; layout(location=2) out vec4 oNrm;
void main(){ vec3 N=vec3(0,1,0); vec3 V=normalize(uEye-vW);
  vec3 col=shade(vW,N,V,uFCol,uFRough,vec3(.04),vec3(0),0.);
  float d=length(uEye-vW); float f=1.-exp(-max(d-uFogStart,0.)*uFog*1.4); col*=1.-f;
  o=vec4(max(col,0.),1); oPos=vec4(vV,1); oNrm=vec4(normalize(mat3(uView)*N),1); }`;
export const FBLUR_FS = `#version 300 es
precision highp float; uniform sampler2D uT; uniform vec2 uDir; uniform float uRange; in vec2 vUv; out vec4 o;
void main(){ float z0=texture(uT,vUv).r; if(z0<=0.){ o=vec4(0); return; } float s=0., w=0.;
  for(int i=-8;i<=8;i++){ float z=texture(uT,vUv+uDir*float(i)).r; if(z<=0.) continue; float ws=exp(-float(i*i)/32.); float wr=exp(-pow((z-z0)/uRange,2.)); s+=z*ws*wr; w+=ws*wr; }
  o=vec4(s/max(w,1e-5),0,0,1); }`;
export const FLUID_FS = `#version 300 es
precision highp float; precision highp int; precision highp sampler2DShadow;
${LIGHTING}
uniform sampler2D uFZ,uFT; uniform mat4 uFProj,uFInvV; uniform vec2 uFRes; uniform float uAbsorb,uFSat;
in vec2 vUv; layout(location=0) out vec4 o; layout(location=1) out vec4 oPos; layout(location=2) out vec4 oNrm;
vec3 vpos(vec2 uv,float z){ vec2 nd=uv*2.-1.; return vec3((nd.x*z-uFProj[2][0]*(-z))/uFProj[0][0]*1., (nd.y*z-uFProj[2][1]*(-z))/uFProj[1][1], -z); }
void main(){
  float z=texture(uFZ,vUv).r; if(z<=0.) discard;
  vec2 px=1./uFRes; vec3 p=vpos(vUv,z);
  float zr=texture(uFZ,vUv+vec2(px.x,0)).r, zl=texture(uFZ,vUv-vec2(px.x,0)).r, zu=texture(uFZ,vUv+vec2(0,px.y)).r, zd=texture(uFZ,vUv-vec2(0,px.y)).r;
  vec3 ddx=zr>0.?vpos(vUv+vec2(px.x,0),zr)-p:p-vpos(vUv-vec2(px.x,0),zl); vec3 ddx2=zl>0.?p-vpos(vUv-vec2(px.x,0),zl):ddx; if(abs(ddx2.z)<abs(ddx.z)) ddx=ddx2;
  vec3 ddy=zu>0.?vpos(vUv+vec2(0,px.y),zu)-p:p-vpos(vUv-vec2(0,px.y),zd); vec3 ddy2=zd>0.?p-vpos(vUv-vec2(0,px.y),zd):ddy; if(abs(ddy2.z)<abs(ddy.z)) ddy=ddy2;
  vec3 Nv=normalize(cross(ddx,ddy)); if(Nv.z<0.) Nv=-Nv; if(any(isnan(Nv))) Nv=vec3(0,0,1);
  vec4 th=texture(uFT,vUv); float thick=th.a; vec3 base=th.rgb/max(th.a,1e-4); float l=dot(base,vec3(.299,.587,.114)); base=max(mix(vec3(l),base,uFSat),0.);
  vec3 wp=(uFInvV*vec4(p,1)).xyz; vec3 N=normalize(mat3(uFInvV)*Nv); vec3 V=normalize(uEye-wp);
  vec3 trans=base*(.25+.75*exp(-thick*uAbsorb));
  vec3 col=shade(wp,N,V,trans,.07,vec3(.03),base,uRim*1.5)+base*.06*exp(-thick*uAbsorb*.5);
  float d=length(uEye-wp); float f=1.-exp(-max(d-uFogStart,0.)*uFog); col*=1.-f;
  vec4 cl=uFProj*vec4(p,1); gl_FragDepth=cl.z/cl.w*.5+.5;
  o=vec4(max(col,0.),1); oPos=vec4(p,1); oNrm=vec4(Nv,1);
}`;
