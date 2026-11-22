// Traffic on the grid. A car owns a leg of one road (from intersection to intersection), holds a
// lane offset, and follows a small quadratic arc through the junction when it turns. It brakes for
// the car in front, stops at a red light, indicates before a turn, and can be pulled out of its
// lane and stolen. Parked cars are placed from the city's lots and curbs.

import { CITY, LANES, VEHICLES } from './config.js';
import { angleDelta, approach, clamp } from './random.js';

export const DIRS = {
  E: { x: 1, y: 0, angle: 0, axis: 'ew' },
  S: { x: 0, y: 1, angle: Math.PI / 2, axis: 'ns' },
  W: { x: -1, y: 0, angle: Math.PI, axis: 'ew' },
  N: { x: 0, y: -1, angle: -Math.PI / 2, axis: 'ns' },
};
const DIR_LIST = [DIRS.E, DIRS.S, DIRS.W, DIRS.N];
const SIGNAL_CYCLE = 18;
const GREEN = 7.2;
const YELLOW = 1.8;

/** Lane offsets from the centre line, right-hand traffic: [inner, outer]. */
export function laneOffsets(dir) {
  if (dir.x === 1) return [LANES.inner, LANES.outer];
  if (dir.x === -1) return [-LANES.inner, -LANES.outer];
  if (dir.y === -1) return [LANES.inner, LANES.outer];
  return [-LANES.inner, -LANES.outer];
}

/** The signal at one junction, for one axis, at simulation time t. */
export function signalAt(i, j, t, axis) {
  const offset = ((i * 5 + j * 11) % SIGNAL_CYCLE + SIGNAL_CYCLE) % SIGNAL_CYCLE;
  const phase = ((t + offset) % SIGNAL_CYCLE + SIGNAL_CYCLE) % SIGNAL_CYCLE;
  const green = GREEN;
  const yellow = GREEN + YELLOW;
  if (axis === 'ew') {
    if (phase < green) return 'green';
    if (phase < yellow) return 'yellow';
    return 'red';
  }
  if (phase < green + YELLOW + 0.4) return 'red';
  if (phase < green + YELLOW + YELLOW + 0.4) return 'yellow';
  return 'green';
}

export function createTraffic(city, rng) {
  const cars = [];
  let clock = 0;

  const lanePoint = (dir, fromX, fromY, offset, s) => ({
    x: fromX + dir.x * s - dir.y * offset,
    y: fromY + dir.y * s + dir.x * offset,
  });

  function makeAi(dirKey, i, j, laneIndex, s, cruise) {
    const dir = DIRS[dirKey];
    const offsets = laneOffsets(dir);
    const ai = {
      i, j, dirKey, dir, laneIndex, offset: offsets[laneIndex], s, cruise,
      nextKey: null, turn: null, stunned: 0, patience: rng.range(0, 3), flashed: 0,
    };
    const start = lanePoint(dir, i * CITY.pitch, j * CITY.pitch, ai.offset, s);
    const type = pickType(rng);
    const car = createVehicle(type, start.x, start.y, dir.angle, rng.pick(VEHICLES[type].colors));
    car.ai = ai;
    car.indicator = 0;
    car.cruise = cruise;
    cars.push(car);
    return car;
  }

  function pickType(random) {
    const roll = random();
    if (roll < 0.36) return 'sedan';
    if (roll < 0.52) return 'taxi';
    if (roll < 0.65) return 'muscle';
    if (roll < 0.74) return 'van';
    if (roll < 0.84) return 'pickup';
    if (roll < 0.94) return 'sports';
    return 'courier';
  }

  /** Choose a next direction at the junction: mostly straight, sometimes a turn. */
  function planNext(ai, random) {
    const roll = random();
    const current = ai.dirKey;
    const order = ['E', 'S', 'W', 'N'];
    const index = order.indexOf(current);
    let choice;
    if (roll < 0.52) choice = current;
    else if (roll < 0.76) choice = order[(index + 1) % 4];
    else choice = order[(index + 3) % 4];
    ai.nextKey = choice;
    if (choice !== current) {
      const next = DIRS[choice];
      ai.nextLane = laneChoiceForTurn(ai, next);
      car_indicate(ai, choice === order[(index + 1) % 4] ? 1 : -1);
    } else {
      ai.nextLane = ai.laneIndex;
      ai.indicator = 0;
    }
  }

  function laneChoiceForTurn(ai, next) {
    const dir = ai.dir;
    const cross = dir.x * next.y - dir.y * next.x;
    if (cross > 0) return 1;
    if (cross < 0) return 0;
    return ai.laneIndex;
  }

  function car_indicate(ai, sign) {
    ai.indicator = sign;
  }

  function beginTurn(car, game) {
    const ai = car.ai;
    const i = ai.i;
    const j = ai.j;
    const nodeX = (i + ai.dir.x) * CITY.pitch;
    const nodeY = (j + ai.dir.y) * CITY.pitch;
    const next = DIRS[ai.nextKey];
    const nextOff = laneOffsets(next)[ai.nextLane];
    const entry = {
      x: nodeX - ai.dir.x * (CITY.half + 4) - ai.dir.y * ai.offset,
      y: nodeY - ai.dir.y * (CITY.half + 4) + ai.dir.x * ai.offset,
    };
    const exit = {
      x: nodeX + next.x * (CITY.half + 4) - next.y * nextOff,
      y: nodeY + next.y * (CITY.half + 4) + next.x * nextOff,
    };
    const control = {
      x: nodeX - ai.dir.y * ai.offset * 0.3 - next.y * nextOff * 0.3,
      y: nodeY + ai.dir.x * ai.offset * 0.3 + next.x * nextOff * 0.3,
    };
    const length = Math.hypot(exit.x - entry.x, exit.y - entry.y);
    ai.turn = {
      entry, exit, control, t: 0,
      duration: clamp(length / Math.max(80, Math.abs(car.speed) + 40), 0.3, 1.6),
      nextKey: ai.nextKey, nextLane: ai.nextLane,
    };
    const newI = Math.max(0, Math.min(CITY.blocks, i + ai.dir.x));
    const newJ = Math.max(0, Math.min(CITY.blocks, j + ai.dir.y));
    ai.i = newI;
    ai.j = newJ;
    ai.indicator = ai.nextKey === ai.dirKey ? 0 : ai.indicator;
    ai.dirKey = ai.nextKey;
    ai.dir = next;
    ai.laneIndex = ai.nextLane;
    ai.offset = nextOff;
    ai.s = CITY.half + 4;
    ai.nextKey = null;
    car.indicator = ai.indicator;
    if (ai.i <= 0 || ai.j <= 0 || ai.i >= CITY.blocks || ai.j >= CITY.blocks) ai.cruise = 260;
  }

  function advance(car, dt) {
    const ai = car.ai;
    if (ai.turn) {
      ai.turn.t += dt / ai.turn.duration;
      const u = Math.min(1, ai.turn.t);
      const { entry, control, exit } = ai.turn;
      const a = (1 - u) * (1 - u);
      const b = 2 * (1 - u) * u;
      const c = u * u;
      car.x = a * entry.x + b * control.x + c * exit.x;
      car.y = a * entry.y + b * control.y + c * exit.y;
      const tx = 2 * (1 - u) * (control.x - entry.x) + 2 * u * (exit.x - control.x);
      const ty = 2 * (1 - u) * (control.y - entry.y) + 2 * u * (exit.y - control.y);
      car.angle = Math.atan2(ty, tx);
      if (u >= 1) ai.turn = null;
      return;
    }
    ai.s += car.speed * dt;
    const nodeX = ai.i * CITY.pitch;
    const nodeY = ai.j * CITY.pitch;
    const p = lanePoint(ai.dir, nodeX, nodeY, ai.offset, ai.s);
    car.x = p.x;
    car.y = p.y;
    car.angle = ai.dir.angle;
  }

  /** How much room is left before the car in front in this lane. */
  function gapAhead(car, game) {
    const ai = car.ai;
    const dx = ai.dir.x;
    const dy = ai.dir.y;
    let gap = Infinity;
    for (const other of game.vehicles) {
      if (other === car) continue;
      const rx = other.x - car.x;
      const ry = other.y - car.y;
      const ahead = rx * dx + ry * dy;
      if (ahead <= 0 || ahead > 130) continue;
      const lateral = Math.abs(-rx * dy + ry * dx);
      if (lateral > 34) continue;
      const room = ahead - (car.length + other.length) * 0.5 - 6;
      if (room < gap) gap = room;
    }
    return gap;
  }

  function updateCar(car, game, dt) {
    const ai = car.ai;
    ai.stunned = Math.max(0, ai.stunned - dt);
    if (ai.turn) {
      car.speed = Math.max(80, car.speed);
      advance(car, dt);
      car.braking = false;
      return;
    }
    if (ai.stunned > 0 || car.wrecked) {
      // Knocked out of the lane: slide on its own momentum until it settles.
      car.x += car.vx * dt;
      car.y += car.vy * dt;
      car.vx *= Math.exp(-2.4 * dt);
      car.vy *= Math.exp(-2.4 * dt);
      car.speed = 0;
      return;
    }
    const targetI = ai.i + ai.dir.x;
    const targetJ = ai.j + ai.dir.y;
    const stopS = CITY.pitch - (CITY.half + 26);
    const distToStop = stopS - ai.s;
    const axis = ai.dir.axis;
    const signal = signalAt(targetI, targetJ, clock, axis);
    let target = ai.cruise;

    if (ai.nextKey === null && distToStop < 190) planNext(ai, game.rng);

    if (distToStop > -4) {
      const blockedByLight = signal === 'red' || (signal === 'yellow' && distToStop > 42);
      if (blockedByLight) {
        if (distToStop < 120) target = Math.min(target, Math.max(0, distToStop * 1.5));
      }
      const gap = gapAhead(car, game);
      if (gap < 110) target = Math.min(target, Math.max(0, (gap - 14) * 2.2));
      if (gap < 26) target = 0;
    }
    if (ai.stunned > 0) target = 0;
    // A car broadside inside the junction slows everyone else only through the gap test above.
    const accel = VEHICLES[car.type].accel;
    const brake = VEHICLES[car.type].brake;
    if (car.speed < target) car.speed = Math.min(target, car.speed + accel * dt);
    else car.speed = Math.max(target, car.speed - brake * dt);
    car.braking = target < car.speed - 10 || (target === 0 && car.speed < 10);
    car.indicatorOn = ai.indicator !== 0 && Math.sin(clock * 11) > 0;
    car.indicator = ai.indicator;

    advance(car, dt);
    if (ai.s >= stopS + 22) {
      ai.s = stopS + 22;
      beginTurn(car, game);
      advance(car, dt);
    }
  }

  function spawnAround(game, distanceMin = 620, distanceMax = 1600) {
    const player = game.player;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const i = rng.int(1, CITY.blocks - 1);
      const j = rng.int(1, CITY.blocks - 1);
      const x = i * CITY.pitch;
      const y = j * CITY.pitch;
      const d = Math.hypot(x - player.x, y - player.y);
      if (d < distanceMin || d > distanceMax) continue;
      const key = rng.pick(['E', 'S', 'W', 'N']);
      const lane = rng.int(0, 1);
      const car = makeAi(key, i, j, lane, rng.range(40, CITY.pitch - 120), rng.range(150, 245));
      game.vehicles.push(car);
      return car;
    }
    return null;
  }

  function despawnFar(game, limit = 2800) {
    for (let k = cars.length - 1; k >= 0; k -= 1) {
      const car = cars[k];
      if (car.driver === 'player' || car.driver === 'police') continue;
      if (Math.hypot(car.x - game.player.x, car.y - game.player.y) > limit) {
        cars.splice(k, 1);
        const index = game.vehicles.indexOf(car);
        if (index >= 0) game.vehicles.splice(index, 1);
      }
    }
  }

  function update(dt, game) {
    clock += dt;
    for (const car of cars) updateCar(car, game, dt);
    if (!game.staged && cars.length < 42) spawnAround(game);
    if (!game.staged && Math.floor(clock * 2) % 2 === 0) despawnFar(game);
  }

  function parkedVehicles() {
    const list = [];
    for (const spot of city.parked) {
      if (city.buildingAt(spot.x, spot.y, 16)) continue;
      const vehicle = createVehicle(spot.type, spot.x, spot.y, spot.angle, null, { parked: true });
      vehicle.lightsOn = false;
      vehicle.indicator = 0;
      list.push(vehicle);
    }
    return list;
  }

  /** Place a car by hand for a screenshot: junction i,j, heading dirKey, lane, s along the leg. */
  function placeCar(game, dirKey, i, j, laneIndex, s, options = {}) {
    const car = makeAi(dirKey, i, j, laneIndex, s, options.cruise ?? 190);
    if (options.type) {
      car.type = options.type;
      car.spec = VEHICLES[options.type];
      car.name = car.spec.name;
    }
    if (options.color) {
      car.color = options.color;
      car.trim = shadeHexLocal(options.color, -0.32);
    }
    if (options.speed !== undefined) car.speed = options.speed;
    if (options.indicator) car.indicator = options.indicator;
    car.indicatorOn = true;
    game.vehicles.push(car);
    return car;
  }

  function remove(car) {
    const index = cars.indexOf(car);
    if (index >= 0) cars.splice(index, 1);
    car.ai = null;
  }

  function setClock(value) {
    // Used only by the screenshot tableaux: hold the signals at a chosen phase.
    clock = value;
  }

  return { cars, update, signalAt, spawnAround, despawnFar, parkedVehicles, placeCar, remove, clock: () => clock, setClock };
}

function shadeHexLocal(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const mix = (v) => Math.max(0, Math.min(255, Math.round(amount >= 0 ? v + (255 - v) * amount : v * (1 + amount))));
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

// --- The car itself: a body with a velocity, a heading, grip and health. The player's car is
// driven through the full arcade model below (throttle, brake, steering, lateral grip, handbrake
// drift, body roll); traffic cars are steered along the lane graph but share the same object, so
// either can be stolen, shot, rammed and blown up.

let nextCarId = 1;

export function createVehicle(type, x, y, angle, color = null, options = {}) {
  const spec = VEHICLES[type] ?? VEHICLES.sedan;
  const painted = color ?? spec.colors[0];
  return {
    id: nextCarId,
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

// --- The people on the pavement. Each one walks the perimeter of a block, waits at a corner, and
// sometimes crosses the road on the zebra when the cross traffic is stopped. Gunfire, a crash or a
// body close by sends them running; a few are armed lookouts for the story missions and will fire
// back. No gore: a downed pedestrian folds over and fades after a few seconds.

const SHIRTS = ['#f4e6c8', '#ff6a3d', '#26efd4', '#ff2f92', '#2f7f83', '#ffc247', '#9d6bff', '#e8dcc4', '#c93a67', '#5c8fa8', '#7f8f6a', '#f2a06b'];
const PANTS = ['#2b2a3a', '#3b4d7a', '#5b4a3a', '#1f3a3d', '#4a3f63', '#e8dcc4'];
const SKINS = ['#f0c9a6', '#d9a077', '#a9714b', '#8d5a3b', '#5f3f2c', '#e8b98d'];

export function createPeds(city, rng) {
  const peds = [];

  const perimeterOf = (i, j) => {
    const x0 = i * CITY.pitch + CITY.walkLine;
    const x1 = (i + 1) * CITY.pitch - CITY.walkLine;
    const y0 = j * CITY.pitch + CITY.walkLine;
    const y1 = (j + 1) * CITY.pitch - CITY.walkLine;
    return { x0, x1, y0, y1, w: x1 - x0, h: y1 - y0 };
  };

  function pointOn(per, u) {
    const p = ((u % (2 * (per.w + per.h))) + 2 * (per.w + per.h)) % (2 * (per.w + per.h));
    if (p < per.w) return { x: per.x0 + p, y: per.y0, angle: 0 };
    if (p < per.w + per.h) return { x: per.x1, y: per.y0 + (p - per.w), angle: Math.PI / 2 };
    if (p < 2 * per.w + per.h) return { x: per.x1 - (p - per.w - per.h), y: per.y1, angle: Math.PI };
    return { x: per.x0, y: per.y1 - (p - 2 * per.w - per.h), angle: -Math.PI / 2 };
  }

  function makePed(i, j, u, options = {}) {
    const per = perimeterOf(i, j);
    const p = pointOn(per, u);
    const ped = {
      x: p.x,
      y: p.y,
      angle: p.angle,
      blockI: i,
      blockJ: j,
      per,
      u,
      routeDir: rng.chance(0.5) ? 1 : -1,
      speed: rng.range(34, 58),
      state: 'walk',
      timer: 0,
      walk: rng.range(0, 6.28),
      skin: rng.pick(SKINS),
      shirt: options.shirt ?? rng.pick(SHIRTS),
      pants: rng.pick(PANTS),
      hat: rng.chance(0.22),
      bag: rng.chance(0.3),
      armed: options.armed ?? false,
      target: options.target ?? null,
      hp: 44,
      alert: 0,
      down: 0,
      fade: 1,
      shootTimer: rng.range(1, 3),
      crossing: null,
      panicAngle: 0,
    };
    peds.push(ped);
    return ped;
  }

  function addCrowd(count, nearX, nearY, spread = 900) {
    for (let k = 0; k < count; k += 1) {
      const i = clamp(Math.floor(nearX / CITY.pitch) + rng.int(-2, 2), 0, CITY.blocks - 1);
      const j = clamp(Math.floor(nearY / CITY.pitch) + rng.int(-2, 2), 0, CITY.blocks - 1);
      const per = perimeterOf(i, j);
      const along = rng.range(0, 2 * (per.w + per.h));
      const dist = Math.hypot(per.x0 - nearX, per.y0 - nearY);
      if (dist > spread) continue;
      makePed(i, j, along);
    }
  }

  /** Stop a ped and send them running away from (x, y). */
  function startle(ped, x, y, power = 1) {
    if (ped.state === 'down') return;
    ped.state = 'flee';
    ped.timer = 1.6 + power * 0.7;
    ped.panicAngle = Math.atan2(ped.y - y, ped.x - x) + rng.range(-0.4, 0.4);
    ped.alert = 1.6;
    ped.speed = 190 + power * 30;
  }

  function startleAround(x, y, radius, power = 1) {
    for (const ped of peds) {
      if (Math.hypot(ped.x - x, ped.y - y) < radius) startle(ped, x, y, power);
    }
  }

  function damagePed(ped, amount, fromX, fromY) {
    if (ped.state === 'down') return;
    ped.hp -= amount;
    if (ped.hp <= 0) {
      ped.state = 'down';
      ped.down = 0;
      ped.alert = 0;
    } else {
      startle(ped, fromX, fromY, 1.4);
    }
  }

  function nearestIntersection(x, y) {
    const i = Math.round(x / CITY.pitch);
    const j = Math.round(y / CITY.pitch);
    return { i: clamp(i, 0, CITY.blocks), j: clamp(j, 0, CITY.blocks) };
  }

  /** Cross to the block on the other side of the road, waiting for a gap in the traffic. */
  function beginCrossing(ped, game) {
    const per = ped.per;
    const side = nearestSide(ped, per);
    const nearIntersection = nearestIntersection(ped.x, ped.y);
    let target = null;
    let axis = 'ew';
    if (side === 'n') {
      target = { x: ped.x, y: per.y0 - CITY.road - CITY.walk * 2 + CITY.walk };
      axis = 'ns';
      target.block = { i: ped.blockI, j: ped.blockJ - 1 };
    } else if (side === 's') {
      target = { x: ped.x, y: per.y1 + CITY.road + CITY.walk * 2 - CITY.walk };
      axis = 'ns';
      target.block = { i: ped.blockI, j: ped.blockJ + 1 };
    } else if (side === 'w') {
      target = { x: per.x0 - CITY.road - CITY.walk * 2 + CITY.walk, y: ped.y };
      axis = 'ew';
      target.block = { i: ped.blockI - 1, j: ped.blockJ };
    } else {
      target = { x: per.x1 + CITY.road + CITY.walk * 2 - CITY.walk, y: ped.y };
      axis = 'ew';
      target.block = { i: ped.blockI + 1, j: ped.blockJ };
    }
    if (target.block.i < 0 || target.block.j < 0 || target.block.i >= CITY.blocks || target.block.j >= CITY.blocks) return;
    // Only step out when the traffic on this road is held.
    const crossAxis = axis === 'ns' ? 'ew' : 'ns';
    const signal = signalAt(nearIntersection.i, nearIntersection.j, game.clock, crossAxis);
    if (signal === 'green') {
      ped.state = 'wait';
      ped.timer = 0.9;
      return;
    }
    ped.state = 'cross';
    ped.crossing = target;
    ped.angle = Math.atan2(target.y - ped.y, target.x - ped.x);
  }

  function nearestSide(ped, per) {
    const dn = Math.abs(ped.y - per.y0);
    const ds = Math.abs(ped.y - per.y1);
    const dw = Math.abs(ped.x - per.x0);
    const de = Math.abs(ped.x - per.x1);
    const min = Math.min(dn, ds, dw, de);
    if (min === dn) return 'n';
    if (min === ds) return 's';
    if (min === dw) return 'w';
    return 'e';
  }

  function updatePed(ped, game, dt) {
    ped.walk += dt * (1.4 + Math.abs(ped.speed) * 0.018);
    ped.alert = Math.max(0, ped.alert - dt);
    if (ped.state === 'down') {
      ped.down += dt;
      if (ped.down > 4.2) ped.fade = Math.max(0, 1 - (ped.down - 4.2) / 1.6);
      return;
    }
    if (ped.state === 'flee') {
      ped.timer -= dt;
      const nx = ped.x + Math.cos(ped.panicAngle) * ped.speed * dt;
      const ny = ped.y + Math.sin(ped.panicAngle) * ped.speed * dt;
      if (!city.buildingAt(nx, ny, 8)) {
        ped.x = nx;
        ped.y = ny;
      } else {
        ped.panicAngle += 1.4 * dt;
      }
      ped.angle = ped.panicAngle;
      if (ped.timer <= 0) {
        ped.state = 'walk';
        ped.speed = rng.range(34, 58);
        ped.blockI = clamp(Math.floor(ped.x / CITY.pitch), 0, CITY.blocks - 1);
        ped.blockJ = clamp(Math.floor(ped.y / CITY.pitch), 0, CITY.blocks - 1);
        ped.per = perimeterOf(ped.blockI, ped.blockJ);
        ped.u = 0;
        ped.routeDir = 1;
      }
      return;
    }
    if (ped.state === 'wait') {
      ped.timer -= dt;
      if (ped.timer <= 0) ped.state = 'walk';
      return;
    }
    if (ped.state === 'cross') {
      const c = ped.crossing;
      const dx = c.x - ped.x;
      const dy = c.y - ped.y;
      const d = Math.hypot(dx, dy);
      if (d < 4) {
        ped.state = 'walk';
        ped.blockI = c.block.i;
        ped.blockJ = c.block.j;
        ped.per = perimeterOf(Math.max(0, Math.min(CITY.blocks - 1, ped.blockI)), Math.max(0, Math.min(CITY.blocks - 1, ped.blockJ)));
        ped.blockI = Math.max(0, Math.min(CITY.blocks - 1, ped.blockI));
        ped.blockJ = Math.max(0, Math.min(CITY.blocks - 1, ped.blockJ));
        ped.u = nearestU(ped, ped.per);
        ped.crossing = null;
        ped.angle = 0;
      } else {
        const step = Math.min(d, 78 * dt);
        ped.x += (dx / d) * step;
        ped.y += (dy / d) * step;
        ped.angle = Math.atan2(dy, dx);
      }
      return;
    }
    if (ped.state === 'idle') {
      ped.timer -= dt;
      if (ped.timer <= 0) ped.state = 'walk';
      return;
    }
    // Walking the block's perimeter.
    ped.u += ped.routeDir * ped.speed * dt;
    const per = ped.per;
    const len = 2 * (per.w + per.h);
    if (ped.u < 0) {
      ped.u += len;
      maybeCross(ped, game);
    } else if (ped.u > len) {
      ped.u -= len;
      maybeCross(ped, game);
    }
    const p = pointOn(per, ped.u);
    ped.x = p.x;
    ped.y = p.y;
    ped.angle = p.angle;
    if (rng() < 0.06 * dt) {
      ped.state = 'idle';
      ped.timer = rng.range(0.6, 2.2);
    }
  }

  function maybeCross(ped, game) {
    if (rng() < 0.3) beginCrossing(ped, game);
  }

  function nearestU(ped, per) {
    const candidates = [
      { u: ped.x - per.x0, d: Math.abs(ped.y - per.y0) },
      { u: per.w + (ped.y - per.y0), d: Math.abs(ped.x - per.x1) },
      { u: per.w + per.h + (per.x1 - ped.x), d: Math.abs(ped.y - per.y1) },
      { u: 2 * per.w + per.h + (per.y1 - ped.y), d: Math.abs(ped.x - per.x0) },
    ];
    candidates.sort((a, b) => a.d - b.d);
    return candidates[0].u;
  }

  /** Armed lookouts fire at the player when they can see them. */
  function updateShooting(ped, game, dt) {
    if (!ped.armed || ped.state === 'down' || ped.target !== 'player') return;
    const player = game.player;
    const d = Math.hypot(player.x - ped.x, player.y - ped.y);
    if (d > 420) return;
    ped.shootTimer -= dt;
    if (ped.shootTimer <= 0) {
      ped.shootTimer = 1.1 + rng() * 0.8;
      ped.angle = Math.atan2(player.y - ped.y, player.x - ped.x);
      game.effects.muzzleFlash(ped.x + Math.cos(ped.angle) * 10, ped.y + Math.sin(ped.angle) * 10, ped.angle, 'enemy');
      game.audio.gunshot(0.6);
      if (rng() < 0.55) game.hurtPlayer(5.5, 'bullet');
      game.police?.alarm(ped.x, ped.y);
    }
  }

  function update(dt, game) {
    for (const ped of peds) {
      updatePed(ped, game, dt);
      updateShooting(ped, game, dt);
      if (ped.fade <= 0 && ped.state === 'down') ped.remove = true;
    }
    for (let k = peds.length - 1; k >= 0; k -= 1) if (peds[k].remove) peds.splice(k, 1);
    // Keep the pavement busy around the player, and thin the crowd far away.
    if (!game.staged) {
      if (peds.length < 54) addCrowd(2, game.player.x, game.player.y, 900);
      for (let k = peds.length - 1; k >= 0; k -= 1) {
        const ped = peds[k];
        if (Math.hypot(ped.x - game.player.x, ped.y - game.player.y) > 2200) peds.splice(k, 1);
      }
    }
  }

  /** A hand-placed pedestrian for the screenshot tableaux. */
  function place(i, j, u, options = {}) {
    return makePed(i, j, u, options);
  }

  return { peds, update, startle, startleAround, damagePed, addCrowd, makePed, place, beginCrossing };
}

export function pedColors(ped) {
  return { shirt: ped.shirt, pants: ped.pants, skin: ped.skin };
}
