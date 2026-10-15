// Candy sprites are drawn in code (16x16 pixels each), so there are no image files to load.
(function (root) {
  const S = 16;
  const FACE = '#4a2540';

  const TYPES = [
    { name: 'heart',  shape: 'heart',  main: '#ff6fa5', light: '#ffb3d1', dark: '#d9457f', line: '#7d2650', blush: '#ff3d7a', hl: [4.5, 5],  fy: 6 },
    { name: 'drop',   shape: 'drop',   main: '#5db8ff', light: '#a9dcff', dark: '#3a86d6', line: '#234a8a', blush: '#ff8fae', hl: [4.5, 4.5], fy: 7 },
    { name: 'star',   shape: 'star',   main: '#ffd84a', light: '#fff0a0', dark: '#e8a920', line: '#8a5a14', blush: '#ff9a7a', hl: [6.2, 5.5],  fy: 7 },
    { name: 'bean',   shape: 'bean',   main: '#ff9a45', light: '#ffc58f', dark: '#de6c1f', line: '#8a3d15', blush: '#ff6b7a', hl: [4.5, 6],  fy: 7 },
    { name: 'pop',    shape: 'pop',    main: '#b685ff', light: '#dcc2ff', dark: '#8a56d6', line: '#4d2e8a', blush: '#ff8fae', hl: [4.5, 3.5], fy: 5,
      cy: 6.3, ring: [4.3, 5.1], stick: 12, stickColor: '#fff2c6' },
    { name: 'wrap',   shape: 'wrap',   main: '#6fdc8c', light: '#b6f5c4', dark: '#3fb363', line: '#1f6a3a', blush: '#ff8fae', hl: [6, 5.5],  fy: 7 },
  ];

  function inShape(t, x, y) {
    switch (t.shape) {
      case 'heart': {
        const u = (x - 8) / 6.1, v = (8.9 - y) / 6.1;
        const a = u * u + v * v - 1;
        return a * a * a - u * u * v * v * v <= 0;
      }
      case 'drop': {
        const dx = x - 8, dy = y - 8.4;
        return dx * dx + dy * dy <= 6.6 * 6.6;
      }
      case 'star': {
        const pts = [];
        for (let i = 0; i < 10; i++) {
          const ang = -Math.PI / 2 + (i * Math.PI) / 5;
          const r = i % 2 === 0 ? 7.9 : 4.7;
          pts.push([8 + r * Math.cos(ang), 8.5 + r * Math.sin(ang)]);
        }
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i], [xj, yj] = pts[j];
          if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
        }
        return inside;
      }
      case 'bean': {
        const dx = x - 8, dy = y - 8;
        const k = 0.5; // tilt in radians
        const u = dx * Math.cos(k) + dy * Math.sin(k), w = -dx * Math.sin(k) + dy * Math.cos(k);
        return (u / 7.7) ** 2 + (w / 5.6) ** 2 <= 1;
      }
      case 'pop': {
        const dx = x - 8, dy = y - t.cy;
        if (dx * dx + dy * dy <= 5.8 * 5.8) return true;
        return y >= 11 && y <= 15.9 && Math.abs(x - 8) <= 1.9;
      }
      case 'wrap': {
        const dx = x - 8, dy = y - 8.2;
        if (dx * dx + dy * dy <= 5.4 * 5.4) return true;
        const ax = Math.abs(dx);
        if (ax >= 4.6 && ax <= 7.9) return Math.abs(dy) <= (ax - 4.6) * 0.95 + 1.0;
        return false;
      }
    }
    return false;
  }

  function buildPixels(t) {
    const mask = [];
    for (let y = 0; y < S; y++) {
      mask[y] = [];
      for (let x = 0; x < S; x++) mask[y][x] = inShape(t, x + 0.5, y + 0.5);
    }
    const at = (x, y) => x >= 0 && y >= 0 && x < S && y < S && mask[y][x];
    const inner = (x, y) => at(x, y) && at(x - 1, y) && at(x + 1, y) && at(x, y - 1) && at(x, y + 1);
    const px = Array.from({ length: S }, () => Array(S).fill(null));

    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        if (!mask[y][x]) continue;
        if (!inner(x, y)) { px[y][x] = t.line; continue; }
        let col = x + y > 20 ? t.dark : t.main;
        if (t.ring) {
          const d = Math.hypot(x + 0.5 - 8, y + 0.5 - t.cy);
          if (d > t.ring[0] && d < t.ring[1]) col = t.light;
        }
        if (t.stick && y >= t.stick) col = t.stickColor;
        px[y][x] = col;
      }
    }

    // shiny spot
    const [hx, hy] = t.hl;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        if (!inner(x, y)) continue;
        const d = Math.hypot(x + 0.5 - hx, y + 0.5 - hy);
        if (d <= 0.9) px[y][x] = '#ffffff';
        else if (d <= 1.7 && px[y][x] !== '#ffffff') px[y][x] = t.light;
      }
    }

    // little face
    const fy = t.fy;
    const put = (x, y, c) => { if (inner(x, y)) px[y][x] = c; };
    put(6, fy, FACE); put(6, fy + 1, FACE);
    put(10, fy, FACE); put(10, fy + 1, FACE);
    put(7, fy + 2, FACE); put(8, fy + 3, FACE); put(9, fy + 2, FACE);
    put(4, fy + 2, t.blush); put(5, fy + 2, t.blush);
    put(11, fy + 2, t.blush); put(12, fy + 2, t.blush);
    return px;
  }

  const api = { S, TYPES, buildPixels };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CandySprites = api;
})(typeof window !== 'undefined' ? window : globalThis);
