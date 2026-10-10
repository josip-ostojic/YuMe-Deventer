// One photo per dish, cut out of the printed menu card scans (assets-src/menu-1.jpg, menu-2.jpg).
//   node scripts/crop-thumbs.mjs            writes public/images/dish/<nr>.webp and src/data/dish-thumbs.json
//   node scripts/crop-thumbs.mjs --sheet    also writes assets-src/thumb-sheet.png (numbered contact sheet to check by eye)
//
// Centres are approximate positions on the 2000px-wide preview of the scans (x1.024 = real pixels).
// Each centre is refined to the dish's own bounding box so small errors don't matter.
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const S = 1.024;
const out = join(root, 'public', 'images', 'dish');
mkdirSync(out, { recursive: true });
mkdirSync(join(root, 'src', 'data'), { recursive: true });

const grid = (src, nums, xs, ys) => nums.map((n, i) => [n, src, xs[i % xs.length], ys[Math.floor(i / xs.length)]]);
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

const dishes = [
  // ---- menu-2: nigiri (3 columns)
  ...grid('menu-2.jpg', range(1, 12), [145, 335, 530], [180, 328, 482, 648]),
  // ---- menu-2: maki (3 columns)
  ...grid('menu-2.jpg', range(20, 40), [815, 1010, 1195], [175, 328, 470, 640, 797, 975, 1130]),
  [41, 'menu-2.jpg', 895, 1290], [42, 'menu-2.jpg', 1150, 1290],
  // ---- menu-2: grilled & fried (4 columns)
  ...grid('menu-2.jpg', range(60, 79), [1470, 1612, 1760, 1900], [165, 305, 455, 595, 730]),
  [80, 'menu-2.jpg', 1470, 865], [84, 'menu-2.jpg', 1730, 865], [85, 'menu-2.jpg', 1895, 865],
  ...grid('menu-2.jpg', range(86, 97), [1475, 1625, 1770, 1895], [1000, 1150, 1295]),
  // ---- menu-1
  [98, 'menu-1.jpg', 135, 125], [99, 'menu-1.jpg', 330, 115], [100, 'menu-1.jpg', 525, 110],
  [101, 'menu-1.jpg', 215, 285], [102, 'menu-1.jpg', 450, 285],
  [110, 'menu-1.jpg', 130, 495], [111, 'menu-1.jpg', 315, 520], [112, 'menu-1.jpg', 490, 520],
  ...grid('menu-1.jpg', range(115, 123), [140, 325, 510], [720, 895, 1085]),
  [124, 'menu-1.jpg', 205, 1260],
  ...grid('menu-1.jpg', range(150, 153), [785, 905, 1050, 1210], [885]),
  ...grid('menu-1.jpg', range(154, 159), [805, 1005, 1205], [1015, 1140]),
  [160, 'menu-1.jpg', 825, 1270], [161, 'menu-1.jpg', 1135, 1270],
];

const OUT_W = 168, OUT_H = 132; // real pixels, shown at about 84 x 66
const cache = {};
const load = async (f) => (cache[f] ??= (async () => {
  const { data, info } = await sharp(join(root, 'assets-src', f)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
})());

// Finds the dish near (cx, cy): mask of non-background pixels, erode (thin printed text disappears),
// dilate + label (pieces of one dish merge), then take the biggest blob and return the centre of its eroded pixels.
function findDish(img, cx, cy) {
  const hw = Math.round(78 * S), hh = Math.round(66 * S);
  const x0 = Math.max(0, cx - hw), x1 = Math.min(img.w, cx + hw), y0 = Math.max(0, cy - hh), y1 = Math.min(img.h, cy + hh);
  const W = x1 - x0, H = y1 - y0;
  const mask = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = ((y + y0) * img.w + (x + x0)) * 3;
    const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
    const lum = (r + g + b) / 3, sat = Math.max(r, g, b) - Math.min(r, g, b);
    mask[y * W + x] = lum < 224 || sat > 40 ? 1 : 0;
  }
  const morph = (src, rad, wantAll) => {
    const out = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let all = true, any = false;
      for (let dy = -rad; dy <= rad && (all || !any); dy++) for (let dx = -rad; dx <= rad; dx++) {
        const yy = y + dy, xx = x + dx;
        const v = yy >= 0 && yy < H && xx >= 0 && xx < W ? src[yy * W + xx] : 0;
        if (v) any = true; else all = false;
        if (wantAll ? !all : any) break;
      }
      out[y * W + x] = wantAll ? (all ? 1 : 0) : (any ? 1 : 0);
    }
    return out;
  };
  const eroded = morph(mask, 2, true);
  const merged = morph(eroded, 12, false);
  // label connected components of 'merged'
  const label = new Int32Array(W * H), comps = [];
  for (let s = 0; s < W * H; s++) {
    if (!merged[s] || label[s]) continue;
    const id = comps.length + 1, q = [s];
    label[s] = id;
    let area = 0, minx = W, maxx = 0, miny = H, maxy = 0;
    while (q.length) {
      const p = q.pop(), px = p % W, py = (p / W) | 0;
      if (eroded[p]) { area++; if (px < minx) minx = px; if (px > maxx) maxx = px; if (py < miny) miny = py; if (py > maxy) maxy = py; }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = px + dx, ny = py + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const n = ny * W + nx;
        if (merged[n] && !label[n]) { label[n] = id; q.push(n); }
      }
    }
    comps.push({ id, area, minx, maxx, miny, maxy });
  }
  // prefer big blobs close to the expected centre
  let best = null, bestScore = 0;
  for (const c of comps) {
    if (c.area < 500) continue;
    const mx = x0 + (c.minx + c.maxx) / 2, my = y0 + (c.miny + c.maxy) / 2;
    const d = Math.hypot(mx - cx, my - cy);
    const score = c.area / (1 + (d / (40 * S)) ** 2);
    if (score > bestScore) { bestScore = score; best = { c, x: mx, y: my, bx0: x0 + c.minx, bx1: x0 + c.maxx, by0: y0 + c.miny, by1: y0 + c.maxy }; }
  }
  if (best) {
    // food and plates are dense; labels and the little green dots are sparse rows
    const c = best.c, rows = new Int32Array(H);
    for (let y = c.miny; y <= c.maxy; y++) for (let x = c.minx; x <= c.maxx; x++) if (eroded[y * W + x] && label[y * W + x] === c.id) rows[y]++;
    // keep the block of rows connected to the densest row; anything beyond a gap of 3+ empty rows is a label or a dot
    let peak = c.miny;
    for (let y = c.miny; y <= c.maxy; y++) if (rows[y] > rows[peak]) peak = y;
    let a = peak, b = peak;
    for (let gap = 0, y = peak - 1; y >= c.miny; y--) { if (rows[y] > 0) { a = y; gap = 0; } else if (++gap > 3) break; }
    for (let gap = 0, y = peak + 1; y <= c.maxy; y++) { if (rows[y] > 0) { b = y; gap = 0; } else if (++gap > 3) break; }
    best.by0 = y0 + a; best.by1 = y0 + b;
  }
  return best;
}

const results = [];
for (const [n, f, cx0, cy0] of dishes) {
  const img = await load(f);
  const cx = Math.round(cx0 * S), cy = Math.round(cy0 * S);
  const hit = findDish(img, cx, cy);
  // tight box around the dish (a few px of air; less at the bottom so the printed label stays out), then centred on a white canvas
  const b = hit ?? { bx0: cx - 55, bx1: cx + 55, by0: cy - 40, by1: cy + 40 };
  const left = Math.max(0, Math.round(b.bx0 - 8)), right = Math.min(img.w, Math.round(b.bx1 + 8));
  const top = Math.max(0, Math.round(b.by0 - 6)), bottom = Math.min(img.h, Math.round(b.by1 + 1)); // nothing below the dish: the printed label sits right there
  let piece = sharp(join(root, 'assets-src', f)).extract({ left, top, width: right - left, height: bottom - top });
  let w = right - left, h = bottom - top;
  // fill about 92% of the canvas (scaling up is fine: it is shown at half this size)
  const k = Math.min((OUT_W * 0.92) / w, (OUT_H * 0.92) / h, 2.2);
  w = Math.round(w * k); h = Math.round(h * k);
  piece = piece.resize(w, h, { kernel: 'lanczos3' });
  const pieceBuf = await piece.png().toBuffer();
  const buf = await sharp({ create: { width: OUT_W, height: OUT_H, channels: 3, background: '#ffffff' } })
    .composite([{ input: pieceBuf, left: Math.round((OUT_W - w) / 2), top: Math.round((OUT_H - h) / 2) }])
    .webp({ quality: 88, effort: 6 }).toBuffer();
  writeFileSync(join(out, n + '.webp'), buf);
  results.push({ n, buf, found: !!hit });
}
writeFileSync(join(root, 'src', 'data', 'dish-thumbs.json'), JSON.stringify(results.map((r) => r.n)));
console.log('thumbs', results.length, 'refined', results.filter((r) => r.found).length);

if (process.argv.includes('--sheet')) {
  const cols = 9, cw = OUT_W + 16, ch = OUT_H + 30;
  const rows = Math.ceil(results.length / cols);
  const comps = [];
  const labels = [];
  for (let i = 0; i < results.length; i++) {
    const x = (i % cols) * cw + 8, y = Math.floor(i / cols) * ch + 8;
    comps.push({ input: await sharp(results[i].buf).png().toBuffer(), left: x, top: y });
    labels.push(`<text x="${x}" y="${y + OUT_H + 18}" font-size="16" font-family="Arial" fill="#b00">${results[i].n}${results[i].found ? '' : ' ?'}</text>`);
  }
  const W = cols * cw + 8, H = rows * ch + 8;
  comps.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${labels.join('')}</svg>`), left: 0, top: 0 });
  await sharp({ create: { width: W, height: H, channels: 3, background: '#e8e2d2' } }).composite(comps).png().toFile(join(root, 'assets-src', 'thumb-sheet.png'));
  console.log('sheet', W, H);
}
