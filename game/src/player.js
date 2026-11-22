// Ray Calle: on the pavement he walks, sprints, aims at the mouse, fires, reloads and pulls
// drivers out of their cars; behind the wheel he feeds the car's arcade physics with throttle,
// brake and handbrake, and can still lean out and shoot. Health, armour, ammo and cash live here.

import { CITY, PLAYER, WEAPONS } from './config.js';
import { approach, clamp } from './random.js';
import { fireBullet } from './police.js';
import { updateVehiclePhysics } from './traffic.js';

export function createPlayer(x, y) {
  return {
    x,
    y,
    angle: 0,
    speed: 0,
    vx: 0,
    vy: 0,
    walk: 0,
    health: PLAYER.health,
    armour: PLAYER.armour,
    money: PLAYER.startMoney,
    inCar: null,
    weapon: 'pistol',
    unlocked: ['pistol'],
    ammo: {
      pistol: { clip: WEAPONS.pistol.clip, reserve: WEAPONS.pistol.reserve },
      smg: { clip: WEAPONS.smg.clip, reserve: WEAPONS.smg.reserve },
      shotgun: { clip: WEAPONS.shotgun.clip, reserve: WEAPONS.shotgun.reserve },
    },
    cooldown: 0,
    reload: 0,
    recoil: 0,
    hitFlash: 0,
    invulnerable: 0,
    sprinting: false,
    lastDamage: 0,
    enteredCooldown: 0,
    dead: false,
    respect: 0,
    pickupsTaken: 0,
  };
}

export function updatePlayer(game, dt) {
  const player = game.player;
  const input = game.input;
  player.cooldown = Math.max(0, player.cooldown - dt);
  if (player.reload > 0) {
    player.reload = Math.max(0, player.reload - dt);
    if (player.reload === 0) finishReload(game);
  }
  player.recoil = Math.max(0, player.recoil - dt * 8);
  player.hitFlash = Math.max(0, player.hitFlash - dt * 3);
  player.invulnerable = Math.max(0, player.invulnerable - dt);
  player.enteredCooldown = Math.max(0, player.enteredCooldown - dt);
  player.lastDamage += dt;

  if (player.inCar) {
    driveCar(game, dt);
    return;
  }

  const weapon = WEAPONS[player.weapon];
  const axes = input.axes();
  player.sprinting = input.down('ShiftLeft') || input.down('ShiftRight');
  const speed = player.sprinting ? PLAYER.sprint : PLAYER.walk;
  let mx = axes.x;
  let my = axes.y;
  const len = Math.hypot(mx, my);
  if (len > 0) {
    mx /= len;
    my /= len;
    player.walk += dt * (player.sprinting ? 11 : 7);
  } else {
    player.walk += dt * 1.5;
  }
  player.vx = approach(player.vx, mx * speed, dt * 1600);
  player.vy = approach(player.vy, my * speed, dt * 1600);
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  player.speed = Math.hypot(player.vx, player.vy);

  const pointer = game.pointer ?? { x: player.x + 100, y: player.y };
  player.angle = Math.atan2(pointer.y - player.y, pointer.x - player.x);

  pushOutOfCity(game, player, PLAYER.radius);
  player.x = clamp(player.x, 30, CITY.size - 30);
  player.y = clamp(player.y, 30, CITY.size - 30);

  // E enters the nearest drivable car, unless a fixer is waiting to talk.
  if (input.pressed('KeyE') && player.enteredCooldown <= 0 && hasCarNear(game, 104) && !game.missions.nearGiver(player)) {
    input.take('KeyE');
    enterNearestCar(game);
  }
  if (input.take('KeyR')) startReload(game);
  if (input.take('Digit1')) selectWeapon(game, 'pistol');
  if (input.take('Digit2')) selectWeapon(game, 'smg');
  if (input.take('Digit3')) selectWeapon(game, 'shotgun');

  const firing = weapon.auto ? input.mouse.down : input.takeClick();
  if (firing && player.cooldown <= 0 && player.reload <= 0) {
    fireFromFoot(game);
  }
}

function pushOutOfCity(game, actor, radius) {
  const building = game.city.buildingAt(actor.x, actor.y, radius);
  if (!building) return false;
  const left = actor.x + radius - building.x;
  const right = building.x + building.w - (actor.x - radius);
  const top = actor.y + radius - building.y;
  const bottom = building.y + building.h - (actor.y - radius);
  const min = Math.min(left, right, top, bottom);
  if (min === left) actor.x -= left;
  else if (min === right) actor.x += right;
  else if (min === top) actor.y -= top;
  else actor.y += bottom;
  return true;
}

function hasCarNear(game, range) {
  const player = game.player;
  for (const vehicle of game.vehicles) {
    if (vehicle.wrecked) continue;
    if (Math.hypot(vehicle.x - player.x, vehicle.y - player.y) < range) return true;
  }
  return false;
}

function enterNearestCar(game) {
  const player = game.player;
  let best = null;
  let bestDist = 104;
  for (const vehicle of game.vehicles) {
    if (vehicle.wrecked) continue;
    const d = Math.hypot(vehicle.x - player.x, vehicle.y - player.y);
    if (d < bestDist) {
      best = vehicle;
      bestDist = d;
    }
  }
  if (!best) return;
  if (best.ai) {
    // Carjacking: the driver bails out and runs, and somebody called it in.
    game.traffic.remove(best);
    const bail = Math.atan2(best.y - player.y, best.x - player.x) + Math.PI * 0.5;
    const ped = game.peds.makePed(
      clamp(Math.floor((best.x + Math.cos(bail) * 26) / CITY.pitch), 0, CITY.blocks - 1),
      clamp(Math.floor((best.y + Math.sin(bail) * 26) / CITY.pitch), 0, CITY.blocks - 1),
      0,
    );
    ped.x = best.x + Math.cos(bail) * 26;
    ped.y = best.y + Math.sin(bail) * 26;
    game.peds.startle(ped, player.x, player.y, 1.8);
    game.police?.addHeat(26, 'carjacking');
    game.audio.carjack();
  } else if (best.parked) {
    game.police?.addHeat(6, 'stealing');
  }
  best.ai = null;
  best.driver = 'player';
  best.parked = false;
  best.lightsOn = true;
  player.inCar = best;
  player.enteredCooldown = 0.5;
  player.x = best.x;
  player.y = best.y;
  game.audio.engineStart();
  game.effects.spawnPuff(best.x, best.y, '#8b8b9a');
}

export function exitCar(game) {
  const player = game.player;
  const car = player.inCar;
  if (!car) return;
  const side = car.angle + Math.PI * 0.5;
  let x = car.x + Math.cos(side) * (car.width * 0.5 + 14);
  let y = car.y + Math.sin(side) * (car.width * 0.5 + 14);
  if (game.city.buildingAt(x, y, 10)) {
    x = car.x - Math.cos(side) * (car.width * 0.5 + 14);
    y = car.y - Math.sin(side) * (car.width * 0.5 + 14);
  }
  player.x = x;
  player.y = y;
  player.vx = car.vx * 0.2;
  player.vy = car.vy * 0.2;
  player.inCar = null;
  player.enteredCooldown = 0.4;
  car.driver = null;
  car.braking = true;
  car.indicator = 0;
  game.audio.door();
}

function driveCar(game, dt) {
  const player = game.player;
  const car = player.inCar;
  const input = game.input;
  const axes = input.axes();
  const controls = {
    throttle: -axes.y > 0 ? 1 : 0,
    brake: axes.y > 0 ? 1 : 0,
    steer: axes.x,
    handbrake: input.down('Space'),
  };
  if (input.take('KeyE')) {
    exitCar(game);
    return;
  }
  updateVehiclePhysics(game, car, dt, controls);
  player.x = car.x;
  player.y = car.y;
  const pointer = game.pointer ?? { x: car.x, y: car.y - 100 };
  car.aimAngle = Math.atan2(pointer.y - car.y, pointer.x - car.x);
  const weapon = WEAPONS[player.weapon];
  const firing = weapon.auto ? input.mouse.down : input.takeClick();
  if (firing && player.cooldown <= 0 && player.reload <= 0) {
    player.cooldown = weapon.rate;
    player.recoil = 1;
    const angle = car.aimAngle;
    const mx = car.x + Math.cos(angle) * (car.length * 0.5 + 8);
    const my = car.y + Math.sin(angle) * (car.length * 0.5 + 8);
    game.effects.muzzleFlash(mx, my, angle, 'player');
    game.audio.gunshot(1);
    fireBullet(game, { x: mx, y: my, angle, weapon, fromPlayer: true, ignore: car, shooter: { x: mx, y: my } });
    game.peds.startleAround(mx, my, 250, 1.2);
    game.police?.addHeat(8, 'shooting');
    drainAmmo(game, weapon);
  }
  if (input.take('KeyR')) startReload(game);
  if (input.take('Digit1')) selectWeapon(game, 'pistol');
  if (input.take('Digit2')) selectWeapon(game, 'smg');
  if (input.take('Digit3')) selectWeapon(game, 'shotgun');
}

function fireFromFoot(game) {
  const player = game.player;
  const weapon = WEAPONS[player.weapon];
  player.cooldown = weapon.rate;
  player.recoil = 1;
  const angle = player.angle;
  const mx = player.x + Math.cos(angle) * 16;
  const my = player.y + Math.sin(angle) * 16;
  game.effects.muzzleFlash(mx, my, angle, 'player');
  game.audio.gunshot(1);
  fireBullet(game, { x: mx, y: my, angle, weapon, fromPlayer: true, shooter: { x: mx, y: my } });
  game.peds.startleAround(mx, my, 250, 1.2);
  game.police?.addHeat(8, 'shooting');
  drainAmmo(game, weapon);
}

function drainAmmo(game, weapon) {
  const player = game.player;
  const ammo = player.ammo[player.weapon];
  ammo.clip = Math.max(0, ammo.clip - 1);
  if (ammo.clip === 0 && ammo.reserve > 0) startReload(game);
}

export function startReload(game) {
  const player = game.player;
  const ammo = player.ammo[player.weapon];
  if (player.reload > 0 || ammo.clip >= WEAPONS[player.weapon].clip || ammo.reserve <= 0) return;
  player.reload = player.weapon === 'shotgun' ? 1.6 : 1.15;
  game.audio.reload();
  // finishReload runs when the timer reaches zero in updatePlayer.
  player.pendingReload = true;
}

export function finishReload(game) {
  const player = game.player;
  if (!player.pendingReload) return;
  const weapon = WEAPONS[player.weapon];
  const ammo = player.ammo[player.weapon];
  const need = weapon.clip - ammo.clip;
  const take = Math.min(need, ammo.reserve);
  ammo.clip += take;
  ammo.reserve -= take;
  player.pendingReload = false;
}

export function selectWeapon(game, id) {
  const player = game.player;
  if (!player.unlocked.includes(id)) {
    game.hud?.toast(`${WEAPONS[id].name} — not yours yet`);
    return;
  }
  if (player.weapon === id) return;
  player.weapon = id;
  player.reload = 0;
  player.pendingReload = false;
  player.cooldown = 0.2;
  game.audio.click();
}

export function giveWeapon(game, id) {
  const player = game.player;
  if (!player.unlocked.includes(id)) {
    player.unlocked.push(id);
    player.weapon = id;
    game.hud?.toast(`PICKED UP ${WEAPONS[id].name}`);
    game.audio.pickup();
  }
  const ammo = player.ammo[id];
  ammo.reserve = Math.min(ammo.reserve + WEAPONS[id].clip * 3, WEAPONS[id].reserve * 2);
}

export function hurtPlayer(game, amount, source) {
  const player = game.player;
  if (player.dead || player.invulnerable > 0 || amount <= 0) return;
  player.lastDamage = 0;
  player.hitFlash = 0.8;
  let left = amount;
  if (player.armour > 0) {
    const absorbed = Math.min(player.armour, left);
    player.armour -= absorbed;
    left -= absorbed;
  }
  player.health = Math.max(0, player.health - left);
  game.shake(6 + amount * 0.35);
  game.effects.spawnPuff(player.x, player.y, '#c23a4a');
  if (player.health <= 0) game.onPlayerWasted?.();
  else if (source === 'bullet') game.audio.hurt();
}

export function addMoney(game, amount, label = null) {
  const player = game.player;
  player.money = Math.max(0, player.money + amount);
  game.effects.spawnFloatingText(player.x, player.y - 34, `${amount > 0 ? '+' : ''}$${Math.abs(amount).toLocaleString('en-US')}`, amount > 0 ? '#8bf0b5' : '#ff6a7a');
  if (label) game.hud?.toast(label);
}

// --- Controls: keyboard and mouse for one canvas. Held keys answer "is it down now", and a small
// queue of edges (pressed this frame) answers the one-shot actions such as entering a car or
// firing once. Mouse coordinates are kept in canvas pixels, so the HUD's logical scale is applied
// where it is drawn, not here.

const BLOCKING = new Set([
  'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'KeyE', 'KeyR', 'KeyM',
]);

export function createInput(canvas) {
  const held = new Set();
  const edges = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false };
  let wheel = 0;

  function toCanvas(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * canvas.width;
    mouse.y = ((event.clientY - rect.top) / Math.max(1, rect.height)) * canvas.height;
  }

  window.addEventListener('keydown', (event) => {
    if (BLOCKING.has(event.code)) event.preventDefault();
    if (event.repeat) return;
    held.add(event.code);
    edges.add(event.code);
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  window.addEventListener('blur', () => {
    held.clear();
    mouse.down = false;
  });
  canvas.addEventListener('mousemove', toCanvas);
  canvas.addEventListener('mousedown', (event) => {
    toCanvas(event);
    if (event.button === 0) {
      mouse.down = true;
      mouse.clicked = true;
    }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  canvas.addEventListener('wheel', (event) => {
    wheel += Math.sign(event.deltaY);
    event.preventDefault();
  }, { passive: false });

  return {
    mouse,
    /** Is the key held this frame? */
    down(code) {
      return held.has(code);
    },
    /** Was it pressed since the last consume? */
    pressed(code) {
      return edges.has(code);
    },
    /** Read and clear one edge. */
    take(code) {
      const had = edges.has(code);
      edges.delete(code);
      return had;
    },
    /** Mouse button edge, cleared when read. */
    takeClick() {
      const had = mouse.clicked;
      mouse.clicked = false;
      return had;
    },
    takeWheel() {
      const value = wheel;
      wheel = 0;
      return value;
    },
    /** -1..1 on each axis, in screen space (screen-up is negative). */
    axes() {
      const x = (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0);
      const y = (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0) - (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0);
      return { x, y };
    },
    /** Clear edges at the end of a frame: pressed() then reports only this frame. */
    endFrame() {
      edges.clear();
      mouse.clicked = false;
    },
  };
}
