// random.js — small seeded random numbers and value noise.
// One job: deterministic terrain and scenery from a single seed, so a
// screenshot taken twice of the same state looks the same.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth 2D value noise on a coarse lattice, built from the seeded rng.
export function makeNoise(seed, cell = 260) {
  const rand = mulberry32(seed);
  const grid = new Map();
  const lattice = (ix, iz) => {
    const key = ix + ',' + iz;
    let v = grid.get(key);
    if (v === undefined) {
      v = rand();
      grid.set(key, v);
    }
    return v;
  };
  const smooth = (t) => t * t * (3 - 2 * t);
  return function noise(x, z) {
    const gx = x / cell;
    const gz = z / cell;
    const ix = Math.floor(gx);
    const iz = Math.floor(gz);
    const fx = smooth(gx - ix);
    const fz = smooth(gz - iz);
    const a = lattice(ix, iz);
    const b = lattice(ix + 1, iz);
    const c = lattice(ix, iz + 1);
    const d = lattice(ix + 1, iz + 1);
    return (a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz) * 2 - 1;
  };
}
