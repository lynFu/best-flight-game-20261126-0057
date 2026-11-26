// render.js — the chase view: sky, sea, island terrain, runway, rings and the
// aeroplane itself, all drawn on one 2D canvas. One job: show the world.

import { CFG } from './config.js';
import { groundHeight, onRunway } from './world.js';

const GRID_STEP = 100;
const GRID_N = (CFG.worldHalf * 2) / GRID_STEP; // 40 cells across

function terrainColor(h, n) {
  if (h < 3) return '#d8c188'; // sand
  if (h < 42) return n > 0.3 ? '#7fae5a' : '#6f9e4e'; // meadow
  if (h < 85) return n > 0 ? '#5d8a44' : '#527c3d'; // forest
  return n > 0.2 ? '#8a7f72' : '#7d7268'; // rock
}

// Build the heightfield once: heights and colours per vertex.
function buildTerrain() {
  const verts = [];
  for (let j = 0; j <= GRID_N; j += 1) {
    const row = [];
    for (let i = 0; i <= GRID_N; i += 1) {
      const x = -CFG.worldHalf + i * GRID_STEP;
      const z = -CFG.worldHalf + j * GRID_STEP;
      const h = groundHeight(x, z);
      const n = Math.sin(x * 0.021 + z * 0.017) * 0.5 + Math.sin(x * 0.053 - z * 0.041) * 0.5;
      row.push({ x, z, h, color: terrainColor(h, n) });
    }
    verts.push(row);
  }
  return verts;
}

export function createRenderer() {
  const terrain = buildTerrain();

  // Camera-space point (X right, Y up, Z forward), before projection.
  function toCam(cam, px, py, pz) {
    const dx = px - cam.x;
    const dy = py - cam.y;
    const dz = pz - cam.z;
    return {
      x: dx * cam.r[0] + dy * cam.r[1] + dz * cam.r[2],
      y: dx * cam.u[0] + dy * cam.u[1] + dz * cam.u[2],
      z: dx * cam.f[0] + dy * cam.f[1] + dz * cam.f[2],
    };
  }

  // Sutherland-Hodgman clip of a polygon against the near plane (z >= 1),
  // so ground right under the camera fills the frame instead of flipping.
  function clipNear(poly, near = 1) {
    const out = [];
    for (let i = 0; i < poly.length; i += 1) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const aIn = a.z >= near;
      const bIn = b.z >= near;
      if (aIn) out.push(a);
      if (aIn !== bIn) {
        const t = (near - a.z) / (b.z - a.z);
        out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: near });
      }
    }
    return out;
  }

  function projectPt(cam, p) {
    // Clamp to a sane box: a vertex a metre from the near plane projects
    // tens of thousands of pixels away, and a path that far out fills wrong.
    const m = 5000;
    const x = cam.cx + (p.x / p.z) * cam.focal;
    const y = cam.cy - (p.y / p.z) * cam.focal;
    return {
      x: Math.max(-m, Math.min(cam.w + m, x)),
      y: Math.max(-m, Math.min(cam.h + m, y)),
    };
  }

  // Fill a camera-space polygon (clipped, then projected) in one colour.
  function fillCamPoly(ctx, cam, poly, color) {
    const clipped = clipNear(poly);
    if (clipped.length < 3) return;
    ctx.fillStyle = color;
    ctx.beginPath();
    clipped.forEach((p, i) => {
      const s = projectPt(cam, p);
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    });
    ctx.closePath();
    ctx.fill();
  }

  function project(cam, px, py, pz) {
    const dx = px - cam.x;
    const dy = py - cam.y;
    const dz = pz - cam.z;
    const X = dx * cam.r[0] + dy * cam.r[1] + dz * cam.r[2];
    const Y = dx * cam.u[0] + dy * cam.u[1] + dz * cam.u[2];
    let Z = dx * cam.f[0] + dy * cam.f[1] + dz * cam.f[2];
    if (Z < 1) Z = 1;
    return {
      x: cam.cx + (X / Z) * cam.focal,
      y: cam.cy - (Y / Z) * cam.focal,
      z: Z,
      behind: dx * cam.f[0] + dy * cam.f[1] + dz * cam.f[2] < 1,
    };
  }

  function cameraFor(f, w, h, time) {
    const heading = f.heading;
    const cp = -0.05 + f.pitch * 0.35 - (f.y < 25 ? 0.12 : 0); // look down at the strip when low
    const roll = f.roll * 0.45;
    const fx = Math.sin(heading);
    const fz = -Math.cos(heading);
    const back = f.state === 'title' ? 20 : CFG.camBack;
    const up = f.state === 'title' ? 9 : CFG.camUp;
    const cx = f.x - fx * back;
    const cz = f.z - fz * back;
    const cy = f.y + up;
    // Basis: forward, right, up — then roll the camera with the bank.
    const F = [fx * Math.cos(cp), Math.sin(cp), fz * Math.cos(cp)];
    const R0 = [Math.cos(heading), 0, Math.sin(heading)];
    const U0 = [
      -Math.sin(heading) * Math.sin(cp),
      Math.cos(cp),
      Math.cos(heading) * Math.sin(cp),
    ];
    const cr = Math.cos(roll);
    const sr = Math.sin(roll);
    const R = [R0[0] * cr + U0[0] * sr, R0[1] * cr + U0[1] * sr, R0[2] * cr + U0[2] * sr];
    const U = [U0[0] * cr - R0[0] * sr, U0[1] * cr - R0[1] * sr, U0[2] * cr - R0[2] * sr];
    return {
      x: cx, y: cy, z: cz, f: F, r: R, u: U,
      cx: w / 2, cy: h * 0.52,
      focal: (h / 2) / Math.tan(CFG.fov / 2),
      w, h,
    };
  }

  function drawSky(ctx, cam, f, time) {
    const { w, h } = cam;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#2f6fd0');
    g.addColorStop(0.45, '#7fb2e8');
    g.addColorStop(0.62, '#d8ecf9');
    g.addColorStop(1, '#bcd9ef');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // Sun, fixed in the sky to the north-west.
    const sun = project(cam, f.x - 2600, 900, f.z - 2600);
    if (!sun.behind && sun.z < 6000) {
      ctx.fillStyle = '#fff6c9';
      ctx.beginPath();
      ctx.arc(sun.x, sun.y, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 246, 201, 0.35)';
      ctx.beginPath();
      ctx.arc(sun.x, sun.y, 58, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawSea(ctx, cam) {
    const { w, h } = cam;
    // The sea fills everything below the horizon line, wherever that sits.
    const far = project(cam, cam.x + cam.f[0] * 5000, 0, cam.z + cam.f[2] * 5000);
    const top = Math.max(0, Math.min(h, far.y));
    if (top >= h) return;
    const g = ctx.createLinearGradient(0, top, 0, h);
    g.addColorStop(0, '#5aa3d8');
    g.addColorStop(1, '#1d5f96');
    ctx.fillStyle = g;
    ctx.fillRect(0, top, w, h - top);
  }

  function drawTerrain(ctx, cam) {
    const bands = [];
    for (let j = 0; j < GRID_N; j += 1) {
      const zm = -CFG.worldHalf + (j + 0.5) * GRID_STEP;
      const dx = 0 - cam.x;
      const dz = zm - cam.z;
      bands.push({ j, dist: dx * dx + dz * dz });
    }
    bands.sort((a, b) => b.dist - a.dist);
    for (const { j } of bands) {
      const rowA = terrain[j];
      const rowB = terrain[j + 1];
      for (let i = 0; i < GRID_N; i += 1) {
        const a = rowA[i];
        const b = rowA[i + 1];
        const c = rowB[i + 1];
        const d = rowB[i];
        if (a.h <= 0.4 && b.h <= 0.4 && c.h <= 0.4 && d.h <= 0.4) continue;
        fillCamPoly(ctx, cam, [
          toCam(cam, a.x, Math.max(a.h, 0.4), a.z),
          toCam(cam, b.x, Math.max(b.h, 0.4), b.z),
          toCam(cam, c.x, Math.max(c.h, 0.4), c.z),
          toCam(cam, d.x, Math.max(d.h, 0.4), d.z),
        ], a.color);
      }
    }
  }

  function drawRunway(ctx, cam) {
    const r = CFG.runway;
    const hw = r.width / 2;
    const hl = r.length / 2;
    const corners = [
      toCam(cam, r.x - hw, 4.2, r.z - hl),
      toCam(cam, r.x + hw, 4.2, r.z - hl),
      toCam(cam, r.x + hw, 4.2, r.z + hl),
      toCam(cam, r.x - hw, 4.2, r.z + hl),
    ];
    fillCamPoly(ctx, cam, corners, '#3c4148');
    // Centreline dashes and threshold bars.
    for (let k = -9; k <= 9; k += 1) {
      const z0 = r.z + k * 20 - 6;
      const z1 = r.z + k * 20 + 6;
      fillCamPoly(ctx, cam, [
        toCam(cam, r.x - 1.2, 4.3, z0),
        toCam(cam, r.x + 1.2, 4.3, z0),
        toCam(cam, r.x + 1.2, 4.3, z1),
        toCam(cam, r.x - 1.2, 4.3, z1),
      ], '#f5f2e8');
    }
  }

  function drawRings(ctx, cam, rings, time) {
    for (const ring of rings) {
      if (ring.passed) continue;
      const p = project(cam, ring.x, ring.y, ring.z);
      if (p.behind || p.z > 2600) continue;
      const screenR = (CFG.ringRadius / p.z) * cam.focal;
      if (screenR < 2) continue;
      // The ring faces the course; from an angle it squashes to an ellipse.
      const nx = Math.sin(ring.heading);
      const nz = -Math.cos(ring.heading);
      const vx = (cam.x - ring.x) / p.z;
      const vz = (cam.z - ring.z) / p.z;
      const facing = Math.abs(nx * vx + nz * vz);
      const squash = Math.max(0.18, Math.min(1, facing));
      const pulse = 0.75 + 0.25 * Math.sin(time * 3 + ring.index);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(1, squash);
      ctx.strokeStyle = `rgba(255, 190, 60, ${0.55 + 0.35 * pulse})`;
      ctx.lineWidth = Math.max(2, screenR * 0.1);
      ctx.shadowColor = '#ffb83c';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(0, 0, screenR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = Math.max(1, screenR * 0.03);
      ctx.setLineDash([screenR * 0.22, screenR * 0.16]);
      ctx.beginPath();
      ctx.arc(0, 0, screenR * 0.82, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      // Number plate under the ring.
      ctx.fillStyle = 'rgba(20, 30, 45, 0.75)';
      ctx.font = `bold ${Math.max(11, screenR * 0.28)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(String(ring.index + 1), p.x, p.y + screenR * squash + 18);
    }
  }

  function drawScenery(ctx, cam, world) {
    // Clouds: soft white billboards high up.
    for (const c of world.clouds) {
      const p = project(cam, c.x, c.y, c.z);
      if (p.behind || p.z > 5000) continue;
      const s = (c.size / p.z) * cam.focal;
      if (s < 4) continue;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, s, s * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(p.x - s * 0.5, p.y + s * 0.06, s * 0.6, s * 0.26, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Trees: small green cones on the grass.
    for (const t of world.trees) {
      const p = project(cam, t.x, t.y, t.z);
      if (p.behind || p.z > 1400) continue;
      const s = (t.size / p.z) * cam.focal;
      if (s < 2) continue;
      ctx.fillStyle = `rgba(46, 110, 52, ${t.shade})`;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - s * 1.6);
      ctx.lineTo(p.x - s * 0.7, p.y);
      ctx.lineTo(p.x + s * 0.7, p.y);
      ctx.closePath();
      ctx.fill();
    }
    // Houses: pale walls with coloured roofs near the runway town.
    for (const hs of world.houses) {
      const p = project(cam, hs.x, hs.y, hs.z);
      if (p.behind || p.z > 1600) continue;
      const s = (hs.w / p.z) * cam.focal;
      if (s < 3) continue;
      ctx.fillStyle = '#e8e0cf';
      ctx.fillRect(p.x - s / 2, p.y - s * 0.7, s, s * 0.7);
      ctx.fillStyle = hs.roof;
      ctx.beginPath();
      ctx.moveTo(p.x - s * 0.6, p.y - s * 0.7);
      ctx.lineTo(p.x, p.y - s * 1.15);
      ctx.lineTo(p.x + s * 0.6, p.y - s * 0.7);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawShadow(ctx, cam, f) {
    const g = groundHeight(f.x, f.z);
    if (f.y - g < 2) return; // on the ground the shadow sits under the plane
    const p = project(cam, f.x, g + 0.6, f.z);
    if (p.behind || p.z > 1200 || p.y > cam.h || p.x < 0 || p.x > cam.w) return;
    const s = Math.max(3, (6 / p.z) * cam.focal * (1 - Math.min(0.8, (f.y - g) / 220)));
    ctx.fillStyle = 'rgba(10, 25, 40, 0.2)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, s, s * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPlane(ctx, cam, f, time) {
    const { w, h } = cam;
    const px = w / 2;
    const py = h * 0.62;
    const span = w * 0.30;
    const blink = Math.sin(time * 6) > 0;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(f.roll * 0.55);
    ctx.scale(1, 1 - Math.abs(f.pitch) * 0.15);
    // Spinning prop disc at the nose (top of the fuselage from behind).
    ctx.fillStyle = 'rgba(200, 210, 220, 0.28)';
    ctx.beginPath();
    ctx.ellipse(0, -span * 0.42, span * 0.30, span * 0.055, 0, 0, Math.PI * 2);
    ctx.fill();
    // Main wings.
    ctx.fillStyle = '#e8b23a';
    ctx.beginPath();
    ctx.moveTo(-span / 2, -span * 0.10);
    ctx.lineTo(-span * 0.42, -span * 0.16);
    ctx.lineTo(-span * 0.46, -span * 0.02);
    ctx.lineTo(-span * 0.08, span * 0.02);
    ctx.lineTo(span * 0.08, span * 0.02);
    ctx.lineTo(span * 0.46, -span * 0.02);
    ctx.lineTo(span * 0.42, -span * 0.16);
    ctx.lineTo(span / 2, -span * 0.10);
    ctx.lineTo(span * 0.10, -span * 0.05);
    ctx.lineTo(-span * 0.10, -span * 0.05);
    ctx.closePath();
    ctx.fill();
    // Wingtip navigation lights.
    ctx.fillStyle = '#ff4d4d';
    ctx.beginPath();
    ctx.arc(-span * 0.47, -span * 0.06, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#37d67a';
    ctx.beginPath();
    ctx.arc(span * 0.47, -span * 0.06, 4, 0, Math.PI * 2);
    ctx.fill();
    // Fuselage, seen from behind and slightly above: tail at the bottom.
    const body = ctx.createLinearGradient(0, -span * 0.42, 0, span * 0.22);
    body.addColorStop(0, '#f6c453');
    body.addColorStop(0.6, '#e8a93a');
    body.addColorStop(1, '#c07f1e');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-span * 0.075, span * 0.20);
    ctx.quadraticCurveTo(-span * 0.10, -span * 0.10, -span * 0.045, -span * 0.40);
    ctx.quadraticCurveTo(0, -span * 0.46, span * 0.045, -span * 0.40);
    ctx.quadraticCurveTo(span * 0.10, -span * 0.10, span * 0.075, span * 0.20);
    ctx.quadraticCurveTo(0, span * 0.26, -span * 0.075, span * 0.20);
    ctx.closePath();
    ctx.fill();
    // Canopy glint.
    ctx.fillStyle = 'rgba(190, 225, 245, 0.85)';
    ctx.beginPath();
    ctx.ellipse(0, -span * 0.30, span * 0.032, span * 0.085, 0, 0, Math.PI * 2);
    ctx.fill();
    // Tailplane.
    ctx.fillStyle = '#d99a26';
    ctx.beginPath();
    ctx.moveTo(-span * 0.20, span * 0.16);
    ctx.lineTo(-span * 0.17, span * 0.10);
    ctx.lineTo(span * 0.17, span * 0.10);
    ctx.lineTo(span * 0.20, span * 0.16);
    ctx.closePath();
    ctx.fill();
    // Vertical stabiliser with a sun-and-wave tail mark.
    ctx.fillStyle = '#2f6fd0';
    ctx.beginPath();
    ctx.moveTo(-span * 0.035, span * 0.18);
    ctx.lineTo(0, -span * 0.02);
    ctx.lineTo(span * 0.035, span * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.arc(0, span * 0.09, span * 0.018, 0, Math.PI * 2);
    ctx.fill();
    // Blinking tail light.
    if (blink) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, span * 0.24, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // "SKY COURIER" cheatline tag, part of the livery.
    ctx.save();
    ctx.translate(px, py + span * 0.30);
    ctx.fillStyle = 'rgba(20, 35, 55, 0.55)';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SKY COURIER · ISLAND RUN', 0, 0);
    ctx.restore();
  }

  function render(ctx, game, time) {
    const { f, world } = game;
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    const cam = cameraFor(f, w, h, time);
    drawSky(ctx, cam, f, time);
    drawSea(ctx, cam);
    drawTerrain(ctx, cam);
    drawRunway(ctx, cam);
    drawScenery(ctx, cam, world);
    drawRings(ctx, cam, world.rings, time);
    drawShadow(ctx, cam, f);
    if (f.state !== 'crashed') drawPlane(ctx, cam, f, time);
    return cam;
  }

  return { render, project, cameraFor };
}
