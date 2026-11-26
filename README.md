# Sky Courier: Island Run

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Rank](https://make.fun/badge/best-flight-game-20261126-0057/CharmLynn/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Reward](https://make.fun/badge/best-flight-game-20261126-0057/CharmLynn/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

A little prop plane, five golden rings, one island runway. **Sky Courier: Island Run** is an original flight game for the [make.fun best flight game bounty](https://make.fun/bounty/best-flight-game-20261126-0057): fly the ring course over a procedurally built island chain, watch your fuel, then bring her home to the runway.

## How to play

Serve `game/` with any static server (or run `node serve.ts`) and open it in desktop Chrome. No build step, no network requests — every file the game loads lives under `game/`.

| Control | What it does |
| --- | --- |
| ↑ / ↓ or W / S | Pitch nose up / down |
| ← / → or A / D | Bank left / right (banking turns the plane) |
| Shift / Ctrl | Throttle up / down |
| Mouse move | Steer (bank and pitch follow the cursor) |
| Mouse wheel | Throttle |
| Enter / click | Take off, or fly again after landing or crashing |
| R | Restart the flight |

## The course

1. Take off from the island airfield — full throttle, then pull up gently once you have speed.
2. Fly through all five glowing rings in order. Each ring is worth 100 points.
3. Land on the runway: slow, level, gentle descent. A full course plus landing earns 500 points and a time bonus.
4. Watch the fuel gauge and the stall warning: below flying speed the wing stops flying, and an empty tank means a glide, not a fall.

The HUD shows altitude, speed, heading with a compass tape, an attitude indicator, fuel, throttle, score, rings and time. All sound — engine hum, wind, ring chimes, landing fanfare — is synthesised live with WebAudio; there are no audio files.

## Files

- `game/index.html` — the page; `game/src/` holds the game, one job per file:
  - `main.js` — bootstrap, game loop, state machine
  - `flight.js` — flight model and mission rules
  - `world.js` — island terrain, runway, ring course, trees, houses, clouds
  - `render.js` — the chase view: sky, sea, terrain, runway, rings, aeroplane
  - `hud.js` — instruments and overlays
  - `input.js` — keyboard and mouse
  - `audio.js` — synthesised sounds
  - `config.js` — tuning constants
  - `random.js` — seeded random numbers and value noise
  - `shots.js` — deterministic states for the screenshots (`?shot=start|cruise|ring|land`)
- `main.ts` — the make.fun hand-in program: copies `game/` and `screenshots/` to `/output` and writes `dossier.json` (run with `MAKEFUN_OUTPUT_DIR=out node main.ts`)
- `screenshots/` — four real browser renders of the game (title, cruise, ring, final approach)
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged

## License

MIT — see [LICENSE](LICENSE).
