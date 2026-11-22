// The people on the pavement. Each one walks the perimeter of a block, waits at a corner, and
// sometimes crosses the road on the zebra when the cross traffic is stopped. Gunfire, a crash or
// a body close by sends them running; a few are armed lookouts for the story missions and will
// fire back. No gore: a downed pedestrian folds over and fades after a few seconds.

import { CITY, PALETTE } from './config.js';
import { clamp } from './random.js';
import { signalAt } from './traffic.js';

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
