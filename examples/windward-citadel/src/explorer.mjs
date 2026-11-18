/**
 * Portable, +Y-up explorer movement. No renderer, DOM, clock, or dependencies.
 *
 * step(dt, {x, z, interact}, time) returns the live `state` object. x/z are a
 * world-space direction (any nonzero direction moves at `speed`). `time`, when
 * supplied, is the END of this step in seconds; otherwise a local clock is used.
 * position is a foot position; yaw=0 faces +Z, positive yaw turns toward +X.
 * prompt is a label string ('' outside range); interactions is a resettable count.
 * onInteract receives {id, label, position, time, interactions}; position is a copy.
 * onRipple receives (x, z, contactTime). All callbacks run after state is updated.
 *
 * Optional canOccupy(x,z,radius) rejects a swept substep outside walkable floor.
 * Ground is authoritative: support is the highest of nine samples under the
 * circular footprint. This lets the footprint mount a ground-defined slab even
 * when the same slab has a box collider. Displayed Y eases toward that support;
 * collision uses the higher of support and displayed foot Y. Boxes whose top is
 * at/below the foot do not block. No gravity, maximum step height, or ceilings.
 *
 * Walk time advances .6 animation seconds per .15 units of actual horizontal
 * travel, retaining gait phase through idle. Idle time advances in seconds.
 * Contacts share that distance phase, including dry contacts and partial steps.
 * At most eight ripples are dispatched per call; excess contacts are discarded,
 * never queued. Movement is bounded to 4096 spatial substeps per call (.03 units
 * each at default radius); excessive lag drops excess movement time. Idle and
 * height settling still consume dt. Normal dt is neither clamped nor quantized.
 *
 * reset([spawn]) teleports and clears state; setSpawn(spawn) also changes the
 * stored reset point. Both return state. Finite supplied spawn Y is preserved
 * until step() eases it to ground. Reset points are constrained to the basin.
 */

const EPS = 1e-10;
const CONTACT_DISTANCE = .15;
const ANIMATION_PER_DISTANCE = .6 / CONTACT_DISTANCE;
const MAX_SUBSTEPS = 4096;
const MAX_RIPPLES = 8;
const HEIGHT_RESPONSE = 14;
const DIAGONAL = Math.SQRT1_2;
const FOOT_SAMPLES = [
  [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1],
  [DIAGONAL, DIAGONAL], [-DIAGONAL, DIAGONAL],
  [DIAGONAL, -DIAGONAL], [-DIAGONAL, -DIAGONAL],
];

const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const nonnegative = (value, fallback) => Number.isFinite(value) && value >= 0 ? value : fallback;
const clockAdd = (a, b) => Math.max(-Number.MAX_SAFE_INTEGER,
  Math.min(Number.MAX_SAFE_INTEGER, a + b));
const settleHeight = (height, support, dt) => {
  const weight = -Math.expm1(-HEIGHT_RESPONSE * dt);
  // A convex blend avoids overflow in (support - height) for finite extremes.
  return height * (1 - weight) + support * weight;
};

function direction(x, z) {
  // Scale first so finite input near Number.MAX_VALUE cannot overflow hypot.
  const scale = Math.max(Math.abs(x), Math.abs(z));
  if (!scale) return [0, 0];
  x /= scale;
  z /= scale;
  const length = Math.hypot(x, z);
  return [x / length, z / length];
}

export class ExplorerController {
  constructor({
    spawn = [0, 0, 0], speed = .48, radius = .12, boundsRadius = 3.5,
    groundHeight = () => 0, obstacles = [], interactables = [],
    waterLevel = .035, onRipple = null, canOccupy = null,
  } = {}) {
    this.speed = nonnegative(speed, .48);
    this.radius = Math.max(1e-6, nonnegative(radius, .12));
    this.boundsRadius = nonnegative(boundsRadius, 3.5);
    this.groundHeight = typeof groundHeight === 'function' ? groundHeight : () => 0;
    this.waterLevel = finite(waterLevel, .035);
    this.canOccupy = typeof canOccupy === 'function' ? canOccupy : null;
    this.onRipple = typeof onRipple === 'function' ? onRipple : null;
    this.interactables = Array.isArray(interactables) ? interactables.slice() : [];
    this.obstacles = (Array.isArray(obstacles) ? obstacles : []).flatMap(box => {
      if (!box || ![0, 1, 2].every(i =>
        Number.isFinite(box.center?.[i]) && Number.isFinite(box.size?.[i]) && box.size[i] >= 0)) return [];
      const lo = box.center.map((value, i) => value - box.size[i] / 2);
      const hi = box.center.map((value, i) => value + box.size[i] / 2);
      return [...lo, ...hi].every(Number.isFinite) ? [{lo, hi}] : [];
    });
    this.state = {
      position: [0, 0, 0], yaw: 0, clip: 'idle', animationTime: 0,
      moving: false, prompt: '', interactions: 0,
    };
    this._spawn = [0, 0, 0];
    this.setSpawn(spawn);
  }

  _limit(x, z) {
    const limit = Math.max(0, this.boundsRadius - this.radius);
    if (!limit) return [0, 0];
    const distance = Math.hypot(x, z);
    if (distance <= limit) return [x, z];
    const [nx, nz] = direction(x, z);
    return [nx * limit, nz * limit];
  }

  _supportAt(x, z) {
    let height = -Infinity;
    for (const [sx, sz] of FOOT_SAMPLES) {
      height = Math.max(height, finite(this.groundHeight(x + sx * this.radius, z + sz * this.radius)));
    }
    return height;
  }

  setSpawn(spawn) {
    this._spawn = [0, 1, 2].map(i => finite(spawn?.[i], this._spawn[i]));
    return this.reset();
  }

  reset(spawn = this._spawn) {
    const [x, z] = this._limit(finite(spawn?.[0], this._spawn[0]), finite(spawn?.[2], this._spawn[2]));
    this._support = this._supportAt(x, z);
    this.state.position.splice(0, 3, x, finite(spawn?.[1], this._support), z);
    Object.assign(this.state, {
      yaw: 0, clip: 'idle', animationTime: 0, moving: false, prompt: '', interactions: 0,
    });
    this._walkTime = 0;
    this._idleTime = 0;
    this._contactDistance = 0;
    this._time = 0;
    this._interactDown = false;
    this._nearest();
    return this.state;
  }

  _moveAxis(axis, target) {
    const p = this.state.position;
    const other = axis === 0 ? 2 : 0;
    const start = p[axis];
    const limit = Math.max(0, this.boundsRadius - this.radius);
    // Stable form of sqrt(limit^2 - other^2), avoiding squared huge inputs.
    const ratio = limit ? Math.min(1, Math.abs(p[other]) / limit) : 1;
    const edge = limit * Math.sqrt(Math.max(0, 1 - ratio * ratio));
    target = Math.max(-edge, Math.min(edge, target));
    const delta = target - start;
    if (!delta) return;
    const x = axis === 0 ? target : p[0];
    const z = axis === 2 ? target : p[2];
    const foot = Math.max(p[1], this._support, this._supportAt(x, z));
    for (const box of this.obstacles) {
      if (box.hi[1] <= foot + EPS) continue;
      const outside = Math.max(box.lo[other] - p[other], 0, p[other] - box.hi[other]);
      if (outside >= this.radius) continue;
      // Exact circle/box cross-section, including rounded corners. Sweep this
      // interval rather than only checking the endpoint, so thin walls block.
      const pad = this.radius * Math.sqrt(Math.max(0, 1 - (outside / this.radius) ** 2));
      const near = box.lo[axis] - pad;
      const far = box.hi[axis] + pad;
      if (delta > 0 && start <= near + EPS && target > near) {
        target = Math.min(target, Math.max(start, near));
      } else if (delta < 0 && start >= far - EPS && target < far) {
        target = Math.max(target, Math.min(start, far));
      } else if (start > near + EPS && start < far - EPS) {
        // A falling foot can overlap the side of the slab it just left. Permit
        // escape toward the nearer face, but never travel farther into a box.
        if ((delta > 0 && start < (near + far) / 2) ||
            (delta < 0 && start > (near + far) / 2)) target = start;
      }
    }
    if (this.canOccupy && !this.canOccupy(axis === 0 ? target : p[0], axis === 2 ? target : p[2], this.radius)) return;
    p[axis] = target;
  }

  _nearest() {
    const p = this.state.position;
    let nearest = null;
    let best = Infinity;
    for (const item of this.interactables) {
      if (!item || ![0, 1, 2].every(i => Number.isFinite(item.position?.[i]))) continue;
      const distance = Math.hypot(...item.position.map((value, i) => value - p[i]));
      if (distance <= nonnegative(item.radius, .4) + EPS && distance < best) {
        nearest = item;
        best = distance;
      }
    }
    this.state.prompt = nearest ? String(nearest.label ?? nearest.id ?? '') : '';
    return nearest;
  }

  step(dt = 0, input = {}, time) {
    dt = nonnegative(dt, 0);
    const endTime = Number.isFinite(time) ? time : clockAdd(this._time, dt);
    this._time = endTime;
    const [dx, dz] = direction(finite(input?.x), finite(input?.z));
    const hasDirection = dx !== 0 || dz !== 0;
    const maxStride = Math.min(.03, this.radius / 2);
    const travelDt = hasDirection && this.speed > 0
      ? Math.min(dt, MAX_SUBSTEPS * maxStride / this.speed) : 0;
    const intendedDistance = this.speed * travelDt;
    const steps = Math.max(1, Math.min(MAX_SUBSTEPS, Math.ceil(intendedDistance / maxStride)));
    const h = travelDt / steps;
    const stride = intendedDistance / steps;
    const ripples = [];
    let traveled = 0;
    let facingX = 0;
    let facingZ = 0;
    const p = this.state.position;

    for (let i = 0; i < steps; i++) {
      const [oldX, oldY, oldZ] = p;
      const [targetX, targetZ] = this._limit(oldX + dx * stride, oldZ + dz * stride);
      // Move inward on a basin axis first so tangential travel can release the
      // other axis even at the cardinal extrema of the circular boundary.
      if (Math.abs(targetZ) < Math.abs(oldZ)) {
        this._moveAxis(2, targetZ);
        this._moveAxis(0, targetX);
      } else {
        this._moveAxis(0, targetX);
        this._moveAxis(2, targetZ);
      }
      this._support = this._supportAt(p[0], p[2]);
      p[1] = settleHeight(p[1], this._support, h);
      const movedX = p[0] - oldX;
      const movedZ = p[2] - oldZ;
      const distance = Math.hypot(movedX, movedZ);
      if (distance <= EPS) continue;
      traveled += distance;
      facingX = movedX;
      facingZ = movedZ;
      const phase = this._contactDistance;
      const contacts = Math.floor((phase + distance + EPS) / CONTACT_DISTANCE);
      this._contactDistance = Math.max(0, phase + distance - contacts * CONTACT_DISTANCE);
      for (let contact = 0; contact < contacts && ripples.length < MAX_RIPPLES; contact++) {
        const fraction = Math.max(0, Math.min(1,
          (CONTACT_DISTANCE * (contact + 1) - phase) / distance));
        const x = oldX + movedX * fraction;
        const z = oldZ + movedZ * fraction;
        const footY = oldY * (1 - fraction) + p[1] * fraction;
        if (this._supportAt(x, z) <= this.waterLevel + EPS && footY <= this.waterLevel + .01) {
          ripples.push([x, z, endTime - travelDt + (i + fraction) * h]);
        }
      }
    }
    // Idle calls and dropped lag still settle Y, without manufacturing travel.
    const settlingDt = dt - travelDt;
    if (settlingDt > 0) {
      this._support = this._supportAt(p[0], p[2]);
      p[1] = settleHeight(p[1], this._support, settlingDt);
    }
    const moving = traveled > EPS;
    if (moving) {
      this._walkTime = clockAdd(this._walkTime, traveled * ANIMATION_PER_DISTANCE);
      this.state.yaw = Math.atan2(facingX, facingZ);
    } else {
      this._idleTime = clockAdd(this._idleTime, dt);
    }
    Object.assign(this.state, {
      moving, clip: moving ? 'walk' : 'idle',
      animationTime: moving ? this._walkTime : this._idleTime,
    });

    const nearest = this._nearest();
    const down = Boolean(input?.interact);
    const trigger = down && !this._interactDown && nearest;
    this._interactDown = down;
    if (trigger) this.state.interactions = clockAdd(this.state.interactions, 1);
    for (const ripple of ripples) this.onRipple?.(...ripple);
    if (trigger && typeof nearest.onInteract === 'function') {
      nearest.onInteract({
        id: nearest.id, label: nearest.label, position: p.slice(),
        time: endTime, interactions: this.state.interactions,
      });
      this._nearest();
    }
    return this.state;
  }
}

export default ExplorerController;
