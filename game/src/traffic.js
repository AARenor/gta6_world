// Traffic on the grid. A car owns a leg of one road (from intersection to intersection), holds a
// lane offset, and follows a small quadratic arc through the junction when it turns. It brakes for
// the car in front, stops at a red light, indicates before a turn, and can be pulled out of its
// lane and stolen. Parked cars are placed from the city's lots and curbs.

import { CITY, LANES, VEHICLES } from './config.js';
import { clamp } from './random.js';
import { createVehicle } from './vehicles.js';

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
