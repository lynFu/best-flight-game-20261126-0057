// hud.js — the lit instruments: altitude, speed, heading, fuel, throttle,
// attitude, compass and mission text, plus the title / crash / landing
// overlays. One job: tell the pilot what the aeroplane is doing.

import { CFG } from './config.js';
import { nextRing } from './flight.js';

function fmt(n, digits = 0) {
  return n.toFixed(digits);
}

function compassLabel(deg) {
  const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return names[Math.round(deg / 45) % 8];
}

function drawPanel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(10, 22, 38, 0.72)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(140, 200, 255, 0.45)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function drawHud(ctx, game, time) {
  const { f, world } = game;
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const headingDeg = ((f.heading * 180 / Math.PI) % 360 + 360) % 360;
  const knots = f.speed * 1.944;

  // Top-left: the three big readouts, lit like glass instruments.
  drawPanel(ctx, 14, 14, 340, 74);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#8ec8ff';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('ALTITUDE', 28, 34);
  ctx.fillText('SPEED', 138, 34);
  ctx.fillText('HEADING', 238, 34);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px monospace';
  ctx.fillText(`${fmt(f.y)} m`, 28, 64);
  ctx.fillText(`${fmt(knots)} kt`, 138, 64);
  ctx.fillText(`${fmt(headingDeg)}° ${compassLabel(headingDeg)}`, 238, 64);

  // Top-centre: compass tape.
  const tapeW = 300;
  const tapeX = w / 2 - tapeW / 2;
  drawPanel(ctx, tapeX, 14, tapeW, 40);
  ctx.save();
  ctx.beginPath();
  ctx.rect(tapeX, 14, tapeW, 40);
  ctx.clip();
  ctx.fillStyle = '#8ec8ff';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  for (let d = -60; d <= 60; d += 15) {
    const deg = Math.round((headingDeg + d) / 15) * 15;
    const off = (deg - headingDeg) * (tapeW / 120);
    const x = w / 2 + off;
    const label = deg % 90 === 0
      ? ['N', 'E', 'S', 'W'][((deg / 90) % 4 + 4) % 4]
      : String(((deg % 360) + 360) % 360);
    ctx.fillText(label, x, 40);
    ctx.fillRect(x - 0.5, 20, 1, 8);
  }
  ctx.restore();
  ctx.fillStyle = '#ffd94d';
  ctx.beginPath();
  ctx.moveTo(w / 2 - 6, 14);
  ctx.lineTo(w / 2 + 6, 14);
  ctx.lineTo(w / 2, 24);
  ctx.closePath();
  ctx.fill();

  // Top-right: fuel, throttle, score and rings.
  drawPanel(ctx, w - 294, 14, 280, 96);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#8ec8ff';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('FUEL', w - 280, 34);
  ctx.fillText('THROTTLE', w - 280, 56);
  const fuelW = 110;
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(w - 230, 24, fuelW, 10);
  ctx.fillStyle = f.fuel < 20 ? '#ff5d5d' : '#37d67a';
  ctx.fillRect(w - 230, 24, fuelW * (f.fuel / CFG.fuelStart), 10);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(w - 230, 46, fuelW, 10);
  ctx.fillStyle = '#ffd94d';
  ctx.fillRect(w - 230, 46, fuelW * f.throttle, 10);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px monospace';
  ctx.fillText(`SCORE ${fmt(f.score)}`, w - 280, 80);
  ctx.fillStyle = '#ffd94d';
  ctx.fillText(`RINGS ${f.ringsPassed}/${CFG.ringCount}`, w - 160, 80);
  ctx.fillStyle = '#8ec8ff';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText(`TIME ${fmt(f.time)}s`, w - 280, 100);

  // Bottom-left: attitude indicator (artificial horizon).
  const ax = 78;
  const ay = h - 78;
  const ar = 56;
  ctx.save();
  ctx.beginPath();
  ctx.arc(ax, ay, ar, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(ax, ay);
  ctx.rotate(-f.roll);
  ctx.translate(0, f.pitch * ar * 1.2);
  ctx.fillStyle = '#3f8fd2';
  ctx.fillRect(-ar, -ar, ar * 2, ar);
  ctx.fillStyle = '#8a6b46';
  ctx.fillRect(-ar, 0, ar * 2, ar);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-ar, -1, ar * 2, 2);
  ctx.restore();
  ctx.strokeStyle = 'rgba(140, 200, 255, 0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(ax, ay, ar, 0, Math.PI * 2);
  ctx.stroke();
  // Fixed wings of the indicator.
  ctx.strokeStyle = '#ffd94d';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(ax - ar * 0.55, ay);
  ctx.lineTo(ax - ar * 0.15, ay);
  ctx.moveTo(ax + ar * 0.15, ay);
  ctx.lineTo(ax + ar * 0.55, ay);
  ctx.stroke();
  ctx.fillStyle = '#8ec8ff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ATTITUDE', ax, ay + ar + 16);

  // Bottom-centre: mission text and warnings.
  ctx.textAlign = 'center';
  const ring = nextRing(world.rings);
  let objective = '';
  if (f.state === 'flying' && ring) {
    objective = `Fly through ring ${ring.index + 1} — then land on the runway`;
  } else if (f.state === 'flying') {
    objective = 'All rings done — land on the runway!';
  }
  if (objective) {
    ctx.fillStyle = 'rgba(10, 22, 38, 0.66)';
    const tw = ctx.measureText(objective).width + 28;
    ctx.beginPath();
    ctx.roundRect(w / 2 - tw / 2, h - 44, tw, 28, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(objective, w / 2, h - 25);
  }
  if (f.message && f.time < f.messageUntil) {
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(f.message, w / 2, h - 62);
  }
  if (f.state === 'flying' && f.speed < CFG.minFlySpeed && f.speed > 1) {
    ctx.fillStyle = '#ff5d5d';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('STALL — NOSE DOWN, MORE THROTTLE!', w / 2, h - 92);
  }
  if (f.state === 'flying' && f.fuel < 20 && f.fuel > 0) {
    ctx.fillStyle = '#ff9d5d';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('LOW FUEL', w / 2, h - 112);
  }

  // Bottom-right: controls reminder.
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '12px sans-serif';
  ctx.fillText('↑↓ pitch · ←→ bank · Shift/Ctrl throttle', w - 16, h - 52);
  ctx.fillText('mouse steers · wheel throttle · R restart', w - 16, h - 34);
  ctx.fillText('Sky Courier: Island Run — a make.fun entry', w - 16, h - 16);
}

function overlay(ctx, title, lines, accent) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.fillStyle = 'rgba(8, 18, 32, 0.62)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = accent;
  ctx.font = 'bold 46px sans-serif';
  ctx.fillText(title, w / 2, h * 0.34);
  ctx.fillStyle = '#ffffff';
  ctx.font = '17px sans-serif';
  lines.forEach((line, i) => {
    ctx.fillText(line, w / 2, h * 0.34 + 44 + i * 28);
  });
}

export function drawTitle(ctx) {
  overlay(ctx, 'SKY COURIER', [
    'Island Run — a little prop plane, five golden rings, one island runway.',
    'Fly the course, then bring her home. Watch your fuel.',
    '',
    '↑ ↓ pitch      ← → bank      Shift / Ctrl throttle',
    'Move the mouse to steer · scroll wheel for throttle',
    '',
    'Click or press Enter to take off',
  ], '#ffd94d');
}

export function drawCrashed(ctx, f) {
  overlay(ctx, 'CRASHED', [
    f.crashReason,
    `Score ${fmt(f.score)} · rings ${f.ringsPassed}/${CFG.ringCount} · ${fmt(f.time)}s in the air`,
    '',
    'Press R or click to fly again',
  ], '#ff5d5d');
}

export function drawLanded(ctx, f) {
  overlay(ctx, 'LANDED', [
    'Wheels down — but the course is not finished.',
    `Rings ${f.ringsPassed}/${CFG.ringCount} · score ${fmt(f.score)}`,
    '',
    'Press R or click to fly again',
  ], '#37d67a');
}

export function drawComplete(ctx, f) {
  overlay(ctx, 'COURSE COMPLETE!', [
    `All ${CFG.ringCount} rings and a safe landing on the island runway.`,
    `Final score ${fmt(f.score)} · flight time ${fmt(f.landedAt)}s · fuel left ${fmt(f.fuel)}`,
    '',
    'Press R or click to fly the course again',
  ], '#ffd94d');
}
