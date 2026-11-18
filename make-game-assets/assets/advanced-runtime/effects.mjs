// Reserve Gaussian instances once; recycle by changing transform and opacity.
export class RipplePool{
 constructor(items,capacity=10,{radius=3.84,waterLevel=.057,asset='water-ripple',duration=1.8,prefix='ripple'}={}){
  if(!Number.isInteger(capacity)||capacity<1||duration<=0)throw Error('Invalid effect pool');
  Object.assign(this,{radius,waterLevel,duration});this.cursor=0;
  this.slots=Array.from({length:capacity},(_,i)=>{const item={id:`${prefix}-${i}`,asset,position:[0,waterLevel,0],yaw:0,scale:1,alpha:0,layer:'ripples'};items.push(item);return{item,born:-Infinity};});
 }
 trigger(x,z,time){if(![x,z,time].every(Number.isFinite)||Math.hypot(x,z)>this.radius)return false;const s=this.slots[this.cursor++%this.slots.length];s.born=time;s.item.position=[x,this.waterLevel,z];this.update(time);return true;}
 update(time){for(const s of this.slots){const age=time-s.born,t=age/this.duration;s.item.alpha=t>=0&&t<1?(1-t)*.8:0;const size=.5+Math.max(0,Math.min(1,t))*3.2;s.item.scale=[size,1,size];}}
 get active(){return this.slots.filter(s=>s.item.alpha>0).length;}
}
