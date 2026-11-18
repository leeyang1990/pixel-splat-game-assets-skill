import {normal,fieldUnion,unit,add,mul,dot} from './sdf.mjs';
import {fromNormal,encodeSplat,decodeSplat,gaussianBounds,validateGaussians} from './gaussians.mjs';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const hash=(p,seed)=>{const n=Math.sin(dot(p,[123.37,78.19,211.73])+seed*.013)*43758.5453;return n-Math.floor(n);};
export const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
function shadow(field,p,n,direction,step,maxDistance){let t=step*.8;const start=add(p,mul(n,step*.7));for(let i=0;i<36&&t<maxDistance;i++){const d=field(add(start,mul(direction,t)));if(d<step*.04)return .35;t+=Math.max(step*.4,d*.8);}return 1;}
function occlusion(field,p,n,step){let occupied=0;for(const t of [1.5,3,6,11])if(field(add(p,mul(n,step*t)))<0)occupied++;return 1-occupied*.17;}
/** Surface shells, finite-difference outward normals, positive tangent/normal sigmas.
 * lighting=baked-ramp freezes a local key into RGB; world-ao retains albedo*AO for runtime lighting.
 */
export function sampleSdf(parts,{lighting='world-ao',light=[-.5,.8,.6],maxPoints=100000,maxCells=3000000,shadowDistance=2.5,seed=1711}={}){
 if(!['world-ao','baked-ramp'].includes(lighting))throw Error('Unknown SDF lighting policy');
 if(!Number.isInteger(seed)||!Number.isInteger(maxPoints)||maxPoints<1||!Number.isInteger(maxCells)||maxCells<1)throw Error('Invalid SDF budget or seed');
 let cells=0;for(const p of parts){if(!Number.isFinite(p.spacing)||p.spacing<=0||p.bounds.min.some((v,k)=>!Number.isFinite(v)||!Number.isFinite(p.bounds.max[k])||v>=p.bounds.max[k]))throw Error('Invalid SDF bounds or spacing');cells+=p.bounds.min.reduce((n,v,k)=>n*(Math.ceil((p.bounds.max[k]-v)/p.spacing)+1),1);if(cells>maxCells)throw Error('SDF cell budget exceeded');if(!Array.isArray(p.material.ramp)||!p.material.ramp.length||p.material.ramp.some(c=>!/^#[a-f0-9]{6}$/i.test(c)))throw Error('Invalid material ramp');}
 const begun=performance.now(),whole=fieldUnion(parts),key=unit(light),records=[],ranges=[],detailRanges=[],proof={method:'direct SDF surface projection; no mesh',lighting,seed,candidates:0,points:0,maxResidual:0,normalChecks:0,seconds:0,projectionFailures:0};
 for(const part of parts){
  const step=part.spacing,ramp=part.material.ramp.map(rgb);const used=new Set(),start=records.length/14;
  for(let z=part.bounds.min[2]+step*.5;z<=part.bounds.max[2];z+=step)for(let y=part.bounds.min[1]+step*.5;y<=part.bounds.max[1];y+=step)for(let x=part.bounds.min[0]+step*.5;x<=part.bounds.max[0];x+=step){
   let p=[x,y,z],d=part.field(p);proof.candidates++;if(!Number.isFinite(d)||Math.abs(d)>step*.9)continue;
   for(let i=0;i<7&&Math.abs(d)>step*.005;i++){const e=step*.04,g=[0,1,2].map(k=>{const a=[...p],b=[...p];a[k]+=e;b[k]-=e;return (part.field(a)-part.field(b))/(2*e);}),length=dot(g,g);if(length<1e-12)break;const travel=clamp(d/length,-step*2,step*2);p=p.map((v,k)=>v-g[k]*travel);d=part.field(p);}
   if(!Number.isFinite(d)||Math.abs(d)>step*.08){proof.projectionFailures++;continue;}
   const n=normal(part.field,p,step*.04);if(whole(add(p,mul(n,step*.35)))<-step*.12)continue;
   const cell=p.map(v=>Math.round(v/(step*.65))).join(',');if(used.has(cell))continue;used.add(cell);
   const ao=occlusion(whole,p,n,step),material=part.material;let color;
   if(lighting==='world-ao')color=ramp.at(-1).map(v=>v*(.35+.65*ao));
   else{const value=clamp((.30+.70*Math.max(0,dot(n,key)))*shadow(whole,p,n,key,step,shadowDistance)*ao+(hash(p,seed)-.5)*.08),index=Math.round(value*(ramp.length-1));color=ramp[material.emission?Math.max(index,ramp.length-2):index];}
   const q=fromNormal(n),sigma=step*.72;records.push(...p,sigma,sigma,Math.max(.00045,step*.09),...q,...color,.98);
   proof.maxResidual=Math.max(proof.maxResidual,Math.abs(d));proof.normalChecks++;if(records.length/14>maxPoints)throw Error('SDF point budget exceeded');
  }
  const count=records.length/14-start;if(count){ranges.push({start,count,kind:part.material.kind||'solid'});if(part.material.pixelDetail)detailRanges.push({start,count});}
 }
 proof.points=records.length/14;proof.seconds=(performance.now()-begun)/1000;
 const data={version:1,type:'gaussian-splats',stride:14,splats:records};validateGaussians(data);return {data,materialRanges:ranges,pixelDetailRanges:detailRanges,proof};
}
export function assetRecord(id,result,source='src/generate.mjs'){
 const binary=encodeSplat(result.data),decoded=decodeSplat(binary),a=gaussianBounds(result.data),b=gaussianBounds(decoded),bounds={min:a.min.map((v,k)=>Math.min(v,b.min[k])-1e-5),max:a.max.map((v,k)=>Math.max(v,b.max[k])+1e-5)};
 const entry={id,type:'prop',usage:'decoration',seed:result.proof.seed,license:'CC0-1.0',representation:'gaussian-splat',source,file:`assets/${id}.splat`,editable:`assets/${id}.gaussians.json`,gaussianCount:result.proof.points,pivot:[0,0,0],bounds,anchors:{base:[0,0,0]},colliders:[],material:{kind:'solid',reflect:true,lighting:result.proof.lighting==='world-ao'?'sdf-local-occlusion-plus-world-light':'baked-sdf-ramp',normalBasis:'quaternion-local +Z'},materialRanges:result.materialRanges,authoring:result.proof};
 if(result.pixelDetailRanges.length)entry.pixelDetailRanges=result.pixelDetailRanges;return {entry,binary};
}
