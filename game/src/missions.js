// The three story jobs, in order: FIRST LIGHT (steal a cab and deliver it), UNDERTOW (fold four
// runners on the boardwalk, then lose the heat) and LAST LIGHT AT THE TIDEPOOL (ram the courier,
// take the ledger to the airfield). Each has a giver on the map, a briefing, marked stages, a
// timer on the jobs that need one, and a cash payoff. Markers and dialogues are handed to the HUD.

import { CAST, CITY, LANES, STORY } from './config.js';
import { addMoney, giveWeapon } from './player.js';
import { createVehicle } from './vehicles.js';
import { clamp } from './random.js';

export function createMissions(city, rng) {
  const targets = [];
  let cab = null;
  let courier = null;
  let ledger = null;
  let active = null;
  let briefing = null;
  let lastStage = -1;

  function giverPos(id) {
    return id === 'mara' ? city.points.mara : city.points.kemp;
  }

  function makeJob(def) {
    return {
      ...def,
      state: def.num === 1 ? 'available' : 'locked',
      stage: 0,
      timer: 0,
      marker: null,
      prompt: false,
      progress: '',
    };
  }

  const BRIEFS = {
    'first-light': [
      'Motel 9 has a Lantern cab idling in its lot with the keys still in it. The buyer at the Tidepool pays by the scratch, so do not add any.',
      'Get it there in one piece. The VCPD reads this street like a menu, and a yellow cab is the loudest car on it.',
    ],
    undertow: [
      'Four of Corvo\u2019s runners are working the boardwalk stalls, and every one of them is carrying. Fold them up and the whole strip is ours by morning.',
      'Then vanish. The blue will come heavy, and a gunfight is not a résumé.',
    ],
    'tidepool-ledger': [
      'Vega\u2019s courier left the Tidepool with the ledger in a pearl coupe. That book has every name that matters in this city, mine included.',
      'Put him in a wall, take the case to Salt Airfield, and we are done with all of it.',
    ],
  };

  const jobs = STORY.map((def) => makeJob({ ...def, brief: BRIEFS[def.id] ?? [] }));
  for (const job of jobs) job.total = jobs.length;

  function markerAt(x, y, radius, kind, label = '') {
    return { x, y, radius, kind, label };
  }

  function spawnRunners(game) {
    const spots = [
      { i: 1, j: 8, u: 40 }, { i: 1, j: 8, u: 150 },
      { i: 2, j: 8, u: 260 }, { i: 1, j: 9, u: 96 },
    ];
    for (const spot of spots) {
      const ped = game.peds.makePed(spot.i, spot.j, spot.u, { armed: true, target: 'player', shirt: '#3a2b45' });
      ped.x = clamp(ped.x, 20, CITY.size - 20);
      ped.armed = true;
      ped.shootTimer = 0.8 + rng() * 1.4;
      ped.runner = true;
      targets.push(ped);
    }
    game.hud?.toast('FOUR RUNNERS MARKED');
  }

  function spawnCourier(game) {
    const point = city.points.tidepool;
    const i = Math.max(1, Math.min(CITY.blocks - 1, Math.round(point.x / CITY.pitch)));
    const j = Math.max(1, Math.min(CITY.blocks - 1, Math.round(point.y / CITY.pitch)));
    const startX = i * CITY.pitch + 150;
    const startY = j * CITY.pitch + LANES.outer;
    courier = createVehicle('courier', startX, startY, 0, '#3b2b45');
    courier.name = 'VEGA COURIER';
    courier.health = 130;
    courier.maxHealth = 130;
    courier.driver = 'courier';
    courier.courier = true;
    courier.ai = {
      i, j, dirKey: 'E', dir: { x: 1, y: 0, angle: 0, axis: 'ew' },
      laneIndex: 1, offset: LANES.outer, s: 150, cruise: 500, nextKey: null, turn: null,
      stunned: 0, indicator: 0, patience: 0, flashed: 0,
    };
    game.vehicles.push(courier);
    game.traffic.cars.push(courier);
    courier.indicator = 0;
    game.hud?.say('mara', 'He is in the pearl coupe. Do not lose him.');
  }

  function spawnLedger(game) {
    if (courier) {
      ledger = { x: courier.x + 26, y: courier.y + 10, taken: false };
      game.effects.spawnFloatingText(courier.x, courier.y - 20, 'THE LEDGER', '#ffd34d');
    }
  }

  function checkStage(game, job) {
    const player = game.player;
    switch (job.id) {
      case 'first-light':
        if (job.stage === 0) {
          if (cab && player.inCar === cab) {
            job.stage = 1;
            job.timer = 105;
            game.hud?.toast('CAB TAKEN — GET TO THE TIDEPOOL');
            game.hud?.say('mara', 'That is the one. The pier, before the tide turns.');
            return true;
          }
        } else if (job.stage === 1) {
          const p = city.points.tidepool;
          if (player.inCar && Math.hypot(player.x - p.x, player.y - p.y) < 58) {
            complete(game, job);
            return true;
          }
        }
        break;
      case 'undertow':
        if (job.stage === 0) {
          const p = city.points.boardwalk;
          if (Math.hypot(player.x - p.x, player.y - p.y) < 64) {
            job.stage = 1;
            job.timer = 0;
            spawnRunners(game);
            game.hud?.say('kemp', 'Four of them, all along the boards. Make it loud.');
            return true;
          }
        } else if (job.stage === 1) {
          const alive = targets.filter((ped) => ped.state !== 'down' && !ped.remove).length;
          job.progress = `${4 - alive}/4`;
          if (alive === 0) {
            job.stage = 2;
            job.progress = '';
            game.police?.setStars(game, 3);
            game.hud?.toast('LOSE THE HEAT');
            game.hud?.say('kemp', 'Good. Now vanish before the blue rolls in.');
            return true;
          }
        } else if (job.stage === 2) {
          if ((game.police?.stars ?? 0) === 0) {
            complete(game, job);
            return true;
          }
        }
        break;
      case 'tidepool-ledger':
        if (job.stage === 0) {
          const p = city.points.tidepool;
          if (Math.hypot(player.x - p.x, player.y - p.y) < 70) {
            job.stage = 1;
            job.timer = 0;
            spawnCourier(game);
            game.hud?.toast('RAM THE COURIER OFF THE ROAD');
            return true;
          }
        } else if (job.stage === 1) {
          if (courier && (courier.health < 52 || courier.wrecked)) {
            job.stage = 2;
            if (courier.ai) courier.ai.cruise = 0;
            courier.driver = null;
            spawnLedger(game);
            game.hud?.toast('TAKE THE LEDGER');
            game.hud?.say('mara', 'There. Case on the asphalt. Bring it home.');
            return true;
          }
        } else if (job.stage === 2) {
          if (ledger && Math.hypot(player.x - ledger.x, player.y - ledger.y) < 48) {
            ledger.taken = true;
            ledger = null;
            job.stage = 3;
            job.timer = 0;
            game.hud?.toast('LEDGER TAKEN — SALT AIRFIELD');
            return true;
          }
        } else if (job.stage === 3) {
          const p = city.points.airfield;
          if (Math.hypot(player.x - p.x, player.y - p.y) < 66) {
            complete(game, job);
            return true;
          }
        }
        break;
      default:
        break;
    }
    return false;
  }

  function stageMarker(game, job) {
    const player = game.player;
    switch (job.id) {
      case 'first-light':
        if (job.stage === 0 && cab) return markerAt(cab.x, cab.y, 40, 'target', 'THE CAB');
        if (job.stage === 1) return markerAt(city.points.tidepool.x, city.points.tidepool.y, 54, 'deliver', 'THE TIDEPOOL');
        break;
      case 'undertow':
        if (job.stage === 0) return markerAt(city.points.boardwalk.x, city.points.boardwalk.y, 54, 'job', 'BOARDWALK');
        if (job.stage === 1) {
          const alive = targets.filter((ped) => ped.state !== 'down' && !ped.remove);
          if (alive.length > 0) {
            let near = alive[0];
            for (const ped of alive) if (Math.hypot(ped.x - player.x, ped.y - player.y) < Math.hypot(near.x - player.x, near.y - player.y)) near = ped;
            return markerAt(near.x, near.y, 26, 'target', 'RUNNER');
          }
        }
        break;
      case 'tidepool-ledger':
        if (job.stage === 0) return markerAt(city.points.tidepool.x, city.points.tidepool.y, 54, 'job', 'THE TIDEPOOL');
        if (job.stage === 1 && courier) return markerAt(courier.x, courier.y, 34, 'target', 'COURIER');
        if (job.stage === 2 && ledger) return markerAt(ledger.x, ledger.y, 30, 'take', 'LEDGER');
        if (job.stage === 3) return markerAt(city.points.airfield.x, city.points.airfield.y, 54, 'deliver', 'AIRFIELD');
        break;
      default:
        break;
    }
    return null;
  }

  function stageText(job) {
    switch (job.id) {
      case 'first-light':
        return job.stage === 0
          ? { objective: 'Take the Lantern cab from the Motel 9 lot', next: 'Deliver it to the Tidepool' }
          : { objective: 'Drive the cab to the Tidepool pier', next: 'Do not scratch the paint' };
      case 'undertow':
        if (job.stage === 0) return { objective: 'Meet Doc Kemp on the Halcyon boardwalk', next: 'Four runners are working the stalls' };
        if (job.stage === 1) return { objective: 'Fold the four runners on the boardwalk', next: 'Then lose the heat' };
        return { objective: 'Break line of sight and lose the heat', next: 'Stars cool when they cannot see you' };
      case 'tidepool-ledger':
        if (job.stage === 0) return { objective: 'Get to the Tidepool before the courier leaves', next: 'He is carrying Vega\u2019s ledger' };
        if (job.stage === 1) return { objective: 'Run the courier off the road', next: 'Ram him until the coupe folds' };
        if (job.stage === 2) return { objective: 'Take the ledger from the wreck', next: 'Walk to the case' };
        return { objective: 'Deliver the ledger to Salt Airfield', next: 'Mara is waiting at the hangar' };
      default:
        return { objective: '', next: '' };
    }
  }

  function complete(game, job) {
    job.state = 'done';
    job.marker = null;
    job.prompt = false;
    active = null;
    addMoney(game, job.reward, `${job.title} — $${job.reward.toLocaleString('en-US')}`);
    game.player.respect += 1;
    game.hud?.banner('JOB COMPLETE', job.title, `$${job.reward.toLocaleString('en-US')}`);
    game.audio.payoff();
    if (job.num === 1) {
      giveWeapon(game, 'smg');
      game.hud?.say('mara', 'Clean. There is a Gutter SMG in the safehouse. You earned the noise.');
      const next = jobs.find((item) => item.num === 2);
      if (next) next.state = 'available';
    } else if (job.num === 2) {
      giveWeapon(game, 'shotgun');
      game.hud?.say('kemp', 'Corvo is going to miss those four. Take the pier gun; it suits you.');
      const next = jobs.find((item) => item.num === 3);
      if (next) next.state = 'available';
    } else {
      game.hud?.say('mara', 'The ledger, the tide and the money. Vesper is ours, Ray. For tonight.');
      game.storyComplete = true;
      game.hud?.banner('STORY COMPLETE', 'SUNSET SYNDICATE', 'The city is yours');
    }
    if (game.player.money < 0) game.player.money = 0;
    game.save?.();
  }

  function start(game, job) {
    job.state = 'active';
    job.stage = 0;
    job.timer = 0;
    job.marker = null;
    active = job;
    lastStage = -1;
    targets.length = 0;
    if (job.id === 'first-light' && !cab) {
      const spot = city.points.motel;
      const roadY = Math.round(spot.y / CITY.pitch) * CITY.pitch;
      cab = createVehicle('taxi', spot.x, roadY + 40, 0, '#f6c33d', { parked: true });
      cab.lightsOn = false;
      cab.missionCab = true;
      game.vehicles.push(cab);
    }
    if (job.id === 'tidepool-ledger') {
      courier = null;
      ledger = null;
    }
    const cast = CAST[job.giver];
    game.hud?.say(job.giver, job.brief[0], 6);
    game.hud?.banner(`JOB ${job.num} STARTED`, job.title, cast ? `Fixer: ${cast.name}` : '');
    game.audio.jobStart();
    game.save?.();
  }

  function stageReady(game) {
    const job = active;
    if (!job) return;
    const text = stageText(job);
    job.objective = text.objective;
    job.next = text.next;
    job.marker = stageMarker(game, job);
    if (job.stage !== lastStage) {
      lastStage = job.stage;
      game.hud?.toast(text.objective.toUpperCase());
    }
  }

  function update(game, dt) {
    const player = game.player;
    if (briefing) return;
    if (active) {
      if (active.timer > 0) {
        active.timer -= dt;
        if (active.timer <= 0) {
          active.state = 'available';
          active.stage = 0;
          active.timer = 0;
          active.objective = '';
          active.marker = null;
          game.hud?.banner('JOB FAILED', active.title, 'The window closed');
          active = null;
          return;
        }
      }
      const job = active;
      if (checkStage(game, job) && active === job) stageReady(game);
      if (active === job) stageReady(game);
      return;
    }
    // Givers: the next job waits with a ring on the pavement.
    for (const job of jobs) {
      if (job.state !== 'available') {
        job.prompt = false;
        if (job.state !== 'active') job.marker = null;
        continue;
      }
      const cast = CAST[job.giver];
      const spot = giverPos(job.giver);
      job.marker = markerAt(spot.x, spot.y, 44, 'job', cast.name);
      const near = Math.hypot(player.x - spot.x, player.y - spot.y) < 62;
      job.prompt = near;
      if (near && game.input?.take('KeyE')) {
        game.hud?.showBriefing(job, cast);
        game.audio.click();
      }
    }
    // The courier's ledger can also be picked up after the chase has ended.
    if (ledger && Math.hypot(player.x - ledger.x, player.y - ledger.y) < 48) {
      ledger.taken = true;
      ledger = null;
    }
  }

  /** The HUD's mission strip: what is active, or the next job waiting. */
  function hudState() {
    if (active) {
      return {
        num: active.num, total: jobs.length, title: active.title,
        stage: active.stage + 1, stages: active.stages ?? (active.id === 'undertow' ? 3 : active.id === 'first-light' ? 2 : 4),
        objective: active.objective ?? '', next: active.next ?? '', timer: active.timer,
        progress: active.progress, reward: active.reward, giver: active.giver,
      };
    }
    const ready = jobs.find((job) => job.state === 'available');
    if (ready) {
      const cast = CAST[ready.giver];
      return { num: ready.num, total: jobs.length, title: ready.title, stage: 0, stages: 1, objective: `Meet ${cast.name} — ${cast.role}`, next: 'Walk into the gold ring and press E', timer: 0, progress: '', reward: ready.reward, giver: ready.giver, waiting: true };
    }
    return null;
  }

  function markerList() {
    const list = [];
    if (active?.marker) list.push(active.marker);
    for (const job of jobs) {
      if (job.state === 'available' && job.marker) list.push(job.marker);
    }
    if (active?.id === 'undertow' && active.stage === 1) {
      for (const ped of targets) if (ped.state !== 'down' && !ped.remove) list.push(markerAt(ped.x, ped.y, 18, 'target', 'RUNNER'));
    }
    return list;
  }

  function nearGiver(player) {
    for (const job of jobs) {
      if (job.state !== 'available') continue;
      const spot = giverPos(job.giver);
      if (Math.hypot(player.x - spot.x, player.y - spot.y) < 62) return true;
    }
    return false;
  }

  return {
    jobs,
    get active() { return active; },
    get briefing() { return briefing; },
    get ledger() { return ledger; },
    get courier() { return courier; },
    get targets() { return targets; },
    update,
    start,
    hudState,
    markerList,
    giverPos,
    nearGiver,
    setActive(job) { active = job; },
    setStagedLedger(value) { ledger = value; },
    setBriefing(value) { briefing = value; },
    setCab(value) { cab = value; },
    get cab() { return cab; },
  };
}
