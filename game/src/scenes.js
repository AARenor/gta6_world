// The four screenshot tableaux, staged from the real game systems. Each scene clears the live
// world, places traffic in named lanes, puts people on the pavements, sets the wanted level, the
// job panel and the effects, and points the camera. No random numbers are drawn here: the same
// query gives the same frame every time.

import { CITY, PALETTE } from './config.js';
import { createVehicle } from './traffic.js';

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
  game.hud.state.card = null;
  game.hud.state.cardTimer = 0;
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
  game.hour = 19.05;
  game.traffic.setClock?.(11.2);
  // The hero car, mid-drift up the middle of a four-lane road.
  const car = createVehicle('muscle', X + 15, Y + 30, -Math.PI / 2 + 0.2, '#ff5a2e');
  car.driver = 'player';
  car.speed = 342;
  car.vx = 58;
  car.vy = -336;
  car.slip = 62;
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

  // Four lanes of traffic on the road, two each way, headlights on.
  const traffic = [
    ['taxi', X + 43, Y - 58, -Math.PI / 2, '#f6c33d'],
    ['sedan', X - 15, Y - 24, Math.PI / 2, '#5c8fa8'],
    ['muscle', X - 15, Y + 84, Math.PI / 2, '#f2c94c'],
    ['van', X - 43, Y - 74, Math.PI / 2, '#d9d2c2'],
    ['sedan', X - 43, Y + 34, Math.PI / 2, '#efe3cf'],
    ['courier', X + 43, Y + 168, -Math.PI / 2, '#2f7f83'],
    ['pickup', X - 43, Y - 168, Math.PI / 2, '#8f5a3c'],
  ];
  for (const [type, x, y, angle, color] of traffic) {
    const other = createVehicle(type, x, y, angle, color);
    other.speed = angle > 0 ? -210 : 210;
    game.vehicles.push(other);
  }

  // Police closing in from ahead and from behind.
  cop(game, X - 43, Y - 24, Math.PI / 2, 'V-12', 'block');
  const behind = cop(game, X + 43, Y + 62, -Math.PI / 2, 'V-27');
  behind.speed = 420;
  behind.sirenPhase = 0.32;
  game.police.setStars(game, 3);

  // The job: the Lantern cab waiting at the right kerb.
  const cab = park(game, 'taxi', X + 66, Y + 52, -Math.PI / 2, '#f6c33d');
  cab.indicator = 1;
  cab.indicatorOn = true;
  setJob(game, 0, 1, 'Take the cab from the Motel 9 lot', 'Deliver it to the Tidepool', {
    x: cab.x, y: cab.y, radius: 40, kind: 'target', label: 'THE CAB',
  });

  // Neon at street level either side of the road, roofs dressed behind.
  billboard(game, X - 175, Y - 24, 'VELVET ROOM', PALETTE.neonPink, 120, 36);
  billboard(game, X + 150, Y + 60, 'SODA POP', PALETTE.neonViolet, 110, 34);
  forceSign(game, 3, 4, 'LANTERN ROW', PALETTE.neonPink, 28, 'south');
  forceSign(game, 4, 5, 'MOTEL 9', PALETTE.neonTeal, 30, 'west');
  dressRoof(game, 4, 4);
  dressRoof(game, 3, 5);
  dressRoof(game, 4, 5);
  dressRoof(game, 3, 4);

  // Crowds as bold silhouettes on both pavements, right beside the hero car.
  crowd(game, [
    { x: X - 66, y: Y - 78 }, { x: X - 70, y: Y - 52 }, { x: X - 64, y: Y - 24 },
    { x: X - 70, y: Y + 4 }, { x: X - 64, y: Y + 30 }, { x: X - 70, y: Y + 56 },
    { x: X - 64, y: Y + 82 }, { x: X - 70, y: Y + 108 },
    { x: X + 78, y: Y - 84 }, { x: X + 84, y: Y - 58 }, { x: X + 78, y: Y - 30 },
    { x: X + 84, y: Y + 44 }, { x: X + 78, y: Y + 70 }, { x: X + 84, y: Y + 96 },
    { x: X + 78, y: Y + 122 }, { x: X + 84, y: Y + 148 },
  ]);
  crowd(game, [
    { i: 3, j: 4, u: 0, x: X - 20, y: Y - 92, state: 'cross', angle: -Math.PI / 2 },
    { i: 4, j: 4, u: 0, x: X + 36, y: Y - 104, state: 'cross', angle: Math.PI / 2 },
  ]);

  // Skid marks and tyre smoke from the drift.
  for (let k = 0; k < 8; k += 1) game.effects.spawnSkid(car.x - 26 - k * 20, car.y + 44 + k * 3, car.angle + 0.2);
  for (let k = 0; k < 9; k += 1) game.effects.spawnTyreSmoke(car.x - 18 - k * 10, car.y + 36 + k * 4, car.angle + 0.3);
  game.effects.spawnSparks(X + 43, Y - 96, 0.6, 6);
  game.effects.spawnPuff(cab.x, cab.y, '#a99aa8', 3);

  camera(game, X + 16, Y + 16, 3.9);
  player.angle = -Math.PI / 2 + 0.2;
  game.sceneAim = { x: cab.x, y: cab.y };
  game.hud.say('mara', 'Cab is at the Motel 9 kerb, Ray. VCPD is two blocks out — take it and run the coast road.', 8);
  return 'play';
}

function stageChase(game) {
  const player = game.player;
  game.hour = 20.4;
  const car = createVehicle('sports', CX + 15, CY + 20, -Math.PI / 2 + 0.04, '#ff3f7a');
  car.driver = 'player';
  car.speed = 468;
  car.vx = 18;
  car.vy = -468;
  car.health = 54;
  car.slip = 26;
  car.indicator = 0;
  car.indicatorOn = false;
  game.vehicles.push(car);
  player.inCar = car;
  player.x = car.x;
  player.y = car.y;
  player.health = 51;
  player.armour = 0;
  player.money = 6420;
  player.respect = 3;

  // Four cruisers: one alongside, one at the rear quarter, one cutting ahead, one on the kerb.
  const rammer = cop(game, CX - 43, CY - 16, -Math.PI / 2 - 0.14, 'V-63');
  rammer.health = 74;
  rammer.speed = 430;
  const rear = cop(game, CX - 15, CY + 96, -Math.PI / 2, 'V-40');
  rear.speed = 470;
  rear.sirenPhase = 0.2;
  const cutter = cop(game, CX + 43, CY - 84, -Math.PI / 2 + 0.1, 'V-12');
  cutter.speed = 380;
  cutter.sirenPhase = 0.55;
  const kerb = cop(game, CX + 96, CY + 66, Math.PI / 2 + 0.2, 'V-51', 'block');
  kerb.speed = 0;
  game.police.setStars(game, 4);
  game.police.spawnChopper(game);
  game.police.chopper.x = CX - 74;
  game.police.chopper.y = CY - 52;
  game.police.chopper.angle = 1.9;

  // A courier and a taxi caught in the middle of it.
  const courier = createVehicle('sedan', CX + 43, CY + 58, Math.PI / 2, '#e8dcc4');
  game.vehicles.push(courier);
  const taxi = createVehicle('taxi', CX - 15, CY + 168, -Math.PI / 2, '#f6c33d');
  game.vehicles.push(taxi);

  // Bangs, smoke and flying sparks.
  game.effects.muzzleFlash(CX - 62, CY - 2, Math.atan2(car.y - (CY - 2), car.x - (CX - 62)), 'enemy');
  game.effects.spawnTracer(CX - 62, CY - 2, car.x - 16, car.y + 6, '#ff9a8a');
  game.effects.spawnSparks(CX + 46, CY + 40, 2.6, 16);
  for (let k = 0; k < 12; k += 1) {
    game.effects.spawnTyreSmoke(CX + 18 + k * 5, CY + 62 + k * 11, -Math.PI / 2 + 0.2);
    game.effects.spawnSkid(CX + 30 + k * 3, CY + 46 + k * 10, car.angle);
  }
  // A wrecked car smoulders on the left kerb.
  const wreck = createVehicle('sedan', CX - 78, CY + 44, 0.7, '#5c8fa8');
  wreck.wrecked = true;
  wreck.burning = 3;
  wreck.lightsOn = false;
  game.vehicles.push(wreck);
  for (let k = 0; k < 10; k += 1) {
    game.effects.spawnPuff(CX - 78 + k * 3, CY + 36 - k * 10, `rgba(${190 - k * 6}, ${176 - k * 6}, ${190 - k * 6}, 0.8)`, 2);
  }

  setJob(game, 1, 2, 'Break line of sight and lose the heat', 'Stars cool when they cannot see you', null);

  billboard(game, CX - 175, CY - 24, 'NEON DRIFT', PALETTE.neonViolet, 120, 36);
  billboard(game, CX + 150, CY + 62, 'CINDER GRILL', PALETTE.neonAmber, 116, 34);
  forceSign(game, 5, 5, 'BLUE HOUR', PALETTE.neonViolet, 28, 'south');
  dressRoof(game, 5, 5);
  dressRoof(game, 4, 6);
  dressRoof(game, 5, 6);

  runningCrowd(game, CX, CY + 120, 300, [
    { x: CX - 66, y: CY - 46 }, { x: CX - 70, y: CY + 6 }, { x: CX - 64, y: CY + 52 },
    { x: CX - 70, y: CY + 104 }, { x: CX + 76, y: CY - 60 }, { x: CX + 82, y: CY - 12 },
    { x: CX + 76, y: CY + 36 }, { x: CX + 82, y: CY + 88 }, { x: CX + 76, y: CY + 132 },
    { x: CX - 66, y: CY + 150 },
  ]);
  camera(game, CX + 16, CY + 12, 3.8);
  player.angle = -Math.PI / 2 + 0.04;
  game.sceneAim = { x: CX - 43, y: CY - 16 };
  game.hud.say('cane', 'Kestrel GT, plate VES-9. Roadblock on the coast road — cut the lights.', 8);
  return 'play';
}

function stageMission(game) {
  const player = game.player;
  game.hour = 20.1;
  const car = createVehicle('courier', TX + 54, TY - 8, 0.42, '#3b2b45');
  car.health = 18;
  car.wrecked = true;
  car.burning = 0.8;
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
  game.hud.card('THE TIDEPOOL LEDGER', 'STAGE 2 OF 3', 'TAKE THE LEDGER', '$9,000');

  const traffic = [
    ['sedan', TX - 168, TY - 15, 0, '#efe3cf'],
    ['sports', TX + 196, TY + 15, Math.PI, '#25d0c0'],
    ['taxi', TX + 96, TY - 43, 0, '#f6c33d'],
    ['van', TX - 96, TY + 43, Math.PI, '#d9d2c2'],
  ];
  for (const [type, x, y, angle, color] of traffic) {
    const other = createVehicle(type, x, y, angle, color);
    game.vehicles.push(other);
  }
  const copCar = cop(game, TX + 168, TY - 43, Math.PI, 'V-27', 'block');
  copCar.speed = 0;
  game.police.setStars(game, 2);

  billboard(game, TX - 178, TY - 30, 'THE TIDEPOOL', PALETTE.neonTeal, 124, 38);
  billboard(game, TX + 168, TY + 74, 'LAST CALL', PALETTE.neonAmber, 112, 34);
  forceSign(game, 2, 9, 'PIER NINE', PALETTE.neonAmber, 26, 'south');
  dressRoof(game, 2, 10);
  dressRoof(game, 2, 9);
  dressRoof(game, 3, 10);

  runMissionCrowd(game, TX, TY);
  for (let k = 0; k < 9; k += 1) game.effects.spawnPuff(car.x - 6 + k * 3, car.y - 8 - k * 7, 'rgba(64,52,66,0.85)', 2);
  game.effects.spawnSparks(car.x + 30, car.y + 10, 0.4, 6);
  camera(game, TX + 20, TY - 10, 3.6);
  game.sceneAim = { x: ledger.x, y: ledger.y };
  game.hud.say('mara', 'Ledger is in the wreck. VCPD is rolling — make it quick.', 8);
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
  game.hour = 20.6;
  player.x = X - 10;
  player.y = Y + 10;
  player.angle = -0.5;
  player.health = 74;
  player.armour = 0;
  player.money = 1150;
  player.respect = 1;
  player.weapon = 'smg';
  player.inCar = null;

  // A coupe stopped at the kerb with its driver bailing out.
  const target = createVehicle('sedan', X + 20, Y - 20, 0.06, '#25d0c0');
  target.lightsOn = true;
  target.driver = null;
  target.parked = false;
  target.indicator = 1;
  target.indicatorOn = true;
  game.vehicles.push(target);
  const bailing = game.peds.place(4, 4, 0, {});
  bailing.x = X + 22;
  bailing.y = Y - 58;
  bailing.state = 'flee';
  bailing.panicAngle = -0.9;
  bailing.speed = 210;
  bailing.timer = 2.4;
  bailing.alert = 0;

  game.effects.muzzleFlash(X - 4, Y - 6, -0.5, 'player');
  game.effects.spawnTracer(X - 4, Y - 6, X + 16, Y - 14, '#ffe6a3');
  game.effects.spawnSparks(X + 20, Y - 16, 0.1, 8);
  game.effects.spawnCasing(X - 12, Y + 2, 1.2);
  game.police.setStars(game, 2);

  // Traffic still running on the road either side of the hold-up.
  const traffic = [
    ['taxi', X + 43, Y - 74, -Math.PI / 2, '#f6c33d'],
    ['muscle', X + 15, Y + 92, -Math.PI / 2, '#f2c94c'],
    ['sedan', X - 43, Y + 36, Math.PI / 2, '#5c8fa8'],
    ['van', X - 15, Y - 62, Math.PI / 2, '#4f7078'],
  ];
  for (const [type, x, y, angle, color] of traffic) {
    const other = createVehicle(type, x, y, angle, color);
    game.vehicles.push(other);
  }

  crowd(game, [
    { x: X - 66, y: Y - 82 }, { x: X - 70, y: Y - 54 }, { x: X - 64, y: Y - 26 },
    { x: X - 70, y: Y + 2 }, { x: X - 64, y: Y + 30 }, { x: X - 70, y: Y + 58 },
    { x: X - 64, y: Y + 86 }, { x: X + 76, y: Y + 40 }, { x: X + 82, y: Y + 68 },
    { x: X + 76, y: Y + 96 }, { x: X + 82, y: Y + 124 }, { x: X + 76, y: Y - 96 },
    { x: X + 82, y: Y - 124 }, { x: X - 20, y: Y + 46 }, { x: X + 6, y: Y + 54 },
  ]);
  for (const ped of game.peds.peds) {
    const d = Math.hypot(ped.x - (X + 4), ped.y - (Y - 40));
    if (d < 150) {
      game.peds.startle(ped, X + 4, Y - 40, 1.1);
      ped.timer = 2.8;
    }
  }

  billboard(game, X - 175, Y - 26, 'VELVET ROOM', PALETTE.neonPink, 120, 36);
  billboard(game, X + 150, Y + 60, 'SODA POP', PALETTE.neonAmber, 112, 34);
  forceSign(game, 3, 4, 'BLUE HOUR', PALETTE.neonPink, 28, 'east');
  dressRoof(game, 4, 4);
  dressRoof(game, 3, 4);
  dressRoof(game, 4, 5);

  setJob(game, 0, 1, 'Drive the cab to the Tidepool pier', 'Do not scratch the paint', {
    x: X - 250, y: Y + 320, radius: 50, kind: 'deliver', label: 'THE TIDEPOOL',
  }, 47);

  game.effects.spawnTyreSmoke(X + 30, Y - 20, 0.3);
  camera(game, X + 16, Y + 4, 4.4);
  game.sceneAim = { x: X + 20, y: Y - 22 };
  return 'play';
}
