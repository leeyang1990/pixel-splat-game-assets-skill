import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {sampleAdventurerPose,ADVENTURER_ANCHOR_PARTS} from './character-motion.mjs';
import {compose,multiply,pivotTransform,transformPoint} from './math.mjs';
import {buildAdventurer} from './adventurer.mjs';
import {encodeSplat,decodeSplat,gaussianBounds,validateGaussians,covariance} from './gaussians.mjs';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
export async function exportExplorer(){
 const style=JSON.parse(await readFile(resolve(ROOT,'style.json'))),id='weathered-knight';const {data,...meta}=buildAdventurer({id,seed:20261116},style);validateGaussians(data);const binary=encodeSplat(data),decoded=decodeSplat(binary),a=gaussianBounds(data),b=gaussianBounds(decoded);const bounds={min:a.min.map((v,i)=>Math.min(v,b.min[i])-1e-5),max:a.max.map((v,i)=>Math.max(v,b.max[i])+1e-5)};
 const cov=[];for(let i=0;i<data.splats.length;i+=14)cov.push(covariance(data.splats.slice(i+3,i+6),data.splats.slice(i+6,i+10)));const animated={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
 for(const clip of meta.clips)for(let sample=0;sample<61;sample++){const pose=sampleAdventurerPose(clip.duration*sample/60,clip.name);for(const part of meta.parts){const p=pose.parts[part.name],m=multiply(compose(pose.root),pivotTransform(part.pivot,p.rotation,p.translation));for(let i=part.start;i<part.start+part.count;i++){const c=cov[i],point=transformPoint(m,data.splats.slice(i*14,i*14+3));for(let k=0;k<3;k++){const x=m[k*4],y=m[k*4+1],z=m[k*4+2],extent=3*Math.sqrt(Math.max(0,c[0]*x*x+2*c[1]*x*y+2*c[2]*x*z+c[3]*y*y+2*c[4]*y*z+c[5]*z*z));animated.min[k]=Math.min(animated.min[k],point[k]-extent);animated.max[k]=Math.max(animated.max[k],point[k]+extent);}}}}
 meta.animationBounds={min:animated.min.map((v,k)=>Math.min(bounds.min[k],v-.035)),max:animated.max.map((v,k)=>Math.max(bounds.max[k],v+.035))};meta.animationSampling={samplesPerClip:61,padding:.035,scope:'sampled support envelope'};meta.anchorParts=ADVENTURER_ANCHOR_PARTS;
 await writeFile(resolve(ROOT,`assets/${id}.splat`),new Uint8Array(binary));await writeFile(resolve(ROOT,`assets/${id}.gaussians.json`),JSON.stringify(data));
 return{id,type:'character',usage:'actor',seed:20261116,license:'original-procedural-fan-art; see ATTRIBUTION.txt',representation:'gaussian-splat',source:'src/adventurer.mjs',file:`assets/${id}.splat`,editable:`assets/${id}.gaussians.json`,gaussianCount:data.splats.length/14,pivot:[0,0,0],bounds,...meta,material:{kind:'solid',reflect:true,lighting:'world-normal-lighting',normalBasis:'quaternion-local +Z'},materialRanges:[{start:0,count:data.splats.length/14,kind:'solid'}]};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const entry=await exportExplorer();await writeFile(resolve(ROOT,'validation/explorer-definition.json'),JSON.stringify(entry,null,2)+'\n');console.log(entry.id,entry.gaussianCount);}
