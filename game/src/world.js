// world.js — the island chain: terrain height, the runway, the ring course,
// trees, houses and clouds. One job: answer "what is here?" for any point.

import { CFG } from './config.js';
import { makeNoise, mulberry32 } from './random.js';

const noiseA = makeNoise(1337, 300);
const noiseB = makeNoise(4242, 130);

// Island centres: [x, z, radius, peak height]. The main island holds the runway.
const ISLANDS = [
  [-260, -900, 1050, 150], // main island, runway on its south flat
  [1150, 350, 700, 110], // east island
  [-1250, 750, 620, 95], // south-west island
  [650, -1350, 520, 80], // north-east islet
  [-1500, -1350, 430, 60], // north-west islet
];

function islandHeight(x, z) {
  let h = -26; // sea floor
  for (const [cx, cz, r, peak] of ISLANDS) {
    const dx = (x - cx) / r;
    const dz = (z - cz) / r;
    const d2 = dx * dx + dz * dz;
    if (d2 < 1) {
      const fall = Math.cos(d2 * Math.PI * 0.5); // 1 at centre, 0 at shore
      const hills = 0.55 + 0.45 * noiseA(x, z) + 0.25 * noiseB(x, z);
      h = Math.max(h, -6 + fall * peak * Math.max(0.15, hills));
    }
  }
  return h;
}

function airfieldBlend(x, z) {
  // A flat airfield plain around the runway, with a 650 m approach corridor
  // to the south, so the strip is visible on final and from the threshold.
  const r = CFG.runway;
  const hw = r.width / 2 + 30;
  const zNorth = r.z - r.length / 2 - 40;
  const zSouth = -320;
  const dx = Math.max(0, Math.abs(x - r.x) - hw);
  const dz = Math.max(0, zNorth - z, z - zSouth);
  const d = Math.sqrt(dx * dx + dz * dz);
  const t = Math.min(1, d / 500);
  return t * t * (3 - 2 * t); // 0 flat, 1 untouched
}

// Height of the ground at (x, z) in metres; below 0 is under water.
export function groundHeight(x, z) {
  let h = islandHeight(x, z);
  const t = airfieldBlend(x, z);
  return h * t + 4 * (1 - t);
}

export function onRunway(x, z) {
  const r = CFG.runway;
  return (
    Math.abs(x - r.x) <= r.width / 2 &&
    Math.abs(z - r.z) <= r.length / 2
  );
}

// The ring course: a loop out over the islands and back to the runway.
function buildRings() {
  const spots = [
    [-260, 150, -700],
    [500, 190, -350],
    [1150, 170, 350],
    [350, 210, 900],
    [-650, 160, 500],
  ];
  return spots.map(([x, y, z], i) => ({
    index: i,
    x, y, z,
    radius: CFG.ringRadius,
    passed: false,
    // Rings face the next leg of the course so the pilot sees them head-on.
    heading: Math.atan2(
      (spots[(i + 1) % spots.length][0] - x),
      (spots[(i + 1) % spots.length][2] - z),
    ),
  }));
}

function scatter(seed, count, pick) {
  const rand = mulberry32(seed);
  const out = [];
  let guard = 0;
  while (out.length < count && guard < count * 40) {
    guard += 1;
    const x = (rand() * 2 - 1) * (CFG.worldHalf - 80);
    const z = (rand() * 2 - 1) * (CFG.worldHalf - 80);
    const h = groundHeight(x, z);
    if (h > 6 && !onRunway(x, z)) out.push(pick(x, z, h, rand));
  }
  return out;
}

export function buildWorld() {
  const trees = scatter(777, 170, (x, z, h, rand) => ({
    x, z, y: h,
    size: 5 + rand() * 7,
    shade: 0.75 + rand() * 0.25,
  }));
  const houses = scatter(5150, 26, (x, z, h, rand) => ({
    x, z, y: h,
    w: 8 + rand() * 6,
    hgt: 5 + rand() * 4,
    roof: ['#c96f4a', '#d9a05b', '#7d9bb5'][Math.floor(rand() * 3)],
  }));
  const clouds = [];
  const rand = mulberry32(99);
  for (let i = 0; i < 16; i += 1) {
    clouds.push({
      x: (rand() * 2 - 1) * 1900,
      z: (rand() * 2 - 1) * 1900,
      y: 300 + rand() * 130,
      size: 90 + rand() * 130,
    });
  }
  return { rings: buildRings(), trees, houses, clouds };
}
