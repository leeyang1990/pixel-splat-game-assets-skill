// Deterministic, renderer-independent verification logic. All time is explicit.
export const PLAYER_RADIUS=0.18;
export const WORLD={minX:-6,maxX:6,minZ:-4.5,maxZ:4.5};
export const COLLECT_DURATION=0.45;
export function createScene(assets) {
  const has=id=>assets.some(a=>a.id===id), def=id=>assets.find(a=>a.id===id);
  const tiles=[];
  for(let z=0;z<9;z++)for(let x=0;x<12;x++)tiles.push({asset:has('grass-clover')&&((x*7+z*11)%5<2)?'grass-clover':'grass-meadow',x:x-5.5,z:z-4});
  const crates=[[-1.5,0],[-.5,0],[.5,0],[2.5,-1.5],[2.5,-.5]] .map(([x,z],i)=>({asset:i%2&&has('crate-weathered')?'crate-weathered':'crate-oak',x,z,yaw:i%2?Math.PI/2:0}));
  const pickups=[[-3,-1.5],[.5,-2],[3,2]] .map(([x,z],i)=>({asset:'pickup-ember',x,z,phase:i*.63,status:'idle',collectedAt:null}));
  return {tiles,crates,pickups,player:{x:-4,z:0,radius:PLAYER_RADIUS},time:0,collected:0,collisionCount:0,lastBlocked:false,assets,def};
}
export function boxFor(scene,crate) {
  const c=scene.def(crate.asset).colliders[0], quarterTurn=Math.abs(Math.sin(crate.yaw))>.5;
  const hx=c.size[quarterTurn?2:0]/2,hz=c.size[quarterTurn?0:2]/2;
  return {minX:crate.x+c.center[0]-hx,maxX:crate.x+c.center[0]+hx,minZ:crate.z+c.center[2]-hz,maxZ:crate.z+c.center[2]+hz};
}
export function intersectsBox(x,z,r,b) {
  const dx=x-Math.max(b.minX,Math.min(b.maxX,x)),dz=z-Math.max(b.minZ,Math.min(b.maxZ,z));
  return dx*dx+dz*dz<r*r-1e-10;
}
export function blockedAt(scene,x,z) {
  const r=scene.player.radius;
  return x-r<WORLD.minX||x+r>WORLD.maxX||z-r<WORLD.minZ||z+r>WORLD.maxZ||scene.crates.some(c=>intersectsBox(x,z,r,boxFor(scene,c)));
}
export function move(scene,dx,dz) {
  // Substeps bound motion to avoid tunneling even when callers submit a large delta.
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/0.04));let blocked=false;
  for(let i=0;i<steps;i++) {
    const p=scene.player;
    if(!blockedAt(scene,p.x+dx/steps,p.z))p.x+=dx/steps;else blocked=true;
    if(!blockedAt(scene,p.x,p.z+dz/steps))p.z+=dz/steps;else blocked=true;
    collectNearby(scene);
  }
  scene.lastBlocked=blocked;if(blocked)scene.collisionCount++;
  return !blocked;
}
export function collectNearby(scene) {
  for(const p of scene.pickups)if(p.status==='idle') {
    const radius=scene.def(p.asset).trigger.radius+scene.player.radius;
    if(Math.hypot(scene.player.x-p.x,scene.player.z-p.z)<=radius) {p.status='collecting';p.collectedAt=scene.time;scene.collected++;}
  }
}
export function advance(scene,dt) {
  scene.time+=dt;
  for(const p of scene.pickups)if(p.status==='collecting'&&scene.time-p.collectedAt>=COLLECT_DURATION)p.status='gone';
}
export function pickupPose(p,time) {
  const t=time+p.phase;
  if(p.status==='gone')return null;
  if(p.status==='collecting') {
    const progress=Math.min(1,Math.max(0,(time-p.collectedAt)/COLLECT_DURATION));
    return {y:.18+progress*.55,yaw:t*Math.PI/1.2,scale:1-progress,glow:1,progress};
  }
  return {y:.18+Math.sin(t*Math.PI/1.2)*.075,yaw:t*Math.PI/1.2,scale:1,glow:.8+.2*Math.sin(t*Math.PI/1.2),progress:0};
}
export function runBehaviorChecks(assets) {
  const results=[],check=(name,fn)=>{try{const detail=fn();results.push({name,ok:true,detail});}catch(e){results.push({name,ok:false,error:e.message});}},assert=(c,m)=>{if(!c)throw Error(m);};
  check('正面阻挡与大步长防穿透',()=>{const s=createScene(assets);move(s,9,0);assert(s.player.x < -2.054,'crossed crate');assert(s.lastBlocked,'collision not signaled');return {stoppedX:s.player.x,crateFace:-1.875,playerRadius:s.player.radius};});
  check('绕箱通行、穿过格线与沿边滑动',()=>{const s=createScene(assets);move(s,1.9,0);move(s,0,1.1);move(s,4.5,0);assert(s.player.x>2,'cannot bypass');move(s,0,1);assert(!blockedAt(s,s.player.x,s.player.z),'ended overlapping');return {x:s.player.x,z:s.player.z};});
  check('圆角碰撞精度与地图边界',()=>{const s=createScene(assets),b=boxFor(s,s.crates[0]);assert(!intersectsBox(b.minX-.15,b.minZ-.15,.18,b),'false-positive square corner');assert(intersectsBox(b.minX-.1,b.minZ-.1,.18,b),'missed rounded corner');move(s,-100,-100);assert(s.player.x>=WORLD.minX+s.player.radius-1e-8&&s.player.z>=WORLD.minZ+s.player.radius-1e-8,'escaped map');return {x:s.player.x,z:s.player.z};});
  check('拾取仅一次、动画结束回收、实例独立',()=>{const s=createScene(assets);move(s,0,-1.5);move(s,1,0);assert(s.collected===1,'first pickup failed');collectNearby(s);collectNearby(s);assert(s.collected===1,'duplicate pickup');assert(s.pickups[1].status==='idle','other pickup changed');advance(s,.46);assert(s.pickups[0].status==='gone'&&pickupPose(s.pickups[0],s.time)===null,'effect leaked');return {collected:s.collected,activeEffects:0};});
  check('待机循环连续、时间输入确定',()=>{const p={phase:.4,status:'idle'},a=pickupPose(p,.7),b=pickupPose(p,3.1);assert(Math.abs(a.y-b.y)<1e-10&&Math.abs(a.glow-b.glow)<1e-10,'idle seam');assert(Math.abs(Math.sin(a.yaw)-Math.sin(b.yaw))<1e-10,'rotation seam');assert(JSON.stringify(a)===JSON.stringify(pickupPose(p,.7)),'not deterministic');return {periodSeconds:2.4};});
  check('全部拾取、无重复与可重置',()=>{const s=createScene(assets);const go=(x,z)=>{move(s,x-s.player.x,z-s.player.z);};go(-4,-1.5);go(-3,-1.5);go(-3,-2);go(.5,-2);go(1.3,-2);go(1.3,2);go(3,2);assert(s.collected===3,'cannot reach all');advance(s,1);collectNearby(s);assert(s.collected===3&&s.pickups.every(p=>p.status==='gone'),'bad cleanup');assert(createScene(assets).collected===0,'bad reset');return {collected:3};});
  return results;
}
