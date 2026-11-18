import {clamp,normalizeQuaternion} from './gaussians.mjs';

export const PI = Math.PI, TAU = 2*PI;
export const add = (a,b) => a.map((v,i)=>v+b[i]);
export const sub = (a,b) => a.map((v,i)=>v-b[i]);
export const mul = (a,s) => a.map(v=>v*s);
export const dot = (a,b) => a.reduce((sum,v,i)=>sum+v*b[i],0);
export const cross = (a,b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const length = a => Math.hypot(...a);
const unit = a => mul(a,1/length(a));
export const lerp = (a,b,t) => a+(b-a)*t;
export const mix = (a,b,t) => a.map((v,i)=>lerp(v,b[i],t));
export const smooth = (a,b,v) => { const t=clamp((v-a)/(b-a)); return t*t*(3-2*t); };
const frac = n=>n-Math.floor(n);
const moon = unit([-0.48,.79,.41]);

export function seedFor(id) {
  let h = 2130776083;
  for (const c of id) h = Math.imul(h^c.charCodeAt(0),16777619);
  return h>>>0;
}
function random(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5)|0;
    let n = Math.imul(seed ^ (seed >>> 15), 1|seed);
    n ^= n + Math.imul(n ^ (n >>> 7), 61|n);
    return ((n ^ (n >>> 14)) >>> 0)/4294967296;
  };
}

function orientation(x,y,z) {
  const trace=x[0]+y[1]+z[2];
  if(trace>0) {
    const s=2*Math.sqrt(1+trace);
    return normalizeQuaternion([(y[2]-z[1])/s,(z[0]-x[2])/s,(x[1]-y[0])/s,s/4]);
  }
  if(x[0]>y[1] && x[0]>z[2]) {
    const s=2*Math.sqrt(1+x[0]-y[1]-z[2]);
    return normalizeQuaternion([s/4,(x[1]+y[0])/s,(x[2]+z[0])/s,(y[2]-z[1])/s]);
  }
  if(y[1]>z[2]) {
    const s=2*Math.sqrt(1+y[1]-x[0]-z[2]);
    return normalizeQuaternion([(y[0]+x[1])/s,s/4,(y[2]+z[1])/s,(z[0]-x[2])/s]);
  }
  const s=2*Math.sqrt(1+z[2]-x[0]-y[1]);
  return normalizeQuaternion([(z[0]+x[2])/s,(z[1]+y[2])/s,s/4,(x[1]-y[0])/s]);
}

export function grain([x,y,z], f=1) {
  return .50*Math.sin((x*1.63+z*.94+y*.58)*f)
    +.32*Math.sin((x*-.68+z*2.8+y*1.88)*f+2.1)
    +.18*Math.cos((x*4.8-z*2.31+y*3.13)*f-.33);
}
const pointOn = (a,b,c,d,u,v)=>mix(mix(a,b,u),mix(d,c,u),v);

export class Asset {
  constructor(id) {
    this.seed=seedFor(id);
    this.random=random(this.seed);
    this.buckets=new Map();
  }
  splat(p, s, q, color, alpha, kind='solid', detail=false) {
    const key=kind+(detail?'*':'');
    if(!this.buckets.has(key)) this.buckets.set(key,{kind,detail,records:[]});
    const record=[...p,...s,...q,...color.map(v=>clamp(v)),alpha];
    this.buckets.get(key).records.push(...record.map(v=>Math.round(v*1e6)/1e6));
  }
  surface(at, nu, nv, material, options={}) {
    const {opacity=.94, kind='solid', detail=false, flat=false,
      coverage=.59, thickness=.009, jitter=.23, shadeBase=.57, shadeRange=.49}=options;
    for(let i=0;i<nu;i++) for(let j=0;j<nv;j++) {
      const u=(i+.5+(this.random()-.5)*jitter)/nu;
      const v=(j+.5+(this.random()-.5)*jitter)/nv;
      const p=at(u,v);
      const a=sub(at(u+.38/nu,v),at(u-.38/nu,v));
      const b=sub(at(u,v+.38/nv),at(u,v-.38/nv));
      const n=cross(a,b);
      if(length(n)<1e-8) continue;
      const x=unit(a),z=unit(n),y=cross(z,x);
      const sample=typeof material==='function'?material(p,z,u,v):material;
      if(sample===null) continue;
      const light=flat?1:shadeBase+shadeRange*Math.max(0,dot(z,moon))+.05*Math.max(0,z[1]);
      const tone=mul(sample,light*(.984+.035*this.random()));
      const alpha=typeof opacity==='function'?opacity(p,u,v):opacity;
      this.splat(p,[Math.max(.004,length(a)*coverage/.76),Math.max(.004,dot(y,b)*coverage/.76),thickness],
        orientation(x,y,z),tone,alpha,kind,detail);
    }
  }
  quad(a,b,c,d,spacing,material,options={}) {
    const n=Math.max(1,Math.ceil(Math.max(length(sub(a,b)),length(sub(d,c)))/spacing));
    const m=Math.max(1,Math.ceil(Math.max(length(sub(a,d)),length(sub(b,c)))/spacing));
    this.surface((u,v)=>pointOn(a,b,c,d,u,v),n,m,material,options);
  }
  triangle(a,b,c,spacing,material,options={}) {
    const ab=length(sub(a,b)),bc=length(sub(b,c)),ca=length(sub(c,a));
    if(bc>ab && bc>=ca) [a,b,c]=[b,c,a];
    else if(ca>ab && ca>bc) [a,b,c]=[c,a,b];
    const ac=sub(c,a), abv=sub(b,a);
    const height=length(cross(ac,abv))/length(abv);
    this.surface((u,v)=>add(a,add(mul(abv,u*(1-v)),mul(ac,v))),
      Math.max(1,Math.ceil(length(abv)/spacing)),Math.max(1,Math.ceil(height/spacing)),material,options);
  }
  // A closed, bevelled box gives the cheek and the raised cap different light-facing planes.
  box(center,size,bevel,spacing,material,options={}) {
    const [w,h,d]=size.map(v=>v/2);
    const b=Math.min(bevel,w*.45,h*.45,d*.45);
    const ring=(y,wa,da,cut)=>[[wa,da-cut],[wa-cut,da],[-wa+cut,da],[-wa,da-cut],[-wa,-da+cut],[-wa+cut,-da],[wa-cut,-da],[wa,-da+cut]].map(([x,z])=>add(center,[x,y,z]));
    const rings=[ring(-h,w-b,d-b,b*.45),ring(-h+b,w,d,b),ring(h-b,w,d,b),ring(h,w-b,d-b,b*.45)];
    this.rings(rings,spacing,material,options);
  }
  rings(rings,spacing,material,options={}) {
    const n=rings[0].length;
    for(let k=1;k<rings.length;k++) for(let j=0;j<n;j++) {
      const a=rings[k-1],b=rings[k],i=(j+1)%n;
      this.quad(a[j],b[j],b[i],a[i],spacing,material,options);
    }
    for(const [ring,top] of [[rings[0],false],[rings.at(-1),true]]) {
      const center=mul(ring.reduce(add,[0,0,0]),1/n);
      for(let i=0;i<n;i++) {
        const a=ring[i],b=ring[(i+1)%n];
        this.triangle(center,top?b:a,top?a:b,spacing,material,options);
      }
    }
  }
  // Circular sweep with a stable frame. Longitudinal and circumferential density are independent.
  tube(path,radius,segments,sides,material,options={},aspect=1) {
    const frame = u => {
      const p=path(u);
      const t=unit(sub(path(clamp(u+.001)),path(clamp(u-.001))));
      const axis=Math.abs(t[2])>.95?[1,0,0]:[0,0,1];
      const x=unit(cross(axis,t)),y=cross(t,x);
      return {p,x,y,r:typeof radius==='function'?radius(u):radius};
    };
    const point=(u,v)=>{
      const {p,x,y,r}=frame(u);
      return add(p,add(mul(x,r*Math.cos(TAU*v)),mul(y,r*aspect*Math.sin(TAU*v))));
    };
    // v followed by u preserves the outward surface normal.
    this.surface((v,u)=>point(u,v),sides,segments,material,options);
    if(options.open) return;
    for(const u of [0,1]) {
      const p=path(u);
      for(let j=0;j<sides;j++) {
        const a=point(u,j/sides), b=point(u,(j+1)/sides);
        this.triangle(p,u?a:b,u?b:a,.11,material,options);
      }
    }
  }
  rod(a,b,r,material,options={}) {
    this.tube(u=>mix(a,b,u),r,Math.max(2,Math.ceil(length(sub(a,b))/.074)),5,material,options);
  }
  pebble(center,sizes,material,n=12) {
    const [rx,ry,rz]=sizes;
    const offset=this.random()*TAU;
    const outline=Array.from({length:n},(_,k)=>{
      const a=offset+k*TAU/n, r=.77+this.random()*.25;
      return [Math.cos(a)*r,Math.sin(a)*r];
    });
    const layers=[[-.95,.69,0],[-.54,1,.03],[-.02,.96,0],[.49,.93,-.09],[.92,.66,.01]];
    this.rings(layers.map(([y,scale,dx],i)=>outline.map(([x,z],k)=>
      add(center,[(x*scale+dx)*rx,(y+.065*Math.sin(k*3.1+i))*ry,z*scale*rz]))),
    .087, material, {thickness:.011});
  }
}

export function quadratic(a,b,c,t){
  return add(add(mul(a,(1-t)**2),mul(b,2*t*(1-t))),mul(c,t*t));
}

// A tapered surface with a raised central vein and drooping margins.
export function blade(asset, path, width, angle, material, options={}) {
  const lateral=[Math.cos(angle),0,Math.sin(angle)];
  const at=(u,v,back)=>{
    const w=width*Math.pow(Math.max(.014,Math.sin(PI*u)),.83)*(1-.41*u);
    const s=2*v-1;
    const p=add(path(u),mul(lateral,s*w));
    p[1]-=w*(.62*s*s+.10*s*Math.sin(9*u));
    p[1]-=back?.013:0;
    return p;
  };
  const n=Math.max(6,Math.ceil(length(sub(path(1),path(0)))/.08));
  const m=Math.max(3,Math.ceil(width/.033));
  const topNormal=cross(sub(at(.52,.5,false),at(.48,.5,false)),sub(at(.5,.52,false),at(.5,.48,false)))[1]>0;
  for(const back of [false,true]) {
    const reverse=topNormal===back;
    asset.surface((u,v)=>at(u,reverse?1-v:v,back),n,m,
      (p,N,u,v)=>material(p,u,Math.abs(2*v-1),back),options);
  }
  return u=>at(u,.5,false);
}
