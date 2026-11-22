// The HUD, laid out on a 1920x1080 grid and scaled to the canvas. Drawing order is corner panels
// first (job, dispatch, money and stars, minimap and vitals, speed or weapon), then the dialogue
// box, prompts, toasts and banners, and last the crosshair and edge pointers. Every word here is
// a label the player reads at a glance: job number, objective, next step, named police units with
// range and state, wanted stars, cash, condition.

import { CAST, CITY, FONT, LOGICAL, PALETTE, RADIO, WEAPONS } from './config.js';

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
    drawMoneyStars(ctx, game);
    drawDispatch(ctx, game);
    drawMinimap(ctx, game);
    drawVitals(ctx, game);
    drawVehiclePanel(ctx, game);
    drawRadio(ctx, game);
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
      ctx.font = `800 20px ${FONT.head}`;
      const width = ctx.measureText(text).width + 26;
      ctx.fillStyle = 'rgba(13, 8, 20, 0.72)';
      roundRect(ctx, p.x - width / 2, p.y - 106, width, 30, 6);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 205, 90, 0.7)';
      ctx.stroke();
      ctx.fillStyle = '#ffd34d';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, p.x, p.y - 91);
      ctx.restore();
    }
  }

  function drawJobPanel(ctx, game) {
    const mission = game.missions.hudState();
    const x = 34;
    const y = 28;
    const w = 648;
    let height = 168;
    if (mission) height = mission.waiting ? 132 : mission.timer > 0 ? 196 : 178;
    panel(ctx, x, y, w, height, mission ? '#ff8a3d' : '#6b6270');
    if (!mission) {
      label(ctx, 'NO JOB ACTIVE', x + 26, y + 38, 26, '#ffd34d');
      label(ctx, 'Roll the city and wait for a call', x + 26, y + 76, 23, PALETTE.muted, 'left', 500, FONT.body);
      return;
    }
    // Header: job number chip and title.
    ctx.fillStyle = '#ff8a3d';
    roundRect(ctx, x + 20, y + 18, 118, 36, 5);
    ctx.fill();
    label(ctx, `JOB ${mission.num}/${mission.total}`, x + 79, y + 37, 22, '#1a0f18', 'center', 900);
    label(ctx, mission.title, x + 154, y + 37, 30, PALETTE.text, 'left', 900);
    if (mission.timer > 0) {
      ctx.fillStyle = 'rgba(255, 77, 94, 0.16)';
      roundRect(ctx, x + w - 132, y + 16, 112, 40, 6);
      ctx.fill();
      label(ctx, `${String(Math.floor(mission.timer / 60)).padStart(2, '0')}:${String(Math.floor(mission.timer % 60)).padStart(2, '0')}`, x + w - 76, y + 37, 28, '#ff6a7a', 'center', 800, FONT.mono);
    }
    // Stage pips.
    const stages = mission.stages ?? 3;
    const pipY = y + 72;
    for (let k = 0; k < stages; k += 1) {
      const px = x + 24 + k * 46;
      ctx.fillStyle = k < (mission.stage || 1) ? '#ff8a3d' : 'rgba(255, 255, 255, 0.16)';
      roundRect(ctx, px, pipY, 38, 7, 3);
      ctx.fill();
    }
    label(ctx, mission.stage > 0 ? `STAGE ${mission.stage}/${stages}` : 'READY', x + 24 + stages * 46, pipY + 3, 19, PALETTE.muted, 'left', 700, FONT.narrow);
    if (mission.progress) label(ctx, mission.progress, x + w - 26, pipY + 3, 24, '#ffd34d', 'right', 800, FONT.mono);
    // Objective and next.
    label(ctx, mission.objective, x + 24, y + 107, 25, '#fff6e6', 'left', 700, FONT.body);
    ctx.fillStyle = 'rgba(255, 138, 61, 0.9)';
    roundRect(ctx, x + 24, y + 129, 62, 22, 4);
    ctx.fill();
    label(ctx, 'NEXT', x + 55, y + 141, 17, '#1a0f18', 'center', 900);
    label(ctx, mission.next, x + 98, y + 140, 21, PALETTE.muted, 'left', 600, FONT.body);
    label(ctx, `REWARD ${moneyText(mission.reward)}`, x + w - 24, y + 140, 21, PALETTE.money, 'right', 800, FONT.narrow);
  }

  function drawMoneyStars(ctx, game) {
    const right = 1886;
    const y = 60;
    ctx.save();
    ctx.textAlign = 'right';
    ctx.font = `italic 900 68px ${FONT.head}`;
    ctx.fillStyle = 'rgba(12, 7, 18, 0.55)';
    ctx.fillText(moneyText(game.player.money), right + 4, y + 5);
    ctx.fillStyle = state.moneyFlash > 0.05 ? '#b8ffcf' : PALETTE.money;
    ctx.fillText(moneyText(game.player.money), right, y);
    ctx.restore();
    // Wanted stars.
    const stars = game.police?.stars ?? 0;
    for (let k = 0; k < 5; k += 1) {
      const sx = right - 24 - k * 52;
      const sy = y + 78;
      starPath(ctx, sx, sy, 23);
      if (k < stars) {
        ctx.fillStyle = PALETTE.wanted;
        ctx.shadowColor = 'rgba(255, 211, 77, 0.8)';
        ctx.shadowBlur = 18;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(80, 40, 10, 0.5)';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(255, 236, 200, 0.13)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 236, 200, 0.32)';
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
    }
    const district = game.district ?? 'VELVET SQUARE';
    label(ctx, clockText(game.hour ?? 18.7), right - 296, y + 78, 26, '#ffd891', 'right', 800, FONT.mono);
    label(ctx, district, right, y + 122, 21, 'rgba(255, 255, 255, 0.66)', 'right', 700, FONT.narrow);
    const police = game.police;
    if (police && police.stars > 0) {
      const text = police.status === 'HIDDEN' ? 'SEARCHING — STAY OUT OF SIGHT' : police.lastCrime ? `WANTED · ${police.lastCrime.toUpperCase()}` : 'WANTED';
      const color = police.status === 'HIDDEN' ? '#26efd4' : '#ff6a7a';
      label(ctx, text, right, y + 148, 18, color, 'right', 800, FONT.narrow);
    }
  }

  function drawDispatch(ctx, game) {
    const rows = game.police?.dispatch(game) ?? [];
    if (rows.length === 0) return;
    const w = 512;
    const x = 1886 - w;
    const y = 252;
    const h = 62 + rows.length * 40;
    panel(ctx, x, y, w, h, '#ff3355');
    label(ctx, 'VCPD DISPATCH', x + 22, y + 28, 22, '#ff8f9a', 'left', 900);
    const units = game.police?.units.filter((u) => u.police).length ?? 0;
    label(ctx, `${rows.length + (game.police?.blocks?.length ?? 0)} UNITS · ${'★'.repeat(game.police?.stars ?? 0)}`, x + w - 20, y + 28, 18, 'rgba(255,255,255,0.6)', 'right', 700, FONT.narrow);
    const colors = {
      RAMMING: '#ff4d5e', ROADBLOCK: '#ffc247', FLANKING: '#26efd4', SPOTLIGHT: '#9d6bff',
      'CLOSING IN': '#ff8a3d', PURSUING: '#b9a9b7', DISABLED: '#6b6270',
    };
    let rowY = y + 58;
    for (const row of rows) {
      if (row.kind === 'air') {
        ctx.fillStyle = 'rgba(157, 107, 255, 0.16)';
        roundRect(ctx, x + 12, rowY - 14, w - 24, 32, 4);
        ctx.fill();
      }
      label(ctx, row.name, x + 22, rowY + 2, 21, row.kind === 'air' ? '#c9b4ff' : '#f1e7dd', 'left', 800, FONT.mono);
      label(ctx, distanceText(row.dist), x + 250, rowY + 2, 19, 'rgba(255,255,255,0.72)', 'left', 700, FONT.mono);
      const status = row.status;
      const color = colors[status] ?? '#b9a9b7';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      roundRect(ctx, x + w - 170, rowY - 13, 152, 28, 4);
      ctx.fill();
      label(ctx, status, x + w - 94, rowY + 1, 17, color, 'center', 900, FONT.narrow);
      rowY += 40;
    }
  }

  function drawMinimap(ctx, game) {
    const radius = 150;
    const cx = 206;
    const cy = 806;
    const player = game.player;
    const angle = player.inCar ? player.inCar.angle : player.angle;
    ctx.save();
    // Outer bezel.
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 12, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(13, 8, 20, 0.9)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 196, 120, 0.5)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();
    // Road field.
    ctx.fillStyle = '#171022';
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    const scale = 0.084;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-angle - Math.PI / 2);
    ctx.scale(scale, scale);
    ctx.translate(-player.x, -player.y);
    const span = 150 / scale;
    const i0 = Math.max(0, Math.floor((player.x - span) / CITY.pitch));
    const i1 = Math.min(CITY.blocks - 1, Math.floor((player.x + span) / CITY.pitch));
    const j0 = Math.max(0, Math.floor((player.y - span) / CITY.pitch));
    const j1 = Math.min(CITY.blocks - 1, Math.floor((player.y + span) / CITY.pitch));
    for (let j = j0; j <= j1; j += 1) {
      for (let i = i0; i <= i1; i += 1) {
        const bx = i * CITY.pitch + CITY.half;
        const by = j * CITY.pitch + CITY.half;
        ctx.fillStyle = (i + j) % 2 === 0 ? '#705c82' : '#675374';
        ctx.fillRect(bx + 18, by + 18, CITY.pitch - CITY.road - 36, CITY.pitch - CITY.road - 36);
        ctx.strokeStyle = 'rgba(255, 214, 170, 0.14)';
        ctx.lineWidth = 6;
        ctx.strokeRect(bx + 18, by + 18, CITY.pitch - CITY.road - 36, CITY.pitch - CITY.road - 36);
      }
    }
    // The road grid, bright enough to read as streets.
    ctx.strokeStyle = 'rgba(255, 226, 190, 0.16)';
    ctx.lineWidth = 8;
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
    // Mission marker.
    for (const marker of game.missions.markerList()) {
      ctx.fillStyle = marker.kind === 'target' ? '#ff4d5e' : '#ffd34d';
      ctx.save();
      ctx.translate(marker.x, marker.y);
      ctx.rotate(angle + Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, -26);
      ctx.lineTo(18, 0);
      ctx.lineTo(0, 26);
      ctx.lineTo(-18, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // Cars and police.
    for (const unit of game.police?.units ?? []) {
      if (!unit.police) continue;
      const flash = Math.sin((unit.sirenPhase ?? 0) * Math.PI * 2) > 0;
      ctx.fillStyle = unit.wrecked ? '#5d5566' : flash ? '#ff3355' : '#3d7bff';
      ctx.beginPath();
      ctx.arc(unit.x, unit.y, 20, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const car of game.traffic?.cars ?? []) {
      ctx.fillStyle = '#f3e7d2';
      ctx.fillRect(car.x - 15, car.y - 15, 30, 30);
    }
    if (game.police?.chopper) {
      const ch = game.police.chopper;
      ctx.fillStyle = '#c9b4ff';
      ctx.beginPath();
      ctx.arc(ch.x, ch.y, 20, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // Player arrow stays upright at the centre.
    ctx.restore();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(16, 10, 24, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.lineTo(11, 12);
    ctx.lineTo(0, 7);
    ctx.lineTo(-11, 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // North marker on the rim.
    const northAngle = -angle - Math.PI / 2;
    const nx = cx + Math.cos(northAngle) * (radius - 2);
    const ny = cy + Math.sin(northAngle) * (radius - 2);
    ctx.beginPath();
    ctx.arc(nx, ny, 15, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1220';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 211, 77, 0.8)';
    ctx.stroke();
    label(ctx, 'N', nx, ny + 1, 17, '#ffd34d', 'center', 900);
    // Ring ticks.
    for (let k = 0; k < 12; k += 1) {
      const a = (k / 12) * Math.PI * 2 + northAngle;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (radius + 2), cy + Math.sin(a) * (radius + 2));
      ctx.lineTo(cx + Math.cos(a) * (radius + 10), cy + Math.sin(a) * (radius + 10));
      ctx.strokeStyle = 'rgba(255, 220, 180, 0.34)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
    label(ctx, (game.district ?? 'VELVET SQUARE'), cx, cy - radius - 28, 20, '#ffd891', 'center', 900, FONT.narrow);
    label(ctx, 'VESPER CITY', cx, cy + radius + 30, 16, 'rgba(255,255,255,0.4)', 'center', 700, FONT.narrow);
  }

  function drawVitals(ctx, game) {
    const x = 54;
    const y = 992;
    const w = 304;
    const p = game.player;
    ctx.fillStyle = 'rgba(13, 8, 20, 0.72)';
    roundRect(ctx, x - 14, y - 14, w + 28, 68, 8);
    ctx.fill();
    drawBar(ctx, x, y, w, 16, p.health / 100, PALETTE.health, 'HEALTH', `${Math.round(p.health)}`);
    drawBar(ctx, x, y + 28, w, 12, p.armour / 100, PALETTE.armour, 'ARMOUR', `${Math.round(p.armour)}`);
    if (game.respect !== undefined) {
      label(ctx, `RESPECT ${game.player.respect}`, x + w + 22, y + 8, 19, 'rgba(255, 211, 120, 0.8)', 'left', 800, FONT.narrow);
    }
  }

  function drawBar(ctx, x, y, w, h, value, color, name, valueText) {
    ctx.fillStyle = 'rgba(13, 8, 20, 0.86)';
    roundRect(ctx, x, y, w, h, h * 0.5);
    ctx.fill();
    const clamped = Math.max(0, Math.min(1, value));
    if (clamped > 0) {
      ctx.fillStyle = color;
      roundRect(ctx, x + 2, y + 2, Math.max(3, (w - 4) * clamped), h - 4, (h - 4) * 0.5);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, h, h * 0.5);
    ctx.stroke();
    label(ctx, name, x + 12, y + h + 15, 16, 'rgba(255,255,255,0.68)', 'left', 800, FONT.narrow);
    label(ctx, valueText, x + w - 10, y + h + 15, 17, '#f7f1e6', 'right', 800, FONT.mono);
  }

  function drawVehiclePanel(ctx, game) {
    const car = game.player.inCar;
    const right = 1886;
    if (car) {
      const mph = Math.round(Math.abs(car.speed) * 0.22);
      ctx.save();
      ctx.textAlign = 'right';
      ctx.font = `italic 900 92px ${FONT.head}`;
      ctx.fillStyle = 'rgba(10, 6, 16, 0.55)';
      ctx.fillText(String(mph), right + 5, 1000 + 6);
      ctx.fillStyle = '#fff4df';
      ctx.fillText(String(mph), right, 1000);
      ctx.restore();
      label(ctx, 'MPH', right - 6, 948, 22, '#ff8a3d', 'right', 900, FONT.narrow);
      const gear = car.speed < -6 ? 'R' : Math.abs(car.speed) < 6 ? 'N' : 'D';
      label(ctx, gear, right - 150, 990, 30, 'rgba(255,255,255,0.72)', 'right', 900, FONT.mono);
      label(ctx, car.name, right, 924, 24, '#ffd891', 'right', 900, FONT.head);
      // Condition bar.
      const w = 250;
      const x = right - w;
      const y = 1016;
      ctx.fillStyle = 'rgba(13, 8, 20, 0.86)';
      roundRect(ctx, x, y, w, 11, 5);
      ctx.fill();
      ctx.fillStyle = car.health > 55 ? '#54e08a' : car.health > 25 ? '#ffc247' : '#ff4d5e';
      roundRect(ctx, x + 1.5, y + 1.5, Math.max(2, (w - 3) * Math.max(0, car.health / 100)), 8, 4);
      ctx.fill();
      label(ctx, 'CONDITION', x, y + 26, 16, 'rgba(255,255,255,0.62)', 'left', 800, FONT.narrow);
      label(ctx, `${Math.round(car.health)}%`, right, y + 26, 16, '#f7f1e6', 'right', 800, FONT.mono);
      if (car.indicator !== 0) {
        const blink = Math.sin((game.clock ?? 0) * 12) > 0;
        if (blink) {
          ctx.fillStyle = '#ffc247';
          const ix = car.indicator < 0 ? right - 330 : right - 300;
          ctx.beginPath();
          ctx.moveTo(ix, 924);
          ctx.lineTo(ix + 14, 916);
          ctx.lineTo(ix + 14, 932);
          ctx.closePath();
          ctx.fill();
        }
      }
    } else {
      const weapon = WEAPONS[game.player.weapon];
      const ammo = game.player.ammo[game.player.weapon];
      panel(ctx, right - 330, 900, 330, 146, '#26efd4');
      label(ctx, weapon.name, right - 22, 928, 24, '#d8fff8', 'right', 900);
      ctx.save();
      ctx.font = `italic 900 58px ${FONT.head}`;
      ctx.fillStyle = '#fff4df';
      ctx.textAlign = 'right';
      ctx.fillText(String(ammo.clip), right - 232, 990);
      ctx.font = `700 28px ${FONT.mono}`;
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.textAlign = 'left';
      ctx.fillText(`/ ${ammo.reserve}`, right - 222, 996);
      ctx.restore();
      label(ctx, 'AMMO', right - 22, 992, 18, '#26efd4', 'right', 800, FONT.narrow);
      // Weapon slots.
      let px = right - 22;
      for (let index = game.player.unlocked.length - 1; index >= 0; index -= 1) {
        const id = game.player.unlocked[index];
        const unlocked = WEAPONS[id];
        const active = id === game.player.weapon;
        ctx.fillStyle = active ? 'rgba(38, 239, 212, 0.22)' : 'rgba(255,255,255,0.06)';
        roundRect(ctx, px - 46, 1014, 42, 24, 4);
        ctx.fill();
        label(ctx, unlocked.tag, px - 25, 1027, 16, active ? '#26efd4' : 'rgba(255,255,255,0.42)', 'center', 900, FONT.narrow);
        px -= 50;
      }
    }
  }

  function drawRadio(ctx, game) {
    const radio = RADIO[game.radioIndex ?? 0];
    label(ctx, `${radio.dial} · ${radio.name}`, 1886, 872, 17, 'rgba(255, 220, 180, 0.6)', 'right', 700, FONT.narrow);
    label(ctx, radio.tag.toUpperCase(), 1886, 894, 14, 'rgba(255, 255, 255, 0.36)', 'right', 700, FONT.narrow);
  }

  function drawDialogue(ctx, game) {
    if (!state.dialogue) {
      drawHints(ctx, game);
      return;
    }
    const d = state.dialogue;
    const cast = CAST[d.speaker] ?? CAST.mara;
    const w = 760;
    const h = 122;
    const x = 960 - w / 2;
    const y = 932;
    panel(ctx, x, y, w, h, '#ff8a3d');
    // Portrait.
    const px = x + 62;
    const py = y + 61;
    ctx.save();
    ctx.beginPath();
    ctx.arc(px, py, 40, 0, Math.PI * 2);
    ctx.fillStyle = cast.shirt;
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = cast.skin;
    ctx.beginPath();
    ctx.arc(px, py - 6, 19, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(20, 14, 26, 0.55)';
    ctx.beginPath();
    ctx.ellipse(px, py - 18, 22, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = cast.skin;
    ctx.beginPath();
    ctx.ellipse(px, py + 44, 34, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255, 196, 120, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, 40, 0, Math.PI * 2);
    ctx.stroke();
    label(ctx, cast.name, x + 122, y + 36, 24, '#ffb066', 'left', 900);
    label(ctx, cast.role.toUpperCase(), x + 122 + ctx.measureText(cast.name).width + 60, y + 37, 15, 'rgba(255,255,255,0.45)', 'left', 700, FONT.narrow);
    drawWrapped(ctx, d.text, x + 122, y + 72, w - 150, 27, '#f7f1e6', 2);
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
    const w = hints.length * 152;
    let x = 960 - w / 2;
    const y = 1018;
    ctx.fillStyle = 'rgba(13, 8, 20, 0.66)';
    roundRect(ctx, 960 - w / 2 - 18, y - 24, w + 36, 48, 8);
    ctx.fill();
    for (const [key, action] of hints) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
      roundRect(ctx, x, y - 15, Math.max(38, key.length * 12 + 12), 30, 4);
      ctx.fill();
      label(ctx, key, x + Math.max(38, key.length * 12 + 12) / 2, y, 15, '#ffe8c2', 'center', 800, FONT.narrow);
      label(ctx, action, x + Math.max(38, key.length * 12 + 12) + 8, y, 13, 'rgba(255,255,255,0.5)', 'left', 700, FONT.narrow);
      x += 152;
    }
  }

  function drawPrompt(ctx, game) {
    const job = game.missions.jobs.find((item) => item.prompt);
    if (!job) return;
    const cast = CAST[job.giver];
    const text = `[ E ]  TALK TO ${cast.name}`;
    ctx.save();
    ctx.font = `900 24px ${FONT.head}`;
    const width = ctx.measureText(text).width + 46;
    ctx.fillStyle = 'rgba(13, 8, 20, 0.9)';
    roundRect(ctx, 960 - width / 2, 840, width, 48, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 211, 77, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffd34d';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 960, 865);
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
    const marker = game.missions.markerList()[0];
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
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath();
    ctx.moveTo(26, 0);
    ctx.lineTo(-12, -18);
    ctx.lineTo(-12, 18);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    const dist = Math.round(Math.hypot(marker.x - game.player.x, marker.y - game.player.y) / 8);
    label(ctx, `${dist} m`, x + Math.cos(angle) * 42, y + Math.sin(angle) * 42, 18, '#ffd34d', 'center', 800, FONT.mono);
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
    state, say, toast, banner, showBriefing, hideBriefing, update, draw,
  };
}

const CONFIG_TRAVEL = 1;
