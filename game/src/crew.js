// Two companions stay with Ray on foot and ride in the same car. Their small formation slides
// along buildings; if a companion is left far off-screen, they regroup beside the player.
import { CITY } from './config.js';

export function createCrew(player, city) {
  const members = [
    { name: 'NIA TORRES', shirt: '#fa5395', skin: '#b87957', pants: '#372e58', color: '#ff73ad' },
    { name: 'JAX MERCER', shirt: '#25cdbb', skin: '#d2a078', pants: '#24384a', color: '#3af5df' },
  ].map((member) => ({ ...member, x: player.x, y: player.y, angle: 0, walk: 0, state: 'FOLLOWING', inCar: null }));

  function safeSpot(player, index) {
    const angle = player.speed > 8 ? Math.atan2(player.vy, player.vx) : player.angle;
    const backX = -Math.cos(angle);
    const backY = -Math.sin(angle);
    const side = index === 0 ? 33 : -33;
    const offsets = [
      [backX * 40 - backY * side, backY * 40 + backX * side],
      [backX * 55, backY * 55],
      [-backY * side, backX * side],
      [backY * side, -backX * side],
      [0, 0],
    ];
    for (const [dx, dy] of offsets) {
      const x = Math.max(30, Math.min(CITY.size - 30, player.x + dx));
      const y = Math.max(30, Math.min(CITY.size - 30, player.y + dy));
      if (!city.buildingAt(x, y, 9)) return { x, y };
    }
    return { x: player.x, y: player.y };
  }

  const crew = {
    members,
    enabled: true,
    reset(player) {
      this.enabled = true;
      for (let index = 0; index < members.length; index += 1) {
        const member = members[index];
        const spot = safeSpot(player, index);
        member.x = spot.x;
        member.y = spot.y;
        member.angle = player.angle;
        member.walk = 0;
        member.inCar = player.inCar;
        member.state = player.inCar ? 'IN CAR' : 'FOLLOWING';
      }
    },
    dismiss() {
      this.enabled = false;
      for (const member of members) {
        member.inCar = null;
        member.state = 'STANDBY';
      }
    },
    toggle(player) {
      if (this.enabled) this.dismiss();
      else this.reset(player);
    },
    update(player, dt) {
      if (!this.enabled) return;
      for (let index = 0; index < members.length; index += 1) {
        const member = members[index];
        if (player.inCar) {
          member.inCar = player.inCar;
          member.x = player.inCar.x;
          member.y = player.inCar.y;
          member.state = 'IN CAR';
          continue;
        }
        if (member.inCar) {
          const spot = safeSpot(player, index);
          member.x = spot.x;
          member.y = spot.y;
          member.inCar = null;
        }
        member.state = 'FOLLOWING';
        const target = safeSpot(player, index);
        let dx = target.x - member.x;
        let dy = target.y - member.y;
        const distance = Math.hypot(dx, dy);
        if (distance > 650) {
          member.x = target.x;
          member.y = target.y;
          continue;
        }
        if (distance < 6) continue;
        member.angle = Math.atan2(dy, dx);
        const step = Math.min(distance - 5, (distance > 110 ? 260 : 180) * dt);
        dx = dx / distance * step;
        dy = dy / distance * step;
        if (!city.buildingAt(member.x + dx, member.y + dy, 9)) {
          member.x += dx;
          member.y += dy;
        } else if (!city.buildingAt(member.x + dx, member.y, 9)) {
          member.x += dx;
        } else if (!city.buildingAt(member.x, member.y + dy, 9)) {
          member.y += dy;
        }
        member.walk += dt * 7;
      }
    },
  };
  crew.reset(player);
  return crew;
}
