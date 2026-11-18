// Scene shading is shared. These stages only choose how an already rendered frame is shown.
export function pixelLayout(width,height,options={}){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1)throw Error('Invalid source resolution');
 const target=options.height??300,min=options.minScale??2;
 if(!Number.isFinite(target)||target<=0||!Number.isInteger(min)||min<1||min>8)throw Error('Invalid pixel grid settings');
 const scale=Math.min(width,height,8,Math.max(min,Math.round(height/target)));
 const w=Math.floor(width/scale),h=Math.floor(height/scale),x=Math.floor((width-w*scale)/2),y=Math.floor((height-h*scale)/2);
 return {scale,resolution:[w,h],viewport:[x,y,w*scale,h*scale],sourceOrigin:[x,y]};
}
export const DISPLAY_VERTEX=`#version 300 es
precision highp float;layout(location=0) in vec2 corner;out vec2 uv;
void main(){uv=(corner+1.)*.5;gl_Position=vec4(corner,0.,1.);}`;
// No bloom, palette, dither or edge adjustment in the raw path.
export const COPY_FRAGMENT=`#version 300 es
precision highp float;in vec2 uv;uniform sampler2D frame;out vec4 result;
void main(){result=vec4(texture(frame,uv).rgb,1.);}`;
export const PIXEL_FRAGMENT=`#version 300 es
precision highp float;precision highp int;
uniform sampler2D frame,features;uniform vec3 palette[64];
uniform int paletteCount,paletteEnabled,pixelScale;uniform ivec2 sourceOrigin;
uniform float ditherStrength,detailBias,bloomStrength;out vec4 result;
const vec3 luma=vec3(.3,.59,.11);
const float bayer[16]=float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
void main(){
 ivec2 cell=ivec2(gl_FragCoord.xy),origin=cell*pixelScale+sourceOrigin;
 vec3 c=vec3(0.),dark=vec3(1.),bright=vec3(0.);float lo=2.,hi=-1.,foliage=0.;
 // Integrate the native samples in this cell, rather than skipping thin leading/leaves.
 for(int y=0;y<8;y++){if(y>=pixelScale)break;for(int x=0;x<8;x++){if(x>=pixelScale)break;
  vec3 v=texelFetch(frame,origin+ivec2(x,y),0).rgb;float L=dot(v,luma);c+=v;foliage+=texelFetch(features,origin+ivec2(x,y),0).r;
  if(L<lo){lo=L;dark=v;}if(L>hi){hi=L;bright=v;}
 }}
 c/=float(pixelScale*pixelScale);
 float edge=smoothstep(.025,.14,hi-lo)*detailBias;
 // Keep a thin bright leaf against the dark backdrop, and a dark mullion in bright glass.
 c=mix(c,(lo<.075||foliage/float(pixelScale*pixelScale)>.12)?bright:dark,edge);
 vec3 bloom=vec3(0.);ivec2 center=origin+ivec2(pixelScale/2),size=textureSize(frame,0);
 for(int i=0;i<4;i++){ivec2 d=ivec2(i==0?1:i==1?-1:0,i==2?1:i==3?-1:0)*pixelScale;
  vec3 v=texelFetch(frame,clamp(center+d,ivec2(0),size-1),0).rgb;bloom+=v*max(0.,dot(v,luma)-.58);
 }c=clamp(c+bloom*bloomStrength,0.,1.);
 if(paletteEnabled==1){float d1=100.,d2=100.;vec3 c1=palette[0],c2=c1;
  for(int i=0;i<64;i++){if(i>=paletteCount)break;vec3 v=c-palette[i];float d=dot(v*v,luma);
   if(d<d1){d2=d1;c2=c1;d1=d;c1=palette[i];}else if(d<d2){d2=d;c2=palette[i];}}
  float threshold=(bayer[(cell.x%4)+(cell.y%4)*4]+.5)/16.;
  c=threshold<ditherStrength*d1/max(.00001,d1+d2)?c2:c1;
 }result=vec4(c,1.);
}`;
export function frameFingerprint(bytes){let h=2166136261;for(const b of bytes)h=Math.imul(h^b,16777619);return (h>>>0).toString(16).padStart(8,'0');}

// Large surfaces use coarse clusters. Authored fine features retain native pixel coverage,
// quantized to the same palette, rather than a blurred high-resolution overlay.
export const DETAIL_FRAGMENT=`#version 300 es
precision highp float;precision highp int;in vec2 uv;
uniform sampler2D frame,sourceFrame,features;uniform vec3 palette[64];uniform int paletteCount,paletteEnabled;out vec4 result;
void main(){
 vec3 c=texture(frame,uv).rgb;ivec2 p=ivec2(gl_FragCoord.xy);vec4 feature=texelFetch(features,p,0);
 if(feature.r+feature.g>.08){c=texelFetch(sourceFrame,p,0).rgb;
  if(paletteEnabled==1){float best=100.;vec3 chosen=palette[0];for(int i=0;i<64;i++){if(i>=paletteCount)break;vec3 v=c-palette[i];float d=dot(v*v,vec3(.3,.59,.11));if(d<best){best=d;chosen=palette[i];}}c=chosen;}
 }result=vec4(c,1.);
}`;
