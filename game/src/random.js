// A seeded random number generator (mulberry32) plus the small helpers the city, the crowd and
// the traffic use. Nothing in the simulation calls Math.random: the same seed always builds the
// same city and the screenshot tableaux are repeatable because of it.

export function createRandom(seed) {
  let state = seed | 0;
  const random = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  random.range = (min, max) => min + random() * (max - min);
  random.int = (min, max) => Math.floor(min + random() * (max - min + 1));
  random.pick = (list) => list[Math.floor(random() * list.length) % list.length];
  random.chance = (p) => random() < p;
  random.sign = () => (random() < 0.5 ? -1 : 1);
  random.angle = () => random() * Math.PI * 2;
  random.shuffle = (list) => {
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  };
  return random;
}

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Shortest signed difference between two angles, in radians. */
export function angleDelta(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function approach(current, target, maxStep) {
  const d = target - current;
  if (Math.abs(d) <= maxStep) return target;
  return current + Math.sign(d) * maxStep;
}

export function distanceSq(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function distance(ax, ay, bx, by) {
  return Math.sqrt(distanceSq(ax, ay, bx, by));
}

/** True when the segment a-b meets the axis-aligned rect (a cheap slab test). */
export function segmentHitsRect(ax, ay, bx, by, rect) {
  const rx = rect.x;
  const ry = rect.y;
  const rw = rect.w;
  const rh = rect.h;
  let tmin = 0;
  let tmax = 1;
  const dx = bx - ax;
  const dy = by - ay;
  for (let axis = 0; axis < 2; axis += 1) {
    const origin = axis === 0 ? ax : ay;
    const dir = axis === 0 ? dx : dy;
    const min = axis === 0 ? rx : ry;
    const max = axis === 0 ? rx + rw : ry + rh;
    if (Math.abs(dir) < 1e-9) {
      if (origin < min || origin > max) return false;
    } else {
      let t1 = (min - origin) / dir;
      let t2 = (max - origin) / dir;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return false;
    }
  }
  return true;
}

export function insideRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}
