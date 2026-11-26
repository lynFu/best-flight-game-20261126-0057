// shots.js — deterministic states for the maker's screenshots.
// One job: given ?shot=start|cruise|ring|land, place the aeroplane so the
// screenshot shows the game at its best. These are real renders of the
// game's own code, the same trick the kit's starter uses in shots.json.

import { CFG } from './config.js';

export function applyShot(game, name) {
  const { f, world } = game;
  const ring = (i) => world.rings[i];
  if (name === 'start') {
    // Parked on the apron just south of the runway, strip ahead.
    f.state = 'title';
    f.x = -260; f.y = 5.4; f.z = -950;
    f.heading = 0; f.pitch = 0; f.roll = 0;
    f.speed = 0; f.throttle = 0; f.fuel = 100; f.score = 0; f.time = 0;
  } else if (name === 'cruise') {
    // Climbing out over the airfield toward the first ring, dead ahead.
    f.state = 'flying';
    f.x = -260; f.y = 160; f.z = -520;
    f.heading = 0; f.pitch = 0.02; f.roll = -0.10;
    f.speed = 44; f.throttle = 0.72; f.fuel = 78; f.score = 0; f.time = 12;
    f.ringsPassed = 0;
  } else if (name === 'ring') {
    // Seconds from the third ring, the golden circle filling the view.
    // Ring 3 sits at (1150, 170, 350) facing the next leg; approach head-on.
    f.state = 'flying';
    f.x = 1248; f.y = 170; f.z = 418;
    f.heading = -0.96; f.pitch = 0; f.roll = 0.05;
    f.speed = 48; f.throttle = 0.8; f.fuel = 61; f.score = 200; f.time = 88;
    ring(0).passed = true;
    ring(1).passed = true;
    f.ringsPassed = 2;
  } else if (name === 'land') {
    // Final approach: low over the airfield plain, runway straight ahead,
    // offset from the centreline so the strip shows beside the fuselage.
    f.state = 'flying';
    f.x = -285; f.y = 38; f.z = -800;
    f.heading = 0.05; f.pitch = -0.06; f.roll = 0;
    f.speed = 30; f.throttle = 0.35; f.fuel = 34; f.score = 500; f.time = 171;
    for (const r of world.rings) r.passed = true;
    f.ringsPassed = CFG.ringCount;
  } else {
    return false;
  }
  // Screenshots freeze the flight: the frame is the state, not the sim.
  game.frozen = true;
  return true;
}
