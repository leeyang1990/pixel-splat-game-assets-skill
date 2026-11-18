// Local-space animation. Upload and sorting use the same material IDs as the shader.
const TAU = 2 * Math.PI;
const LEAF_PERIOD = 6;
const EMBER_PERIOD = 3.8;
const MIST_PERIOD = 11;

export const PARTICLE_KINDS = Object.freeze({'falling-leaf':7, 'rising-ember':8, 'flow-mist':9});
export const PARTICLE_EFFECTS = Object.freeze({
  'falling-leaf': {name:'fall', duration:LEAF_PERIOD, padding:[1.50,1.16,.24], tumble:true},
  'rising-ember': {name:'rise', duration:EMBER_PERIOD, padding:[.54,1.28,.20]},
  'flow-mist': {name:'flow', duration:MIST_PERIOD, padding:[.62,.064,.115]},
});

// CPU sorting needs the same center used for GPU projection. The renderer reuses `out`.
export function sampleParticle(kind, time, phase, out = [0,0,0,1]) {
  const progress = duration => {
    const cycle = time / duration + phase / TAU;
    return cycle - Math.floor(cycle);
  };
  if (kind === PARTICLE_KINDS['falling-leaf']) {
    const t = progress(LEAF_PERIOD), a = TAU*t;
    out[0]=1.28*t+.15*Math.sin(a+phase);
    out[1]=-1.08*t+.065*Math.sin(a*2+phase);
    out[2]=.20*Math.sin(a+phase*.8);
    out[3]=Math.sin(Math.PI*t)**1.15;
  } else if (kind === PARTICLE_KINDS['rising-ember']) {
    const t = progress(EMBER_PERIOD), a = TAU*t;
    out[0]=.43*t+.09*Math.sin(a*2+phase);
    out[1]=1.25*t;
    out[2]=.17*Math.sin(a*1.2+phase);
    out[3]=Math.sin(Math.PI*t)**1.55;
  } else if (kind === PARTICLE_KINDS['flow-mist']) {
    const a = TAU*time/MIST_PERIOD+phase;
    out[0]=.59*Math.sin(a);
    out[1]=.06*Math.sin(a*2);
    out[2]=.11*Math.cos(a);
    out[3]=.85+.15*Math.sin(a);
  } else {
    throw new RangeError(`Unknown particle material kind ${kind}`);
  }
  return out;
}

export const PARTICLE_GLSL = `
vec4 particleMotion(int kind, float time, float phase) {
 if (kind == ${PARTICLE_KINDS['falling-leaf']}) {
  float t=fract(time/${LEAF_PERIOD.toFixed(1)}+phase/${TAU}), a=${TAU}*t;
  return vec4(1.28*t+.15*sin(a+phase),-1.08*t+.065*sin(a*2.+phase),.20*sin(a+phase*.8),pow(max(0.,sin(${Math.PI}*t)),1.15));
 }
 if (kind == ${PARTICLE_KINDS['rising-ember']}) {
  float t=fract(time/${EMBER_PERIOD.toFixed(1)}+phase/${TAU}), a=${TAU}*t;
  return vec4(.43*t+.09*sin(a*2.+phase),1.25*t,.17*sin(a*1.2+phase),pow(max(0.,sin(${Math.PI}*t)),1.55));
 }
 if (kind == ${PARTICLE_KINDS['flow-mist']}) {
  float a=${TAU}*time/${MIST_PERIOD.toFixed(1)}+phase;
  return vec4(.59*sin(a),.06*sin(a*2.),.11*cos(a),.85+.15*sin(a));
 }
 return vec4(0.,0.,0.,1.);
}
mat3 leafTumble(float time,float phase) {
 float angle=1.23*sin(time*${TAU}/${LEAF_PERIOD.toFixed(1)}+phase);
 float c=cos(angle),s=sin(angle);
 return mat3(c,s,0.,-s,c,0.,0.,0.,1.);
}
`;
