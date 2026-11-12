// "Sculpt" relief finish for the 2D modes (Kaleido, Tunnel, Plasma, Morph).
// Treats the mode's own image as a height field, then shades it like a Cinema 4D
// ambient-occlusion render: screen-space AO, a soft key + white dome, a studio
// floor, and pigment color mapped from the source hue through an OKLab palette.
// Original MIT-licensed work for flow-engine. No Shadertoy code.
// OKLab math: Björn Ottosson (2020, public domain / MIT).

import { LAND_OKLAB } from './landscape_shaders';

// Pass A (quarter res): coverage-preserving downsample. rgb = mean color, a = line coverage 0..1
export const RELIEF_DOWN_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uSrc;
uniform vec2 uTexel; // source texel
void main(){
  vec3 cs=vec3(0.0); float mx=0.0, mean=0.0;
  for(int y=0;y<4;y++) for(int x=0;x<4;x++){
    vec2 off=(vec2(float(x),float(y))-1.5)*uTexel;
    vec3 c=max(texture(uSrc,vUv+off).rgb,0.0);
    float l=dot(c,vec3(0.2126,0.7152,0.0722));
    l=l/(0.6+l);
    cs+=c*l; mean+=l; mx=max(mx,l);
  }
  o=vec4(cs/max(mean,1e-4),mx*0.65+mean/16.0*0.35);
}
`;

// Pass B (quarter res): spherical "brush" dilation turns every stroke into a rounded tube.
// rgb = color of the tallest contributor, a = height 0..1
export const RELIEF_HEIGHT_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uSrc;
uniform vec2 uTexel;  // quarter-res texel
uniform float uRadius; // in quarter-res texels
void main(){
  vec4 c0=texture(uSrc,vUv);
  float best=c0.a; vec3 col=c0.rgb; float soft=0.0, ws=0.0;
  for(int i=0;i<40;i++){
    float r=sqrt((float(i)+0.5)/40.0);
    float a=float(i)*2.39996323;
    vec4 s=texture(uSrc,vUv+vec2(cos(a),sin(a))*r*uRadius*uTexel);
    float hh=s.a*sqrt(max(0.0,1.0-r*r));
    if(hh>best){ best=hh; col=s.rgb; }
    soft+=s.a; ws+=1.0;
  }
  float h=max(best,soft/ws*1.2);
  o=vec4(col,clamp(h,0.0,1.0));
}
`;

// Pass B (full res): AO-lit relief
export const RELIEF_SHADE_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uSrc;
uniform sampler2D uH;
uniform vec2 uHTexel;
uniform float uDepth, uAO, uMix, uAspect, uTime;
uniform vec3 uFloorTop, uFloorBottom, uKeyCol, uDomeCol;
${LAND_OKLAB}
float H(vec2 uv){ return texture(uH,uv).a; }
void main(){
  vec4 hc=texture(uH,vUv);
  float h=hc.a;
  vec2 ex=vec2(uHTexel.x,0.0), ey=vec2(0.0,uHTexel.y);
  float hx=(H(vUv+ex)-H(vUv-ex))*0.5;
  float hy=(H(vUv+ey)-H(vUv-ey))*0.5;
  vec3 N=normalize(vec3(-hx*uDepth,-hy*uDepth,1.0));
  // Screen-space AO on the height field (spiral, growing radius)
  float occ=0.0;
  for(int i=0;i<16;i++){
    float t=(float(i)+0.5)/16.0;
    float r=mix(1.5,22.0,t*t);
    float a=float(i)*2.39996323+h*6.0;
    vec2 off=vec2(cos(a),sin(a)*uAspect)*r*uHTexel;
    float d=H(vUv+off)-h;
    occ+=clamp(d*2.5,0.0,1.0)*(1.0-0.6*t);
  }
  float ao=clamp(1.0-occ/16.0*uAO*1.6,0.0,1.0);
  ao=ao*ao;
  // Pigment: map the source hue into the palette, so the mode's pattern survives in nicer colors
  vec3 lab=lin2oklab(max(hc.rgb,0.0)+1e-4);
  float hue=atan(lab.z,lab.y)/6.2831853+0.5;
  float tP=fract(hue+h*0.35);
  tP=abs(tP*2.0-1.0); // fold so wrap-around never jumps
  vec3 pig=palette(tP);
  float body=smoothstep(0.02,0.14,h);
  vec3 floorC=mix(uFloorBottom,uFloorTop,vUv.y);
  vec3 albedo=mix(floorC,pig,body);
  vec3 L=normalize(vec3(-0.45,0.55,0.70));
  float wrap=clamp((dot(N,L)+0.3)/1.3,0.0,1.0);
  vec3 V=vec3(0.0,0.0,1.0);
  vec3 Hh=normalize(L+V);
  float spec=pow(max(dot(N,Hh),0.0),40.0)*0.25*body;
  vec3 col=albedo*(uDomeCol*ao*(0.55+0.45*N.z)+uKeyCol*wrap*mix(0.5,1.0,ao))+uKeyCol*spec*ao;
  vec3 src=texture(uSrc,vUv).rgb;
  o=vec4(mix(src,col,uMix),1.0);
}
`;
