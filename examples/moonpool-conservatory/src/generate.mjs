import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {Asset} from './geometry.mjs';
import {encodeSplat,decodeSplat,gaussianBounds,validateGaussians} from './gaussians.mjs';
import {tideArch,brokenArch,roofBay,tideGauge} from './architecture.mjs';
import {basin,bank,water} from './terrain.mjs';
import {lanternBloom,indigoFronds} from './plants.mjs';

const root=new URL('../',import.meta.url);
const style=JSON.parse(await readFile(new URL('style.json',root),'utf8'));
const write=(path,data)=>writeFile(new URL(path,root),data);
const box=(center,size)=>({shape:'box',center,size});
const footAnchors={westFoot:[-3.53,0,0],eastFoot:[3.53,0,0]};
const footColliders=[box([-3.53,.52,0],[.66,1.08,.62]),box([3.53,.52,0],[.66,1.08,.62])];
const profiles=[
  {
    id:'tide-arch', build:tideArch, file:'architecture', type:'building', usage:'vault-rib',
    anchors:{...footAnchors,crown:[0,4.91,0],rearBay:[0,0,-1.5],frontBay:[0,0,1.5]},
    colliders:footColliders
  },
  {
    id:'broken-arch', build:brokenArch, file:'architecture', type:'building', usage:'damaged-vault-rib',
    anchors:footAnchors, colliders:footColliders
  },
  {
    id:'glazing-bay', build:roofBay, file:'architecture', type:'building', usage:'partial-roof-connector',
    anchors:{rearRib:[0,0,-1.5],frontRib:[0,0,1.5]}
  },
  {
    id:'basalt-bank', build:bank, file:'terrain', type:'terrain', usage:'top-origin-shore-module',
    anchors:{walkTop:[0,0,0],leftJoin:[-1.29,-.064,0],rightJoin:[1.29,-.064,0]},
    colliders:[box([-.02,-.32,-.072],[2.42,.62,.76])]
  },
  {
    id:'drowned-basin', build:basin, file:'terrain', type:'terrain', usage:'shallow-basin-foundation',
    anchors:{waterDatum:[0,.205,0],floorDatum:[0,-.25,0]}
  },
  {
    id:'moonpool-water', build:water, file:'terrain', type:'vfx', usage:'horizontal-water-patch',
    material:{kind:'water',reflect:false}, animation:{axis:1,margin:.0145},
    anchors:{surface:[0,0,0]}
  },
  {
    id:'lantern-bloom', build:lanternBloom, file:'plants', type:'foliage', usage:'luminous-tall-waterside-cluster',
    anchors:{base:[0,0,0],upperFlower:[.300,1.46,.077]}, animation:{axis:0,margin:.018}
  },
  {
    id:'indigo-fronds', build:indigoFronds, file:'plants', type:'foliage', usage:'low-violet-waterside-cluster',
    anchors:{base:[0,0,0]}, animation:{axis:0,margin:.018}
  },
  {
    id:'tide-gauge', build:tideGauge, file:'architecture', type:'prop', usage:'observatory-plinth',
    anchors:{base:[0,0,0],gem:[0,1.788,0]},
    colliders:[box([0,.52,0],[.88,1.10,.71])]
  }
];

const formatBounds=(source,decoded)=>({
  min:source.min.map((v,i)=>Math.floor(Math.min(v,decoded.min[i])*1e5)/1e5),
  max:source.max.map((v,i)=>Math.ceil(Math.max(v,decoded.max[i])*1e5)/1e5)
});
function exportData(asset) {
  const splats=[],materialRanges=[],pixelDetailRanges=[];
  for(const {kind,detail,records} of asset.buckets.values()) {
    const start=splats.length/14, count=records.length/14;
    for(const value of records) splats.push(value);
    materialRanges.push({start,count,kind});
    if(detail) pixelDetailRanges.push({start,count});
  }
  return {data:{version:1,type:'gaussian-splats',stride:14,splats},materialRanges,pixelDetailRanges};
}
async function exportAsset({id,build,file,animation,material={kind:'solid'},...metadata}) {
  const asset=new Asset(id);
  build(asset,style.colors);
  const {data,materialRanges,pixelDetailRanges}=exportData(asset);
  const gaussianCount=validateGaussians(data);
  const buffer=encodeSplat(data);
  const decoded=decodeSplat(buffer);
  const bounds=formatBounds(gaussianBounds(data),gaussianBounds(decoded));
  const globs={};
  if(animation) {
    const {axis,margin}=animation, min=bounds.min.slice(),max=bounds.max.slice();
    min[axis]-=margin;
    max[axis]+=margin;
    globs.animationBounds={min,max};
  }
  const editable='assets/'+id+'.gaussians.json', binary='assets/'+id+'.splat';
  await Promise.all([write(editable,JSON.stringify(data)+'\n'),write(binary,Buffer.from(buffer))]);
  return {
    id,...metadata,license:'original',representation:'gaussian-splat',file:binary,editable,
    source:'src/'+file+'.mjs',seed:asset.seed,gaussianCount,pivot:[0,0,0],bounds,...globs,
    material,materialRanges,...(pixelDetailRanges.length?{pixelDetailRanges}:{})
  };
}

const args=process.argv.slice(2);
if(args.length && (args.length!==2 || args[0]!=='--asset' || !profiles.some(p=>p.id===args[1]))) {
  throw Error('Usage: node src/generate.mjs [--asset ASSET_ID]');
}
await mkdir(new URL('assets/',root),{recursive:true});
const selected=args.length?profiles.filter(p=>p.id===args[1]):profiles;
const assets=[];
for(const profile of selected) {
  const exported=await exportAsset(profile);
  assets.push(exported);
  console.log(exported.id,exported.gaussianCount,JSON.stringify(exported.bounds));
}
if(args.length===0){
  const manifest={version:2,pipeline:'pixel-gaussian-splat',pack:'moonpool-conservatory',
    style:'style.json', units:{up:'+Y',forward:'+Z',tile:1},budgets:style.budgets,assets};
  await write('manifest.json',JSON.stringify(manifest,null,2)+'\n');
}
