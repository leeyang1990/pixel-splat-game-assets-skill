import {add,sub,mul,lerp,mix,grain,smooth,quadratic,PI,TAU} from './geometry.mjs';

const JOIN = Math.acos(1.19/4.72);
const plain = {detail:true,thickness:.007};
const lit = {...plain,kind:'emissive',flat:true,thickness:.006};
const root = 3.53;

function archPoint(sign,t,n=0,z=0,broken=false) {
  const a=t*JOIN;
  const bend=broken?smooth(.16,.60,t):0;
  return [sign*(4.72*Math.cos(a)-1.19+n*Math.cos(a)+.22*bend),
    1.14+.825*4.72*Math.sin(a)+n*Math.sin(a)-.19*bend,
    z+(sign<0?.38:-.46)*bend];
}

function section(asset,sign,t0,t1,n0,n1,z0,z1,color,options={},broken=false) {
  const profile=[[n0,z0],[n1,z0],[n1,z1],[n0,z1]];
  const res=Math.ceil((t1-t0)*104);
  const pos=(t,[n,z])=>archPoint(sign,t,n,z,broken);
  for(let i=0;i<4;i++) {
    const a=profile[i],b=profile[(i+1)%4];
    const point=(u,v)=>pos(lerp(t0,t1,u),mix(a,b,sign===1?v:1-v));
    asset.surface(point,res,Math.max(2,Math.ceil(Math.hypot(...sub(a,b))/.060)),
      color,options);
  }
  for(const t of [t0,t1]) {
    const p=profile.map(k=>pos(t,k));
    const reverse=(sign>0)===(t===t1);
    asset.quad(...(reverse?p.reverse():p),.052,color,options);
  }
}

function metal(C,mixAmount=.4) {
  return p=>{
    const band=grain(p,2.1);
    const oxide=smooth(-.45,.60,band);
    return mix(C.iron,C.verdigris,mixAmount*oxide+.13);
  };
}

function base(asset,sign,C) {
  const x=sign*root;
  asset.box([x,.092,0],[.91,.22,.86],.092,.088,
    (p,n)=>mix(C.slate,C.stone,.31+.31*smooth(.04,.22,p[1])+.13*grain(p,4)));
  asset.box([x,.26,0],[.67,.16,.63],.049,.065,C.stone);
  asset.box([x,.39,0],[.51,.18,.44],.053,.065,metal(C),plain);
  asset.box([x,.74,0],[.28,.69,.27],.035,.062,metal(C),plain);
  for(const z of [-.148,.148]) {
    asset.box([x,.77,z],[.074,.70,.033],.013,.06,C.bronze,plain);
    for(const y of [.49,.98]) {
      asset.rod([x,y,z*.94],[x,y,z*1.15],.033,C.brass,plain);
    }
  }
  asset.box([x,1.095,0],[.48,.15,.45],.041,.062,C.verdigris,plain);
  asset.box([x,1.19,0],[.57,.055,.53],.019,.064,C.bronze,plain);
}

function rib(asset,sign,end,C,broken) {
  base(asset,sign,C);
  section(asset,sign,0,end,-.080,.093,-.121,.121,metal(C,.62),{detail:true},broken);
  section(asset,sign,0,end,.058,.148,-.177,.177,metal(C,.47),plain,broken);
  section(asset,sign,0,end,-.131,-.065,-.154,.154,C.iron,plain,broken);
  for(const z of [-.147,.147]) {
    section(asset,sign,.014,end,.095,.126,z-.022,z+.022,
      p=>mix(C.bronze,C.verdigris,smooth(-.24,.59,grain(p,2.6))),plain,broken);
  }
  const innerEnd=broken?end-.04:end;
  section(asset,sign,.018,innerEnd,-.353,-.295,-.066,.066,metal(C,.81),plain,broken);
  for(let t=.075;t<=end-.024;t+=.106) {
    const p=archPoint(sign,t,-.085,0,broken), q=archPoint(sign,t,-.316,0,broken);
    asset.rod(p,q,.035,C.verdigris,plain);
    for(const z of [-.169,.169]) {
      const a=archPoint(sign,t,.064,z*.82,broken), b=archPoint(sign,t,.064,z*1.16,broken);
      asset.rod(a,b,.031,C.brass,plain);
    }
  }
}

function glassSurface(asset,at,C,nu,nv,variant) {
  const color=(p,n,u,v)=>{
    const cloud=smooth(-.30,.6,grain(p,3.3));
    const mineral=smooth(.72,1,v)*.14;
    return mix(C.water,C.glass,.29+cloud*.44+mineral+variant*.12);
  };
  asset.surface(at,nu,nv,color,{...lit,opacity:(p,u,v)=>.20+.21*smooth(-.54,.58,grain(p,6))+.07*v,coverage:.55,thickness:.006});
  // Draw a pale, uneven lip where the retained glass is exposed.
  for(const u of [.08,.34,.72]) {
    const a=at(u,.89),b=at(u+.09,.988);
    asset.rod(a,b,.011,mix(C.glass,C.pearl,.30),{...lit,opacity:.48});
  }
}

function shard(asset,sign,t0,t1,maxDepth,skew,C,broken=false) {
  const edge=u=>{
    const tip=Math.sin(PI*u)**.69;
    const chips=lerp(.75,.99,u)+.10*Math.sin(TAU*u*2.4);
    return .048+maxDepth*tip*chips;
  };
  const at=(u,v)=>archPoint(sign,lerp(t0,t1,u)+skew*v*Math.sin(PI*u),-.326-v*edge(u),-.008,broken);
  glassSurface(asset,at,C,Math.max(7,Math.ceil((t1-t0)*80)),6,sign>0?1:0);
  for(const side of [-1,1]) {
    const path=u=>add(at(u,1),[0,0,.014*side]);
    asset.tube(path,.016,Math.max(6,Math.ceil((t1-t0)*52)),4,C.glass,{...lit,opacity:.52});
  }
}

function joint(asset,C) {
  const tip=archPoint(1,1);
  for(const z of [-.17,.17]) {
    const y=tip[1]-.15;
    const outline=[[0,y+.38,z],[.18,y+.16,z],[0,y-.10,z],[-.18,y+.16,z],[0,y+.38,z]];
    for(let i=1;i<outline.length;i++) asset.rod(outline[i-1],outline[i],.032,C.brass,plain);
    asset.rod([0,y-.095,z],[0,y-.43,z],.021,C.bronze,plain);
    asset.rod([0,y+.07,z],[0,y+.25,z],.029,C.bead,lit);
  }
  asset.box([0,tip[1],0],[.24,.23,.39],.055,.054,C.verdigris,plain);
}

export function tideArch(asset,C) {
  for(const sign of [-1,1]) rib(asset,sign,1,C,false);
  joint(asset,C);
  shard(asset,-1,.54,.73,.59,-.022,C);
  shard(asset,-1,.735,.96,.45,.029,C);
  shard(asset,1,.73,.989,.49,-.030,C);
  shard(asset,1,.47,.56,.28,.021,C);
  for(const [sign,t,depth] of [[-1,.59,.66],[-1,.75,.53],[1,.58,.36],[1,.81,.51]]) {
    asset.rod(archPoint(sign,t,-.29,.02),archPoint(sign,t+.04,-depth-.27,.02),.026,C.verdigris,plain);
  }
}

export function brokenArch(asset,C) {
  for(const [sign,end] of [[-1,.52],[1,.295]]) {
    rib(asset,sign,end,C,true);
    for(const [t,n,z] of [[.051,.095,.129],[.024,-.075,-.095],[.035,.022,.014]]) {
      const a=archPoint(sign,end-.013,n,z,true);
      const b=archPoint(sign,end+t,n+.039*Math.cos(n*13),z*1.37,true);
      asset.rod(a,b,.026,n>0?C.bronze:C.verdigris,plain);
    }
    const a=archPoint(sign,end-.022,-.35,0,true);
    const b=archPoint(sign,end+.018,-.48,.14,true);
    asset.rod(a,b,.029,C.iron,plain);
  }
  shard(asset,-1,.24,.39,.47,-.028,C,true);
  shard(asset,-1,.405,.477,.22,.028,C,true);
  shard(asset,1,.107,.20,.22,.022,C,true);
}

export function roofBay(asset,C) {
  const left=-1;
  const lateral=[.33,.47,.64,.78,.90];
  for(const [i,t] of lateral.entries()) {
    const end=i===0?-.47:i===3?.83:1.50;
    const start=i===3?-.89:-1.50;
    const path=u=>archPoint(left,t+(i===3?.019*Math.sin(PI*u):0),.105,lerp(start,end,u));
    asset.tube(path,i===2?.048:.034,Math.ceil((end-start)/.058),6,metal(C,.69),plain);
    if(i!==3) for(const z of [start,end]) {
      asset.box(archPoint(left,t,.102,z),[.123,.105,.17],.021,.064,C.bronze,plain);
    }
  }
  for(const [lo,hi,z] of [[.33,.65,-.40],[.46,.90,.60],[.63,.90,-.57]]) {
    const path=u=>archPoint(left,lerp(lo,hi,u),.107,z+.022*Math.sin(PI*u));
    asset.tube(path,.032,Math.ceil((hi-lo)*76),5,C.verdigris,plain);
  }
  for(const [t0,t1,z0,len] of [[.34,.468,-1.48,.55],[.476,.633,-1.48,.91],[.646,.77,.61,.85],[.785,.893,.61,.82],[.480,.630,.63,.70]]) {
    const at=(u,v)=>archPoint(left,lerp(t0,t1,u),.091,z0+len*v*(.91+.16*Math.sin(u*9)+.11*Math.sin(u*25)));
    glassSurface(asset,at,C,11,15,1);
  }
  const hook=u=>quadratic(archPoint(left,.64,.11,.14),[-2.08,3.12,.33],[-2.22,3.05,.50],u);
  asset.tube(hook,.025,12,5,C.bronze,plain);
}

export function tideGauge(asset,C) {
  const stone=(p,n)=>mix(C.slate,C.stone,.32+.25*grain(p,4)+.21*n[1]);
  asset.box([0,.10,0],[1.35,.29,1.05],.10,.083,stone);
  asset.box([0,.29,0],[1.14,.14,.89],.061,.075,C.stone);
  asset.box([0,.65,0],[.57,.66,.46],.062,.062,metal(C),plain);
  asset.box([0,1.02,0],[.86,.17,.70],.050,.058,C.bronze,plain);
  for(const x of [-.21,.21]) for(const z of [-.24,.24]) {
    asset.rod([x,.39,z],[x,.95,z],.049,C.brass,plain);
  }
  const y=1.66;
  for(const z of [-.14,.14]) {
    const crescent=u=>{
      const a=lerp(-2.50,2.04,u);
      return [.51*Math.sin(a),y+.53*Math.cos(a),z+.04*Math.sin(PI*u)];
    };
    asset.tube(crescent,u=>.024+.058*Math.sin(PI*u)**.62,38,6,C.brass,plain,.81);
    asset.tube(u=>add(crescent(u),[0,0,(z>0?1:-1)*.042]),.018,34,5,C.bead,lit);
    for(const x of [-.12,.12]) asset.rod([x,1.10,z],[x,1.36,z],.039,C.bronze,plain);
  }
  asset.rod([-.24,1.36,0],[.30,1.95,0],.034,C.verdigris,plain);
  asset.tube(u=>[0,1.64+u*.295,0],u=>.016+.107*Math.sin(PI*u)**.70,11,8,C.mint,lit);
  for(const z of [-.247,.247]) for(let i=0;i<5;i++) {
    const x=(i-2)*.058;
    asset.rod([x,.56,z],[x,.56+(i===2?.15:.073),z],.014,C.brass,plain);
  }
}
