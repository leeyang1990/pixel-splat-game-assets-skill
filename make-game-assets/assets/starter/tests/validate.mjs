import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {generateAsset,specifications} from '../src/generate.mjs';
import {covariance,fromNormal,encodeSplat,decodeSplat,gaussianBounds,validateGaussians} from '../src/gaussians.mjs';
import {createScene,runBehaviorChecks} from '../src/interaction.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),read=async p=>JSON.parse(await readFile(resolve(root,p),'utf8'));
const manifest=await read('manifest.json'),style=await read('style.json'),results=[];
const near=(a,b,tol=1e-5)=>assert.ok(Math.abs(a-b)<=tol,`${a} != ${b}`);
assert.equal(manifest.version,2);assert.equal(manifest.pipeline,'pixel-gaussian-splat');
for(const spec of manifest.assets){
 const definition=manifest.assets.find(a=>a.id===spec.id),stored=await read(definition.editable),generated=generateAsset(spec,style);
 assert.deepEqual(generated,stored);generateAsset(specifications().at(-1),style);assert.deepEqual(generateAsset(spec,style),stored);
 const count=validateGaussians(stored);assert.equal(count,definition.gaussianCount);assert.equal(definition.representation,'gaussian-splat');
 const bytes=await readFile(resolve(root,definition.file));assert.equal(bytes.length,count*32);assert.ok(bytes.equals(Buffer.from(encodeSplat(generated))));
 const buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),decoded=decodeSplat(buffer);assert.equal(validateGaussians(decoded),count);
 for(let i=0;i<stored.splats.length;i+=14){
  for(let j=0;j<6;j++)near(stored.splats[i+j],decoded.splats[i+j]);
  for(let j=10;j<14;j++)near(stored.splats[i+j],decoded.splats[i+j],1/255);
  const dot=stored.splats.slice(i+6,i+10).reduce((s,v,j)=>s+v*decoded.splats[i+6+j],0);assert.ok(Math.abs(dot)>.9998);
 }
 for(const data of [stored,decoded]){const b=gaussianBounds(data);for(let j=0;j<3;j++){assert.ok(b.min[j]>=definition.bounds.min[j]-1e-6);assert.ok(b.max[j]<=definition.bounds.max[j]+1e-6);}}
 results.push({name:`${spec.id}: 生成确定、真实高斯字段、.splat 往返与三倍标准差范围`,ok:true,gaussians:count});
}
// Independent known answers verify scale convention, quaternion order and covariance.
const iso=covariance([.2,.2,.2],[0,0,0,1]);[.04,0,0,.04,0,.04].forEach((v,i)=>near(iso[i],v));
const turn=covariance([2,1,.5],[0,0,Math.SQRT1_2,Math.SQRT1_2]);[1,0,0,4,0,.25].forEach((v,i)=>near(turn[i],v));
for(const n of [[0,1,0],[1,0,0],[0,0,-1]]){const [x,y,z,w]=fromNormal(n);[2*(x*z+y*w),2*(y*z-x*w),1-2*(x*x+y*y)].forEach((v,i)=>near(v,n[i]));}
const known={version:1,type:'gaussian-splats',stride:14,splats:[1,2,3,.1,.2,.3,0,0,0,1,1,0,.5,1]},bytes=new DataView(encodeSplat(known));
near(bytes.getFloat32(12,true),.1);assert.deepEqual([24,25,26,27].map(i=>bytes.getUint8(i)),[255,0,128,255]);assert.deepEqual([28,29,30,31].map(i=>bytes.getUint8(i)),[255,128,128,128]);
assert.throws(()=>decodeSplat(new ArrayBuffer(31)));assert.throws(()=>validateGaussians({...known,splats:[...known.splats.slice(0,3),-1,...known.splats.slice(4)]}));
const faint=structuredClone(known);faint.splats[13]=.0001;assert.equal(new DataView(encodeSplat(faint)).getUint8(27),1);
results.push({name:'协方差、旋转、线性标准差、32字节布局及非法数据',ok:true});
const original=generateAsset(specifications()[3],style),small=generateAsset({...specifications()[3],scale:.65},style);
for(let i=0;i<original.splats.length;i+=14)for(let j=0;j<14;j++)near(small.splats[i+j],original.splats[i+j]*(j<6?.65:1));
results.push({name:'参数变体同步缩放位置与三维标准差，保留旋转与颜色',ok:true});
const terrainDef=manifest.assets.find(a=>a.type==='terrain');
if(terrainDef){
const terrain=await read(terrainDef.editable),top=[];
for(let i=0;i<terrain.splats.length;i+=14)if(terrain.splats[i+1]===0)top.push(terrain.splats.slice(i,i+14));
assert.equal(top.length,196);
for(const axis of [0,2])for(let row=0;row<14;row++){
 const other=axis===0?2:0,cells=top.filter(p=>Math.abs(p[other]-(-.5+(row+.5)/14))<1e-6).sort((a,b)=>a[axis]-b[axis]);assert.equal(cells.length,14);
 for(let i=1;i<14;i++)near(cells[i][axis]-cells[i-1][axis],1/14);
 near(cells[0][axis]+1-cells.at(-1)[axis],1/14);assert.ok(cells[0][3]*3>1/14);
}
results.push({name:'地形中心高度、跨格高斯采样间距与覆盖连续',ok:true});
}
let sceneReport={assetDefinitions:manifest.assets.length};
if(['grass-meadow','crate-oak','pickup-ember','tree-canopy','arch-moss','tree-canopy-small'].every(id=>{const a=manifest.assets.find(a=>a.id===id);return a&&(a.scale??1)===(id==='tree-canopy-small'?.65:1);})){
const behavior=runBehaviorChecks(manifest.assets);for(const check of behavior)assert.ok(check.ok,check.name);results.push(...behavior);
const scene=createScene(manifest.assets),count=id=>manifest.assets.find(a=>a.id===id).gaussianCount;
const total=scene.tiles.length*count('grass-meadow')+scene.crates.length*count('crate-oak')+scene.pickups.length*count('pickup-ember')+3*count('tree-canopy')+count('tree-canopy-small')+count('arch-moss');
assert.ok(total<=manifest.budgets.maxSceneGaussians);
sceneReport={assetDefinitions:manifest.assets.length,assetInstances:121,visibleAssetGaussians:total,maxSceneGaussians:manifest.budgets.maxSceneGaussians};
}
const report={ok:true,results,scene:sceneReport,note:'结构、交换格式与逻辑检查；浏览器与性能需独立验证。'};
await mkdir(resolve(root,'validation'),{recursive:true});await writeFile(resolve(root,'validation/source-checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
