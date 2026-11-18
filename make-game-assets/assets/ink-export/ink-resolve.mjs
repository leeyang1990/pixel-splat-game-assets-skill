// Independent implementation inspired by the public workflow: interior average,
// covered-sample body vote at silhouettes, then a darker entry in that body's ramp.
const weights=[.3,.59,.11],luma=c=>c.reduce((s,v,k)=>s+v*weights[k],0);
export const hexRgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
function nearest(c,palette,skip=1){let best=skip,distance=Infinity;for(let i=skip;i<palette.length;i++){let d=0;for(let k=0;k<3;k++)d+=(c[k]-palette[i][k])**2*weights[k];if(d<distance){distance=d;best=i;}}return best;}
export function averageFour(frame){
 const {width,height,rgba}=frame;if(width%2||height%2||rgba.length!==width*height*4)throw Error('Four-sample stage needs even dimensions and matching RGBA');
 const w=width/2,h=height/2,out=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){let alpha=0;const sum=[0,0,0];for(let j=0;j<2;j++)for(let i=0;i<2;i++){const q=((y*2+j)*width+x*2+i)*4,a=rgba[q+3]/255;alpha+=a;for(let k=0;k<3;k++)sum[k]+=rgba[q+k]*a;}const p=(y*w+x)*4;for(let k=0;k<3;k++)out[p+k]=alpha?sum[k]/alpha:0;out[p+3]=alpha/4*255;}
 return {width:w,height:h,rgba:out};
}
export function resolveInk(frame,{palette:hexPalette,ramps=[],outline=true,alphaThreshold=128}={}){
 const {width,height,rgba}=frame;if(width%2||height%2)throw Error('Ink resolve needs even dimensions');if(!Array.isArray(hexPalette)||hexPalette.length<2)throw Error('Ink resolve needs a background and body palette');
 const palette=hexPalette.map(hexRgb),w=width/2,h=height/2,coverage=new Uint8Array(w*h),body=new Int16Array(w*h).fill(-1),base=new Int16Array(w*h),output=new Uint8ClampedArray(w*h*4),contours=new Uint8Array(w*h),families=new Map();
 for(const ramp of ramps){const ids=ramp.map(c=>hexPalette.indexOf(c)).filter(i=>i>0);for(const i of ids)families.set(i,ids);}
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const votes=new Map(),sum=[0,0,0],p=y*w+x;for(let j=0;j<2;j++)for(let i=0;i<2;i++){const q=((y*2+j)*width+x*2+i)*4;if(rgba[q+3]<alphaThreshold)continue;const c=[rgba[q],rgba[q+1],rgba[q+2]],id=nearest(c,palette);coverage[p]++;votes.set(id,(votes.get(id)||0)+1);for(let k=0;k<3;k++)sum[k]+=c[k];}
  if(coverage[p]){let count=0;for(const [id,n] of votes)if(n>count){body[p]=id;count=n;}base[p]=nearest(sum.map(v=>v/coverage[p]),palette);}else base[p]=0;
 }
 let changed=0;const empty=(x,y)=>x<0||y<0||x>=w||y>=h||coverage[y*w+x]===0;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const p=y*w+x;let id=base[p];const edge=coverage[p]>0&&(coverage[p]<4||empty(x-1,y)||empty(x+1,y)||empty(x,y-1)||empty(x,y+1));
  if(outline&&edge){const owner=body[p],c=palette[owner],target=c.map(v=>v*.70);let best=owner,dist=Infinity;const candidates=families.get(owner)||[];
   // No unrelated black fallback. If the material has no darker tone, keep its body.
   for(const q of candidates){if(luma(palette[q])>=luma(c)-1)continue;const d=palette[q].reduce((s,v,k)=>s+(v-target[k])**2*weights[k],0);if(d<dist){dist=d;best=q;}}
   id=best;contours[p]=id!==base[p]?255:0;if(contours[p])changed++;
  }
  for(let k=0;k<3;k++)output[p*4+k]=palette[id][k];output[p*4+3]=255;
 }
 return {width:w,height:h,rgba:output,contours,stats:{inputResolution:[width,height],logicalResolution:[w,h],outlinePixels:changed,coveragePixels:coverage.reduce((s,v)=>s+(v>0),0),alphaThreshold,paletteColors:palette.length,interior:'covered average then palette',silhouette:'covered color vote then darker same material ramp'}};
}
export function buildInkFrame(source,options){const intermediate=averageFour(source),plain=resolveInk(intermediate,{...options,outline:false}),ink=resolveInk(intermediate,{...options,outline:true});return {intermediate,plain,ink,stats:{...ink.stats,sourceResolution:[source.width,source.height],renderSamplesPerIntermediatePixel:4,resolveSamplesPerArtPixel:4,maximumSourceSamplesPerArtPixel:16,sampling:'regular 2x SSAA then separate 2x2 resolve; not a path-tracing claim'}};}

export function readSurfaceFrame(renderer){const gl=renderer.gl,w=renderer.canvas.width,h=renderer.canvas.height,color=new Uint8Array(w*h*4),features=new Uint8Array(color.length),rgba=new Uint8ClampedArray(color.length);gl.bindFramebuffer(gl.FRAMEBUFFER,renderer.frameFbo);gl.readBuffer(gl.COLOR_ATTACHMENT0);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,color);gl.readBuffer(gl.COLOR_ATTACHMENT1);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,features);gl.readBuffer(gl.COLOR_ATTACHMENT0);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const a=(y*w+x)*4,b=((h-1-y)*w+x)*4;rgba[b]=features[a+3]?color[a]:0;rgba[b+1]=features[a+3]?color[a+1]:0;rgba[b+2]=features[a+3]?color[a+2]:0;rgba[b+3]=features[a+3];}return {width:w,height:h,rgba};}
