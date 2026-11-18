import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {castleScene} from './scene.mjs';
import {exportExplorer} from './export-explorer.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),m=JSON.parse(await readFile(root+'manifest.json')),knight=await exportExplorer();m.pack='windward-citadel';m.assets=[...m.assets.filter(a=>a.id!==knight.id),knight];
const anchorOverrides = {
 'ogive-gatehouse': {threshold:[0,0,.6], towerBand:[0,4.18,0]},
 'lancet-wall-bay': {leftJoin:[-1.325,0,0], rightJoin:[1.325,0,0]},
 'crowned-rampart-tower': {roofSeat:[0,6.38,0]},
 'verdigris-roof-spire': {seat:[0,0,0], top:[0,2.95,0]},
 'stratified-cliff-rock': {top:[0,0,0]},
 'ruined-arch-bridge': {deckStart:[0,.27,-1.50], deckEnd:[0,.27,1.50]},
 'weathered-stone-stairs': {top:[0,.60,-.805], bottom:[0,.075,.805]},
 'wind-torn-ivy': {attach:[0,0,0]},
 'tattered-war-banner': {poleFoot:[0,0,0],poleTop:[0,2.25,0]},
 'luminous-golden-tree': {root:[0,0,0]},
 'site-of-golden-grace': {glowOrigin:[0,.10,0]},
};
for(const asset of m.assets)Object.assign(asset.anchors,anchorOverrides[asset.id]);
await writeFile(root+'manifest.json',JSON.stringify(m,null,2)+'\n');
const scene=castleScene(),defs=new Map(m.assets.map(a=>[a.id,a]));for(const i of scene.items)if(!defs.has(i.asset))throw Error('Scene missing '+i.asset);await writeFile(root+'scene.json',JSON.stringify(scene,null,2)+'\n');
const hashes={};for(const a of m.assets)hashes[a.id]=createHash('sha256').update(await readFile(root+a.file)).digest('hex');
const summary={assets:m.assets.length,uniqueGaussians:m.assets.reduce((n,a)=>n+a.gaussianCount,0),instances:scene.items.length,drawnGaussians:scene.items.reduce((n,i)=>n+defs.get(i.asset).gaussianCount,0),assetHashes:hashes};await writeFile(root+'validation/assembly.json',JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary,null,2));
