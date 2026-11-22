// Bullets, the only shared violence in the game. A shot is a short ray walked forward in small
// steps: the first wall, pedestrian, car or officer it meets stops it. Player bullets raise the
// heat; police bullets take health. Effects are spawned where the ray ends, never inside a wall.

import { CITY } from './config.js';
import { damageVehicle } from './vehicles.js';

const STEP = 11;

export function traceBullet(game, x, y, angle, range, options = {}) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const ignore = options.ignore ?? null;
  const fromPlayer = options.fromPlayer ?? false;
  for (let t = STEP; t <= range; t += STEP) {
    const px = x + dx * t;
    const py = y + dy * t;
    if (px < 20 || py < 20 || px > CITY.size - 20 || py > CITY.size - 20) {
      return { x: px, y: py, dist: t, kind: 'edge', ref: null };
    }
    const wall = game.city.buildingAt(px, py, 2);
    if (wall) return { x: px, y: py, dist: t, kind: 'wall', ref: wall };
    if (game.player && !fromPlayer && game.player.inCar === null) {
      if (Math.hypot(px - game.player.x, py - game.player.y) < 12) {
        return { x: px, y: py, dist: t, kind: 'player', ref: game.player };
      }
    }
    for (const ped of game.peds.peds) {
      if (ped === ignore || ped.state === 'down') continue;
      if (Math.hypot(px - ped.x, py - ped.y) < 11) {
        return { x: px, y: py, dist: t, kind: 'ped', ref: ped };
      }
    }
    for (const vehicle of game.vehicles) {
      if (vehicle === ignore || vehicle.wrecked) continue;
      const cos = Math.cos(vehicle.angle);
      const sin = Math.sin(vehicle.angle);
      const relX = px - vehicle.x;
      const relY = py - vehicle.y;
      const along = relX * cos + relY * sin;
      const across = -relX * sin + relY * cos;
      if (Math.abs(along) < vehicle.length * 0.5 && Math.abs(across) < vehicle.width * 0.55) {
        return { x: px, y: py, dist: t, kind: 'vehicle', ref: vehicle };
      }
    }
  }
  return { x: x + dx * range, y: y + dy * range, dist: range, kind: null, ref: null };
}

/** Apply one bullet's result; returns true when something was hit. */
export function applyBullet(game, hit, damage, fromPlayer, shooter) {
  switch (hit.kind) {
    case 'wall': {
      game.effects.spawnSparks(hit.x, hit.y, Math.atan2(hit.y - shooter.y, hit.x - shooter.x), 5);
      game.effects.spawnPuff(hit.x, hit.y, '#d8c3b0');
      return true;
    }
    case 'ped': {
      game.peds.damagePed(hit.ref, damage, shooter.x, shooter.y);
      game.peds.startleAround(hit.x, hit.y, 180, 1.4);
      game.effects.spawnSparks(hit.x, hit.y, Math.atan2(shooter.y - hit.y, shooter.x - hit.x), 3);
      if (fromPlayer) {
        game.police?.addHeat(hit.ref.state === 'down' ? 55 : 28, 'shooting');
        game.onPedShot?.(hit.ref);
      }
      return true;
    }
    case 'vehicle': {
      const vehicle = hit.ref;
      damageVehicle(game, vehicle, damage);
      game.effects.spawnSparks(hit.x, hit.y, Math.atan2(shooter.y - hit.y, shooter.x - hit.x), 4);
      if (vehicle.driver === 'police' || vehicle.type === 'police') {
        game.police?.addHeat(fromPlayer ? 24 : 0, 'shooting');
      } else if (fromPlayer) {
        game.police?.addHeat(8, 'shooting');
        if (vehicle.ai) {
          vehicle.ai.stunned = 1.2;
          const ai = vehicle.ai;
          ai.cruise = 0;
        }
      }
      return true;
    }
    case 'player': {
      game.hurtPlayer(damage, 'bullet');
      return true;
    }
    case 'edge':
      return false;
    default:
      return false;
  }
}

export function fireBullet(game, options) {
  const { x, y, angle, weapon, fromPlayer, ignore, shooter } = options;
  for (let pellet = 0; pellet < (weapon.pellets ?? 1); pellet += 1) {
    const spread = (game.rng() - 0.5) * (weapon.spread ?? 0.02) * 2;
    const shotAngle = angle + spread;
    const hit = traceBullet(game, x, y, shotAngle, weapon.range, { fromPlayer, ignore });
    const endX = hit.x;
    const endY = hit.y;
    game.effects.spawnTracer(x, y, endX, endY, fromPlayer ? weapon.tracer : '#ff9a8a');
    applyBullet(game, hit, weapon.damage, fromPlayer, { x, y });
  }
}
