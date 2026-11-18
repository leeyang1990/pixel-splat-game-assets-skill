import { STRIDE, normalizeQuaternion, covariance, clamp } from './gaussians.mjs';
import { ADVENTURER_HEIGHT, ADVENTURER_RIG, ADVENTURER_CLIPS } from './character-motion.mjs';

// Faceted surface descriptions are ONLY sampling inputs, never rendered meshes.
// All emitted records are real, oriented, anisotropic 3D Gaussian ellipsoids.
const add = (a, b) => a.map((x, i) => x+b[i]);
const sub = (a, b) => a.map((x, i) => x-b[i]);
const mul = (a, s) => a.map(x => x*s);
const dot = (a, b) => a.reduce((n, x, i) => n+x*b[i], 0);
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const unit = a => mul(a, 1/Math.hypot(...a));
const lerp = (a, b, t) => a.map((x, i) => x+(b[i]-x)*t);
const mix = (a, b, t) => a.map((x, i) => x*(1-t)+b[i]*t);
const light = unit([-.45, .82, .35]);

function frame(tangent, other) {
  const x = unit(tangent), z = unit(cross(x, other)), y = cross(z, x);
  const m00=x[0], m01=y[0], m02=z[0], m10=x[1], m11=y[1], m12=z[1];
  const m20=x[2], m21=y[2], m22=z[2], trace=m00+m11+m22;
  let q, s;
  if (trace > 0) {
    s=2*Math.sqrt(trace+1); q=[(m21-m12)/s, (m02-m20)/s, (m10-m01)/s, s/4];
  } else if (m00 > m11 && m00 > m22) {
    s=2*Math.sqrt(1+m00-m11-m22); q=[s/4, (m01+m10)/s, (m02+m20)/s, (m21-m12)/s];
  } else if (m11 > m22) {
    s=2*Math.sqrt(1+m11-m00-m22); q=[(m01+m10)/s, s/4, (m12+m21)/s, (m02-m20)/s];
  } else {
    s=2*Math.sqrt(1+m22-m00-m11); q=[(m02+m20)/s, (m12+m21)/s, s/4, (m10-m01)/s];
  }
  return { q: normalizeQuaternion(q), normal: z };
}
function hash(text) {
  let n=2166136261;
  for (const c of text) n=Math.imul(n^c.charCodeAt(0), 16777619);
  return n>>>0;
}
function random(seed) {
  let n=seed>>>0;
  return () => {
    n=(n+0x6D2B79F5)|0;
    let t=Math.imul(n^(n>>>15), 1|n);
    t^=t+Math.imul(t^(t>>>7), 61|t);
    return ((t^(t>>>14))>>>0)/4294967296;
  };
}

/**
 * Angular hooded ruin explorer, feet/support Y=0, forward +Z, height 1.05.
 * spec: {id?, seed?:integer, scale?:positive number}. Seed changes weathering
 * without changing geometry, part ranges, or rig. Scale uniformly scales data,
 * pivots and anchors; multiply sampled motion translations by the same scale.
 */
export function buildAdventurer(spec = {}, style) {
  const scale = spec.scale ?? 1, seed = spec.seed ?? 73421;
  if (!Number.isFinite(scale) || scale <= 0) throw new RangeError('Adventurer scale must be positive');
  if (!Number.isInteger(seed)) throw new TypeError('Adventurer seed must be an integer');
  const c = style?.colors;
  for (const key of ['cloth', 'clothLight', 'clothDark', 'armor', 'skin', 'boots']) {
    if (!Array.isArray(c?.[key]) || c[key].length !== 3 ||
        c[key].some(v => !Number.isFinite(v) || v<0 || v>1)) {
      throw new TypeError(`Expected normalized RGB style.colors.${key}`);
    }
  }
  const rng=random(hash(`${spec.id ?? 'adventurer-red'}:${seed}`));
  const splats=[], parts=[];
  const metalDark=mix(c.armor, c.boots, .5), metalLight=mix(c.armor, c.skin, .18);
  const leather=mix(c.boots, c.skin, .16), tunic=mix(c.boots, c.armor, .19);

  function emit(position, scales, q, color, normal, opacity=.95) {
    const p=[...position], cov=covariance(scales, q), ry=3*Math.sqrt(cov[3]);
    // Keep the modeled floor and hood support exact despite 3-sigma tails.
    p[1]=Math.max(ry, Math.min(ADVENTURER_HEIGHT-ry, p[1]));
    const shade=.96+.08*rng();
    splats.push(...p.map(v=>v*scale), ...scales.map(v=>v*scale), ...q,
      ...color.map(v=>clamp(v*shade)), opacity);
  }
  function quad(a, b, d, e, color, spacing=.017, depth=.0035) {
    // Density targets a small scene actor; retain thin-feature normals while
    // increasing tangent coverage instead of emitting redundant surface splats.
    spacing *= 1.7;
    const nu=Math.max(1, Math.ceil(Math.max(Math.hypot(...sub(b,a)), Math.hypot(...sub(d,e)))/spacing));
    const nv=Math.max(1, Math.ceil(Math.max(Math.hypot(...sub(e,a)), Math.hypot(...sub(d,b)))/spacing));
    for (let v=0; v<nv; v++) for (let u=0; u<nu; u++) {
      const fu=(u+.5)/nu, fv=(v+.5)/nv;
      const lo=lerp(a,b,fu), hi=lerp(e,d,fu), left=lerp(a,e,fv), right=lerp(b,d,fv);
      const du=sub(right,left), dv=sub(hi,lo);
      if (Math.hypot(...cross(du,dv)) < 1e-10) continue;
      const {q,normal}=frame(du,dv);
      emit(lerp(lo,hi,fv), [Math.hypot(...du)/nu*.62, Math.hypot(...dv)/nv*.62, depth],
        q, typeof color==='function' ? color(fu,fv,normal) : color, normal);
    }
  }
  // Clockwise from the front: broad flat planes and clipped corners.
  function ring(y, w, front, back, x=0, z=0) {
    return [[-.68*w,front],[.68*w,front],[w,.35*front],[w,-.60*back],
      [.65*w,-back],[-.65*w,-back],[-w,-.60*back],[-w,.35*front]]
      .map(([px,pz])=>[x+px,y,z+pz]);
  }
  function loft(rings, color, spacing=.017, skip=()=>false) {
    for (let k=0; k<rings.length-1; k++) for (let i=0; i<rings[k].length; i++) {
      if (skip(k,i)) continue;
      const j=(i+1)%rings[k].length;
      quad(rings[k][i],rings[k][j],rings[k+1][j],rings[k+1][i],color,spacing);
    }
    for (const [idx, reverse] of [[0,true],[rings.length-1,false]]) {
      const r=rings[idx], center=mul(r.reduce((sum,p)=>add(sum,p),[0,0,0]),1/r.length);
      for (let i=0; i<r.length; i++) {
        const j=(i+1)%r.length;
        // Degenerate fourth corner describes a triangle sampling domain.
        if (reverse) quad(center,r[j],r[i],center,color,spacing);
        else quad(center,r[i],r[j],center,color,spacing);
      }
    }
  }
  function beam(a,b,wa,da,wb,db,color,sides=6,spacing=.017) {
    const direction=unit(sub(b,a));
    const u=unit(cross(Math.abs(direction[2])<.9 ? [0,0,1] : [0,1,0],direction));
    const v=cross(direction,u);
    const r=(p,w,d)=>Array.from({length:sides},(_,i)=>{
      const angle=2*Math.PI*(i+.5)/sides;
      return add(p,add(mul(u,Math.cos(angle)*w),mul(v,Math.sin(angle)*d)));
    });
    loft([r(a,wa,da),r(b,wb,db)],color,spacing);
  }
  function group(name, build) {
    const start=splats.length/STRIDE;
    build();
    parts.push({name,start,count:splats.length/STRIDE-start,pivot:ADVENTURER_RIG[name].map(v=>v*scale)});
  }

  group('pelvis',()=>{
    loft([ring(.447,.098,.057,.062),ring(.536,.109,.068,.07)],tunic);
    loft([ring(.526,.113,.075,.075),ring(.554,.113,.075,.075)],leather,.014);
    quad([-.018,.530,.079],[.018,.530,.079],[.018,.551,.080],[-.018,.551,.080],metalLight,.010);
    for (const side of [-1,1]) {
      quad([side*.012,.438,.064],[side*.09,.456,.06],
        [side*.105,.526,.069],[side*.018,.526,.075],metalDark,.014);
    }
    // Slender hip scabbard with an angular chape and a wrapped grip.
    beam([.125,.518,-.025],[.218,.255,-.037],.023,.018,.014,.013,c.boots,4,.014);
    beam([.210,.278,-.036],[.222,.247,-.039],.019,.018,.011,.011,metalDark,4,.012);
    beam([.122,.527,-.024],[.096,.605,-.020],.013,.012,.013,.012,leather,6,.012);
    beam([.085,.523,-.025],[.156,.548,-.025],.009,.009,.009,.009,metalLight,4,.010);
  });
  group('torso',()=>{
    loft([ring(.548,.105,.065,.061),ring(.680,.133,.081,.073),
      ring(.768,.148,.066,.068),ring(.812,.065,.045,.048)],tunic);
    // Tapered breastplate and offset overlapping shoulder plates.
    quad([-.078,.585,.078],[.078,.585,.078],[.115,.741,.080],[-.115,.741,.080],
      (u,v)=>mix(metalDark,c.armor,.35+.3*v),.016);
    quad([-.115,.741,.080],[.115,.741,.080],[.082,.778,.058],[-.078,.786,.058],metalLight,.015);
    loft([ring(.742,.055,.056,.055,-.147),ring(.790,.068,.053,.058,-.147),
      ring(.817,.035,.035,.035,-.132)],c.armor,.014);
    beam([.105,.763,.089],[-.089,.562,.084],.014,.007,.014,.007,leather,4,.013);
    loft([ring(.790,.077,.048,.055),ring(.829,.072,.043,.050)],c.clothDark,.014);
    quad([-.014,.793,.053],[.014,.793,.053],[.014,.814,.050],[-.014,.814,.050],metalLight,.010);
  });
  group('head',()=>{
    // Rounded pale helmet/head, matching the small bright silhouette in the reference.
    loft([ring(.842,.055,.050,.050),ring(.875,.071,.062,.065),
      ring(.961,.074,.067,.066),ring(1.012,.046,.045,.044),ring(1.044,.006,.008,.008)],
      (u,v,n)=>n[2]>.25 ? c.skin : mix(c.armor,c.skin,.62),.012);
    quad([-.046,.909,.071],[.046,.909,.071],[.047,.925,.073],[-.047,.925,.073],metalDark,.009,.0018);
    beam([0,.903,.074],[0,.935,.078],.006,.004,.005,.004,c.skin,4,.008);
    loft([ring(.835,.058,.048,.052),ring(.856,.061,.051,.055)],metalDark,.013);
  });
  for (const [side,sign] of [['left',-1],['right',1]]) {
    const shoulder=ADVENTURER_RIG[`${side}UpperArm`], elbow=ADVENTURER_RIG[`${side}Forearm`];
    const wrist=[sign*.184,.502,.043];
    group(`${side}UpperArm`,()=>{
      beam(shoulder,elbow,.046,.041,.033,.032,tunic);
      beam(lerp(shoulder,elbow,.16),lerp(shoulder,elbow,.45),.047,.043,.041,.037,
        side==='left' ? metalDark : c.clothDark,6,.015);
    });
    group(`${side}Forearm`,()=>{
      beam(elbow,wrist,.034,.032,.025,.024,leather);
      beam(lerp(elbow,wrist,.20),lerp(elbow,wrist,.82),.036,.033,.029,.027,metalDark,5,.014);
      beam(wrist,add(wrist,[0,-.044,.008]),.026,.023,.024,.019,c.skin,5,.013);
      if(side==='right'){
        beam([.188,.477,.075],[.28,.508,.075],.009,.009,.009,.009,leather,5,.012);
        beam([.282,.475,.075],[.264,.545,.075],.006,.006,.006,.006,metalLight,4,.01);
        beam([.282,.509,.075],[.75,.67,.075],.013,.005,.0008,.0008,mix(c.skin,c.armor,.35),4,.014);
      }
    });
    group(`${side}Thigh`,()=>{
      beam(ADVENTURER_RIG[`${side}Thigh`],ADVENTURER_RIG[`${side}Shin`],
        .054,.047,.037,.034,tunic,6,.017);
    });
    group(`${side}Shin`,()=>{
      const knee=ADVENTURER_RIG[`${side}Shin`], ankle=ADVENTURER_RIG[`${side}Boot`];
      beam(knee,ankle,.036,.033,.028,.027,c.boots,6,.016);
      beam(add(knee,[0,-.008,.028]),add(ankle,[0,.027,.023]),
        .026,.012,.020,.010,metalDark,5,.014);
    });
    group(`${side}Boot`,()=>{
      loft([ring(.004,.046,.111,.052,sign*.067),ring(.047,.046,.114,.052,sign*.067),
        ring(.105,.033,.035,.036,sign*.067),ring(.145,.032,.029,.032,sign*.067)],c.boots,.014);
      quad([sign*.067-.030,.048,.110],[sign*.067+.030,.048,.110],
        [sign*.067+.023,.074,.073],[sign*.067-.023,.074,.073],metalDark,.012);
    });
  }

  function capePoint(u,t,lining=false) {
    const fold=.014*Math.cos(u*Math.PI*5)*(.2+.8*t);
    const tooth=1-Math.abs(((u+1)*3)%2-1);
    return [u*(.13+.105*t),.798-.55*t+.022*Math.pow(t,7)*tooth,
      -.095-.137*t+fold+(lining ? .006 : 0)];
  }
  for (const [name,lo,hi] of [['capeLeft',-1,-.29],['capeCenter',-.35,.35],['capeRight',.29,1]]) {
    group(name,()=>{
      // Overlapping narrow strips give cloth thickness and independently moving hems.
      const nu=12,nv=34;
      for (const lining of [false,true]) for (let v=0;v<nv;v++) for (let u=0;u<nu;u++) {
        const a=lo+(hi-lo)*u/nu, b=lo+(hi-lo)*(u+1)/nu;
        const t=v/nv, s=(v+1)/nv;
        let points=[capePoint(a,t,lining),capePoint(b,t,lining),capePoint(b,s,lining),capePoint(a,s,lining)];
        if (lining) points=[points[1],points[0],points[3],points[2]];
        const ridge=(Math.cos((a+b)/2*Math.PI*5)+1)/2;
        const color=lining ? c.clothDark : mix(c.cloth,c.clothLight,.15+.55*ridge);
        quad(...points,color,.024,.0024);
      }
      // A continuous darker binding emphasizes the slanted, cut hem.
      for(let u=0;u<nu;u++) {
        const a=lo+(hi-lo)*u/nu,b=lo+(hi-lo)*(u+1)/nu;
        quad(capePoint(a,.968),capePoint(b,.968),capePoint(b,1),capePoint(a,1),c.clothDark,.018,.0027);
      }
    });
  }
  if (splats.length/STRIDE > 8000) throw new RangeError(`Adventurer exceeds 8000-Gaussian budget (${splats.length/STRIDE}; ${parts.map(p=>`${p.name}:${p.count}`).join(', ')})`);
  const anchors={
    base:[0,0,0], head:[0,1.01,0], leftHand:[-.184,.480,.047], rightHand:[.184,.480,.047],
    leftFoot:[-.067,0,.025], rightFoot:[.067,0,.025], cape:[0,.798,-.095],
    weaponGrip:[.108,.568,-.022],
    heldWeaponGrip:[.225,.49,.075],
  };
  return {
    animationBounds:{min:[-.32,-.06,-.41].map(v=>v*scale),max:[.32,1.12,.28].map(v=>v*scale)},
    data:{version:1,type:'gaussian-splats',stride:STRIDE,splats}, parts,
    anchors:Object.fromEntries(Object.entries(anchors).map(([k,p])=>[k,p.map(v=>v*scale)])),
    clips:ADVENTURER_CLIPS.map(clip=>({...clip,events:clip.events.map(event=>({...event}))})),
  };
}
