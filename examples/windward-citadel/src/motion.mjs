export const AMBIENT_CLIPS={beam:{name:'shimmer',duration:5,loop:true,file:'src/motion.mjs'},motes:{name:'drift',duration:8,loop:true,file:'src/motion.mjs'}};
export const BEAM_FREQUENCY=2*Math.PI/AMBIENT_CLIPS.beam.duration;
export const MOTE_FREQUENCY=2*Math.PI/AMBIENT_CLIPS.motes.duration;
export function sampleAmbient(kind,time,phase=0){
 if(kind==='beam')return{offset:[0,0,0],opacity:.92+.08*Math.sin(time*BEAM_FREQUENCY+phase)};
 if(kind==='motes')return{offset:[.035*Math.sin(time*MOTE_FREQUENCY+phase),.08*Math.sin(time*MOTE_FREQUENCY*2+phase),.035*Math.cos(time*MOTE_FREQUENCY+phase)],opacity:.65+.35*Math.sin(time*MOTE_FREQUENCY*3+phase*3)};
 throw Error(`Unknown ambient motion ${kind}`);
}
