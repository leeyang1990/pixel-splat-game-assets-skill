import { ADVENTURER_CLIPS, sampleAdventurerPose } from './character-motion.mjs';

const TAU=2*Math.PI;
const PATROL_DURATION=12.8;
const REST_Z=5.46;
const TURN_Z=2.61;
const WALK_SPEED=(REST_Z-TURN_Z)/(PATROL_DURATION/2);
export const PERFORMANCES=Object.freeze([
  {id:'idle',label:'静立'},
  {id:'look-around',label:'驻足环顾'},
  {id:'walk',label:'桥上巡游'},
  {id:'inspect-light',label:'抬手探光'},
]);

function stepHeight(z) {
  if (z<=4.22) return .25;
  const tread=Math.max(0,Math.min(7,Math.round((z-5.07)/(.23*1.06)+3.5)));
  return -.39+(8-tread)*.075*1.06;
}

export function samplePerformance(clip, seconds, position, yaw, patrol) {
  const elapsed=Math.max(0,seconds);
  const duration=ADVENTURER_CLIPS.find(c=>c.name===clip).duration;
  const complete=clip!=='idle' && clip!=='walk' && elapsed>=duration;
  const pose=sampleAdventurerPose(elapsed,clip);
  let actorPosition=position, actorYaw=yaw;
  if (clip==='walk' && patrol) {
    const cycle=elapsed%PATROL_DURATION, half=PATROL_DURATION/2, outbound=cycle<half;
    const z=REST_Z-WALK_SPEED*(outbound?cycle:PATROL_DURATION-cycle);
    actorPosition=[.20,stepHeight(z),z];
    actorYaw=outbound?Math.PI-.03:-.03;
  } else if (clip==='inspect-light' && patrol) {
    // Turn from the resting heading towards the nearby fire during the gesture.
    const turn=Math.sin(Math.PI*Math.min(1,elapsed/duration))**1.6;
    actorYaw=yaw+(4.29-yaw)*turn;
  } else if (clip==='look-around' && patrol) {
    actorYaw=yaw+.25*Math.sin(TAU*Math.min(1,elapsed/duration))*Math.sin(Math.PI*Math.min(1,elapsed/duration));
  }
  const pulseTime=ADVENTURER_CLIPS.find(c=>c.name==='inspect-light').events[0].time;
  const after=elapsed-pulseTime;
  const pulse=clip==='inspect-light'&&after>=0 ? Math.max(0,Math.sin(Math.PI*Math.min(1,after/.95))) : 0;
  return {pose,position:actorPosition,yaw:actorYaw,pulse,complete,elapsed};
}
