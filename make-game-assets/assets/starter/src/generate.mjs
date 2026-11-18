// Procedural surface authoring -> anisotropic 3D Gaussians -> editable JSON + .splat.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {fromNormal,gaussianBounds,encodeSplat,decodeSplat,validateGaussians} from './gaussians.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
export const PACK_SEED=92741;
export function randomFor(id,variantSeed=0){let n=(PACK_SEED^variantSeed)>>>0;for(const c of id)n=Math.imul(n^c.charCodeAt(0),16777619)>>>0;return()=>{n+=0x6d2b79f5;let t=n;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
export function generateAsset(spec,style){
 const rand=randomFor(spec.id,spec.seed),splats=[],pal=style.palette;
 const colors=name=>(pal[name]||pal.grass).map(rgb),pick=a=>a[Math.floor(rand()*a.length)];
 function add(x,y,z,n,color,s=.035,alpha=.96,aspect=1){
  const len=Math.hypot(...n),normal=n.map(v=>v/len),light=.58+.42*Math.max(0,normal[0]*-.46+normal[1]*.8+normal[2]*.38),band=Math.round(light*5)/5;
  splats.push(x,y,z,s,s*aspect,s*.20,...fromNormal(normal),...color.map(c=>Math.min(1,c*band)),alpha);
 }
 function box(cx,cy,cz,sx,sy,sz,spacing,palette){
  for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
   const u=(axis+1)%3,v=(axis+2)%3,dim=[sx,sy,sz],nu=Math.ceil(dim[u]/spacing),nv=Math.ceil(dim[v]/spacing);
   for(let a=0;a<nu;a++)for(let b=0;b<nv;b++){
    const p=[cx,cy,cz],n=[0,0,0];p[axis]+=sign*dim[axis]/2;p[u]+=((a+.5)/nu-.5)*dim[u];p[v]+=((b+.5)/nv-.5)*dim[v];n[axis]=sign;
    add(...p,n,pick(palette),spacing*.64);
   }
  }
 }
 function ball(cx,cy,cz,rx,ry,rz,count,palette,s=.045){
  for(let i=0;i<count;i++){
   const y=rand()*2-1,a=rand()*Math.PI*2,r=Math.sqrt(1-y*y),x=Math.cos(a)*r,z=Math.sin(a)*r;
   const lump=1+.05*Math.sin(x*9+y*6)*Math.sin(z*10-y*4);
   const shade=Math.max(0,Math.min(palette.length-1,Math.floor((y*.6-x*.4+Math.sin(x*5+z*4)*.3+1)*palette.length*.45)));
   add(cx+x*rx*lump,cy+y*ry*lump,cz+z*rz*lump,[x/rx,y/ry,z/rz],palette[shade],s*(.85+rand()*.3));
  }
 }
 function trunk(x,z,h,r){
  const palette=colors('oak');for(let i=0;i<420;i++){const a=rand()*Math.PI*2,y=rand()*h,rr=r*(1-y/h*.28);add(x+Math.cos(a)*rr,y,z+Math.sin(a)*rr,[Math.cos(a),0,Math.sin(a)],pick(palette),.034);}
 }
 if(spec.type==='terrain'){
  const n=14,p=1/n,grass=colors('grass'),soil=colors('soil');
  for(let x=0;x<n;x++)for(let z=0;z<n;z++){const shade=rand()<.13?2:1;add(-.5+(x+.5)*p,0,-.5+(z+.5)*p,[0,1,0],grass[shade],p*.72,.99);}
  for(let side=0;side<4;side++)for(let j=0;j<n;j++)for(let row=0;row<2;row++){
   const a=-.5+(j+.5)*p,normal=[[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]][side];
   add(side<2?normal[0]*.5:a,-.05-row*.07,side<2?a:normal[2]*.5,normal,pick(soil),p*.65);
  }
 }else if(spec.type==='prop'){
  const n=15,p=.75/n,wood=colors('oak'),brace=colors('brace'),iron=colors('iron');
  for(let axis=0;axis<3;axis++)for(const sign of [-1,1])for(let a=0;a<n;a++)for(let b=0;b<n;b++){
   const u=(axis+1)%3,v=(axis+2)%3,q=[0,.375,0],normal=[0,0,0];normal[axis]=sign;q[axis]+=.375*sign;q[u]+=((a+.5)/n-.5)*.75;q[v]+=((b+.5)/n-.5)*.75;
   let color=wood[Math.min(3,Math.floor(b/4))];if(a<2||a>12||b<2||b>12||Math.abs(a-b)<1)color=brace[(Math.floor(a/5)+Math.floor(b/5))%brace.length];if((a===1||a===13)&&(b===1||b===13))color=pick(iron);
   add(...q,normal,color,p*.65,.99);
  }
 }else if(spec.type==='pickup'){
  const palette=colors('crystal');
  for(let side=0;side<2;side++)for(let face=0;face<4;face++)for(let i=0;i<90;i++){
   const a=rand(),b=rand(),u=Math.min(a,b),v=Math.max(a,b),tip=[0,side===0?.64:.07,0],angles=[face*Math.PI/2,(face+1)*Math.PI/2],left=[Math.cos(angles[0])*.19,.32,Math.sin(angles[0])*.19],right=[Math.cos(angles[1])*.19,.32,Math.sin(angles[1])*.19];
   const p=tip.map((t,j)=>t*(1-v)+left[j]*u+right[j]*(v-u)),n=[Math.cos((face+.5)*Math.PI/2),side===0?.8:-.8,Math.sin((face+.5)*Math.PI/2)];
   add(...p,n,palette[(face+side)%palette.length],.025,.93);
  }
 }else if(spec.type==='foliage'){
  const leaves=colors('leaves');trunk(0,0,1.7,.12);
  for(const [x,y,z,rx,ry,rz] of [[-.35,1.73,.12,.57,.38,.48],[.35,1.82,.10,.60,.40,.50],[0,2.13,-.12,.64,.43,.52],[-.48,2.04,-.22,.43,.32,.39],[.43,2.20,-.23,.46,.32,.40],[0,1.64,.40,.48,.32,.40]])ball(x,y,z,rx,ry,rz,360,leaves,.048);
  for(let i=0;i<5;i++){const a=i*1.256;ball(Math.cos(a)*.18,.06,Math.sin(a)*.18,.20,.06,.09,55,colors('oak'),.025);}
 }else if(spec.type==='building'){
  const stone=colors('stone'),moss=colors('leaves');
  for(const side of [-1,1])for(let row=0;row<4;row++)box(side*.65,.14+row*.28,0,.33,.265,.38,.075,stone);
  for(let segment=0;segment<9;segment++){
   const a0=segment*Math.PI/9+.012,a1=(segment+1)*Math.PI/9-.012;
   for(let i=0;i<180;i++){
    const a=a0+rand()*(a1-a0),face=Math.floor(rand()*4),r=face===0?.49:face===1?.82:.49+rand()*.33,z=face<2?(rand()-.5)*.39:(face===2?-.195:.195),normal=face<2?[Math.cos(a)*(face===0?-1:1),Math.sin(a)*(face===0?-1:1),0]:[0,0,face===2?-1:1];
    add(Math.cos(a)*r,1.12+Math.sin(a)*r,z,normal,pick(stone),.044,.98);
   }
   if(segment>0&&segment<8){const a=(a0+a1)*.5;ball(Math.cos(a)*.83,1.12+Math.sin(a)*.83,0,.13,.055,.22,65,moss,.030);}
  }
 }else throw Error(`No Gaussian builder for ${spec.type}`);
 const scale=spec.scale??1;if(!(scale>0))throw Error('Asset scale must be positive');
 if(scale!==1)for(let i=0;i<splats.length;i+=14)for(let j=0;j<6;j++)splats[i+j]*=scale;
 const data={version:1,type:'gaussian-splats',stride:14,splats};validateGaussians(data);return data;
}
export function specifications(){return[
 {id:'grass-meadow',type:'terrain',usage:'walkable',seed:11,label:'草地 · 苔绿'},
 {id:'crate-oak',type:'prop',usage:'static-obstacle',seed:31,label:'木箱 · 蜂蜜橡木'},
 {id:'pickup-ember',type:'pickup',usage:'trigger',seed:51,label:'晶体 · 琥珀微光'},
 {id:'tree-canopy',type:'foliage',usage:'decoration',seed:71,label:'树木 · 层叠树冠'},
 {id:'arch-moss',type:'building',usage:'decoration',seed:91,label:'建筑 · 苔石拱门'},
 {id:'tree-canopy-small',type:'foliage',usage:'decoration',seed:72,scale:.65,label:'变体 · 幼树'}
];}
export async function generatePack(specs=specifications()){
 const style=JSON.parse(await readFile(resolve(root,'style.json'),'utf8')),assets=[];await mkdir(resolve(root,'assets'),{recursive:true});
 for(const spec of specs){
  const data=generateAsset(spec,style),file=`assets/${spec.id}.splat`,editable=`assets/${spec.id}.gaussians.json`,count=data.splats.length/14;
  const binary=encodeSplat(data),aBounds=gaussianBounds(data),bBounds=gaussianBounds(decodeSplat(binary)),bounds={min:aBounds.min.map((v,i)=>Math.min(v,bBounds.min[i])-1e-5),max:aBounds.max.map((v,i)=>Math.max(v,bBounds.max[i])+1e-5)};
  const asset={...spec,representation:'gaussian-splat',file,editable,source:'src/generate.mjs',pivot:[0,0,0],bounds,gaussianCount:count,license:'original',anchors:{base:[0,0,0]}};
  if(spec.type==='prop'){const s=spec.scale??1;asset.colliders=[{shape:'box',center:[0,.375*s,0],size:[.75*s,.75*s,.75*s]}];}
  if(spec.type==='pickup'){asset.trigger={shape:'circle-xz',radius:.34};asset.clips=[{name:'idle',duration:2.4,loop:true},{name:'collect',duration:.45,loop:false,events:[{name:'consume',time:0}]}];asset.animationAdapter='src/interaction.mjs';asset.animationBounds={min:[-.6,-.1,-.6],max:[.6,1.3,.6]};}
  await writeFile(resolve(root,editable),JSON.stringify(data));await writeFile(resolve(root,file),new Uint8Array(binary));assets.push(asset);
 }
 const manifest={version:2,pipeline:'pixel-gaussian-splat',pack:'moss-ember-gaussian-kit',units:{up:'+Y',forward:'+Z',tile:1},seed:PACK_SEED,style:'style.json',budgets:{maxGaussiansPerAsset:8000,maxSceneGaussians:100000},renderer:{implementation:'src/renderer.mjs',projection:'orthographic',covariance:'anisotropic-3d',falloff:'gaussian',sorting:'global-back-to-front',pixelPass:'low-resolution-palette-bayer-nearest'},assets};
 await writeFile(resolve(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');return manifest;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){let specs=specifications();if(process.argv[2]){const plan=JSON.parse(await readFile(resolve(process.argv[2]),'utf8'));specs=Array.isArray(plan)?plan:plan.assets;if(!Array.isArray(specs))throw Error('Asset plan must contain an assets array');}const m=await generatePack(specs);console.log(`Generated ${m.assets.length} Gaussian assets, ${m.assets.reduce((n,a)=>n+a.gaussianCount,0)} Gaussians; .splat + editable JSON.`);}
