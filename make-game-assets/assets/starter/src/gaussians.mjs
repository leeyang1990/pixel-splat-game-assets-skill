// Shared Gaussian data, covariance and .splat interchange; no runtime dependencies.
export const STRIDE=14;
export const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export function normalizeQuaternion(q){const n=Math.hypot(...q);if(!n)throw Error('Zero quaternion');return q.map(x=>x/n||0);}
export function fromNormal([x,y,z]){const n=Math.hypot(x,y,z);x/=n;y/=n;z/=n;return z<-.999999?[1,0,0,0]:normalizeQuaternion([-y,x,0,1+z]);}
export function covariance(scales,q){
  const [x,y,z,w]=normalizeQuaternion(q),s=scales.map(v=>v*v);
  const r=[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w),2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w),2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)];
  const c=(i,j)=>r[i*3]*s[0]*r[j*3]+r[i*3+1]*s[1]*r[j*3+1]+r[i*3+2]*s[2]*r[j*3+2];
  return [c(0,0),c(0,1),c(0,2),c(1,1),c(1,2),c(2,2)];
}
export function gaussianBounds(data){
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<data.splats.length;i+=STRIDE){const a=data.splats,c=covariance(a.slice(i+3,i+6),a.slice(i+6,i+10));for(const [j,k] of [[0,0],[1,3],[2,5]]){const r=3*Math.sqrt(c[k]);min[j]=Math.min(min[j],a[i+j]-r);max[j]=Math.max(max[j],a[i+j]+r);}}
  return {min,max};
}
export function encodeSplat(data){
  const count=data.splats.length/STRIDE,buffer=new ArrayBuffer(count*32),view=new DataView(buffer),a=data.splats;
  for(let i=0;i<count;i++){
    const j=i*STRIDE,o=i*32;
    for(let k=0;k<6;k++)view.setFloat32(o+k*4,a[j+k],true);
    for(let k=0;k<4;k++)view.setUint8(o+24+k,Math.max(k===3?1:0,Math.round(clamp(a[j+10+k])*255)));
    const q=normalizeQuaternion(a.slice(j+6,j+10));
    for(let k=0;k<4;k++)view.setUint8(o+28+k,clamp(Math.round(q[[3,0,1,2][k]]*128+128),0,255));
  }
  return buffer;
}
export function decodeSplat(buffer){
  if(!buffer.byteLength||buffer.byteLength%32)throw Error('Invalid 32-byte .splat records');
  const view=new DataView(buffer),splats=[];
  for(let o=0;o<buffer.byteLength;o+=32){
    for(let k=0;k<6;k++)splats.push(view.getFloat32(o+k*4,true));
    const q=normalizeQuaternion([1,2,3,0].map(k=>(view.getUint8(o+28+k)-128)/128));splats.push(...q);
    for(let k=0;k<4;k++)splats.push(view.getUint8(o+24+k)/255);
  }
  return {version:1,type:'gaussian-splats',stride:STRIDE,splats};
}
export function validateGaussians(data){
  if(data.type!=='gaussian-splats'||data.stride!==STRIDE||!data.splats.length||data.splats.length%STRIDE)throw Error('Expected 14-float Gaussian data');
  for(let i=0;i<data.splats.length;i+=STRIDE){const a=data.splats.slice(i,i+STRIDE);if(a.some(v=>!Number.isFinite(v))||a.slice(3,6).some(v=>v<=0)||Math.abs(Math.hypot(...a.slice(6,10))-1)>.001||a.slice(10,14).some(v=>v<0||v>1)||a[13]===0)throw Error(`Invalid Gaussian ${i/STRIDE}`);}
  return data.splats.length/STRIDE;
}
