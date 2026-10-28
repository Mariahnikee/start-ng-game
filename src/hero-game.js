// Star Hop: the little playable game in the homepage hero.
// Plain canvas, no dependencies. The world is 300 units tall and as wide as
// the canvas aspect allows, so the same level works on desktop and phones.

const world = document.getElementById('world');
if (world) initStarHop(world);

function initStarHop(world) {
  const $ = (id) => document.getElementById(id);
  const canvas = $('world-canvas');
  const ctx = canvas.getContext('2d');
  const overlay = $('world-overlay');
  const startBtn = $('world-start');
  const moreLink = $('world-more');
  const msg = $('world-msg');
  const scoreEl = $('world-score');
  const timeEl = $('world-time');
  const statusEl = $('world-status');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  const H = 300;
  const GROUND = 268;
  const GRAV = 1800;
  const JUMP = 640;
  const SPEED = 270;
  const HERO = 26;
  // x and w are fractions of the world width; amp makes a platform drift.
  const PLATFORMS = [
    { x: 0.1, y: 205, w: 0.15 },
    { x: 0.3, y: 155, w: 0.13, amp: 0.05, spd: 1.2 },
    { x: 0.5, y: 112, w: 0.12 },
    { x: 0.68, y: 168, w: 0.13, amp: 0.04, spd: 1.6 },
    { x: 0.85, y: 100, w: 0.12 },
  ];
  const GROUND_STARS = [0.24, 0.6, 0.95];
  const TOTAL = PLATFORMS.length + GROUND_STARS.length;

  let W = 800;
  let colors = {};
  let raf = 0;
  let visible = true;
  const keys = { left: false, right: false, jump: false };
  const s = {
    mode: 'idle', t: 0, time: 0, score: 0, idleHop: 0,
    hero: { x: 0, y: GROUND, vx: 0, vy: 0, onGround: true, face: 1, squash: 0 },
    stars: [], parts: [],
    clouds: [0.08, 0.42, 0.74].map((f, i) => ({ f, y: 34 + i * 22, r: 16 + i * 3 })),
  };

  function readColors() {
    const css = getComputedStyle(document.documentElement);
    const v = (n, fb) => css.getPropertyValue(n).trim() || fb;
    colors = { ink: v('--ink', '#292a23'), card: v('--card', '#fffefa'), bg: v('--bg', '#f6f5ee'), lime: v('--lime', '#d8fd71'), line: v('--line', '#e4e2d6'), dot: v('--dot', 'rgba(41,42,35,.16)'), onLime: v('--on-lime', '#292a23') };
  }

  function resize() {
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    if (!cssW || !cssH) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    const scale = cssH / H;
    W = cssW / scale;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    readColors();
    if (s.mode === 'idle' && !s.hero.x) s.hero.x = W * 0.5;
    s.hero.x = Math.min(s.hero.x, W - HERO);
    draw();
  }

  function platformRect(p) {
    const x = p.x * W + (p.amp ? Math.sin(s.t * p.spd) * p.amp * W : 0);
    return { x, y: p.y, w: Math.max(p.w * W, 56) };
  }

  function starPos(st) {
    if (st.p != null) {
      const r = platformRect(PLATFORMS[st.p]);
      return { x: r.x + r.w / 2, y: r.y - 30 };
    }
    return { x: st.f * W - 10, y: GROUND - 26 };
  }

  function resetLevel() {
    s.stars = [...PLATFORMS.map((_, p) => ({ p, got: false })), ...GROUND_STARS.map((f) => ({ f, got: false }))];
    s.stars.forEach((st, i) => (st.phase = i * 0.8));
    s.score = 0;
    s.time = 0;
    Object.assign(s.hero, { x: 40, y: GROUND, vx: 0, vy: 0, onGround: true, face: 1, squash: 0 });
    hud();
  }

  function hud() {
    scoreEl.textContent = `★ ${s.score} / ${TOTAL}`;
    timeEl.textContent = `${s.time.toFixed(1)}s`;
  }

  function burst(x, y, n, spread) {
    if (reduce.matches) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = spread * (0.4 + Math.random() * 0.6);
      s.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - spread * 0.5, life: 0.7 + Math.random() * 0.6, lime: i % 3 !== 0, size: 3 + Math.random() * 4 });
    }
  }

  function start() {
    resetLevel();
    s.parts = [];
    s.mode = 'play';
    overlay.hidden = true;
    keys.left = keys.right = keys.jump = false;
    statusEl.textContent = `Game started. Collect all ${TOTAL} stars.`;
    loop();
  }

  function finish() {
    s.mode = 'done';
    const pos = { x: s.hero.x, y: s.hero.y - HERO };
    burst(pos.x, pos.y, 60, 420);
    burst(W * 0.25, 60, 30, 300);
    burst(W * 0.75, 60, 30, 300);
    setTimeout(() => {
      msg.textContent = `All ${TOTAL} stars in ${s.time.toFixed(1)}s! ★`;
      startBtn.textContent = 'Play again';
      moreLink.hidden = false;
      overlay.hidden = false;
      startBtn.focus({ preventScroll: true });
    }, reduce.matches ? 0 : 900);
    statusEl.textContent = `You collected all ${TOTAL} stars in ${s.time.toFixed(1)} seconds.`;
  }

  function update(dt) {
    s.t += dt;
    const h = s.hero;
    const rects = PLATFORMS.map((p) => {
      const now = platformRect(p);
      now.dx = now.x - (p.lastX ?? now.x);
      p.lastX = now.x;
      return now;
    });

    if (s.mode === 'play') {
      s.time += dt;
      h.vx = ((keys.right ? 1 : 0) - (keys.left ? 1 : 0)) * SPEED;
      if (h.vx) h.face = Math.sign(h.vx);
    } else {
      h.vx = 0;
      s.idleHop -= dt;
      if (h.onGround && s.idleHop <= 0 && !reduce.matches) {
        keys.jump = true;
        s.idleHop = s.mode === 'done' ? 0.35 : 1.4;
      }
    }

    if (keys.jump && h.onGround) {
      h.vy = s.mode === 'play' ? -JUMP : -JUMP * 0.55;
      h.onGround = false;
      h.squash = -0.25;
    }
    keys.jump = false;

    const prevY = h.y;
    h.vy += GRAV * dt;
    h.y += h.vy * dt;
    h.x = Math.max(HERO / 2, Math.min(W - HERO / 2, h.x + h.vx * dt));
    h.onGround = false;
    if (h.vy >= 0) {
      for (const r of rects) {
        if (h.x > r.x - 6 && h.x < r.x + r.w + 6 && prevY <= r.y + 0.5 && h.y >= r.y) {
          if (h.vy > 500) h.squash = 0.25;
          h.y = r.y;
          h.vy = 0;
          h.onGround = true;
          h.x += r.dx;
        }
      }
      if (h.y >= GROUND) {
        if (h.vy > 500) h.squash = 0.25;
        h.y = GROUND;
        h.vy = 0;
        h.onGround = true;
      }
    }
    h.squash *= Math.pow(0.0005, dt);

    if (s.mode === 'play') {
      for (const st of s.stars) {
        if (st.got) continue;
        const p = starPos(st);
        if (Math.hypot(p.x - h.x, p.y - (h.y - HERO / 2)) < 26) {
          st.got = true;
          s.score++;
          burst(p.x, p.y, 14, 220);
          if (s.score === TOTAL) finish();
        }
      }
      hud();
    }

    s.parts = s.parts.filter((pt) => {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += GRAV * 0.45 * dt;
      pt.life -= dt;
      return pt.life > 0;
    });
    if (!reduce.matches) s.clouds.forEach((c, i) => (c.f = (c.f - dt * (0.01 + i * 0.004) + 1.2) % 1.2));
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }

  function drawStar(x, y, r, rot) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 ? r * 0.45 : r;
      const a = rot + (i * Math.PI) / 5 - Math.PI / 2;
      ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    }
    ctx.closePath();
    ctx.fillStyle = colors.lime;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = colors.ink;
    ctx.stroke();
  }

  function draw() {
    const c = colors;
    ctx.fillStyle = c.card;
    ctx.fillRect(0, 0, W, H);
    // start.ng's dot grid
    ctx.fillStyle = c.dot;
    for (let x = 9; x < W; x += 18) for (let y = 9; y < GROUND; y += 18) ctx.fillRect(x, y, 1.4, 1.4);

    // clouds
    ctx.lineWidth = 1.5;
    for (const cl of s.clouds) {
      const x = cl.f * W * 1.1 - W * 0.05;
      ctx.fillStyle = c.bg;
      ctx.strokeStyle = c.line;
      ctx.beginPath();
      ctx.arc(x, cl.y, cl.r, Math.PI, 0);
      ctx.arc(x + cl.r * 1.3, cl.y - 4, cl.r * 0.8, Math.PI, 0);
      ctx.lineTo(x + cl.r * 2.1, cl.y + 6);
      ctx.lineTo(x - cl.r, cl.y + 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // hills and ground
    ctx.fillStyle = c.lime;
    ctx.strokeStyle = c.ink;
    ctx.lineWidth = 2;
    for (const [f, r] of [[0.18, 70], [0.55, 95], [0.9, 60]]) {
      ctx.beginPath();
      ctx.arc(f * W, GROUND + 10, r, Math.PI, 0);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = c.bg;
    ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.beginPath();
    ctx.moveTo(0, GROUND + 1);
    ctx.lineTo(W, GROUND + 1);
    ctx.stroke();

    // platforms with start.ng's hard lime shadow
    for (const p of PLATFORMS) {
      const r = platformRect(p);
      ctx.fillStyle = c.lime;
      roundRect(r.x + 4, r.y + 4, r.w, 14, 6);
      ctx.fill();
      ctx.fillStyle = c.card;
      roundRect(r.x, r.y, r.w, 14, 6);
      ctx.fill();
      ctx.stroke();
    }

    // stars
    for (const st of s.stars.length ? s.stars : []) {
      if (st.got) continue;
      const p = starPos(st);
      const bob = reduce.matches ? 0 : Math.sin(s.t * 3 + st.phase) * 4;
      drawStar(p.x, p.y + bob, 10, reduce.matches ? 0 : Math.sin(s.t * 2 + st.phase) * 0.3);
    }

    // hero: a lime block with eyes and little feet
    const h = s.hero;
    const sq = h.squash;
    const w = HERO * (1 + sq * 0.6);
    const hh = HERO * (1 - sq);
    const walk = h.onGround && h.vx ? Math.sin(s.t * 22) * 3 : 0;
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = c.ink;
    ctx.beginPath();
    ctx.moveTo(h.x - 6, h.y - 4);
    ctx.lineTo(h.x - 6 + walk, h.y);
    ctx.moveTo(h.x + 6, h.y - 4);
    ctx.lineTo(h.x + 6 - walk, h.y);
    ctx.stroke();
    ctx.fillStyle = c.lime;
    ctx.lineWidth = 2;
    roundRect(h.x - w / 2, h.y - 3 - hh, w, hh, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = c.ink;
    const ey = h.y - 3 - hh * 0.62;
    const blink = !reduce.matches && s.t % 3.2 < 0.12 ? 0.5 : 2.6;
    for (const ex of [-4, 4]) {
      ctx.beginPath();
      ctx.ellipse(h.x + ex + h.face * 3, ey, 2.4, blink, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // particles
    for (const pt of s.parts) {
      ctx.globalAlpha = Math.min(1, pt.life * 2);
      ctx.fillStyle = pt.lime ? c.lime : c.ink;
      ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;
  }

  let last = 0;
  function frame(now) {
    raf = 0;
    const dt = Math.min(0.033, (now - last) / 1000 || 0);
    last = now;
    update(dt);
    draw();
    const animate = s.mode === 'play' || s.parts.length || !reduce.matches;
    if (animate && visible && !document.hidden) raf = requestAnimationFrame(frame);
  }

  function loop() {
    if (!raf) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }

  // controls
  const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'jump', ArrowUp: 'jump', KeyW: 'jump' };
  const typing = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  addEventListener('keydown', (e) => {
    const k = KEYMAP[e.code];
    if (!k || s.mode !== 'play' || typing(e.target)) return;
    if (k === 'jump') {
      if (!e.repeat) keys.jump = true;
    } else keys[k] = true;
    e.preventDefault();
  });
  addEventListener('keyup', (e) => {
    const k = KEYMAP[e.code];
    if (k && k !== 'jump') keys[k] = false;
  });

  world.querySelectorAll('.world-pad button').forEach((b) => {
    const k = b.dataset.key;
    const down = (e) => {
      e.preventDefault();
      if (s.mode !== 'play') start();
      if (k === 'jump') keys.jump = true;
      else keys[k] = true;
      b.classList.add('on');
    };
    const up = () => {
      if (k !== 'jump') keys[k] = false;
      b.classList.remove('on');
    };
    b.addEventListener('pointerdown', down);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, up));
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  });
  canvas.addEventListener('pointerdown', () => {
    if (s.mode === 'play') keys.jump = true;
  });
  startBtn.addEventListener('click', start);

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) loop();
  }).observe(world);
  document.addEventListener('visibilitychange', () => !document.hidden && loop());
  addEventListener('resize', resize);
  reduce.addEventListener?.('change', loop);
  new MutationObserver(() => {
    readColors();
    draw();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  resetLevel();
  s.hero.x = 0;
  resize();
  loop();
  if (/[?&]debug\b/.test(location.search)) window.starHop = { state: s, start, keys };
}
