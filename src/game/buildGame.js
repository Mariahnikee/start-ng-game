import { GENRES, THEMES, SIZES } from '../agent/catalog.js';
import { describePlan } from '../agent/planner.js';

export const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// JSON that is safe to put inside a <script> tag.
const scriptJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028|\u2029/g, '');

/** Everything the game script needs, resolved from the config. */
export function gameSettings(config) {
  const t = THEMES[config.theme];
  return {
    title: config.title,
    slug: config.slug,
    genre: config.genre,
    speed: config.speed,
    lives: config.lives,
    size: SIZES[config.size] ?? SIZES.normal,
    player: t.player,
    good: t.good,
    bad: t.bad,
    sky: t.sky,
    ground: t.ground,
    dark: t.dark,
  };
}

/**
 * A complete, self-contained index.html for the game: no build step, no
 * external files, and the three start.ng game standards (a link back to
 * start.ng, the start.ng name, and a Share on X button).
 */
export function buildGameHtml(config) {
  const s = gameSettings(config);
  const plan = describePlan(config);
  const title = escapeHtml(config.title);
  const ink = s.dark ? '#f6f5ee' : '#292a23';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · a start.ng game</title>
<meta name="description" content="${escapeHtml(plan.description)}">
<style>
  *{box-sizing:border-box}
  html,body{margin:0;height:100%;overflow:hidden;font-family:"Helvetica Neue",Helvetica,Arial,system-ui,sans-serif;color:${ink};background:${s.sky[1]}}
  canvas{display:block;width:100%;height:100%;touch-action:none}
  a{color:inherit}
  .back{position:fixed;top:10px;left:10px;z-index:3;padding:8px 14px;border-radius:999px;background:#292a23;color:#fffefa;font-weight:700;font-size:14px;text-decoration:none;min-height:36px;display:inline-flex;align-items:center}
  .hud{position:fixed;top:10px;right:10px;z-index:3;display:flex;gap:8px;font-weight:800;font-size:15px}
  .hud span{padding:8px 12px;border-radius:999px;background:rgba(255,254,250,.88);color:#292a23}
  .screen{position:fixed;inset:0;z-index:4;display:grid;place-items:center;padding:16px;background:rgba(41,42,35,.55)}
  .screen[hidden]{display:none}
  .card{max-width:360px;width:100%;padding:22px;border-radius:22px;background:#fffefa;color:#292a23;text-align:center;box-shadow:0 18px 50px rgba(0,0,0,.25)}
  .card h1,.card h2{margin:4px 0 8px;font-size:clamp(24px,7vw,32px);letter-spacing:-.04em;line-height:1}
  .brand{margin:0;font:700 11px/1.4 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.14em;text-transform:uppercase;color:#6b6c63}
  .card p{margin:6px 0;font-size:15px;line-height:1.4}
  .card ul{list-style:none;padding:0;margin:10px 0 14px;font-size:14px;color:#3c3d35}
  .card li{margin:3px 0}
  .row{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:12px}
  button{font:inherit;font-weight:800;font-size:16px;border:0;border-radius:999px;padding:12px 20px;min-height:44px;cursor:pointer;background:#292a23;color:#d8fd71}
  button.alt{background:#d8fd71;color:#292a23;box-shadow:inset 0 0 0 2px #292a23}
  button:focus-visible,a:focus-visible{outline:3px solid #346fdf;outline-offset:2px}
  .big{font-size:40px;margin:0}
  footer{position:fixed;bottom:8px;left:0;right:0;z-index:3;text-align:center;font-size:12px;font-weight:700;color:${ink};opacity:.85;pointer-events:none}
  footer a{pointer-events:auto}
</style>
</head>
<body>
<a class="back" href="https://start.ng" target="_blank" rel="noopener">← start.ng</a>
<div class="hud" aria-live="off"><span id="score">0</span><span id="lives" aria-label="Lives"></span></div>
<canvas id="game" role="img" aria-label="${title} game area"></canvas>

<div class="screen" id="start-screen">
  <div class="card">
    <p class="brand">a start.ng game</p>
    <p class="big" aria-hidden="true">${s.player}</p>
    <h1>${title}</h1>
    <p>${escapeHtml(plan.loop)}</p>
    <ul>${plan.controls.map((c) => `<li>${escapeHtml(c)}</li>`).join('')}</ul>
    <button id="play" type="button">Play</button>
  </div>
</div>

<div class="screen" id="over-screen" hidden>
  <div class="card" role="dialog" aria-labelledby="over-title">
    <p class="brand">${title} · start.ng</p>
    <h2 id="over-title">Game over</h2>
    <p id="final" aria-live="polite"></p>
    <p id="best"></p>
    <div class="row">
      <button id="again" type="button">Play again</button>
      <button id="share" class="alt" type="button">Share on X</button>
    </div>
  </div>
</div>

<footer>Play more games on <a href="https://start.ng" target="_blank" rel="noopener">start.ng</a></footer>

<script>
(function () {
  "use strict";
  var G = ${scriptJson(s)};
  var cv = document.getElementById("game"), ctx = cv.getContext("2d");
  var scoreEl = document.getElementById("score"), livesEl = document.getElementById("lives");
  var startScreen = document.getElementById("start-screen"), overScreen = document.getElementById("over-screen");
  var W = 0, H = 0, groundY = 0;
  var EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    groundY = H - Math.max(48, H * 0.12);
    if (state) state.player.y = playerRestY();
  }

  var state = null, keys = {}, pointerX = null, last = 0, running = false;
  var base = 110 + G.speed * 45;
  function playerRestY() { return groundY - G.size / 2; }

  function reset() {
    state = {
      t: 0, score: 0, lives: G.lives, items: [], shots: [], spawn: 0, fire: 0, hurt: 0, vy: 0,
      player: { x: G.genre === "runner" ? Math.max(70, W * 0.2) : W / 2, y: playerRestY() }
    };
    hud();
  }

  function hud() {
    scoreEl.textContent = "Score " + Math.floor(state.score);
    livesEl.textContent = state.lives > 5 ? "❤️ x" + state.lives : new Array(state.lives + 1).join("❤️");
    livesEl.setAttribute("aria-label", state.lives + " lives");
  }

  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

  function spawn() {
    var ramp = 1 + state.t / 30, size = 34;
    if (G.genre === "runner") {
      var air = Math.random() < 0.35;
      state.items.push({
        good: air, e: air ? pick(G.good) : pick(G.bad), size: size,
        x: W + size, y: air ? groundY - G.size * 2.2 - Math.random() * 40 : groundY - size / 2,
        vx: -base * 1.6 * ramp, vy: 0
      });
      return;
    }
    var goodChance = G.genre === "catch" ? 0.7 : G.genre === "shooter" ? 0.15 : 0.2;
    var good = Math.random() < goodChance;
    state.items.push({
      good: good, e: good ? pick(G.good) : pick(G.bad), size: size,
      x: size + Math.random() * (W - size * 2), y: -size, vx: 0,
      vy: base * (0.75 + Math.random() * 0.5) * ramp
    });
  }

  function hit(a, b, r) { var dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy < r * r; }

  function loseLife() {
    if (state.hurt > 0) return;
    state.lives -= 1; state.hurt = 1.1; hud();
    if (state.lives <= 0) gameOver();
  }

  function update(dt) {
    state.t += dt;
    if (state.hurt > 0) state.hurt -= dt;
    var p = state.player, move = base * 2.4;

    if (G.genre === "runner") {
      var onGround = p.y >= playerRestY() - 0.5;
      if ((keys.jump) && onGround) { state.vy = -Math.sqrt(2 * 2200 * G.size * 2.6); keys.jump = false; }
      state.vy += 2200 * dt; p.y = Math.min(playerRestY(), p.y + state.vy * dt);
      if (p.y >= playerRestY()) state.vy = 0;
      state.score += dt * G.speed;
    } else {
      if (keys.left) p.x -= move * dt;
      if (keys.right) p.x += move * dt;
      if (pointerX !== null) { var d = pointerX - p.x; p.x += Math.sign(d) * Math.min(Math.abs(d), move * dt); }
      p.x = Math.max(G.size / 2, Math.min(W - G.size / 2, p.x));
      if (G.genre === "dodge") state.score += dt * G.speed;
    }

    state.spawn -= dt;
    if (state.spawn <= 0) {
      spawn();
      var gap = G.genre === "runner" ? 1.5 : 0.95;
      state.spawn = Math.max(0.28, (gap - G.speed * 0.1) / (1 + state.t / 40)) * (0.7 + Math.random() * 0.6);
    }

    if (G.genre === "shooter") {
      state.fire -= dt;
      if (state.fire <= 0) { state.shots.push({ x: p.x, y: p.y - G.size / 2 }); state.fire = 0.32; }
      state.shots.forEach(function (s) { s.y -= 620 * dt; });
    }

    var reach = (G.size + 30) / 2;
    state.items = state.items.filter(function (it) {
      it.x += it.vx * dt; it.y += it.vy * dt;
      if (G.genre === "shooter" && !it.good) {
        for (var i = 0; i < state.shots.length; i++) {
          if (hit(state.shots[i], it, it.size / 2 + 6)) { state.shots.splice(i, 1); state.score += 1; return false; }
        }
      }
      if (hit(it, p, reach)) {
        if (it.good) state.score += G.genre === "catch" ? 1 : G.genre === "dodge" ? 5 : 3;
        else loseLife();
        return false;
      }
      if (G.genre === "shooter" && !it.good && it.y > groundY) { loseLife(); return false; }
      return it.y < H + 60 && it.x > -60;
    });
    state.shots = state.shots.filter(function (s) { return s.y > -20; });
    hud();
  }

  function draw() {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, G.sky[0]); g.addColorStop(1, G.sky[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = G.ground; ctx.fillRect(0, groundY + G.size / 2 - 6, W, H);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    if (state) {
      state.items.forEach(function (it) { ctx.font = it.size + "px " + EMOJI; ctx.fillText(it.e, it.x, it.y); });
      ctx.fillStyle = "#d8fd71";
      state.shots.forEach(function (s) { ctx.fillRect(s.x - 2, s.y - 10, 4, 14); });
      if (!(state.hurt > 0 && Math.floor(state.hurt * 10) % 2)) {
        ctx.font = G.size + "px " + EMOJI;
        ctx.fillText(G.player, state.player.x, state.player.y);
      }
    }
  }

  function frame(now) {
    if (!running) return;
    var dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
    update(dt);
    if (running) draw();
    requestAnimationFrame(frame);
  }

  function start() {
    reset(); keys = {}; pointerX = null;
    startScreen.hidden = true; overScreen.hidden = true;
    running = true; last = performance.now();
    cv.focus && cv.focus();
    requestAnimationFrame(frame);
  }

  function gameOver() {
    running = false; draw();
    var score = Math.floor(state.score), best = score;
    try { best = Math.max(score, Number(localStorage.getItem("best:" + G.slug)) || 0); localStorage.setItem("best:" + G.slug, best); } catch (e) {}
    document.getElementById("final").textContent = "You scored " + score + "!";
    document.getElementById("best").textContent = best > score ? "Your best: " + best : (score > 0 ? "That's your best yet." : "");
    overScreen.hidden = false;
    document.getElementById("again").focus();
  }

  document.getElementById("play").onclick = start;
  document.getElementById("again").onclick = start;
  document.getElementById("share").onclick = function () {
    var text = "I scored " + Math.floor(state ? state.score : 0) + " on " + G.title + "! Can you beat me?";
    var url = "https://twitter.com/intent/tweet?text=" + encodeURIComponent(text) + "&url=" + encodeURIComponent("https://start.ng/games/" + G.slug);
    window.open(url, "_blank", "noopener");
  };

  var KEYMAP = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", Space: "jump", ArrowUp: "jump", KeyW: "jump" };
  addEventListener("keydown", function (e) {
    var k = KEYMAP[e.code];
    if (!k || !running) return;
    if (!(k === "jump" && e.repeat)) keys[k] = true;
    pointerX = null; e.preventDefault();
  });
  addEventListener("keyup", function (e) { var k = KEYMAP[e.code]; if (k && k !== "jump") keys[k] = false; });
  cv.addEventListener("pointerdown", function (e) {
    if (!running) return;
    if (G.genre === "runner") keys.jump = true; else pointerX = e.offsetX;
  });
  cv.addEventListener("pointermove", function (e) { if (running && G.genre !== "runner" && (e.buttons || e.pointerType !== "mouse")) pointerX = e.offsetX; });
  cv.addEventListener("pointerup", function () { if (G.genre !== "runner") pointerX = null; });
  document.addEventListener("visibilitychange", function () { if (document.hidden) running = false; else if (state && state.lives > 0 && startScreen.hidden && overScreen.hidden) { running = true; last = performance.now(); requestAnimationFrame(frame); } });
  addEventListener("resize", function () { resize(); draw(); });

  resize(); reset(); draw();
})();
</script>
</body>
</html>
`;
}

/** The startng.json file described in start.ng/docs.md. */
export function buildStartngJson(config) {
  const plan = describePlan(config);
  const g = GENRES[config.genre];
  return {
    description: plan.description,
    story: `Made with the Game Creator Copilot (demo). Original idea: ${config.idea}`.slice(0, 600),
    controls: plan.controls,
    howToPlay: [g.loop, ...g.mechanics.slice(0, 3)],
    features: [plan.genreLabel, `${plan.themeLabel} theme`, `${config.lives} lives`, 'Share your score on X'],
    categories: plan.categories,
  };
}
