import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {encodeSplat,decodeSplat,gaussianBounds,fromNormal} from './gaussians.mjs';
import {PARTICLE_EFFECTS} from './particle-motion.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));let seed=81721;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const g=(p,s,c,a,n=[0,0,1])=>[...p,...s,...fromNormal(n),...c,a];
async function save(id,rows,kind,animated=false){const data={version:1,type:'gaussian-splats',stride:14,splats:rows.flat()},binary=encodeSplat(data),decoded=decodeSplat(binary),a=gaussianBounds(data),b=gaussianBounds(decoded),bounds={min:a.min.map((v,k)=>Math.min(v,b.min[k])-1e-5),max:a.max.map((v,k)=>Math.max(v,b.max[k])+1e-5)};
 await writeFile(root+`assets/${id}.splat`,new Uint8Array(binary));await writeFile(root+`assets/${id}.gaussians.json`,JSON.stringify(data));
 const entry={id,type:'vfx',usage:'effect',license:'original-procedural-fan-art; see ATTRIBUTION.txt',seed:81721,representation:'gaussian-splat',source:'src/generate-effects.mjs',file:`assets/${id}.splat`,editable:`assets/${id}.gaussians.json`,gaussianCount:rows.length,pivot:[0,0,0],bounds,anchors:{base:[0,0,0]},colliders:[],material:{kind,reflect:false,lighting:'prelit-volumetric'},materialRanges:[{start:0,count:rows.length,kind}]};
 const effect = PARTICLE_EFFECTS[kind];
 if (effect) {
  // A rotated anisotropic leaf can project farther on every axis than its rest support.
  const rotationPad = effect.tumble ? 3*Math.max(...rows.map(row=>Math.max(...row.slice(3,6)))) : 0;
  entry.animationBounds = {
   min:bounds.min.map((v,i)=>v-effect.padding[i]-rotationPad),
   max:bounds.max.map((v,i)=>v+effect.padding[i]+rotationPad),
  };
  entry.clips=[{name:effect.name,duration:effect.duration,loop:true,file:'src/particle-motion.mjs'}];
  entry.anchors.emitter=[0,0,0];
 } else if(animated)entry.animationBounds={min:bounds.min.map(v=>v-.12),max:bounds.max.map(v=>v+.12)};
 if(kind==='falling-leaf'||kind==='rising-ember')entry.pixelDetailRanges=[{start:0,count:rows.length}];
 return entry;
}

let rows=[];
for(let i=0;i<70;i++){const a=random()*Math.PI*2,r=Math.sqrt(random())*5.0;rows.push(g([Math.cos(a)*r,random()*.4,Math.sin(a)*r*.48],[.7+random()*.9,.09+random()*.10,.45+random()*.65],[.13,.22,.24],.035));}
const extras=[await save('cliff-mist',rows,'flow-mist')];rows=[];
for(let i=0;i<95;i++){const t=i/94,a=t*Math.PI*6;rows.push(g([Math.sin(a)*.07*(1-t),t*.68,Math.cos(a)*.07*(1-t)],[.020+.018*(1-t),.040,.025],[1.,.78+.1*t,.34+.16*t],.17*(1-t*.7)));}
rows.push(g([0,.10,0],[.26,.18,.26],[1,.67,.20],.09));extras.push(await save('golden-grace-halo',rows,'beam',true));rows=[];
// Seed leaves in pockets along an emitter instead of filling the entire frame with noise.
for (const [x,y,z,count] of [[-1.44,1.12,-.28,39],[-.32,.60,.39,43],[.71,.05,.70,27]]) {
 for (let i=0;i<count;i++) {
  const size=.017+random()*.023, amber=random();
  rows.push(g([x+(random()-.5)*1.21,y+(random()-.5)*.77,z+(random()-.5)*.65],
   [size*.64,size,.005+.003*random()],[.79+amber*.21,.50+amber*.34,.18+amber*.16],.49+random()*.45,[random()-.5,.2,1]));
 }
}
extras.push(await save('drifting-golden-leaves',rows,'falling-leaf'));
rows=[];
// This volume starts at the fire. Instances can also use it for lamps and furnaces.
for (let i=0;i<48;i++) {
 const angle=random()*Math.PI*2, radius=.13*Math.sqrt(random()), size=.013+random()*.017;
 rows.push(g([radius*Math.cos(angle),.07+random()*.26,radius*Math.sin(angle)],
  [size*.62,size*1.15,size*.61],[1.,.43+random()*.43,.13+random()*.20],.53+random()*.43));
}
extras.push(await save('rising-embers',rows,'rising-ember'));
rows=[];
for(let y=.06;y<3.29;y+=.076){const w=y<1.94?.78:Math.max(0,Math.sqrt(Math.max(0,4*.78*.78-(y-1.94)**2))-.78);for(let x=-w+.035;x<w;x+=.075){const light=.46+.50*Math.exp(-((x+.24-.15*Math.sin(y*2.7))**2)*3-y*.42);const stream=.85+.15*Math.sin(y*4+x*5);rows.push(g([x,y,Math.sin(x*3+y*.8)*.07],[.070,.12,.070],[light*stream,.77*light,.39*light],.13));}}
extras.push(await save('golden-gate-mist',rows,'beam',true));
rows=[];for(let i=0;i<42;i++){const x=(random()-.5)*17,y=(random()-.5)*7;rows.push(g([x,y,(random()-.5)*1.3],[1.1+random()*1.6,.35+random()*.6,.65],[.16,.25,.26],.17));}extras.push(await save('storm-cloud-haze',rows,'emissive'));
rows=[];
for(let i=0;i<18;i++){const t=(i+.5)/18,a=i*2.39996;rows.push(g([Math.cos(a)*2.8*Math.sqrt(t),Math.sin(a)*1.7*Math.sqrt(t),-.10*t],[1.44,.76,.46],[.33,.26,.11],.046));}
extras.push(await save('golden-tree-haze',rows,'emissive'));
const m=JSON.parse(await readFile(root+'manifest.json'));for(const e of extras)m.assets=[...m.assets.filter(x=>x.id!==e.id),e];await writeFile(root+'manifest.json',JSON.stringify(m,null,2)+'\n');console.log(extras.map(e=>[e.id,e.gaussianCount]));
