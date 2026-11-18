export const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
export function multiply(a,b){const out=new Array(16).fill(0);for(let r=0;r<4;r++)for(let c=0;c<4;c++)for(let k=0;k<4;k++)out[r*4+c]+=a[r*4+k]*b[k*4+c];return out;}
export function compose(position=[0,0,0],yaw=0,scale=1){const s=Array.isArray(scale)?scale:[scale,scale,scale],c=Math.cos(yaw),n=Math.sin(yaw);return[c*s[0],0,n*s[2],position[0],0,s[1],0,position[1],-n*s[0],0,c*s[2],position[2],0,0,0,1];}
export function pivotTransform(pivot,q=[0,0,0,1],translation=[0,0,0]){
 const n=Math.hypot(...q),[x,y,z,w]=q.map(v=>v/n),a=[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w),0,2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w),0,2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y),0,0,0,0,1];
 for(let r=0;r<3;r++)a[r*4+3]=pivot[r]+translation[r]-a[r*4]*pivot[0]-a[r*4+1]*pivot[1]-a[r*4+2]*pivot[2];return a;
}
export const transformPoint=(a,p)=>[0,1,2].map(r=>a[r*4]*p[0]+a[r*4+1]*p[1]+a[r*4+2]*p[2]+a[r*4+3]);
export function cameraBasis(yaw,pitch){const sy=Math.sin(yaw),cy=Math.cos(yaw),sp=Math.sin(pitch),cp=Math.cos(pitch);return{right:[cy,0,-sy],up:[-sy*sp,cp,-cy*sp],eye:[sy*cp,sp,cy*cp]};}
export function mirrorPoint(p,level=0){return[p[0],2*level-p[1],p[2]];}
