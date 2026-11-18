// Distance functions are authoring inputs. This module never creates polygon meshes.
export const add=(a,b)=>a.map((v,k)=>v+b[k]);
export const sub=(a,b)=>a.map((v,k)=>v-b[k]);
export const mul=(a,s)=>a.map(v=>v*s);
export const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0);
export const unit=a=>{const n=Math.hypot(...a);return n>1e-12?a.map(v=>v/n):[0,1,0];};
export function box(p,b){const q=p.map((v,k)=>Math.abs(v)-b[k]);return Math.hypot(...q.map(v=>Math.max(0,v)))+Math.min(0,Math.max(...q));}
export const roundedBox=(b,r)=>p=>box(p,b.map(v=>v-r))-r;
export const sphere=r=>p=>Math.hypot(...p)-r;
export function cylinder(r,h){return p=>{const q=[Math.hypot(p[0],p[2])-r,Math.abs(p[1])-h];return Math.hypot(Math.max(0,q[0]),Math.max(0,q[1]))+Math.min(0,Math.max(...q));};}
export function capsule(a,b,r){const ba=sub(b,a),den=dot(ba,ba);return p=>{const pa=sub(p,a),t=den?Math.max(0,Math.min(1,dot(pa,ba)/den)):0;return Math.hypot(...sub(pa,mul(ba,t)))-r;};}
// Conservative distance estimator: exact ellipsoid zero set, not exact Euclidean distance.
export const ellipsoid=r=>p=>(Math.hypot(...p.map((v,k)=>v/r[k]))-1)*Math.min(...r);
export const torusXY=(r,t)=>p=>Math.hypot(Math.hypot(p[0],p[1])-r,p[2])-t;
export const union=(...fields)=>p=>Math.min(...fields.map(f=>f(p)));
export const cut=(a,b)=>p=>Math.max(a(p),-b(p));
export const intersect=(...fields)=>p=>Math.max(...fields.map(f=>f(p)));
export function gothic(w,base,spring,depth){return p=>{const [x,y,z]=p,rect=box([x,y-(base+spring)/2,0],[w,(spring-base)/2,1e6]),lens=Math.max(Math.hypot(x-w,y-spring)-2*w,Math.hypot(x+w,y-spring)-2*w,spring-y);return Math.max(Math.min(rect,lens),Math.abs(z)-depth);};}
export function placed(field,position=[0,0,0],yaw=0,roll=0){const cy=Math.cos(yaw),sy=Math.sin(yaw),cz=Math.cos(roll),sz=Math.sin(roll);return p=>{const a=sub(p,position),x=cy*a[0]-sy*a[2],z=sy*a[0]+cy*a[2];return field([cz*x+sz*a[1],-sz*x+cz*a[1],z]);};}
export function normal(field,p,e=.0005){return unit([0,1,2].map(k=>{const a=[...p],b=[...p];a[k]+=e;b[k]-=e;return field(a)-field(b);}));}
export function fieldUnion(parts){const cached=parts.map(part=>({...part,center:part.bounds.min.map((v,k)=>(v+part.bounds.max[k])/2),half:part.bounds.max.map((v,k)=>(v-part.bounds.min[k])/2)}));return p=>{let best=Infinity;for(const part of cached){const x=Math.abs(p[0]-part.center[0])-part.half[0],y=Math.abs(p[1]-part.center[1])-part.half[1],z=Math.abs(p[2]-part.center[2])-part.half[2],bound=Math.hypot(Math.max(0,x),Math.max(0,y),Math.max(0,z))+Math.min(0,Math.max(x,y,z));if(bound>best)continue;best=Math.min(best,part.field(p));}return best;};}
export function component(field,material,bounds,spacing=.035){return {field,material,bounds,spacing};}
export function boundsAround(center,size){return {min:center.map((v,k)=>v-size[k]/2),max:center.map((v,k)=>v+size[k]/2)};}
