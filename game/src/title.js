// The screens around the game: the title (with its own sunset-to-night sky over the city
// skyline), the pause card, and the two ways a night can end — busted or wasted. Drawn on the
// same 1920x1080 logical grid as the HUD, over a still frame of the live city.

import { CAST, CITY_NAME, FONT, PALETTE, TAGLINE } from './config.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function sky(ctx, w, h) {
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
  sky(ctx, 1920, 760);
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
  roundRect(ctx, 140, 470, 620, 300, 12);
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
      roundRect(ctx, 160, y - 34, 580, 50, 6);
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
    roundRect(ctx, 1420, y, 72, 72, 10);
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
  roundRect(ctx, 560, 260, 800, 470, 14);
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

export const TITLE_HEIGHT = 1080;
