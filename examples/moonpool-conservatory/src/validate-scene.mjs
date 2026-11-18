import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

if(process.argv.length!==3) throw Error('Usage: node src/validate-scene.mjs ADVANCED_RUNTIME_DIRECTORY');
const runtimeRoot=resolve(process.argv[2]);
const importRuntime=file=>import(pathToFileURL(join(runtimeRoot,file)).href);
const [{GaussianRenderer},{decodeSplat,validateGaussians},{cameraBasis},{pixelLayout}]=
  await Promise.all(['renderer.mjs','gaussians.mjs','math.mjs','pixel-display.mjs'].map(importRuntime));

const root = new URL('../',import.meta.url);
const bytes = file=>readFile(new URL(file,root));
const json = async file=>JSON.parse(await bytes(file));
const [manifest,style,scene]=await Promise.all(['manifest.json','style.json','scene.json'].map(json));
const {camera,items,lighting}=scene;
const vector=(v,n)=>Array.isArray(v)&&v.length===n&&v.every(Number.isFinite);
assert(vector(camera.target,3)&&Number.isFinite(camera.pitch)&&Number.isFinite(camera.yaw)&&camera.span>0);
assert(vector(lighting.skyTint,3)&&lighting.lights.length<=4&&typeof lighting.waterReflections==='boolean');
assert(Number.isFinite(lighting.waterLevel)&&lighting.reflectionStrength>0);
for(const light of lighting.lights) {
  assert(vector(light.position,3)&&vector(light.color,3)&&light.intensity>=0);
}
assert(style.pixelArt.palette.length>=1&&style.pixelArt.palette.length<=64);
assert(style.pixelArt.palette.every(c=>/^#[\da-f]{6}$/i.test(c)));
assert.equal(style.pixelArt.ditherStrength,0);
assert.deepEqual(manifest.budgets,style.budgets);

// Call the stock runtime's CPU methods. The texture sink checks dimensions and typed-array
// sizes. It creates no context and performs no WebGL execution.
let biggestTexture=[0,0];
const gl={
  bindTexture(){},
  bindBuffer(){},
  bufferData(){},
  texImage2D(target,level,internal,w,h,border,format,type,data){
    assert.equal(data.length,w*h*4);
    if(w*h>biggestTexture[0]*biggestTexture[1]) biggestTexture=[w,h];
  },
  texSubImage2D(target,level,x,y,w,h,format,type,data){
    assert.equal(data.length,w*h*4);
    assert(data.every(Number.isFinite));
  }
};
const renderer=Object.assign(Object.create(GaussianRenderer.prototype),{
  gl,resources:new Map(),uploads:0,counts:new Int32Array(65536),cursor:new Int32Array(65536),
  waterLevel:lighting.waterLevel
});
const definitions=new Map();
const hashes={};
const instances={};
const materialKind={solid:0, emissive:5, water:1, foliage:4};
for(const def of manifest.assets) {
  assert(!definitions.has(def.id));
  const binary=await bytes(def.file);
  const data=decodeSplat(binary.buffer.slice(binary.byteOffset,binary.byteOffset+binary.byteLength));
  assert.equal(validateGaussians(data),def.gaussianCount);
  renderer.upload(def,data);
  const resource=renderer.resources.get(def.id);
  assert.equal(resource.count,def.gaussianCount);
  assert(resource.cov.every(Number.isFinite));
  for(const row of def.materialRanges) {
    assert.equal(resource.kinds[row.start],materialKind[row.kind]);
    assert.equal(resource.kinds[row.start+row.count-1],materialKind[row.kind]);
  }
  for(const row of def.pixelDetailRanges??[]) {
    assert.equal(resource.details[row.start],1);
    assert.equal(resource.details[row.start+row.count-1],1);
  }
  renderer.setScene([{id:def.id,asset:def.id,position:[1,.7,-2],yaw:1.13,scale:[.76,1.07,.93]}]);
  renderer.updateTransforms();
  renderer.updateDepths(cameraBasis(-.3,.54),1.25);
  assert(renderer.depths.every(Number.isFinite));
  assert.equal(renderer.count,def.gaussianCount);
  definitions.set(def.id,def);
  hashes[def.id]={
    splat:createHash('sha256').update(binary).digest('hex'),
    editable:createHash('sha256').update(await bytes(def.editable)).digest('hex')
  };
  instances[def.id]=0;
}

assert.equal(new Set(items.map(a=>a.id)).size,items.length);
for(const item of items) {
  assert(definitions.has(item.asset)&&vector(item.position,3));
  assert(Number.isFinite(item.yaw??0));
  const scale=Array.isArray(item.scale)?item.scale:Array(3).fill(item.scale??1);
  assert(vector(scale,3)&&scale.every(s=>s>0));
  assert((item.alpha??1)>0&&(item.alpha??1)<=1&&(item.intensity??1)>0);
  instances[item.asset]++;
}
assert(Object.values(instances).every(n=>n>=1));
assert.equal(instances['moonpool-water'],1);
const water=items.find(a=>a.asset==='moonpool-water');
assert.equal(water.position[1],lighting.waterLevel);
const glazing=items.find(a=>a.asset==='glazing-bay');
for(const [cap,itemId] of [['rearRib','rib-rear'],['frontRib','rib-mid']]) {
  const z=definitions.get(glazing.asset).anchors[cap][2];
  const rib=items.find(i=>i.id===itemId);
  assert(Math.abs(glazing.position[2]+z-rib.position[2])<1e-6);
  assert(Math.abs(glazing.position[1]-rib.position[1])<=.021);
}

renderer.setScene(items);
renderer.updateTransforms();
const basis=cameraBasis(camera.yaw,camera.pitch);
const sceneCount=items.reduce((s,a)=>s+definitions.get(a.asset).gaussianCount,0);
assert.equal(renderer.count,sceneCount);
assert(sceneCount<=manifest.budgets.maxSceneGaussians&&sceneCount<300000);
renderer.updateDepths(basis,1.25);
assert(renderer.depths.every(Number.isFinite));
for(const reflection of [false,true]) {
  renderer.sort(reflection,basis.eye[1]);
  const seen=new Uint8Array(sceneCount);
  for(let i=0;i<sceneCount;i++) {
    const index=renderer.order[i];
    assert(!seen[index]);
    seen[index]=1;
    if(i>0) assert(renderer.keys[renderer.order[i-1]]<=renderer.keys[index]);
  }
}
const firstDepths=renderer.depths.slice(), firstWaterY=renderer.worldYs.slice();
renderer.updateDepths(basis,2.25);
const moved={water:0,foliage:0};
for(let i=0;i<sceneCount;i++) {
  const dy=Math.abs(renderer.worldYs[i]-firstWaterY[i]);
  const dd=Math.abs(renderer.depths[i]-firstDepths[i]);
  if(renderer.kind[i]===1) {
    assert(dy<=.02901);
    if(dy>1e-6) moved.water++;
  } else if(renderer.kind[i]===4) {
    if(dd>1e-6) moved.foliage++;
  } else {
    assert.equal(dd,0);
  }
}
assert(moved.water>0&&moved.foliage>0);
console.log(JSON.stringify({
  ok:true, checks:'stock runtime decoder, CPU upload/expansion, transforms, animation and sorting',
  distinctAssets:manifest.assets.length, instances:items.length, gaussians:sceneCount, instancesPerAsset:instances,
  biggestTexture, projectedModelAllocationBytes:renderer.gpuModelBytes, pixelLayout960x720:pixelLayout(960,720,style.pixelArt),
  visiblyUnverifiedByScript:['GPU shader execution','camera controls','real-time frame rate'],
  movedBetween1_25and2_25s:moved, sha256:hashes
},null,2));
