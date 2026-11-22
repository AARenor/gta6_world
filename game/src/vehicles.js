// Every car in the city is one of these: a body with a velocity, a heading, grip and health.
// The player's car is driven through the full arcade model below (throttle, brake, steering,
// lateral grip, handbrake drift, body roll); traffic cars are steered along the lane graph but
// share the same object, so either can be stolen, shot, rammed and blown up.

import { VEHICLES, CITY } from './config.js';
import { angleDelta, approach, clamp } from './random.js';

let nextId = 1;

export function createVehicle(type, x, y, angle, color = null, options = {}) {
  const spec = VEHICLES[type] ?? VEHICLES.sedan;
  const painted = color ?? spec.colors[0];
  return {
    id: nextId,
    type,
    spec,
    name: spec.name,
    x,
    y,
    angle,
    vx: 0,
    vy: 0,
    speed: 0,
    steer: 0,
    steerVisual: 0,
    roll: 0,
    slip: 0,
    color: painted,
    trim: shadeHex(painted, -0.32),
    glass: '#2b2f3f',
    health: 100,
    maxHealth: 100,
    burning: 0,
    wrecked: false,
    exploded: false,
    driver: options.driver ?? null,
    parked: options.parked ?? false,
    siren: type === 'police',
    indicator: 0,
    indicatorOn: false,
    braking: false,
    lightsOn: true,
    honk: 0,
    sirenPhase: 0,
    engine: 0,
    lastImpact: 0,
    ai: options.ai ?? null,
    length: spec.w,
    width: spec.h,
  };
}

export function updateVehiclePhysics(game, v, dt, controls) {
  const spec = v.spec;
  if (v.wrecked) {
    v.vx *= Math.exp(-2.2 * dt);
    v.vy *= Math.exp(-2.2 * dt);
    v.x += v.vx * dt;
    v.y += v.vy * dt;
    v.speed = Math.hypot(v.vx, v.vy);
    return;
  }
  const cos = Math.cos(v.angle);
  const sin = Math.sin(v.angle);
  let forward = v.vx * cos + v.vy * sin;
  let lateral = -v.vx * sin + v.vy * cos;

  const throttle = controls.throttle ?? 0;
  const brake = controls.brake ?? 0;
  const handbrake = controls.handbrake ?? false;

  if (throttle > 0) {
    forward += spec.accel * throttle * dt * (forward < 0 ? 2.2 : 1);
  } else if (throttle < 0) {
    forward += spec.accel * 0.6 * throttle * dt * (forward > 0 ? 2.2 : 1);
  }
  if (brake > 0) {
    if (forward > 6) forward -= spec.brake * brake * dt;
    else forward -= spec.accel * 0.5 * brake * dt;
  }
  // Rolling resistance and air drag, then a hard cap.
  forward -= forward * 0.42 * dt;
  forward = clamp(forward, -spec.maxSpeed * 0.34, spec.maxSpeed);

  const grip = handbrake ? spec.grip * 0.14 : spec.grip;
  lateral *= Math.exp(-grip * dt);

  const steerAmount = controls.steer ?? 0;
  const speedFactor = clamp(Math.abs(forward) / 150, 0, 1);
  v.steer = steerAmount;
  const rate = steerAmount * 2.9 * speedFactor * (handbrake ? 1.3 : 1) * Math.sign(forward || 1);
  v.angle += rate * dt;
  v.steerVisual = approach(v.steerVisual, steerAmount * 0.5, dt * 4);
  v.roll = approach(v.roll, steerAmount * speedFactor * 0.07, dt * 0.7);
  v.braking = brake > 0.1 || (throttle === 0 && Math.abs(forward) < 6);

  const cos2 = Math.cos(v.angle);
  const sin2 = Math.sin(v.angle);
  v.vx = cos2 * forward - sin2 * lateral;
  v.vy = sin2 * forward + cos2 * lateral;
  v.x += v.vx * dt;
  v.y += v.vy * dt;
  v.speed = forward;
  v.slip = Math.abs(lateral);

  // Tyre smoke and skid marks when the back steps out.
  if (v.slip > 46 && Math.abs(forward) > 80) {
    game.effects.spawnTyreSmoke(v.x - cos2 * 14, v.y - sin2 * 14, v.angle);
    if (game.rng() < 0.6) game.effects.spawnSkid(v.x, v.y, v.angle);
  }

  collideWithCity(game, v);
  collideWithWorldEdge(game, v);
}

/** Push a car out of the first building it overlaps and take the hit on the nose. */
export function collideWithCity(game, v) {
  const radius = v.width * 0.5;
  const building = game.city.buildingAt(v.x, v.y, radius);
  if (!building) return;
  const overlapLeft = v.x + radius - building.x;
  const overlapRight = building.x + building.w - (v.x - radius);
  const overlapTop = v.y + radius - building.y;
  const overlapBottom = building.y + building.h - (v.y - radius);
  const min = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
  if (min === overlapLeft) {
    v.x -= overlapLeft;
    if (v.vx > 0) v.vx *= -0.28;
  } else if (min === overlapRight) {
    v.x += overlapRight;
    if (v.vx < 0) v.vx *= -0.28;
  } else if (min === overlapTop) {
    v.y -= overlapTop;
    if (v.vy > 0) v.vy *= -0.28;
  } else {
    v.y += overlapBottom;
    if (v.vy < 0) v.vy *= -0.28;
  }
  const impact = Math.hypot(v.vx, v.vy) + Math.abs(v.speed) * 0.4;
  if (impact > 90) {
    damageVehicle(game, v, impact * 0.032);
    game.effects.spawnSparks(v.x, v.y, v.angle + Math.PI, 6);
    game.shake(impact * 0.05);
    game.audio.crash(impact * 0.02);
  }
  v.speed *= 0.35;
}

export function collideWithWorldEdge(game, v) {
  const pad = 46;
  const size = CITY.size;
  let hit = 0;
  if (v.x < pad) { v.x = pad; v.vx = Math.abs(v.vx) * 0.3; hit = 1; }
  if (v.x > size - pad) { v.x = size - pad; v.vx = -Math.abs(v.vx) * 0.3; hit = 1; }
  if (v.y < pad) { v.y = pad; v.vy = Math.abs(v.vy) * 0.3; hit = 1; }
  if (v.y > size - pad) { v.y = size - pad; v.vy = -Math.abs(v.vy) * 0.3; hit = 1; }
  if (hit) v.speed *= 0.2;
}

/** Two cars as capsules of two discs each, so a nose-to-tail shunt reads as one. */
export function collideVehicles(game, a, b) {
  if (a === b) return false;
  const ra = a.width * 0.72;
  const rb = b.width * 0.72;
  const axs = [Math.cos(a.angle) * a.length * 0.27, -Math.cos(a.angle) * a.length * 0.27];
  const ays = [Math.sin(a.angle) * a.length * 0.27, -Math.sin(a.angle) * a.length * 0.27];
  const bxs = [Math.cos(b.angle) * b.length * 0.27, -Math.cos(b.angle) * b.length * 0.27];
  const bys = [Math.sin(b.angle) * b.length * 0.27, -Math.sin(b.angle) * b.length * 0.27];
  let best = null;
  for (let i = 0; i < 2; i += 1) {
    for (let j = 0; j < 2; j += 1) {
      const dx = (b.x + bxs[j]) - (a.x + axs[i]);
      const dy = (b.y + bys[j]) - (a.y + ays[i]);
      const d = Math.hypot(dx, dy);
      const min = ra + rb;
      if (d < min && (best === null || d - min < best.overlap)) {
        best = { dx, dy, d, min, nx: d > 0.001 ? dx / d : 1, ny: d > 0.001 ? dy / d : 0 };
      }
    }
  }
  if (!best) return false;
  const overlap = best.min - best.d;
  const massA = a.spec.mass;
  const massB = b.spec.mass;
  const push = overlap / (massA + massB);
  a.x -= best.nx * push * massB;
  a.y -= best.ny * push * massB;
  b.x += best.nx * push * massA;
  b.y += best.ny * push * massA;
  const rvx = b.vx - a.vx;
  const rvy = b.vy - a.vy;
  const along = rvx * best.nx + rvy * best.ny;
  const closing = -along;
  if (closing > 0) {
    const impulse = closing * 0.65;
    a.vx -= best.nx * impulse * (massB / (massA + massB)) * 1.2;
    a.vy -= best.ny * impulse * (massB / (massA + massB)) * 1.2;
    b.vx += best.nx * impulse * (massA / (massA + massB)) * 1.2;
    b.vy += best.ny * impulse * (massA / (massA + massB)) * 1.2;
    if (closing > 55) {
      const cx = (a.x + b.x) / 2 + best.nx * 8;
      const cy = (a.y + b.y) / 2 + best.ny * 8;
      game.effects.spawnSparks(cx, cy, Math.atan2(best.ny, best.nx), 5 + Math.floor(closing * 0.05));
      game.shake(closing * 0.045);
      game.audio.crash(closing * 0.03);
      damageVehicle(game, a, closing * 0.02);
      damageVehicle(game, b, closing * 0.026);
      a.lastImpact = 0.4;
      b.lastImpact = 0.4;
      if (a.ai) a.ai.stunned = 0.5;
      if (b.ai) b.ai.stunned = 0.5;
    }
  }
  if (a.speed !== undefined) a.speed *= 0.94;
  if (b.speed !== undefined) b.speed *= 0.94;
  return true;
}

export function damageVehicle(game, v, amount) {
  if (v.wrecked || amount <= 0) return;
  v.health = Math.max(0, v.health - amount);
  if (v.health < 45 && v.burning === 0) v.burning = 0.001;
  if (v.health <= 0) {
    v.wrecked = true;
    v.burning = 3.2;
    v.siren = false;
    game.onVehicleWrecked?.(v);
  }
}

export function explodeVehicle(game, v) {
  v.exploded = true;
  v.burning = 0;
  game.effects.spawnExplosion(v.x, v.y);
  game.shake(26);
  game.audio.explosion();
  const radius = 132;
  for (const other of game.vehicles) {
    if (other === v) continue;
    const d = Math.hypot(other.x - v.x, other.y - v.y);
    if (d < radius) {
      const power = 1 - d / radius;
      const angle = Math.atan2(other.y - v.y, other.x - v.x);
      other.vx += Math.cos(angle) * 260 * power;
      other.vy += Math.sin(angle) * 260 * power;
      damageVehicle(game, other, 55 * power);
    }
  }
  for (const ped of game.peds.peds) {
    const d = Math.hypot(ped.x - v.x, ped.y - v.y);
    if (d < radius * 1.35) game.peds.startle(ped, v.x, v.y, 2.2);
  }
  const player = game.player;
  const d = Math.hypot(player.x - v.x, player.y - v.y);
  if (d < radius) game.hurtPlayer((1 - d / radius) * 44, 'explosion');
  if (game.police) game.police.alarm(v.x, v.y);
}

export function shadeHex(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const mix = (v) => Math.max(0, Math.min(255, Math.round(amount >= 0 ? v + (255 - v) * amount : v * (1 + amount))));
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

export function turnToward(current, target, rate, dt) {
  const delta = angleDelta(current, target);
  return current + clamp(delta, -rate * dt, rate * dt);
}
