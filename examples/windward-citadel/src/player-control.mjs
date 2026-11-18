import {ExplorerController} from './explorer.mjs';
import {samplePerformance} from './scene-motion.mjs';
import {ADVENTURER_CLIPS} from './character-motion.mjs';

const STAIR_TREADS = 8;
const TREAD_RUN = .23;
const TREAD_RISE = .075;
const STAIR_HALF_WIDTH = .968;
const BRIDGE_HALF_WIDTH = .908;
const BRIDGE_HALF_LENGTH = 1.505;
const BRIDGE_DECK_HEIGHT = .27;
const PLAYER_RADIUS = .12;
const FIRE_RANGE = .68;
const REACH_DURATION = ADVENTURER_CLIPS.find(clip=>clip.name==='inspect-light').duration;
const footprint = [[0,0],[1,0],[-1,0],[0,1],[0,-1],[Math.SQRT1_2,Math.SQRT1_2],[-Math.SQRT1_2,Math.SQRT1_2],[Math.SQRT1_2,-Math.SQRT1_2],[-Math.SQRT1_2,-Math.SQRT1_2]];

// The bridge and the lower stair flight are axis-aligned in this scene. Dimensions
// match build.py. Samples combine both supports at the little overlapping landing.
export function createWalkway(items) {
  const stairs=items.find(item=>item.id==='lower-steps');
  const bridge=items.find(item=>item.id==='bridge');
  if (!stairs||!bridge) throw Error('旅人控制需要下段石阶与桥面');
  const [sx,sy,sz]=stairs.position,[bx,by,bz]=bridge.position;
  const ss=stairs.scale??1,bs=bridge.scale??1;
  const stairHalfLength=STAIR_TREADS*TREAD_RUN*ss/2;
  const stairRun=TREAD_RUN*ss;
  const minStairZ=sz-stairHalfLength;
  function support(x,z) {
    let y=null;
    if(Math.abs(x-sx)<=STAIR_HALF_WIDTH*ss&&Math.abs(z-sz)<=stairHalfLength){
      const tread=Math.min(STAIR_TREADS-1,Math.max(0,Math.floor((z-minStairZ)/stairRun)));
      y=sy+(STAIR_TREADS-tread)*TREAD_RISE*ss;
    }
    if(Math.abs(x-bx)<=BRIDGE_HALF_WIDTH*bs&&Math.abs(z-bz)<=BRIDGE_HALF_LENGTH*bs){
      y=Math.max(y??-Infinity,by+BRIDGE_DECK_HEIGHT*bs);
    }
    return y;
  }
  return {
    support,
    canOccupy:(x,z,radius)=>footprint.every(([dx,dz])=>support(x+dx*radius,z+dz*radius)!==null),
  };
}

export function screenDirection(horizontal,vertical,yaw){
  // World vectors corresponding to camera right and screen up along the floor.
  const sin=Math.sin(yaw), cos=Math.cos(yaw);
  return {x:cos*horizontal-sin*vertical,z:-sin*horizontal-cos*vertical};
}

const mixAngle=(from,to,weight)=>from+Math.atan2(Math.sin(to-from),Math.cos(to-from))*weight;

export function createPlayerControl(items, actor){
  const walkway=createWalkway(items);
  const fire=items.find(item=>item.id==='grace');
  if(!fire)throw Error('旅人控制需要余火位置');
  const spawn=actor.position.slice();
  spawn[1]=walkway.support(spawn[0],spawn[2])??spawn[1];
  const spawnYaw=actor.yaw??0;
  const [fx,fy,fz]=fire.position;
  let reaching=null, actionWasDown=false;
  const piers=items.filter(item=>item.id==='broken-pier-2'||item.id==='broken-pier-3').map(item=>{
    const [x,y,z]=item.position, scale=item.scale??1;
    return {center:[x,y+.50*scale,z],size:[.63*scale,1.0*scale,.61*scale]};
  });
  const controller=new ExplorerController({
    spawn,speed:.70,radius:PLAYER_RADIUS,boundsRadius:20,
    groundHeight:(x,z)=>walkway.support(x,z)??spawn[1],
    canOccupy:walkway.canOccupy,
    obstacles:[...piers,{center:[fx,fy+.22,fz],size:[.23,.44,.23]}],
    interactables:[{id:'grace',label:'抬手探光',position:[fx,fy+.25,fz],radius:FIRE_RANGE,
      onInteract:({time})=>{
        const s=controller.state;
        reaching={start:time,from:s.yaw,to:Math.atan2(fx-s.position[0],fz-s.position[2])};
      }}],
  });
  controller.state.yaw=spawnYaw;

  return {
    state:controller.state,
    reset(){
      controller.reset();controller.state.yaw=spawnYaw;reaching=null;actionWasDown=false;
    },
    step(dt,{horizontal=0,vertical=0,action=false}={},yaw,time){
      const wasReaching=!!reaching;
      if(reaching&&time-reaching.start>=REACH_DURATION){
        controller.state.yaw=reaching.to;reaching=null;
      }
      // Treat action as a press edge, including taps between graphics frames.
      const pressed=action&&!actionWasDown&&!wasReaching;
      actionWasDown=!!action;
      const dir=reaching||pressed?{x:0,z:0}:screenDirection(horizontal,vertical,yaw);
      // Explorer uses a level signal and detects its rising edge. A key press
      // accepted here can therefore fire just once, even when held to repeat.
      const s=controller.step(dt,{...dir,interact:pressed},time);
      const requested=!!(horizontal||vertical);
      if(reaching){
        const elapsed=time-reaching.start;
        const p=samplePerformance('inspect-light',elapsed,[...s.position],s.yaw,false);
        const t=Math.min(1,elapsed/.38);
        return {...p,clip:'inspect-light',yaw:mixAngle(reaching.from,reaching.to,t*t*(3-2*t)),nearFire:!!s.prompt,blocked:false};
      }
      const seconds=s.clip==='walk'?s.animationTime*.66:s.animationTime;
      return {...samplePerformance(s.clip,seconds,[...s.position],s.yaw,false),clip:s.clip,nearFire:!!s.prompt,blocked:requested&&!s.moving&&!pressed};
    },
  };
}
