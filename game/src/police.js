// Vesper City Police Department. Crimes add heat, heat lights the five stars, and the stars send
// cruisers out of the grid: they path along the roads, ram, try to box you in, shoot from the
// window, throw up a roadblock and call in the spotter helicopter. Break their line of sight and
// the heat cools star by star.

import { CITY, HEAT, VEHICLES } from './config.js';
import { clamp } from './random.js';
import { createVehicle, damageVehicle, updateVehiclePhysics } from './vehicles.js';
import { fireBullet } from './combat.js';

const UNIT_NAMES = ['V-12', 'V-27', 'V-40', 'V-51', 'V-63', 'V-88', 'V-04', 'V-33'];
const ROADBLOCK_NAMES = ['B-2', 'B-5', 'B-9'];

export function createPolice(city, rng) {
  const units = [];
  const unitsOnFoot = [];
  const blocks = [];
  let heat = 0;
  let stars = 0;
  let hiddenTimer = 0;
  let spawnTimer = 0;
  let blockCooldown = 0;
  let chopper = null;
  let lastCrime = '';
  let lastKnown = null;
  let crimeFlash = 0;
  let frame = 0;
  let clock = 0;

  const state = {
    get stars() { return stars; },
    get heat() { return heat; },
    get status() { return hiddenTimer > HEAT.coolStealth ? 'HIDDEN' : stars > 0 ? 'SPOTTED' : 'CLEAR'; },
    get hidden() { return hiddenTimer; },
    get lastCrime() { return lastCrime; },
    get crimeFlash() { return crimeFlash; },
    chopper,
  };

  function starFor(h) {
    let s = 0;
    for (let k = 1; k <= HEAT.maxStars; k += 1) if (h >= HEAT.starChance[k]) s = k;
    return s;
  }

  function addHeat(amount, reason = '') {
    if (amount <= 0) return;
    heat = Math.min(HEAT.starChance[HEAT.maxStars] + 40, heat + amount);
    hiddenTimer = 0;
    lastCrime = reason;
    crimeFlash = 1.6;
    const next = starFor(heat);
    if (next > stars) {
      stars = next;
      audioSting();
    }
  }

  function audioSting() {
    // The game's audio module is reached through the update hook; the wanted sting itself is
    // triggered by the game when the stars change, so nothing is stored here.
  }

  function clearWanted() {
    heat = 0;
    stars = 0;
    hiddenTimer = 0;
    lastCrime = '';
    lastKnown = null;
    for (const unit of units) removeUnit(unit);
    units.length = 0;
    blocks.length = 0;
    chopper = null;
  }

  function alarm(x, y) {
    const d = Math.hypot(x - gameRef.player.x, y - gameRef.player.y);
    if (d < 320) addHeat(22, 'disturbance');
  }

  let gameRef = null;

  function nearestNode(x, y) {
    return {
      i: clamp(Math.round(x / CITY.pitch), 0, CITY.blocks),
      j: clamp(Math.round(y / CITY.pitch), 0, CITY.blocks),
    };
  }

  function bfsNext(from, to) {
    if (from.i === to.i && from.j === to.j) return null;
    const W = CITY.blocks + 1;
    const total = W * W;
    const prev = new Int16Array(total).fill(-1);
    const seen = new Uint8Array(total);
    const queue = new Int16Array(total);
    let head = 0;
    let tail = 0;
    const start = to.j * W + to.i;
    queue[tail++] = start;
    seen[start] = 1;
    const goal = from.j * W + from.i;
    while (head < tail) {
      const node = queue[head++];
      if (node === goal) break;
      const i = node % W;
      const j = (node - i) / W;
      const neighbours = [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]];
      for (const [ni, nj] of neighbours) {
        if (ni < 0 || nj < 0 || ni >= W || nj >= W) continue;
        const index = nj * W + ni;
        if (seen[index]) continue;
        seen[index] = 1;
        prev[index] = node;
        queue[tail++] = index;
      }
    }
    if (prev[goal] < 0) return null;
    const next = prev[goal];
    const ni = next % W;
    const nj = (next - ni) / W;
    return { i: ni, j: nj };
  }

  function spawnUnit(game, name = null) {
    const player = game.player;
    let node = null;
    let best = -1;
    for (let attempt = 0; attempt < 14; attempt += 1) {
      const i = clamp(Math.round(player.x / CITY.pitch) + rng.int(-4, 4), 0, CITY.blocks);
      const j = clamp(Math.round(player.y / CITY.pitch) + rng.int(-4, 4), 0, CITY.blocks);
      const x = i * CITY.pitch;
      const y = j * CITY.pitch;
      const d = Math.hypot(x - player.x, y - player.y);
      if (d < 380 || d > 1200) continue;
      if (d > best) {
        best = d;
        node = { i, j, x, y };
      }
    }
    if (!node) return null;
    const dir = rng.pick([[1, 0], [-1, 0], [0, 1], [0, -1]]);
    const car = createVehicle('police', node.x + dir[0] * 40, node.y + dir[1] * 40, Math.atan2(dir[1], dir[0]), '#f2f0ea', { driver: 'police' });
    car.siren = true;
    car.ai = null;
    car.police = {
      name: name ?? UNIT_NAMES[units.length % UNIT_NAMES.length],
      state: 'pursue',
      next: null,
      pathAge: 0,
      shootTimer: rng.range(0.8, 2),
      ramTimer: 0,
      aggression: rng.range(0.85, 1.15),
      spin: 0,
    };
    game.vehicles.push(car);
    units.push(car);
    return car;
  }

  function removeUnit(unit) {
    const index = unit.game ? unit.game.vehicles.indexOf(unit) : -1;
    if (index >= 0) unit.game.vehicles.splice(index, 1);
    unit.police = null;
    unit.driver = null;
  }

  function spawnRoadblock(game) {
    const player = game.player;
    const car = player.inCar;
    const heading = car ? Math.atan2(car.vy, car.vx) : player.angle;
    const ahead = 460;
    const x = player.x + Math.cos(heading) * ahead;
    const y = player.y + Math.sin(heading) * ahead;
    const node = nearestNode(x, y);
    const nx = node.i * CITY.pitch;
    const ny = node.j * CITY.pitch;
    if (Math.hypot(nx - player.x, ny - player.y) < 180) return;
    const across = heading + Math.PI * 0.5;
    for (let k = -1; k <= 1; k += 1) {
      const cx = nx + Math.cos(across) * k * 34;
      const cy = ny + Math.sin(across) * k * 34;
      if (city.buildingAt(cx, cy, 20)) continue;
      const blockCar = createVehicle('police', cx, cy, across, '#f2f0ea', { driver: 'police' });
      blockCar.siren = true;
      blockCar.police = {
        name: ROADBLOCK_NAMES[blocks.length % ROADBLOCK_NAMES.length] + (k + 2),
        state: 'block',
        next: null,
        pathAge: 0,
        shootTimer: rng.range(0.4, 1.6),
        aggression: 1,
        spin: 0,
      };
      game.vehicles.push(blockCar);
      units.push(blockCar);
      blocks.push(blockCar);
    }
    blockCooldown = 22;
    game.hud?.toast('ROADBLOCK AHEAD');
  }

  function spawnChopper(game) {
    const player = game.player;
    chopper = {
      x: player.x - 300,
      y: player.y - 360,
      angle: 0.4,
      rotor: 0,
      spotAngle: 0,
      name: 'WATCHER-1',
    };
  }

  function visible(game, unit) {
    if (unit.wrecked) return false;
    const player = game.player;
    return Math.hypot(unit.x - player.x, unit.y - player.y) < 720 && !city.lineBlocked(unit.x, unit.y, player.x, player.y);
  }

  /** Steer a cruiser along the grid toward the last place the player was seen. */
  function driveUnit(game, unit, dt) {
    const player = game.player;
    const police = unit.police;
    const dx = player.x - unit.x;
    const dy = player.y - unit.y;
    const dist = Math.hypot(dx, dy);
    const los = dist < 720 && !city.lineBlocked(unit.x, unit.y, player.x, player.y);
    const target = los ? player : lastKnown ?? player;
    let tx = target.x;
    let ty = target.y;
    police.pathAge -= dt;
    if (!los && police.pathAge <= 0) {
      police.pathAge = 0.9;
      const from = nearestNode(unit.x, unit.y);
      const to = nearestNode(target.x, target.y);
      if (!(from.i === to.i && from.j === to.j)) police.next = bfsNext(from, to);
      else police.next = null;
    }
    if (!los) {
      if (police.next) {
        tx = police.next.i * CITY.pitch;
        ty = police.next.j * CITY.pitch;
        if (Math.hypot(tx - unit.x, ty - unit.y) < 44) police.next = null;
      }
      // At the last known spot and still nothing: sweep the junction slowly.
      if (Math.hypot(target.x - unit.x, target.y - unit.y) < 80) {
        police.searchPhase = (police.searchPhase ?? 0) + dt * 1.4;
        tx = unit.x + Math.cos(police.searchPhase) * 90;
        ty = unit.y + Math.sin(police.searchPhase) * 90;
        police.next = null;
      }
    }
    let desired = Math.atan2(ty - unit.y, tx - unit.x);
    // A little flanking: offset the aim point sideways when far away.
    if (dist > 260 && police.flank) {
      desired += police.flank * 0.35;
    }
    let diff = desired - unit.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = clamp(diff * 1.8, -1, 1);
    const urgent = dist < 220;
    const throttle = Math.abs(diff) < 1.1 ? (urgent ? 1 : 0.85) : 0.35;
    const controls = {
      throttle,
      brake: Math.abs(diff) > 1.7 ? 0.8 : 0,
      steer,
      handbrake: false,
    };
    updateVehiclePhysics(game, unit, dt, controls);
    // Cruisers run red lights and push through queues: nudge the physical body toward the
    // throttle direction while the lane cars yield.
    if (unit.speed < 30 && dist > 300) {
      unit.vx += Math.cos(unit.angle) * 120 * dt;
      unit.vy += Math.sin(unit.angle) * 120 * dt;
    }
    if (dist < 120 && unit.speed > 180) {
      police.ramTimer = 0.5;
    }
    police.ramTimer = Math.max(0, police.ramTimer - dt);
  }

  function unitShoot(game, unit, dt) {
    const player = game.player;
    const police = unit.police;
    const dist = Math.hypot(player.x - unit.x, player.y - unit.y);
    police.shootTimer -= dt;
    if (dist > 300) return;
    if (city.lineBlocked(unit.x, unit.y, player.x, player.y)) return;
    if (unit.speed > 90 && dist > 120) return;
    if (police.shootTimer > 0) return;
    police.shootTimer = rng.range(0.65, 1.25) / (0.7 + stars * 0.12);
    const angle = Math.atan2(player.y - unit.y, player.x - unit.x) + rng.range(-0.09, 0.09);
    const mx = unit.x + Math.cos(angle) * 22;
    const my = unit.y + Math.sin(angle) * 22;
    game.effects.muzzleFlash(mx, my, angle, 'enemy');
    game.audio.gunshot(0.5);
    fireBullet(game, {
      x: mx, y: my, angle,
      weapon: { damage: 5.5 + stars * 0.8, range: 460, spread: 0.035, pellets: 1, tracer: '#ff8f7a' },
      fromPlayer: false,
      shooter: { x: mx, y: my },
    });
    game.peds.startleAround(mx, my, 220, 1.1);
  }

  function update(game, dt) {
    gameRef = game;
    clock += dt;
    frame += 1;
    crimeFlash = Math.max(0, crimeFlash - dt);
    blockCooldown = Math.max(0, blockCooldown - dt);
    if (game.staged) {
      updateVisuals(game, dt);
      return;
    }

    const player = game.player;
    const currentStars = starFor(heat);
    if (currentStars !== stars) {
      stars = currentStars;
      if (stars > 0) game.audio.sirenSting();
    }

    // Visibility: any cruiser or the helicopter that sees you keeps the heat on.
    let seen = false;
    if (player.dead === false) {
      for (const unit of units) {
        if (visible(game, unit)) {
          seen = true;
          break;
        }
      }
    }
    if (chopper) seen = true;
    if (stars === 0) seen = false;
    if (seen) lastKnown = { x: player.x, y: player.y };
    else if (!lastKnown && stars > 0) lastKnown = { x: player.x, y: player.y };
    hiddenTimer = seen ? 0 : hiddenTimer + dt;
    if (stars > 0 && hiddenTimer > HEAT.coolStealth) {
      heat = Math.max(0, heat - HEAT.coolRate * 30 * dt);
      if (starFor(heat) < stars) {
        stars = starFor(heat);
        const drop = units.pop();
        if (drop) removeUnit(drop);
        game.hud?.toast(stars === 0 ? 'HEAT LOST' : `HEAT FALLING — ${stars} STAR${stars === 1 ? '' : 'S'}`);
      }
    }
    if (stars === 0) heat = Math.max(0, heat - 3.5 * dt);

    // Keep the force sized to the stars.
    const wanted = stars === 0 ? 0 : Math.min(7, stars + 1);
    spawnTimer -= dt;
    if (units.length < wanted && spawnTimer <= 0) {
      spawnTimer = 1.4;
      const unit = spawnUnit(game);
      if (unit) {
        unit.police.flank = rng.chance(0.5) ? 1 : -1;
        if (stars >= 4) unit.police.aggression = 1.3;
      }
    }
    if (units.length > wanted) {
      const extra = units.find((unit) => unit.police && unit.police.state !== 'block');
      if (extra) removeUnit(extra);
      const index = extra ? units.indexOf(extra) : -1;
      if (index >= 0) units.splice(index, 1);
    }
    if (stars >= 4 && !chopper) spawnChopper(game);
    if (stars >= 3 && blockCooldown <= 0 && blocks.length === 0) spawnRoadblock(game);

    for (const unit of units) {
      if (!unit.police) continue;
      unit.game = game;
      if (unit.police.state === 'block') {
        unit.speed = 0;
        unit.vx *= 0.9;
        unit.vy *= 0.9;
      } else {
        driveUnit(game, unit, dt);
      }
      unitShoot(game, unit, dt);
      unit.sirenPhase = (unit.sirenPhase + dt * 6) % 1;
      if (unit.wrecked) {
        unit.police.state = 'wreck';
      }
    }
    // Boxed in: three cruisers close and your car crawling.
    const close = units.filter((unit) => unit.police && unit.police.state !== 'wreck' && Math.hypot(unit.x - player.x, unit.y - player.y) < 96);
    if (player.inCar && player.inCar.speed < 40 && close.length >= 2) {
      player.boxedTimer = (player.boxedTimer ?? 0) + dt;
    } else {
      player.boxedTimer = 0;
    }
    // On foot and a cruiser stops on top of you: busted.
    if (!player.inCar) {
      const caught = units.find((unit) => unit.police && unit.police.state !== 'wreck' && Math.hypot(unit.x - player.x, unit.y - player.y) < HEAT.bustRange + 10);
      player.bustTimer = caught ? (player.bustTimer ?? 0) + dt : 0;
      if (player.bustTimer > HEAT.bustSeconds) game.onPlayerBusted?.();
    } else {
      player.bustTimer = 0;
    }

    updateVisuals(game, dt);
  }

  function updateVisuals(game, dt) {
    if (chopper) {
      const player = game.player;
      const targetX = player.x + Math.cos(clock * 0.6) * 90;
      const targetY = player.y + Math.sin(clock * 0.45) * 70 - 20;
      chopper.x += (targetX - chopper.x) * Math.min(1, dt * 1.1);
      chopper.y += (targetY - chopper.y) * Math.min(1, dt * 1.1);
      chopper.rotor += dt * 32;
      chopper.spotAngle += dt * 0.8;
    }
    for (const unit of units) {
      if (unit.police) unit.sirenPhase = (unit.sirenPhase + dt * 6) % 1;
      if (unit.wrecked) unit.burning = Math.max(unit.burning, 0.1);
    }
  }

  /** Read by the HUD: named units with range and a short state, nearest first. */
  function dispatch(game) {
    const rows = units
      .filter((unit) => unit.police)
      .map((unit) => {
        const dist = Math.hypot(unit.x - game.player.x, unit.y - game.player.y);
        let status = 'PURSUING';
        if (unit.police.state === 'block') status = 'ROADBLOCK';
        else if (unit.police.state === 'wreck') status = 'DISABLED';
        else if (dist < 110) status = 'RAMMING';
        else if (dist < 190) status = 'CLOSING IN';
        else if (unit.police.flank && dist > 240) status = 'FLANKING';
        return { name: unit.police.name, dist, status, kind: 'car' };
      })
      .sort((a, b) => a.dist - b.dist);
    if (chopper) rows.unshift({ name: chopper.name, dist: Math.hypot(chopper.x - game.player.x, chopper.y - game.player.y), status: 'SPOTLIGHT', kind: 'air' });
    state.chopper = chopper;
    return rows.slice(0, 5);
  }

  function setStars(game, value, heatValue = null) {
    stars = clamp(value, 0, HEAT.maxStars);
    heat = heatValue ?? HEAT.starChance[stars] + 1;
    hiddenTimer = 0;
  }

  return {
    units,
    blocks,
    state,
    get chopper() { return chopper; },
    get stars() { return stars; },
    get heat() { return heat; },
    get hidden() { return hiddenTimer; },
    get lastCrime() { return lastCrime; },
    get crimeFlash() { return crimeFlash; },
    addHeat,
    clearWanted,
    alarm,
    update,
    dispatch,
    spawnUnit,
    spawnRoadblock,
    spawnChopper,
    setStars,
    removeUnit,
    set gameRef(value) { gameRef = value; },
  };
}

export const POLICE_VEHICLE = VEHICLES.police;
