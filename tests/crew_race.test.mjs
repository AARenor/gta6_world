import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CITY } from '../game/src/config.js';
import { createCity } from '../game/src/city.js';
import { createPlayer } from '../game/src/player.js';
import { createVehicle } from '../game/src/traffic.js';
import { createCrew } from '../game/src/crew.js';
import { createRace } from '../game/src/race.js';

function world() {
  const city = createCity(CITY.seed);
  const player = createPlayer(CITY.pitch * 6, CITY.pitch * 6);
  return { city, player };
}

test('crew follows, boards the player car, exits, and can be dismissed', () => {
  const { city, player } = world();
  const crew = createCrew(player, city);
  assert.equal(crew.members.length, 2);
  assert.notEqual(crew.members[0].name, crew.members[1].name);
  player.x += 150;
  player.vx = 100;
  const before = Math.hypot(crew.members[0].x - player.x, crew.members[0].y - player.y);
  for (let i = 0; i < 90; i += 1) crew.update(player, 1 / 60);
  const after = Math.hypot(crew.members[0].x - player.x, crew.members[0].y - player.y);
  assert.ok(after < before - 40, `crew did not close the gap: ${before} to ${after}`);
  assert.ok(crew.members.every((member) => !city.buildingAt(member.x, member.y, 9)));
  const car = createVehicle('sedan', player.x, player.y, 0);
  player.inCar = car;
  crew.update(player, 1 / 60);
  assert.ok(crew.members.every((member) => member.inCar === car && member.state === 'IN CAR'));
  player.inCar = null;
  crew.update(player, 1 / 60);
  assert.ok(crew.members.every((member) => !member.inCar && member.state === 'FOLLOWING'));
  crew.toggle(player);
  assert.equal(crew.enabled, false);
  assert.ok(crew.members.every((member) => member.state === 'STANDBY'));
  crew.toggle(player);
  assert.equal(crew.enabled, true);
  assert.ok(crew.members.every((member) => member.state === 'FOLLOWING'));
});

test('race follows drivable city roads and rewards completion only once', () => {
  const { player } = world();
  const race = createRace();
  race.start(player);
  assert.equal(race.active, true);
  assert.ok(race.route.length >= 4);
  for (const checkpoint of race.route) {
    assert.ok(checkpoint.x >= 0 && checkpoint.x <= CITY.size);
    assert.ok(checkpoint.y >= 0 && checkpoint.y <= CITY.size);
    assert.ok(checkpoint.x % CITY.pitch === 0 || checkpoint.y % CITY.pitch === 0);
  }
  const first = race.marker;
  player.x = first.x;
  player.y = first.y;
  assert.equal(race.update(player, 2), 0);
  assert.equal(race.checkpoint, 0, 'walking through a checkpoint must not advance the race');
  assert.equal(race.elapsed, 2);
  player.inCar = createVehicle('sedan', player.x, player.y, 0);
  const total = race.route.length;
  for (let index = 0; index < total; index += 1) {
    player.x = race.marker.x;
    player.y = race.marker.y;
    const award = race.update(player, 1);
    if (index < total - 1) {
      assert.equal(award, 0);
      assert.equal(race.checkpoint, index + 1);
    } else {
      assert.equal(award, race.reward);
      assert.ok(award > 0);
    }
  }
  assert.equal(race.active, false);
  assert.equal(race.marker, null);
  assert.equal(race.update(player, 1), 0);
});

test('race can restart or cancel near each city boundary', () => {
  const { player } = world();
  const race = createRace();
  for (const [x, y] of [[0, 0], [CITY.size, 0], [0, CITY.size], [CITY.size, CITY.size]]) {
    player.x = x;
    player.y = y;
    race.start(player);
    assert.ok(race.route.every((point) => point.x > 0 && point.x < CITY.size && point.y > 0 && point.y < CITY.size));
    race.cancel();
    assert.equal(race.active, false);
    assert.equal(race.marker, null);
  }
});
