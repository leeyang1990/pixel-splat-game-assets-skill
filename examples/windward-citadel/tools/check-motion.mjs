import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {covariance,decodeSplat} from '../src/gaussians.mjs';
import {ADVENTURER_CLIPS,ADVENTURER_RIG,sampleAdventurerPose} from '../src/character-motion.mjs';
import {PARTICLE_EFFECTS,PARTICLE_KINDS,sampleParticle} from '../src/particle-motion.mjs';
import {compose,multiply,pivotTransform,transformPoint} from '../src/math.mjs';
import {samplePerformance} from '../src/scene-motion.mjs';

const read=path=>readFile(new URL('../'+path,import.meta.url));
const manifest=JSON.parse(await read('manifest.json'));
async function load(asset){
 const binary=await read(asset.file);
 return decodeSplat(binary.buffer.slice(binary.byteOffset,binary.byteOffset+binary.byteLength)).splats;
}
function within(point,extent,bounds){
 for(let axis=0;axis<3;axis++){
  assert.ok(point[axis]-extent[axis]>=bounds.min[axis]-1e-5,`lower axis ${axis}`);
  assert.ok(point[axis]+extent[axis]<=bounds.max[axis]+1e-5,`upper axis ${axis}`);
 }
}
const particles=[];
for(const asset of manifest.assets){
 const settings=PARTICLE_EFFECTS[asset.material?.kind];
 if(!settings)continue;
 const data=await load(asset),kind=PARTICLE_KINDS[asset.material.kind];
 assert.equal(asset.clips[0].duration,settings.duration);
 for(let record=0;record<data.length/14;record++){
  const offset=record*14,phase=Math.fround((record*.61803398875%1)*Math.PI*2);
  const p=data.slice(offset,offset+3),scale=data.slice(offset+3,offset+6);
  const c=covariance(scale,data.slice(offset+6,offset+10));
  for(let step=0;step<=96;step++){
   const time=settings.duration*step/96, [dx,dy,dz,alpha]=sampleParticle(kind,time,phase);
   assert.ok(alpha>=0&&alpha<=1+1e-9);
   const angle=settings.tumble?1.23*Math.sin(time*2*Math.PI/settings.duration+phase):0;
   const cos=Math.cos(angle),sin=Math.sin(angle);
   const radius=[cos*cos*c[0]-2*cos*sin*c[1]+sin*sin*c[3],sin*sin*c[0]+2*cos*sin*c[1]+cos*cos*c[3],c[5]].map(v=>3*Math.sqrt(v));
   within([p[0]+dx,p[1]+dy,p[2]+dz],radius,asset.animationBounds);
  }
  if(settings.tumble||asset.material.kind==='rising-ember'){
   const seam=(1-phase/(2*Math.PI))*settings.duration;
   assert.ok(sampleParticle(kind,seam-1e-6,phase)[3]<.00001);
   assert.ok(sampleParticle(kind,seam+1e-6,phase)[3]<.00001);
  }
 }
 particles.push({asset:asset.id,records:asset.gaussianCount,samplesPerRecord:97});
}
assert.equal(particles.length,3);

const actor=manifest.assets.find(a=>a.id==='weathered-knight'),data=await load(actor);
const cov=Array.from({length:actor.gaussianCount},(_,i)=>covariance(data.slice(i*14+3,i*14+6),data.slice(i*14+6,i*14+10)));
for(const clip of ADVENTURER_CLIPS){
 for(let sample=0;sample<=30;sample++){
  const {root,parts}=sampleAdventurerPose(clip.duration*sample/30,clip.name);
  for(const part of actor.parts){
   const p=parts[part.name],m=multiply(compose(root),pivotTransform(part.pivot,p.rotation,p.translation));
   for(let i=part.start;i<part.start+part.count;i++){
    const c=cov[i],p=transformPoint(m,data.slice(i*14,i*14+3));
    const extent=[0,1,2].map(axis=>{
     const a=axis*4,x=m[a],y=m[a+1],z=m[a+2];
     return 3*Math.sqrt(Math.max(0,c[0]*x*x+2*c[1]*x*y+2*c[2]*x*z+c[3]*y*y+2*c[4]*y*z+c[5]*z*z));
    });
    within(p,extent,actor.animationBounds);
   }
  }
  const arm=parts.rightUpperArm,elbow=parts.rightForearm;
  const m=pivotTransform(ADVENTURER_RIG.rightUpperArm,arm.rotation,arm.translation);
  const pivot=ADVENTURER_RIG.rightForearm,tip=transformPoint(m,pivot);
  assert.ok(Math.hypot(...tip.map((v,i)=>v-pivot[i]-elbow.translation[i]))<1e-8);
 }
}
const base=[.24,-.15,5.46],yaw=Math.PI-.26;
assert.ok(samplePerformance('walk',3,base,yaw,true).position[2]<base[2]-1);
assert.equal(samplePerformance('inspect-light',.85,base,yaw,true).pulse,0);
assert.ok(samplePerformance('inspect-light',1.61,base,yaw,true).pulse>.95);
assert.equal(samplePerformance('inspect-light',2.8,base,yaw,true).complete,true);
console.log(JSON.stringify({ok:true,particles,decodedActorRecords:actor.gaussianCount,clips:ADVENTURER_CLIPS.map(c=>c.name),armPivotContinuity:true,patrolAndLightCue:true},null,2));
