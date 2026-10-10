// The supplied photos in assets-src/photo-*.png to WebP in public/images (kept at native size, nothing is upscaled).
//   node scripts/process-photos.mjs
// Dish photos for the menu come from scripts/crop-thumbs.mjs.
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'images');
const photos = [
  ['photo-table.png', 'table.webp', 84],
  ['photo-napkin.png', 'napkin.webp', 86],
  ['photo-sign.png', 'sign.webp', 90],
  ['photo-sushi-platter.png', 'sushi-platter.webp', 90],
  ['photo-brand-band.png', 'brand-band.webp', 92],
];
for (const [src, dst, q] of photos) {
  const info = await sharp(join(root, 'assets-src', src)).webp({ quality: q, effort: 6 }).toFile(join(out, dst));
  console.log(dst, info.width + 'x' + info.height, Math.round(info.size / 1024) + ' KB');
}
