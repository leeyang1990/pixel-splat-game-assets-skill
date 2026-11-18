import {add,mix,mul,blade,quadratic,grain,smooth,lerp,PI,TAU} from './geometry.mjs';

const leafOptions={kind:'foliage',thickness:.008,coverage:.62,shadeBase:.65,shadeRange:.44};
const innerGlow={kind:'emissive',detail:true,flat:true,thickness:.009,coverage:.58};

function sprout(asset,C,angle,length,height,x=0,z=0,violet=false) {
  const dir=[Math.cos(angle),0,Math.sin(angle)],side=angle+PI*.5;
  const root=[x,.021,z],mid=add(root,mul(dir,length*.58)),tip=add(root,mul(dir,length));
  mid[1]=height*1.52;tip[1]=height*(violet?.71:.53);
  const path=u=>quadratic(root,mid,tip,u);
  blade(asset,path,(violet?.165:.115)+asset.random()*.11,side,(p,u,edge,back)=>{
    const veins=smooth(.22,.06,edge)*.29;
    const sheen=smooth(.20,.66,u)*(.22+.15*smooth(-.20,.49,grain(p,10)));
    const rim=smooth(.70,.98,edge)*smooth(.45,.72,u)*.18;
    const t=.09+veins+sheen+rim;
    return mul(violet?mix(C.indigo,C.orchid,t):mix(C.leaf,C.mint,t),back?.76:1);
  },leafOptions);
  return path;
}

function flower(asset,end,angle,r,C) {
  const [x,y,z]=end;
  const f=PI*.5;
  for(let i=0;i<7;i++){
    const a=angle+i*TAU/7;
    const dir=[Math.cos(a),0,Math.sin(a)];
    const root=[x+.038*dir[0],y-.065,z+.038*dir[2]];
    const elbow=add(end,mul(dir,r*.91));elbow[1]+=r*.57;
    const tip=add(end,mul(dir,r*(.92+.17*Math.sin(i*2))));tip[1]+=r*(.97+.23*Math.cos(i*2.3));
    const p=u=>quadratic(root,elbow,tip,u);
    blade(asset,p,r*.38,a+f,(pos,u,edge,back)=>{
      const outer=smooth(.3,.9,edge)*.20;
      const t=.42+.41*smooth(.20,.83,u)-outer;
      return mul(mix(C.mint,C.pearl,t),back?.87:1);
    },{...innerGlow,opacity:.70});
    const lip=u=>p(lerp(.61,.95,u));
    asset.tube(lip,r*.048,5,4,C.pearl,{...innerGlow,opacity:.84});
  }
  asset.tube(u=>[x,y-.083+.22*u,z],
    u=>.021+r*.36*Math.sin(PI*u)**.63,11,8,C.pearl,innerGlow);
  asset.splat(add(end,[0,.049,0]),[r*.86,r*.72,r*.86],[0,0,0,1],C.mint,.087,'emissive');
  for(let i=0;i<3;i++){
    const a=angle+i*TAU/3;
    asset.splat(add(end,[r*1.32*Math.cos(a),r*(.84+i*.39),r*1.28*Math.sin(a)]),
      [.020,.023,.020],[0,0,0,1],C.pearl,.81,'emissive',true);
  }
}

export function lanternBloom(asset,C) {
  const moss=p=>mix(C.stem,C.moss,.29+.24*grain(p,6));
  for(const [x,y,z,s] of [[0,.055,0,.31],[-.17,.038,.12,.16],[.13,.045,-.17,.19]]){
    asset.pebble([x,y,z],[s,.084,s*.8],moss,8);
  }
  for(let i=0;i<11;i++){
    const angle=i*2.399+.25*asset.random();
    const r=.49+asset.random()*.39;
    sprout(asset,C,angle,r,.35+asset.random()*.37,r*.09*Math.cos(angle),r*.13*Math.sin(angle));
  }
  for(const [i,[a,r,h]] of [[0,[.25,.31,1.46]],[1,[2.25,.43,1.16]],[2,[4.25,.47,.95]],[3,[1.20,.47,.67]],[4,[3.52,.48,.73]]]) {
    const x=Math.cos(a), z=Math.sin(a);
    const start=[x*.09,.071,z*.087], end=[x*r,h,z*r];
    const stem=u=>quadratic(start,[-x*.16,h*.65,-z*.17],end,u);
    asset.tube(stem,u=>lerp(.029,.017,u),Math.ceil(h/.050),6,
      p=>mix(C.stem,C.mint,.14+.35*smooth(.10,h,p[1])),{detail:true,thickness:.007});
    for(const [j,u] of [.34,.58].entries()){
      const dir=a+(j%2===0?-1:1)*1.48;
      const p=stem(u), tip=add(p,[.31*Math.cos(dir),.11,.31*Math.sin(dir)]);
      const mid=add(mix(p,tip,.47),[0,.145,0]);
      blade(asset,t=>quadratic(p,mid,tip,t),.086,dir+PI*.5,
        (pos,t,edge)=>mix(C.leaf,C.mint,.35+.22*smooth(.64,.12,edge)),leafOptions);
    }
    flower(asset,end,a+.29,i<2?.232:.178,C);
  }
}

export function indigoFronds(asset,C) {
  const root=(p,n)=>mix(C.wet,C.stem,.35+.25*grain(p,8));
  asset.pebble([0,.035,0],[.33,.079,.27],root,9);
  for(let i=0;i<15;i++){
    const a=i*2.399+asset.random()*.51;
    const length=.44+asset.random()*.60, h=.23+asset.random()*.55;
    const x=.13*Math.cos(a), z=.13*Math.sin(a);
    const stem=sprout(asset,C,a,length,h,x,z,true);
    if(i%3===1){
      asset.tube(u=>add(stem(lerp(.36,.95,u)),[0,.016,0]),.012,13,4,
        p=>mix(C.orchid,C.glass,.22+.21*grain(p,6)),{...innerGlow,opacity:.69});
      for(const [j,t] of [.62,.78,.91].entries()){
        const p=add(stem(t),[j%2===1?.027:-.023,.031,0]);
        asset.splat(p,[.020,.014,.018],[0,0,0,1],mix(C.orchid,C.pearl,.23),.86,'emissive',true);
      }
    }
  }
}
