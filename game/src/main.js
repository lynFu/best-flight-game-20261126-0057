// main.js — bootstrap and the game loop for Sky Courier: Island Run.
// One job: own the frame, the state machine and the wiring between modules.

import { CFG } from './config.js';
import { newFlight, startFlight, stepFlight } from './flight.js';
import { buildWorld } from './world.js';
import { createRenderer } from './render.js';
import { drawHud, drawTitle, drawCrashed, drawLanded, drawComplete } from './hud.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

const game = {
  f: newFlight(),
  world: buildWorld(),
  frozen: false, // set by ?shot= : render a fixed state for screenshots
};

const renderer = createRenderer();
const audio = createAudio();
let lastRingCount = 0;
let lastState = game.f.state;

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
}
window.addEventListener('resize', resize);
resize();

const input = createInput(canvas, (action) => {
  audio.unlock();
  const f = game.f;
  if (action === 'confirm') {
    audio.click();
    if (f.state === 'title') startFlight(f);
    else if (f.state === 'crashed' || f.state === 'landed' || f.state === 'complete') {
      game.world = buildWorld();
      game.f = newFlight();
      startFlight(game.f);
    }
  } else if (action === 'restart') {
    if (f.state !== 'title') {
      game.world = buildWorld();
      game.f = newFlight();
      startFlight(game.f);
    }
  }
});

// A ?shot= query freezes a staged state so screenshots are reproducible.
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) applyShot(game, shot);

// Debug handle for automated play-testing; harmless in play.
window.__skyCourier = game;

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const f = game.f;
  const t = now / 1000;

  if (!game.frozen && f.state === 'flying') {
    stepFlight(f, input.read(), dt, game.world.rings);
  }
  if (f.ringsPassed > lastRingCount) {
    audio.ring();
    lastRingCount = f.ringsPassed;
  }
  if (f.state !== lastState) {
    if (f.state === 'crashed') audio.crash();
    if (f.state === 'complete' || f.state === 'landed') audio.land();
    lastState = f.state;
    statusEl.textContent =
      f.state === 'crashed'
        ? `Crashed. ${f.crashReason} Score ${Math.round(f.score)}.`
        : f.state === 'complete'
          ? `Course complete! Final score ${Math.round(f.score)}.`
          : f.state === 'landed'
            ? 'Landed on the runway.'
            : '';
  }
  audio.update(f.throttle, f.speed, f.state === 'flying');

  renderer.render(ctx, game, t);
  if (f.state === 'title') drawTitle(ctx);
  else {
    drawHud(ctx, game, t);
    if (f.state === 'crashed') drawCrashed(ctx, f);
    else if (f.state === 'landed') drawLanded(ctx, f);
    else if (f.state === 'complete') drawComplete(ctx, f);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Keep the canvas honest about its size for the dossier's screenshots.
document.title = 'Sky Courier: Island Run';
