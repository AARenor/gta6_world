// A repeatable city-grid time trial. Only a car can clear a checkpoint, and the reward is
// returned once on the finish so the game can use its normal money and effects system.
import { CITY } from './config.js';

export function createRace() {
  return {
    active: false,
    route: [],
    checkpoint: 0,
    elapsed: 0,
    reward: 2500,
    lastX: 0,
    lastY: 0,
    lastCar: null,
    get marker() {
      return this.active ? this.route[this.checkpoint] : null;
    },
    start(player) {
      const i = Math.max(1, Math.min(CITY.blocks - 2, Math.round(player.x / CITY.pitch)));
      const j = Math.max(1, Math.min(CITY.blocks - 2, Math.round(player.y / CITY.pitch)));
      const dx = i < CITY.blocks / 2 ? 1 : -1;
      const dy = j < CITY.blocks / 2 ? 1 : -1;
      const x = i * CITY.pitch;
      const y = j * CITY.pitch;
      const p = CITY.pitch;
      this.route = [
        { x: x + dx * 150, y, radius: 52 },
        { x: x + dx * p, y, radius: 52 },
        { x: x + dx * p, y: y + dy * p, radius: 52 },
        { x: x + dx * 2 * p, y: y + dy * p, radius: 52 },
        { x: x + dx * 2 * p, y: y + dy * 2 * p, radius: 52 },
        { x: x + dx * p, y: y + dy * 2 * p, radius: 52 },
      ];
      this.checkpoint = 0;
      this.elapsed = 0;
      this.lastX = player.x;
      this.lastY = player.y;
      this.lastCar = player.inCar;
      this.active = true;
    },
    cancel() {
      this.active = false;
      this.lastCar = null;
    },
    update(player, dt) {
      if (!this.active) return 0;
      this.elapsed += dt;
      if (!player.inCar) {
        this.lastX = player.x;
        this.lastY = player.y;
        this.lastCar = null;
        return 0;
      }
      if (this.lastCar !== player.inCar) {
        this.lastX = player.x;
        this.lastY = player.y;
        this.lastCar = player.inCar;
      }
      const marker = this.marker;
      const dx = player.x - this.lastX;
      const dy = player.y - this.lastY;
      const lengthSquared = dx * dx + dy * dy;
      const along = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
        ((marker.x - this.lastX) * dx + (marker.y - this.lastY) * dy) / lengthSquared));
      const nearestX = this.lastX + dx * along;
      const nearestY = this.lastY + dy * along;
      this.lastX = player.x;
      this.lastY = player.y;
      if (Math.hypot(marker.x - nearestX, marker.y - nearestY) > marker.radius) return 0;
      this.checkpoint += 1;
      if (this.checkpoint < this.route.length) return 0;
      this.active = false;
      this.lastCar = null;
      return this.reward;
    },
  };
}
