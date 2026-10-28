// Homepage micro-interactions, all driven by the visitor's cursor (or finger):
// 1. the hero headline's letters bump like game blocks and pop coins,
// 2. the Suya Knight lives on top of the headline: it chases the cursor and slashes bugs that crawl out of the letters,
// 3. the tournament hopper's eyes follow the cursor,
// 4. category tiles and game cards tilt like holographic cartridges.

const reduce = matchMedia('(prefers-reduced-motion: reduce)');

function bump(el, cls) {
  el.classList.remove(cls);
  void el.getBoundingClientRect(); // restart the animation
  el.classList.add(cls);
}

// points a character's eyes at (x, y); reach is how far the pupils can move
function lookAt(el, x, y, reachX = 0.9, reachY = 0.7) {
  const r = el.getBoundingClientRect();
  const dx = x - (r.left + r.width / 2);
  const dy = y - (r.top + r.height / 2);
  const d = Math.hypot(dx, dy) || 1;
  el.style.setProperty('--ex', `${((dx / d) * reachX).toFixed(2)}px`);
  el.style.setProperty('--ey', `${((dy / d) * reachY).toFixed(2)}px`);
}

// 1. Headline blocks. The text stays the same: letters are wrapped for animation and the heading keeps its label.
const hero = document.querySelector('.hero');
const h1 = hero?.querySelector('h1');
let letters = [];
let onLetterHit = () => {};
const cooling = new WeakSet();

function coinAt(x, y) {
  const c = document.createElement('span');
  c.className = 'block-coin';
  c.setAttribute('aria-hidden', 'true');
  c.style.left = `${x - 8}px`;
  c.style.top = `${y}px`;
  hero.append(c);
  setTimeout(() => c.remove(), 700);
}

function coin(ltr) {
  const hr = hero.getBoundingClientRect();
  const r = ltr.getBoundingClientRect();
  coinAt(r.left - hr.left + r.width / 2, r.top - hr.top + r.height * 0.15);
}

// kind: 'bonk' (hit from below by the cursor) or 'stomp' (landed on by the knight)
function hit(ltr, kind = 'bonk') {
  if (kind === 'bonk') onLetterHit(ltr); // launch the knight even if this letter was just stomped
  if (cooling.has(ltr)) return;
  cooling.add(ltr);
  setTimeout(() => cooling.delete(ltr), 650);
  bump(ltr, kind);
  coin(ltr);
}

if (h1 && !reduce.matches) {
  h1.setAttribute('aria-label', h1.innerText.replace(/\s+/g, ' ').trim());
  const wrap = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        for (const ch of child.textContent) {
          if (/\s/.test(ch)) frag.append(ch);
          else {
            const s = document.createElement('span');
            s.className = 'block-ltr';
            s.setAttribute('aria-hidden', 'true');
            s.textContent = ch;
            frag.append(s);
          }
        }
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE) wrap(child);
    }
  };
  wrap(h1);
  letters = [...h1.querySelectorAll('.block-ltr')];

  // The cursor is the player: any letter it passes close to gets bumped.
  let last = 0;
  hero.addEventListener('pointermove', (e) => {
    if (e.timeStamp - last < 16) return; // about once a frame
    last = e.timeStamp;
    for (const ltr of letters) {
      const r = ltr.getBoundingClientRect();
      if (e.clientX > r.left - 4 && e.clientX < r.right + 4 && e.clientY > r.top + r.height * 0.1 && e.clientY < r.bottom) hit(ltr);
    }
  });
}

// 2. The Suya Knight: walks on the tops of "Good vibes." and fights the bugs that crawl out of the letters.
const KNIGHT = `<span class="knight-wrap"><svg viewBox="0 0 30 32" aria-hidden="true">
  <g class="k-body">
    <path d="M13 4.5c1.5-3.5 6.5-4 8-.5-2.4-.2-4.6.8-5.6 2.6z" fill="#d8fd71" stroke="#292a23" stroke-width="1.2" stroke-linejoin="round"/>
    <rect x="8" y="4" width="13" height="11.5" rx="5.5" fill="#292a23"/>
    <rect x="10" y="8.8" width="9" height="5" rx="2" fill="#8d5524"/>
    <g class="k-eyes"><circle cx="12.6" cy="11.2" r="1.05" fill="#fffefa"/><circle cx="16.6" cy="11.2" r="1.05" fill="#fffefa"/></g>
    <rect class="k-leg l" x="10.5" y="23" width="3" height="7" rx="1.2" fill="#292a23"/>
    <rect class="k-leg r" x="15.5" y="23" width="3" height="7" rx="1.2" fill="#292a23"/>
    <rect x="9" y="15" width="11" height="9" rx="3" fill="#d8fd71" stroke="#292a23" stroke-width="1.5"/>
    <rect x="9.6" y="20" width="9.8" height="1.6" fill="#292a23"/>
    <path d="M5.5 15.5h5.5v5.2c0 2.2-2.75 3.8-2.75 3.8s-2.75-1.6-2.75-3.8z" fill="#fffefa" stroke="#292a23" stroke-width="1.2" stroke-linejoin="round"/>
  </g>
  <g class="k-arm">
    <line x1="21.5" y1="19" x2="29" y2="3" stroke="#7a5230" stroke-width="1.4" stroke-linecap="round"/>
    <circle cx="24.1" cy="13.4" r="2" fill="#a0522d" stroke="#292a23" stroke-width=".8"/>
    <circle cx="25.9" cy="9.6" r="2" fill="#b5652a" stroke="#292a23" stroke-width=".8"/>
    <circle cx="27.6" cy="6" r="1.8" fill="#a0522d" stroke="#292a23" stroke-width=".8"/>
    <circle cx="25.4" cy="12.6" r=".55" fill="#e1251b"/><circle cx="26.7" cy="8.9" r=".55" fill="#e1251b"/>
    <rect x="19.8" y="17.6" width="3.4" height="3.4" rx="1.2" fill="#8d5524" stroke="#292a23" stroke-width=".8"/>
  </g>
</svg></span>`;

if (hero && letters.length) {
  const TALL = /[A-Zbdfhklt]/;
  const line = letters.filter((l) => Math.abs(l.offsetTop - letters[0].offsetTop) < 5); // first line only
  const knight = document.createElement('span');
  knight.className = 'hero-knight';
  knight.setAttribute('aria-hidden', 'true');
  knight.innerHTML = KNIGHT;
  hero.append(knight);

  const W = 24;
  const H = 26;
  const GRAV = 1700;
  const REACH = 26;
  const s = { x: 0, y: -80, vy: 0, onGround: false, face: 1, target: null, under: null, idle: 0, cooldown: 0, slash: 0, intro: true, hunt: null, spawn: 2.5 };
  const bugs = [];

  // where the glyph's top is, relative to the hero (tall letters stand higher than x-height ones)
  const top = (ltr, hr) => {
    const r = ltr.getBoundingClientRect();
    const f = ltr.textContent === '.' ? 0.64 : TALL.test(ltr.textContent) ? 0.07 : 0.27;
    return { left: r.left - hr.left, right: r.right - hr.left, y: r.top - hr.top + r.height * f, ltr };
  };
  const terrain = () => {
    const hr = hero.getBoundingClientRect();
    return line.map((l) => top(l, hr));
  };
  const groundAt = (t, x) => t.find((p) => x >= p.left - 2 && x <= p.right + 2) || null;
  const floorAt = (t, x) => groundAt(t, x)?.y ?? Math.max(...t.map((p) => p.y));

  const start = terrain();
  s.x = (start[0].left + start[0].right) / 2;
  s.target = s.x;

  let pointer = null;
  hero.addEventListener('pointermove', (e) => {
    const hr = hero.getBoundingClientRect();
    pointer = { x: e.clientX - hr.left, y: e.clientY - hr.top, t: performance.now() };
    lookAt(knight, e.clientX, e.clientY);
  });
  hero.addEventListener('pointerleave', () => (pointer = null));
  addEventListener('pointermove', (e) => !pointer && lookAt(knight, e.clientX, e.clientY));

  function jump(v) {
    s.vy = v;
    s.onGround = false;
    bump(knight, 'leap');
  }

  // a bug pops out of a letter top and starts scurrying
  function spawnBug(t) {
    const choices = t.filter((p) => Math.abs((p.left + p.right) / 2 - s.x) > 70);
    const p = choices[Math.floor(Math.random() * choices.length)];
    if (!p) return;
    const el = document.createElement('span');
    el.className = 'hero-bug pop-in';
    el.setAttribute('aria-hidden', 'true');
    hero.append(el);
    bump(p.ltr, 'bonk');
    const bug = { el, x: (p.left + p.right) / 2, vx: (Math.random() < 0.5 ? -1 : 1) * 30, turn: 1 + Math.random() * 2, alive: true };
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      s.hunt = bug;
      if (s.onGround && Math.abs(bug.x - s.x) > 90) jump(-480);
    });
    bugs.push(bug);
  }

  function slay(bug) {
    bug.alive = false;
    s.slash = 0.35;
    if (s.hunt === bug) s.hunt = null;
    bump(knight, 'slash');
    setTimeout(() => {
      bug.el.classList.add('squish');
      const t = terrain();
      coinAt(bug.x, floorAt(t, bug.x) - 26);
      setTimeout(() => bug.el.remove(), 320);
    }, 110);
  }

  // tap a letter: the knight leaps over and stomps it
  h1.addEventListener('pointerdown', (e) => {
    const ltr = e.target.closest('.block-ltr');
    if (!ltr) return;
    if (line.includes(ltr)) {
      const hr = hero.getBoundingClientRect();
      const r = ltr.getBoundingClientRect();
      s.target = r.left - hr.left + r.width / 2;
      s.hunt = null;
      if (s.onGround) jump(-520);
    } else hit(ltr);
  });

  // poke the knight: it backflips
  knight.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    bump(knight, 'flip');
    if (s.onGround) jump(-560);
  });

  // bonk the letter it stands on from below, and it gets launched
  onLetterHit = (ltr) => {
    if (s.onGround && s.under === ltr) {
      jump(-640);
      bump(knight, 'flip');
    }
  };

  function step(dt) {
    const t = terrain();
    const minX = t[0].left + W / 2;
    const maxX = t[t.length - 1].right - W / 2;
    s.cooldown -= dt;
    s.slash -= dt;

    // bugs: pop out every few seconds, scurry along the letters, run from the cursor
    if (!s.intro && (s.spawn -= dt) <= 0) {
      s.spawn = 3 + Math.random() * 3;
      if (bugs.filter((b) => b.alive).length < 2) spawnBug(t);
    }
    for (const b of bugs) {
      if (!b.alive) continue;
      if ((b.turn -= dt) <= 0) {
        b.turn = 1 + Math.random() * 2;
        b.vx = (Math.random() < 0.5 ? -1 : 1) * (20 + Math.random() * 25);
      }
      const by = floorAt(t, b.x);
      let vx = b.vx;
      if (pointer && Math.abs(pointer.x - b.x) < 70 && Math.abs(pointer.y - by) < 70 && s.hunt !== b) vx = Math.sign(b.x - pointer.x || 1) * 110;
      b.x = Math.max(minX, Math.min(maxX, b.x + vx * dt));
      if (b.x === minX || b.x === maxX) b.vx = -b.vx;
      b.el.style.transform = `translate(${(b.x - 15).toFixed(1)}px, ${(floorAt(t, b.x) - 20).toFixed(1)}px)`;
    }
    for (let i = bugs.length - 1; i >= 0; i--) if (!bugs[i].alive && !bugs[i].el.isConnected) bugs.splice(i, 1);

    // decide where to go: a bug you pointed at, then your cursor, then the nearest bug, then wander
    const live = bugs.filter((b) => b.alive);
    if (s.hunt && !s.hunt.alive) s.hunt = null;
    let speed = 230;
    if (s.hunt) {
      s.target = s.hunt.x;
      speed = 330;
    } else if (pointer && performance.now() - pointer.t < 2500) {
      s.target = Math.max(minX, Math.min(maxX, pointer.x));
      s.idle = 0;
      // the cursor hovers just above: try to catch it
      if (s.onGround && s.cooldown <= 0 && pointer.y < s.y - H && pointer.y > s.y - 140 && Math.abs(pointer.x - s.x) < 40) {
        jump(-560);
        s.cooldown = 0.6;
      }
    } else if (live.length) {
      s.target = live.reduce((a, b) => (Math.abs(b.x - s.x) < Math.abs(a.x - s.x) ? b : a)).x;
      speed = 160;
    } else if ((s.idle += dt) > 3) {
      s.idle = 0;
      const p = t[Math.floor(Math.random() * t.length)];
      s.target = (p.left + p.right) / 2;
    }

    // walk
    const dx = (s.target ?? s.x) - s.x;
    const vx = Math.abs(dx) < 3 ? 0 : Math.sign(dx) * Math.min(speed, Math.abs(dx) * 5);
    if (vx) s.face = Math.sign(vx);
    knight.classList.toggle('running', !!vx && s.onGround);
    const ahead = groundAt(t, s.x + s.face * (W / 2));
    if (s.onGround && vx && ahead && ahead.y < s.y - 4) jump(-330); // step up onto a taller letter
    s.x = Math.max(minX, Math.min(maxX, s.x + vx * dt));

    // any bug within reach of the skewer gets slashed
    if (s.slash <= 0) {
      const prey = live.find((b) => Math.abs(b.x - s.x) < REACH && Math.abs(floorAt(t, b.x) - s.y) < 34);
      if (prey) {
        s.face = Math.sign(prey.x - s.x) || s.face;
        slay(prey);
      }
    }

    // fall and land
    const prevY = s.y;
    s.vy += GRAV * dt;
    s.y += s.vy * dt;
    const g = groundAt(t, s.x);
    const floor = g ? g.y : Math.max(...t.map((p) => p.y));
    s.onGround = false;
    if (s.vy >= 0 && prevY <= floor + 1 && s.y >= floor) {
      if (s.vy > 520 && g) {
        hit(g.ltr, 'stomp');
        bump(knight, 'land');
      }
      if (s.intro) {
        s.intro = false;
        line.forEach((l, i) => setTimeout(() => bump(l, 'stomp'), 120 + i * 45)); // level start ripple
      }
      s.y = floor;
      s.vy = 0;
      s.onGround = true;
      s.under = g?.ltr ?? null;
    } else if (s.y > floor + 60) {
      s.y = floor; // fell into a gap between words: pop back up
      s.vy = 0;
    }

    knight.style.transform = `translate(${(s.x - W / 2).toFixed(1)}px, ${(s.y - H).toFixed(1)}px)`;
    knight.style.setProperty('--face', s.face);
  }

  let last = 0;
  let raf = 0;
  let visible = true;
  const loop = (now) => {
    raf = 0;
    step(Math.min(0.033, (now - last) / 1000 || 0));
    last = now;
    if (visible && !document.hidden) raf = requestAnimationFrame(loop);
  };
  const run = () => {
    if (!raf) {
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
  };
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) run();
  }).observe(hero);
  document.addEventListener('visibilitychange', run);
  addEventListener('resize', () => step(0));
  step(0);
  run();
  if (/[?&]debug\b/.test(location.search)) window.heroKnight = { s, bugs, step, hit, spawnBug: () => spawnBug(terrain()) };
}

// 3. The tournament hopper keeps an eye on you.
const tHopper = document.querySelector('.t-hopper');
if (tHopper) {
  let last = 0;
  addEventListener('pointermove', (e) => {
    if (e.timeStamp - last < 32) return;
    last = e.timeStamp;
    lookAt(tHopper, e.clientX, e.clientY, 2.2, 2);
  });
}

// 4. Category tiles and game cards tilt toward the cursor like holographic cartridges.
if (!reduce.matches) {
  document.querySelectorAll('.tag-tile, .grid .game, .shelf .game').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      card.style.setProperty('--rx', `${((0.5 - y) * 10).toFixed(2)}deg`);
      card.style.setProperty('--ry', `${((x - 0.5) * 12).toFixed(2)}deg`);
      card.style.setProperty('--gx', `${(x * 100).toFixed(1)}%`);
      card.style.setProperty('--gy', `${(y * 100).toFixed(1)}%`);
      card.classList.add('tilting');
    });
    card.addEventListener('pointerleave', () => card.classList.remove('tilting'));
  });
}
