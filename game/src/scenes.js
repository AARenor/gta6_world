// The four screenshot tableaux, staged from the real game systems. Each scene clears the live
// world, places traffic in named lanes, puts people on the pavements, sets the wanted level, the
// job panel and the effects, and points the camera. No random numbers are drawn here: the same
// query gives the same frame every time.

import { CITY, PALETTE } from './config.js';
import { createVehicle } from './vehicles.js';

const X = 4 * CITY.pitch;
const Y = 5 * CITY.pitch;
const CX = 5 * CITY.pitch;
const CY = 6 * CITY.pitch;
const TX = 2 * CITY.pitch;
const TY = 10 * CITY.pitch;

function reset(game) {
  game.vehicles.length = 0;
  game.traffic.cars.length = 0;
  game.peds.peds.length = 0;
  game.police.units.length = 0;
  game.police.blocks.length = 0;
  game.police.clearWanted();
  game.effects.particles.length = 0;
  game.effects.tracers.length = 0;
  game.effects.skids.length = 0;
  game.effects.rings.length = 0;
  game.missions.targets.length = 0;
  game.city.billboards.length = 0;
  for (const job of game.missions.jobs) {
    job.state = 'locked';
    job.stage = 0;
    job.marker = null;
    job.prompt = false;
    job.timer = 0;
    job.objective = '';
    job.next = '';
  }
  game.player.health = 100;
  game.player.armour = 0;
  game.player.money = 1200;
  game.player.respect = 2;
  game.player.dead = false;
  game.player.inCar = null;
  game.player.weapon = 'smg';
  game.player.unlocked = ['pistol', 'smg', 'shotgun'];
  game.player.ammo.smg = { clip: 24, reserve: 168 };
  game.player.ammo.pistol = { clip: 12, reserve: 96 };
  game.player.ammo.shotgun = { clip: 6, reserve: 30 };
  game.staged = true;
  game.mode = 'play';
  game.hud.state.dialogue = null;
  game.hud.state.toast = null;
  game.hud.state.banner = null;
  game.hud.state.toastTimer = 0;
  game.hud.state.bannerTimer = 0;
  game.hud.state.briefing = null;
  game.effects.skids.length = 0;
}

function lane(game, dirKey, i, j, laneIndex, s, options = {}) {
  return game.traffic.placeCar(game, dirKey, i, j, laneIndex, s, options);
}

function park(game, type, x, y, angle, color = null) {
  const car = createVehicle(type, x, y, angle, color, { parked: true });
  car.lightsOn = false;
  game.vehicles.push(car);
  return car;
}

function cop(game, x, y, angle, name, status = 'pursue') {
  const car = createVehicle('police', x, y, angle, '#f2f0ea', { driver: 'police' });
  car.game = game;
  car.police = { name, state: status, next: null, pathAge: 0, shootTimer: 1, ramTimer: 0, aggression: 1, spin: 0 };
  car.sirenPhase = name.charCodeAt(2) / 40;
  game.vehicles.push(car);
  game.police.units.push(car);
  return car;
}

function crowd(game, spots) {
  for (const spot of spots) {
    const ped = game.peds.place(spot.i, spot.j, spot.u, spot.options ?? {});
    if (spot.x !== undefined) {
      ped.x = spot.x;
      ped.y = spot.y;
    }
    if (spot.state) ped.state = spot.state;
    if (spot.angle !== undefined) ped.angle = spot.angle;
    if (spot.crossing) ped.crossing = spot.crossing;
    if (spot.walking !== undefined) ped.walk = spot.walking;
  }
}

function runningCrowd(game, x, y, radius, spots) {
  crowd(game, spots);
  for (const ped of game.peds.peds) {
    if (Math.hypot(ped.x - x, ped.y - y) < radius) {
      game.peds.startle(ped, x, y, 1.2);
      ped.timer = 3.4;
    }
  }
}

function forceSign(game, blockI, blockJ, text, color, size = 34, pick = 'biggest') {
  const block = game.city.blocks[blockJ * CITY.blocks + blockI];
  if (!block) return;
  let target = block.buildings[0];
  for (const building of block.buildings) {
    if (pick === 'biggest' && building.w * building.h > (target?.w ?? 0) * (target?.h ?? 0)) target = building;
    if (pick === 'south' && building.y + building.h > (target?.y ?? 0) + (target?.h ?? 0)) target = building;
  }
  if (!target) return;
  target.sign = {
    text,
    color,
    x: target.x + 10,
    y: target.y + target.h * 0.22,
    size,
    tilt: 0,
  };
  game.city.signs.push(target.sign);
}

function setJob(game, index, stage, objective, next, marker, timer = 0) {
  const job = game.missions.jobs[index];
  job.state = 'active';
  job.stage = stage;
  job.objective = objective;
  job.next = next;
  job.timer = timer;
  job.marker = marker;
  job.progress = '';
  game.missions.setActive(job);
}

function camera(game, x, y, zoom) {
  game.renderer.camera.x = x;
  game.renderer.camera.y = y;
  game.renderer.camera.zoom = zoom;
  game.renderer.camera.shake = 0;
  game.renderer.camera.shakeX = 0;
  game.renderer.camera.shakeY = 0;
}

/** A neon billboard planted on the pavement for a screenshot. */
function billboard(game, x, y, text, color, w = 132, h = 42) {
  game.city.billboards.push({ x, y, w, h, text, color });
}

/** Put a rooftop pool and a lit edge on the biggest building of a block. */
function dressRoof(game, blockI, blockJ) {
  const block = game.city.blocks[blockJ * CITY.blocks + blockI];
  if (!block) return;
  let target = null;
  for (const building of block.buildings) {
    if (!target || building.w * building.h > target.w * target.h) target = building;
  }
  if (!target) return;
  target.roofPool = { x: target.w * 0.4, y: target.h * 0.3, w: 58, h: 36 };
  target.edgeLights = true;
  target.solar = { x: target.w * 0.1, y: target.h * 0.55, w: 38, h: 26 };
}

export function stageScene(name, game) {
  reset(game);
  const player = game.player;
  switch (name) {
    case 'cover': return stageCover(game);
    case 'chase': return stageChase(game);
    case 'mission': return stageMission(game);
    case 'onfoot': return stageOnfoot(game);
    default: {
      player.x = CITY.pitch * 3.5;
      player.y = CITY.pitch * 5.5;
      game.hour = 18.6;
      return 'play';
    }
  }
}

function stageCover(game) {
  const player = game.player;
  game.hour = 18.35;
  game.traffic.setClock?.(11.2);
  // The hero car, mid-drift through the junction.
  const car = createVehicle('muscle', X + 18, Y + 64, -Math.PI / 2 + 0.4, '#ff6a3d');
  car.driver = 'player';
  car.speed = 322;
  car.vx = 150;
  car.vy = -270;
  car.slip = 74;
  car.roll = 0.06;
  car.indicator = 1;
  car.indicatorOn = true;
  game.vehicles.push(car);
  player.inCar = car;
  player.x = car.x;
  player.y = car.y;
  player.health = 82;
  player.armour = 46;
  player.money = 18450;
  player.respect = 4;

  // Traffic on all four arms, four lanes of it.
  lane(game, 'E', 3, 5, 1, 60, { type: 'taxi', color: '#f6c33d' });
  lane(game, 'E', 3, 5, 1, 200, { type: 'sedan', color: '#5c8fa8' });
  lane(game, 'E', 3, 5, 1, 330, { type: 'sports', color: '#25d0c0' });
  lane(game, 'E', 4, 5, 1, 110, { type: 'van', color: '#d9d2c2' });
  lane(game, 'E', 4, 5, 1, 240, { type: 'pickup', color: '#8f5a3c' });
  lane(game, 'E', 4, 5, 1, 380, { type: 'taxi', color: '#f6c33d' });
  lane(game, 'E', 3, 5, 0, 150, { type: 'muscle', color: '#f2c94c' });
  lane(game, 'E', 4, 5, 0, 170, { type: 'sedan', color: '#efe3cf' });
  lane(game, 'W', 5, 5, 1, 110, { type: 'sedan', color: '#c95b6b' });
  lane(game, 'W', 5, 5, 1, 250, { type: 'courier', color: '#3b2b45' });
  lane(game, 'W', 5, 5, 1, 400, { type: 'van', color: '#4f7078' });
  lane(game, 'W', 4, 5, 1, 120, { type: 'muscle', color: '#b04a54' });
  lane(game, 'W', 4, 5, 1, 300, { type: 'taxi', color: '#f6c33d' });
  lane(game, 'W', 5, 5, 0, 330, { type: 'sports', color: '#ff3f7a' });
  lane(game, 'N', 4, 6, 1, 220, { type: 'sedan', color: '#e8dcc4' });
  lane(game, 'N', 4, 6, 1, 350, { type: 'pickup', color: '#3f6d57' });
  lane(game, 'N', 4, 5, 1, 150, { type: 'van', color: '#a9566a' });
  lane(game, 'N', 4, 5, 0, 320, { type: 'taxi', color: '#f6c33d' });
  lane(game, 'S', 4, 4, 1, 300, { type: 'sports', color: '#25d0c0' });
  lane(game, 'S', 4, 5, 1, 150, { type: 'sedan', color: '#7f8f6a' });
  lane(game, 'S', 4, 5, 1, 300, { type: 'courier', color: '#2f7f83' });
  lane(game, 'S', 4, 4, 0, 220, { type: 'muscle', color: '#efe3cf' });

  // Police closing in from behind and across the junction.
  cop(game, X + 128, Y + 152, -Math.PI / 2, 'V-12');
  const cross = cop(game, X + 172, Y - 40, Math.PI, 'V-27');
  cross.speed = 120;
  const left = cop(game, X - 186, Y + 44, 0, 'V-40');
  left.sirenPhase = 0.4;
  game.police.setStars(game, 3);

  // The job: take the parked cab at the kerb.
  const cab = park(game, 'taxi', X - 104, Y + 118, -Math.PI / 2, '#f6c33d');
  cab.indicator = 0;
  setJob(game, 0, 0, 'Take the Lantern cab from the Motel 9 lot', 'Deliver it to the Tidepool', {
    x: cab.x, y: cab.y, radius: 42, kind: 'target', label: 'THE CAB',
  });

  // Neon at street level either side of the junction, roofs dressed behind.
  billboard(game, X - 230, Y + 42, 'VELVET ROOM', PALETTE.neonPink, 148, 44);
  billboard(game, X + 120, Y - 122, 'SODA POP', PALETTE.neonViolet, 116, 38);
  forceSign(game, 3, 4, 'LANTERN ROW', PALETTE.neonPink, 28, 'south');
  dressRoof(game, 4, 4);
  dressRoof(game, 3, 5);
  dressRoof(game, 4, 5);
  dressRoof(game, 3, 4);

  // Crowds on all four pavements, a pair stepping out on the north crossing.
  crowd(game, [
    { i: 3, j: 4, u: 540 }, { i: 3, j: 4, u: 566 }, { i: 3, j: 4, u: 592 }, { i: 3, j: 4, u: 618 },
    { i: 4, j: 4, u: 60 }, { i: 4, j: 4, u: 84 }, { i: 4, j: 4, u: 108 }, { i: 4, j: 4, u: 700 },
    { i: 4, j: 4, u: 730 }, { i: 4, j: 4, u: 760 }, { i: 3, j: 4, u: 40 }, { i: 3, j: 4, u: 90 },
    { i: 4, j: 4, u: 180 }, { i: 4, j: 4, u: 220 }, { i: 3, j: 4, u: 140 }, { i: 3, j: 4, u: 190 },
    { i: 3, j: 5, u: 60 }, { i: 3, j: 5, u: 96 }, { i: 3, j: 5, u: 40 }, { i: 3, j: 5, u: 700 },
    { i: 4, j: 5, u: 20 }, { i: 4, j: 5, u: 56 }, { i: 4, j: 5, u: 660 }, { i: 4, j: 5, u: 690 },
    { i: 4, j: 5, u: 620 }, { i: 3, j: 5, u: 660 }, { i: 4, j: 5, u: 500 }, { i: 4, j: 5, u: 470 },
    { i: 3, j: 4, u: 690 }, { i: 4, j: 4, u: 660 },
  ]);
  crowd(game, [
    { i: 3, j: 4, u: 0, x: X - 30, y: Y - 84, state: 'cross', crossing: { x: X - 30, y: Y - 150, block: { i: 3, j: 4 } }, angle: -Math.PI / 2 },
    { i: 4, j: 4, u: 0, x: X + 36, y: Y - 96, state: 'cross', crossing: { x: X + 32, y: Y - 26, block: { i: 4, j: 4 } }, angle: Math.PI / 2 },
    { i: 3, j: 4, u: 0, x: X - 8, y: Y + 88, state: 'cross', crossing: { x: X - 8, y: Y + 150, block: { i: 3, j: 5 } }, angle: Math.PI / 2 },
  ]);
  // The pavements in the hero frame: a dozen people close enough to read.
  crowd(game, [
    { x: X - 260, y: Y + 62 }, { x: X - 226, y: Y + 66 }, { x: X - 190, y: Y + 60 },
    { x: X - 150, y: Y + 64 }, { x: X + 150, y: Y + 62 }, { x: X + 186, y: Y + 66 },
    { x: X + 222, y: Y + 60 }, { x: X + 62, y: Y + 130 }, { x: X + 62, y: Y + 164 },
    { x: X - 62, y: Y + 130 }, { x: X - 62, y: Y + 160 }, { x: X + 62, y: Y - 126 },
    { x: X - 62, y: Y - 160 },
  ]);

  // Skid marks and tyre smoke from the drift.
  for (let k = 0; k < 7; k += 1) game.effects.spawnSkid(car.x - 34 - k * 24, car.y + 36 + k * 4, car.angle + 0.2);
  for (let k = 0; k < 8; k += 1) game.effects.spawnTyreSmoke(car.x - 24 - k * 12, car.y + 28 + k * 5, car.angle + 0.3);
  game.effects.spawnSparks(cross.x - 30, cross.y + 6, 0.6, 5);
  game.effects.spawnPuff(cab.x, cab.y, '#a99aa8', 3);

  camera(game, X + 16, Y - 6, 1.85);
  player.angle = -Math.PI / 2 + 0.4;
  game.sceneAim = { x: cab.x, y: cab.y };
  return 'play';
}

function stageChase(game) {
  const player = game.player;
  game.hour = 19.15;
  const car = createVehicle('sports', CX + 10, CY + 130, -Math.PI / 2 + 0.08, '#ff3f7a');
  car.driver = 'player';
  car.speed = 448;
  car.vx = 20;
  car.vy = -448;
  car.health = 62;
  car.indicator = 0;
  game.vehicles.push(car);
  player.inCar = car;
  player.x = car.x;
  player.y = car.y;
  player.health = 58;
  player.armour = 0;
  player.money = 6420;
  player.respect = 3;

  // Four cruisers: two behind, one alongside, one cutting across the front.
  cop(game, CX - 58, CY + 214, -Math.PI / 2, 'V-40');
  cop(game, CX + 68, CY + 206, -Math.PI / 2 + 0.05, 'V-51');
  const rammer = cop(game, CX + 74, CY + 86, -Math.PI / 2 - 0.2, 'V-63');
  rammer.health = 74;
  const cutter = cop(game, CX - 74, CY + 20, -Math.PI / 2, 'V-12');
  game.police.setStars(game, 3);
  game.police.spawnChopper(game);
  game.police.chopper.x = CX + 62;
  game.police.chopper.y = CY + 150;
  game.police.chopper.angle = 1.6;

  // Roadblock across the junction ahead.
  for (let k = -1; k <= 1; k += 1) {
    const blockCar = cop(game, CX + k * 46, CY - 58 + Math.abs(k) * 8, Math.PI / 2 + k * 0.12, `B-${k + 2}`, 'block');
    blockCar.police.state = 'block';
  }

  // A courier and a taxi caught in the middle of the chase.
  lane(game, 'N', 5, 5, 1, 120, { type: 'sedan', color: '#e8dcc4' });
  lane(game, 'S', 5, 5, 1, 250, { type: 'taxi', color: '#f6c33d' });
  lane(game, 'N', 5, 6, 0, 300, { type: 'van', color: '#4f7078' });
  lane(game, 'N', 5, 5, 0, 330, { type: 'pickup', color: '#8f5a3c' });
  lane(game, 'S', 5, 5, 0, 160, { type: 'sedan', color: '#5c8fa8' });

  // Bangs, smoke and flying sparks.
  game.effects.muzzleFlash(CX + 92, CY + 96, Math.atan2(car.y - (CY + 96), car.x - (CX + 92)), 'enemy');
  game.effects.spawnTracer(CX + 92, CY + 96, car.x + 20, car.y + 4, '#ff9a8a');
  game.effects.spawnSparks(CX + 56, CY + 128, 2.6, 16);
  for (let k = 0; k < 10; k += 1) {
    game.effects.spawnTyreSmoke(CX - 6 - k * 9, CY + 148 + k * 12, -Math.PI / 2 + 0.2);
    game.effects.spawnSkid(CX - 16 - k * 7, CY + 176 + k * 10, car.angle);
  }
  // A wrecked car smoulders at the kerb behind the chase.
  const wreck = createVehicle('sedan', CX - 150, CY + 196, 0.7, '#5c8fa8');
  wreck.wrecked = true;
  wreck.burning = 3;
  wreck.lightsOn = false;
  game.vehicles.push(wreck);
  for (let k = 0; k < 10; k += 1) {
    game.effects.spawnPuff(CX - 150 + k * 2, CY + 190 - k * 9, 'rgba(52, 42, 56, 0.8)', 2);
  }
  game.effects.spawnPuff(CX - 58, CY + 214, '#9a8b98', 6);

  setJob(game, 1, 2, 'Break line of sight and lose the heat', 'Stars cool when they cannot see you', null);

  billboard(game, CX - 152, CY + 158, 'NEON DRIFT', PALETTE.neonViolet, 146, 44);
  billboard(game, CX + 152, CY + 58, 'CINDER GRILL', PALETTE.neonAmber, 148, 44);
  billboard(game, CX - 150, CY - 66, 'TIKI TONIC', PALETTE.neonTeal, 132, 40);
  forceSign(game, 5, 5, 'BLUE HOUR', PALETTE.neonViolet, 28, 'south');
  dressRoof(game, 5, 5);
  dressRoof(game, 4, 6);
  dressRoof(game, 5, 6);

  runningCrowd(game, CX, CY + 120, 380, [
    { i: 4, j: 6, u: 40 }, { i: 4, j: 6, u: 90 }, { i: 4, j: 6, u: 150 }, { i: 4, j: 6, u: 210 },
    { i: 4, j: 6, u: 500 }, { i: 4, j: 6, u: 560 }, { i: 4, j: 6, u: 620 },
    { i: 5, j: 6, u: 20 }, { i: 5, j: 6, u: 60 }, { i: 5, j: 6, u: 120 }, { i: 5, j: 6, u: 280 },
    { i: 5, j: 6, u: 520 }, { i: 5, j: 6, u: 580 }, { i: 5, j: 6, u: 640 },
    { i: 5, j: 5, u: 60 }, { i: 5, j: 5, u: 120 }, { i: 5, j: 5, u: 700 }, { i: 5, j: 5, u: 740 },
    { i: 4, j: 5, u: 300 }, { i: 4, j: 5, u: 340 }, { i: 4, j: 5, u: 200 }, { i: 5, j: 5, u: 220 },
    { i: 4, j: 5, u: 460 }, { i: 4, j: 5, u: 520 }, { i: 5, j: 6, u: 360 }, { i: 4, j: 6, u: 380 },
  ]);
  camera(game, CX + 6, CY + 62, 1.85);
  player.angle = -Math.PI / 2 + 0.08;
  game.sceneAim = { x: CX + 40, y: CY - 40 };
  return 'play';
}

function stageMission(game) {
  const player = game.player;
  game.hour = 18.95;
  const car = createVehicle('courier', TX + 54, TY - 8, 0.42, '#3b2b45');
  car.health = 18;
  car.wrecked = true;
  car.burning = 0.6;
  car.lightsOn = false;
  car.driver = null;
  game.vehicles.push(car);
  // The player stands a few paces off the wreck, gun up, the case glowing on the asphalt.
  player.x = TX - 24;
  player.y = TY + 30;
  player.angle = -0.2;
  player.health = 74;
  player.armour = 20;
  player.money = 24700;
  player.respect = 6;
  player.weapon = 'shotgun';
  player.inCar = null;

  const ledger = { x: TX + 112, y: TY + 26, taken: false };
  game.missions.setStagedLedger(ledger);
  setJob(game, 2, 2, 'Take the ledger from the wreck', 'Walk to the case', {
    x: ledger.x, y: ledger.y, radius: 34, kind: 'take', label: 'THE LEDGER',
  });

  lane(game, 'E', 2, 10, 1, 118, { type: 'sedan', color: '#efe3cf' });
  lane(game, 'E', 2, 10, 0, 240, { type: 'pickup', color: '#3f6d57' });
  lane(game, 'W', 3, 10, 1, 160, { type: 'taxi', color: '#f6c33d' });
  lane(game, 'S', 2, 10, 1, 250, { type: 'van', color: '#d9d2c2' });
  lane(game, 'E', 2, 10, 1, 360, { type: 'muscle', color: '#f2c94c' });
  lane(game, 'W', 3, 10, 0, 80, { type: 'sports', color: '#25d0c0' });
  const copCar = cop(game, TX - 200, TY + 20, 0, 'V-27');
  copCar.police.state = 'block';
  copCar.speed = 0;
  game.police.setStars(game, 2);

  billboard(game, TX + 180, TY - 72, 'THE TIDEPOOL', PALETTE.neonTeal, 154, 44);
  forceSign(game, 2, 9, 'LAST CALL', PALETTE.neonAmber, 26, 'south');
  dressRoof(game, 2, 10);
  dressRoof(game, 2, 9);
  dressRoof(game, 3, 10);

  runMissionCrowd(game, TX, TY);
  for (let k = 0; k < 8; k += 1) game.effects.spawnPuff(car.x - 6 + k * 3, car.y - 8 - k * 6, 'rgba(60,48,60,0.8)', 2);
  game.effects.spawnSparks(car.x + 30, car.y + 10, 0.4, 6);
  camera(game, TX + 36, TY + 14, 2.0);
  game.sceneAim = { x: ledger.x, y: ledger.y };
  return 'play';
}

function runMissionCrowd(game, x, y) {
  crowd(game, [
    { i: 2, j: 10, u: 30 }, { i: 2, j: 10, u: 80 }, { i: 2, j: 10, u: 190 }, { i: 2, j: 10, u: 240 },
    { i: 2, j: 9, u: 40 }, { i: 2, j: 9, u: 120 }, { i: 3, j: 10, u: 40 }, { i: 3, j: 10, u: 110 },
    { i: 3, j: 10, u: 260 }, { i: 3, j: 9, u: 300 },
    { i: 2, j: 10, u: 0, x: x - 120, y: y - 30, state: 'flee', angle: Math.PI * 0.8 },
    { i: 2, j: 10, u: 0, x: x - 96, y: y - 72, state: 'flee', angle: Math.PI * 0.95 },
    { i: 2, j: 10, u: 0, x: x + 40, y: y - 118, state: 'flee', angle: -0.4 },
    { i: 3, j: 10, u: 0, x: x + 200, y: y + 60, state: 'flee', angle: -0.2 },
  ]);
  for (const ped of game.peds.peds) ped.alert = 0;
  const watcher = game.peds.peds[4];
  if (watcher) watcher.alert = 0;
}

function stageOnfoot(game) {
  const player = game.player;
  game.hour = 19.5;
  player.x = X - 40;
  player.y = Y - 20;
  player.angle = -0.5;
  player.health = 74;
  player.armour = 0;
  player.money = 1150;
  player.respect = 1;
  player.weapon = 'smg';
  player.inCar = null;

  // A coupe stopped at the kerb with its driver bailing out.
  const target = createVehicle('sedan', X + 6, Y - 40, Math.PI * 0.04, '#25d0c0');
  target.lightsOn = true;
  target.driver = null;
  target.parked = true;
  target.indicator = 1;
  target.indicatorOn = true;
  game.vehicles.push(target);
  const bailing = game.peds.place(4, 4, 0, {});
  bailing.x = X + 6;
  bailing.y = Y - 86;
  bailing.state = 'flee';
  bailing.panicAngle = -0.9;
  bailing.speed = 210;
  bailing.timer = 2.4;
  bailing.alert = 0;

  game.effects.muzzleFlash(X - 30, Y - 30, -0.5, 'player');
  game.effects.spawnTracer(X - 30, Y - 30, X + 2, Y - 34, '#ffe6a3');
  game.effects.spawnSparks(X + 2, Y - 34, 0.1, 8);
  game.effects.spawnCasing(X - 36, Y - 24, 1.2);
  game.police.setStars(game, 2);

  lane(game, 'E', 3, 5, 1, 96, { type: 'taxi', color: '#f6c33d' });
  lane(game, 'E', 3, 5, 1, 210, { type: 'muscle', color: '#f2c94c' });
  lane(game, 'W', 4, 5, 1, 340, { type: 'sedan', color: '#5c8fa8' });
  lane(game, 'N', 4, 5, 1, 300, { type: 'van', color: '#4f7078' });
  lane(game, 'S', 3, 5, 0, 60, { type: 'sports', color: '#ff3f7a' });

  crowd(game, [
    { i: 4, j: 4, u: 300 }, { i: 4, j: 4, u: 330 }, { i: 4, j: 4, u: 270 }, { i: 4, j: 4, u: 240 },
    { i: 3, j: 4, u: 40 }, { i: 3, j: 4, u: 70 }, { i: 3, j: 4, u: 130 }, { i: 4, j: 5, u: 60 },
    { i: 4, j: 5, u: 100 }, { i: 4, j: 5, u: 30 }, { i: 3, j: 5, u: 250 }, { i: 4, j: 4, u: 180 },
    { i: 4, j: 4, u: 200 }, { i: 3, j: 4, u: 300 }, { i: 4, j: 5, u: 150 }, { i: 3, j: 5, u: 300 },
    { x: X - 230, y: Y + 62 }, { x: X - 196, y: Y + 66 }, { x: X - 150, y: Y + 60 },
    { x: X + 100, y: Y + 64 }, { x: X + 140, y: Y + 62 }, { x: X + 180, y: Y + 60 },
    { x: X + 64, y: Y - 130 }, { x: X - 64, y: Y - 150 },
    { x: X - 30, y: Y + 20 }, { x: X + 34, y: Y + 28 },
  ]);
  for (const ped of game.peds.peds) {
    const d = Math.hypot(ped.x - (X - 6), ped.y - (Y - 60));
    if (d < 130) {
      game.peds.startle(ped, X - 6, Y - 60, 1.1);
      ped.timer = 2.8;
    }
  }

  billboard(game, X - 235, Y - 64, 'VELVET ROOM', PALETTE.neonPink, 152, 46);
  billboard(game, X + 210, Y - 64, 'SODA POP', PALETTE.neonAmber, 122, 40);
    forceSign(game, 3, 4, 'BLUE HOUR', PALETTE.neonPink, 28, 'east');
  dressRoof(game, 4, 4);
  dressRoof(game, 3, 4);
  dressRoof(game, 4, 5);

  setJob(game, 0, 1, 'Drive the cab to the Tidepool pier', 'Do not scratch the paint', {
    x: X - 250, y: Y + 320, radius: 50, kind: 'deliver', label: 'THE TIDEPOOL',
  }, 47);

  game.effects.spawnTyreSmoke(X + 20, Y - 40, 0.3);
  camera(game, X - 6, Y - 30, 2.0);
  game.sceneAim = { x: X + 6, y: Y - 42 };
  return 'play';
}
