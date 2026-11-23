// The HUD, laid out on a 1920x1080 grid and scaled to the canvas. Drawing order is corner panels
// first (job, dispatch, money and stars, minimap and vitals, speed or weapon), then the dialogue
// box, prompts, toasts and banners, and last the crosshair and edge pointers. Every word here is
// a label the player reads at a glance: job number, objective, next step, named police units with
// range and state, wanted stars, cash, condition.

import { CAST, CITY, CITY_NAME, FONT, LOGICAL, PALETTE, RADIO, TAGLINE, WEAPONS } from './config.js';

const STAR_ANGLES = [];
for (let k = 0; k < 10; k += 1) {
  const r = k % 2 === 0 ? 1 : 0.44;
  const a = -Math.PI / 2 + (k * Math.PI) / 5;
  STAR_ANGLES.push([Math.cos(a) * r, Math.sin(a) * r]);
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function starPath(ctx, x, y, r) {
  ctx.beginPath();
  for (let k = 0; k < STAR_ANGLES.length; k += 1) {
    const [sx, sy] = STAR_ANGLES[k];
    ctx.lineTo(x + sx * r, y + sy * r);
  }
  ctx.closePath();
}

function panel(ctx, x, y, w, h, accent = null) {
  roundRect(ctx, x, y, w, h, 10);
  ctx.fillStyle = 'rgba(13, 8, 20, 0.86)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 196, 120, 0.22)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (accent) {
    ctx.fillStyle = accent;
    roundRect(ctx, x, y, 6, h, 3);
    ctx.fill();
  }
}

function label(ctx, text, x, y, size, color, align = 'left', weight = 700, family = FONT.head) {
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

function moneyText(value) {
  return `$${Math.max(0, Math.round(value)).toLocaleString('en-US')}`;
}

function clockText(hours) {
  const h = Math.floor(hours) % 24;
  const m = Math.floor((hours - Math.floor(hours)) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function distanceText(px) {
  return `${Math.max(1, Math.round(px / 8))} m`;
}

export function createHud() {
  const state = {
    dialogue: null,
    dialogueTimer: 0,
    toast: null,
    toastTimer: 0,
    banner: null,
    bannerTimer: 0,
    briefing: null,
    card: null,
    cardTimer: 0,
    moneyFlash: 0,
    lastMoney: null,
    hintTimer: 0,
    hitFlash: 0,
    objectivePulse: 0,
    savedAt: 0,
  };

  function say(speaker, text, seconds = 5.5) {
    state.dialogue = { speaker, text, seconds };
    state.dialogueTimer = seconds;
  }

  function toast(text, seconds = 2.6) {
    state.toast = text;
    state.toastTimer = seconds;
  }

  function banner(title, subtitle = '', footer = '', seconds = 3.4) {
    state.banner = { title, subtitle, footer };
    state.bannerTimer = seconds;
  }

  function showBriefing(job, cast) {
    state.briefing = { job, cast };
  }

  function hideBriefing() {
    state.briefing = null;
  }

  function update(game, dt) {
    state.objectivePulse += dt;
    state.moneyFlash = Math.max(0, state.moneyFlash - dt * 1.5);
    state.hitFlash = Math.max(0, state.hitFlash - dt * 2);
    if (state.lastMoney === null) state.lastMoney = game.player.money;
    if (state.lastMoney !== game.player.money) {
      state.moneyFlash = 1;
      state.lastMoney = game.player.money;
    }
    if (state.dialogueTimer > 0) {
      state.dialogueTimer -= dt;
      if (state.dialogueTimer <= 0) state.dialogue = null;
    }
    if (state.toastTimer > 0) state.toastTimer -= dt;
    if (state.bannerTimer > 0) state.bannerTimer -= dt;
    if (state.cardTimer > 0) state.cardTimer -= dt;
    state.hintTimer += dt;
  }

  function draw(ctx, game) {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    const s = w / LOGICAL.width;
    const H = h / s;
    const travel = CONFIG_TRAVEL;
    ctx.save();
    ctx.scale(s, s);

    drawWorldLabels(ctx, game);
    drawJobPanel(ctx, game);
    drawCrewRace(ctx, game);
    drawMoneyStars(ctx, game);
    drawDispatch(ctx, game);
    drawMinimap(ctx, game);
    drawVitals(ctx, game);
    drawVehiclePanel(ctx, game);
    drawRadio(ctx, game);
    drawCard(ctx, game);
    drawDialogue(ctx, game);
    drawPrompt(ctx, game);
    drawToast(ctx, game);
    drawBanner(ctx, game);
    drawEdgePointer(ctx, game);
    drawCrosshair(ctx, game);
    drawDamage(ctx, game);
    if (state.briefing) drawBriefing(ctx, game);
    ctx.restore();
  }

  function drawWorldLabels(ctx, game) {
    if (!game.project) return;
    const scale = ctx.canvas.width / LOGICAL.width;
    for (const marker of game.missions.markerList()) {
      const raw = game.project(marker.x, marker.y);
      const p = { x: raw.x / scale, y: raw.y / scale };
      if (p.x < 60 || p.x > 1860 || p.y < 120 || p.y > 980) continue;
      const text = marker.label || '';
      if (!text) continue;
      ctx.save();
      if (marker.kind === 'take') {
        ctx.strokeStyle = '#241a16';
        ctx.lineWidth = 4;
        ctx.strokeRect(p.x - 9, p.y - 20, 18, 11);
        ctx.fillStyle = '#a86832';
        roundRect(ctx, p.x - 23, p.y - 12, 46, 29, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ffd891';
        ctx.fillRect(p.x - 14, p.y - 1, 5, 5);
        ctx.fillRect(p.x + 9, p.y - 1, 5, 5);
      }
      ctx.font = `900 34px ${FONT.head}`;
      const width = ctx.measureText(text).width + 40;
      ctx.fillStyle = 'rgba(13, 8, 20, 0.8)';
      roundRect(ctx, p.x - width / 2, p.y - 150, width, 48, 6);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 205, 90, 0.85)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#ffd34d';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, p.x, p.y - 126);
      ctx.restore();
    }
  }

  /** A job card: the objective set in very large type when a job opens or its stage turns over. */
  function card(title, stage, objective, reward) {
    state.card = { title, stage, objective, reward };
    state.cardTimer = 3.4;
  }

  function drawCard(ctx, game) {
    if (!state.card || state.cardTimer <= 0) return;
    const c = state.card;
    const alpha = Math.min(1, state.cardTimer * 1.6);
    ctx.save();
    ctx.globalAlpha = alpha;
    const w = 1792;
    const h = 420;
    const x = 64;
    const y = 112;
    ctx.fillStyle = 'rgba(8, 5, 12, 0.55)';
    roundRect(ctx, x, y, w, h, 12);
    ctx.fill();
    panel(ctx, x, y, w, h, '#ff8a3d');
    ctx.fillStyle = '#ff8a3d';
    roundRect(ctx, x + 52, y + 34, 300, 58, 6);
    ctx.fill();
    label(ctx, c.stage, x + 202, y + 64, 36, '#1a0f18', 'center', 900);
    label(ctx, c.reward, x + w - 56, y + 64, 52, '#8bf0b5', 'right', 900, FONT.narrow);
    label(ctx, c.title, x + 54, y + 186, 116, '#fff2df', 'left', 900);
    label(ctx, c.objective, x + 56, y + 330, 96, '#ffd34d', 'left', 900);
    ctx.restore();
  }

  function drawJobPanel(ctx, game) {
    const mission = game.missions.hudState();
    const x = 34;
    const y = 26;
    const w = 1000;
    const height = mission ? 222 : 160;
    panel(ctx, x, y, w, height, mission ? '#ff8a3d' : '#6b6270');
    if (!mission) {
      label(ctx, 'NO JOB ACTIVE', x + 30, y + 48, 42, '#ffd34d');
      label(ctx, 'Roll the city and wait for a call', x + 30, y + 104, 30, PALETTE.muted, 'left', 500, FONT.body);
      return;
    }
    ctx.fillStyle = '#ff8a3d';
    roundRect(ctx, x + 24, y + 16, 168, 48, 6);
    ctx.fill();
    label(ctx, `JOB ${mission.num}/${mission.total}`, x + 108, y + 40, 28, '#1a0f18', 'center', 900);
    label(ctx, mission.title, x + 208, y + 40, 36, PALETTE.text, 'left', 900);
    if (mission.timer > 0) {
      ctx.fillStyle = 'rgba(255, 77, 94, 0.16)';
      roundRect(ctx, x + w - 168, y + 12, 144, 54, 6);
      ctx.fill();
      label(ctx, `${String(Math.floor(mission.timer / 60)).padStart(2, '0')}:${String(Math.floor(mission.timer % 60)).padStart(2, '0')}`, x + w - 96, y + 40, 38, '#ff6a7a', 'center', 800, FONT.mono);
    }
    // The current action is the strongest line, but long live objectives still fit the panel.
    const objective = mission.objective.toUpperCase();
    ctx.save();
    ctx.font = `900 64px ${FONT.head}`;
    const objectiveWidth = ctx.measureText(objective).width;
    const objectiveSize = objectiveWidth > w - 56 ? 64 * (w - 56) / objectiveWidth : 64;
    ctx.restore();
    label(ctx, objective, x + 28, y + 106, objectiveSize, '#fff6e6', 'left', 900);

    const stages = mission.stages ?? 3;
    const pipY = y + 151;
    for (let k = 0; k < stages; k += 1) {
      const px = x + 28 + k * 58;
      ctx.fillStyle = k < (mission.stage || 1) ? '#ff8a3d' : 'rgba(255, 255, 255, 0.16)';
      roundRect(ctx, px, pipY, 48, 10, 4);
      ctx.fill();
    }
    label(ctx, mission.stage > 0 ? `STAGE ${mission.stage}/${stages}` : 'READY', x + 28 + stages * 58, pipY + 5, 26, PALETTE.muted, 'left', 700, FONT.narrow);
    if (mission.progress) label(ctx, mission.progress, x + w - 28, pipY + 5, 30, '#ffd34d', 'right', 800, FONT.mono);
    else label(ctx, `REWARD ${moneyText(mission.reward)}`, x + w - 28, pipY + 5, 26, PALETTE.money, 'right', 800, FONT.narrow);
    label(ctx, `NEXT  ${mission.next}`, x + 28, y + 192, 26, PALETTE.muted, 'left', 600, FONT.body);
  }

  function drawCrewRace(ctx, game) {
    if (game.staged && !game.crew.enabled && !game.race.active) return;
    const race = game.race;
    const crew = game.crew;
    const x = 34;
    const y = game.missions.hudState() ? 260 : 196;
    const w = 626;
    panel(ctx, x, y, w, 228, '#26efd4');
    label(ctx, 'STREET RACE', x + 22, y + 30, 30, '#6fffe8', 'left', 900);
    if (race.active) {
      const minutes = Math.floor(race.elapsed / 60);
      const seconds = Math.floor(race.elapsed % 60);
      const tenths = Math.floor((race.elapsed * 10) % 10);
      const time = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`;
      label(ctx, time, x + w - 22, y + 30, 30, '#fff4df', 'right', 900, FONT.mono);
      label(ctx, `CHECKPOINT ${race.checkpoint + 1}/${race.route.length}`, x + 22, y + 68, 27, '#fff4df', 'left', 900);
      label(ctx, game.player.inCar ? 'DRIVE THROUGH THE GATE' : 'GET IN A CAR', x + w - 22, y + 68, 19, '#b9fff4', 'right', 800, FONT.narrow);
    } else {
      label(ctx, '[V] START', x + w - 22, y + 30, 25, '#fff4df', 'right', 900, FONT.narrow);
      label(ctx, `FINISH FOR ${moneyText(race.reward)}`, x + 22, y + 68, 24, PALETTE.muted, 'left', 700, FONT.narrow);
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.fillRect(x + 22, y + 91, w - 44, 1);
    label(ctx, 'CREW  [C]', x + 22, y + 118, 26, '#ffd891', 'left', 900);
    label(ctx, crew.enabled ? 'WITH YOU' : 'STANDBY', x + w - 22, y + 118, 20, PALETTE.muted, 'right', 800, FONT.narrow);
    crew.members.forEach((member, index) => {
      const row = y + 157 + index * 36;
      ctx.fillStyle = member.color;
      ctx.beginPath();
      ctx.arc(x + 28, row, 6, 0, Math.PI * 2);
      ctx.fill();
      label(ctx, member.name, x + 44, row, 23, '#fff4df', 'left', 900);
      label(ctx, member.state, x + w - 22, row, 21, member.color, 'right', 800, FONT.narrow);
    });
  }

  function drawMoneyStars(ctx, game) {
    const right = 1880;
    const y = 94;
    ctx.save();
    ctx.textAlign = 'right';
    ctx.font = `italic 900 104px ${FONT.head}`;
    ctx.fillStyle = 'rgba(12, 7, 18, 0.55)';
    ctx.fillText(moneyText(game.player.money), right + 5, y + 6);
    ctx.fillStyle = state.moneyFlash > 0.05 ? '#b8ffcf' : PALETTE.money;
    ctx.fillText(moneyText(game.player.money), right, y);
    ctx.restore();
    // Wanted stars, lit and large.
    const stars = game.police?.stars ?? 0;
    for (let k = 0; k < 5; k += 1) {
      const sx = right - 36 - k * 82;
      const sy = y + 88;
      starPath(ctx, sx, sy, 38);
      if (k < stars) {
        ctx.fillStyle = PALETTE.wanted;
        ctx.shadowColor = 'rgba(255, 211, 77, 0.9)';
        ctx.shadowBlur = 26;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(80, 40, 10, 0.55)';
        ctx.lineWidth = 2.4;
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(255, 236, 200, 0.13)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 236, 200, 0.32)';
        ctx.lineWidth = 2.4;
        ctx.stroke();
      }
    }
    const district = game.district ?? 'VELVET SQUARE';
    label(ctx, clockText(game.hour ?? 18.7), right - 470, y, 40, '#ffd891', 'right', 800, FONT.mono);
    label(ctx, district, right, y + 140, 28, 'rgba(255, 255, 255, 0.72)', 'right', 800, FONT.narrow);
    const police = game.police;
    if (police && police.stars > 0) {
      const text = police.status === 'HIDDEN' ? 'SEARCHING — STAY OUT OF SIGHT' : police.lastCrime ? `WANTED · ${police.lastCrime.toUpperCase()}` : 'WANTED';
      const color = police.status === 'HIDDEN' ? '#26efd4' : '#ff6a7a';
      label(ctx, text, right, y + 178, 26, color, 'right', 800, FONT.narrow);
    }
  }

  function drawDispatch(ctx, game) {
    const rows = game.police?.dispatch(game) ?? [];
    if (rows.length === 0) return;
    const w = 520;
    const x = 1880 - w;
    const y = 312;
    const h = 68 + rows.length * 42;
    panel(ctx, x, y, w, h, '#ff3355');
    label(ctx, 'VCPD DISPATCH', x + 20, y + 32, 40, '#ff8f9a', 'left', 900);
    const units = rows.length + (game.police?.blocks?.length ?? 0);
    label(ctx, `${units} ${units === 1 ? 'UNIT' : 'UNITS'}`, x + w - 20, y + 32, 24, 'rgba(255,255,255,0.62)', 'right', 700, FONT.narrow);
    const colors = {
      RAMMING: '#ff4d5e', ROADBLOCK: '#ffc247', FLANKING: '#26efd4', SPOTLIGHT: '#9d6bff',
      'CLOSING IN': '#ff8a3d', PURSUING: '#b9a9b7', DISABLED: '#6b6270',
    };
    let rowY = y + 69;
    for (const row of rows) {
      if (row.kind === 'air') {
        ctx.fillStyle = 'rgba(157, 107, 255, 0.16)';
        roundRect(ctx, x + 12, rowY - 17, w - 24, 36, 4);
        ctx.fill();
      }
      label(ctx, row.name, x + 20, rowY, 29, row.kind === 'air' ? '#c9b4ff' : '#f1e7dd', 'left', 800, FONT.mono);
      label(ctx, distanceText(row.dist), x + 210, rowY, 26, 'rgba(255,255,255,0.74)', 'left', 700, FONT.mono);
      const status = row.status;
      const color = colors[status] ?? '#b9a9b7';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      roundRect(ctx, x + w - 198, rowY - 16, 178, 34, 4);
      ctx.fill();
      label(ctx, status, x + w - 109, rowY, 23, color, 'center', 900, FONT.narrow);
      rowY += 42;
    }
  }

  function drawMinimap(ctx, game) {
    const radius = 176;
    const cx = 246;
    const cy = 744;
    const player = game.player;
    const angle = player.inCar ? player.inCar.angle : player.angle;
    ctx.save();
    // Outer bezel.
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 14, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(13, 8, 20, 0.92)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 196, 120, 0.62)';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();
    // Road field.
    ctx.fillStyle = '#1b1126';
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    const scale = 0.11;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-angle - Math.PI / 2);
    ctx.scale(scale, scale);
    ctx.translate(-player.x, -player.y);
    const span = radius / scale;
    const i0 = Math.max(0, Math.floor((player.x - span) / CITY.pitch));
    const i1 = Math.min(CITY.blocks - 1, Math.floor((player.x + span) / CITY.pitch));
    const j0 = Math.max(0, Math.floor((player.y - span) / CITY.pitch));
    const j1 = Math.min(CITY.blocks - 1, Math.floor((player.y + span) / CITY.pitch));
    for (let j = j0; j <= j1; j += 1) {
      for (let i = i0; i <= i1; i += 1) {
        const bx = i * CITY.pitch + CITY.half;
        const by = j * CITY.pitch + CITY.half;
        ctx.fillStyle = (i + j) % 2 === 0 ? '#4a3358' : '#402c4d';
        ctx.fillRect(bx + 18, by + 18, CITY.pitch - CITY.road - 36, CITY.pitch - CITY.road - 36);
        ctx.strokeStyle = 'rgba(255, 224, 186, 0.2)';
        ctx.lineWidth = 7;
        ctx.strokeRect(bx + 18, by + 18, CITY.pitch - CITY.road - 36, CITY.pitch - CITY.road - 36);
      }
    }
    // The road grid, bright enough to read as streets.
    ctx.strokeStyle = 'rgba(255, 236, 208, 0.55)';
    ctx.lineWidth = 12;
    for (let i = i0; i <= i1 + 1; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * CITY.pitch, (j0) * CITY.pitch);
      ctx.lineTo(i * CITY.pitch, (j1 + 1) * CITY.pitch);
      ctx.stroke();
    }
    for (let j = j0; j <= j1 + 1; j += 1) {
      ctx.beginPath();
      ctx.moveTo(i0 * CITY.pitch, j * CITY.pitch);
      ctx.lineTo((i1 + 1) * CITY.pitch, j * CITY.pitch);
      ctx.stroke();
    }
    // The route to the live job marker, drawn like a sat-nav line.
    for (const marker of game.missions.markerList()) {
      ctx.save();
      ctx.setLineDash([26, 18]);
      ctx.strokeStyle = 'rgba(38, 239, 212, 0.95)';
      ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.moveTo(player.x, player.y);
      ctx.lineTo(marker.x, marker.y);
      ctx.stroke();
      ctx.restore();
    }
    const raceMarker = game.race.marker;
    if (raceMarker) {
      ctx.save();
      ctx.setLineDash([32, 16]);
      ctx.strokeStyle = '#42ffe3';
      ctx.lineWidth = 18;
      ctx.beginPath();
      ctx.moveTo(player.x, player.y);
      ctx.lineTo(raceMarker.x, raceMarker.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#42ffe3';
      ctx.beginPath();
      ctx.arc(raceMarker.x, raceMarker.y, 65, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // Mission marker.
    for (const marker of game.missions.markerList()) {
      ctx.fillStyle = marker.kind === 'target' ? '#ff4d5e' : '#ffd34d';
      ctx.strokeStyle = 'rgba(20, 10, 26, 0.8)';
      ctx.lineWidth = 6;
      ctx.save();
      ctx.translate(marker.x, marker.y);
      ctx.rotate(angle + Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, -58);
      ctx.lineTo(40, 0);
      ctx.lineTo(0, 58);
      ctx.lineTo(-40, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    // Cars and police.
    for (const unit of game.police?.units ?? []) {
      if (!unit.police) continue;
      const flash = Math.sin((unit.sirenPhase ?? 0) * Math.PI * 2) > 0;
      ctx.fillStyle = unit.wrecked ? '#5d5566' : flash ? '#ff3355' : '#3d7bff';
      ctx.beginPath();
      ctx.arc(unit.x, unit.y, 52, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const car of game.traffic?.cars ?? []) {
      ctx.fillStyle = '#f3e7d2';
      ctx.fillRect(car.x - 34, car.y - 34, 68, 68);
    }
    if (game.police?.chopper) {
      const ch = game.police.chopper;
      ctx.fillStyle = '#c9b4ff';
      ctx.beginPath();
      ctx.arc(ch.x, ch.y, 54, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // Player arrow stays upright at the centre.
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(16, 10, 24, 0.9)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, -24);
    ctx.lineTo(18, 19);
    ctx.lineTo(0, 11);
    ctx.lineTo(-18, 19);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.restore();
    // Draw compass and ticks outside the clipped, translated map.
    const northAngle = -angle - Math.PI;
    for (let k = 0; k < 12; k += 1) {
      const a = (k / 12) * Math.PI * 2 + northAngle;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (radius + 2), cy + Math.sin(a) * (radius + 2));
      ctx.lineTo(cx + Math.cos(a) * (radius + 12), cy + Math.sin(a) * (radius + 12));
      ctx.strokeStyle = 'rgba(255, 220, 180, 0.42)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    const nx = cx + Math.cos(northAngle) * (radius - 2);
    const ny = cy + Math.sin(northAngle) * (radius - 2);
    ctx.beginPath();
    ctx.arc(nx, ny, 21, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1220';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 211, 77, 0.85)';
    ctx.lineWidth = 2;
    ctx.stroke();
    label(ctx, 'N', nx, ny + 1, 24, '#ffd34d', 'center', 900);
    label(ctx, (game.district ?? 'VELVET SQUARE').toUpperCase(), cx, cy - radius - 30, 30, '#ffd891', 'center', 900, FONT.narrow);
  }

  function drawVitals(ctx, game) {
    const x = 74;
    const y = 984;
    const w = 340;
    const p = game.player;
    ctx.fillStyle = 'rgba(13, 8, 20, 0.78)';
    roundRect(ctx, x - 16, y - 16, w + 32, 84, 8);
    ctx.fill();
    drawBar(ctx, x, y, w, 26, p.health / 100, PALETTE.health, 'HEALTH', `${Math.round(p.health)}`);
    drawBar(ctx, x, y + 38, w, 18, p.armour / 100, PALETTE.armour, 'ARMOUR', `${Math.round(p.armour)}`);
    if (game.respect !== undefined) {
      label(ctx, `RESPECT ${game.player.respect}`, x + w + 26, y + 10, 24, 'rgba(255, 211, 120, 0.85)', 'left', 800, FONT.narrow);
    }
  }

  function drawBar(ctx, x, y, w, h, value, color, name, valueText) {
    const barX = x + 112;
    const barWidth = w - 166;
    ctx.fillStyle = 'rgba(13, 8, 20, 0.9)';
    roundRect(ctx, barX, y, barWidth, h, h * 0.5);
    ctx.fill();
    const clamped = Math.max(0, Math.min(1, value));
    if (clamped > 0) {
      ctx.fillStyle = color;
      roundRect(ctx, barX + 2, y + 2, Math.max(3, (barWidth - 4) * clamped), h - 4, (h - 4) * 0.5);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.24)';
    ctx.lineWidth = 2;
    roundRect(ctx, barX, y, barWidth, h, h * 0.5);
    ctx.stroke();
    label(ctx, name, x + 4, y + h / 2, 23, 'rgba(255,255,255,0.8)', 'left', 800, FONT.narrow);
    label(ctx, valueText, x + w - 4, y + h / 2, 24, '#f7f1e6', 'right', 800, FONT.mono);
  }

  function drawVehiclePanel(ctx, game) {
    const car = game.player.inCar;
    const right = 1880;
    if (car) {
      const mph = Math.round(Math.abs(car.speed) * 0.22);
      ctx.save();
      ctx.textAlign = 'right';
      ctx.font = `italic 900 132px ${FONT.head}`;
      ctx.fillStyle = 'rgba(10, 6, 16, 0.55)';
      ctx.fillText(String(mph), right + 6, 1006);
      ctx.fillStyle = '#fff4df';
      ctx.fillText(String(mph), right, 1000);
      ctx.restore();
      label(ctx, 'MPH', right - 8, 936, 30, '#ff8a3d', 'right', 900, FONT.narrow);
      const gear = car.speed < -6 ? 'R' : Math.abs(car.speed) < 6 ? 'N' : 'D';
      label(ctx, gear, right - 236, 986, 42, 'rgba(255,255,255,0.78)', 'right', 900, FONT.mono);
      label(ctx, car.name, right, 896, 32, '#ffd891', 'right', 900, FONT.head);
      // Condition bar.
      const w = 300;
      const x = right - w;
      const y = 1014;
      ctx.fillStyle = 'rgba(13, 8, 20, 0.9)';
      roundRect(ctx, x, y, w, 15, 7);
      ctx.fill();
      ctx.fillStyle = car.health > 55 ? '#54e08a' : car.health > 25 ? '#ffc247' : '#ff4d5e';
      roundRect(ctx, x + 2, y + 2, Math.max(2, (w - 4) * Math.max(0, car.health / 100)), 11, 5);
      ctx.fill();
      label(ctx, 'CONDITION', x, y + 32, 22, 'rgba(255,255,255,0.7)', 'left', 800, FONT.narrow);
      label(ctx, `${Math.round(car.health)}%`, right, y + 32, 22, '#f7f1e6', 'right', 800, FONT.mono);
      if (car.indicator !== 0) {
        const blink = Math.sin((game.clock ?? 0) * 12) > 0;
        if (blink) {
          ctx.fillStyle = '#ffc247';
          const ix = car.indicator < 0 ? right - 400 : right - 368;
          ctx.beginPath();
          ctx.moveTo(ix, 896);
          ctx.lineTo(ix + 18, 886);
          ctx.lineTo(ix + 18, 906);
          ctx.closePath();
          ctx.fill();
        }
      }
    } else {
      const weapon = WEAPONS[game.player.weapon];
      const ammo = game.player.ammo[game.player.weapon];
      panel(ctx, right - 384, 872, 384, 176, '#26efd4');
      label(ctx, weapon.name, right - 24, 906, 30, '#d8fff8', 'right', 900);
      ctx.save();
      ctx.font = `italic 900 76px ${FONT.head}`;
      ctx.fillStyle = '#fff4df';
      ctx.textAlign = 'right';
      ctx.fillText(String(ammo.clip), right - 272, 986);
      ctx.font = `700 36px ${FONT.mono}`;
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.textAlign = 'left';
      ctx.fillText(`/ ${ammo.reserve}`, right - 258, 992);
      ctx.restore();
      label(ctx, 'AMMO', right - 24, 986, 24, '#26efd4', 'right', 800, FONT.narrow);
      // Weapon slots.
      let px = right - 26;
      for (let index = game.player.unlocked.length - 1; index >= 0; index -= 1) {
        const id = game.player.unlocked[index];
        const unlocked = WEAPONS[id];
        const active = id === game.player.weapon;
        ctx.fillStyle = active ? 'rgba(38, 239, 212, 0.24)' : 'rgba(255,255,255,0.07)';
        roundRect(ctx, px - 60, 1012, 56, 30, 4);
        ctx.fill();
        label(ctx, unlocked.tag, px - 32, 1028, 20, active ? '#26efd4' : 'rgba(255,255,255,0.45)', 'center', 900, FONT.narrow);
        px -= 64;
      }
    }
  }

  function drawRadio(ctx, game) {
    const radio = RADIO[game.radioIndex ?? 0];
    label(ctx, `${radio.dial} · ${radio.name}`, 1880, 812, 24, 'rgba(255, 220, 180, 0.72)', 'right', 700, FONT.narrow);
    label(ctx, radio.tag.toUpperCase(), 1880, 840, 18, 'rgba(255, 255, 255, 0.44)', 'right', 700, FONT.narrow);
  }

  function drawDialogue(ctx, game) {
    if (!state.dialogue) {
      if (!game.staged) drawHints(ctx, game);
      return;
    }
    const d = state.dialogue;
    const cast = CAST[d.speaker] ?? CAST.mara;
    const w = 1060;
    const h = 178;
    const x = 430;
    const y = 862;
    panel(ctx, x, y, w, h, '#ff8a3d');
    // Portrait.
    const px = x + 82;
    const py = y + 89;
    ctx.save();
    ctx.beginPath();
    ctx.arc(px, py, 60, 0, Math.PI * 2);
    ctx.fillStyle = cast.shirt;
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = cast.skin;
    ctx.beginPath();
    ctx.arc(px, py - 9, 29, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(20, 14, 26, 0.55)';
    ctx.beginPath();
    ctx.ellipse(px, py - 27, 33, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = cast.skin;
    ctx.beginPath();
    ctx.ellipse(px, py + 66, 51, 39, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255, 196, 120, 0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(px, py, 60, 0, Math.PI * 2);
    ctx.stroke();
    label(ctx, cast.name, x + 164, y + 48, 40, '#ffb066', 'left', 900);
    ctx.save();
    ctx.font = `900 40px ${FONT.head}`;
    const nameWidth = ctx.measureText(cast.name).width;
    ctx.restore();
    label(ctx, cast.role.toUpperCase(), x + 164 + nameWidth + 76, y + 49, 22, 'rgba(255,255,255,0.5)', 'left', 700, FONT.narrow);
    drawWrapped(ctx, d.text, x + 164, y + 104, w - 200, 50, '#f7f1e6', 2);
  }

  function drawWrapped(ctx, text, x, y, maxWidth, lineHeight, color, maxLines = 2) {
    ctx.font = `600 ${Math.round(lineHeight * 0.82)}px ${FONT.body}`;
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const words = text.split(' ');
    let line = '';
    let lineIndex = 0;
    for (let k = 0; k < words.length; k += 1) {
      const test = line ? `${line} ${words[k]}` : words[k];
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, y + lineIndex * lineHeight);
        line = words[k];
        lineIndex += 1;
        if (lineIndex >= maxLines) return;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, y + lineIndex * lineHeight);
  }

  function drawHints(ctx, game) {
    const hints = [
      ['WASD', 'MOVE / DRIVE'],
      ['MOUSE', 'AIM'],
      ['CLICK', 'FIRE'],
      ['E', game.player.inCar ? 'GET OUT' : 'STEAL CAR'],
      ['SPACE', 'HANDBRAKE'],
      ['R', 'RELOAD'],
    ];
    const w = hints.length * 172;
    let x = 960 - w / 2;
    const y = 1026;
    ctx.fillStyle = 'rgba(13, 8, 20, 0.7)';
    roundRect(ctx, 960 - w / 2 - 20, y - 30, w + 40, 60, 8);
    ctx.fill();
    for (const [key, action] of hints) {
      const boxW = Math.max(46, key.length * 12 + 14);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
      roundRect(ctx, x, y - 20, boxW, 40, 4);
      ctx.fill();
      label(ctx, key, x + boxW / 2, y + 1, 20, '#ffe8c2', 'center', 800, FONT.narrow);
      label(ctx, action, x + boxW + 10, y + 1, 16, 'rgba(255,255,255,0.58)', 'left', 700, FONT.narrow);
      x += 172;
    }
  }

  function drawPrompt(ctx, game) {
    const job = game.missions.jobs.find((item) => item.prompt);
    let text = null;
    if (job) text = `[ E ]  TALK TO ${CAST[job.giver].name}`;
    else if (!game.player.inCar) {
      // On foot beside a car: name the car you would take. The nearest one wins, unless the
      // player is standing on a live job marker, where the job's own prompt takes over.
      const onObjective = game.missions.markerList().some(
        (marker) => Math.hypot(marker.x - game.player.x, marker.y - game.player.y) < 70,
      );
      let near = null;
      let best = 78;
      if (!onObjective) {
        for (const car of game.vehicles) {
          if (car.wrecked || car.parked) continue;
          const d = Math.hypot(car.x - game.player.x, car.y - game.player.y);
          if (d < best) { best = d; near = car; }
        }
      }
      if (near) text = `[ E ]  HIJACK THE ${near.name}`;
    }
    if (!text) return;
    ctx.save();
    ctx.font = `900 56px ${FONT.head}`;
    const width = ctx.measureText(text).width + 72;
    ctx.fillStyle = 'rgba(13, 8, 20, 0.92)';
    roundRect(ctx, 960 - width / 2, 766, width, 96, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 211, 77, 0.9)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#ffd34d';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 960, 814);
    ctx.restore();
  }

  function drawToast(ctx, game) {
    if (state.toastTimer <= 0 || !state.toast) return;
    const alpha = Math.min(1, state.toastTimer * 2);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `900 26px ${FONT.head}`;
    const width = ctx.measureText(state.toast).width + 52;
    ctx.fillStyle = 'rgba(13, 8, 20, 0.86)';
    roundRect(ctx, 960 - width / 2, 250, width, 46, 6);
    ctx.fill();
    ctx.fillStyle = '#ff8a3d';
    ctx.fillRect(960 - width / 2, 250, 5, 46);
    ctx.fillStyle = '#ffe8c2';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.toast, 960, 274);
    ctx.restore();
  }

  function drawBanner(ctx, game) {
    if (state.bannerTimer <= 0 || !state.banner) return;
    const b = state.banner;
    const alpha = Math.min(1, state.bannerTimer * 1.4);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(200, 60, 110, 0.85)';
    roundRect(ctx, 960 - 290, 372, 580, 132, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 220, 170, 0.7)';
    ctx.lineWidth = 2;
    ctx.stroke();
    label(ctx, b.title, 960, 410, 42, '#fff2df', 'center', 900);
    label(ctx, b.subtitle, 960, 452, 24, '#ffd891', 'center', 800, FONT.body);
    label(ctx, b.footer, 960, 482, 18, 'rgba(255,255,255,0.7)', 'center', 700, FONT.narrow);
    ctx.restore();
  }

  function drawEdgePointer(ctx, game) {
    if (!game.project) return;
    const marker = game.race.marker ?? game.missions.markerList()[0];
    if (!marker) return;
    const scale = ctx.canvas.width / LOGICAL.width;
    const raw = game.project(marker.x, marker.y);
    const p = { x: raw.x / scale, y: raw.y / scale };
    if (p.x > 120 && p.x < 1800 && p.y > 140 && p.y < 900) return;
    const cx = 960;
    const cy = 540;
    const angle = Math.atan2(p.y - cy, p.x - cx);
    const rx = 860;
    const ry = 420;
    const x = cx + Math.cos(angle) * rx;
    const y = cy + Math.sin(angle) * ry;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = game.race.active ? '#42ffe3' : '#ffd34d';
    ctx.beginPath();
    ctx.moveTo(26, 0);
    ctx.lineTo(-12, -18);
    ctx.lineTo(-12, 18);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    const dist = Math.round(Math.hypot(marker.x - game.player.x, marker.y - game.player.y) / 8);
    label(ctx, `${dist} m`, x + Math.cos(angle) * 42, y + Math.sin(angle) * 42, 18, game.race.active ? '#42ffe3' : '#ffd34d', 'center', 800, FONT.mono);
  }

  function drawCrosshair(ctx, game) {
    const mouse = game.input?.mouse;
    if (!mouse) return;
    const s = ctx.canvas.width / LOGICAL.width;
    const x = mouse.x / s;
    const y = mouse.y / s;
    const spread = 7 + (game.player.recoil ?? 0) * 8;
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 246, 230, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - spread - 6, y);
    ctx.lineTo(x - spread, y);
    ctx.moveTo(x + spread, y);
    ctx.lineTo(x + spread + 6, y);
    ctx.moveTo(x, y - spread - 6);
    ctx.lineTo(x, y - spread);
    ctx.moveTo(x, y + spread);
    ctx.lineTo(x, y + spread + 6);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 211, 77, 0.9)';
    ctx.beginPath();
    ctx.arc(x, y, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawDamage(ctx, game) {
    const health = game.player.health / 100;
    const flash = Math.max(state.hitFlash, health < 0.3 ? 0.35 : 0);
    if (flash <= 0.01) return;
    const gradient = ctx.createRadialGradient(960, 540, 380, 960, 540, 1080);
    gradient.addColorStop(0, 'rgba(120, 10, 30, 0)');
    gradient.addColorStop(1, `rgba(200, 20, 50, ${0.42 * flash})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1920, 1080);
  }

  function drawBriefing(ctx, game) {
    const b = state.briefing;
    const job = b.job;
    ctx.fillStyle = 'rgba(8, 5, 12, 0.72)';
    ctx.fillRect(0, 0, 1920, 1080);
    panel(ctx, 340, 220, 1240, 640, '#ff8a3d');
    label(ctx, `JOB ${job.num} OF ${job.total}`, 392, 280, 24, '#ff8a3d', 'left', 900);
    label(ctx, job.title, 388, 340, 62, '#fff2df', 'left', 900);
    label(ctx, `${b.cast.name.toUpperCase()} · ${b.cast.role.toUpperCase()}`, 392, 396, 22, 'rgba(255,255,255,0.6)', 'left', 800, FONT.narrow);
    ctx.fillStyle = b.cast.shirt;
    roundRect(ctx, 392, 440, 200, 200, 12);
    ctx.fill();
    ctx.fillStyle = b.cast.skin;
    ctx.beginPath();
    ctx.arc(492, 516, 48, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(20, 14, 26, 0.55)';
    ctx.beginPath();
    ctx.ellipse(492, 484, 56, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = b.cast.skin;
    ctx.beginPath();
    ctx.ellipse(492, 636, 84, 62, 0, 0, Math.PI * 2);
    ctx.fill();
    let y = 452;
    for (const line of job.brief) {
      drawWrapped(ctx, line, 636, y, 860, 34, '#f7f1e6', 2);
      ctx.font = `600 27px ${FONT.body}`;
      const count = Math.max(1, Math.ceil(ctx.measureText(line).width / 860));
      y += 40 * count + 14;
    }
    label(ctx, `PAYOFF ${moneyText(job.reward)}`, 392, 740, 30, '#8bf0b5', 'left', 900);
    label(ctx, 'PRESS  E  TO TAKE THE JOB', 392, 792, 26, '#ffd34d', 'left', 900);
    label(ctx, 'ESC to walk away', 1000, 792, 19, 'rgba(255,255,255,0.45)', 'left', 700, FONT.narrow);
  }

  return {
    state, say, toast, banner, card, showBriefing, hideBriefing, update, draw,
  };
}

const CONFIG_TRAVEL = 1;

// --- The screens around the game: the title (with its own sunset-to-night sky over the city
// skyline), the pause card, and the two ways a night can end — busted or wasted. Drawn on the same
// 1920x1080 logical grid as the HUD, over a still frame of the live city.

function roundRectCard(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function skyline(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h * 0.5);
  g.addColorStop(0, '#2a1745');
  g.addColorStop(0.35, '#7b2c6a');
  g.addColorStop(0.62, '#e0506d');
  g.addColorStop(0.82, '#ff9a52');
  g.addColorStop(1, '#ffd08a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h * 0.5);
  // Sun.
  const sun = ctx.createRadialGradient(w * 0.63, h * 0.36, 10, w * 0.63, h * 0.36, h * 0.22);
  sun.addColorStop(0, 'rgba(255, 240, 190, 0.95)');
  sun.addColorStop(0.35, 'rgba(255, 190, 110, 0.55)');
  sun.addColorStop(1, 'rgba(255, 130, 90, 0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, w, h * 0.6);
  ctx.fillStyle = 'rgba(255, 244, 212, 0.92)';
  ctx.beginPath();
  ctx.arc(w * 0.63, h * 0.36, h * 0.055, 0, Math.PI * 2);
  ctx.fill();
  // Distant skyline silhouette.
  ctx.fillStyle = '#2a1738';
  let x = 0;
  let seed = 7;
  while (x < w) {
    seed = (seed * 9301 + 49297) % 233280;
    const bw = 26 + (seed % 70);
    seed = (seed * 9301 + 49297) % 233280;
    const bh = 20 + (seed % 120);
    ctx.fillRect(x, h * 0.5 - bh, bw, bh);
    x += bw + 7;
  }
  // Sea band and horizon glow.
  const sea = ctx.createLinearGradient(0, h * 0.5, 0, h * 0.62);
  sea.addColorStop(0, '#2d4a68');
  sea.addColorStop(1, '#14243c');
  ctx.fillStyle = sea;
  ctx.fillRect(0, h * 0.5, w, h * 0.12);
  ctx.fillStyle = 'rgba(255, 180, 120, 0.22)';
  for (let k = 0; k < 22; k += 1) {
    ctx.fillRect(w * 0.42 + Math.sin(k * 2.1) * 60 + k * 14, h * 0.5 + 10 + k * 3, 40 + k * 2, 2);
  }
}

export function drawTitle(ctx, game) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const s = w / 1920;
  ctx.save();
  ctx.scale(s, s);
  const W = 1920;
  const H = h / s;
  ctx.fillStyle = 'rgba(10, 6, 16, 0.34)';
  ctx.fillRect(0, 0, W, H);
  skyline(ctx, 1920, 760);
  // City silhouette with palms.
  ctx.fillStyle = 'rgba(14, 8, 22, 0.86)';
  for (let k = 0; k < 26; k += 1) {
    const bx = k * 78 - 20;
    const bh = 60 + ((k * 37) % 130);
    ctx.fillRect(bx, 760 - bh, 62, bh);
  }
  ctx.fillStyle = 'rgba(255, 47, 146, 0.55)';
  for (let k = 0; k < 40; k += 1) {
    const bx = (k * 53) % 1900;
    const by = 700 - ((k * 29) % 120);
    ctx.fillRect(bx, by, 4, 3);
  }
  // Foreground boulevard.
  const road = ctx.createLinearGradient(0, 760, 0, H);
  road.addColorStop(0, '#2a2136');
  road.addColorStop(1, '#120d1a');
  ctx.fillStyle = road;
  ctx.fillRect(0, 760, W, H - 760);
  ctx.strokeStyle = 'rgba(255, 196, 81, 0.5)';
  ctx.lineWidth = 3;
  for (let k = 0; k < 8; k += 1) {
    ctx.beginPath();
    ctx.moveTo(960 + (k - 4) * 220, 1080);
    ctx.lineTo(960 + (k - 4) * 60, 760);
    ctx.stroke();
  }
  // Title block.
  ctx.save();
  ctx.translate(140, 250);
  ctx.font = `italic 900 152px ${FONT.head}`;
  ctx.fillStyle = 'rgba(255, 47, 146, 0.55)';
  ctx.shadowColor = 'rgba(255, 47, 146, 0.9)';
  ctx.shadowBlur = 42;
  ctx.fillText(CITY_NAME, 0, 0);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff3e2';
  ctx.fillText(CITY_NAME, -4, -4);
  ctx.restore();
  ctx.font = `800 40px ${FONT.head}`;
  ctx.fillStyle = '#ffcf5c';
  ctx.fillText(TAGLINE, 146, 330);
  ctx.font = `600 24px ${FONT.body}`;
  ctx.fillStyle = 'rgba(255, 240, 226, 0.72)';
  ctx.fillText('An original open-world crime story on a neon coast.', 148, 382);

  // Menu card.
  roundRectCard(ctx, 140, 470, 620, 300, 12);
  ctx.fillStyle = 'rgba(12, 7, 20, 0.82)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 196, 120, 0.4)';
  ctx.lineWidth = 2;
  ctx.stroke();
  const hasSave = Boolean(game.saveData);
  const items = hasSave
    ? [`CONTINUE  ·  JOB ${game.saveData.job ?? 1}`, 'NEW NIGHT', 'CONTROLS']
    : ['NEW NIGHT', 'CONTROLS'];
  items.forEach((item, index) => {
    const y = 530 + index * 62;
    const selected = index === game.menuIndex;
    if (selected) {
      roundRectCard(ctx, 160, y - 34, 580, 50, 6);
      ctx.fillStyle = 'rgba(255, 47, 146, 0.22)';
      ctx.fill();
      ctx.fillStyle = '#ff2f92';
      ctx.fillRect(160, y - 34, 6, 50);
    }
    ctx.font = `900 30px ${FONT.head}`;
    ctx.fillStyle = selected ? '#fff3e2' : 'rgba(255, 240, 226, 0.5)';
    ctx.fillText(item, 186, y);
  });
  ctx.font = `700 18px ${FONT.narrow}`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.fillText('ENTER  SELECT      W / S  MOVE', 186, 720);

  // Cast strip.
  ctx.font = `800 18px ${FONT.narrow}`;
  ctx.fillStyle = 'rgba(255, 207, 92, 0.8)';
  ctx.fillText('TONIGHT', 1420, 250);
  const cast = [CAST.player, CAST.mara, CAST.kemp];
  cast.forEach((person, index) => {
    const y = 290 + index * 96;
    ctx.fillStyle = person.shirt;
    roundRectCard(ctx, 1420, y, 72, 72, 10);
    ctx.fill();
    ctx.fillStyle = person.skin;
    ctx.beginPath();
    ctx.arc(1456, y + 30, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(20, 14, 26, 0.55)';
    ctx.beginPath();
    ctx.ellipse(1456, y + 17, 20, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = person.skin;
    ctx.beginPath();
    ctx.ellipse(1456, y + 76, 30, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f7f1e6';
    ctx.font = `900 22px ${FONT.head}`;
    ctx.fillText(person.name, 1512, y + 30);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = `700 16px ${FONT.narrow}`;
    ctx.fillText(person.role.toUpperCase(), 1512, y + 54);
  });

  // Footer.
  ctx.font = `700 17px ${FONT.narrow}`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.fillText('WASD + MOUSE  ·  E TO STEAL A CAR  ·  THREE JOBS  ·  NO NETWORK, NO ASSETS', 140, 1020);
  ctx.restore();
}

export function drawPause(ctx, game) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const s = w / 1920;
  ctx.save();
  ctx.scale(s, s);
  ctx.fillStyle = 'rgba(8, 5, 14, 0.72)';
  ctx.fillRect(0, 0, 1920, h / s);
  roundRectCard(ctx, 560, 260, 800, 470, 14);
  ctx.fillStyle = 'rgba(14, 9, 22, 0.95)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 196, 120, 0.4)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.font = `italic 900 72px ${FONT.head}`;
  ctx.fillStyle = '#fff3e2';
  ctx.fillText('PAUSED', 600, 356);
  ctx.font = `700 22px ${FONT.narrow}`;
  ctx.fillStyle = '#ffcf5c';
  ctx.fillText('THE CITY WAITS', 604, 396);
  const rows = [
    ['WASD', 'walk and drive'],
    ['MOUSE + CLICK', 'aim and fire'],
    ['E', 'enter or leave a car'],
    ['SPACE', 'handbrake'],
    ['SHIFT', 'sprint'],
    ['1 / 2 / 3', 'weapons  ·  R reload'],
    ['ESC', 'back to the city'],
  ];
  rows.forEach(([key, action], index) => {
    const y = 470 + index * 34;
    ctx.font = `800 21px ${FONT.narrow}`;
    ctx.fillStyle = '#ffb066';
    ctx.fillText(key, 610, y);
    ctx.font = `600 21px ${FONT.body}`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText(action, 830, y);
  });
  ctx.restore();
}

export function drawBusted(ctx, game, info) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const s = w / 1920;
  ctx.save();
  ctx.scale(s, s);
  ctx.fillStyle = 'rgba(30, 4, 12, 0.78)';
  ctx.fillRect(0, 0, 1920, h / s);
  ctx.fillStyle = 'rgba(255, 51, 85, 0.16)';
  ctx.fillRect(0, 380, 1920, 40);
  ctx.fillStyle = 'rgba(61, 123, 255, 0.16)';
  ctx.fillRect(0, 700, 1920, 40);
  ctx.font = `italic 900 168px ${FONT.head}`;
  ctx.fillStyle = 'rgba(255, 77, 94, 0.4)';
  ctx.fillText('BUSTED', 96, 560);
  ctx.fillStyle = '#fff3e2';
  ctx.fillText('BUSTED', 90, 552);
  ctx.font = `800 30px ${FONT.head}`;
  ctx.fillStyle = '#ffd891';
  ctx.fillText(info?.reason ?? 'VCPD HOLDS YOU FOR QUESTIONING', 100, 620);
  ctx.font = `600 24px ${FONT.body}`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.fillText(`Legal fee  $${(info?.fee ?? 0).toLocaleString('en-US')}   ·   ${info?.line ?? 'The ledger can wait until morning.'}`, 100, 668);
  ctx.font = `900 26px ${FONT.head}`;
  ctx.fillStyle = '#ffcf5c';
  ctx.fillText('PRESS  ENTER  TO WALK OUT', 100, 800);
  ctx.restore();
}

export function drawWasted(ctx, game, info) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const s = w / 1920;
  ctx.save();
  ctx.scale(s, s);
  ctx.fillStyle = 'rgba(20, 6, 14, 0.82)';
  ctx.fillRect(0, 0, 1920, h / s);
  const g = ctx.createRadialGradient(960, 520, 80, 960, 520, 760);
  g.addColorStop(0, 'rgba(120, 20, 40, 0.5)');
  g.addColorStop(1, 'rgba(20, 6, 14, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1920, h / s);
  ctx.font = `italic 900 168px ${FONT.head}`;
  ctx.fillStyle = 'rgba(255, 77, 94, 0.4)';
  ctx.fillText('WASTED', 96, 560);
  ctx.fillStyle = '#fff3e2';
  ctx.fillText('WASTED', 90, 552);
  ctx.font = `800 30px ${FONT.head}`;
  ctx.fillStyle = '#ffd891';
  ctx.fillText(info?.reason ?? 'BAY GENERAL PATCHED YOU UP', 100, 620);
  ctx.font = `600 24px ${FONT.body}`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.fillText(`Hospital bill  $${(info?.fee ?? 0).toLocaleString('en-US')}   ·   ${info?.line ?? 'Vesper does not forgive a slow night.'}`, 100, 668);
  ctx.font = `900 26px ${FONT.head}`;
  ctx.fillStyle = '#ffcf5c';
  ctx.fillText('PRESS  ENTER  TO GET BACK OUT THERE', 100, 800);
  ctx.restore();
}
