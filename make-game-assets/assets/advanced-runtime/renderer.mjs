// GPU-projected anisotropic 3D Gaussians; persistent model textures, 16-bit counting sort,
// a mirrored Gaussian pass, Gaussian water sampling, and one pixel-art display pass.
import {covariance,validateGaussians} from './gaussians.mjs';
import {compose,multiply,pivotTransform,cameraBasis} from './math.mjs';
import {BEAM_FREQUENCY,MOTE_FREQUENCY} from './motion.mjs';
import {PARTICLE_GLSL,PARTICLE_KINDS,sampleParticle} from './particle-motion.mjs';
import {WATER_GLSL,waterDisplacement} from './water.mjs';
import {pixelLayout,DISPLAY_VERTEX,COPY_FRAGMENT,PIXEL_FRAGMENT,DETAIL_FRAGMENT,frameFingerprint} from './pixel-display.mjs';
const VERTEX=`#version 300 es
precision highp float;precision highp int;
layout(location=0) in vec2 corner;layout(location=1) in int splatIndex;
uniform sampler2D gaussianData,transforms;uniform int dataWidth,reflectionPass;
uniform vec3 cameraRight,cameraUp,cameraEye,cameraTarget;uniform vec2 viewport;
uniform float pixelsPerUnit,time,waterLevel;uniform vec4 pointLights[4],lightColors[4];uniform vec3 skyTint;
out vec2 local;out vec4 color;out vec3 worldCenter;out float phase;flat out int kind;flat out int fineDetail;
${WATER_GLSL}
${PARTICLE_GLSL}
vec4 datum(int i){return texelFetch(gaussianData,ivec2(i%dataWidth,i/dataWidth),0);}
void main(){
 int base=splatIndex*5;vec4 a=datum(base),b=datum(base+1),c=datum(base+2),d=datum(base+3),e=datum(base+4);
 int group=int(a.w+.5);vec4 t0=texelFetch(transforms,ivec2(0,group),0),t1=texelFetch(transforms,ivec2(1,group),0),t2=texelFetch(transforms,ivec2(2,group),0),t3=texelFetch(transforms,ivec2(3,group),0);
 mat3 A=transpose(mat3(t0.xyz,t1.xyz,t2.xyz));vec3 p=A*a.xyz+vec3(t0.w,t1.w,t2.w);
 kind=int(d.z+.5);fineDetail=int(e.w+.5);phase=d.w;
 if(kind==1)p.y+=waterHeight(p.xz,time);
 if(kind==3)p+=A*vec3(.035*sin(time*${MOTE_FREQUENCY}+phase),.08*sin(time*${MOTE_FREQUENCY*2}+phase),.035*cos(time*${MOTE_FREQUENCY}+phase));
 if(kind==4)p+=A*vec3(.018*sin(time*.8+a.y*5.+phase)*min(1.,abs(a.y)),0.,0.);
 vec4 motion=particleMotion(kind,time,phase);
 p+=A*motion.xyz;
 worldCenter=p;local=corner*3.;color=vec4(c.zw,d.xy);color.a*=t3.x*motion.w;
 if((kind==0||kind==4)&&t3.w>.5){
  vec3 N=A*e.xyz;if(t3.w>1.5)N=transpose(inverse(A))*e.xyz;N=normalize(N);vec3 albedo=color.rgb;
  float diffuse=max(0.,dot(N,normalize(vec3(-.32,.74,.59))));
  color.rgb*=(.28+.06*max(0.,N.y)+.90*diffuse)*skyTint;
  for(int l=0;l<4;l++){vec3 L=pointLights[l].xyz-p;float ds=dot(L,L);float light=max(.08,dot(N,L/max(.0001,sqrt(ds))));color.rgb+=albedo*lightColors[l].rgb*light*pointLights[l].w/(1.+ds*7.);}
 }
 color.rgb*=t3.y;
 if(kind==2)color.a*=.92+.08*sin(time*${BEAM_FREQUENCY}+phase);
 if(kind==3)color.a*=.65+.35*sin(time*${MOTE_FREQUENCY*3}+phase*3.);
 mat3 C=mat3(b.x,b.y,b.z,b.y,b.w,c.x,b.z,c.x,c.y);
 mat3 frame=kind==${PARTICLE_KINDS['falling-leaf']} ? A*leafTumble(time,phase) : A;
 C=frame*C*transpose(frame);
 if(reflectionPass==1){
  if(t3.z<.5||p.y<waterLevel+.01||kind==1||kind==2||kind==3){gl_Position=vec4(2.,2.,2.,1.);color.a=0.;return;}
  p.y=2.*waterLevel-p.y;mat3 M=mat3(1.,0.,0.,0.,-1.,0.,0.,0.,1.);C=M*C*M;
 }
 if(color.a<.001){gl_Position=vec4(2.,2.,2.,1.);return;}
 vec3 v=p-cameraTarget;vec2 center=vec2(dot(cameraRight,v),dot(cameraUp,v))*pixelsPerUnit;
 float xx=dot(cameraRight,C*cameraRight)*pixelsPerUnit*pixelsPerUnit+.04;
 float xy=dot(cameraRight,C*cameraUp)*pixelsPerUnit*pixelsPerUnit;
 float yy=dot(cameraUp,C*cameraUp)*pixelsPerUnit*pixelsPerUnit+.04;
 float t=(xx+yy)*.5,delta=sqrt(max(0.,(xx-yy)*(xx-yy)*.25+xy*xy));
 float angle=.5*atan(2.*xy,xx-yy),ca=cos(angle),sa=sin(angle);
 vec2 u=vec2(ca,sa)*3.*sqrt(max(.01,t+delta)),w=vec2(-sa,ca)*3.*sqrt(max(.01,t-delta));
 gl_Position=vec4((center+corner.x*u+corner.y*w)*2./viewport,0.,1.);
}`;
const FRAGMENT=`#version 300 es
precision highp float;precision highp int;
in vec2 local;in vec4 color;in vec3 worldCenter;in float phase;flat in int kind;flat in int fineDetail;
uniform sampler2D reflectedFrame;uniform vec2 viewport;uniform float time,reflectionStrength,waterRadius;uniform vec3 cameraEye;uniform vec4 ripples[8];uniform int rippleCount;
uniform float alphaCut;uniform int reflectionPass,waterReflections;layout(location=0) out vec4 result;layout(location=1) out vec4 features;
uniform vec4 pointLights[4],lightColors[4];
${WATER_GLSL}
void main(){
 float radius=dot(local,local);if(radius>9.)discard;float alpha=color.a*exp(-.5*radius);if(alpha<1./255.)discard;
 if(alphaCut>0.){if(alpha<alphaCut)discard;alpha=1.;}
 vec3 rgb=color.rgb;
 if(kind==1&&reflectionPass==0){
  if(waterRadius>0.&&length(worldCenter.xz)>waterRadius)discard;
  vec2 gradient=waterGradient(worldCenter.xz,time);
  for(int i=0;i<8;i++){if(i>=rippleCount)break;vec2 d=worldCenter.xz-ripples[i].xy;float dist=length(d),age=time-ripples[i].z;float env=exp(-pow((dist-age*.65)*5.,2.))*max(0.,1.-age/1.8);gradient+=d/max(.01,dist)*cos(dist*31.-age*15.)*.10*env;}
  vec3 N=normalize(vec3(-gradient.x,1.,-gradient.y));float fresnel=.04+.96*pow(1.-max(0.,dot(N,cameraEye)),5.);
  vec2 distortion=gradient*19./viewport+vec2(sin(worldCenter.z*30.+time*.6)*2.5,0.)/viewport;
  vec2 uv=gl_FragCoord.xy/viewport+distortion;
  vec4 reflected=texture(reflectedFrame,uv)*.60+texture(reflectedFrame,uv+vec2(1.6,0.)/viewport)*.20+texture(reflectedFrame,uv-vec2(1.6,0.)/viewport)*.20;
  if(waterReflections==1){float breakup=.64+.36*sin(worldCenter.z*62.+time*1.1+sin(worldCenter.x*11.));float amount=reflected.a*min(.78,(.24+fresnel*.8)*reflectionStrength)*breakup;rgb=mix(rgb,reflected.rgb/max(reflected.a,.0001),amount);}
  float glint=pow(max(0.,dot(reflect(-normalize(vec3(-.32,.74,.59)),N),cameraEye)),100.);
  rgb+=vec3(.45,.68,.71)*glint*.18;
  for(int l=0;l<4;l++){vec3 delta=pointLights[l].xyz-worldCenter;float ds=dot(delta,delta);vec3 L=delta/max(.0001,sqrt(ds));float nh=max(0.,dot(N,normalize(L+cameraEye)));float spec=.15*pow(nh,36.)+.26*pow(nh,130.);rgb+=lightColors[l].rgb*pointLights[l].w*spec/(1.+ds*.3);}
 }
 result=vec4(rgb*alpha,alpha);features=vec4(kind==4?alpha:0.,fineDetail==1?alpha:0.,0.,alpha);
}`;
const KINDS={solid:0,emissive:5,water:1,beam:2,motes:3,foliage:4,shadow:6,...PARTICLE_KINDS};
const hex=s=>[1,3,5].map(i=>parseInt(s.slice(i,i+2),16)/255);
export class GaussianRenderer{
 constructor(canvas,style){
  if(!style.pixelArt?.palette?.length||style.pixelArt.palette.length>64)throw Error('像素色板需要 1–64 个颜色');
  this.canvas=canvas;this.style=style;this.resources=new Map();this.mode='pixel';this.waterReflections=true;this.waterLevel=.035;this.reflectionStrength=1.;this.alphaCut=0;this.time=0;this.waterRadius=0;this.ripples=[];this.lights=[];this.skyTint=[1,1,1];
  const gl=this.gl=canvas.getContext('webgl2',{alpha:false,antialias:false,preserveDrawingBuffer:true});if(!gl)throw Error('需要支持 WebGL2 的浏览器');
  const program=(v,f)=>{const p=gl.createProgram();for(const [type,source] of [[gl.VERTEX_SHADER,v],[gl.FRAGMENT_SHADER,f]]){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));gl.attachShader(p,s);gl.deleteShader(s);}gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;};
  this.program=program(VERTEX,FRAGMENT);this.post=program(DISPLAY_VERTEX,COPY_FRAGMENT);this.pixelPost=program(DISPLAY_VERTEX,PIXEL_FRAGMENT);this.detailPost=program(DISPLAY_VERTEX,DETAIL_FRAGMENT);this.frameId=0;this.pixelFrameId=-1;
  const names=['gaussianData','transforms','dataWidth','reflectionPass','cameraRight','cameraUp','cameraEye','cameraTarget','viewport','pixelsPerUnit','time','waterLevel','reflectedFrame','reflectionStrength','waterReflections','pointLights[0]','lightColors[0]','waterRadius','ripples[0]','rippleCount','skyTint','alphaCut'];
  this.u=Object.fromEntries(names.map(n=>[n,gl.getUniformLocation(this.program,n)]));
  this.p={frame:gl.getUniformLocation(this.post,'frame')};
  this.dp=Object.fromEntries(['frame','sourceFrame','features','palette','paletteCount','paletteEnabled'].map(n=>[n,gl.getUniformLocation(this.detailPost,n==='palette'?'palette[0]':n)]));
  this.pp=Object.fromEntries(['frame','features','palette','paletteCount','paletteEnabled','pixelScale','sourceOrigin','ditherStrength','detailBias','bloomStrength'].map(n=>[n,gl.getUniformLocation(this.pixelPost,n==='palette'?'palette[0]':n)]));
  this.quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,1,1,-1,-1,1,1,-1,1]),gl.STATIC_DRAW);
  this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  this.indexBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.indexBuffer);gl.enableVertexAttribArray(1);gl.vertexAttribIPointer(1,1,gl.INT,0,0);gl.vertexAttribDivisor(1,1);
  this.postVao=gl.createVertexArray();gl.bindVertexArray(this.postVao);gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  this.dataTexture=this.makeTexture();this.transformTexture=this.makeTexture();this.reflectionTexture=this.makeTexture();this.frameTexture=this.makeTexture();this.featureTexture=this.makeTexture();this.pixelTexture=this.makeTexture();this.emptyTexture=this.makeTexture();
  gl.bindTexture(gl.TEXTURE_2D,this.emptyTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));
  this.reflectionFbo=gl.createFramebuffer();this.frameFbo=gl.createFramebuffer();this.pixelFbo=gl.createFramebuffer();this.counts=new Int32Array(65536);this.cursor=new Int32Array(65536);this.uploads=0;
  gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.disable(gl.DITHER);
 }
 makeTexture(){const gl=this.gl,t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);for(const k of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,k,gl.NEAREST);for(const k of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,k,gl.CLAMP_TO_EDGE);return t;}
 upload(definition,data){
  const count=validateGaussians(data),centers=new Float32Array(count*3),cov=new Float32Array(count*6),colors=new Float32Array(count*4),normals=new Float32Array(count*3),kinds=new Uint8Array(count).fill(KINDS[definition.material?.kind]??0),a=data.splats;
  for(let i=0;i<count;i++){const j=i*14;centers.set(a.slice(j,j+3),i*3);cov.set(covariance(a.slice(j+3,j+6),a.slice(j+6,j+10)),i*6);colors.set(a.slice(j+10,j+14),i*4);const[x,y,z,w]=a.slice(j+6,j+10);normals.set([2*(x*z+w*y),2*(y*z-w*x),1-2*(x*x+y*y)],i*3);}
  for(const range of definition.materialRanges||[])kinds.fill(KINDS[range.kind]??0,range.start,range.start+range.count);
  const details=new Uint8Array(count);for(const range of definition.pixelDetailRanges||[]){if(!Number.isInteger(range.start)||!Number.isInteger(range.count)||range.start<0||range.count<1||range.start+range.count>count)throw Error('Invalid pixel detail range');details.fill(1,range.start,range.start+range.count);}
  this.resources.set(definition.id,{definition,count,centers,cov,colors,normals,kinds,details});
 }
 setScene(items){
  this.items=items;this.groups=[];let total=0;for(const item of items){const r=this.resources.get(item.asset);if(!r)throw Error(`Missing asset ${item.asset}`);total+=r.count;}
  this.count=total;this.centers=new Float32Array(total*3);this.groupIds=new Uint32Array(total);this.kind=new Uint8Array(total);this.phases=new Float32Array(total);this.depths=new Float32Array(total);this.worldYs=new Float32Array(total);this.keys=new Uint16Array(total);this.order=new Int32Array(total);
  const width=1024,height=Math.max(1,Math.ceil(total*5/width)),data=new Float32Array(width*height*4);let offset=0;
  for(const item of items){
   const resource=this.resources.get(item.asset),def=resource.definition,parts=def.parts?.length?def.parts:[{name:'root',start:0,count:resource.count,pivot:[0,0,0]}],localGroups=new Uint32Array(resource.count);
   for(const part of parts){const id=this.groups.length;this.groups.push({item,part,definition:def});localGroups.fill(id,part.start,part.start+part.count);}
   for(let i=0;i<resource.count;i++,offset++){
    const o=offset*20,j=i*3,k=i*6,l=i*4,group=localGroups[i],kind=resource.kinds[i],phase=(i*.61803398875%1)*Math.PI*2;
    data.set([resource.centers[j],resource.centers[j+1],resource.centers[j+2],group,resource.cov[k],resource.cov[k+1],resource.cov[k+2],resource.cov[k+3],resource.cov[k+4],resource.cov[k+5],resource.colors[l],resource.colors[l+1],resource.colors[l+2],resource.colors[l+3],kind,phase,...resource.normals.subarray(j,j+3),resource.details[i]],o);
    this.centers.set(resource.centers.subarray(j,j+3),offset*3);this.groupIds[offset]=group;this.kind[offset]=kind;this.phases[offset]=phase;
   }
  }
  const gl=this.gl;this.dataWidth=width;this.dataHeight=height;this.transformData=new Float32Array(Math.max(1,this.groups.length)*16);
  gl.bindTexture(gl.TEXTURE_2D,this.dataTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,width,height,0,gl.RGBA,gl.FLOAT,data);
  gl.bindTexture(gl.TEXTURE_2D,this.transformTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,4,Math.max(1,this.groups.length),0,gl.RGBA,gl.FLOAT,this.transformData);
  gl.bindBuffer(gl.ARRAY_BUFFER,this.indexBuffer);gl.bufferData(gl.ARRAY_BUFFER,this.order.byteLength,gl.DYNAMIC_DRAW);this.uploads++;
  this.gpuModelBytes=data.byteLength+this.transformData.byteLength+this.order.byteLength;
 }
 updateTransforms(poses={}){
  for(let i=0;i<this.groups.length;i++){
   const {item,part,definition}=this.groups[i],pose=poses[item.id];
   let matrix=compose(item.position||[0,0,0],item.yaw||0,item.scale??1),partPose=pose?.parts?.[part.name];
   if(pose?.root)matrix=multiply(matrix,compose(pose.root));
   if(partPose)matrix=multiply(matrix,pivotTransform(part.pivot||[0,0,0],partPose.rotation,partPose.translation));
   this.transformData.set(matrix,i*16);this.transformData[i*16+12]=(item.visible===false?0:1)*(item.alpha??1);this.transformData[i*16+13]=item.intensity??1;this.transformData[i*16+14]=definition.material?.reflect===false?0:1;this.transformData[i*16+15]=definition.material?.lighting?.includes('world')?(Array.isArray(item.scale)&&!(item.scale[0]===item.scale[1]&&item.scale[1]===item.scale[2])?2:1):0;
  }
  const gl=this.gl;gl.bindTexture(gl.TEXTURE_2D,this.transformTexture);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,4,Math.max(1,this.groups.length),gl.RGBA,gl.FLOAT,this.transformData);
 }
 updateDepths(camera,time){
  const e=camera.eye,a=this.transformData,p=this.centers,particle=new Float64Array(4);
  for(let i=0;i<this.count;i++){
   const t=this.groupIds[i]*16,j=i*3,x=p[j],y=p[j+1],z=p[j+2],phase=this.phases[i];
   let X=a[t]*x+a[t+1]*y+a[t+2]*z+a[t+3],Y=a[t+4]*x+a[t+5]*y+a[t+6]*z+a[t+7],Z=a[t+8]*x+a[t+9]*y+a[t+10]*z+a[t+11];
   const k=this.kind[i];if(k===1)Y+=waterDisplacement(X,Z,time);
   if(k===3){const dx=.035*Math.sin(time*MOTE_FREQUENCY+phase),dy=.08*Math.sin(time*MOTE_FREQUENCY*2+phase),dz=.035*Math.cos(time*MOTE_FREQUENCY+phase);X+=a[t]*dx+a[t+1]*dy+a[t+2]*dz;Y+=a[t+4]*dx+a[t+5]*dy+a[t+6]*dz;Z+=a[t+8]*dx+a[t+9]*dy+a[t+10]*dz;}
   if(k===4){const dx=.018*Math.sin(time*.8+p[j+1]*5+phase)*Math.min(1,Math.abs(p[j+1]));X+=a[t]*dx;Y+=a[t+4]*dx;Z+=a[t+8]*dx;}
   if(k>=7){
    const [dx,dy,dz]=sampleParticle(k,time,phase,particle);
    X+=a[t]*dx+a[t+1]*dy+a[t+2]*dz;
    Y+=a[t+4]*dx+a[t+5]*dy+a[t+6]*dz;
    Z+=a[t+8]*dx+a[t+9]*dy+a[t+10]*dz;
   }
   this.depths[i]=X*e[0]+Y*e[1]+Z*e[2];this.worldYs[i]=Y;
  }
 }
 sort(reflection,eyeY){
  const n=this.count,depth=this.depths;let lo=Infinity,hi=-Infinity;
  for(let i=0;i<n;i++){const d=depth[i]-(reflection?2*eyeY*(this.worldYs[i]-this.waterLevel):0);lo=Math.min(lo,d);hi=Math.max(hi,d);}
  const factor=65535/Math.max(.0001,hi-lo),counts=this.counts;counts.fill(0);
  for(let i=0;i<n;i++){const d=depth[i]-(reflection?2*eyeY*(this.worldYs[i]-this.waterLevel):0),key=Math.min(65535,Math.max(0,Math.floor((d-lo)*factor)));this.keys[i]=key;counts[key]++;}
  let sum=0;for(let i=0;i<65536;i++){this.cursor[i]=sum;sum+=counts[i];}
  for(let i=0;i<n;i++)this.order[this.cursor[this.keys[i]]++]=i;
 }
 resizeTargets(width, height) {
  if (this.fw === width && this.fh === height) return;
  const gl = this.gl;
  const allocate = (texture, attachment) => {
   gl.bindTexture(gl.TEXTURE_2D, texture);
   gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
   gl.framebufferTexture2D(gl.FRAMEBUFFER, attachment, gl.TEXTURE_2D, texture, 0);
  };
  gl.bindFramebuffer(gl.FRAMEBUFFER, this.reflectionFbo);
  allocate(this.reflectionTexture, gl.COLOR_ATTACHMENT0);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw Error('Reflection framebuffer incomplete');
  // The color and feature attachments must both have the new size before checking.
  gl.bindFramebuffer(gl.FRAMEBUFFER, this.frameFbo);
  allocate(this.frameTexture, gl.COLOR_ATTACHMENT0);
  allocate(this.featureTexture, gl.COLOR_ATTACHMENT1);
  gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw Error('Scene framebuffer incomplete');
  this.fw = width;
  this.fh = height;
 }

 render(cameraState,time,poses={}){
  if(!this.count)return;const started=performance.now(),gl=this.gl,rect=this.canvas.getBoundingClientRect(),ratio=this.style.sourcePixelRatio??Math.min(devicePixelRatio||1,1.5),W=Math.min(1600,Math.max(1,Math.round(rect.width*ratio))),H=Math.max(1,Math.round(W*rect.height/rect.width));
  if(this.canvas.width!==W||this.canvas.height!==H){this.canvas.width=W;this.canvas.height=H;}
  const w=W,h=H;this.resizeTargets(w,h);this.layout=pixelLayout(W,H,this.style.pixelArt);
  const basis=cameraBasis(cameraState.yaw,cameraState.pitch);this.updateTransforms(poses);this.updateDepths(basis,time);
  gl.useProgram(this.program);gl.bindVertexArray(this.vao);gl.disable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.dataTexture);gl.uniform1i(this.u.gaussianData,0);
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.transformTexture);gl.uniform1i(this.u.transforms,1);
  gl.uniform1i(this.u.dataWidth,this.dataWidth);gl.uniform3fv(this.u.cameraRight,basis.right);gl.uniform3fv(this.u.cameraUp,basis.up);gl.uniform3fv(this.u.cameraEye,basis.eye);gl.uniform3fv(this.u.cameraTarget,cameraState.target);gl.uniform2f(this.u.viewport,w,h);gl.uniform1f(this.u.pixelsPerUnit,h/cameraState.span);gl.uniform1f(this.u.time,time);gl.uniform1f(this.u.waterLevel,this.waterLevel);gl.uniform1i(this.u.reflectedFrame,2);gl.uniform1f(this.u.reflectionStrength,this.reflectionStrength);gl.uniform1i(this.u.waterReflections,this.waterReflections?1:0);
  gl.uniform1f(this.u.alphaCut,this.alphaCut);gl.uniform3fv(this.u.skyTint,this.skyTint);gl.uniform1f(this.u.waterRadius,this.waterRadius);const points=new Float32Array(16),colors=new Float32Array(16),ripples=new Float32Array(32);this.lights.slice(0,4).forEach((l,i)=>{points.set([...l.position,l.intensity??1],i*4);colors.set([...(l.color||[1,.5,.2]),1],i*4);});this.ripples.slice(-8).forEach((r,i)=>ripples.set([r.x,r.z,r.born,1],i*4));gl.uniform4fv(this.u['pointLights[0]'],points);gl.uniform4fv(this.u['lightColors[0]'],colors);gl.uniform4fv(this.u['ripples[0]'],ripples);gl.uniform1i(this.u.rippleCount,Math.min(8,this.ripples.length));
  let passes=0;
  for(const reflection of [true,false]){
   if(reflection&&!this.waterReflections){gl.bindFramebuffer(gl.FRAMEBUFFER,this.reflectionFbo);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);continue;}
   this.sort(reflection,basis.eye[1]);gl.bindBuffer(gl.ARRAY_BUFFER,this.indexBuffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,this.order);
   gl.bindFramebuffer(gl.FRAMEBUFFER,reflection?this.reflectionFbo:this.frameFbo);gl.viewport(0,0,w,h);gl.clearBufferfv(gl.COLOR,0,new Float32Array(reflection?[0,0,0,0]:[.0196,.047,.0627,1]));if(!reflection)gl.clearBufferfv(gl.COLOR,1,new Float32Array(4));
   gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,reflection?this.emptyTexture:this.reflectionTexture);gl.uniform1i(this.u.reflectionPass,reflection?1:0);gl.drawArraysInstanced(gl.TRIANGLES,0,6,this.count);passes++;
  }
  this.frameId++;this.lastFrame={id:this.frameId,time,camera:structuredClone(cameraState),sourceResolution:[W,H]};
  const displayPasses=this.present(this.mode),shown=this.mode==='pixel'?this.layout.resolution:[W,H];
  this.stats={gaussians:this.count,drawCalls:passes+displayPasses,groups:this.groups.length,modelTextureUploads:this.uploads,gpuBytes:this.gpuModelBytes+W*H*12+this.layout.resolution[0]*this.layout.resolution[1]*4,sourceResolution:[W,H],internalResolution:shown,displayResolution:[W,H],pixelScale:this.mode==='pixel'?this.layout.scale:1,detailResolution:[W,H],pixelPolicy:'coarse clusters and native marked detail',paletteEnabled:this.mode==='pixel'&&this.style.pixelArt.paletteEnabled!==false,paletteColors:this.style.pixelArt.palette.length,bloom:this.mode==='pixel'?(this.style.pixelArt.bloomStrength??.08):0,cpuFrameMs:performance.now()-started,projection:'GPU anisotropic Gaussian',sorting:'16-bit global counting',reflections:this.waterReflections};
 }
 resolvePixel(){
  if(this.pixelFrameId===this.frameId)return false;
  const gl=this.gl,{scale,resolution:[w,h],sourceOrigin}=this.layout,style=this.style.pixelArt;
  if(this.pw!==w||this.ph!==h){this.pw=w;this.ph=h;gl.bindTexture(gl.TEXTURE_2D,this.pixelTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.bindFramebuffer(gl.FRAMEBUFFER,this.pixelFbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.pixelTexture,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Pixel framebuffer incomplete');}
  gl.bindFramebuffer(gl.FRAMEBUFFER,this.pixelFbo);gl.viewport(0,0,w,h);gl.disable(gl.BLEND);gl.useProgram(this.pixelPost);gl.bindVertexArray(this.postVao);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.frameTexture);
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.featureTexture);gl.uniform1i(this.pp.features,1);gl.uniform1i(this.pp.frame,0);gl.uniform1i(this.pp.paletteCount,style.palette.length);gl.uniform1i(this.pp.paletteEnabled,style.paletteEnabled!==false?1:0);gl.uniform3fv(this.pp.palette,style.palette.flatMap(hex));gl.uniform1i(this.pp.pixelScale,scale);gl.uniform2i(this.pp.sourceOrigin,...sourceOrigin);gl.uniform1f(this.pp.ditherStrength,Math.max(0,Math.min(1,style.ditherStrength??.15)));gl.uniform1f(this.pp.detailBias,Math.max(0,Math.min(.85,style.detailBias??.6)));gl.uniform1f(this.pp.bloomStrength,Math.max(0,Math.min(.3,style.bloomStrength??.08)));gl.drawArrays(gl.TRIANGLES,0,6);
  this.pixelFrameId=this.frameId;return true;
 }
 present(mode){
  const gl=this.gl,W=this.canvas.width,H=this.canvas.height,pixel=mode==='pixel';let passes=1;
  if(pixel&&this.resolvePixel())passes++;
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.disable(gl.BLEND);gl.viewport(0,0,W,H);const bg=hex(this.style.pixelArt.palette[0]);gl.clearColor(...bg,1);gl.clear(gl.COLOR_BUFFER_BIT);
  if(pixel)gl.viewport(...this.layout.viewport);
  gl.useProgram(pixel?this.detailPost:this.post);gl.bindVertexArray(this.postVao);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,pixel?this.pixelTexture:this.frameTexture);
  if(pixel){gl.uniform1i(this.dp.frame,0);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.frameTexture);gl.uniform1i(this.dp.sourceFrame,1);gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,this.featureTexture);gl.uniform1i(this.dp.features,2);gl.uniform1i(this.dp.paletteCount,this.style.pixelArt.palette.length);gl.uniform1i(this.dp.paletteEnabled,this.style.pixelArt.paletteEnabled!==false?1:0);gl.uniform3fv(this.dp.palette,this.style.pixelArt.palette.flatMap(hex));}else gl.uniform1i(this.p.frame,0);gl.drawArrays(gl.TRIANGLES,0,6);return passes;
 }
 captureComparison(){
  if(!this.lastFrame)throw Error('Render a scene frame first');
  const gl=this.gl,W=this.canvas.width,H=this.canvas.height,source=new Uint8Array(W*H*4),rawPixels=new Uint8Array(source.length);
  gl.bindFramebuffer(gl.FRAMEBUFFER,this.frameFbo);gl.readBuffer(gl.COLOR_ATTACHMENT0);gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,source);
  const masks=new Uint8Array(source.length);gl.readBuffer(gl.COLOR_ATTACHMENT1);gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,masks);gl.readBuffer(gl.COLOR_ATTACHMENT0);const maskCanvas=document.createElement('canvas');maskCanvas.width=W;maskCanvas.height=H;const ctx=maskCanvas.getContext('2d'),mask=ctx.createImageData(W,H);let markedPixels=0;for(let y=0;y<H;y++)for(let x=0;x<W;x++){const src=(y*W+x)*4,dst=((H-1-y)*W+x)*4,value=(masks[src]+masks[src+1])/255>.08?255:0;mask.data.set([value,value,value,255],dst);if(value)markedPixels++;}ctx.putImageData(mask,0,0);const detailsMask=maskCanvas.toDataURL('image/png');
  this.present('raw');gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,rawPixels);const raw=this.canvas.toDataURL('image/png');
  this.present('pixel');const pixel=this.canvas.toDataURL('image/png');this.present(this.mode);
  return {raw,pixel,detailsMask,metadata:{...structuredClone(this.lastFrame),sourceFingerprint:frameFingerprint(source),rawFingerprint:frameFingerprint(rawPixels),rawMatchesSource:source.every((v,i)=>v===rawPixels[i]),raw:{resolution:[W,H],bloom:0,palette:false,dither:0},pixel:{...structuredClone(this.layout),...structuredClone(this.style.pixelArt),fineDetailResolution:[W,H],markedPixels,policy:"coarse clusters; marked lines and foliage use native palette pixels"},sameSourceFrame:true}};
 }

 get diagnostics(){const gl=this.gl,ext=gl.getExtension('WEBGL_debug_renderer_info');return{...this.stats,api:gl.getParameter(gl.VERSION),gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unavailable'};}
 dispose(){const gl=this.gl;for(const p of [this.program,this.post,this.pixelPost,this.detailPost])gl.deleteProgram(p);for(const b of [this.quad,this.indexBuffer])gl.deleteBuffer(b);for(const t of [this.dataTexture,this.transformTexture,this.reflectionTexture,this.frameTexture,this.featureTexture,this.pixelTexture,this.emptyTexture])gl.deleteTexture(t);for(const f of [this.reflectionFbo,this.frameFbo,this.pixelFbo])gl.deleteFramebuffer(f);for(const v of [this.vao,this.postVao])gl.deleteVertexArray(v);this.resources.clear();}
}
