// Builds the image assets in /public/images from the supplied logo.
//   node scripts/make-assets.mjs
// - logo-on-dark.png / logo-on-light.png: transparent versions of the logo (logo-original.png has a white background)
// - photos and dish cut-outs are made by scripts/crop-dishes.mjs
// - favicon.svg, apple-touch-icon.png, og-image.png
import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'images');
mkdirSync(out, { recursive: true });

const GOLD_HEX = '#CFA862';
const INK = [14, 14, 14];
const PAPER = [242, 238, 228];

// ---------- logo: split the white-background logo into black ink + gold ----------
const src = join(root, 'assets-src', 'logo-original.png');
const meta = await sharp(src).metadata();
const SCALE = 3; // upscale once with lanczos so edges stay smooth on retina screens
const { data, info } = await sharp(src)
  .resize(meta.width * SCALE, meta.height * SCALE, { kernel: 'lanczos3' })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

// find the gold: the most saturated reasonably dark pixel
let gold = [179, 155, 99];
let best = 0;
for (let i = 0; i < data.length; i += 3) {
  const r = data[i], g = data[i + 1], b = data[i + 2];
  const sat = Math.max(r, g, b) - Math.min(r, g, b);
  if (sat > best && r + g + b < 600) { best = sat; gold = [r, g, b]; }
}

// pix = white*(1-ab-ag) + black*ab + gold*ag  ->  least squares for (ab, ag)
function render(inkColor, goldColor) {
  const buf = Buffer.alloc(info.width * info.height * 4);
  const dB = [255, 255, 255].map((w, c) => w - 0);      // white - black(0)
  const dG = [255, 255, 255].map((w, c) => w - gold[c]); // white - gold
  const aa = dB[0] * dB[0] + dB[1] * dB[1] + dB[2] * dB[2];
  const bb = dG[0] * dG[0] + dG[1] * dG[1] + dG[2] * dG[2];
  const ab_ = dB[0] * dG[0] + dB[1] * dG[1] + dB[2] * dG[2];
  const det = aa * bb - ab_ * ab_;
  for (let p = 0, q = 0; p < data.length; p += 3, q += 4) {
    const d = [255 - data[p], 255 - data[p + 1], 255 - data[p + 2]];
    const x = d[0] * dB[0] + d[1] * dB[1] + d[2] * dB[2];
    const y = d[0] * dG[0] + d[1] * dG[1] + d[2] * dG[2];
    let ab = (x * bb - y * ab_) / det;
    let ag = (y * aa - x * ab_) / det;
    ab = Math.max(0, ab); ag = Math.max(0, ag);
    const a = Math.min(1, ab + ag);
    if (a < 0.02) { buf[q + 3] = 0; continue; }
    const wb = ab / (ab + ag), wg = ag / (ab + ag);
    for (let c = 0; c < 3; c++) buf[q + c] = Math.round(inkColor[c] * wb + goldColor[c] * wg);
    buf[q + 3] = Math.round(a * 255);
  }
  return sharp(buf, { raw: { width: info.width, height: info.height, channels: 4 } });
}

await render(PAPER, gold).trim().png({ compressionLevel: 9 }).toFile(join(out, 'logo-on-dark.png'));
await render([20, 20, 20], gold).trim().png({ compressionLevel: 9 }).toFile(join(out, 'logo-on-light.png'));
// WebP copies are what the site serves (PNG stays as the master and for the Open Graph image)
for (const n of ['logo-on-dark', 'logo-on-light']) {
  await sharp(join(out, `${n}.png`)).webp({ quality: 88, alphaQuality: 95, effort: 6 }).toFile(join(out, `${n}.webp`));
}
const logoDark = await sharp(join(out, 'logo-on-dark.png')).metadata();
console.log('logo', logoDark.width, 'x', logoDark.height, 'gold', gold);

// ---------- seigaiha tile (same motif as the printed menu card) ----------
function seigaihaTile(stroke, fill, strokeOpacity = 1) {
  const ring = (r, f) => `<circle r="${r}" fill="${f}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="1"/>`;
  const scale = `<g id="s">${ring(20, fill)}${ring(15, 'none')}${ring(10, 'none')}${ring(5, 'none')}</g>`;
  const row = (y, xs) => xs.map((x) => `<use href="#s" x="${x}" y="${y}"/>`).join('');
  return { defs: scale, body: row(0, [0, 40, 80]) + row(20, [20, 60]) + row(40, [0, 40, 80]) };
}

// ---------- favicon: three seigaiha arcs, no text ----------
writeFileSync(
  join(out, 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#0E0E0E"/><g fill="none" stroke="${GOLD_HEX}" stroke-width="3.5"><circle cx="32" cy="50" r="30"/><circle cx="32" cy="50" r="20"/><circle cx="32" cy="50" r="10"/></g><rect y="50" width="64" height="14" fill="#0E0E0E"/></svg>`
);
await sharp(Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 64 64"><rect width="64" height="64" fill="#0E0E0E"/><g fill="none" stroke="${GOLD_HEX}" stroke-width="3.5"><circle cx="32" cy="50" r="30"/><circle cx="32" cy="50" r="20"/><circle cx="32" cy="50" r="10"/></g><rect y="50" width="64" height="14" fill="#0E0E0E"/></svg>`
)).png().toFile(join(out, 'apple-touch-icon.png'));

// ---------- home-screen icons (maskable: artwork stays inside the safe zone) ----------
const iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#0E0E0E"/><g fill="none" stroke="' + GOLD_HEX + '" stroke-width="3" transform="translate(32 33) scale(.78) translate(-32 -50)"><circle cx="32" cy="50" r="30"/><circle cx="32" cy="50" r="20"/><circle cx="32" cy="50" r="10"/></g></svg>';
for (const s of [192, 512]) await sharp(Buffer.from(iconSvg), { density: 300 }).resize(s, s).png().toFile(join(out, 'icon-' + s + '.png'));

// ---------- Open Graph image 1200x630 ----------
const t = seigaihaTile(GOLD_HEX, '#0E0E0E', 0.3);
const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
<defs>${t.defs}<pattern id="p" width="80" height="40" patternUnits="userSpaceOnUse" patternTransform="scale(1.3)">${t.body}</pattern></defs>
<rect width="100%" height="100%" fill="#0E0E0E"/><rect width="100%" height="100%" fill="url(#p)"/>
<rect width="100%" height="100%" fill="#0E0E0E" opacity=".55"/>
<text x="600" y="520" text-anchor="middle" font-family="Georgia, serif" font-size="40" fill="#F2EEE4">All you can eat sushi &amp; grill</text>
<text x="600" y="568" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" fill="#B39B63">Boreelplein 52, Deventer</text>
</svg>`);
const logoBuf = await sharp(join(out, 'logo-on-dark.png')).resize({ width: 640 }).toBuffer();
const logoH = (await sharp(logoBuf).metadata()).height;
await sharp(bg)
  .composite([{ input: logoBuf, left: 280, top: Math.round(250 - logoH / 2) }])
  .png({ compressionLevel: 9 })
  .toFile(join(out, 'og-image.png'));
console.log('assets done');
