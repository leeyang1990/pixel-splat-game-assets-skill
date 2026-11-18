// Copy this file to src/build.mjs beside the three helper modules; node src/build.mjs.
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {roundedBox,cylinder,placed,component,boundsAround} from './sdf.mjs';
import {sampleSdf,assetRecord} from './sdf-gaussians.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),material={ramp:['#152836','#304d5d','#587d86','#9bb8b5']};
const parts=[component(placed(roundedBox([.30,.08,.30],.018),[0,.08,0]),material,boundsAround([0,.08,0],[.65,.21,.65]),.035),component(placed(cylinder(.16,.43),[0,.59,0]),material,boundsAround([0,.59,0],[.38,.92,.38]),.028)];
const result=sampleSdf(parts,{lighting:'world-ao',seed:307}),{entry,binary}=assetRecord('stone-column',result,'src/build.mjs');
entry.usage='static-obstacle';entry.colliders=[{shape:'box',center:[0,.52,0],size:[.64,1.04,.64]}];
await mkdir(root+'assets',{recursive:true});await writeFile(root+entry.file,new Uint8Array(binary));await writeFile(root+entry.editable,JSON.stringify(result.data));
await writeFile(root+'style.json',JSON.stringify({pixelArt:{height:300,minScale:2,paletteEnabled:true,ditherStrength:0,palette:['#060c13',...material.ramp]}},null,2)+'\n');
await writeFile(root+'manifest.json',JSON.stringify({version:2,pipeline:'pixel-gaussian-splat',pack:'sdf-column',units:{up:'+Y',forward:'+Z',tile:1},style:'style.json',budgets:{maxGaussiansPerAsset:80000},assets:[entry]},null,2)+'\n');
console.log(JSON.stringify({asset:entry.id,gaussians:entry.gaussianCount,proof:result.proof}));
