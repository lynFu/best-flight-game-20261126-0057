// config.js — tuning constants for Sky Courier: Island Run.
// One job: every number the flight model, world and HUD agree on.

export const CFG = {
  // World size in metres. The flyable island chain sits inside this square.
  worldHalf: 2000,
  seaLevel: 0,
  // Flight model
  maxSpeed: 62, // m/s at full throttle
  minFlySpeed: 17, // below this the wing stops flying and the plane sinks
  maxClimb: 14, // m/s vertical at full power, level pitch
  maxSink: 22, // m/s vertical when stalled
  throttleRate: 0.55, // throttle units per second
  pitchRate: 0.62, // radians per second of pitch input
  maxPitch: 0.5, // radians, nose up/down limit
  rollRate: 1.5, // radians per second of roll input
  maxRoll: 1.05, // radians of bank
  turnRate: 0.55, // heading change per radian of bank, per second, scaled by speed
  fuelDrain: 0.5, // fuel units per second at full throttle
  fuelStart: 130,
  // Camera
  camBack: 15, // metres behind the plane
  camUp: 4.6, // metres above the plane
  camLookAhead: 34, // metres ahead of the plane the camera aims at
  fov: 1.15, // radians, vertical field of view
  // Course
  ringRadius: 16, // metres; fly through the glowing ring
  ringCount: 5,
  ringScore: 100,
  landingScore: 500,
  // Runway (flat strip on the main island, north-south)
  runway: { x: -260, z: -1180, length: 420, width: 34, heading: 0 },
};
