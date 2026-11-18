import {writeFile} from 'node:fs/promises';

const items=[];
function put(id,asset,x,y,z,yaw=0,scale=1) {
  items.push({id,asset,position:[x,y,z],yaw,scale});
}
put('basin','drowned-basin',0,0,0);
put('surface','moonpool-water',0,.205,0);
put('rib-rear','tide-arch',0,.42,-3.04);
put('rib-mid','tide-arch',0,.46,-.04);
put('rib-front','broken-arch',0,.40,2.96);
put('retained-glazing','glazing-bay',0,.44,-1.54);

for(const [label,s] of [['west',-1],['east',1]]) {
  for(const [i,z] of [-3.04,-.04,2.96].entries()) {
    put(label+'-pier-'+i,'basalt-bank',s*3.62,[.43,.47,.415][i],z,-s*Math.PI*.5,[1.03,.96,1.23]);
  }
}
for(const [id,x,y,z,yaw,s] of [
  ['west-outer',-4.51,.36,1.49,1.39,[1.1,.92,1.10]],
  ['west-back',-4.01,.28,-1.55,1.62,[.92,.8,.71]],
  ['east-outer',4.65,.35,1.13,-1.54,[.87,.84,1.13]],
  ['east-back',4.43,.29,-1.66,1.55,[1,.85,.95]],
  ['west-corner',-3.03,.27,4.10,.30,[.90,.83,1.07]],
  ['east-corner',3.26,.29,4.14,-.20,[.94,.91,.80]],
  ['far-bank-left',-1.93,.44,-4.13,.27,[1.19,1.01,1.20]],
  ['far-bank-right',1.70,.40,-4.16,-.20,[1.42,1.01,1.24]],
  ['gauge-isle',-.05,.33,-3.08,-.10,[.63,.77,1.08]],
  ['step-low',2.39,.285,3.79,-.44,[.49,.62,.70]],
  ['step-moss',1.51,.254,3.14,.38,[.44,.56,.75]],
  ['step-wet',.87,.228,2.49,-.22,[.40,.52,.67]],
  ['step-inner',.25,.248,1.90,-.23,[.33,.44,.66]]
]) put(id,'basalt-bank',x,y,z,yaw,s);
put('gauge','tide-gauge',-.05,.338,-3.08,-.12,.96);

for(const [id,x,y,z,yaw,s] of [
  ['left-beacon',-3.16,.30,4.09,.27,1.26],
  ['right-porch',3.65,.47,2.98,1.1,1.06],
  ['right-water',2.81,.19,1.97,-.65,.78],
  ['left-interior',-2.88,.23,-.96,-2.0,.84],
  ['left-high',-3.9,.46,-3.75,.68,1.10],
  ['rear-rim',-.91,.45,-4.19,2.3,.92],
  ['east-inlet',3.47,.33,-2.46,-.60,.76],
  ['isle-bloom',-.96,.30,-3.07,-1.7,.61]
]) put(id,'lantern-bloom',x,y,z,yaw,s);
for(const [id,x,y,z,yaw,s] of [
  ['left-purple',-2.50,.29,4.26,1.21,1.13],
  ['west-root',-4.38,.39,1.54,.83,1.1],
  ['west-inner',-3.68,.47,.38,2.41,.83],
  ['west-lean',-4.25,.31,-2.17,-.35,.72],
  ['front-purple',2.90,.33,4.32,-.31,1.14],
  ['right-screen',4.24,.35,1.29,-.86,1.07],
  ['upper-purple',4.40,.26,-1.45,2.0,1.13],
  ['rear-purple',2.26,.38,-4.45,-.38,1.14],
  ['gauge-purple',.49,.29,-3.03,.43,.59]
]) put(id,'indigo-fronds',x,y,z,yaw,s);

const scene={
  camera:{yaw:.54,pitch:.49,span:11.1,target:[0,1.58,0]},
  items,
  lighting:{
    skyTint:[.81,.96,1],
    lights:[
      {position:[-3.08,1.85,4.00],color:[.54,1,.76],intensity:.72},
      {position:[3.50,1.89,2.75],color:[.46,1,.83],intensity:.78},
      {position:[-.05,1.84,-3.08],color:[.91,.70,.45],intensity:.51},
      {position:[-2.66,1.35,-1.05],color:[.49,.87,1],intensity:.48}
    ],
    waterReflections:true, waterLevel:.205, reflectionStrength:1.09
  }
};
await writeFile(new URL('../scene.json',import.meta.url),JSON.stringify(scene,null,2)+'\n');
