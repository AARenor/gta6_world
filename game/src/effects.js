// The visible violence and road wear: tyre smoke, skid marks, muzzle flashes, sparks, dust,
// glass and debris, explosions with a shockwave ring, casings, and the floating cash text a
// payoff throws up. Particles are plain objects in one list, capped, and drawn in two passes so
// smoke sits under cars and flashes over them.

import { PALETTE } from './config.js';

const MAX_PARTICLES = 900;

export function createEffects(rng) {
  const particles = [];
  const tracers = [];
  const skids = [];
  const rings = [];

  function add(particle) {
    if (particles.length > MAX_PARTICLES) particles.shift();
    particles.push(particle);
    return particle;
  }

  function spawnTyreSmoke(x, y, angle) {
    for (let k = 0; k < 2; k += 1) {
      const spread = rng.range(-0.7, 0.7);
      add({
        kind: 'smoke',
        x: x + rng.range(-4, 4),
        y: y + rng.range(-4, 4),
        vx: Math.cos(angle + Math.PI + spread) * rng.range(18, 60),
        vy: Math.sin(angle + Math.PI + spread) * rng.range(18, 60) - 8,
        life: rng.range(0.8, 1.8),
        maxLife: 1.8,
        size: rng.range(7, 15),
        grow: rng.range(16, 30),
        color: 'rgba(226, 218, 230, 0.5)',
        drag: 1.6,
      });
    }
  }

  function spawnSkid(x, y, angle, dark = 'rgba(20, 14, 26, 0.5)') {
    if (skids.length > 620) skids.shift();
    skids.push({ x, y, angle, life: 14, maxLife: 14, dark });
  }

  function spawnSparks(x, y, angle, count = 6) {
    for (let k = 0; k < count; k += 1) {
      const a = angle + rng.range(-0.9, 0.9);
      const speed = rng.range(120, 340);
      add({
        kind: 'spark',
        x, y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: rng.range(0.18, 0.42),
        maxLife: 0.42,
        size: rng.range(1.4, 3),
        color: rng.chance(0.35) ? '#fff6cf' : '#ffc247',
        drag: 3,
        gravity: 90,
      });
    }
  }

  function spawnPuff(x, y, color = '#cfc3c9', count = 4) {
    for (let k = 0; k < count; k += 1) {
      add({
        kind: 'smoke',
        x: x + rng.range(-5, 5),
        y: y + rng.range(-5, 5),
        vx: rng.range(-30, 30),
        vy: rng.range(-46, -8),
        life: rng.range(0.5, 1.2),
        maxLife: 1.2,
        size: rng.range(5, 11),
        grow: rng.range(10, 22),
        color,
        drag: 1.4,
        alpha: 0.5,
      });
    }
  }

  function muzzleFlash(x, y, angle, owner = 'player') {
    add({
      kind: 'muzzle',
      x, y, angle,
      life: 0.075,
      maxLife: 0.075,
      size: owner === 'player' ? 26 : 22,
      color: owner === 'player' ? '#ffe9a8' : '#ffb3a0',
    });
    for (let k = 0; k < 4; k += 1) {
      const a = angle + rng.range(-0.35, 0.35);
      add({
        kind: 'spark',
        x, y,
        vx: Math.cos(a) * rng.range(200, 460),
        vy: Math.sin(a) * rng.range(200, 460),
        life: rng.range(0.06, 0.16),
        maxLife: 0.16,
        size: rng.range(1.2, 2.6),
        color: '#ffe6a3',
        drag: 5,
      });
    }
    add({
      kind: 'light',
      x, y,
      vx: 0, vy: 0,
      life: 0.09,
      maxLife: 0.09,
      size: 54,
      color: owner === 'player' ? 'rgba(255, 214, 130, 0.36)' : 'rgba(255, 140, 120, 0.3)',
    });
  }

  function spawnTracer(x1, y1, x2, y2, color = '#ffe6a3') {
    tracers.push({ x1, y1, x2, y2, life: 0.075, color });
  }

  function spawnFloatingText(x, y, text, color = PALETTE.money) {
    add({
      kind: 'text',
      x, y,
      vx: 0,
      vy: -34,
      life: 1.35,
      maxLife: 1.35,
      text,
      color,
      size: 20,
      drag: 0.4,
    });
  }

  function spawnExplosion(x, y) {
    rings.push({ x, y, r: 8, maxR: 148, life: 0.55, maxLife: 0.55, color: 'rgba(255, 236, 190, 0.6)' });
    rings.push({ x, y, r: 4, maxR: 96, life: 0.9, maxLife: 0.9, color: 'rgba(255, 118, 60, 0.45)' });
    for (let k = 0; k < 26; k += 1) {
      const a = rng.angle();
      const speed = rng.range(40, 320);
      add({
        kind: 'fire',
        x, y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: rng.range(0.25, 0.7),
        maxLife: 0.7,
        size: rng.range(8, 22),
        grow: rng.range(22, 60),
        color: rng.chance(0.5) ? '#ffb347' : '#ff5f3d',
        drag: 2.4,
      });
    }
    for (let k = 0; k < 16; k += 1) {
      add({
        kind: 'smoke',
        x: x + rng.range(-18, 18),
        y: y + rng.range(-18, 18),
        vx: rng.range(-60, 60),
        vy: rng.range(-80, 10),
        life: rng.range(1.2, 2.6),
        maxLife: 2.6,
        size: rng.range(12, 26),
        grow: rng.range(26, 50),
        color: 'rgba(54, 44, 58, 0.62)',
        drag: 1.1,
      });
    }
    for (let k = 0; k < 18; k += 1) {
      const a = rng.angle();
      const speed = rng.range(120, 420);
      add({
        kind: 'debris',
        x, y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: rng.range(0.5, 1.3),
        maxLife: 1.3,
        size: rng.range(2, 5),
        color: rng.chance(0.5) ? '#2b2530' : '#7d6a72',
        drag: 0.9,
        gravity: 120,
        spin: rng.range(-10, 10),
        angle: a,
      });
    }
    add({ kind: 'light', x, y, vx: 0, vy: 0, life: 0.5, maxLife: 0.5, size: 170, color: 'rgba(255, 168, 92, 0.32)' });
  }

  function spawnCasing(x, y, angle) {
    const a = angle + Math.PI * 0.5 + rng.range(-0.4, 0.4);
    add({
      kind: 'casing',
      x, y,
      vx: Math.cos(a) * rng.range(60, 140),
      vy: Math.sin(a) * rng.range(60, 140),
      life: rng.range(0.7, 1.4),
      maxLife: 1.4,
      size: 2.4,
      color: '#e0b45c',
      drag: 2,
    });
  }

  function update(dt) {
    for (let k = particles.length - 1; k >= 0; k -= 1) {
      const p = particles[k];
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(k, 1);
        continue;
      }
      const drag = p.drag ?? 0;
      p.vx -= p.vx * drag * dt;
      p.vy -= p.vy * drag * dt;
      if (p.gravity) p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.grow && p.size < 90) p.size += p.grow * dt;
      if (p.spin) p.angle += p.spin * dt;
    }
    for (let k = tracers.length - 1; k >= 0; k -= 1) {
      tracers[k].life -= dt;
      if (tracers[k].life <= 0) tracers.splice(k, 1);
    }
    for (let k = rings.length - 1; k >= 0; k -= 1) {
      const r = rings[k];
      r.life -= dt;
      r.r += (r.maxR - r.r) * Math.min(1, dt * 7);
      if (r.life <= 0) rings.splice(k, 1);
    }
    for (let k = skids.length - 1; k >= 0; k -= 1) {
      skids[k].life -= dt * 0.05;
      if (skids[k].life <= 0) skids.splice(k, 1);
    }
  }

  function drawGround(ctx) {
    for (const skid of skids) {
      ctx.save();
      ctx.translate(skid.x, skid.y);
      ctx.rotate(skid.angle);
      ctx.globalAlpha = Math.min(1, skid.life / 6) * 0.55;
      ctx.fillStyle = skid.dark;
      ctx.fillRect(-9, -8, 18, 3.2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawBelow(ctx) {
    for (const p of particles) {
      const a = Math.max(0, p.life / p.maxLife);
      if (p.kind === 'smoke') {
        ctx.globalAlpha = a * (p.alpha ?? 0.45);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawAbove(ctx) {
    for (const p of particles) {
      const a = Math.max(0, p.life / p.maxLife);
      if (p.kind === 'smoke') continue;
      if (p.kind === 'light') {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        g.addColorStop(0, p.color);
        g.addColorStop(1, 'rgba(255, 180, 90, 0)');
        ctx.globalAlpha = a;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'muzzle') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.globalAlpha = a;
        const g = ctx.createLinearGradient(0, 0, p.size, 0);
        g.addColorStop(0, 'rgba(255, 250, 220, 0.95)');
        g.addColorStop(0.45, 'rgba(255, 200, 110, 0.75)');
        g.addColorStop(1, 'rgba(255, 140, 60, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, -p.size * 0.24);
        ctx.lineTo(p.size, 0);
        ctx.lineTo(0, p.size * 0.24);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 245, 215, 0.95)';
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (p.kind === 'fire') {
        ctx.globalAlpha = a * 0.9;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'spark') {
        ctx.globalAlpha = a;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.012, p.y - p.vy * 0.012);
        ctx.stroke();
      } else if (p.kind === 'debris' || p.kind === 'casing') {
        ctx.globalAlpha = a;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle ?? 0);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size, -p.size * 0.5, p.size * 2, p.size);
        ctx.restore();
      } else if (p.kind === 'text') {
        ctx.globalAlpha = Math.min(1, a * 1.6);
        ctx.font = `900 ${p.size}px "Montserrat", sans-serif`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(16, 10, 24, 0.85)';
        ctx.strokeText(p.text, p.x, p.y);
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, p.x, p.y);
      }
    }
    for (const t of tracers) {
      ctx.globalAlpha = t.life / 0.075;
      ctx.strokeStyle = t.color;
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      ctx.moveTo(t.x1, t.y1);
      ctx.lineTo(t.x2, t.y2);
      ctx.stroke();
    }
    for (const r of rings) {
      ctx.globalAlpha = Math.max(0, r.life / r.maxLife) * 0.8;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  return {
    particles, tracers, skids, rings,
    spawnTyreSmoke, spawnSkid, spawnSparks, spawnPuff, muzzleFlash, spawnTracer,
    spawnFloatingText, spawnExplosion, spawnCasing, update, drawGround, drawBelow, drawAbove,
  };
}
