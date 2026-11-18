export function prototypeScene(){return {camera:{yaw:.18,pitch:.22,span:6.8,target:[0,2.05,0]},items:[{id:'gate',asset:'ogive-gatehouse',position:[-.9,0,-.28]},{id:'prototype-mist',asset:'golden-gate-mist',position:[-.9,0,-.72]},{id:'wall',asset:'lancet-wall-bay',position:[2.28,0,-.57],yaw:-.15},{id:'column',asset:'carved-broken-column',position:[-2.85,0,.80]}]};}
export function castleScene(){
 const items=[],add=(id,asset,position,scale=1,yaw=0,extra={})=>items.push({id,asset,position,scale,yaw,...extra});
 // Foreground cliff, a central approach, and offset outer ramparts.
 const rocks=[[-3.2,-.03,-1.9,[1.8,1.55,1.65],.3],[-.2,.02,-2.4,[2.0,1.5,1.65],.6],[2.6,-.03,-2.3,[1.8,1.65,1.55],-.2],[-3.5,-.20,.2,[1.5,1.35,1.3],.7],[3.5,-.12,-.1,[1.4,1.45,1.3],-.4],[-2.8,-.48,3.9,[1.6,1.15,1.7],.3],[1.4,-.48,5.1,[1.5,.94,1.58],.5],[-.3,-.45,5.3,[1.7,1.02,1.94],.2],[4.15,-.43,1.65,[1.45,1.12,1.3],1.28],[-4.4,-.57,-.5,[1.45,.87,1.4],.56],[-4.6,-1.15,3.03,[1.1,.64,1.30],-.16],[3.7,-.8,4.07,[1.01,.79,1.30],-.71],[.72,-1.15,6.33,[1.13,.58,.92],1.5]];
 rocks.forEach((p,i)=>add('cliff-'+i,'stratified-cliff-rock',p.slice(0,3),p[3],p[4]));
 add('main-gate','ogive-gatehouse',[0,.12,-.45],1.13);
 add('gate-fog','golden-gate-mist',[0,.12,-.90],1.13);
 add('west-tower','crowned-rampart-tower',[-2.50,.10,-1.50],1.0,.13);
 add('east-tower','crowned-rampart-tower',[2.55,.12,-1.96],.91,-.15);
 add('far-tower','crowned-rampart-tower',[.55,1.51,-4.15],.74,.30,{intensity:.83});
 add('far-roof','verdigris-roof-spire',[.55,6.22,-4.15],.73,.30,{intensity:.88});
 add('east-roof','verdigris-roof-spire',[2.55,5.91,-1.96],[.77,.61,.77],-.23,{intensity:.90});
 add('west-curtain','lancet-wall-bay',[-4.00,.05,-1.16],.89,-.33);
 add('east-curtain','lancet-wall-bay',[3.99,.05,-1.10],.93,.34);
 add('rear-curtain','lancet-wall-bay',[-.10,1.0,-3.65],1.12,0,{intensity:.73});
 add('east-return','lancet-wall-bay',[4.45,.1,-2.65],.88,1.5);
 add('bridge','ruined-arch-bridge',[0,-.02,2.70]);
 add('steps','weathered-stone-stairs',[0,-.12,.66]);
 add('lower-steps','weathered-stone-stairs',[-.15,-.39,5.07],1.06);
 [[-1.18,.15,1.25],[1.2,.15,1.3],[-1.15,.15,4.15],[1.1,.15,4.14],[-2.35,-.4,4.9]].forEach((p,i)=>add('broken-pier-'+i,'carved-broken-column',p,.54+(i%2)*.16,i*.7));
 [[-3.15,4.8,-.84],[2.47,4.6,-.94],[3.76,3.05,-.78],[-4.2,2.75,-.73],[.80,4.15,.31],[-.9,3.60,.35],[-2.2,.25,4.15]].forEach((p,i)=>add('ivy-'+i,'wind-torn-ivy',p,.62+(i%3)*.13,i*.29));
 [[-3.9,.0,.6],[3.25,.02,.6],[-2.7,-.39,4.3],[-1.6,-.4,5.4],[1.48,-.39,5.4],[1.1,-.4,4.7],[-4.1,-.03,-2.6],[3.35,.0,-2.5],[-1.3,.0,.5],[1.4,.02,.9]].forEach((p,i)=>add('grass-'+i,'windswept-grass',p,1.3+(i%3)*.27,i*.8));
 add('war-banner','tattered-war-banner',[-1.35,.14,.15],.83,-.15);
 add('war-banner-east','tattered-war-banner',[2.48,3.78,-.60],.63,.15);
 add('ancient-tree','luminous-golden-tree',[-5.85,-.80,-5.40],1.03,-.32);
 add('tree-root-bank','stratified-cliff-rock',[-5.85,-.85,-5.40],[1.53,.77,1.34],-.49,{intensity:.77});
 add('tree-halo','golden-tree-haze',[-5.85,4.95,-6.15]);
 [[-2.3,-.37,4.72],[1.88,-.41,5.32],[3.86,-.34,2.48],[-4.6,-.57,.45],[.82,-.44,6.06],[-1.44,-.45,5.71],[3.94,-.73,3.95],[-3.0,-.37,3.40]].forEach((p,i)=>add('scree-'+i,'shed-cliff-fragments',p,.75+(i%3)*.23,.51*i));
 add('grace','site-of-golden-grace',[-.93,-.39,5.03],1);
 add('grace-glow','golden-grace-halo',[-.93,-.39,5.03]);
 add('mist-low','cliff-mist',[-.2,-1.72,1.1],1,0,{motionEffect:true});
 add('mist-ravine','cliff-mist',[-1.5,-2.0,4.8],[1.42,.88,1.12],.14,{alpha:.67,motionEffect:true});
 add('mist-back','cliff-mist',[0,.4,-5.8],1.15,0,{alpha:.52,motionEffect:true});
 add('storm-clouds','storm-cloud-haze',[0,5.4,-8.5]);
 add('crown-leaves','drifting-golden-leaves',[-3.85,5.30,-.7],1.02,.12,{motionEffect:true});
 add('approach-leaves','drifting-golden-leaves',[-2.3,1.02,4.9],.52,-.26,{alpha:.76,motionEffect:true});
 add('fire-embers','rising-embers',[-.93,-.31,5.03],.83,.12,{motionEffect:true});
 add('explorer','weathered-knight',[.24,-.15,5.46],.92,Math.PI-.26);
 return {items,camera:{yaw:.34,pitch:.235,span:15.76,target:[-.65,3.12,.48]}};
}
