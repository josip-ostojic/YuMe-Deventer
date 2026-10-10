// Imports the takeaway menu from the saved Foodtown order page (assets-src/foodtown.html).
//   node scripts/import-foodtown.mjs
// Writes:  content-takeaway.json            the takeaway menu, delivery zones and pickup hours
//          public/images/order/<key>.webp    640px product photo (white background, shown with multiply)
//          public/images/order/t/<key>.webp  200x160 thumbnail (cart, category bar, main menu)
// Product photos are downloaded from the order page into assets-src/foodtown/ the first time (gitignored).
import sharp from 'sharp';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'assets-src', 'foodtown.html'), 'utf8');
const rawDir = join(root, 'assets-src', 'foodtown');
const outDir = join(root, 'public', 'images', 'order');
mkdirSync(join(outDir, 't'), { recursive: true });
mkdirSync(rawDir, { recursive: true });

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&euro;/g, '€').replace(/&nbsp;/g, ' ').replace(/&#8211;/g, '–').replace(/&#038;/g, '&').replace(/&quot;/g, '"');
const slug = (s) => s.toLowerCase().replace(/&/g, 'en').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const sentence = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const titleIfShouting = (s) => (s === s.toUpperCase() && /[A-Z]{4}/.test(s) ? s.toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase()) : s);

// ---- categories in page order
const cats = [...html.matchAll(/<div data-catslug='(\w+)' class='categorie[^']*' \/><div class="no-image"><h4 id='product_category_\w+'>([^<]+)<\/h4>/g)]
  .map((m) => ({ slug: m[1], name: decode(m[2]), idx: m.index }));

// ---- products
const parts = html.split("<div class='ft-product-row'>");
let acc = parts[0].length;
const raw = [];
for (let i = 1; i < parts.length; i++) {
  const start = acc; acc += "<div class='ft-product-row'>".length + parts[i].length;
  const row = parts[i];
  const get = (re) => (row.match(re) || [])[1];
  const cat = [...cats].reverse().find((c) => c.idx < start);
  raw.push({
    cat: cat.name,
    name: decode((get(/<div class='ft-product-name'>\s*([\s\S]*?)\s*<\/div>/) || '').trim()),
    desc: decode((get(/<div class='ft-product-desc'>([\s\S]*?)<\/div>/) || '').replace(/<[^>]+>/g, '').trim()),
    tags: [...row.matchAll(/title="([^"]+)" class="allergen-icon/g)].map((m) => m[1]),
    price: Number(get(/data-price='([\d.]+)'/)),
    id: Number(get(/data-product_id='(\d+)' data-product_sku/) || get(/data-product_id='(\d+)'/)),
    sku: get(/data-product_sku='(\w+)'/),
    full: get(/<div class='ft-photofull'[^>]*><img src='([^']+)'/) || get(/<div class='ft-photowrapper'[^>]*><img src='([^']+)'/),
    hasExtras: /extras-popup/.test(row) && !/no-extras-popup/.test(row),
  });
}

const CAT = {
  Nigiri: { id: 'nigiri', name: 'Nigiri' },
  Maki: { id: 'maki', name: 'Maki' },
  Temaki: { id: 'temaki', name: 'Temaki' },
  'Grilled&Fried': { id: 'grilled-fried', name: 'Grilled & fried' },
  Diner: { id: 'diner', name: 'Diner' },
  'Soup&Salads': { id: 'soep-salade', name: 'Soep & salade' },
  PokeBowl: { id: 'poke-bowl', name: 'Poke bowl' },
  Sushibox: { id: 'sushibox', name: 'Sushibox' },
  Supplementen: { id: 'supplementen', name: "Extra's" },
  'On The Side': { id: 'on-the-side', name: 'On the side' },
  Dessert: { id: 'dessert', name: 'Dessert' },
};
const TAG = { Vis: 'fish', Schaaldieren: 'shellfish', Ei: 'egg', Veganistisch: 'vegetarian', Halal: 'halal' };

// ---- photos: download once, convert
const fetchPhoto = async (url) => {
  const file = join(rawDir, url.split('/').pop());
  if (!existsSync(file)) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(url + ' ' + r.status);
    writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  }
  return file;
};
const keyBySource = new Map();
const categories = [];
for (const r of raw) {
  let name = titleIfShouting(r.name);
  let unit = '';
  const u1 = name.match(/\s*\((\d+)\s*st\)\s*$/i); // "Sake Maki (3st)"
  const u2 = name.match(/\s+(\d+)\s*ST$/);         // "Gebakken Banaan 4ST"
  const u3 = name.match(/[-\s]+(\d+) stuks$/i);    // "Sushi Box A- 6 stuks"
  if (u1) { unit = `${u1[1]} stuks`; name = name.replace(u1[0], ''); }
  else if (u2) { unit = `${u2[1]} stuks`; name = name.replace(u2[0], ''); }
  else if (u3) { unit = `${u3[1]} stuks`; name = name.replace(u3[0], ''); }
  name = name.replace(/\s+Gr$/, ' groot').trim();

  let desc = r.desc.replace(/\s*\(vegetarisch\)/i, '').trim();
  let note = '';
  const star = desc.indexOf('*');
  if (star >= 0) { note = desc.slice(star + 1).trim(); desc = desc.slice(0, star).trim(); }
  desc = desc.replace(/^\(([^)]+)\)\s*/, '$1 · ').replace(/ · \d+ stuks$/, '').trim();
  desc = sentence(desc.replace('spicy sake make', 'spicy sake maki').replace('chucka wakame', 'chuka wakame')); // two typos on the platform

  let photo = null;
  if (r.full && !/geen-afbeelding/.test(r.full)) {
    if (!keyBySource.has(r.full)) {
      const key = String(r.id);
      const file = await fetchPhoto(r.full);
      const base = sharp(file).flatten({ background: '#ffffff' });
      await base.clone().resize({ width: 640, withoutEnlargement: true }).webp({ quality: 80, effort: 6 }).toFile(join(outDir, `${key}.webp`));
      await base.clone().resize(200, 160, { fit: 'contain', background: '#ffffff' }).webp({ quality: 82, effort: 6 }).toFile(join(outDir, 't', `${key}.webp`));
      keyBySource.set(r.full, key);
    }
    photo = keyBySource.get(r.full);
  }

  let cat = categories.find((c) => c.platform === r.cat);
  if (!cat) {
    const meta = CAT[r.cat] ?? { id: slug(r.cat), name: r.cat };
    cat = { id: meta.id, name: meta.name, platform: r.cat, items: [] };
    categories.push(cat);
  }
  cat.items.push({
    id: r.id, sku: r.sku, name, unit, desc, note,
    price_eur: r.price,
    tags: r.tags.map((t) => TAG[t]).filter(Boolean),
    photo,
    has_options_on_platform: r.hasExtras,
  });
}
categories.forEach((c) => delete c.platform);

// ---- opening ("afhaaltijden") and delivery zones, from the same page
const hoursBlock = html.match(/<dl class="dl-open">([\s\S]*?)<\/dl>/)[1];
const days = [...hoursBlock.matchAll(/<dt[^>]*>([^:<]+):<\/dt><dd[^>]*>([^<]+)<\/dd>/g)].map((m) => {
  const t = m[2].trim();
  const closed = /gesloten/i.test(t);
  const [open, close] = closed ? [null, null] : t.split('-').map((x) => x.trim());
  return { day: m[1].trim(), open, close, closed };
});
const ft = JSON.parse(html.match(/var foodtown = (\{.*\});/)[1]);
const zones = ft.deliveryZones.map((z, i) => ({
  name: `Gebied ${i + 1}`,
  fee_eur: Number(z.amount),
  minimum_eur: Number(z.minimum),
  postcodes: z.postcodes.map((p) => p.replace('...', '-')),
}));

const data = {
  _meta: {
    source: 'https://foodtown.nl/boreel-cj/ (the current online ordering page), saved in assets-src/foodtown.html on 2026-10-09',
    note: 'Takeaway/delivery menu. Prices differ from nothing on the all-you-can-eat card: this is a separate à-la-carte menu. Allergen tags are exactly the icons Foodtown shows; they are incomplete (e.g. Ebi Nigiri has none), so they are never used to hide dishes. Foodtown labels vegetarian dishes "Veganistisch"; some contain egg or cheese, so the site says "Vegetarisch".',
    platform_name: 'C&J Horeca B.V. | Yume Boreel',
    platform_address: 'Boreelplein 48, 7411 EH Deventer (the main site says Boreelplein 52: to confirm)',
    checkout_url: ft.checkout_url,
    checkout_needs: 'e-mailadres en telefoonnummer',
    today_on_platform: ft.today,
  },
  pickup_hours: days,
  minimum_takeaway_eur: Number(ft.minimum_takeaway_amount),
  delivery_zones: zones,
  categories,
};
writeFileSync(join(root, 'content-takeaway.json'), JSON.stringify(data, null, 1));
const n = categories.reduce((a, c) => a + c.items.length, 0);
console.log(categories.map((c) => `${c.name}:${c.items.length}`).join('  '));
console.log('items', n, 'photos', keyBySource.size, 'zones', zones.length, 'days', days.length);
