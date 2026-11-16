'use strict';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 800;
const H = 600;

// ── Input ─────────────────────────────────────────────────────────────────────

const keys = {};
const justPressed = {};

window.addEventListener('keydown', e => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code))
    e.preventDefault();
  if (!e.repeat) justPressed[e.code] = true;
  keys[e.code] = true;
});

window.addEventListener('keyup', e => {
  keys[e.code] = false;
});

function pressed(code) {
  const val = justPressed[code];
  justPressed[code] = false;
  return val;
}

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap  = (v, max) => ((v % max) + max) % max;
const dist  = (a, b)   => Math.hypot(a.x - b.x, a.y - b.y);
const rand  = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));

// ── Bullet ────────────────────────────────────────────────────────────────────
class Bullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
    this.ttl  = 1.1;
    this.radius = 2;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── PowerUp (Disparo Triple) ──────────────────────────────────────────────────
const POWERUP_CHANCE   = 0.12;  // probabilidad por asteroide destruido
const TRIPLE_DURATION  = 5;     // segundos de efecto
const TRIPLE_SPREAD    = 0.25;  // rad entre balas
const POWERUP_FORCE_REMAINING = 3; // si no salió, forzar cuando queden <= N asteroides

class PowerUp {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    this.vx = Math.cos(angle) * 20;
    this.vy = Math.sin(angle) * 20;
    this.radius = 10;
    this.ttl  = 8;
    this.age  = 0;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.age += dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    if (this.ttl < 2 && Math.floor(this.ttl * 6) % 2 === 0) return;
    const r = this.radius + Math.sin(this.age * 6) * 1.5;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.strokeStyle = '#0ff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    for (const a of [-0.5, 0, 0.5]) {
      const ang = -Math.PI / 2 + a;
      ctx.beginPath();
      ctx.moveTo(0, 5);
      ctx.lineTo(Math.cos(ang) * 7, Math.sin(ang) * 7);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// ── Bomba Nova ────────────────────────────────────────────────────────────────
const NOVA_CHANCE          = 0.08; // probabilidad por asteroide destruido (en el nivel elegido)
const NOVA_FORCE_REMAINING = 3;    // forzar si quedan <= N asteroides
const NOVA_FLASH           = 0.4;  // segundos de destello

class NovaItem {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    this.vx = Math.cos(angle) * 20;
    this.vy = Math.sin(angle) * 20;
    this.radius = 11;
    this.ttl  = 10;
    this.age  = 0;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.age += dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    if (this.ttl < 2 && Math.floor(this.ttl * 6) % 2 === 0) return;
    const r = this.radius + Math.sin(this.age * 6) * 1.5;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.strokeStyle = '#f0f';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    // estrella de 8 puntas
    ctx.rotate(this.age);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * 7, Math.sin(a) * 7);
    }
    ctx.stroke();
    ctx.restore();
  }
}

// ── Hiperpropulsión ───────────────────────────────────────────────────────────
const HYPER_CHANCE    = 0.07; // probabilidad por asteroide destruido (1 por nivel)
const HYPER_DURATION  = 8;    // segundos de efecto
const HYPER_THRUST    = 2.4;  // multiplicador de aceleración
const HYPER_MAX_SPEED = 560;  // px/s, tope de velocidad con hiperpropulsión

class HyperItem {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    this.vx = Math.cos(angle) * 20;
    this.vy = Math.sin(angle) * 20;
    this.radius = 10;
    this.ttl  = 9;
    this.age  = 0;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.age += dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    if (this.ttl < 2 && Math.floor(this.ttl * 6) % 2 === 0) return;
    const r = this.radius + Math.sin(this.age * 6) * 1.5;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.strokeStyle = '#ff0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    // doble chevrón
    ctx.beginPath();
    for (const o of [-3, 3]) {
      ctx.moveTo(-4 + o, -5);
      ctx.lineTo(1 + o, 0);
      ctx.lineTo(-4 + o, 5);
    }
    ctx.stroke();
    ctx.restore();
  }
}

// ── Asteroid ──────────────────────────────────────────────────────────────────
const RADII = [0, 16, 30, 50];   // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32];   // velocidad base por tamaño
const POINTS = [0, 100, 50, 20];  // puntos por tamaño

class Asteroid {
  constructor(x, y, size = 3) {
    this.x    = x;
    this.y    = y;
    this.size = size;
    this.radius = RADII[size];
    this.dead = false;

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Polígono irregular
    const n = randInt(8, 13);
    this.verts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt) {
    this.x   = wrap(this.x + this.vx * dt, W);
    this.y   = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split() {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── Ship ──────────────────────────────────────────────────────────────────────
class Ship {
  constructor() { this.reset(); }

  reset() {
    this.x      = W / 2;
    this.y      = H / 2;
    this.angle  = -Math.PI / 2;
    this.vx     = 0;
    this.vy     = 0;
    this.radius = 12;
    this.thrusting     = false;
    this.invincible    = 3;
    this.shootCooldown = 0;
    this.dead          = false;
  }

  update(dt) {
    if (this.dead) return;
    if (this.invincible    > 0) this.invincible    -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;

    const ROT   = 3.5;   // rad/s
    const hyper  = hyperTimer > 0;
    const THRUST = hyper ? 260 * HYPER_THRUST : 260;  // px/s²
    const DRAG   = 0.987;

    if (keys['ArrowLeft'])  this.angle -= ROT * dt;
    if (keys['ArrowRight']) this.angle += ROT * dt;

    this.thrusting = !!keys['ArrowUp'];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    if (hyper) {
      const sp = Math.hypot(this.vx, this.vy);
      if (sp > HYPER_MAX_SPEED) {
        this.vx *= HYPER_MAX_SPEED / sp;
        this.vy *= HYPER_MAX_SPEED / sp;
      }
    }
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot() {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    if (tripleShotTimer > 0) {
      return [-TRIPLE_SPREAD, 0, TRIPLE_SPREAD]
        .map(d => new Bullet(ox, oy, this.angle + d));
    }
    return [new Bullet(ox, oy, this.angle)];
  }

  draw() {
    if (this.dead) return;
    // Parpadeo durante invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';

    // Silueta clásica: triángulo con muesca trasera
    ctx.beginPath();
    ctx.moveTo( 20,  0);   // nariz
    ctx.lineTo(-12, -9);   // ala izquierda
    ctx.lineTo( -7,  0);   // muesca trasera
    ctx.lineTo(-12,  9);   // ala derecha
    ctx.closePath();
    ctx.stroke();

    // Llama del propulsor
    if (this.thrusting && Math.random() > 0.35) {
      const hyper = hyperTimer > 0;
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - (hyper ? rand(14, 28) : rand(6, 14)), 0);
      ctx.lineTo(-8,  4);
      ctx.strokeStyle = hyper ? 'rgba(255, 255, 80, 0.9)' : 'rgba(255, 130, 0, 0.85)';
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ── Partículas (explosión) ────────────────────────────────────────────────────
class Particle {
  constructor(x, y) {
    this.x  = x;
    this.y  = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx   = Math.cos(angle) * speed;
    this.vy   = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl  = this.life;
    this.dead = false;
  }

  update(dt) {
    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const alpha = this.ttl / this.life;
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

// ── Estado del juego ──────────────────────────────────────────────────────────
let ship, bullets, asteroids, particles;
let score, lives, level;
let powerUp, powerUpSpawned, tripleShotTimer;
let hyperItem, hyperSpawned, hyperTimer;
let novaItem, novaLevel, novaSpawned, hasNova, novaFlash;
let state;      // 'playing' | 'dead' | 'gameover'
let deadTimer;

function spawnAsteroids(count) {
  const SAFE_DIST = 130;
  for (let i = 0; i < count; i++) {
    let x, y;
    do {
      x = rand(0, W);
      y = rand(0, H);
    } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
    asteroids.push(new Asteroid(x, y, 3));
  }
}

// Elige al azar un nivel dentro del bloque de 3 niveles actual
function pickNovaLevel() {
  const block = Math.floor((level - 1) / 3);
  novaLevel   = block * 3 + randInt(1, 3);
  novaSpawned = false;
}

function canSpawnNova() {
  return level === novaLevel && !novaSpawned && !hasNova && !novaItem;
}

function detonateNova() {
  for (const a of asteroids) {
    score += POINTS[a.size];
    explode(a.x, a.y, a.size * 6);
  }
  asteroids = [];
  hasNova   = false;
  novaFlash = NOVA_FLASH;
}

function initGame() {
  ship          = new Ship();
  bullets   = [];
  asteroids = [];
  particles = [];
  score  = 0;
  lives  = 3;
  level  = 1;
  powerUp = null;
  powerUpSpawned = false;
  tripleShotTimer = 0;
  hyperItem = null;
  hyperSpawned = false;
  hyperTimer = 0;
  novaItem  = null;
  hasNova   = false;
  novaFlash = 0;
  pickNovaLevel();
  state  = 'playing';
  spawnAsteroids(4);
}

function nextLevel() {
  level++;
  powerUpSpawned = false;
  hyperItem = null;
  hyperSpawned = false;
  novaItem = null;
  if ((level - 1) % 3 === 0) pickNovaLevel(); // inicio de nuevo bloque de 3 niveles
  bullets   = [];
  particles = [];
  ship.reset();
  spawnAsteroids(3 + level);
}

function explode(x, y, count = 8) {
  for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
}

function killShip() {
  explode(ship.x, ship.y, 14);
  ship.dead = true;
  tripleShotTimer = 0;
  hyperTimer = 0;
  lives--;
  if (lives <= 0) {
    state = 'gameover';
  } else {
    state     = 'dead';
    deadTimer = 2;
  }
}

// ── Update ────────────────────────────────────────────────────────────────────
function update(dt) {
  if (state === 'gameover') {
    if (pressed('Space')) initGame();
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    return;
  }

  if (state === 'dead') {
    deadTimer -= dt;
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    asteroids.forEach(a => a.update(dt));
    if (powerUp) {
      powerUp.update(dt);
      if (powerUp.dead) powerUp = null;
    }
    if (hyperItem) {
      hyperItem.update(dt);
      if (hyperItem.dead) hyperItem = null;
    }
    if (novaItem) {
      novaItem.update(dt);
      if (novaItem.dead) novaItem = null;
    }
    if (novaFlash > 0) novaFlash = Math.max(0, novaFlash - dt);
    pressed('KeyB');
    if (deadTimer <= 0) { state = 'playing'; ship.reset(); }
    return;
  }

  // Disparar
  if (pressed('Space')) {
    bullets.push(...ship.tryShoot());
  }

  // Bomba Nova
  if (pressed('KeyB') && hasNova) detonateNova();
  if (novaFlash > 0) novaFlash = Math.max(0, novaFlash - dt);

  ship.update(dt);
  bullets.forEach(b => b.update(dt));
  asteroids.forEach(a => a.update(dt));
  particles.forEach(p => p.update(dt));
  if (tripleShotTimer > 0) tripleShotTimer = Math.max(0, tripleShotTimer - dt);

  if (powerUp) {
    powerUp.update(dt);
    if (powerUp.dead) {
      powerUp = null;
    } else if (dist(ship, powerUp) < ship.radius + powerUp.radius) {
      tripleShotTimer = TRIPLE_DURATION;
      explode(powerUp.x, powerUp.y, 6);
      powerUp = null;
    }
  }

  if (hyperTimer > 0) hyperTimer = Math.max(0, hyperTimer - dt);
  if (hyperItem) {
    hyperItem.update(dt);
    if (hyperItem.dead) {
      hyperItem = null;
    } else if (dist(ship, hyperItem) < ship.radius + hyperItem.radius) {
      hyperTimer = HYPER_DURATION;
      explode(hyperItem.x, hyperItem.y, 6);
      hyperItem = null;
    }
  }

  if (novaItem) {
    novaItem.update(dt);
    if (novaItem.dead) {
      novaItem = null;
    } else if (dist(ship, novaItem) < ship.radius + novaItem.radius) {
      hasNova = true;
      explode(novaItem.x, novaItem.y, 8);
      novaItem = null;
    }
  }

  bullets   = bullets.filter(b => !b.dead);
  particles = particles.filter(p => !p.dead);

  // Bala vs asteroide
  const newAsteroids = [];
  let lastKilled = null;
  for (const b of bullets) {
    for (const a of asteroids) {
      if (!a.dead && !b.dead && dist(b, a) < a.radius) {
        b.dead = true;
        a.dead = true;
        lastKilled = a;
        score += POINTS[a.size];
        explode(a.x, a.y, a.size * 5);
        if (!powerUpSpawned && Math.random() < POWERUP_CHANCE) {
          powerUp = new PowerUp(a.x, a.y);
          powerUpSpawned = true;
        }
        if (!hyperSpawned && !hyperItem && Math.random() < HYPER_CHANCE) {
          hyperItem = new HyperItem(a.x, a.y);
          hyperSpawned = true;
        }
        if (canSpawnNova() && Math.random() < NOVA_CHANCE) {
          novaItem = new NovaItem(a.x, a.y);
          novaSpawned = true;
        }
        newAsteroids.push(...a.split());
      }
    }
  }
  asteroids = asteroids.filter(a => !a.dead).concat(newAsteroids);
  bullets   = bullets.filter(b => !b.dead);

  // Garantía: al menos un power-up por nivel
  if (!powerUpSpawned && lastKilled && asteroids.length <= POWERUP_FORCE_REMAINING) {
    powerUp = new PowerUp(lastKilled.x, lastKilled.y);
    powerUpSpawned = true;
  }

  // Garantía Nova: en el nivel elegido, forzar cuando queden pocos asteroides
  if (lastKilled && canSpawnNova() && asteroids.length <= NOVA_FORCE_REMAINING) {
    novaItem = new NovaItem(lastKilled.x, lastKilled.y);
    novaSpawned = true;
  }

  // Nave vs asteroide
  if (ship.invincible <= 0) {
    for (const a of asteroids) {
      if (dist(ship, a) < ship.radius + a.radius * 0.82) {
        killShip();
        break;
      }
    }
  }

  // Nivel completado
  if (asteroids.length === 0) nextLevel();
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function drawLifeIcon(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth   = 1.2;
  ctx.lineJoin    = 'round';
  ctx.beginPath();
  ctx.moveTo( 9,  0);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-3,  0);
  ctx.lineTo(-6,  5);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawHUD() {
  ctx.fillStyle = '#fff';
  ctx.font = '15px monospace';

  ctx.textAlign = 'left';
  ctx.fillText(`SCORE  ${score}`, 14, 26);

  ctx.textAlign = 'center';
  ctx.fillText(`NIVEL ${level}`, W / 2, 26);

  for (let i = 0; i < lives; i++)
    drawLifeIcon(W - 16 - i * 22, 18);

  if (tripleShotTimer > 0) {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#0ff';
    ctx.fillText(`TRIPLE ${tripleShotTimer.toFixed(1)}s`, 14, 46);
  }

  if (hyperTimer > 0) {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ff0';
    ctx.fillText(`HYPER ${hyperTimer.toFixed(1)}s`, 14, 86);
  }

  if (hasNova) {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f0f';
    ctx.fillText('NOVA [B]', 14, 66);
  }
}

function drawOverlay(title, sub) {
  ctx.textAlign   = 'center';
  ctx.fillStyle   = '#fff';
  ctx.font        = 'bold 46px monospace';
  ctx.fillText(title, W / 2, H / 2 - 18);
  ctx.font        = '18px monospace';
  ctx.fillStyle   = 'rgba(255,255,255,0.65)';
  ctx.fillText(sub, W / 2, H / 2 + 22);
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  particles.forEach(p => p.draw());
  asteroids.forEach(a => a.draw());
  bullets.forEach(b => b.draw());
  if (powerUp) powerUp.draw();
  if (novaItem) novaItem.draw();
  if (hyperItem) hyperItem.draw();
  ship.draw();

  if (novaFlash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${(novaFlash / NOVA_FLASH * 0.6).toFixed(2)})`;
    ctx.fillRect(0, 0, W, H);
  }

  drawHUD();

  if (state === 'gameover')
    drawOverlay('GAME OVER', `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`);
}

// ── Loop principal ────────────────────────────────────────────────────────────
let lastTime = null;

function loop(ts) {
  const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

initGame();
requestAnimationFrame(loop);
