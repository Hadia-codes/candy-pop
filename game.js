(() => {
  'use strict';

  /* ---------- settings ---------- */
  const COLS = 8, ROWS = 8;
  const CELL = 56;              // one board cell, in canvas pixels
  const SPR = 48;               // candy sprite is drawn 3x (16px -> 48px)
  const W = COLS * CELL, H = ROWS * CELL;
  const MOVES_PER_LEVEL = 20;
  const targetFor = (lvl) => 500 + lvl * 100 + (lvl - 1) * 200;   // 600, 900, 1200 ...

  const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const T = (ms) => (RM ? ms * 0.5 : ms);

  /* ---------- page elements ---------- */
  const $ = (id) => document.getElementById(id);
  const canvas = $('board');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const hud = { level: $('level'), score: $('score'), moves: $('moves'), goal: $('goal'), bar: $('bar'), best: $('best') };
  const overlay = $('overlay'), ovTitle = $('ov-title'), ovText = $('ov-text'), ovBtn = $('ov-btn');
  const muteBtn = $('mute'), newBtn = $('new');

  /* ---------- tiny storage helper (works even if storage is blocked) ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
  };

  /* ---------- sprites ---------- */
  const { TYPES, buildPixels, S } = window.CandySprites;
  const N = TYPES.length;

  function toCanvas(px, override) {
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        if (!px[y][x]) continue;
        g.fillStyle = override || px[y][x];
        g.fillRect(x, y, 1, 1);
      }
    }
    return c;
  }

  const sheets = TYPES.map((t) => {
    const px = buildPixels(t);
    return { normal: toCanvas(px), white: toCanvas(px, '#ffffff'), shadow: toCanvas(px, '#c9729a') };
  });

  /* ---------- sound (little chip beeps) ---------- */
  let audio = null;
  let muted = store.get('candy-muted', '0') === '1';

  function tone(freq, dur = 0.09, type = 'square', vol = 0.05, delay = 0) {
    if (muted) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const t0 = audio.currentTime + delay;
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(audio.destination);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
    } catch (e) { /* audio not available, that's fine */ }
  }

  const NOTES = [523, 587, 659, 784, 880, 988, 1175];
  const sfx = {
    pick: () => tone(784, 0.06),
    swap: () => tone(523, 0.07),
    bad: () => { tone(196, 0.12, 'sawtooth', 0.04); tone(147, 0.16, 'sawtooth', 0.04, 0.09); },
    match: (combo) => {
      const f = NOTES[Math.min(combo, NOTES.length) - 1];
      tone(f, 0.1, 'square', 0.05);
      tone(f * 1.5, 0.12, 'square', 0.04, 0.07);
    },
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, 'square', 0.05, i * 0.1)),
    lose: () => [392, 330, 262].forEach((f, i) => tone(f, 0.18, 'triangle', 0.06, i * 0.14)),
  };

  /* ---------- state ---------- */
  let grid = [];                // grid[row][col] = tile object
  let level = 1, score = 0, moves = MOVES_PER_LEVEL, target = targetFor(1);
  let best = parseInt(store.get('candy-best', '1'), 10) || 1;
  let busy = true;
  let selected = null;          // {r, c}
  let drag = null;
  let hintTiles = [];
  let hintTimer = null;
  const particles = [];
  const floaters = [];

  const rand = (n) => Math.floor(Math.random() * n);
  const newTile = (type, c, r) => ({ t: type, x: c * CELL, y: r * CELL, s: 1, a: 1, flash: false });

  /* ---------- pure board logic (works on a matrix of numbers) ---------- */
  function matchSet(types) {
    const out = new Set();
    for (let r = 0; r < ROWS; r++) {
      let c = 0;
      while (c < COLS) {
        const v = types[r][c];
        let e = c + 1;
        while (v >= 0 && e < COLS && types[r][e] === v) e++;
        if (v >= 0 && e - c >= 3) for (let k = c; k < e; k++) out.add(r * COLS + k);
        c = e;
      }
    }
    for (let c = 0; c < COLS; c++) {
      let r = 0;
      while (r < ROWS) {
        const v = types[r][c];
        let e = r + 1;
        while (v >= 0 && e < ROWS && types[e][c] === v) e++;
        if (v >= 0 && e - r >= 3) for (let k = r; k < e; k++) out.add(k * COLS + c);
        r = e;
      }
    }
    return out;
  }

  const typeMatrix = () => grid.map((row) => row.map((t) => (t ? t.t : -1)));

  function findMove(types) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        for (const [dr, dc] of [[0, 1], [1, 0]]) {
          const r2 = r + dr, c2 = c + dc;
          if (r2 >= ROWS || c2 >= COLS) continue;
          const a = types[r][c];
          types[r][c] = types[r2][c2];
          types[r2][c2] = a;
          const ok = matchSet(types).size > 0;
          types[r2][c2] = types[r][c];
          types[r][c] = a;
          if (ok) return [{ r, c }, { r: r2, c: c2 }];
        }
      }
    }
    return null;
  }

  function randomTypes() {
    const m = [];
    for (let r = 0; r < ROWS; r++) {
      m[r] = [];
      for (let c = 0; c < COLS; c++) {
        let t;
        do {
          t = rand(N);
        } while (
          (c >= 2 && m[r][c - 1] === t && m[r][c - 2] === t) ||
          (r >= 2 && m[r - 1][c] === t && m[r - 2][c] === t)
        );
        m[r][c] = t;
      }
    }
    return m;
  }

  /* ---------- animation helpers ---------- */
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const easeInOut = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

  function easeOutBounce(p) {
    const n1 = 7.5625, d1 = 2.75;
    if (p < 1 / d1) return n1 * p * p;
    if (p < 2 / d1) return n1 * (p -= 1.5 / d1) * p + 0.75;
    if (p < 2.5 / d1) return n1 * (p -= 2.25 / d1) * p + 0.9375;
    return n1 * (p -= 2.625 / d1) * p + 0.984375;
  }

  function tween(ms, fn, ease = (p) => p) {
    return new Promise((resolve) => {
      const start = performance.now();
      function step(now) {
        const p = clamp01((now - start) / ms);
        fn(ease(p), p);
        if (p < 1) requestAnimationFrame(step);
        else resolve();
      }
      requestAnimationFrame(step);
    });
  }

  function burst(x, y, color, light) {
    for (let i = 0; i < 6; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 150;
      particles.push({
        x, y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 90,
        life: 0.5 + Math.random() * 0.3,
        age: 0,
        size: Math.random() < 0.5 ? 4 : 6,
        color: Math.random() < 0.5 ? color : light,
      });
    }
  }

  /* ---------- HUD + overlay ---------- */
  function updateHUD() {
    hud.level.textContent = level;
    hud.score.textContent = score;
    hud.moves.textContent = moves;
    hud.goal.textContent = target;
    hud.best.textContent = best;
    hud.bar.style.width = Math.min(100, (score / target) * 100) + '%';
  }

  function showOverlay(title, text, label, onClick) {
    ovTitle.textContent = title;
    ovText.textContent = text;
    ovBtn.textContent = label;
    ovBtn.onclick = onClick;
    overlay.hidden = false;
    ovBtn.focus({ preventScroll: true });
  }

  const hideOverlay = () => { overlay.hidden = true; };

  /* ---------- hints ---------- */
  function wake() {
    hintTiles = [];
    clearTimeout(hintTimer);
    hintTimer = setTimeout(showHint, 7000);
  }

  function showHint() {
    if (busy || !overlay.hidden) { hintTimer = setTimeout(showHint, 3000); return; }
    const m = findMove(typeMatrix());
    if (m) hintTiles = [grid[m[0].r][m[0].c], grid[m[1].r][m[1].c]];
  }

  /* ---------- game flow ---------- */
  async function startLevel() {
    busy = true;
    hideOverlay();
    selected = null;
    wake();
    score = 0;
    moves = MOVES_PER_LEVEL;
    target = targetFor(level);
    updateHUD();

    let types;
    do { types = randomTypes(); } while (!findMove(types));

    const lift = H + 60;
    grid = types.map((row, r) => row.map((t, c) => {
      const tile = newTile(t, c, r);
      tile.y = r * CELL - lift;
      return tile;
    }));

    const total = 1010;
    await tween(T(total), (p) => {
      const elapsed = p * total;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const delay = c * 45 + (ROWS - 1 - r) * 30;
          const local = clamp01((elapsed - delay) / 480);
          grid[r][c].y = r * CELL - lift + lift * easeOutBounce(local);
        }
      }
    });
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) grid[r][c].y = r * CELL;
    busy = false;
  }

  async function animateSwap(a, b) {
    const ta = grid[a.r][a.c], tb = grid[b.r][b.c];
    const ax = ta.x, ay = ta.y, bx = tb.x, by = tb.y;
    await tween(T(170), (p) => {
      ta.x = ax + (bx - ax) * p; ta.y = ay + (by - ay) * p;
      tb.x = bx + (ax - bx) * p; tb.y = by + (ay - by) * p;
    }, easeInOut);
    grid[a.r][a.c] = tb;
    grid[b.r][b.c] = ta;
  }

  async function popCells(cells) {
    const tiles = cells.map(({ r, c }) => grid[r][c]);
    tiles.forEach((t) => {
      const sp = TYPES[t.t];
      burst(t.x + CELL / 2, t.y + CELL / 2, sp.main, sp.light);
    });
    await tween(T(240), (p) => {
      for (const t of tiles) {
        t.flash = p < 0.5;
        t.s = p < 0.4 ? 1 + 0.2 * (p / 0.4) : Math.max(0, 1.2 * (1 - (p - 0.4) / 0.6));
      }
    });
    cells.forEach(({ r, c }) => { grid[r][c] = null; });
  }

  async function collapse() {
    for (let c = 0; c < COLS; c++) {
      let write = ROWS - 1;
      for (let r = ROWS - 1; r >= 0; r--) {
        if (grid[r][c]) {
          if (r !== write) { grid[write][c] = grid[r][c]; grid[r][c] = null; }
          write--;
        }
      }
      let k = 0;
      for (let r = write; r >= 0; r--) {
        k++;
        const t = newTile(rand(N), c, r);
        t.y = -k * CELL;
        grid[r][c] = t;
      }
    }
    const falls = [];
    let far = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = grid[r][c];
        const to = r * CELL;
        if (t.y !== to) { falls.push({ t, from: t.y, to }); far = Math.max(far, (to - t.y) / CELL); }
      }
    }
    if (!falls.length) return;
    await tween(T(260 + far * 60), (p) => {
      for (const f of falls) f.t.y = f.from + (f.to - f.from) * p;
    }, easeOutBounce);
    for (const f of falls) f.t.y = f.to;
  }

  async function resolve() {
    let combo = 0;
    for (;;) {
      const set = matchSet(typeMatrix());
      if (!set.size) break;
      combo++;
      const gained = set.size * 10 * combo;
      score += gained;
      updateHUD();
      sfx.match(combo);

      const cells = [...set].map((i) => ({ r: Math.floor(i / COLS), c: i % COLS }));
      const cx = cells.reduce((s, q) => s + q.c, 0) / cells.length;
      const cy = cells.reduce((s, q) => s + q.r, 0) / cells.length;
      floaters.push({
        text: combo > 1 ? `+${gained} x${combo}` : `+${gained}`,
        x: Math.max(70, Math.min(W - 70, cx * CELL + CELL / 2)),
        y: cy * CELL + CELL / 2,
        age: 0,
      });

      await popCells(cells);
      await collapse();
    }
  }

  async function shuffleBoard() {
    floaters.push({ text: 'No moves. Shuffling!', x: W / 2, y: H / 2, age: 0 });
    const tiles = grid.flat();
    await tween(T(200), (p) => { tiles.forEach((t) => { t.s = 1 - p; }); });

    let types, tries = 0;
    const pool = tiles.map((t) => t.t);
    do {
      for (let i = pool.length - 1; i > 0; i--) {
        const j = rand(i + 1);
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      types = [];
      for (let r = 0; r < ROWS; r++) types.push(pool.slice(r * COLS, r * COLS + COLS));
      tries++;
    } while ((matchSet(types).size > 0 || !findMove(types)) && tries < 200);
    if (tries >= 200) {
      do { types = randomTypes(); } while (!findMove(types));
    }
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) grid[r][c].t = types[r][c];

    await tween(T(200), (p) => { tiles.forEach((t) => { t.s = p; }); });
    tiles.forEach((t) => { t.s = 1; });
  }

  function afterTurn() {
    if (score >= target) {
      if (level >= best) { best = level + 1; store.set('candy-best', String(best)); updateHUD(); }
      sfx.win();
      showOverlay('Level cleared!', `You scored ${score}. Next goal: ${targetFor(level + 1)}.`, 'Next level', () => {
        level++;
        startLevel();
      });
      return true;
    }
    if (moves <= 0) {
      sfx.lose();
      showOverlay('Out of moves', `You scored ${score} of ${target}.`, 'Try again', () => startLevel());
      return true;
    }
    return false;
  }

  async function trySwap(a, b) {
    busy = true;
    selected = null;
    wake();
    sfx.swap();
    await animateSwap(a, b);

    if (!matchSet(typeMatrix()).size) {
      sfx.bad();
      await animateSwap(a, b);          // swap back
      busy = false;
      return;
    }

    moves--;
    updateHUD();
    await resolve();

    if (!afterTurn() && !findMove(typeMatrix())) await shuffleBoard();
    busy = false;
    wake();
  }

  /* ---------- input ---------- */
  const adjacent = (a, b) => Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;

  function toBoard(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) * W) / rect.width, y: ((e.clientY - rect.top) * H) / rect.height };
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (busy || !overlay.hidden) return;
    e.preventDefault();
    wake();
    const { x, y } = toBoard(e);
    const c = Math.floor(x / CELL), r = Math.floor(y / CELL);
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }

    if (selected && adjacent(selected, { r, c })) {
      const a = selected;
      selected = null;
      drag = null;
      trySwap(a, { r, c });
      return;
    }
    if (selected && selected.r === r && selected.c === c) {
      selected = null;
      drag = null;
      return;
    }
    selected = { r, c };
    drag = { r, c, x, y };
    sfx.pick();
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!drag || busy) return;
    const { x, y } = toBoard(e);
    const dx = x - drag.x, dy = y - drag.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < CELL * 0.45) return;
    let r2 = drag.r, c2 = drag.c;
    if (Math.abs(dx) > Math.abs(dy)) c2 += dx > 0 ? 1 : -1;
    else r2 += dy > 0 ? 1 : -1;
    const from = { r: drag.r, c: drag.c };
    drag = null;
    if (r2 < 0 || c2 < 0 || r2 >= ROWS || c2 >= COLS) return;
    trySwap(from, { r: r2, c: c2 });
  });

  const endDrag = () => { drag = null; };
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  newBtn.addEventListener('click', () => { level = 1; startLevel(); });

  function paintMute() {
    muteBtn.textContent = muted ? 'Sound off' : 'Sound on';
    muteBtn.setAttribute('aria-pressed', String(muted));
  }
  muteBtn.addEventListener('click', () => {
    muted = !muted;
    store.set('candy-muted', muted ? '1' : '0');
    paintMute();
    if (!muted) sfx.pick();
  });
  paintMute();

  /* ---------- drawing ---------- */
  let last = performance.now();

  function drawTile(t, now) {
    const sp = sheets[t.t];
    const size = Math.round(SPR * t.s);
    if (size <= 0 || t.a <= 0) return;
    let ox = 0, oy = 0;
    const sel = selected && grid[selected.r] && grid[selected.r][selected.c] === t;
    if (sel) oy = -Math.round(Math.abs(Math.sin(now / 160)) * 4);
    if (hintTiles.includes(t)) ox = Math.round(Math.sin(now / 60) * 2);
    const x = Math.round(t.x + (CELL - size) / 2 + ox);
    const y = Math.round(t.y + (CELL - size) / 2 + oy);
    ctx.globalAlpha = 0.45 * t.a;
    ctx.drawImage(sp.shadow, x + 3, y + 4, size, size);
    ctx.globalAlpha = t.a;
    ctx.drawImage(t.flash ? sp.white : sp.normal, x, y, size, size);
    ctx.globalAlpha = 1;
  }

  function render(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    ctx.clearRect(0, 0, W, H);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        ctx.fillStyle = (r + c) % 2 ? '#ffe9f3' : '#fff8fc';
        ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
      }
    }

    if (selected && Math.floor(now / 260) % 2 === 0) {
      const x = selected.c * CELL, y = selected.r * CELL;
      ctx.fillStyle = '#ff4f93';
      ctx.fillRect(x, y, CELL, 4);
      ctx.fillRect(x, y + CELL - 4, CELL, 4);
      ctx.fillRect(x, y, 4, CELL);
      ctx.fillRect(x + CELL - 4, y, 4, CELL);
    }

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = grid[r] && grid[r][c];
        if (t) drawTile(t, now);
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += dt;
      if (p.age >= p.life) { particles.splice(i, 1); continue; }
      p.vy += 520 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      ctx.globalAlpha = 1 - p.age / p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;

    ctx.font = "600 24px 'Pixelify Sans', 'Courier New', monospace";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      f.age += dt;
      if (f.age > 1.1) { floaters.splice(i, 1); continue; }
      const y = Math.round(f.y - f.age * 36);
      ctx.globalAlpha = f.age > 0.8 ? 1 - (f.age - 0.8) / 0.3 : 1;
      ctx.fillStyle = '#7d2650';
      ctx.fillText(f.text, f.x + 2, y + 2);
      ctx.fillText(f.text, f.x - 2, y + 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(f.text, f.x, y);
    }
    ctx.globalAlpha = 1;

    requestAnimationFrame(render);
  }

  /* ---------- go ---------- */
  requestAnimationFrame(render);
  updateHUD();
  const begin = () => startLevel();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(begin, begin);
  else begin();

  // offline support when the game is hosted (skipped on localhost so edits show up right away)
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) &&
      !['localhost', '127.0.0.1'].includes(location.hostname)) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
