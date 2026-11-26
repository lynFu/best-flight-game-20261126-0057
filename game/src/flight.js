// flight.js — the flight model and the mission state machine.
// One job: turn pilot input into a moving aeroplane, and decide what a
// sortie is worth. No drawing here.

import { CFG } from './config.js';
import { groundHeight, onRunway } from './world.js';

export function newFlight() {
  return {
    // Position in metres: x east, y up, z south. Heading 0 = north (-z).
    // Parked just south of the runway, ready to roll onto the strip.
    x: -260, y: 5.4, z: -950,
    heading: 0,
    pitch: 0, // nose up positive, radians
    roll: 0, // bank, radians (positive = right wing down)
    speed: 0,
    throttle: 0,
    fuel: CFG.fuelStart,
    score: 0,
    ringsPassed: 0,
    time: 0, // seconds since takeoff
    state: 'title', // title | flying | crashed | landed | complete
    message: '',
    messageUntil: 0,
    crashReason: '',
    verticalSpeed: 0,
    landedAt: 0,
    airborne: false, // true once the wheels have left the ground
  };
}

export function startFlight(f) {
  f.state = 'flying';
  f.time = 0;
  f.score = 0;
  f.ringsPassed = 0;
  f.fuel = CFG.fuelStart;
  f.speed = 0;
  f.throttle = 0.55;
  f.x = -260; f.y = 5.4; f.z = -950;
  f.heading = 0; f.pitch = 0; f.roll = 0;
  f.airborne = false;
  f.message = 'Take off! Full throttle, then pull up gently.';
  f.messageUntil = 6;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// One simulation step. `input` is { pitch, roll, throttleDelta } in -1..1.
export function stepFlight(f, input, dt, rings) {
  if (f.state !== 'flying') return;
  f.time += dt;

  f.throttle = clamp(f.throttle + input.throttleDelta * CFG.throttleRate * dt, 0, 1);
  if (f.fuel <= 0) f.throttle = 0;

  // Pitch and roll ease toward the pilot's command.
  const targetPitch = input.pitch * CFG.maxPitch;
  const targetRoll = input.roll * CFG.maxRoll;
  f.pitch += clamp(targetPitch - f.pitch, -CFG.pitchRate * dt, CFG.pitchRate * dt);
  f.roll += clamp(targetRoll - f.roll, -CFG.rollRate * dt, CFG.rollRate * dt);

  // Bank turns the aeroplane; the turn tightens with speed.
  f.heading += -f.roll * CFG.turnRate * (f.speed / CFG.maxSpeed) * dt;

  // Speed chases the throttle setting; drag grows with the square of speed.
  const targetSpeed = f.throttle * CFG.maxSpeed;
  const accel = targetSpeed > f.speed ? 9 : 13;
  f.speed += clamp(targetSpeed - f.speed, -accel * dt, accel * dt);

  // Lift: climbing costs speed, sinking gains a little; below flying speed
  // the wing stalls and the plane drops.
  const stalled = f.speed < CFG.minFlySpeed;
  const climb = stalled
    ? -CFG.maxSink * (1 - f.speed / CFG.minFlySpeed)
    : f.speed * Math.sin(f.pitch) * 0.9;
  f.verticalSpeed = climb;
  f.y += climb * dt;

  const fx = Math.sin(f.heading);
  const fz = -Math.cos(f.heading);
  f.x += fx * f.speed * Math.cos(f.pitch) * dt;
  f.z += fz * f.speed * Math.cos(f.pitch) * dt;

  // Fuel burns with throttle; empty tanks mean a glide, not a fall.
  f.fuel = Math.max(0, f.fuel - (0.12 + f.throttle * CFG.fuelDrain) * dt);

  // Leaving the chart: warn, then gently push the pilot back.
  if (Math.abs(f.x) > CFG.worldHalf || Math.abs(f.z) > CFG.worldHalf) {
    f.message = 'Edge of the chart — turn back toward the islands!';
    f.messageUntil = f.time + 1.5;
    f.heading += angleDiff(Math.atan2(-f.x, -f.z), f.heading) * 0.4 * dt;
  }

  // Rings: crossing the ring's plane inside its circle scores.
  for (const ring of rings) {
    if (ring.passed) continue;
    const dx = f.x - ring.x;
    const dy = f.y - ring.y;
    const dz = f.z - ring.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < ring.radius) {
      ring.passed = true;
      f.ringsPassed += 1;
      f.score += CFG.ringScore;
      f.message = `Ring ${f.ringsPassed} of ${CFG.ringCount}! +${CFG.ringScore}`;
      f.messageUntil = f.time + 2.5;
    }
  }

  // Ground contact.
  const ground = groundHeight(f.x, f.z);
  if (f.y > ground + 8) f.airborne = true;
  if (f.y <= ground + 1.4) {
    f.y = ground + 1.4;
    const onStrip = onRunway(f.x, f.z);
    const gentle = f.verticalSpeed > -6 && f.speed < 38 && Math.abs(f.roll) < 0.4;
    if (onStrip && gentle && f.ringsPassed >= CFG.ringCount) {
      f.state = 'complete';
      f.landedAt = f.time;
      f.speed = 0;
      const timeBonus = Math.max(0, Math.round(600 - f.time * 2));
      f.score += CFG.landingScore + timeBonus;
    } else if (onStrip && gentle) {
      f.state = 'landed';
      f.landedAt = f.time;
      f.message = `Landed — but ${CFG.ringCount - f.ringsPassed} ring(s) left. Press R to fly again.`;
      f.messageUntil = f.time + 5;
      f.speed = 0;
    } else if (!f.airborne) {
      // Still on the ground: parked, taxiing or on the takeoff roll.
      // Rolling into rising terrain at speed is a crash; flat ground is fine.
      const ahead = groundHeight(
        f.x + Math.sin(f.heading) * 12,
        f.z - Math.cos(f.heading) * 12,
      );
      if (ahead - ground > 2 && f.speed > 12) {
        f.state = 'crashed';
        f.crashReason = 'Ran off the airfield into the hills.';
      } else {
        f.verticalSpeed = 0;
      }
    } else if (f.verticalSpeed <= -6 || f.speed > 38) {
      f.state = 'crashed';
      f.crashReason = f.y < 2 && ground <= 0.5
        ? 'Ditched in the sea.'
        : stalled
          ? 'Stalled into the ground.'
          : 'Flew into the terrain.';
    } else {
      // A gentle touchdown off the strip: a soft field landing.
      f.state = 'landed';
      f.landedAt = f.time;
      f.message = 'Down in a field — the runway is the safe way home. Press R to fly again.';
      f.messageUntil = f.time + 5;
      f.speed = 0;
    }
  }

  if (f.fuel <= 0 && f.state === 'flying') {
    f.message = 'Fuel empty — gliding! Find the runway.';
    f.messageUntil = f.time + 2;
  }
}

export function nextRing(rings) {
  return rings.find((r) => !r.passed) ?? null;
}
