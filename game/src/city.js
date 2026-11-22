// Vesper City itself: a 13 by 13 grid of blocks, four-lane roads, wide sidewalks, and a seeded
// mix of towers, shop rows, motels with pools, parking lots, palm parks and fenced yards. The
// module also answers the questions the rest of the game asks of the city: which district am I
// in, is this point inside a building, what can a bullet hit, and where is the safehouse.

import { CITY, PALETTE, VEHICLES } from './config.js';
import { createRandom } from './random.js';

const SIGN_WORDS = [
  'VELVET ROOM', 'TIKI TONIC', 'MOTEL 9', 'SODA POP', 'GOLDEN HOUR', 'PALM STATIC',
  'BAIT & TACKLE', 'NEON DRIFT', 'THE TIDEPOOL', 'MAMBO', 'CINEMA', 'LIQUOR',
  'DINER', 'HOTEL VELA', 'PAWN', 'SURF CO', 'TATTOO', 'ARCADE', 'CAFÉ LUNA', 'SEA GLASS',
  'MOTHER OF PEARL', 'CINDER GRILL', 'LAST CALL', 'BLUE HOUR', 'CORAL CLUB', 'PIER 12',
];

const SHOP_WORDS = ['TACOS', 'RECORDS', 'PAWN', 'SUNGLASS', 'BOARDWALK', 'DONUTS', 'TATTOO', 'SURF', 'CAFÉ', 'FLOWERS'];

const WALLS = ['#e8735a', '#f0c9a6', '#2f8a8a', '#c13c74', '#4a3f63', '#e9dcc0', '#8fb7a6', '#f2a06b', '#b04a54', '#7f9fb5'];
const ROOFS = ['#a9535f', '#c9a17e', '#256f74', '#8f2c5a', '#3a3250', '#c3b492', '#6f9587', '#c77f50', '#8c3a44', '#637c92'];
const AWNINGS = ['#ff2f92', '#26efd4', '#ffc247', '#ff6a3d', '#9d6bff', '#b8ff5e'];

/** How far a thing of height z rises up the screen: the city is viewed at a slight tilt. */
export const RISE = 0.27;

export function riseOf(z) {
  return z * RISE;
}

export function createCity(seed = CITY.seed) {
  const rng = createRandom(seed);
  const blocks = [];
  const buildings = [];
  const props = [];
  const palms = [];
  const lamps = [];
  const signs = [];
  const billboards = [];
  const parked = [];
  const pickups = [];
  const points = {};

  const blockAtPoint = (x, y) => {
    const i = Math.floor(x / CITY.pitch);
    const j = Math.floor(y / CITY.pitch);
    if (i < 0 || j < 0 || i >= CITY.blocks || j >= CITY.blocks) return null;
    return blocks[j * CITY.blocks + i];
  };

  const blockRect = (i, j) => ({
    x: i * CITY.pitch + CITY.half + CITY.walk,
    y: j * CITY.pitch + CITY.half + CITY.walk,
    w: CITY.inner,
    h: CITY.inner,
  });

  let currentBlock = null;

  const addBuilding = (rect, style, height) => {
    const wall = rng.pick(WALLS);
    const roof = rng.pick(ROOFS);
    const building = {
      x: rect.x, y: rect.y, w: rect.w, h: rect.h,
      z: height,
      wall, roof,
      side: shade(wall, -0.22),
      trim: shade(wall, 0.18),
      style,
      rows: Math.max(1, Math.min(4, Math.floor(riseOf(height) / 8))),
      cols: Math.max(2, Math.floor(rect.w / 26)),
      windows: [],
      acs: [],
      tanks: [],
      antenna: rng.chance(0.35),
      parapet: rng.chance(0.55) ? shade(roof, 0.16) : null,
      sign: null,
      awning: null,
      door: null,
    };
    // Lit windows on the visible south facade: a warm scatter, a few dark.
    for (let row = 0; row < building.rows; row += 1) {
      for (let col = 0; col < building.cols; col += 1) {
        if (rng.chance(0.42)) building.windows.push({ row, col, warm: rng.chance(0.72) });
      }
    }
    const acCount = rng.int(1, 4);
    for (let k = 0; k < acCount; k += 1) {
      building.acs.push({
        x: rng.range(0.08, 0.72) * rect.w,
        y: rng.range(0.1, 0.8) * rect.h,
        w: rng.range(14, 30),
        h: rng.range(10, 20),
      });
    }
    if (rng.chance(0.32)) {
      building.tanks.push({
        x: rng.range(0.15, 0.7) * rect.w,
        y: rng.range(0.15, 0.7) * rect.h,
        r: rng.range(8, 13),
      });
    }
    // Rooftop furniture, so no roof reads as a flat coloured rectangle.
    building.skylights = [];
    const skylights = rng.int(1, 3);
    for (let k = 0; k < skylights; k += 1) {
      building.skylights.push({
        x: rng.range(0.08, 0.66) * rect.w,
        y: rng.range(0.08, 0.66) * rect.h,
        w: rng.range(18, 34),
        h: rng.range(12, 22),
      });
    }
    building.vents = [];
    const vents = rng.int(1, 3);
    for (let k = 0; k < vents; k += 1) {
      building.vents.push({
        x: rng.range(0.1, 0.82) * rect.w,
        y: rng.range(0.1, 0.82) * rect.h,
        r: rng.range(4, 8),
      });
    }
    building.solar = rng.chance(0.24) ? {
      x: rng.range(0.1, 0.5) * rect.w,
      y: rng.range(0.1, 0.55) * rect.h,
      w: rng.range(26, 48),
      h: rng.range(18, 32),
    } : null;
    building.roofPool = height > 70 && rng.chance(0.34) ? {
      x: rng.range(0.34, 0.62) * rect.w,
      y: rng.range(0.3, 0.56) * rect.h,
      w: rng.range(34, 56),
      h: rng.range(22, 36),
    } : null;
    building.helipad = height > 118 && rng.chance(0.34);
    building.edgeLights = height > 62 && rng.chance(0.5);
    building.blade = style === 'shop' && rng.chance(0.55) ? {
      color: rng.pick([PALETTE.neonPink, PALETTE.neonTeal, PALETTE.neonAmber, PALETTE.neonViolet, PALETTE.neonLime]),
      side: rng.chance(0.5) ? 0 : 1,
      along: rng.range(0.2, 0.75),
    } : null;
    if (height > 60 && rng.chance(0.7)) {
      const color = rng.pick([PALETTE.neonPink, PALETTE.neonTeal, PALETTE.neonAmber, PALETTE.neonViolet]);
      building.sign = {
        text: rng.pick(SIGN_WORDS),
        color,
        x: rect.x + rect.w * rng.range(0.18, 0.38),
        y: rect.y + rect.h * 0.28,
        size: Math.min(46, Math.max(22, rect.w * 0.16)),
        tilt: 0,
      };
      signs.push(building.sign);
    }
    if (style === 'shop') {
      building.awning = rng.pick(AWNINGS);
      building.door = { x: rng.range(0.2, 0.7) * rect.w, w: rng.range(16, 26) };
    }
    buildings.push(building);
    if (currentBlock) currentBlock.buildings.push(building);
    return building;
  };

  const addPalm = (x, y, tall = 1) => {
    palms.push({ x, y, h: rng.range(34, 58) * tall, lean: rng.range(-0.22, 0.22), phase: rng.range(0, 6.28) });
  };

  const addLamp = (x, y, angle) => {
    lamps.push({ x, y, angle, h: rng.range(30, 36), warm: rng.chance(0.18) ? '#ffd9a0' : '#ffc07a' });
  };

  const addProp = (kind, x, y, angle = 0, color = null) => {
    props.push({ kind, x, y, angle, color });
  };

  const makeTowerBlock = (block, rect) => {
    const tall = rng.chance(0.5);
    const towerW = rect.w * rng.range(0.44, 0.54);
    const towerH = rect.h * rng.range(0.38, 0.48);
    addBuilding({ x: rect.x + 6, y: rect.y + 6, w: towerW, h: towerH }, 'tower', tall ? rng.range(96, 158) : rng.range(56, 92));
    addBuilding(
      { x: rect.x + rect.w - rect.w * 0.34, y: rect.y + rect.h - rect.h * 0.3, w: rect.w * 0.3, h: rect.h * 0.26 },
      'shop', rng.range(26, 46),
    );
    addBuilding(
      { x: rect.x + 10, y: rect.y + rect.h - rect.h * 0.28, w: rect.w * 0.3, h: rect.h * 0.24 },
      'kiosk', rng.range(16, 26),
    );
    block.pool = { x: rect.x + rect.w - 88, y: rect.y + 16, w: 62, h: 40 };
    addProp('planter', rect.x + towerW + 30, rect.y + 40);
    addProp('bench', rect.x + towerW + 42, rect.y + 92, 0);
  };

  const makeRowBlock = (block, rect) => {
    const count = rng.int(3, 4);
    let x = rect.x + 3;
    for (let k = 0; k < count; k += 1) {
      const remain = rect.x + rect.w - x;
      const w = k === count - 1 ? remain - 3 : Math.max(54, remain * rng.range(0.26, 0.34));
      const depth = rect.h * rng.range(0.4, 0.52);
      addBuilding({ x, y: rect.y + rect.h - depth, w: w - 5, h: depth }, 'shop', rng.range(26, 54));
      x += w;
    }
    // A second row of low workshops across the alley, with a service lane between.
    const northCount = rng.int(1, 2);
    let nx = rect.x + 8;
    for (let k = 0; k < northCount; k += 1) {
      const remain = rect.x + rect.w - nx - 8;
      const w = k === northCount - 1 ? remain : Math.max(70, remain * 0.55);
      addBuilding({ x: nx, y: rect.y + 6, w: w - 8, h: rect.h * rng.range(0.2, 0.28) }, 'kiosk', rng.range(18, 32));
      nx += w;
    }
    block.lot = { x: rect.x + 10, y: rect.y + rect.h * 0.42, w: rect.w - 20, h: 26, bays: false };
  };

  const makeLotBlock = (block, rect) => {
    block.lot = { x: rect.x + 4, y: rect.y + 54, w: rect.w - 8, h: rect.h - 60, bays: true };
    addBuilding({ x: rect.x + rect.w - 78, y: rect.y + 2, w: 70, h: 40 }, 'kiosk', 22);
    addBuilding({ x: rect.x + 4, y: rect.y + 2, w: 66, h: 36 }, 'shop', rng.range(24, 36));
  };

  const makeMotelBlock = (block, rect) => {
    const wing = rect.w * 0.58;
    addBuilding({ x: rect.x + 5, y: rect.y + 5, w: wing, h: rect.h * 0.3 }, 'motel', rng.range(26, 38));
    addBuilding({ x: rect.x + 5, y: rect.y + rect.h * 0.36, w: rect.w * 0.24, h: rect.h * 0.3 }, 'motel', rng.range(24, 34));
    addBuilding({ x: rect.x + rect.w - 74, y: rect.y + 4, w: 66, h: 40 }, 'kiosk', 20);
    block.pool = { x: rect.x + rect.w * 0.42, y: rect.y + rect.h - 60, w: 92, h: 42 };
    for (let k = 0; k < 3; k += 1) addPalm(rect.x + rect.w * 0.4 + k * 34, rect.y + rect.h * 0.34, 0.9);
  };

  const makeParkBlock = (block, rect) => {
    block.park = { x: rect.x + 2, y: rect.y + 2, w: rect.w - 4, h: rect.h - 4 };
    block.pool = { x: rect.x + rect.w * 0.55, y: rect.y + rect.h * 0.55, w: 74, h: 46 };
    for (let k = 0; k < 11; k += 1) addPalm(rect.x + rng.range(16, rect.w - 16), rect.y + rng.range(16, rect.h - 16), 1.05);
    addProp('fountain', rect.x + rect.w * 0.26, rect.y + rect.h * 0.28);
    addProp('bench', rect.x + rect.w * 0.58, rect.y + rect.h * 0.84, 0);
    addProp('bench', rect.x + rect.w * 0.72, rect.y + rect.h * 0.84, 0);
    addProp('bench', rect.x + rect.w * 0.2, rect.y + rect.h * 0.62, 0);
    addProp('stall', rect.x + rect.w * 0.64, rect.y + rect.h * 0.18, 0, '#26efd4');
  };

  const makeMarketBlock = (block, rect) => {
    addBuilding({ x: rect.x + 4, y: rect.y + 4, w: rect.w - 8, h: rect.h * 0.36 }, 'market', rng.range(22, 34));
    addBuilding({ x: rect.x + 4, y: rect.y + rect.h * 0.44, w: rect.w * 0.32, h: rect.h * 0.22 }, 'kiosk', rng.range(16, 24));
    addProp('stall', rect.x + rect.w * 0.52, rect.y + rect.h * 0.6, 0, '#ff6a3d');
    addProp('stall', rect.x + rect.w * 0.78, rect.y + rect.h * 0.62, 0, '#26efd4');
    addProp('stall', rect.x + rect.w * 0.42, rect.y + rect.h * 0.84, 0, '#ff2f92');
    addProp('stall', rect.x + rect.w * 0.68, rect.y + rect.h * 0.86, 0, '#ffc247');
  };

  const makeYardBlock = (block, rect) => {
    block.yard = { x: rect.x + 2, y: rect.y + 2, w: rect.w - 4, h: rect.h - 4 };
    addBuilding({ x: rect.x + rect.w - 86, y: rect.y + rect.h - 76, w: 80, h: 70 }, 'warehouse', rng.range(22, 34));
    addBuilding({ x: rect.x + 4, y: rect.y + 4, w: rect.w * 0.34, h: rect.h * 0.26 }, 'kiosk', rng.range(16, 26));
    addProp('container', rect.x + 26, rect.y + 92, 0, '#2f7f83');
    addProp('container', rect.x + 92, rect.y + 96, 0.05, '#c13c74');
    addProp('container', rect.x + 158, rect.y + 92, -0.04, '#e9a13b');
    addProp('crate', rect.x + 40, rect.y + 170);
    addProp('crate', rect.x + 140, rect.y + 176);
    addProp('crate', rect.x + 60, rect.y + 208);
  };

  const makers = [
    ['tower', 0.18, makeTowerBlock],
    ['row', 0.24, makeRowBlock],
    ['lot', 0.13, makeLotBlock],
    ['motel', 0.11, makeMotelBlock],
    ['park', 0.1, makeParkBlock],
    ['market', 0.1, makeMarketBlock],
    ['yard', 0.14, makeYardBlock],
  ];

  const pickKind = () => {
    let roll = rng();
    for (const [kind, weight] of makers) {
      if (roll < weight) return kind;
      roll -= weight;
    }
    return 'row';
  };

  for (let j = 0; j < CITY.blocks; j += 1) {
    for (let i = 0; i < CITY.blocks; i += 1) {
      const block = { i, j, ...blockRect(i, j), kind: pickKind(), pool: null, park: null, lot: null, yard: null, buildings: [] };
      blocks.push(block);
      currentBlock = block;
      const maker = makers.find(([kind]) => kind === block.kind)[2];
      maker(block, block);
      // Sidewalk furniture and palms on all four sides, on the pavement band itself.
      const bands = [
        { x0: block.x, x1: block.x + block.w, y: block.y - 13, axis: 'x' },
        { x0: block.x, x1: block.x + block.w, y: block.y + block.h + 13, axis: 'x' },
        { y0: block.y, y1: block.y + block.h, x: block.x - 13, axis: 'y' },
        { y0: block.y, y1: block.y + block.h, x: block.x + block.w + 13, axis: 'y' },
      ];
      for (const band of bands) {
        for (const along of [0.16, 0.44, 0.78]) {
          const jitter = rng.range(-10, 10);
          if (band.axis === 'x') {
            const px = band.x0 + (band.x1 - band.x0) * along + jitter;
            addPalm(px, band.y, rng.range(0.8, 1.15));
            if (rng.chance(0.45)) addProp(rng.pick(['bin', 'hydrant', 'bench', 'planter', 'newsbox']), px + 22, band.y);
          } else {
            const py = band.y0 + (band.y1 - band.y0) * along + jitter;
            addPalm(band.x, py, rng.range(0.8, 1.15));
            if (rng.chance(0.45)) addProp(rng.pick(['bin', 'hydrant', 'planter', 'newsbox']), band.x, py + 22);
          }
        }
      }
      addPalm(block.x - 13, block.y - 13, 0.95);
      addPalm(block.x + block.w + 13, block.y - 13, 0.95);
      addPalm(block.x - 13, block.y + block.h + 13, 0.95);
      addPalm(block.x + block.w + 13, block.y + block.h + 13, 0.95);
    }
  }

  // Lamps and traffic heads at every intersection, on the four corners.
  for (let j = 0; j <= CITY.blocks; j += 1) {
    for (let i = 0; i <= CITY.blocks; i += 1) {
      const x = i * CITY.pitch;
      const y = j * CITY.pitch;
      const corners = [
        [x - CITY.half - 16, y - CITY.half - 16, -Math.PI * 0.75],
        [x + CITY.half + 16, y - CITY.half - 16, -Math.PI * 0.25],
        [x - CITY.half - 16, y + CITY.half + 16, Math.PI * 0.75],
        [x + CITY.half + 16, y + CITY.half + 16, Math.PI * 0.25],
      ];
      for (const [lx, ly, angle] of corners) addLamp(lx, ly, angle);
    }
  }

  // Standing neon billboards on the pavement, facing the camera down the street.
  for (const block of blocks) {
    if (!(block.kind === 'lot' || block.kind === 'yard' || block.kind === 'row')) continue;
    if (!rng.chance(0.55)) continue;
    const color = rng.pick([PALETTE.neonPink, PALETTE.neonTeal, PALETTE.neonAmber, PALETTE.neonViolet]);
    billboards.push({
      x: block.x + block.w * rng.range(0.15, 0.7),
      y: block.y + block.h + 16,
      w: rng.range(110, 150),
      h: rng.range(34, 46),
      text: rng.pick(SIGN_WORDS),
      color,
    });
  }

  // Parked cars: bays in the lots, and a couple at the kerb on the south and north sides.
  for (const block of blocks) {
    if (block.lot) {
      const count = block.lot.bays ? rng.int(4, 7) : 0;
      for (let k = 0; k < count; k += 1) {
        const type = rng.pick(['sedan', 'pickup', 'van', 'taxi', 'muscle']);
        parked.push({
          type,
          x: block.lot.x + 28 + (k % 4) * 62,
          y: block.lot.y + 28 + Math.floor(k / 4) * 68,
          angle: rng.chance(0.5) ? 0 : Math.PI,
        });
      }
    }
    const south = rng.int(0, 2);
    for (let k = 0; k < south; k += 1) {
      parked.push({
        type: rng.pick(['sedan', 'taxi', 'muscle', 'van', 'pickup']),
        x: block.x + 54 + k * 96 + rng.range(-10, 10),
        y: block.y + block.h + 20,
        angle: rng.chance(0.5) ? 0 : Math.PI,
      });
    }
    if (rng.chance(0.45)) {
      parked.push({
        type: rng.pick(['sedan', 'sports', 'muscle']),
        x: block.x + rng.range(50, block.w - 50),
        y: block.y - 20,
        angle: rng.chance(0.5) ? 0 : Math.PI,
      });
    }
  }

  // Points of interest: named spots spread across town, snapped onto the pavement.
  const near = (i, j, dx, dy) => ({
    x: (i + 0.5) * CITY.pitch + dx,
    y: (j + 0.5) * CITY.pitch + dy,
  });
  const snapWalk = (x, y) => {
    const i = Math.max(0, Math.min(CITY.blocks - 1, Math.floor(x / CITY.pitch)));
    const j = Math.max(0, Math.min(CITY.blocks - 1, Math.floor(y / CITY.pitch)));
    const x0 = i * CITY.pitch + CITY.walkLine;
    const x1 = (i + 1) * CITY.pitch - CITY.walkLine;
    const y0 = j * CITY.pitch + CITY.walkLine;
    const y1 = (j + 1) * CITY.pitch - CITY.walkLine;
    const sides = [
      { d: Math.abs(x - x0), x: x0, y: Math.max(y0, Math.min(y1, y)) },
      { d: Math.abs(x1 - x), x: x1, y: Math.max(y0, Math.min(y1, y)) },
      { d: Math.abs(y - y0), x: Math.max(x0, Math.min(x1, x)), y: y0 },
      { d: Math.abs(y1 - y), x: Math.max(x0, Math.min(x1, x)), y: y1 },
    ];
    sides.sort((a, b) => a.d - b.d);
    return { x: sides[0].x, y: sides[0].y };
  };
  Object.assign(points, {
    safehouse: { ...near(4, 5, -60, 96), label: 'SAFEHOUSE', district: 'VELVET SQUARE' },
    mara: { ...near(4, 5, 120, -40), label: 'MARA QUILL', district: 'VELVET SQUARE' },
    kemp: { ...near(8, 8, -100, 60), label: 'DOC KEMP', district: 'CINDER COURT' },
    hospital: { ...near(9, 2, -40, 80), label: 'BAY GENERAL', district: 'SUNSET STRIP' },
    police: { ...near(6, 7, 90, -50), label: 'VCPD HQ', district: 'CINDER COURT' },
    gunshop: { ...near(3, 9, 40, 60), label: 'PIER 12 ARMS', district: 'THE TIDEPOOL' },
    garage: { ...near(10, 10, -70, -40), label: 'SALT AIR GARAGE', district: 'SALT AIRFIELD' },
    airfield: { ...near(11, 11, 30, 40), label: 'SALT AIRFIELD', district: 'SALT AIRFIELD' },
    tidepool: { ...near(2, 10, 80, -30), label: 'THE TIDEPOOL', district: 'THE TIDEPOOL' },
    boardwalk: { ...near(1, 8, 20, 60), label: 'HALCYON BOARDWALK', district: 'HALCYON BEACH' },
    motel: { ...near(5, 3, -40, 40), label: 'MOTEL 9', district: 'KESTREL HEIGHTS' },
    docks: { ...near(1, 4, 40, -20), label: 'MARLOWE DOCKS', district: 'MARLOWE DOCKS' },
  });
  for (const key of Object.keys(points)) {
    const snapped = snapWalk(points[key].x, points[key].y);
    points[key].x = snapped.x;
    points[key].y = snapped.y;
  }

  // Pickups: a health kit outside the hospital, armour at the precinct, ammo at the gun shop.
  pickups.push(
    { kind: 'health', x: points.hospital.x + 26, y: points.hospital.y + 26, taken: 0 },
    { kind: 'armour', x: points.police.x - 30, y: points.police.y + 34, taken: 0 },
    { kind: 'ammo', x: points.gunshop.x + 22, y: points.gunshop.y - 18, taken: 0 },
    { kind: 'ammo', x: points.docks.x + 18, y: points.docks.y + 40, taken: 0 },
  );

  const districtAt = (x, y) => {
    const col = Math.min(2, Math.max(0, Math.floor((x / CITY.size) * 3)));
    const row = Math.min(2, Math.max(0, Math.floor((y / CITY.size) * 3)));
    return DISTRICT_NAMES[row * 3 + col];
  };

  /** Buildings whose rect is within reach of a circle at x,y (a cheap block walk). */
  function buildingsNear(x, y, radius = 0) {
    const i0 = Math.max(0, Math.floor((x - radius - CITY.half - CITY.walk) / CITY.pitch));
    const i1 = Math.min(CITY.blocks - 1, Math.floor((x + radius) / CITY.pitch));
    const j0 = Math.max(0, Math.floor((y - radius - CITY.half - CITY.walk) / CITY.pitch));
    const j1 = Math.min(CITY.blocks - 1, Math.floor((y + radius) / CITY.pitch));
    const found = [];
    for (let j = j0; j <= j1; j += 1) {
      for (let i = i0; i <= i1; i += 1) {
        const block = blocks[j * CITY.blocks + i];
        for (const b of block.buildings) found.push(b);
      }
    }
    return found;
  }

  function buildingAt(x, y, radius = 0) {
    const near = buildingsNear(x, y, radius + 4);
    for (const b of near) {
      if (x + radius > b.x && x - radius < b.x + b.w && y + radius > b.y && y - radius < b.y + b.h) return b;
    }
    return null;
  }

  /** True when a straight line crosses any building: used by line of sight for the police. */
  function lineBlocked(ax, ay, bx, by) {
    const near = buildingsNear(((ax + bx) / 2), ((ay + by) / 2), Math.hypot(bx - ax, by - ay) / 2 + 8);
    for (const b of near) if (segmentCrosses(ax, ay, bx, by, b)) return true;
    return false;
  }

  return {
    blocks, buildings, props, palms, lamps, signs, billboards, parked, pickups, points,
    districtAt, buildingsNear, buildingAt, lineBlocked, blockAtPoint, blockRect,
  };
}

const DISTRICT_NAMES = [
  'LANTERN ROW', 'SUNSET STRIP', 'KESTREL HEIGHTS',
  'MARLOWE DOCKS', 'VELVET SQUARE', 'CINDER COURT',
  'THE TIDEPOOL', 'HALCYON BEACH', 'SALT AIRFIELD',
];

/** A small, dark alias so building maths can call it without importing the helper everywhere. */
function segmentCrosses(ax, ay, bx, by, rect) {
  let tmin = 0;
  let tmax = 1;
  const dx = bx - ax;
  const dy = by - ay;
  for (let axis = 0; axis < 2; axis += 1) {
    const origin = axis === 0 ? ax : ay;
    const dir = axis === 0 ? dx : dy;
    const min = axis === 0 ? rect.x : rect.y;
    const max = axis === 0 ? rect.x + rect.w : rect.y + rect.h;
    if (Math.abs(dir) < 1e-9) {
      if (origin < min || origin > max) return false;
    } else {
      let t1 = (min - origin) / dir;
      let t2 = (max - origin) / dir;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return false;
    }
  }
  return tmin <= tmax;
}

/** Lighten (positive) or darken (negative) a #rrggbb colour. */
export function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const mix = (v) => Math.max(0, Math.min(255, Math.round(amount >= 0 ? v + (255 - v) * amount : v * (1 + amount))));
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

export function vehicleColor(rng, type) {
  return rng.pick(VEHICLES[type].colors);
}
