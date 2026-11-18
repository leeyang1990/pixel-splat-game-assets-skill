// Orthographic anisotropic 3D Gaussian splatting + a separate pixel-art post pass.
import {covariance,fromNormal,STRIDE,validateGaussians} from './gaussians.mjs';
const vertex=`#version 300 es
precision highp float;
layout(location=0) in vec2 corner;
layout(location=1) in vec2 center;
layout(location=2) in vec2 axisU;
layout(location=3) in vec2 axisV;
layout(location=4) in vec4 rgba;
out vec2 local;out vec4 tint;
void main(){gl_Position=vec4(center+corner.x*axisU+corner.y*axisV,0.,1.);local=corner*3.;tint=rgba;}`;
const fragment=`#version 300 es
precision highp float;
in vec2 local;in vec4 tint;out vec4 outColor;
void main(){float r=dot(local,local);if(r>9.)discard;float a=tint.a*exp(-.5*r);if(a<1./255.)discard;outColor=vec4(tint.rgb*a,a);}`;
const postVertex=`#version 300 es
precision highp float;
layout(location=0) in vec2 corner;out vec2 uv;
void main(){gl_Position=vec4(corner,0.,1.);uv=(corner+1.)*.5;}`;
const postFragment=`#version 300 es
precision highp float;
in vec2 uv;uniform sampler2D frame;uniform int pixelMode,paletteCount;uniform float ditherStrength;uniform vec3 palette[24];out vec4 outColor;
const float bayer[16]=float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
void main(){vec3 c=texture(frame,uv).rgb;
 if(pixelMode==1){float d1=100.,d2=100.;vec3 c1=palette[0],c2=c1;for(int i=0;i<24;i++){if(i>=paletteCount)break;vec3 v=c-palette[i];float d=dot(v*v,vec3(.3,.59,.11));if(d<d1){d2=d1;c2=c1;d1=d;c1=palette[i];}else if(d<d2){d2=d;c2=palette[i];}}
 ivec2 p=ivec2(floor(uv*vec2(textureSize(frame,0))));float threshold=(bayer[(p.x%4)+(p.y%4)*4]+.5)/16.;c=(threshold<ditherStrength*d1/max(d1+d2,.000001))?c2:c1;}
 outColor=vec4(c,1.);}`;
const DEFAULT_PALETTE=['10201d','233b2b','344c32','4d6b3e','688d49','86a453','adc26e','44544e','68766b','91a18a','654834','916039','bc874e','dbb977','e4a542','ffe2a0','fff1ca','cde3d9','e5f1e9'];
const rgb=hex=>[0,2,4].map(i=>parseInt(hex.replace('#','').slice(i,i+2),16)/255);
export class Renderer{
 constructor(canvas){
  this.canvas=canvas;const gl=this.gl=canvas.getContext('webgl2',{alpha:false,antialias:false,preserveDrawingBuffer:true});if(!gl)throw Error('需要支持 WebGL2 的浏览器');
  const program=(v,f)=>{const p=gl.createProgram();for(const [type,code] of [[gl.VERTEX_SHADER,v],[gl.FRAGMENT_SHADER,f]]){const s=gl.createShader(type);gl.shaderSource(s,code);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));gl.attachShader(p,s);}gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;};
  this.program=program(vertex,fragment);this.post=program(postVertex,postFragment);this.resources=new Map();this.queue=[];this.mode='pixel';this.zoom=42;this.camera=[0,0,0];this.pitch=57*Math.PI/180;this.uploads=0;this.capacity=0;this.gpuBytes=0;
  this.palette=DEFAULT_PALETTE.flatMap(rgb);this.paletteCount=DEFAULT_PALETTE.length;this.pixelScale=.5;this.ditherStrength=.35;
  const corners=new Float32Array([-1,-1,1,-1,1,1,-1,-1,1,1,-1,1]);
  this.quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);gl.bufferData(gl.ARRAY_BUFFER,corners,gl.STATIC_DRAW);
  this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  this.stream=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.stream);
  for(const [loc,n,offset] of [[1,2,0],[2,2,8],[3,2,16],[4,4,24]]){gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,n,gl.FLOAT,false,40,offset);gl.vertexAttribDivisor(loc,1);}
  this.postVao=gl.createVertexArray();gl.bindVertexArray(this.postVao);gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  this.fbo=gl.createFramebuffer();this.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.texture);for(const param of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,param,gl.NEAREST);for(const param of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,param,gl.CLAMP_TO_EDGE);
  gl.bindFramebuffer(gl.FRAMEBUFFER,this.fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.texture,0);
  gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);this.uploads++;
 }
 setStyle(style){if(Number.isFinite(style.camera?.pitchDegrees))this.pitch=style.camera.pitchDegrees*Math.PI/180;const p=style.pixelArt||{};if(p.palette){if(!Array.isArray(p.palette)||!p.palette.length||p.palette.length>24||p.palette.some(c=>typeof c!=='string'||!/^#?[0-9a-f]{6}$/i.test(c)))throw Error('Pixel palette requires 1–24 RGB hex colors');this.palette=p.palette.flatMap(rgb);this.paletteCount=p.palette.length;}if(p.resolutionScale!==undefined){if(!(p.resolutionScale>=.125&&p.resolutionScale<=1))throw Error('Pixel resolutionScale must be 0.125..1');this.pixelScale=p.resolutionScale;}if(p.ditherStrength!==undefined){if(!(p.ditherStrength>=0&&p.ditherStrength<=1))throw Error('Dither strength must be 0..1');this.ditherStrength=p.ditherStrength;}}
 upload(id,data){
  if(this.resources.has(id))return this.resources.get(id);
  if(Array.isArray(data)){const splats=[];for(let i=0;i<data.length;i+=7){const s=Math.max(data[i+6]*.7,.006),flat=id==='_shadow'||id==='_halo',q=flat?fromNormal([0,1,0]):[0,0,0,1];splats.push(data[i],data[i+1],data[i+2],s,s,flat?.006:s,...q,...data.slice(i+3,i+6),flat?.35:.93);}data={type:'gaussian-splats',stride:14,splats};}
  const count=validateGaussians(data),centers=new Float32Array(count*3),colors=new Float32Array(count*4),cov=new Float32Array(count*6),a=data.splats;
  for(let i=0;i<count;i++){const j=i*STRIDE;centers.set(a.slice(j,j+3),i*3);cov.set(covariance(a.slice(j+3,j+6),a.slice(j+6,j+10)),i*6);colors.set(a.slice(j+10,j+14),i*4);}
  const r={count,centers,colors,cov};this.resources.set(id,r);return r;
 }
 begin(){this.queue.length=0;this.stats={drawCalls:0,points:0,triangles:0,instances:0};}
 draw(id,position=[0,0,0],yaw=0,scale=1,glow=0){const r=this.resources.get(id);if(!r)throw Error(`Missing Gaussian asset ${id}`);this.queue.push({r,position,yaw,scale,glow});this.stats.points+=r.count;this.stats.instances++;}
 flush(){
  const gl=this.gl,W=this.canvas.width,H=this.canvas.height,ratio=this.mode==='pixel'?this.pixelScale:1,fw=Math.round(W*ratio),fh=Math.round(H*ratio),N=this.stats.points;
  if(this.fw!==fw||this.fh!==fh){this.fw=fw;this.fh=fh;gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,fw,fh,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.bindFramebuffer(gl.FRAMEBUFFER,this.fbo);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Gaussian framebuffer is incomplete');}
  if(N>this.capacity){this.capacity=Math.ceil(N/4096)*4096;this.projected=new Float32Array(this.capacity*10);this.sorted=new Float32Array(this.capacity*10);this.depths=new Float32Array(this.capacity);this.order=new Uint32Array(this.capacity);gl.bindBuffer(gl.ARRAY_BUFFER,this.stream);gl.bufferData(gl.ARRAY_BUFFER,this.sorted.byteLength,gl.DYNAMIC_DRAW);this.uploads++;}
  const cp=Math.cos(this.pitch),sp=Math.sin(this.pitch),zoom=this.zoom,z2=zoom*zoom,blur=.25/(ratio*ratio);let k=0;
  for(const {r,position,yaw,scale,glow} of this.queue){
   const c=Math.cos(yaw),s=Math.sin(yaw),ss=scale*scale;
   for(let i=0;i<r.count;i++,k++){
    const j=i*3,l=i*6,p=k*10,a=r.cov;
    const x=(c*r.centers[j]+s*r.centers[j+2])*scale+position[0]-this.camera[0],y=r.centers[j+1]*scale+position[1]-this.camera[1],z=(-s*r.centers[j]+c*r.centers[j+2])*scale+position[2]-this.camera[2];
    const xx=(c*c*a[l]+2*c*s*a[l+2]+s*s*a[l+5])*ss,xy=(c*a[l+1]+s*a[l+4])*ss,xz=((c*c-s*s)*a[l+2]+c*s*(a[l+5]-a[l]))*ss,yy=a[l+3]*ss,yz=(-s*a[l+1]+c*a[l+4])*ss,zz=(s*s*a[l]-2*c*s*a[l+2]+c*c*a[l+5])*ss;
    const A=xx*z2+blur,B=(cp*xy-sp*xz)*z2,C=(cp*cp*yy-2*cp*sp*yz+sp*sp*zz)*z2,t=(A+C)*.5,d=Math.sqrt((A-C)*(A-C)*.25+B*B),ang=.5*Math.atan2(2*B,A-C),u=3*Math.sqrt(Math.max(.01,t+d)),v=3*Math.sqrt(Math.max(.01,t-d)),ca=Math.cos(ang),sa=Math.sin(ang);
    this.projected[p]=x*zoom*2/W;this.projected[p+1]=(y*cp-z*sp)*zoom*2/H;
    this.projected[p+2]=ca*u*2/W;this.projected[p+3]=sa*u*2/H;this.projected[p+4]=-sa*v*2/W;this.projected[p+5]=ca*v*2/H;
    for(let ch=0;ch<3;ch++)this.projected[p+6+ch]=Math.min(1,r.colors[i*4+ch]*(1+glow*.12));this.projected[p+9]=r.colors[i*4+3];
    this.depths[k]=y*sp+z*cp;this.order[k]=k;
   }
  }
  const order=this.order.subarray(0,N);order.sort((a,b)=>this.depths[a]-this.depths[b]);
  for(let i=0;i<N;i++){const start=order[i]*10;this.sorted.set(this.projected.subarray(start,start+10),i*10);}
  gl.bindFramebuffer(gl.FRAMEBUFFER,this.fbo);gl.viewport(0,0,fw,fh);gl.clearColor(.057,.102,.095,1);gl.clear(gl.COLOR_BUFFER_BIT);
  gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.useProgram(this.program);gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.stream);gl.bufferSubData(gl.ARRAY_BUFFER,0,this.sorted.subarray(0,N*10));gl.drawArraysInstanced(gl.TRIANGLES,0,6,N);
  gl.disable(gl.BLEND);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,W,H);gl.useProgram(this.post);gl.bindVertexArray(this.postVao);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.uniform1i(gl.getUniformLocation(this.post,'frame'),0);gl.uniform1i(gl.getUniformLocation(this.post,'pixelMode'),this.mode==='pixel'?1:0);gl.uniform1f(gl.getUniformLocation(this.post,'ditherStrength'),this.ditherStrength);gl.uniform1i(gl.getUniformLocation(this.post,'paletteCount'),this.paletteCount);gl.uniform3fv(gl.getUniformLocation(this.post,'palette[0]'),this.palette);gl.drawArrays(gl.TRIANGLES,0,6);
  this.stats.drawCalls=2;this.stats.triangles=N*2+2;this.gpuBytes=this.capacity*40+fw*fh*4+48;
 }
 project([x,y,z]){const v=[x-this.camera[0],y-this.camera[1],z-this.camera[2]];return [this.canvas.width/2+v[0]*this.zoom,this.canvas.height/2-(v[1]*Math.cos(this.pitch)-v[2]*Math.sin(this.pitch))*this.zoom];}
 dispose(){const gl=this.gl;for(const p of [this.program,this.post])gl.deleteProgram(p);for(const b of [this.quad,this.stream])gl.deleteBuffer(b);for(const v of [this.vao,this.postVao])gl.deleteVertexArray(v);gl.deleteTexture(this.texture);gl.deleteFramebuffer(this.fbo);this.resources.clear();this.queue.length=0;}
 get diagnostics(){const gl=this.gl,ext=gl.getExtension('WEBGL_debug_renderer_info');return {renderer:'anisotropic-3d-gaussian',projection:'orthographic',sort:'global-back-to-front',falloff:'exp(-0.5*r^2)',mode:this.mode,api:gl.getParameter(gl.VERSION),gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unavailable',resolution:[this.canvas.width,this.canvas.height],internalResolution:[this.fw,this.fh],gpuUploadBytes:this.gpuBytes,bufferUploads:this.uploads,...this.stats};}
}
