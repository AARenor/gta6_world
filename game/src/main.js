// Vesper City: boot, the fixed-step loop, the game object every system reads, the title and the
// two ways out of a night (busted, wasted). ?scene=cover|chase|mission|onfoot stages one of the
// screenshot tableaux and paints it twice, then raises window.__shotReady for the capture.

import { createCity } from './city.js';
import { createTraffic, createVehicle, collideVehicles, explodeVehicle, createPeds } from './traffic.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createHud, drawBusted, drawPause, drawTitle, drawWasted } from './hud.js';
import { createRenderer } from './render.js';
import { createPlayer, createInput, updatePlayer, hurtPlayer } from './player.js';
import { stageScene } from './scenes.js';
import { createEffects } from './effects.js';
import { createAudio } from './audio.js';
import { CITY, SAVE_KEY, STEP, WEAPONS } from './config.js';
import { createRandom } from './random.js';

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const params = new URLSearchParams(window.location.search);
const sceneName = params.get('scene');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : CITY.seed;

const input = createInput(canvas);
const renderer = createRenderer(canvas);
renderer.resize();

const rng = createRandom(seed);
const city = createCity(seed);
const traffic = createTraffic(city, rng);
const peds = createPeds(city, rng);
const police = createPolice(city, rng);
const missions = createMissions(city, rng);
const effects = createEffects(rng);
const audio = createAudio();
const hud = createHud();

const start = city.points.safehouse;
const player = createPlayer(start.x, start.y);
const vehicles = [];

const game = {
  city, traffic, peds, police, missions, effects, audio, hud, input, renderer, player, vehicles, rng,
  clock: 0,
  hour: 18.55,
  district: 'VELVET SQUARE',
  radioIndex: 0,
  mode: 'title',
  staged: false,
  menuIndex: 0,
  showControls: false,
  pointer: { x: start.x + 100, y: start.y },
  sceneAim: null,
  storyComplete: false,
  saveData: null,
  overlay: null,
  project: (x, y) => renderer.project(x, y),
  shake: (amount) => renderer.shake(amount),
  hurtPlayer: (amount, source) => hurtPlayer(game, amount, source),
  trafficSignal: (i, j, axis) => traffic.signalAt(i, j, game.clock, axis),
  save: () => saveGame(),
};

function announce(message) {
  if (statusEl) statusEl.textContent = message;
}

function saveGame() {
  try {
    const currentJob = missions.jobs.find((job) => job.state === 'active');
    const done = missions.jobs.filter((job) => job.state === 'done').length;
    game.saveData = {
      money: player.money,
      health: player.health,
      armour: player.armour,
      respect: player.respect,
      job: currentJob ? currentJob.num : Math.min(3, done + 1),
      x: player.x,
      y: player.y,
      weapon: player.weapon,
      unlocked: [...player.unlocked],
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(game.saveData));
  } catch {
    // Private windows: nothing is stored, the night lasts this visit.
  }
}

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

game.saveData = readSave();

function resetWorld() {
  vehicles.length = 0;
  traffic.cars.length = 0;
  peds.peds.length = 0;
  police.units.length = 0;
  police.blocks.length = 0;
  police.clearWanted();
  missions.setActive(null);
  for (const job of missions.jobs) {
    job.state = job.num === 1 ? 'available' : 'locked';
    job.stage = 0;
    job.timer = 0;
    job.marker = null;
    job.prompt = false;
  }
  for (const vehicle of traffic.parkedVehicles()) vehicles.push(vehicle);
  game.clock = 0;
  game.hour = 18.55;
}

function populate() {
  for (let k = 0; k < 60; k += 1) traffic.spawnAround(game, 260, 1700);
  peds.addCrowd(46, player.x, player.y, 1400);
}

function spawnStarterCar() {
  const spot = city.points.safehouse;
  const car = createVehicle('muscle', spot.x + 46, spot.y + 28, 0, '#ff6a3d', { parked: true });
  car.lightsOn = false;
  vehicles.push(car);
  return car;
}

function newGame(fromSave = false) {
  resetWorld();
  player.x = start.x;
  player.y = start.y;
  player.vx = 0;
  player.vy = 0;
  player.inCar = null;
  player.dead = false;
  player.weapon = 'pistol';
  player.unlocked = ['pistol'];
  player.ammo = {
    pistol: { clip: WEAPONS.pistol.clip, reserve: WEAPONS.pistol.reserve },
    smg: { clip: 0, reserve: 0 },
    shotgun: { clip: 0, reserve: 0 },
  };
  player.money = 500;
  player.health = 100;
  player.armour = 0;
  player.respect = 0;
  player.cooldown = 0;
  player.reload = 0;
  player.pendingReload = false;
  if (fromSave && game.saveData) {
    player.money = Math.max(0, game.saveData.money ?? 500);
    player.health = Math.max(25, game.saveData.health ?? 100);
    player.armour = game.saveData.armour ?? 0;
    player.respect = game.saveData.respect ?? 0;
    player.unlocked = Array.isArray(game.saveData.unlocked) ? game.saveData.unlocked : ['pistol'];
    if (player.unlocked.includes('smg')) player.ammo.smg = { clip: WEAPONS.smg.clip, reserve: WEAPONS.smg.reserve };
    if (player.unlocked.includes('shotgun')) player.ammo.shotgun = { clip: WEAPONS.shotgun.clip, reserve: WEAPONS.shotgun.reserve };
    if (game.saveData.job >= 2) {
      const first = missions.jobs[0];
      first.state = 'done';
      const second = missions.jobs[1];
      second.state = 'available';
      if (game.saveData.job >= 3) {
        second.state = 'done';
        missions.jobs[2].state = 'available';
      }
    }
  }
  spawnStarterCar();
  populate();
  game.mode = 'play';
  game.staged = false;
  game.district = city.districtAt(player.x, player.y);
  announce('Vesper City. Walk with WASD, aim with the mouse, press E to steal a car. Find Mara Quill at the gold ring.');
  hud.banner('VESPER CITY', 'SUNSET SYNDICATE', 'Find Mara Quill — Velvet Square');
}

function beginTitle() {
  game.mode = 'title';
  game.menuIndex = 0;
  player.x = city.points.safehouse.x;
  player.y = city.points.safehouse.y;
  renderer.camera.x = 4.5 * CITY.pitch;
  renderer.camera.y = 5.2 * CITY.pitch;
  renderer.camera.zoom = 1.02;
}

game.onPlayerWasted = () => {
  if (game.mode !== 'play') return;
  game.mode = 'wasted';
  const fee = Math.min(500, Math.round(player.money * 0.1));
  player.money = Math.max(0, player.money - fee);
  game.overlay = { fee, reason: 'BAY GENERAL PATCHED YOU UP', line: 'The city bills you either way.' };
  player.inCar = null;
  player.dead = true;
  announce('Wasted. Press Enter to get back out there.');
  audio.sirenSting();
};

game.onPlayerBusted = () => {
  if (game.mode !== 'play') return;
  game.mode = 'busted';
  const fee = Math.min(400, Math.round(player.money * 0.08));
  player.money = Math.max(0, player.money - fee);
  game.overlay = { fee, reason: 'VCPD HOLDS YOU FOR QUESTIONING', line: 'No record, no lawyer, no night.' };
  police.clearWanted();
  player.inCar = null;
  player.dead = true;
  announce('Busted. Press Enter to walk out.');
  audio.sirenSting();
};

game.onVehicleWrecked = (vehicle) => {
  if (vehicle.police) vehicle.police.state = 'wreck';
  if (vehicle.driver === 'player') hud.toast('CAR WRECKED — GET OUT');
};

function respawn() {
  const hospital = city.points.hospital;
  const precinct = city.points.police;
  const target = game.mode === 'busted' ? precinct : hospital;
  player.x = target.x;
  player.y = target.y;
  player.vx = 0;
  player.vy = 0;
  player.dead = false;
  player.inCar = null;
  player.health = Math.max(60, player.health);
  if (game.mode === 'wasted') player.health = 85;
  player.armour = 0;
  player.invulnerable = 2.5;
  game.mode = 'play';
  game.overlay = null;
  police.clearWanted();
  player.bustTimer = 0;
  player.boxedTimer = 0;
  announce('Back on the street.');
}

function resolveVehicleContacts(dt) {
  for (let a = 0; a < vehicles.length; a += 1) {
    const first = vehicles[a];
    for (let b = a + 1; b < vehicles.length; b += 1) {
      const second = vehicles[b];
      const dx = first.x - second.x;
      const dy = first.y - second.y;
      if (dx * dx + dy * dy > 150 * 150) continue;
      const hit = collide(first, second);
      if (!hit) continue;
      if (first.lastImpact > 0 && first.ai) convertToFree(first);
      if (second.lastImpact > 0 && second.ai) convertToFree(second);
    }
  }
  const car = player.inCar;
  if (car) {
    for (const ped of peds.peds) {
      if (ped.state === 'down') continue;
      if (Math.hypot(ped.x - car.x, ped.y - car.y) < 26 && Math.abs(car.speed) > 90) {
        peds.startle(ped, car.x, car.y, 2.2);
        effects.spawnPuff(ped.x, ped.y, '#d8c3b0', 2);
        renderer.shake(3);
      }
    }
  }
  void dt;
}

function collide(first, second) {
  return collideVehicles(game, first, second);
}

function convertToFree(vehicle) {
  traffic.remove(vehicle);
  vehicle.driver = null;
  vehicle.free = true;
  const angle = Math.atan2(vehicle.vy, vehicle.vx) + Math.PI / 2;
  const ped = peds.makePed(
    Math.max(0, Math.min(CITY.blocks - 1, Math.floor(vehicle.x / CITY.pitch))),
    Math.max(0, Math.min(CITY.blocks - 1, Math.floor(vehicle.y / CITY.pitch))),
    0,
  );
  ped.x = vehicle.x - Math.cos(angle) * 22;
  ped.y = vehicle.y - Math.sin(angle) * 22;
  peds.startle(ped, vehicle.x, vehicle.y, 1.4);
}

function updateFreeVehicles(dt) {
  for (const vehicle of vehicles) {
    if (!vehicle.free || vehicle.driver || vehicle.wrecked) continue;
    vehicle.x += vehicle.vx * dt;
    vehicle.y += vehicle.vy * dt;
    vehicle.vx *= Math.exp(-2.6 * dt);
    vehicle.vy *= Math.exp(-2.6 * dt);
    if (Math.hypot(vehicle.vx, vehicle.vy) < 6) vehicle.free = false;
    if (vehicle.x < 60 || vehicle.x > CITY.size - 60) vehicle.vx *= -0.2;
    if (vehicle.y < 60 || vehicle.y > CITY.size - 60) vehicle.vy *= -0.2;
  }
}

function updateBurning(dt) {
  for (const vehicle of vehicles) {
    if (vehicle.wrecked && !vehicle.exploded) {
      vehicle.burning -= dt;
      if (vehicle.burning <= 0) explodeVehicle(game, vehicle);
    } else if (!vehicle.wrecked) {
      if (vehicle.health < 40 && rng() < dt * 7) {
        effects.spawnPuff(vehicle.x, vehicle.y - 4, 'rgba(70, 60, 72, 0.7)', 1);
      }
      if (vehicle.health < 18 && rng() < dt * 9) {
        effects.spawnPuff(vehicle.x, vehicle.y - 6, 'rgba(255, 130, 60, 0.7)', 1);
      }
    }
  }
}

function updatePickups(dt) {
  for (const pickup of city.pickups) {
    if (pickup.taken > 0) {
      pickup.taken -= dt;
      continue;
    }
    if (Math.hypot(player.x - pickup.x, player.y - pickup.y) > 34) continue;
    if (pickup.kind === 'health') {
      player.health = Math.min(100, player.health + 50);
      hud.toast('HEALTH KIT  +50');
    } else if (pickup.kind === 'armour') {
      player.armour = Math.min(100, player.armour + 50);
      hud.toast('BODY ARMOUR  +50');
    } else {
      const weapon = WEAPONS[player.weapon];
      player.ammo[player.weapon].reserve = Math.min(weapon.reserve * 2, player.ammo[player.weapon].reserve + weapon.clip * 3);
      hud.toast('AMMO FOUND');
    }
    pickup.taken = 42;
    audio.pickup();
  }
}

function handleInput() {
  if (input.take('Escape')) {
    if (game.mode === 'play') {
      game.mode = 'paused';
      announce('Paused.');
    } else if (game.mode === 'paused') {
      game.mode = 'play';
      announce('Back in the city.');
    }
  }
  if (game.mode === 'paused' && (input.take('Enter') || input.take('Space'))) {
    game.mode = 'play';
  }
  const briefing = hud.state.briefing;
  if (briefing) {
    if (input.take('KeyE') || input.take('Enter')) {
      hud.hideBriefing();
      missions.start(game, briefing.job);
      saveGame();
    } else if (input.take('Escape')) {
      hud.hideBriefing();
    }
    return true;
  }
  if (game.mode === 'busted' || game.mode === 'wasted') {
    if (input.take('Enter') || input.take('KeyE')) respawn();
    return true;
  }
  if (game.mode === 'title') {
    const items = game.saveData ? 3 : 2;
    if (input.take('KeyS') || input.take('ArrowDown')) game.menuIndex = (game.menuIndex + 1) % items;
    if (input.take('KeyW') || input.take('ArrowUp')) game.menuIndex = (game.menuIndex + items - 1) % items;
    if (input.take('Enter') || input.take('Space') || input.take('KeyE')) {
      if (game.menuIndex === 0) {
        audio.ensure();
        newGame(Boolean(game.saveData));
      } else if (game.saveData && game.menuIndex === 1) {
        newGame(false);
      } else {
        game.showControls = !game.showControls;
      }
    }
    return true;
  }
  return false;
}

function update(dt) {
  game.clock += dt;
  game.pointer = renderer.screenToWorld(input.mouse.x, input.mouse.y);
  if (game.mode === 'title') {
    renderer.camera.x += Math.sin(game.clock * 0.16) * 6 * dt;
    renderer.camera.y += Math.cos(game.clock * 0.13) * 4 * dt;
    hud.update(game, dt);
    return;
  }
  if (game.mode !== 'play') {
    hud.update(game, dt);
    return;
  }
  if (hud.state.briefing) {
    hud.update(game, dt);
    return;
  }
  game.hour = (game.hour + dt * 0.004) % 24;
  updatePlayer(game, dt);
  traffic.update(dt, game);
  peds.update(dt, game);
  police.update(game, dt);
  missions.update(game, dt);
  resolveVehicleContacts(dt);
  updateFreeVehicles(dt);
  updateBurning(dt);
  updatePickups(dt);
  effects.update(dt);
  hud.update(game, dt);
  renderer.follow(game, dt);
  game.district = city.districtAt(player.x, player.y);
  game.radioIndex = Math.abs(Math.floor((player.x + player.y) / 720)) % 4;
  for (const vehicle of vehicles) {
    if (vehicle.wrecked && vehicle.ai) convertToFree(vehicle);
  }
  audio.setSiren(police.stars > 0 ? police.stars : 0);
  audio.setEngine(Boolean(player.inCar), player.inCar?.speed ?? 0);
  if (Math.floor(game.clock * 2) % 120 === 0) saveGame();
}

function draw() {
  renderer.draw(game);
  const ctx = canvas.getContext('2d');
  if (game.mode === 'title') {
    drawTitle(ctx, game);
    return;
  }
  hud.draw(ctx, game);
  if (game.mode === 'paused') drawPause(ctx, game);
  if (game.mode === 'busted') drawBusted(ctx, game, game.overlay);
  if (game.mode === 'wasted') drawWasted(ctx, game, game.overlay);
}

let last = performance.now();
let accumulator = 0;
let frames = 0;

function loop(now) {
  requestAnimationFrame(loop);
  if (game.staged) {
    draw();
    frames += 1;
    if (frames >= 3) window.__shotReady = true;
    return;
  }
  const delta = Math.min(0.25, (now - last) / 1000);
  last = now;
  handleInput();
  accumulator += delta;
  let steps = 0;
  while (accumulator >= STEP && steps < 4) {
    update(STEP);
    accumulator -= STEP;
    steps += 1;
    input.endFrame();
  }
  draw();
}

window.addEventListener('resize', () => {
  renderer.resize();
});
window.addEventListener('pointerdown', () => audio.ensure(), { once: true });
window.addEventListener('keydown', () => audio.ensure(), { once: true });
window.__vesper = game;

if (sceneName) {
  const mode = stageScene(sceneName, game);
  game.mode = mode;
  game.staged = true;
  input.mouse.clicked = false;
  if (game.sceneAim) {
    const p = renderer.project(game.sceneAim.x, game.sceneAim.y);
    input.mouse.x = p.x;
    input.mouse.y = p.y;
    game.pointer = { x: game.sceneAim.x, y: game.sceneAim.y };
  }
  draw();
  window.requestAnimationFrame(() => {
    draw();
    window.requestAnimationFrame(() => {
      draw();
      window.__shotReady = true;
    });
  });
} else {
  resetWorld();
  spawnStarterCar();
  populate();
  beginTitle();
  requestAnimationFrame((time) => {
    last = time;
    loop(time);
  });
}

