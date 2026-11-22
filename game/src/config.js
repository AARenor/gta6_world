// Vesper City's master switchboard: every tuning number, colour and name lives here, so the
// simulation modules read like rules rather than magic numbers. The HUD is laid out in a
// 1920x1080 logical space and scaled to whatever canvas the window gives it; the world is
// measured in world pixels, with the camera's own zoom on top.

export const CITY_NAME = 'VESPER CITY';
export const TAGLINE = 'SUNSET SYNDICATE';
export const STEP = 1 / 60;
export const LOGICAL = { width: 1920, height: 1080 };

/** The grid: blocks are separated by four-lane roads, each with a wide sidewalk. */
export const CITY = {
  blocks: 13,
  pitch: 430,
  road: 112,
  walk: 24,
  seed: 618031,
};
CITY.half = CITY.road / 2;
CITY.size = CITY.blocks * CITY.pitch;
CITY.inner = CITY.pitch - 2 * (CITY.half + CITY.walk);
/** Distance from a road's centre line to a sidewalk's centre line. */
CITY.walkLine = CITY.half + CITY.walk / 2;

/** Lane centre offsets from the road's centre line: an inner and an outer lane each way. */
export const LANES = { inner: 15, outer: 43, width: 27 };

export const CAMERA = { zoom: 1.3, follow: 6.5, lookAhead: 0.42, maxLook: 210 };

export const PLAYER = {
  radius: 10,
  walk: 172,
  sprint: 282,
  turn: 14,
  health: 100,
  armour: 0,
  startMoney: 500,
  startX: 0,
  startY: 0,
};

export const HEAT = {
  maxStars: 5,
  starChance: [0, 55, 105, 175, 255, 360],
  coolStealth: 5.5,
  coolRate: 0.9,
  bustRange: 34,
  bustSeconds: 2.4,
};

export const WEAPONS = {
  pistol: {
    id: 'pistol', name: 'LANTERN 9', tag: '9MM', damage: 26, rate: 0.24, spread: 0.018,
    range: 640, clip: 12, reserve: 84, pellets: 1, kick: 2.6, auto: false, tracer: '#ffe6a3',
  },
  smg: {
    id: 'smg', name: 'GUTTER SMG', tag: 'SMG', damage: 15, rate: 0.078, spread: 0.055,
    range: 560, clip: 32, reserve: 192, pellets: 1, kick: 1.4, auto: true, tracer: '#ffd27a',
  },
  shotgun: {
    id: 'shotgun', name: 'PIER TWELVE', tag: '12G', damage: 13, rate: 0.72, spread: 0.13,
    range: 380, clip: 6, reserve: 36, pellets: 6, kick: 7, auto: false, tracer: '#ffc66a',
  },
};

/** Vehicle classes. Sizes are world pixels; maxSpeed is px per second on the road. */
export const VEHICLES = {
  sedan: {
    name: 'PALE RUNNER', w: 42, h: 21, maxSpeed: 430, accel: 260, brake: 760, grip: 8.4,
    mass: 1, colors: ['#e8dcc4', '#5c8fa8', '#c95b6b', '#7f8f6a', '#d7a44c', '#8a6d9e'],
  },
  muscle: {
    name: 'VELA THUNDER', w: 48, h: 23, maxSpeed: 556, accel: 340, brake: 800, grip: 7.2,
    mass: 1.15, colors: ['#ff6a3d', '#c93a67', '#f2c94c', '#2f7f83', '#efe3cf'],
  },
  sports: {
    name: 'KESTREL GT', w: 46, h: 21, maxSpeed: 628, accel: 400, brake: 860, grip: 7.8,
    mass: 1, colors: ['#25d0c0', '#ff3f7a', '#f6f0e2', '#4a5cff'],
  },
  taxi: {
    name: 'LANTERN CAB', w: 43, h: 21, maxSpeed: 415, accel: 250, brake: 740, grip: 8,
    mass: 1, colors: ['#f6c33d'],
  },
  van: {
    name: 'MARLOWE HAULER', w: 50, h: 24, maxSpeed: 372, accel: 210, brake: 640, grip: 6.6,
    mass: 1.5, colors: ['#d9d2c2', '#4f7078', '#a9566a'],
  },
  pickup: {
    name: 'RANCHER 150', w: 48, h: 23, maxSpeed: 470, accel: 290, brake: 700, grip: 6.9,
    mass: 1.2, colors: ['#8f5a3c', '#3f6d57', '#cfd5d2'],
  },
  police: {
    name: 'VCPD CRUISER', w: 47, h: 22, maxSpeed: 610, accel: 400, brake: 880, grip: 8,
    mass: 1.2, colors: ['#f2f0ea'],
  },
  courier: {
    name: 'COURIER COUPE', w: 45, h: 21, maxSpeed: 540, accel: 330, brake: 780, grip: 7.4,
    mass: 1, colors: ['#3b2b45'],
  },
  ambulance: {
    name: 'BAY AMBULANCE', w: 50, h: 24, maxSpeed: 440, accel: 260, brake: 720, grip: 7,
    mass: 1.4, colors: ['#f4f1e6'],
  },
};

/** The palette: a golden-hour Vice coast, warm concrete under magenta and teal neon. */
export const PALETTE = {
  asphalt: '#2a2534',
  asphaltDark: '#211d2b',
  asphaltLight: '#332c3d',
  lane: '#f3dfb6',
  laneCentre: '#ffc451',
  walk: '#c39a90',
  walkJoint: '#a98079',
  curb: '#f1d6c6',
  curbDark: '#b98c82',
  grass: '#2f7f5e',
  grassLight: '#3f9a70',
  sand: '#e3bd8b',
  water: '#1f8f9e',
  waterDeep: '#146478',
  pool: '#3ec7c7',
  lot: '#3a3442',
  roof: '#8d6470',
  shadow: 'rgba(20, 12, 32, 0.42)',
  neonPink: '#ff2f92',
  neonTeal: '#26efd4',
  neonAmber: '#ffc247',
  neonViolet: '#9d6bff',
  neonLime: '#b8ff5e',
  windowLit: '#ffd891',
  windowDark: '#3a3550',
  duskTop: '#ffb173',
  duskBottom: '#3a2055',
  night: '#171126',
  text: '#f7f1e6',
  muted: '#b9a9b7',
  panel: 'rgba(16, 10, 24, 0.82)',
  panelEdge: 'rgba(255, 193, 94, 0.55)',
  danger: '#ff4d5e',
  health: '#54e08a',
  armour: '#59b8ff',
  wanted: '#ffd34d',
  policeRed: '#ff3355',
  policeBlue: '#3d7bff',
  money: '#8bf0b5',
  reward: '#ffcf5c',
};

export const DISTRICTS = [
  { name: 'LANTERN ROW', short: 'Lantern', color: '#ff8fb8', x: 0.18, y: 0.2 },
  { name: 'SUNSET STRIP', short: 'Sunset', color: '#ffb066', x: 0.52, y: 0.13 },
  { name: 'KESTREL HEIGHTS', short: 'Kestrel', color: '#9d6bff', x: 0.84, y: 0.24 },
  { name: 'MARLOWE DOCKS', short: 'Docks', color: '#26efd4', x: 0.12, y: 0.56 },
  { name: 'VELVET SQUARE', short: 'Velvet', color: '#ff2f92', x: 0.5, y: 0.5 },
  { name: 'CINDER COURT', short: 'Cinder', color: '#ff6a3d', x: 0.86, y: 0.58 },
  { name: 'THE TIDEPOOL', short: 'Tidepool', color: '#59b8ff', x: 0.22, y: 0.86 },
  { name: 'HALCYON BEACH', short: 'Halcyon', color: '#ffd34d', x: 0.56, y: 0.9 },
  { name: 'SALT AIRFIELD', short: 'Airfield', color: '#b8ff5e', x: 0.88, y: 0.88 },
];

/** Radio dial: shown bottom-right, purely flavour, with the district tuned in. */
export const RADIO = [
  { dial: 'KVSP 101.3', name: 'PALM STATIC', tag: 'sun-bleached soul' },
  { dial: 'KNTR 96.7', name: 'NEON DRIFT', tag: 'synthwave' },
  { dial: 'WAVE 88.1', name: 'TIDE FM', tag: 'slow jams' },
  { dial: 'KMBX 104.9', name: 'MOTHER OF PEARL', tag: 'garage rock' },
];

export const FONT = {
  head: '"Montserrat", "Lato", "DejaVu Sans", sans-serif',
  body: '"Lato", "DejaVu Sans", system-ui, sans-serif',
  mono: '"Roboto Condensed", "DejaVu Sans Mono", monospace',
  narrow: '"Roboto Condensed", "Lato", "DejaVu Sans", sans-serif',
};

export const SAVE_KEY = 'vesper-city.night-shift.v1';

/** The story's cast. Names, lines and city are invented for this game. */
export const CAST = {
  player: { name: 'RAY CALLE', role: 'wheelman', skin: '#a9714b', shirt: '#3b4d7a' },
  mara: { name: 'MARA QUILL', role: 'fixer', skin: '#8d5a3b', shirt: '#c93a67' },
  kemp: { name: 'DOC KEMP', role: 'chop-shop surgeon', skin: '#d9a077', shirt: '#2f7f83' },
  vega: { name: 'LYRA VEGA', role: 'the buyer', skin: '#e0b38c', shirt: '#9d6bff' },
  cane: { name: 'SGT. CANE', role: 'VCPD', skin: '#5f3f2c', shirt: '#3a3550' },
};

/** The three story jobs, in order. */
export const STORY = [
  { id: 'first-light', num: 1, title: 'FIRST LIGHT', giver: 'mara', reward: 900 },
  { id: 'undertow', num: 2, title: 'UNDERTOW', giver: 'kemp', reward: 2400 },
  { id: 'tidepool-ledger', num: 3, title: 'LAST LIGHT AT THE TIDEPOOL', giver: 'mara', reward: 9000 },
];

export const CONTROLS = [
  ['WASD', 'MOVE / DRIVE'],
  ['MOUSE', 'AIM'],
  ['CLICK', 'FIRE'],
  ['E', 'ENTER / LEAVE CAR'],
  ['SPACE', 'HANDBRAKE'],
  ['SHIFT', 'SPRINT'],
  ['1 2 3', 'WEAPON'],
  ['R', 'RELOAD'],
  ['M', 'MAP'],
  ['ESC', 'PAUSE'],
];
