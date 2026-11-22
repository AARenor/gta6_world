// The renderer: a slightly tilted top-down city. Roads are flat, everything with height leans a
// little up the screen (buildings show a lit facade and a rooftop; palms and lamps stand up), so
// the grid reads like a diorama rather than a flat map. On top go the sun's long shadows, a dusk
// tint from gold to indigo, additive pools from every street lamp and neon sign, headlight cones,
// then the cars, the crowd, the player, the police and the effects.

import { CAST, CITY, PALETTE } from './config.js';
import { riseOf } from './city.js';

const RISE_PALM = 0.62;

export function createRenderer(canvas) {
  const camera = { x: CITY.pitch * 4.5, y: CITY.pitch * 4.5, zoom: 1.14, shakeX: 0, shakeY: 0, shake: 0 };
  let viewW = canvas.width;
  let viewH = canvas.height;

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(720, Math.floor(window.innerWidth));
    const h = Math.max(450, Math.floor(window.innerHeight));
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    viewW = w;
    viewH = h;
    void dpr;
  }

  function shake(amount) {
    camera.shake = Math.min(46, camera.shake + amount);
  }

  function follow(game, dt) {
    const player = game.player;
    const car = player.inCar;
    let ax = player.x;
    let ay = player.y;
    if (car) {
      ax += car.vx * 0.34;
      ay += car.vy * 0.34;
    } else {
      ax += player.vx * 0.28;
      ay += player.vy * 0.28;
    }
    const targetX = ax;
    const targetY = ay;
    const k = 1 - Math.exp(-dt * 6.2);
    camera.x += (targetX - camera.x) * k;
    camera.y += (targetY - camera.y) * k;
    camera.shake *= Math.exp(-dt * 5.5);
    if (camera.shake > 0.2) {
      camera.shakeX = (game.rng() - 0.5) * camera.shake;
      camera.shakeY = (game.rng() - 0.5) * camera.shake;
    } else {
      camera.shakeX = 0;
      camera.shakeY = 0;
    }
  }

  function project(x, y) {
    return {
      x: (x - camera.x) * camera.zoom + viewW / 2 + camera.shakeX,
      y: (y - camera.y) * camera.zoom + viewH / 2 + camera.shakeY,
    };
  }

  function screenToWorld(x, y) {
    return {
      x: (x - viewW / 2 - camera.shakeX) / camera.zoom + camera.x,
      y: (y - viewH / 2 - camera.shakeY) / camera.zoom + camera.y,
    };
  }

  function draw(game) {
    const ctx = canvas.getContext('2d');
    viewW = canvas.width;
    viewH = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    drawSea(ctx, game);
    const zoom = camera.zoom;
    const ox = viewW / 2 - camera.x * zoom + camera.shakeX;
    const oy = viewH / 2 - camera.y * zoom + camera.shakeY;
    ctx.setTransform(zoom, 0, 0, zoom, ox, oy);
    const view = {
      x0: camera.x - viewW / 2 / zoom - 80,
      x1: camera.x + viewW / 2 / zoom + 80,
      y0: camera.y - viewH / 2 / zoom - 120,
      y1: camera.y + viewH / 2 / zoom + 120,
    };
    drawGround(ctx, game, view);
    drawMarkersGround(ctx, game, view);
    drawShadows(ctx, game, view);
    drawSprites(ctx, game, view);
    game.effects.drawAbove(ctx);
    drawLights(ctx, game, view);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawDusk(ctx, game);
  }

  function drawSea(ctx, game) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#171225';
    ctx.fillRect(0, 0, viewW, viewH);
    const topLeft = screenToWorld(0, 0);
    const bottomRight = screenToWorld(viewW, viewH);
    const x0 = Math.min(topLeft.x, bottomRight.x);
    const y0 = Math.min(topLeft.y, bottomRight.y);
    const x1 = Math.max(topLeft.x, bottomRight.x);
    const y1 = Math.max(topLeft.y, bottomRight.y);
    const pad = 260;
    if (x0 < -40 || y0 < -40 || x1 > CITY.size + 40 || y1 > CITY.size + 40) {
      const zoom = camera.zoom;
      ctx.setTransform(zoom, 0, 0, zoom, viewW / 2 - camera.x * zoom + camera.shakeX, viewH / 2 - camera.y * zoom + camera.shakeY);
      ctx.fillStyle = '#14647a';
      ctx.fillRect(x0 - pad, y0 - pad, (x1 - x0) + pad * 2, (y1 - y0) + pad * 2);
      const g = ctx.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, 'rgba(38, 180, 186, 0.5)');
      g.addColorStop(1, 'rgba(12, 60, 96, 0.7)');
      ctx.fillStyle = g;
      ctx.fillRect(x0 - pad, y0 - pad, (x1 - x0) + pad * 2, (y1 - y0) + pad * 2);
      ctx.fillStyle = PALETTE.sand;
      ctx.fillRect(-90, -90, CITY.size + 180, CITY.size + 180);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
      for (let k = 0; k < 26; k += 1) {
        const wy = -pad + ((k * 97.3 + game.clock * 8) % (CITY.size + pad * 2));
        ctx.fillRect(x0 - pad, wy, x1 - x0 + pad * 2, 1.4);
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawGround(ctx, game, view) {
    const city = game.city;
    ctx.fillStyle = PALETTE.asphalt;
    ctx.fillRect(-60, -60, CITY.size + 120, CITY.size + 120);
    // A subtle asphalt tone shift per road corridor, so the grid does not look printed.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.018)';
    for (let i = 0; i <= CITY.blocks; i += 1) {
      const x = i * CITY.pitch - CITY.half;
      if (x + CITY.road < view.x0 || x > view.x1) continue;
      ctx.fillRect(x, -60, CITY.road, CITY.size + 120);
    }
    // Blocks: sidewalk apron, then the interior.
    for (const block of city.blocks) {
      if (block.x + block.w < view.x0 || block.x > view.x1 || block.y + block.h < view.y0 || block.y > view.y1) continue;
      drawBlockGround(ctx, block);
    }
    drawRoadMarks(ctx, view);
    // Shoreline promenade around the whole plate.
    ctx.strokeStyle = 'rgba(255, 226, 186, 0.5)';
    ctx.lineWidth = 5;
    ctx.strokeRect(-24, -24, CITY.size + 48, CITY.size + 48);
  }

  function drawBlockGround(ctx, block) {
    const walk = CITY.walk;
    // Sidewalk band.
    ctx.fillStyle = PALETTE.walk;
    ctx.fillRect(block.x - walk, block.y - walk, block.w + walk * 2, block.h + walk * 2);
    ctx.fillStyle = 'rgba(120, 78, 80, 0.28)';
    for (let y = block.y - walk; y < block.y + block.h + walk; y += 34) {
      ctx.fillRect(block.x - walk, y, block.w + walk * 2, 1.4);
    }
    for (let x = block.x - walk; x < block.x + block.w + walk; x += 42) {
      ctx.fillRect(x, block.y - walk, 1.2, block.h + walk * 2);
    }
    // Curb.
    ctx.strokeStyle = PALETTE.curb;
    ctx.lineWidth = 3.5;
    ctx.strokeRect(block.x - walk + 1, block.y - walk + 1, block.w + walk * 2 - 2, block.h + walk * 2 - 2);
    ctx.strokeStyle = 'rgba(90, 48, 60, 0.4)';
    ctx.lineWidth = 1.4;
    ctx.strokeRect(block.x - walk + 4, block.y - walk + 4, block.w + walk * 2 - 8, block.h + walk * 2 - 8);

    // Interior surface.
    if (block.park) {
      ctx.fillStyle = PALETTE.grass;
      ctx.fillRect(block.x, block.y, block.w, block.h);
      ctx.fillStyle = 'rgba(180, 255, 190, 0.06)';
      for (let y = block.y; y < block.y + block.h; y += 16) ctx.fillRect(block.x, y, block.w, 7);
      // Paths.
      ctx.strokeStyle = '#d9b58b';
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(block.x + 10, block.y + block.h - 18);
      ctx.lineTo(block.x + block.w * 0.55, block.y + block.h * 0.5);
      ctx.lineTo(block.x + block.w - 12, block.y + 18);
      ctx.stroke();
    } else if (block.yard) {
      ctx.fillStyle = '#4a3c3a';
      ctx.fillRect(block.x, block.y, block.w, block.h);
      ctx.strokeStyle = 'rgba(180, 180, 190, 0.35)';
      ctx.lineWidth = 1.6;
      for (let k = 0; k < 8; k += 1) {
        ctx.beginPath();
        ctx.moveTo(block.x + 4, block.y + block.h - 4 - k * 14);
        ctx.lineTo(block.x + block.w - 4, block.y + 4 + k * 14);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = block.lot ? PALETTE.lot : '#8d6b72';
      ctx.fillRect(block.x, block.y, block.w, block.h);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
      for (let k = 0; k < 6; k += 1) ctx.fillRect(block.x + 12, block.y + 16 + k * 40, block.w - 24, 12);
    }
    // Parking bays.
    if (block.lot) {
      const lot = block.lot;
      ctx.fillStyle = 'rgba(255, 240, 210, 0.4)';
      for (let x = lot.x + 12; x < lot.x + lot.w - 10; x += 62) {
        ctx.fillRect(x, lot.y + 10, 2, lot.h - 20);
      }
      ctx.fillRect(lot.x + 8, lot.y + 8, lot.w - 16, 2);
    }
    // Pool.
    if (block.pool) {
      const pool = block.pool;
      ctx.fillStyle = '#d8c4b0';
      roundRectLocal(ctx, pool.x - 5, pool.y - 5, pool.w + 10, pool.h + 10, 8);
      ctx.fill();
      const water = ctx.createLinearGradient(pool.x, pool.y, pool.x + pool.w, pool.y + pool.h);
      water.addColorStop(0, '#66e6e0');
      water.addColorStop(1, '#1d9ba8');
      ctx.fillStyle = water;
      roundRectLocal(ctx, pool.x, pool.y, pool.w, pool.h, 6);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1.4;
      for (let k = 0; k < 4; k += 1) {
        ctx.beginPath();
        ctx.arc(pool.x + pool.w * 0.28 + k * 12, pool.y + pool.h * 0.4 + Math.sin(k) * 6, 9 + k * 3, 0.4, 2.4);
        ctx.stroke();
      }
    }
  }

  function roundRectLocal(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawRoadMarks(ctx, view) {
    const half = CITY.half;
    ctx.lineCap = 'butt';
    for (let i = 0; i <= CITY.blocks; i += 1) {
      const x = i * CITY.pitch;
      if (x >= view.x0 && x <= view.x1) drawVerticalMarks(ctx, x, view.y0, view.y1);
      const y = i * CITY.pitch;
      if (y >= view.y0 && y <= view.y1) drawHorizontalMarks(ctx, y, view.x0, view.x1);
    }
    // Intersections: crosswalks and stop bars.
    const i0 = Math.max(0, Math.floor(view.x0 / CITY.pitch));
    const i1 = Math.min(CITY.blocks, Math.ceil(view.x1 / CITY.pitch));
    const j0 = Math.max(0, Math.floor(view.y0 / CITY.pitch));
    const j1 = Math.min(CITY.blocks, Math.ceil(view.y1 / CITY.pitch));
    for (let j = j0; j <= j1; j += 1) {
      for (let i = i0; i <= i1; i += 1) {
        drawCrosswalks(ctx, i * CITY.pitch, j * CITY.pitch);
      }
    }
    void half;
  }

  function drawHorizontalMarks(ctx, y, y0, y1) {
    const x0 = Math.max(0, y0);
    const x1 = Math.min(CITY.size, y1);
    // Centre double yellow.
    ctx.fillStyle = 'rgba(255, 196, 81, 0.6)';
    ctx.fillRect(x0, y - 4.5, x1 - x0, 2.2);
    ctx.fillRect(x0, y + 2.1, x1 - x0, 2.2);
    // Lane dashes.
    ctx.fillStyle = 'rgba(255, 240, 214, 0.36)';
    for (let x = Math.floor(x0 / 52) * 52; x < x1; x += 52) {
      if (isInJunction(x, y)) continue;
      ctx.fillRect(x, y - 28.6, 22, 1.8);
      ctx.fillRect(x, y + 26.6, 22, 1.8);
    }
    // Curb lines.
    ctx.fillStyle = 'rgba(255, 240, 214, 0.2)';
    ctx.fillRect(x0, y - 52, x1 - x0, 1.6);
    ctx.fillRect(x0, y + 50, x1 - x0, 1.6);
    // Worn tyre tracks in each lane.
    ctx.fillStyle = 'rgba(12, 8, 18, 0.09)';
    for (const lane of [-43, -15, 15, 43]) {
      ctx.fillRect(x0, y + lane - 7, x1 - x0, 5);
      ctx.fillRect(x0, y + lane + 4, x1 - x0, 5);
    }
  }

  function drawVerticalMarks(ctx, x, y0, y1) {
    const a = Math.max(0, y0);
    const b = Math.min(CITY.size, y1);
    ctx.fillStyle = 'rgba(255, 196, 81, 0.6)';
    ctx.fillRect(x - 4.5, a, 2.2, b - a);
    ctx.fillRect(x + 2.1, a, 2.2, b - a);
    ctx.fillStyle = 'rgba(255, 240, 214, 0.36)';
    for (let y = Math.floor(a / 52) * 52; y < b; y += 52) {
      if (isInJunction(x, y)) continue;
      ctx.fillRect(x - 28.6, y, 1.8, 22);
      ctx.fillRect(x + 26.6, y, 1.8, 22);
    }
    ctx.fillStyle = 'rgba(255, 240, 214, 0.2)';
    ctx.fillRect(x - 52, a, 1.6, b - a);
    ctx.fillRect(x + 50, a, 1.6, b - a);
    ctx.fillStyle = 'rgba(12, 8, 18, 0.09)';
    for (const lane of [-43, -15, 15, 43]) {
      ctx.fillRect(x + lane - 7, a, 5, b - a);
      ctx.fillRect(x + lane + 4, a, 5, b - a);
    }
  }

  function isInJunction(x, y) {
    const dx = Math.abs(x - Math.round(x / CITY.pitch) * CITY.pitch);
    const dy = Math.abs(y - Math.round(y / CITY.pitch) * CITY.pitch);
    return dx < CITY.half + 12 && dy < CITY.half + 12;
  }

  function drawCrosswalks(ctx, x, y) {
    const h = CITY.half;
    ctx.fillStyle = 'rgba(255, 246, 228, 0.68)';
    // North and south crossings (stripes run east-west).
    for (let k = 0; k < 6; k += 1) {
      const sx = x - 44 + k * 16;
      ctx.fillRect(sx, y - h - 22, 9, 15);
      ctx.fillRect(sx, y + h + 7, 9, 15);
    }
    // East and west crossings.
    for (let k = 0; k < 6; k += 1) {
      const sy = y - 44 + k * 16;
      ctx.fillRect(x - h - 22, sy, 15, 9);
      ctx.fillRect(x + h + 7, sy, 15, 9);
    }
    // Stop bars.
    ctx.fillStyle = 'rgba(255, 246, 228, 0.8)';
    ctx.fillRect(x - h, y + h + 30, h - 6, 6);
    ctx.fillRect(x + 6, y - h - 36, h - 6, 6);
    ctx.fillRect(x + h + 30, y - h, 6, h - 6);
    ctx.fillRect(x - h - 36, y + 6, 6, h - 6);
  }

  function drawMarkersGround(ctx, game, view) {
    const markerColor = (kind) => (kind === 'target' ? '#ff4d5e' : kind === 'deliver' ? '#26efd4' : '#ffd34d');
    for (const marker of game.missions.markerList()) {
      if (marker.x < view.x0 || marker.x > view.x1 || marker.y < view.y0 || marker.y > view.y1) continue;
      const color = markerColor(marker.kind);
      const pulse = 0.7 + Math.sin((game.clock ?? 0) * 3.2) * 0.2;
      const r = marker.radius ?? 34;
      ctx.save();
      const g = ctx.createRadialGradient(marker.x, marker.y, 2, marker.x, marker.y, r);
      g.addColorStop(0, hexToRgba(color, 0.28));
      g.addColorStop(0.75, hexToRgba(color, 0.1));
      g.addColorStop(1, hexToRgba(color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(marker.x, marker.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(color, pulse);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(marker.x, marker.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([10, 12]);
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = hexToRgba(color, 0.8);
      ctx.beginPath();
      ctx.arc(marker.x, marker.y, r - 8, (game.clock ?? 0) * 0.8, (game.clock ?? 0) * 0.8 + Math.PI * 1.6);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
    for (const pickup of game.city.pickups) {
      if (pickup.taken > 0) continue;
      if (pickup.x < view.x0 - 40 || pickup.x > view.x1 + 40 || pickup.y < view.y0 - 40 || pickup.y > view.y1 + 40) continue;
      const color = pickup.kind === 'health' ? '#54e08a' : pickup.kind === 'armour' ? '#59b8ff' : '#ffcf5c';
      ctx.save();
      const g = ctx.createRadialGradient(pickup.x, pickup.y, 2, pickup.x, pickup.y, 34);
      g.addColorStop(0, hexToRgba(color, 0.34));
      g.addColorStop(1, hexToRgba(color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(pickup.x, pickup.y, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(14, 9, 20, 0.86)';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(pickup.x, pickup.y, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = color;
      if (pickup.kind === 'health') {
        ctx.fillRect(pickup.x - 6, pickup.y - 2.2, 12, 4.4);
        ctx.fillRect(pickup.x - 2.2, pickup.y - 6, 4.4, 12);
      } else if (pickup.kind === 'armour') {
        ctx.beginPath();
        ctx.moveTo(pickup.x, pickup.y - 7);
        ctx.lineTo(pickup.x + 6, pickup.y - 3);
        ctx.lineTo(pickup.x + 4, pickup.y + 6);
        ctx.lineTo(pickup.x, pickup.y + 8);
        ctx.lineTo(pickup.x - 4, pickup.y + 6);
        ctx.lineTo(pickup.x - 6, pickup.y - 3);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillRect(pickup.x - 6, pickup.y - 5, 12, 10);
        ctx.fillStyle = '#2b2130';
        ctx.fillRect(pickup.x - 4, pickup.y - 3, 8, 2);
      }
      ctx.restore();
    }
  }

  function drawShadows(ctx, game, view) {
    const city = game.city;
    ctx.save();
    ctx.fillStyle = 'rgba(24, 12, 34, 0.34)';
    for (const block of city.blocks) {
      if (block.x + block.w < view.x0 || block.x > view.x1 || block.y + block.h < view.y0 || block.y > view.y1) continue;
      for (const building of block.buildings) {
        const rise = riseOf(building.z);
        const ox = rise * 1.55;
        const oy = rise * 0.55;
        ctx.beginPath();
        ctx.moveTo(building.x, building.y + building.h);
        ctx.lineTo(building.x + building.w, building.y + building.h);
        ctx.lineTo(building.x + building.w + ox, building.y + building.h + oy);
        ctx.lineTo(building.x + ox, building.y + building.h + oy);
        ctx.closePath();
        ctx.fill();
        ctx.fillRect(building.x + ox * 0.55, building.y + oy * 0.4, building.w, building.h);
      }
    }
    for (const palm of city.palms) {
      if (palm.x < view.x0 || palm.x > view.x1 || palm.y < view.y0 || palm.y > view.y1) continue;
      ctx.beginPath();
      ctx.ellipse(palm.x + 10, palm.y + 6, 18, 7, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const vehicle of game.vehicles) {
      if (vehicle.x < view.x0 || vehicle.x > view.x1 || vehicle.y < view.y0 || vehicle.y > view.y1) continue;
      ctx.save();
      ctx.translate(vehicle.x + 5, vehicle.y + 7);
      ctx.rotate(vehicle.angle);
      ctx.beginPath();
      ctx.ellipse(0, 0, vehicle.length * 0.54, vehicle.width * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    for (const ped of game.peds.peds) {
      if (ped.x < view.x0 || ped.x > view.x1 || ped.y < view.y0 || ped.y > view.y1) continue;
      ctx.globalAlpha = ped.state === 'down' ? 0.4 : 0.8;
      ctx.beginPath();
      ctx.ellipse(ped.x + 3, ped.y + 4, 8, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawSprites(ctx, game, view) {
    const city = game.city;
    const items = [];
    for (const block of city.blocks) {
      if (block.x + block.w + 60 < view.x0 || block.x - 60 > view.x1 || block.y + block.h < view.y0 || block.y > view.y1) continue;
      for (const building of block.buildings) {
        if (building.x > view.x1 || building.x + building.w < view.x0 || building.y > view.y1 || building.y + building.h < view.y0) continue;
        items.push({ sort: building.y + building.h, kind: 0, ref: building });
      }
    }
    for (const prop of city.props) {
      if (prop.x < view.x0 || prop.x > view.x1 || prop.y < view.y0 || prop.y > view.y1) continue;
      items.push({ sort: prop.y, kind: 2, ref: prop });
    }
    for (const palm of city.palms) {
      if (palm.x < view.x0 || palm.x > view.x1 || palm.y < view.y0 || palm.y > view.y1) continue;
      items.push({ sort: palm.y, kind: 1, ref: palm });
    }
    for (const lamp of city.lamps) {
      if (lamp.x < view.x0 || lamp.x > view.x1 || lamp.y < view.y0 || lamp.y > view.y1) continue;
      items.push({ sort: lamp.y, kind: 3, ref: lamp });
    }
    for (const billboard of city.billboards) {
      if (billboard.x < view.x0 - 90 || billboard.x > view.x1 + 90 || billboard.y < view.y0 - 10 || billboard.y > view.y1 + 120) continue;
      items.push({ sort: billboard.y, kind: 7, ref: billboard });
    }
    for (const vehicle of game.vehicles) {
      if (vehicle.x < view.x0 - 60 || vehicle.x > view.x1 + 60 || vehicle.y < view.y0 - 60 || vehicle.y > view.y1 + 60) continue;
      items.push({ sort: vehicle.y + 4, kind: 4, ref: vehicle });
    }
    for (const ped of game.peds.peds) {
      if (ped.x < view.x0 || ped.x > view.x1 || ped.y < view.y0 || ped.y > view.y1) continue;
      items.push({ sort: ped.y, kind: 5, ref: ped });
    }
    if (!game.player.inCar) items.push({ sort: game.player.y, kind: 6, ref: game.player });
    items.sort((a, b) => a.sort - b.sort);
    for (const item of items) {
      switch (item.kind) {
        case 0: drawBuilding(ctx, item.ref, game); break;
        case 1: drawPalm(ctx, item.ref, game); break;
        case 2: drawProp(ctx, item.ref); break;
        case 3: drawLamp(ctx, item.ref); break;
        case 4: drawVehicle(ctx, item.ref, game); break;
        case 5: drawPed(ctx, item.ref); break;
        case 6: drawPlayer(ctx, item.ref); break;
        case 7: drawBillboard(ctx, item.ref); break;
        default: break;
      }
    }
    drawTrafficLights(ctx, game, view);
    if (game.police?.chopper) drawChopper(ctx, game.police.chopper, game);
  }

  function drawBuilding(ctx, b, game) {
    const rise = riseOf(b.z);
    // South facade.
    const facadeTop = b.y + b.h - rise;
    const gradient = ctx.createLinearGradient(0, facadeTop, 0, b.y + b.h);
    gradient.addColorStop(0, b.wall);
    gradient.addColorStop(1, b.side);
    ctx.fillStyle = gradient;
    ctx.fillRect(b.x, facadeTop, b.w, rise);
    // Windows in the facade band.
    const rows = b.rows;
    const cellH = Math.max(4, rise / Math.max(1, rows));
    for (const win of b.windows) {
      const wx = b.x + 6 + win.col * ((b.w - 12) / b.cols) + 2;
      const wy = facadeTop + 3 + win.row * cellH;
      const ww = Math.max(3, (b.w - 12) / b.cols - 6);
      const wh = Math.max(2.5, cellH - 4);
      ctx.fillStyle = win.warm ? (b.style === 'shop' ? 'rgba(255, 228, 170, 0.95)' : PALETTE.windowLit) : 'rgba(35, 30, 48, 0.85)';
      ctx.fillRect(wx, wy, ww, wh);
      if (win.warm) {
        ctx.fillStyle = 'rgba(255, 240, 200, 0.22)';
        ctx.fillRect(wx - 1, wy - 1, ww + 2, wh + 2);
        ctx.fillStyle = win.warm ? PALETTE.windowLit : PALETTE.windowDark;
        ctx.fillRect(wx, wy, ww, wh);
      }
    }
    if (b.awning) {
      ctx.fillStyle = b.awning;
      ctx.fillRect(b.x + 4, b.y + b.h - 3, b.w - 8, 7);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      for (let x = b.x + 8; x < b.x + b.w - 8; x += 14) ctx.fillRect(x, b.y + b.h - 3, 6, 7);
    }
    // Roof.
    const roofY = b.y - rise;
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x, roofY, b.w, b.h);
    // Tar seams and a lighter top-left catch light.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
    for (let x = b.x + 6; x < b.x + b.w - 4; x += 18) ctx.fillRect(x, roofY + 4, 1, b.h - 8);
    for (let y = roofY + 6; y < roofY + b.h - 4; y += 22) ctx.fillRect(b.x + 4, y, b.w - 8, 1);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.fillRect(b.x, roofY, b.w, 3);
    if (b.parapet) {
      ctx.strokeStyle = b.parapet;
      ctx.lineWidth = 6;
      ctx.strokeRect(b.x + 3, roofY + 3, b.w - 6, b.h - 6);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(b.x + 5, roofY + 5, b.w - 10, b.h - 10);
    }
    ctx.strokeStyle = 'rgba(18, 10, 28, 0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, roofY, b.w, b.h);
    // Roof pool and helipad first, then the machinery on top.
    if (b.roofPool) {
      const pool = b.roofPool;
      ctx.fillStyle = '#e8d4c4';
      ctx.fillRect(b.x + pool.x - 3, roofY + pool.y - 3, pool.w + 6, pool.h + 6);
      const water = ctx.createLinearGradient(b.x + pool.x, roofY + pool.y, b.x + pool.x + pool.w, roofY + pool.y + pool.h);
      water.addColorStop(0, '#7af0e8');
      water.addColorStop(1, '#1d9ba8');
      ctx.fillStyle = water;
      ctx.fillRect(b.x + pool.x, roofY + pool.y, pool.w, pool.h);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1.2;
      for (let k = 0; k < 3; k += 1) {
        ctx.beginPath();
        ctx.arc(b.x + pool.x + 10 + k * 12, roofY + pool.y + pool.h * 0.45, 6 + k * 2, 0.5, 2.6);
        ctx.stroke();
      }
    }
    if (b.helipad) {
      const cx = b.x + b.w * 0.52;
      const cy = roofY + b.h * 0.5;
      ctx.strokeStyle = 'rgba(255, 246, 220, 0.55)';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(cx, cy, b.h * 0.24, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 246, 220, 0.55)';
      ctx.font = `900 ${Math.round(b.h * 0.2)}px "Montserrat", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('H', cx, cy);
    }
    // Roof details.
    for (const ac of b.acs) {
      ctx.fillStyle = 'rgba(30, 24, 40, 0.4)';
      ctx.fillRect(b.x + ac.x + 4, roofY + ac.y + 5, ac.w, ac.h);
      ctx.fillStyle = '#cfc4cf';
      ctx.fillRect(b.x + ac.x, roofY + ac.y, ac.w, ac.h);
      ctx.fillStyle = '#9a8e9f';
      ctx.fillRect(b.x + ac.x + 2, roofY + ac.y + 2, ac.w - 4, ac.h - 4);
      ctx.fillStyle = '#6f6475';
      ctx.beginPath();
      ctx.arc(b.x + ac.x + ac.w / 2, roofY + ac.y + ac.h / 2, Math.min(ac.w, ac.h) * 0.34, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(240, 234, 240, 0.6)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(b.x + ac.x + ac.w / 2, roofY + ac.y + ac.h / 2, Math.min(ac.w, ac.h) * 0.34, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (b.solar) {
      const panel = b.solar;
      ctx.fillStyle = 'rgba(20, 20, 40, 0.5)';
      ctx.fillRect(b.x + panel.x + 3, roofY + panel.y + 4, panel.w, panel.h);
      ctx.fillStyle = '#2c4a6e';
      ctx.fillRect(b.x + panel.x, roofY + panel.y, panel.w, panel.h);
      ctx.strokeStyle = 'rgba(150, 220, 255, 0.35)';
      ctx.lineWidth = 1;
      for (let k = 1; k < 3; k += 1) {
        ctx.beginPath();
        ctx.moveTo(b.x + panel.x + (panel.w / 3) * k, roofY + panel.y);
        ctx.lineTo(b.x + panel.x + (panel.w / 3) * k, roofY + panel.y + panel.h);
        ctx.moveTo(b.x + panel.x, roofY + panel.y + (panel.h / 2) * k);
        ctx.lineTo(b.x + panel.x + panel.w, roofY + panel.y + (panel.h / 2) * k);
        ctx.stroke();
      }
    }
    for (const sky of b.skylights) {
      ctx.fillStyle = 'rgba(255, 220, 150, 0.14)';
      ctx.fillRect(b.x + sky.x - 2, roofY + sky.y - 2, sky.w + 4, sky.h + 4);
      ctx.fillStyle = 'rgba(255, 226, 160, 0.6)';
      ctx.fillRect(b.x + sky.x, roofY + sky.y, sky.w, sky.h);
      ctx.strokeStyle = 'rgba(60, 46, 58, 0.8)';
      ctx.lineWidth = 1.4;
      ctx.strokeRect(b.x + sky.x, roofY + sky.y, sky.w, sky.h);
      ctx.beginPath();
      ctx.moveTo(b.x + sky.x + sky.w / 2, roofY + sky.y);
      ctx.lineTo(b.x + sky.x + sky.w / 2, roofY + sky.y + sky.h);
      ctx.stroke();
    }
    for (const vent of b.vents) {
      ctx.fillStyle = '#9d94a7';
      ctx.beginPath();
      ctx.arc(b.x + vent.x, roofY + vent.y, vent.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4a4052';
      ctx.beginPath();
      ctx.arc(b.x + vent.x, roofY + vent.y, vent.r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const tank of b.tanks) {
      ctx.fillStyle = 'rgba(24, 14, 30, 0.35)';
      ctx.beginPath();
      ctx.arc(b.x + tank.x + 3, roofY + tank.y + 4, tank.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7a5b4a';
      ctx.beginPath();
      ctx.arc(b.x + tank.x, roofY + tank.y, tank.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#5a4034';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.beginPath();
      ctx.arc(b.x + tank.x - tank.r * 0.3, roofY + tank.y - tank.r * 0.3, tank.r * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
    if (b.edgeLights) {
      const phase = (game.clock * 1.4 + b.x * 0.01) % 4;
      ctx.fillStyle = phase < 2 ? '#ffd34d' : '#ff6a7a';
      for (let x = b.x + 8; x < b.x + b.w - 6; x += 24) {
        ctx.fillRect(x, roofY + 1, 3, 3);
      }
    }
    if (b.antenna) {
      ctx.strokeStyle = '#3a3246';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b.x + b.w * 0.5, roofY + b.h * 0.5);
      ctx.lineTo(b.x + b.w * 0.5 - rise * 0.7, roofY + b.h * 0.5 - 34);
      ctx.stroke();
      ctx.fillStyle = '#ff4d5e';
      ctx.beginPath();
      ctx.arc(b.x + b.w * 0.5 - rise * 0.7, roofY + b.h * 0.5 - 34, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (b.sign) drawNeonSign(ctx, b, rise, roofY, game);
  }

  function drawNeonSign(ctx, b, rise, roofY, game) {
    const sign = b.sign;
    const x = sign.x;
    const y = roofY + (sign.y - b.y) * 0.4 + 16;
    ctx.save();
    ctx.font = `900 ${sign.size}px "Montserrat", sans-serif`;
    const width = ctx.measureText(sign.text).width;
    // Steel frame and dark board.
    ctx.fillStyle = 'rgba(20, 12, 28, 0.9)';
    ctx.fillRect(x - 10, y - sign.size * 0.85, width + 20, sign.size * 1.32);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 10, y - sign.size * 0.85, width + 20, sign.size * 1.32);
    ctx.strokeStyle = '#2a2134';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 6, y + sign.size * 0.47);
    ctx.lineTo(x + 6, y + sign.size * 0.47 + 14);
    ctx.moveTo(x + width - 6, y + sign.size * 0.47);
    ctx.lineTo(x + width - 6, y + sign.size * 0.47 + 14);
    ctx.stroke();
    // Neon text, with a hot core and a soft halo painted by the light pass.
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = sign.color;
    ctx.fillText(sign.text, x - 2, y + 2);
    ctx.fillText(sign.text, x + 2, y - 2);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff8ef';
    ctx.fillText(sign.text, x, y);
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = sign.color;
    ctx.fillText(sign.text, x, y);
    ctx.restore();
    void game;
    void rise;
  }

  function drawPalm(ctx, palm, game) {
    const rise = palm.h * RISE_PALM;
    const topX = palm.x + palm.lean * rise;
    const topY = palm.y - rise;
    ctx.strokeStyle = '#6b4a3a';
    ctx.lineWidth = 4.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(palm.x, palm.y);
    ctx.quadraticCurveTo(palm.x + palm.lean * rise * 0.4, palm.y - rise * 0.6, topX, topY);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 220, 180, 0.3)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(palm.x - 1, palm.y);
    ctx.quadraticCurveTo(palm.x + palm.lean * rise * 0.4 - 1, palm.y - rise * 0.6, topX - 1, topY);
    ctx.stroke();
    const sway = Math.sin((game.clock ?? 0) * 0.8 + palm.phase) * 0.05;
    for (let k = 0; k < 8; k += 1) {
      const a = (k / 8) * Math.PI * 2 + sway;
      const len = 16 + (k % 2) * 5;
      const midX = topX + Math.cos(a) * len * 0.65;
      const midY = topY + Math.sin(a) * len * 0.65 - 4;
      const endX = topX + Math.cos(a) * len;
      const endY = topY + Math.sin(a) * len + 5;
      ctx.strokeStyle = k % 2 === 0 ? '#2f8f60' : '#3fae74';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.quadraticCurveTo(midX, midY - 4, endX, endY);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(180, 255, 200, 0.18)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    ctx.fillStyle = '#5b3f31';
    ctx.beginPath();
    ctx.arc(topX, topY, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBillboard(ctx, board) {
    const topY = board.y - board.h - 20;
    // Support legs.
    ctx.strokeStyle = '#2a2134';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(board.x - board.w * 0.3, board.y);
    ctx.lineTo(board.x - board.w * 0.3, topY + board.h);
    ctx.moveTo(board.x + board.w * 0.3, board.y);
    ctx.lineTo(board.x + board.w * 0.3, topY + board.h);
    ctx.stroke();
    // Frame and dark face.
    ctx.fillStyle = 'rgba(14, 9, 22, 0.55)';
    ctx.fillRect(board.x - board.w / 2 + 7, topY + 9, board.w, board.h);
    ctx.fillStyle = '#120c1c';
    ctx.fillRect(board.x - board.w / 2, topY, board.w, board.h);
    ctx.strokeStyle = board.color;
    ctx.lineWidth = 3;
    ctx.strokeRect(board.x - board.w / 2, topY, board.w, board.h);
    // Text, shrunk until it fits.
    let size = Math.floor(board.h * 0.62);
    ctx.font = `900 ${size}px "Montserrat", sans-serif`;
    let width = ctx.measureText(board.text).width;
    while (width > board.w - 18 && size > 9) {
      size -= 1;
      ctx.font = `900 ${size}px "Montserrat", sans-serif`;
      width = ctx.measureText(board.text).width;
    }
    ctx.save();
    ctx.shadowColor = board.color;
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#fff7e9';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(board.text, board.x, topY + board.h * 0.53);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = board.color;
    ctx.fillText(board.text, board.x, topY + board.h * 0.53);
    ctx.restore();
  }

  function drawLamp(ctx, lamp) {
    const rise = lamp.h;
    const topX = lamp.x + Math.cos(lamp.angle) * 8;
    const topY = lamp.y + Math.sin(lamp.angle) * 8 - rise;
    ctx.strokeStyle = '#2e2838';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(lamp.x, lamp.y);
    ctx.lineTo(topX, topY + 4);
    ctx.stroke();
    ctx.fillStyle = '#2e2838';
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe0a8';
    ctx.beginPath();
    ctx.arc(topX, topY, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 190, 110, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(topX, topY, 7, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawProp(ctx, prop) {
    switch (prop.kind) {
      case 'bin':
        ctx.fillStyle = '#38404a';
        ctx.fillRect(prop.x - 5, prop.y - 6, 10, 12);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
        ctx.fillRect(prop.x - 5, prop.y - 6, 10, 2);
        break;
      case 'hydrant':
        ctx.fillStyle = '#c4353f';
        ctx.fillRect(prop.x - 3, prop.y - 5, 6, 10);
        ctx.fillRect(prop.x - 6, prop.y - 2, 12, 4);
        break;
      case 'bench':
        ctx.fillStyle = '#7a5438';
        ctx.fillRect(prop.x - 14, prop.y - 3, 28, 6);
        ctx.fillStyle = '#4a3324';
        ctx.fillRect(prop.x - 12, prop.y + 3, 3, 4);
        ctx.fillRect(prop.x + 9, prop.y + 3, 3, 4);
        break;
      case 'planter':
        ctx.fillStyle = '#8a5f4c';
        ctx.beginPath();
        ctx.arc(prop.x, prop.y, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3fae74';
        ctx.beginPath();
        ctx.arc(prop.x, prop.y - 3, 7, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'newsbox':
        ctx.fillStyle = '#2f6f8f';
        ctx.fillRect(prop.x - 5, prop.y - 7, 10, 13);
        ctx.fillStyle = '#cbd6d9';
        ctx.fillRect(prop.x - 3, prop.y - 5, 6, 5);
        break;
      case 'stall':
        ctx.fillStyle = 'rgba(30, 20, 36, 0.4)';
        ctx.fillRect(prop.x - 20, prop.y - 10, 44, 26);
        ctx.fillStyle = prop.color;
        ctx.fillRect(prop.x - 20, prop.y - 14, 40, 18);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        for (let k = 0; k < 4; k += 1) ctx.fillRect(prop.x - 18 + k * 10, prop.y - 14, 5, 18);
        break;
      case 'container':
        ctx.fillStyle = prop.color;
        ctx.fillRect(prop.x - 22, prop.y - 12, 44, 24);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
        for (let k = 0; k < 6; k += 1) ctx.fillRect(prop.x - 20 + k * 7, prop.y - 10, 2, 20);
        break;
      case 'crate':
        ctx.fillStyle = '#9b7448';
        ctx.fillRect(prop.x - 9, prop.y - 9, 18, 18);
        ctx.strokeStyle = 'rgba(60, 40, 20, 0.5)';
        ctx.strokeRect(prop.x - 9, prop.y - 9, 18, 18);
        break;
      case 'fountain':
        ctx.fillStyle = '#cbbeb0';
        ctx.beginPath();
        ctx.arc(prop.x, prop.y, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#43c8cd';
        ctx.beginPath();
        ctx.arc(prop.x, prop.y, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(prop.x, prop.y, 7, 0, Math.PI * 2);
        ctx.stroke();
        break;
      default:
        break;
    }
  }

  function drawVehicle(ctx, v, game) {
    ctx.save();
    ctx.translate(v.x, v.y);
    if (v.driver === 'player') {
      const halo = ctx.createRadialGradient(0, 0, 2, 0, 0, 58);
      halo.addColorStop(0, 'rgba(255, 226, 170, 0.16)');
      halo.addColorStop(0.6, 'rgba(255, 200, 130, 0.06)');
      halo.addColorStop(1, 'rgba(255, 200, 130, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(0, 0, 58, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.rotate(v.angle);
    const len = v.length;
    const wid = v.width;
    // Wheels.
    ctx.fillStyle = '#141019';
    const wheelW = 7;
    const wheelH = 5;
    ctx.fillRect(-len * 0.32, -wid * 0.5 - 1, wheelW, wheelH);
    ctx.fillRect(len * 0.22, -wid * 0.5 - 1, wheelW, wheelH);
    ctx.fillRect(-len * 0.32, wid * 0.5 - wheelH + 1, wheelW, wheelH);
    ctx.fillRect(len * 0.22, wid * 0.5 - wheelH + 1, wheelW, wheelH);
    // Body: a dark base, then the painted shell with a light roof.
    ctx.fillStyle = 'rgba(16, 10, 24, 0.9)';
    roundRectLocal(ctx, -len * 0.52, -wid * 0.54, len * 1.04, wid * 1.08, 6);
    ctx.fill();
    const shell = ctx.createLinearGradient(0, -wid * 0.5, 0, wid * 0.5);
    shell.addColorStop(0, v.wrecked ? '#3a3240' : shadeHexLocal(v.color, 0.16));
    shell.addColorStop(0.55, v.wrecked ? '#2b2530' : v.color);
    shell.addColorStop(1, v.wrecked ? '#1d1822' : shadeHexLocal(v.color, -0.3));
    ctx.fillStyle = shell;
    roundRectLocal(ctx, -len * 0.5, -wid * 0.5, len, wid, 5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(12, 8, 18, 0.7)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    if (v.driver === 'player' && !v.wrecked) {
      ctx.strokeStyle = 'rgba(255, 248, 228, 0.9)';
      ctx.lineWidth = 2.2;
      roundRectLocal(ctx, -len * 0.5, -wid * 0.5, len, wid, 5);
      ctx.stroke();
    }
    if (!v.wrecked) {
      // Cabin and glass.
      ctx.fillStyle = v.trim;
      roundRectLocal(ctx, -len * 0.16, -wid * 0.42, len * 0.42, wid * 0.84, 3);
      ctx.fill();
      ctx.fillStyle = v.glass;
      roundRectLocal(ctx, -len * 0.1, -wid * 0.34, len * 0.26, wid * 0.68, 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(160, 220, 255, 0.2)';
      roundRectLocal(ctx, -len * 0.07, -wid * 0.3, len * 0.09, wid * 0.6, 2);
      ctx.fill();
      // Bonnet stripe.
      ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.fillRect(len * 0.18, -wid * 0.08, len * 0.24, wid * 0.16);
      if (v.type === 'taxi') {
        ctx.fillStyle = '#1b1520';
        for (let k = 0; k < 5; k += 1) ctx.fillRect(-len * 0.3 + k * 9, -wid * 0.5 + 3, 5, 3);
        ctx.fillStyle = '#ffe9a8';
        ctx.fillRect(-len * 0.05, -wid * 0.18, 9, 7);
      }
      if (v.type === 'police') {
        ctx.fillStyle = '#181420';
        roundRectLocal(ctx, -len * 0.2, -wid * 0.44, len * 0.3, wid * 0.88, 2);
        ctx.fill();
        // Lightbar.
        const redOn = Math.sin((game.clock * 12 + v.id) % (Math.PI * 2)) > 0;
        ctx.fillStyle = redOn ? '#ff3355' : '#6d1b2a';
        ctx.fillRect(-len * 0.04, -wid * 0.56, len * 0.14, wid * 0.34);
        ctx.fillStyle = redOn ? '#2b3f7a' : '#3d7bff';
        ctx.fillRect(-len * 0.04, wid * 0.22, len * 0.14, wid * 0.34);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.fillRect(-len * 0.04, -wid * 0.56, len * 0.14, 1.4);
      }
      // Headlights and tail lights.
      ctx.fillStyle = '#fff4cf';
      ctx.fillRect(len * 0.46, -wid * 0.36, 3, 4);
      ctx.fillRect(len * 0.46, wid * 0.36 - 4, 3, 4);
      ctx.fillStyle = v.braking ? '#ff3d4e' : '#a8323f';
      ctx.fillRect(-len * 0.5 - 1, -wid * 0.36, 2.4, 4);
      ctx.fillRect(-len * 0.5 - 1, wid * 0.36 - 4, 2.4, 4);
      // Indicators.
      if (v.indicator && v.indicatorOn) {
        ctx.fillStyle = '#ffb347';
        const side = v.indicator > 0 ? -1 : 1;
        ctx.fillRect(len * 0.4, side * wid * 0.42 - 2, 4, 4);
        ctx.fillRect(-len * 0.44, side * wid * 0.42 - 2, 4, 4);
      }
    } else {
      ctx.fillStyle = 'rgba(10, 6, 14, 0.6)';
      roundRectLocal(ctx, -len * 0.16, -wid * 0.3, len * 0.3, wid * 0.6, 3);
      ctx.fill();
    }
    ctx.restore();
    if (v.burning > 0) {
      const t = game.clock;
      const glow = ctx.createRadialGradient(v.x, v.y - 8, 2, v.x, v.y - 8, 48);
      glow.addColorStop(0, 'rgba(255, 156, 64, 0.5)');
      glow.addColorStop(0.5, 'rgba(255, 92, 30, 0.2)');
      glow.addColorStop(1, 'rgba(255, 80, 20, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(v.x, v.y - 8, 48, 0, Math.PI * 2);
      ctx.fill();
      for (let k = 0; k < 3; k += 1) {
        const ox = Math.sin(t * 9 + k * 2.1) * 7;
        const h = 11 + Math.sin(t * 13 + k) * 4;
        ctx.fillStyle = k === 1 ? 'rgba(255, 226, 130, 0.9)' : 'rgba(255, 120, 40, 0.8)';
        ctx.beginPath();
        ctx.ellipse(v.x + ox, v.y - 10 - k * 3, 6 + k, h, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(44, 32, 44, 0.32)';
      ctx.beginPath();
      ctx.arc(v.x + Math.sin(t * 2) * 8, v.y - 26 - Math.sin(t * 3) * 4, 12, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPed(ctx, ped) {
    const down = ped.state === 'down';
    ctx.save();
    ctx.translate(ped.x, ped.y);
    ctx.rotate(ped.angle);
    ctx.globalAlpha = ped.fade ?? 1;
    if (down) {
      ctx.fillStyle = ped.shirt;
      ctx.beginPath();
      ctx.ellipse(0, 0, 10, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ped.skin;
      ctx.beginPath();
      ctx.arc(-8, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    const moving = ped.state === 'walk' || ped.state === 'flee' || ped.state === 'cross';
    const swing = moving ? Math.sin(ped.walk * 3.2) * 3.4 : 0;
    ctx.scale(1.16, 1.16);
    // Legs.
    ctx.strokeStyle = ped.pants;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-1, -3);
    ctx.lineTo(-2 + swing, -7);
    ctx.moveTo(-1, 3);
    ctx.lineTo(-2 - swing, 7);
    ctx.stroke();
    // Torso.
    ctx.fillStyle = 'rgba(16, 10, 22, 0.65)';
    roundRectLocal(ctx, -4.8, -5.2, 10.6, 10.4, 3.4);
    ctx.fill();
    ctx.fillStyle = ped.shirt;
    roundRectLocal(ctx, -4, -4.4, 9, 8.8, 3);
    ctx.fill();
    // Arms (up and out when running).
    ctx.strokeStyle = ped.skin;
    ctx.lineWidth = 2.2;
    if (ped.state === 'flee') {
      ctx.beginPath();
      ctx.moveTo(1, -4);
      ctx.lineTo(5, -9);
      ctx.moveTo(1, 4);
      ctx.lineTo(5, 9);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(1, -4);
      ctx.lineTo(4, -4.5 + swing * 0.4);
      ctx.moveTo(1, 4);
      ctx.lineTo(4, 4.5 - swing * 0.4);
      ctx.stroke();
    }
    // Head.
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(2.4, 0, 3.4, 0, Math.PI * 2);
    ctx.fill();
    if (ped.hat) {
      ctx.fillStyle = ped.pants;
      ctx.beginPath();
      ctx.arc(1.6, 0, 3.6, Math.PI * 0.5, Math.PI * 1.5);
      ctx.fill();
    }
    if (ped.bag) {
      ctx.fillStyle = '#2f2a3a';
      ctx.fillRect(-4.4, -2, 3, 4);
    }
    if (ped.armed) {
      ctx.fillStyle = '#1a1520';
      ctx.fillRect(4, 1.4, 6, 2);
    }
    ctx.restore();
    if (ped.alert > 0 && ped.state !== 'down') {
      ctx.fillStyle = '#ffd34d';
      ctx.font = '900 13px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', ped.x, ped.y - 16);
    }
    if (ped.runner && ped.state !== 'down') {
      ctx.strokeStyle = 'rgba(255, 77, 94, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ped.x, ped.y, 13, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawPlayer(ctx, player) {
    // The player reads first: a soft ring and a short aim wedge on the pavement.
    ctx.save();
    ctx.translate(player.x, player.y);
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 26);
    glow.addColorStop(0, 'rgba(255, 240, 210, 0.18)');
    glow.addColorStop(1, 'rgba(255, 240, 210, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(player.angle);
    const cone = ctx.createLinearGradient(12, 0, 92, 0);
    cone.addColorStop(0, 'rgba(255, 236, 190, 0.16)');
    cone.addColorStop(1, 'rgba(255, 236, 190, 0)');
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(12, -6);
    ctx.lineTo(92, -26);
    ctx.lineTo(92, 26);
    ctx.lineTo(12, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);
    ctx.scale(1.18, 1.18);
    // Legs.
    const swing = Math.sin(player.walk * 2.6) * 4 * Math.min(1, player.speed / 120);
    ctx.strokeStyle = '#2b3450';
    ctx.lineWidth = 4.4;
    ctx.beginPath();
    ctx.moveTo(-2, -4);
    ctx.lineTo(-4 + swing, -8);
    ctx.moveTo(-2, 4);
    ctx.lineTo(-4 - swing, 8);
    ctx.stroke();
    // Jacket.
    ctx.fillStyle = CAST.player.shirt;
    roundRectLocal(ctx, -7, -6.2, 13, 12.4, 4);
    ctx.fill();
    ctx.strokeStyle = '#16203a';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Shoulders.
    ctx.fillStyle = '#2b3450';
    ctx.fillRect(-1, -7, 5, 3);
    ctx.fillRect(-1, 4, 5, 3);
    // Arms and the pistol.
    ctx.strokeStyle = CAST.player.skin;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(2, -5);
    ctx.lineTo(8, -2);
    ctx.moveTo(2, 5);
    ctx.lineTo(8, 2);
    ctx.stroke();
    ctx.fillStyle = '#15101c';
    ctx.fillRect(8, -1.4, 7, 2.8);
    // Head and hair.
    ctx.fillStyle = CAST.player.skin;
    ctx.beginPath();
    ctx.arc(4, 0, 4.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1c1a22';
    ctx.beginPath();
    ctx.arc(2.4, 0, 4.8, Math.PI * 0.55, Math.PI * 1.45);
    ctx.fill();
    ctx.restore();
    if (player.recoil > 0.4) {
      ctx.fillStyle = 'rgba(255, 226, 150, 0.5)';
      ctx.beginPath();
      ctx.arc(player.x + Math.cos(player.angle) * 20, player.y + Math.sin(player.angle) * 20, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawTrafficLights(ctx, game, view) {
    for (let j = 0; j <= CITY.blocks; j += 1) {
      for (let i = 0; i <= CITY.blocks; i += 1) {
        const x = i * CITY.pitch;
        const y = j * CITY.pitch;
        if (x < view.x0 || x > view.x1 || y < view.y0 || y > view.y1) continue;
        for (let c = 0; c < 4; c += 1) {
          const cx = x + (c % 2 === 0 ? -1 : 1) * (CITY.half + 12);
          const cy = y + (c < 2 ? -1 : 1) * (CITY.half + 12);
          const axis = c % 2 === 0 ? 'ns' : 'ew';
          const state = game.trafficSignal ? game.trafficSignal(i, j, axis) : 'green';
          const color = state === 'green' ? '#43ff9d' : state === 'yellow' ? '#ffd34d' : '#ff3355';
          ctx.fillStyle = '#221c2b';
          ctx.fillRect(cx - 5, cy - 2, 10, 16);
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(cx, cy + 4, 3.2, 0, Math.PI * 2);
          ctx.fill();
          if (state === 'green') {
            ctx.fillStyle = 'rgba(67, 255, 157, 0.25)';
            ctx.beginPath();
            ctx.arc(cx, cy + 4, 8, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
  }

  function drawChopper(ctx, chopper, game) {
    const x = chopper.x;
    const y = chopper.y;
    const shadowY = y + 220;
    ctx.save();
    ctx.fillStyle = 'rgba(14, 8, 20, 0.32)';
    ctx.beginPath();
    ctx.ellipse(x + 40, shadowY + 30, 62, 18, 0.2, 0, Math.PI * 2);
    ctx.fill();
    // Spot on the ground.
    const player = game.player;
    const g = ctx.createRadialGradient(player.x, player.y, 0, player.x, player.y, 150);
    g.addColorStop(0, 'rgba(255, 250, 220, 0.34)');
    g.addColorStop(1, 'rgba(255, 250, 220, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(player.x, player.y, 150, 96, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body.
    ctx.translate(x, y);
    ctx.rotate(chopper.angle);
    ctx.fillStyle = '#232a42';
    roundRectLocal(ctx, -34, -15, 62, 30, 12);
    ctx.fill();
    ctx.strokeStyle = '#4a5674';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#9fb3ff';
    roundRectLocal(ctx, 10, -10, 18, 20, 6);
    ctx.fill();
    ctx.fillStyle = '#1a1f33';
    ctx.fillRect(-64, -5, 32, 10);
    ctx.fillStyle = '#59658a';
    ctx.fillRect(-62, -14, 5, 28);
    // Rotor.
    ctx.strokeStyle = 'rgba(220, 230, 255, 0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-14, -40);
    ctx.lineTo(14, 40);
    ctx.moveTo(-14, 40);
    ctx.lineTo(14, -40);
    ctx.stroke();
    ctx.fillStyle = 'rgba(230, 240, 255, 0.2)';
    ctx.beginPath();
    ctx.arc(0, 0, 44, 0, Math.PI * 2);
    ctx.fill();
    // Tail rotor.
    ctx.strokeStyle = 'rgba(220, 230, 255, 0.4)';
    ctx.beginPath();
    ctx.arc(-62, 0, 12, 0, Math.PI * 2);
    ctx.stroke();
    // Light.
    ctx.fillStyle = Math.sin(chopper.rotor) > 0 ? '#ff3355' : '#3d7bff';
    ctx.beginPath();
    ctx.arc(-5, 0, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawLights(ctx, game, view) {
    const night = Math.max(0, Math.min(1, ((game.hour ?? 18.7) - 18.1) / 2.6));
    const warm = 0.78 + night * 0.8;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // Street lamp pools.
    for (const lamp of game.city.lamps) {
      if (lamp.x < view.x0 - 120 || lamp.x > view.x1 + 120 || lamp.y < view.y0 - 120 || lamp.y > view.y1 + 120) continue;
      const g = ctx.createRadialGradient(lamp.x, lamp.y, 0, lamp.x, lamp.y, 74);
      g.addColorStop(0, `rgba(255, 178, 92, ${0.13 * warm})`);
      g.addColorStop(0.5, `rgba(255, 150, 80, ${0.05 * warm})`);
      g.addColorStop(1, 'rgba(255, 140, 70, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(lamp.x, lamp.y, 74, 0, Math.PI * 2);
      ctx.fill();
    }
    // Neon signs.
    for (const sign of game.city.signs) {
      if (sign.x < view.x0 - 260 || sign.x > view.x1 + 260 || sign.y < view.y0 - 260 || sign.y > view.y1 + 260) continue;
      const g = ctx.createRadialGradient(sign.x, sign.y, 0, sign.x, sign.y, 140);
      g.addColorStop(0, hexToRgba(sign.color, 0.14 * warm));
      g.addColorStop(0.45, hexToRgba(sign.color, 0.05 * warm));
      g.addColorStop(1, hexToRgba(sign.color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sign.x, sign.y, 140, 0, Math.PI * 2);
      ctx.fill();
    }
    // Standing billboards.
    for (const board of game.city.billboards) {
      if (board.x < view.x0 - 140 || board.x > view.x1 + 140 || board.y < view.y0 || board.y > view.y1 + 200) continue;
      const cy = board.y - board.h - 20 + board.h * 0.5;
      const g = ctx.createRadialGradient(board.x, cy, 0, board.x, cy, 120);
      g.addColorStop(0, hexToRgba(board.color, 0.18 * warm));
      g.addColorStop(0.5, hexToRgba(board.color, 0.06 * warm));
      g.addColorStop(1, hexToRgba(board.color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(board.x, cy, 120, 0, Math.PI * 2);
      ctx.fill();
    }
    // Headlight cones and tail glow.
    for (const vehicle of game.vehicles) {
      if (!vehicle.lightsOn || vehicle.wrecked) continue;
      if (vehicle.x < view.x0 - 200 || vehicle.x > view.x1 + 200 || vehicle.y < view.y0 - 200 || vehicle.y > view.y1 + 200) continue;
      ctx.save();
      ctx.translate(vehicle.x, vehicle.y);
      ctx.rotate(vehicle.angle);
      const beam = ctx.createLinearGradient(0, 0, 190, 0);
      beam.addColorStop(0, `rgba(255, 236, 186, ${0.17 * warm})`);
      beam.addColorStop(0.35, `rgba(255, 220, 160, ${0.07 * warm})`);
      beam.addColorStop(1, 'rgba(255, 210, 140, 0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(vehicle.length * 0.5, -vehicle.width * 0.35);
      ctx.lineTo(190, -58);
      ctx.lineTo(190, 58);
      ctx.lineTo(vehicle.length * 0.5, vehicle.width * 0.35);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // Sirens bloom.
    for (const unit of game.police?.units ?? []) {
      if (!unit.police || unit.wrecked) continue;
      if (unit.x < view.x0 - 120 || unit.x > view.x1 + 120 || unit.y < view.y0 - 120 || unit.y > view.y1 + 120) continue;
      const red = Math.sin((game.clock * 12 + unit.id) % (Math.PI * 2)) > 0;
      const color = red ? '255, 51, 85' : '61, 123, 255';
      const halo = ctx.createRadialGradient(unit.x, unit.y, 0, unit.x, unit.y, 104);
      halo.addColorStop(0, `rgba(${color}, ${0.2 * (0.85 + night * 0.6)})`);
      halo.addColorStop(0.5, `rgba(${color}, ${0.08 * (0.85 + night * 0.6)})`);
      halo.addColorStop(1, `rgba(${color}, 0)`);
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(unit.x, unit.y, 104, 0, Math.PI * 2);
      ctx.fill();
      const core = ctx.createRadialGradient(unit.x, unit.y, 0, unit.x, unit.y, 22);
      core.addColorStop(0, red ? 'rgba(255, 120, 130, 0.35)' : 'rgba(140, 175, 255, 0.35)');
      core.addColorStop(1, `rgba(${color}, 0)`);
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(unit.x, unit.y, 22, 0, Math.PI * 2);
      ctx.fill();
    }
    // Neon shop fronts glow.
    for (const building of game.city.buildings) {
      if (!building.awning) continue;
      if (building.x < view.x0 - 80 || building.x > view.x1 + 80 || building.y < view.y0 - 80 || building.y > view.y1 + 80) continue;
      const g = ctx.createRadialGradient(building.x + building.w / 2, building.y + building.h, 0, building.x + building.w / 2, building.y + building.h, 110);
      g.addColorStop(0, hexToRgba(building.awning, 0.12 * warm));
      g.addColorStop(1, hexToRgba(building.awning, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(building.x + building.w / 2, building.y + building.h, 110, 0, Math.PI * 2);
      ctx.fill();
    }
    // Mission marker beams.
    for (const marker of game.missions.markerList()) {
      if (marker.x < view.x0 - 60 || marker.x > view.x1 + 60 || marker.y < view.y0 - 60 || marker.y > view.y1 + 160) continue;
      const color = marker.kind === 'target' ? '255, 77, 94' : marker.kind === 'deliver' ? '38, 239, 212' : '255, 211, 77';
      const beam = ctx.createLinearGradient(0, marker.y - 140, 0, marker.y + 10);
      beam.addColorStop(0, `rgba(${color}, 0)`);
      beam.addColorStop(0.55, `rgba(${color}, 0.16)`);
      beam.addColorStop(1, `rgba(${color}, 0.34)`);
      ctx.fillStyle = beam;
      ctx.fillRect(marker.x - 17, marker.y - 140, 34, 150);
      const base = ctx.createRadialGradient(marker.x, marker.y, 0, marker.x, marker.y, 46);
      base.addColorStop(0, `rgba(${color}, 0.32)`);
      base.addColorStop(1, `rgba(${color}, 0)`);
      ctx.fillStyle = base;
      ctx.beginPath();
      ctx.ellipse(marker.x, marker.y, 46, 30, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawDusk(ctx, game) {
    const w = viewW;
    const h = viewH;
    const dusk = game.hour ?? 18.7;
    const night = Math.max(0, Math.min(1, (dusk - 18.1) / 2.6));
    ctx.save();
    // Deepen the city as the sun drops, then wash a low golden light across it.
    if (night > 0.02) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = `rgba(96, 74, 132, ${0.55 * night})`;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalCompositeOperation = 'soft-light';
    const tint = ctx.createLinearGradient(0, 0, w * 0.9, h);
    tint.addColorStop(0, '#ffb066');
    tint.addColorStop(0.38, '#ff7a6a');
    tint.addColorStop(0.72, '#5a3f8f');
    tint.addColorStop(1, '#1d1640');
    ctx.globalAlpha = 0.4 - night * 0.06;
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    const sun = ctx.createRadialGradient(w * 0.16, h * 0.08, 0, w * 0.16, h * 0.08, w * 0.66);
    sun.addColorStop(0, `rgba(255, 178, 92, ${Math.max(0, 0.16 - night * 0.13)})`);
    sun.addColorStop(1, 'rgba(255, 120, 60, 0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
    const vignette = ctx.createRadialGradient(w / 2, h / 2, h * 0.34, w / 2, h / 2, h * 0.95);
    vignette.addColorStop(0, 'rgba(8, 5, 16, 0)');
    vignette.addColorStop(1, `rgba(8, 5, 16, ${0.46 + night * 0.36})`);
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  return { camera, resize, draw, follow, project, screenToWorld, shake, get view() { return { w: viewW, h: viewH }; } };
}

function hexToRgba(hex, alpha) {
  if (hex.startsWith('rgb')) return hex.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function shadeHexLocal(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const mix = (v) => Math.max(0, Math.min(255, Math.round(amount >= 0 ? v + (255 - v) * amount : v * (1 + amount))));
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}
