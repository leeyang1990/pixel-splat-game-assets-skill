// Seconds, +Y up, +Z forward. All pivots/translations are whole-asset local.
// The sampler returns independent transforms; the consumer must NOT parent them.
// p' = root + pivot + rotation * (p - pivot) + translation.
// Rotate each Gaussian's covariance by the same part rotation as its center.
const TAU = Math.PI * 2;
const frozen = (value) => Object.freeze(value);
export const ADVENTURER_HEIGHT = 1.05;
export const ADVENTURER_RIG = frozen(Object.fromEntries(Object.entries({
  pelvis: [0, .49, 0], torso: [0, .55, 0], head: [0, .825, 0],
  leftUpperArm: [-.16, .765, 0], rightUpperArm: [.16, .765, 0],
  leftForearm: [-.19, .610, .018], rightForearm: [.19, .610, .018],
  leftThigh: [-.067, .49, 0], rightThigh: [.067, .49, 0],
  leftShin: [-.067, .29, .018], rightShin: [.067, .29, .018],
  leftBoot: [-.067, .11, .006], rightBoot: [.067, .11, .006],
  capeLeft: [-.077, .798, -.095], capeCenter: [0, .798, -.095],
  capeRight: [.077, .798, -.095],
}).map(([name, p]) => [name, frozen(p)])));

export const ADVENTURER_ANCHOR_PARTS = frozen({
  head: 'head', leftHand: 'leftForearm', rightHand: 'rightForearm',
  leftFoot: 'leftBoot', rightFoot: 'rightBoot', cape: 'torso',
  weaponGrip: 'pelvis',
  heldWeaponGrip: 'rightForearm',
});
export const ADVENTURER_CLIPS = frozen([
  frozen({ name: 'idle', duration: 4, loop: true, inPlace: true,
    file: 'src/character-motion.mjs', events: frozen([]) }),
  frozen({name:'interact',duration:1,loop:false,inPlace:true,file:'src/character-motion.mjs',events:frozen([{name:'activate',time:.45}])}),
  frozen({name:'look-around',duration:3.6,loop:false,inPlace:true,file:'src/character-motion.mjs',events:frozen([])}),
  frozen({name:'inspect-light',duration:2.8,loop:false,inPlace:true,file:'src/character-motion.mjs',events:frozen([{name:'light-pulse',time:1.16}])}),
  frozen({ name: 'walk', duration: 1.2, loop: true, inPlace: true,
    file: 'src/character-motion.mjs', events: frozen([
      frozen({ name: 'footstep-right', time: 0 }),
      frozen({ name: 'footstep-left', time: .6 }),
    ]) }),
]);

const add = (a, b) => a.map((x, i) => x + b[i]);
const sub = (a, b) => a.map((x, i) => x - b[i]);
const mul = (a, s) => a.map(x => x * s);
const dot = (a, b) => a.reduce((n, x, i) => n + x * b[i], 0);
const axis = (i, angle) => {
  const q = [0, 0, 0, Math.cos(angle / 2)];
  q[i] = Math.sin(angle / 2); return q;
};
function multiply(a, b) {
  const [x, y, z, w] = a, [u, v, s, t] = b;
  return [w*u+x*t+y*s-z*v, w*v-x*s+y*t+z*u,
    w*s+x*v-y*u+z*t, w*t-x*u-y*v-z*s];
}
function rotate(q, p) {
  const [x, y, z, w] = q, [a, b, c] = p;
  const u = 2 * (y*c-z*b), v = 2 * (z*a-x*c), s = 2 * (x*b-y*a);
  return [a+w*u+y*s-z*v, b+w*v+z*u-x*s, c+w*s+x*v-y*u];
}
const around = (point, pivot, q, translation) =>
  add(add(pivot, rotate(q, sub(point, pivot))), translation);
const zero = () => [0, 0, 0];
const identity = () => [0, 0, 0, 1];
const ease = value => {
  const t=Math.min(1,Math.max(0,value));
  return t*t*(3-2*t);
};
function gesture(time, begin, rise, hold, end) {
  return ease((time-begin)/(rise-begin))*(1-ease((time-hold)/(end-hold)));
}


function bendAngle(rest, target) {
  return Math.atan2(rest[1]*target[2]-rest[2]*target[1], dot(rest, target));
}

// Solve in the sagittal plane, then flatten the chain into independent poses.
function leg(parts, side, phase, rootY, pelvisTranslation) {
  const hip = ADVENTURER_RIG[`${side}Thigh`];
  const knee = ADVENTURER_RIG[`${side}Shin`];
  const ankle = ADVENTURER_RIG[`${side}Boot`];
  const lift = .055 * Math.pow(Math.max(0, Math.sin(phase)), 1.4);
  const ankleMoved = add(ankle, [0, lift-rootY, -.125*Math.cos(phase)]);
  const hipMoved = add(hip, pelvisTranslation);
  const upperRest = sub(knee, hip), lowerRest = sub(ankle, knee);
  const a = Math.hypot(...upperRest), b = Math.hypot(...lowerRest);
  const direction = sub(ankleMoved, hipMoved), d = Math.hypot(...direction);
  // This gait stays within reach; guard roundoff at nearly straight poses.
  const u = mul(direction, 1/d);
  const along = (a*a-b*b+d*d)/(2*d);
  const h = Math.sqrt(Math.max(0, a*a-along*along));
  const kneeMoved = add(add(hipMoved, mul(u, along)), mul([0, u[2], -u[1]], h));
  parts[`${side}Thigh`] = { rotation: axis(0, bendAngle(upperRest, sub(kneeMoved, hipMoved))),
    translation: sub(hipMoved, hip) };
  parts[`${side}Shin`] = { rotation: axis(0, bendAngle(lowerRest, sub(ankleMoved, kneeMoved))),
    translation: sub(kneeMoved, knee) };
  parts[`${side}Boot`] = { rotation: axis(0, -.14*lift/.055),
    translation: sub(ankleMoved, ankle) };
}

/**
 * Deterministic, stateless, in-place poses in 1.05-unit authoring space.
 * For a buildAdventurer({scale:s}) variant multiply root and all translations
 * by s; rotations stay identical. No frame delta, randomness, or wall clock.
 */
export function sampleAdventurerPose(time, clip = 'idle') {
  if (!Number.isFinite(time)) throw new TypeError('Animation time must be finite seconds');
  const definition = ADVENTURER_CLIPS.find(c => c.name === clip);
  if (!definition) throw new RangeError(`Unknown adventurer clip: ${clip}`);
  const t = definition.loop ? ((time % definition.duration) + definition.duration) % definition.duration : Math.max(0,Math.min(definition.duration,time));
  const phase = TAU*t/definition.duration, walking = clip === 'walk';
  const inspecting = clip === 'inspect-light';
  const reach = inspecting ? gesture(t,.15,.92,1.60,2.65) : 0;
  const turn = clip === 'look-around' ? .94*gesture(t,.08,.72,1.07,1.65)-.79*gesture(t,1.49,2.13,2.72,3.5) : 0;
  const root = [0, walking ? .006*(1-Math.cos(2*phase)) : 0, 0];
  const pelvisTranslation = [0, walking ? -.023 : 0, 0];
  const breath = walking ? .0015*Math.sin(2*phase) : .0025*Math.sin(phase);
  const torsoTranslation = add(pelvisTranslation, [0, breath, 0]);
  const torsoRotation = multiply(axis(1,(walking?.035:.012)*Math.sin(phase)+turn*.25+reach*.19),
    multiply(axis(0,reach*.17),axis(2,(walking?.014:.007)*Math.sin(phase)+reach*.08)));
  const parts = Object.fromEntries(Object.keys(ADVENTURER_RIG).map(name =>
    [name, { rotation: identity(), translation: zero() }]));
  parts.pelvis.translation = pelvisTranslation;
  parts.torso = { rotation: torsoRotation, translation: torsoTranslation };
  const attach = p => around(p, ADVENTURER_RIG.torso, torsoRotation, torsoTranslation);
  parts.head = {
    rotation: multiply(torsoRotation, multiply(axis(1,(walking?.045:.065)*Math.sin(phase+.3)+turn*.62-reach*.22),
      axis(0,.012*Math.sin(2*phase)-reach*.24))),
    translation: sub(attach(ADVENTURER_RIG.head), ADVENTURER_RIG.head),
  };
  for (const [side, offset] of [['left', 0], ['right', Math.PI]]) {
    const p = phase+offset, shoulder = ADVENTURER_RIG[`${side}UpperArm`];
    const elbow = ADVENTURER_RIG[`${side}Forearm`];
    let upperRotation = multiply(torsoRotation,
      axis(0, walking ? -.38*Math.cos(p) : .028*Math.sin(p+.4)));
    if (clip==='interact'&&side==='right') upperRotation=multiply(torsoRotation,axis(0,-1.12*Math.sin(Math.PI*t/definition.duration)));
    if (reach && side==='right') {
      upperRotation=multiply(torsoRotation,multiply(axis(2,.24*reach),axis(0,-1.26*reach)));
    } else if (reach) {
      upperRotation=multiply(upperRotation,axis(0,.25*reach));
    }
    const shoulderMoved = attach(shoulder);
    const elbowMoved = add(shoulderMoved, rotate(upperRotation, sub(elbow, shoulder)));
    parts[`${side}UpperArm`] = { rotation: upperRotation,
      translation: sub(shoulderMoved, shoulder) };
    parts[`${side}Forearm`] = {
      rotation: multiply(upperRotation, axis(0,
        walking ? -.08-.14*Math.max(0,Math.sin(p)) : -.025+.018*Math.sin(p)-(side==='right'?.63*reach:0))),
      translation: sub(elbowMoved, elbow),
    };
    if (walking) leg(parts, side, p, root[1], pelvisTranslation);
  }
  for (const [i, name] of ['capeLeft', 'capeCenter', 'capeRight'].entries()) {
    const p = phase+i*.62, pivot = ADVENTURER_RIG[name];
    const flutter = (walking ? .085 : .028)*Math.sin(2*p)
      + (walking ? .025 : .012)*Math.sin(p);
    const wind = multiply(axis(0, (walking ? .05 : .014)+flutter),
      multiply(axis(1, .022*Math.sin(p+.5)), axis(2, .016*Math.sin(p))));
    parts[name] = { rotation: multiply(torsoRotation, wind),
      translation: sub(attach(pivot), pivot) };
  }
  return { root, parts };
}
