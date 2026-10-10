// The order page. Plain TypeScript, no framework. Everything here is progressive: the menu is real HTML without it.
type Zone = { name: string; fee: number; min: number; codes: string[] };
type Product = { id: number; name: string; unit: string; price: number; desc: string; note: string; photo: string; thumb: string; tags: string[]; card: HTMLElement };
type State = { mode: 'pickup' | 'delivery'; postcode: string; lines: Record<string, number> };

const $ = <T extends Element>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
const $$ = <T extends Element>(s: string, r: ParentNode = document) => Array.from(r.querySelectorAll<T>(s));
const money = (n: number) => '€ ' + n.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const STORE = 'yume-order-concept';

const root = document.getElementById('order')!;
const zones: Zone[] = JSON.parse(root.dataset.zones!);
const pickupHours: { day: string; open: string | null; close: string | null; closed: boolean }[] = JSON.parse(root.dataset.hours!);
const minTakeaway = Number(root.dataset.minTakeaway || 0);
const foodtown = root.dataset.foodtown!;

/* ---------- products straight from the page ---------- */
const products = new Map<number, Product>();
$$<HTMLElement>('[data-product]').forEach((card) => {
  const d = card.dataset;
  products.set(Number(d.id), {
    id: Number(d.id), name: d.name!, unit: d.unit || '', price: Number(d.price), desc: d.desc || '', note: d.note || '',
    photo: d.photo || '', thumb: d.thumb || '', tags: (d.tags || '').split(',').filter(Boolean), card,
  });
});

/* ---------- state ---------- */
let state: State = { mode: 'pickup', postcode: '', lines: {} };
try {
  const s = JSON.parse(localStorage.getItem(STORE) || 'null');
  if (s && (s.mode === 'pickup' || s.mode === 'delivery')) {
    state.mode = s.mode;
    state.postcode = typeof s.postcode === 'string' ? s.postcode.slice(0, 7) : '';
    for (const [id, q] of Object.entries(s.lines || {})) if (products.has(Number(id)) && Number(q) > 0) state.lines[id] = Math.min(99, Number(q));
  }
} catch { /* private mode: fine, the cart just won't survive a reload */ }
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* ignore */ } };

const zoneFor = (pc: string): Zone | null => {
  const m = pc.replace(/\s+/g, '').match(/^(\d{4})/);
  if (!m) return null;
  const n = Number(m[1]);
  for (const z of zones) for (const c of z.codes) { const [a, b] = c.split('-').map(Number); if (n >= a && n <= (b ?? a)) return z; }
  return null;
};
const hasFullPostcode = () => /^\d{4}/.test(state.postcode.replace(/\s+/g, ''));
const qtyOf = (id: number) => state.lines[String(id)] || 0;

/* ---------- elements ---------- */
const cart = $<HTMLElement>('[data-cart]')!;
const linesEl = $<HTMLElement>('[data-lines]')!;
const emptyEl = $<HTMLElement>('[data-cart-empty]')!;
const suggestEl = $<HTMLElement>('[data-suggest]')!;
const checkoutBtn = $<HTMLButtonElement>('[data-checkout]')!;
const hintEl = $<HTMLElement>('[data-checkout-hint]')!;
const bar = $<HTMLElement>('[data-bar]')!;
const backdrop = $<HTMLElement>('[data-backdrop]')!;
const badges = $$<HTMLElement>('[data-badge], [data-bar-badge]');

/* ---------- animated numbers ---------- */
const shown = new WeakMap<Element, number>();
const tween = (el: Element, to: number, fmt: (n: number) => string) => {
  const from = shown.get(el) ?? 0;
  shown.set(el, to);
  if (reduce || from === to) { el.textContent = fmt(to); return; }
  const t0 = performance.now(), dur = 380;
  const step = (t: number) => {
    const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(from + (to - from) * e);
    if (k < 1 && shown.get(el) === to) requestAnimationFrame(step); else el.textContent = fmt(to);
  };
  requestAnimationFrame(step);
};

/* ---------- cart maths ---------- */
const summary = () => {
  let count = 0, subtotal = 0;
  for (const [id, q] of Object.entries(state.lines)) { const p = products.get(Number(id))!; count += q; subtotal += q * p.price; }
  const zone = state.mode === 'delivery' ? zoneFor(state.postcode) : null;
  const fee = zone ? zone.fee : 0;
  const min = state.mode === 'delivery' ? (zone ? zone.min : null) : minTakeaway;
  return { count, subtotal, zone, fee, min, total: subtotal + fee };
};

/* ---------- render ---------- */
let lastIds = new Set<string>();
const lineHtml = (id: string, q: number, fresh: boolean) => {
  const p = products.get(Number(id))!;
  const img = p.thumb ? `<img src="${p.thumb}" alt="" width="200" height="160" loading="lazy" decoding="async">` : `<span class="o-line-tile" aria-hidden="true">${p.unit ? p.unit.split(' ')[0] : '·'}</span>`;
  return `<li class="o-line${fresh ? ' is-new' : ''}" data-line="${id}">
    <div class="o-line-img">${img}</div>
    <div class="min-w-0"><p class="o-line-name">${p.name}${p.unit ? ` <span>${p.unit}</span>` : ''}</p><p class="o-line-each">${money(p.price)} per stuk</p></div>
    <div class="o-step is-open o-step-sm" role="group" aria-label="Aantal ${p.name}">
      <button type="button" class="o-step-btn o-minus" data-line-minus="${id}" aria-label="Minder ${p.name}"><span aria-hidden="true">−</span></button>
      <output class="o-qty">${q}</output>
      <button type="button" class="o-step-btn o-plus" data-line-plus="${id}" aria-label="Meer ${p.name}"><span aria-hidden="true">+</span></button>
    </div>
    <p class="o-line-total">${money(p.price * q)}</p>
  </li>`;
};

function render() {
  const s = summary();
  // cards
  products.forEach((p) => {
    const q = qtyOf(p.id);
    p.card.dataset.qty = String(q);
    $<HTMLElement>('[data-qtyout]', p.card)!.textContent = String(q);
  });
  // lines
  const ids = Object.keys(state.lines);
  linesEl.innerHTML = ids.map((id) => lineHtml(id, state.lines[id], !lastIds.has(id))).join('');
  lastIds = new Set(ids);
  emptyEl.hidden = ids.length > 0;
  suggestEl.hidden = !(ids.length > 0 && ids.some((id) => !['Stokjes', 'Sojasaus', 'Wasabi', 'Gember'].includes(products.get(Number(id))!.name)));
  // badges + totals
  badges.forEach((b) => { if (b.textContent !== String(s.count)) { b.textContent = String(s.count); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); } });
  tween($('.o-totals [data-subtotal]')!, s.subtotal, money);
  tween($('.o-totals [data-total]')!, s.total, money);
  tween($('[data-bar-total]')!, s.total, money);
  const feeRow = $<HTMLElement>('[data-fee-row]')!;
  feeRow.hidden = !(state.mode === 'delivery' && s.zone);
  tween($('[data-fee]')!, s.fee, money);
  $('[data-cart-mode]')!.textContent = state.mode === 'pickup' ? 'Afhalen aan het Boreelplein' : s.zone ? `Bezorgen naar ${state.postcode.toUpperCase()} · ${s.zone.name}` : 'Bezorgen: vul uw postcode in';
  bar.dataset.hidden = String(s.count === 0 || cart.hasAttribute('data-open'));

  // minimum order
  const minEl = $<HTMLElement>('[data-min]')!;
  let ok = s.count > 0, hint = 'Kies eerst een gerecht.';
  if (s.min !== null && s.min > 0) {
    minEl.hidden = false;
    const left = Math.max(0, s.min - s.subtotal);
    $('[data-min-text]')!.textContent = left > 0 ? `Nog ${money(left)} tot het minimumbedrag van ${money(s.min)}` : `Minimumbedrag van ${money(s.min)} gehaald`;
    $<HTMLElement>('[data-min-bar]')!.style.transform = `scaleX(${Math.min(1, s.subtotal / s.min)})`;
    minEl.classList.toggle('is-met', left === 0);
    if (s.count > 0 && left > 0) { ok = false; hint = `Voeg nog ${money(left)} toe om te kunnen bezorgen.`; }
  } else minEl.hidden = true;
  if (state.mode === 'delivery' && !s.zone) { ok = false; hint = hasFullPostcode() ? 'Wij bezorgen niet bij deze postcode. Kies afhalen of een ander adres.' : 'Vul uw postcode in om te bezorgen.'; }
  if (s.count === 0) ok = false;
  checkoutBtn.disabled = !ok;
  hintEl.textContent = ok ? (state.mode === 'pickup' ? 'Afrekenen gaat via Foodtown.' : 'Afrekenen gaat via Foodtown.') : hint;
  save();
}

/* ---------- adding things, with a flying photo ---------- */
const flyTarget = () => {
  const cands = [$<HTMLElement>('[data-bar-badge]'), $<HTMLElement>('[data-badge]')];
  return cands.find((c) => c && c.getClientRects().length > 0 && c.getBoundingClientRect().top < innerHeight && c.getBoundingClientRect().bottom > 0) ?? cands[0]!;
};
function fly(from: Element | null) {
  if (reduce || !from) return;
  const a = from.getBoundingClientRect();
  if (a.width === 0) return;
  const target = flyTarget();
  const b = target.getBoundingClientRect();
  const clone = document.createElement('div');
  clone.className = 'o-fly';
  const img = from.querySelector('img');
  if (img) { const i = document.createElement('img'); i.src = img.currentSrc || img.src; i.alt = ''; clone.append(i); }
  const size = Math.min(110, a.width);
  Object.assign(clone.style, { left: `${a.left + a.width / 2 - size / 2}px`, top: `${a.top + a.height / 2 - size / 2}px`, width: `${size}px`, height: `${size}px` });
  document.body.append(clone);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const anim = clone.animate([
    { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 },
    { transform: `translate(${dx * 0.45}px, ${Math.min(dy * 0.45, 0) - 90}px) scale(0.7) rotate(-14deg)`, opacity: 1, offset: 0.45 },
    { transform: `translate(${dx}px, ${dy}px) scale(0.12) rotate(10deg)`, opacity: 0.15 },
  ], { duration: 720, easing: 'cubic-bezier(.45,.05,.3,1)' });
  anim.onfinish = () => clone.remove();
}

function change(id: number, delta: number, source?: Element | null) {
  const key = String(id);
  const next = Math.max(0, Math.min(99, (state.lines[key] || 0) + delta));
  if (next === 0) delete state.lines[key]; else state.lines[key] = next;
  if (delta > 0) fly(source ?? products.get(id)!.card.querySelector('.pcard-media'));
  render();
  syncDialog();
}

/* ---------- clicks ---------- */
document.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const card = t.closest<HTMLElement>('[data-product]');
  if (t.closest('[data-plus]') && card) return change(Number(card.dataset.id), 1);
  if (t.closest('[data-minus]') && card) return change(Number(card.dataset.id), -1);
  if (t.closest('[data-open]') && card) return openProduct(Number(card.dataset.id));
  const lp = t.closest<HTMLElement>('[data-line-plus]'); if (lp) return change(Number(lp.dataset.linePlus), 1, lp.closest('.o-line')!.querySelector('.o-line-img'));
  const lm = t.closest<HTMLElement>('[data-line-minus]'); if (lm) return change(Number(lm.dataset.lineMinus), -1);
  const q = t.closest<HTMLElement>('[data-quick]'); if (q) return change(Number(q.dataset.quick), 1, q);
});

/* ---------- cart sheet (phones) ---------- */
let lastFocus: HTMLElement | null = null;
const setCart = (open: boolean) => {
  cart.toggleAttribute('data-open', open);
  document.body.classList.toggle('cart-open', open);
  backdrop.classList.toggle('is-on', open);
  if (open) { lastFocus = document.activeElement as HTMLElement; $<HTMLElement>('[data-cart-close]')!.focus({ preventScroll: true }); }
  else lastFocus?.focus({ preventScroll: true });
  render();
};
$('[data-bar-open]')!.addEventListener('click', () => setCart(true));
$('[data-cart-close]')!.addEventListener('click', () => setCart(false));
backdrop.addEventListener('click', () => setCart(false));
addEventListener('keydown', (e) => { if (e.key === 'Escape' && cart.hasAttribute('data-open')) setCart(false); });

/* ---------- product dialog ---------- */
const pd = $<HTMLDialogElement>('[data-pdialog]')!;
let pdId = 0;
const tagLabel: Record<string, string> = { fish: 'Bevat vis', shellfish: 'Bevat schaaldieren', egg: 'Bevat ei', vegetarian: 'Vegetarisch', halal: 'Halal' };
function openProduct(id: number) {
  const p = products.get(id)!; pdId = id;
  const media = $('[data-pd-media]', pd)!;
  media.innerHTML = p.photo ? `<img src="${p.photo}" alt="${p.name}" decoding="async">` : `<div class="o-dialog-tile">${p.unit ? p.unit.split(' ')[0] : ''}<small>${p.unit ? 'stuks' : 'foto volgt'}</small></div>`;
  $('[data-pd-name]', pd)!.textContent = p.name;
  $('[data-pd-unit]', pd)!.textContent = p.unit;
  $('[data-pd-desc]', pd)!.textContent = p.desc;
  $('[data-pd-note]', pd)!.textContent = p.note ? `${p.note}.` : '';
  $('[data-pd-price]', pd)!.textContent = money(p.price);
  $('[data-pd-tags]', pd)!.innerHTML = p.tags.map((t) => `<li>${$(`[data-tags*="${t}"] .tag-icon[aria-label="${tagLabel[t]}"]`)?.outerHTML ?? ''} ${tagLabel[t]}</li>`).join('');
  pd.showModal();
  syncDialog();
}
function syncDialog() {
  if (!pd.open) return;
  const q = qtyOf(pdId);
  $('[data-pd-qty]', pd)!.textContent = String(q);
  const p = products.get(pdId)!;
  $('[data-pd-done]', pd)!.textContent = q === 0 ? `Toevoegen · ${money(p.price)}` : `Klaar · ${money(p.price * q)}`;
}
$('[data-pd-plus]', pd)!.addEventListener('click', () => change(pdId, 1, $('[data-pd-media] img, [data-pd-media] div', pd)));
$('[data-pd-minus]', pd)!.addEventListener('click', () => change(pdId, -1));
$('[data-pd-done]', pd)!.addEventListener('click', () => { if (qtyOf(pdId) === 0) change(pdId, 1, $('[data-pd-media] img, [data-pd-media] div', pd)); pd.close(); });

/* ---------- receipt ---------- */
const rc = $<HTMLDialogElement>('[data-receipt]')!;
function openReceipt() {
  const s = summary();
  $('[data-rc-mode]', rc)!.textContent = state.mode === 'pickup' ? 'Afhalen aan het Boreelplein 52, Deventer' : `Bezorgen naar ${state.postcode.toUpperCase()} (${s.zone?.name})`;
  $('[data-rc-lines]', rc)!.innerHTML = Object.entries(state.lines).map(([id, q], i) => {
    const p = products.get(Number(id))!;
    return `<li style="--i:${i}"><span>${q}×</span><span>${p.name}${p.unit ? ` (${p.unit})` : ''}</span><span>${money(p.price * q)}</span></li>`;
  }).join('');
  const n = Object.keys(state.lines).length;
  $('[data-rc-totals]', rc)!.innerHTML =
    `<div style="--i:${n}"><dt>Subtotaal</dt><dd>${money(s.subtotal)}</dd></div>` +
    (s.zone ? `<div style="--i:${n + 1}"><dt>Bezorgkosten</dt><dd>${money(s.fee)}</dd></div>` : '') +
    `<div class="is-total" style="--i:${n + 2}"><dt>Totaal</dt><dd>${money(s.total)}</dd></div>`;
  ($('[data-rc-foodtown]', rc) as HTMLAnchorElement).href = foodtown;
  rc.showModal();
}
checkoutBtn.addEventListener('click', () => { if (cart.hasAttribute('data-open')) setCart(false); openReceipt(); });
$('[data-rc-copy]', rc)!.addEventListener('click', async (e) => {
  const s = summary();
  const text = ['Bestelling YuMe Deventer (concept)', ...Object.entries(state.lines).map(([id, q]) => { const p = products.get(Number(id))!; return `${q}x ${p.name}${p.unit ? ` (${p.unit})` : ''} - ${money(p.price * q)}`; }),
    state.mode === 'pickup' ? 'Afhalen' : `Bezorgen naar ${state.postcode.toUpperCase()}, bezorgkosten ${money(s.fee)}`, `Totaal: ${money(s.total)}`].join('\n');
  const btn = e.currentTarget as HTMLButtonElement;
  try { await navigator.clipboard.writeText(text); btn.textContent = 'Gekopieerd'; } catch { btn.textContent = 'Kopiëren lukt hier niet'; }
  setTimeout(() => (btn.textContent = 'Kopieer mijn bestelling'), 2200);
});
// close dialogs: x button, backdrop
$$<HTMLDialogElement>('dialog.o-dialog').forEach((d) => {
  d.addEventListener('click', (e) => { if (e.target === d || (e.target as HTMLElement).closest('[data-dialog-close]')) d.close(); });
});

/* ---------- pickup / delivery ---------- */
const seg = $<HTMLElement>('.o-seg')!;
const modeBtns = $$<HTMLButtonElement>('[data-mode]');
const panels = $$<HTMLElement>('[data-panel]');
const zip = $<HTMLInputElement>('#o-zip')!;
const zipStatus = $<HTMLElement>('[data-zip-status]')!;
const zipIcon = $<HTMLElement>('.o-zip-icon')!;
function paintMode() {
  modeBtns.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === state.mode)));
  seg.dataset.mode = state.mode;
  panels.forEach((p) => { p.hidden = p.dataset.panel !== state.mode; p.classList.toggle('is-open', p.dataset.panel === state.mode); });
  paintZip();
}
function paintZip() {
  const z = zoneFor(state.postcode);
  const full = hasFullPostcode();
  zipIcon.dataset.state = !full ? '' : z ? 'yes' : 'no';
  zipStatus.textContent = !full ? 'Vul uw postcode in om te zien of we bezorgen.'
    : z ? `Wij bezorgen bij deze postcode. ${z.name}: bezorgkosten ${money(z.fee)}, minimaal ${money(z.min)}.`
    : 'Wij bezorgen helaas niet bij deze postcode. Afhalen kan natuurlijk wel.';
}
modeBtns.forEach((b) => b.addEventListener('click', () => { state.mode = b.dataset.mode as State['mode']; paintMode(); render(); if (state.mode === 'delivery') zip.focus({ preventScroll: true }); }));
zip.value = state.postcode;
zip.addEventListener('input', () => { state.postcode = zip.value.toUpperCase().slice(0, 7); paintZip(); render(); });

/* ---------- open / closed ---------- */
(function status() {
  const names = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];
  const parts = new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam', weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const today = names.findIndex((n) => n.toLowerCase() === get('weekday').toLowerCase());
  const mins = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
  const now = (Number(get('hour')) % 24) * 60 + Number(get('minute'));
  const d = pickupHours[today];
  let text = '', open = false;
  if (d && !d.closed && now >= mins(d.open!) && now < mins(d.close!)) { text = `Bestellen kan nu, tot ${d.close}`; open = true; }
  else {
    let when = '';
    if (d && !d.closed && now < mins(d.open!)) when = `vandaag vanaf ${d.open}`;
    else for (let i = 1; i <= 7; i++) { const n = pickupHours[(today + i) % 7]; if (!n.closed) { when = `${i === 1 ? 'morgen' : names[(today + i) % 7].toLowerCase()} vanaf ${n.open}`; break; } }
    text = `Nu gesloten. In de echte bestelomgeving kunt u ${when} bestellen; hier kunt u het alvast proberen.`;
  }
  $('[data-order-status]')!.textContent = text;
  $('[data-status-dot]')!.toggleAttribute('data-open', open);
})();

/* ---------- search + filters ---------- */
const q = $<HTMLInputElement>('#o-q')!;
const chips = $$<HTMLButtonElement>('[data-filter]');
const clear = $<HTMLButtonElement>('[data-clear]')!;
const count = $<HTMLElement>('[data-count]')!;
const empty = $<HTMLElement>('[data-empty]')!;
const sections = $$<HTMLElement>('[data-cat-section]');
function applyFilter() {
  const term = q.value.trim().toLowerCase();
  const need = chips.filter((c) => c.getAttribute('aria-pressed') === 'true').map((c) => c.dataset.filter!);
  const active = !!term || need.length > 0;
  clear.hidden = !active;
  let n = 0;
  products.forEach((p) => {
    const ok = (!term || p.card.dataset.search!.includes(term)) && need.every((t) => p.tags.includes(t));
    p.card.hidden = !ok; if (ok) n++;
  });
  sections.forEach((s) => (s.hidden = !s.querySelector('.pcard:not([hidden])')));
  $$<HTMLAnchorElement>('[data-catnav] [data-cat]').forEach((l) => {
    const s = sections.find((x) => x.dataset.catSection === l.dataset.cat);
    (l.parentElement as HTMLElement).hidden = !!s?.hidden;
  });
  dispatchEvent(new Event('resize')); // re-measure the sliding underline
  empty.hidden = n > 0;
  count.textContent = active ? (n === 1 ? '1 gerecht gevonden' : `${n} gerechten gevonden`) : '';
}
q.addEventListener('input', applyFilter);
chips.forEach((c) => c.addEventListener('click', () => { c.setAttribute('aria-pressed', String(c.getAttribute('aria-pressed') !== 'true')); applyFilter(); }));
clear.addEventListener('click', () => { q.value = ''; chips.forEach((c) => c.setAttribute('aria-pressed', 'false')); applyFilter(); q.focus(); });

/* ---------- category bar: follows the scroll, with a sliding underline ---------- */
const nav = $<HTMLElement>('[data-catnav]')!;
const ink = $<HTMLElement>('.o-catink')!;
const navLinks = $$<HTMLAnchorElement>('[data-cat]', nav);
let activeCat = '';
function setActive(id: string) {
  if (id === activeCat) return;
  activeCat = id;
  const link = navLinks.find((l) => l.dataset.cat === id);
  navLinks.forEach((l) => l.toggleAttribute('aria-current', l === link));
  if (!link) return;
  ink.style.width = `${link.offsetWidth}px`;
  ink.style.transform = `translateX(${link.offsetLeft}px)`;
  const box = nav.scrollLeft, w = nav.clientWidth;
  if (link.offsetLeft < box + 20 || link.offsetLeft + link.offsetWidth > box + w - 20) nav.scrollTo({ left: link.offsetLeft - w / 2 + link.offsetWidth / 2, behavior: reduce ? 'auto' : 'smooth' });
}
{
  let busy = false;
  const spy = () => {
    busy = false;
    const line = (document.querySelector('.o-catbar')?.getBoundingClientRect().bottom ?? 120) + 24;
    let current = sections.find((s) => !s.hidden)?.dataset.catSection ?? '';
    for (const s of sections) if (!s.hidden && s.getBoundingClientRect().top <= line) current = s.dataset.catSection!;
    setActive(current);
  };
  addEventListener('scroll', () => { if (!busy) { busy = true; requestAnimationFrame(spy); } }, { passive: true });
  addEventListener('resize', () => { activeCat = ''; spy(); });
}
setActive(sections[0]?.dataset.catSection ?? '');
navLinks.forEach((l) => l.addEventListener('click', (e) => {
  e.preventDefault();
  const target = document.getElementById(`cat-${l.dataset.cat}`);
  if (target?.hidden) clear.click();
  target?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  history.replaceState(null, '', `#cat-${l.dataset.cat}`);
}));

/* ---------- product photos open with a clip as they scroll in ---------- */
if (!reduce && 'IntersectionObserver' in window) {
  document.documentElement.classList.add('o-reveal');
  const io = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px' });
  $$('.pcard, .o-cat-title').forEach((el) => io.observe(el));
}

paintMode();
render();
