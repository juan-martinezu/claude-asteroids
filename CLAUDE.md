# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Asteroids clone in vanilla HTML5 Canvas + ES6. No dependencies, no bundler, no build step, no tests, no linter. The README and UI text are in Spanish.

## Running

Open `index.html` in a browser, or serve statically: `npx serve .` (then http://localhost:3000).

## Architecture

All game logic lives in `game.js` (single script loaded by `index.html`, no modules). Canvas is fixed at 800x600 (`W`/`H` constants in `game.js` must match the `<canvas>` attributes in `index.html`).

- **Loop**: `loop(ts)` → `update(dt)` → `draw()`. `dt` is in seconds and clamped to 0.05 to avoid big jumps after tab switches. Physics constants are per-second (e.g. thrust px/s²), except ship `DRAG`, which is a per-frame multiplier (not dt-scaled).
- **State machine**: global `state` is `'playing' | 'dead' | 'gameover'`. `dead` is a 2s respawn pause (asteroids and particles keep updating, the ship is hidden); `gameover` waits for Space to call `initGame()`. Game state is module-level `let` globals (`ship, bullets, asteroids, particles, score, lives, level`), reassigned (not mutated) by `initGame`/`nextLevel`.
- **Entities**: classes `Ship`, `Bullet`, `Asteroid`, `Particle`, each with `update(dt)` and `draw()`. Entities set `dead = true` and are removed by `filter` in `update()`. Collision is circle-based using `dist()` and `radius` (ship vs asteroid uses `a.radius * 0.82` to be forgiving).
- **Toroidal world**: positions wrap with `wrap()` on both axes; particles are the exception and do not wrap.
- **Asteroid sizes**: size 3/2/1 indexes the parallel arrays `RADII`, `SPEEDS`, `POINTS` (index 0 unused). `split()` returns two children at `size - 1`; size 1 returns none. Smaller asteroids give more points.
- **Input**: `keys[code]` holds the current held state; `pressed(code)` is a consume-once edge trigger (used for Space so holding it does not auto-fire). Fire rate is also gated by `Ship.shootCooldown`.
- **Levels**: clearing all asteroids calls `nextLevel()`, which spawns `3 + level` asteroids (at least 130px from the center) and resets the ship, including its 3s invincibility blink.
