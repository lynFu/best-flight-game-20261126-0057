// input.js — keyboard and mouse, reduced to one flight command.
// One job: read the pilot. Arrow keys / WASD pitch and bank, Shift/Ctrl or
// W/S... no: throttle is Shift (up) / Control (down) and the mouse wheel;
// moving the mouse steers too. Clicking starts the game from the overlays.

export function createInput(canvas, onAction) {
  const keys = new Set();
  const mouse = { x: 0, y: 0, active: false, down: false };
  let wheelDelta = 0;

  const KEYMAP = {
    ArrowUp: 'pitchUp', KeyW: 'pitchUp',
    ArrowDown: 'pitchDown', KeyS: 'pitchDown',
    ArrowLeft: 'rollLeft', KeyA: 'rollLeft',
    ArrowRight: 'rollRight', KeyD: 'rollRight',
    ShiftLeft: 'throttleUp', ShiftRight: 'throttleUp',
    ControlLeft: 'throttleDown', ControlRight: 'throttleDown',
    KeyR: 'restart',
  };

  window.addEventListener('keydown', (e) => {
    const action = KEYMAP[e.code];
    if (action) {
      e.preventDefault();
      if (action === 'restart') onAction('restart');
      else keys.add(action);
    }
    if (e.code === 'Enter' || e.code === 'Space') onAction('confirm');
  });
  window.addEventListener('keyup', (e) => {
    const action = KEYMAP[e.code];
    if (action) keys.delete(action);
  });
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - rect.left) / rect.width - 0.5;
    mouse.y = (e.clientY - rect.top) / rect.height - 0.5;
    mouse.active = true;
  });
  canvas.addEventListener('mousedown', (e) => {
    mouse.down = true;
    onAction('confirm');
    e.preventDefault();
  });
  window.addEventListener('mouseup', () => { mouse.down = false; });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    wheelDelta += e.deltaY < 0 ? 1 : -1;
  }, { passive: false });
  window.addEventListener('blur', () => keys.clear());

  // Combine keys and mouse into one command each frame.
  function read() {
    let pitch = 0;
    let roll = 0;
    if (keys.has('pitchUp')) pitch += 1;
    if (keys.has('pitchDown')) pitch -= 1;
    if (keys.has('rollLeft')) roll -= 1;
    if (keys.has('rollRight')) roll += 1;
    if (mouse.active) {
      // Mouse steers gently: away from centre banks and pitches.
      roll += mouse.x * 1.6;
      pitch += -mouse.y * 1.2;
    }
    let throttleDelta = 0;
    if (keys.has('throttleUp')) throttleDelta += 1;
    if (keys.has('throttleDown')) throttleDelta -= 1;
    if (wheelDelta !== 0) {
      throttleDelta += wheelDelta * 0.25;
      wheelDelta = 0;
    }
    return {
      pitch: Math.max(-1, Math.min(1, pitch)),
      roll: Math.max(-1, Math.min(1, roll)),
      throttleDelta: Math.max(-1, Math.min(1, throttleDelta)),
    };
  }

  return { read, keys };
}
