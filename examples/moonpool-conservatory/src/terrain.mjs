import {add,mix,mul,grain,smooth,lerp,TAU,PI} from './geometry.mjs';
import {clamp} from './gaussians.mjs';

const radial=(a,r=1)=>{
  const bay=1+.055*Math.sin(3*a+.52)-.042*Math.cos(5*a-.7)+.028*Math.sin(8*a+.92);
  return [Math.cos(a)*bay*r,Math.sin(a)*bay*r];
};

export function basin(asset,C) {
  const levels=[
    [-.79, .84, 0, .04],
    [-.65, .99, -.08, .03],
    [-.577, .948, -.02, .06],
    [-.49, .957, .05, .06],
    [-.395, 1.020, .08, .03],
    [-.25, .999, .04, .02],
    [-.095, .98, -.04, -.01],
    [.05, .94, -.03, -.06],
    [.13, .89, .10, -.03],
  ];
  const n=68;
  const rings=levels.map(([y,r,dx,dz],l)=>{
    return Array.from({length:n},(_,k)=>{
      const a=k*TAU/n;
      const strata=.028*Math.sin(7*a+.1*l)+.038*Math.cos(3*a-.17*l)+.025*Math.sin(k*2.99+.44*l);
      const [x,z]=radial(a+.013*Math.sin(k*3.2),r*(1+strata*.21));
      return [5.66*x+dx,y+strata,5.92*z+dz];
    });
  });
  const cliff=(p,N,u,v)=>{
    const layer=p[1]+.030*Math.cos(p[0]+.5*p[2])+.032*Math.sin(p[2]*2);
    const shelf=.27*smooth(.092,.027,Math.abs(layer+.33));
    const mineral=smooth(-.44,.54,grain(p,3.1))*.32;
    const seam=.73*smooth(.103,.035,Math.abs(layer+.555))+.27*smooth(.035,.013,Math.abs(layer+.233));
    const edge=.15*Math.max(0,N[1]);
    return mul(mix(C.slate,C.stone,clamp(.055+mineral+shelf+edge)),1-.31*seam);
  };
  for(let k=1;k<rings.length;k++) for(let j=0;j<n;j++) {
    const a=rings[k-1],b=rings[k],i=(j+1)%n;
    asset.quad(a[j],b[j],b[i],a[i],.117,cliff,{thickness:.014});
  }
  const bottom=rings[0];
  for(let j=0;j<n;j++) asset.triangle([0,-.78,0],bottom[j],bottom[(j+1)%n],.28,C.slate);
  const floor=(p,N,u,v)=>{
    const lobe=grain(p,1.2), speck=grain(p,7.5);
    const ridge=.10*smooth(.30,.68,speck);
    const near=smooth(.63,.99,Math.hypot(p[0]/5.4,p[2]/5.56));
    return mix(mix(C.wet,C.stone,.13+.34*near),C.moss,
      .18*smooth(-.3,.57,lobe)+ridge*near);
  };
  asset.surface((u,v)=>{
    const theta=TAU*u, r=.001+.999*v;
    const [x,z]=radial(theta,r);
    const rim=rings.at(-1);
    const k=(u*n+n)%n;
    const p=mix(rim[Math.floor(k)],rim[(Math.floor(k)+1)%n],k%1);
    const shelf=smooth(.57,.94,r), high=smooth(.89,1,r);
    return mix([x*4.98,-.25+.16*shelf+.036*Math.sin(x*9+z*4)+.024*Math.sin(z*13+x*2),z*5.24],
      mul(p,r),high);
  },215,56,floor,{thickness:.013,jitter:.48});
  for(const [x,z,scale] of [[3.65,2.83,.85],[-2.9,3.65,.72],[-3.45,-2.9,.70],[3.9,-2.75,1.15],[-4.46,.6,.73],[4.44,.58,.66]]) {
    asset.pebble([x,.04,z],[.45*scale,.155*scale,.39*scale],floor,8);
  }
}

export function bank(asset,C) {
  const stone=(p,N)=>{
    const [x,y,z]=p;
    const slant=y-.038*x+.036*Math.sin(x*4.6+z*1.7);
    const outcrop=smooth(.20,.58,grain(p,2.5));
    const band=.25+.25*Math.sin(slant*29)+.22*grain(p,4.2);
    const wet=smooth(-.28,-.56,y)*smooth(-.31,.57,z);
    const moss=smooth(-.23,-.028,y)*smooth(-.28,.65,grain([x,.7,z],3));
    const ledge=1-.25*smooth(.055,.014,Math.abs(slant+.36))-.15*smooth(.035,.012,Math.abs(slant+.53));
    return mul(mix(mix(mix(C.slate,C.stone,clamp(band+.26*outcrop+.23*Math.max(0,N[1]))),C.wet,wet*.63),C.moss,moss*.60),ledge);
  };
  asset.pebble([-.19,-.34,-.024],[1.38,.365,.64],stone,13);
  asset.pebble([.74,-.23,.20],[.64,.28,.51],stone,9);
  asset.pebble([-1.03,-.28,.36],[.53,.27,.39],stone,8);
  const cap=(p,N)=>{
    const veins=smooth(.88,.992,Math.cos(p[0]*5.2+p[2]*10+grain(p,4)));
    const damp=smooth(-.35,.54,grain(p,3.9));
    const top=smooth(.08,.81,N[1]);
    return mix(mix(C.slate,C.stone,.23+.31*top+.24*damp+.14*veins),C.moss,.67*smooth(.58,.88,damp));
  };
  for(const [x,y,z,w,d] of [[-.84,-.05,-.16,.76,.77],[.06,-.065,-.27,.75,.65],[.83,-.105,-.015,.58,.67]]) {
    asset.box([x,y,z],[w,.161,d],.069,.084,cap);
  }
  for(const [x,y,z,s] of [[-.91,-.37,.61,.15],[-.51,-.53,.67,.18],[.52,-.44,.65,.19],[1.09,-.33,.48,.16],[1.36,-.24,.19,.14],[-1.33,-.37,.31,.19]]) {
    asset.pebble([x,y,z],[s*1.6,s*.59,s],stone,7);
  }
}

export function water(asset,C) {
  const shape=(u,v)=>{
    const a=TAU*u, r=.002+.998*v;
    const [x,z]=radial(a,r);
    return [x*5.02-.02,0,z*5.28+.04];
  };
  const color=(p,n,u,r)=>{
    const [x,,z]=p;
    const channel=smooth(.0,.60,Math.abs(x*.22+.28*Math.sin(z*.66)-.14));
    const shoal=smooth(.52,.96,r)*.55+channel*.24;
    const fine=grain([x*1.1,.4,z*3],1.45);
    const crest=smooth(.55,.79,Math.cos(z*10+x*1.22+Math.sin(x*1.36)*.82))*
      smooth(-.12,.72,grain([x,1.2,z],1.7));
    const depth=mix(C.water,C.shallows,clamp(.1+shoal+.13*fine));
    return mix(depth,C.glass,crest*.23);
  };
  asset.surface(shape,238,61,color,{flat:true,kind:'water',thickness:.008,jitter:.33,coverage:.56,
    opacity:(p,u,r)=>(.47+.22*smooth(.29,.87,r))*(1-.44*smooth(.965,1,r))});
  const arcs=[
    [-2.69,1.8,.41,.220,2.55], [2.42,2.5,.38,.083,2.92], [1.64,-1.75,.47,.27,2.76],
    [-2.66,-1.45,.40,3.62,5.68], [.14,3.63,.50,3.46,5.83], [1.19,1.30,.67,3.77,5.85],
    [-.78,-.46,.58,3.31,5.39], [-1.07,-3.73,.46,4.15,5.93]
  ];
  for(const [x,z,r,a,b] of arcs) for(const k of [0,1]) {
    const d=r+k*.14;
    asset.surface((u,v)=>{
      const t=lerp(a+k*.22,b-k*.31,u), R=d+(v-.5)*.063;
      return [x+Math.cos(t)*R, .008,z+Math.sin(t)*R];
    },15+k*4,2,mix(C.shallows,C.glass,k?.27:.60),
    {kind:'water',detail:true,flat:true,opacity:(p,u)=>.24+.33*Math.sin(PI*u),thickness:.007});
  }
}
