// Small progressive enhancements. The page works without any of this.
const $ = <T extends Element>(s: string, r: ParentNode = document) => Array.from(r.querySelectorAll<T>(s));
const motion = document.documentElement.classList.contains('motion');

/* Header turns solid after the hero */
const header = document.querySelector<HTMLElement>('[data-header]');
const onScroll = () => { if (header && !header.hasAttribute('data-always-solid')) header.toggleAttribute('data-solid', scrollY > 24); };
onScroll();
addEventListener('scroll', onScroll, { passive: true });

/* Mobile menu */
const toggle = document.querySelector<HTMLButtonElement>('[data-nav-toggle]');
const panel = document.getElementById('mobile-nav');
const setNav = (open: boolean) => {
  toggle?.setAttribute('aria-expanded', String(open));
  toggle?.setAttribute('aria-label', open ? 'Sluit menu' : 'Open menu');
  panel?.toggleAttribute('hidden', !open);
};
toggle?.addEventListener('click', () => setNav(toggle.getAttribute('aria-expanded') !== 'true'));
panel?.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('a')) setNav(false); });
addEventListener('keydown', (e) => { if (e.key === 'Escape') setNav(false); });

/* Menu tabs */
const tabs = $<HTMLButtonElement>('[role="tab"]');
const panels = $<HTMLElement>('[role="tabpanel"]');
const select = (tab: HTMLButtonElement, focus = false) => {
  tabs.forEach((t) => { const on = t === tab; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
  panels.forEach((p) => (p.hidden = p.id !== tab.getAttribute('aria-controls')));
  if (focus) tab.focus();
};
if (tabs.length) {
  select(tabs[0]);
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t));
    t.addEventListener('keydown', (e) => {
      const k = e.key;
      const next = k === 'ArrowRight' ? (i + 1) % tabs.length : k === 'ArrowLeft' ? (i - 1 + tabs.length) % tabs.length : k === 'Home' ? 0 : k === 'End' ? tabs.length - 1 : -1;
      if (next >= 0) { e.preventDefault(); select(tabs[next], true); }
    });
  });
}

/* Menu search and filters: look through every tab at once */
const menu = document.getElementById('menu');
const q = document.getElementById('menu-q') as HTMLInputElement | null;
if (menu && q) {
  const chips = $<HTMLButtonElement>('[data-filter]', menu);
  const clear = menu.querySelector<HTMLButtonElement>('[data-clear]')!;
  const count = menu.querySelector<HTMLElement>('[data-count]')!;
  const empty = menu.querySelector<HTMLElement>('[data-empty]')!;
  const dishes = $<HTMLElement>('.dish', menu);
  const groups = $<HTMLElement>('.dish-group', menu);
  const total = Number(count.dataset.total);
  const current = () => tabs.find((t) => t.getAttribute('aria-selected') === 'true') ?? tabs[0];

  const apply = () => {
    const term = q.value.trim().toLowerCase();
    const veg = chips.find((c) => c.dataset.filter === 'veg')!.getAttribute('aria-pressed') === 'true';
    const halal = chips.find((c) => c.dataset.filter === 'halal')!.getAttribute('aria-pressed') === 'true';
    const active = !!term || veg || halal;
    menu.toggleAttribute('data-filtering', active);
    clear.hidden = !active;
    if (!active) {
      dishes.forEach((d) => (d.hidden = false));
      groups.forEach((g) => (g.hidden = false));
      empty.hidden = true;
      count.textContent = '';
      select(current());
      return;
    }
    let shown = 0;
    dishes.forEach((d) => {
      const byText = !term || (/^[0-9]+$/.test(term) ? d.dataset.n!.startsWith(term) : d.dataset.search!.includes(term));
      const ok = byText && (!veg || d.hasAttribute('data-veg')) && (!halal || d.hasAttribute('data-halal'));
      d.hidden = !ok;
      if (ok) shown++;
    });
    groups.forEach((g) => (g.hidden = !g.querySelector('.dish:not([hidden])')));
    panels.forEach((p) => (p.hidden = !p.querySelector('.dish:not([hidden])')));
    empty.hidden = shown > 0;
    count.textContent = shown === 1 ? '1 gerecht gevonden' : `${shown} gerechten gevonden`;
  };
  q.addEventListener('input', apply);
  chips.forEach((c) => c.addEventListener('click', () => { c.setAttribute('aria-pressed', String(c.getAttribute('aria-pressed') !== 'true')); apply(); }));
  clear.addEventListener('click', () => { q.value = ''; chips.forEach((c) => c.setAttribute('aria-pressed', 'false')); apply(); q.focus(); });
  // choosing a tab ends the search
  tabs.forEach((tb) => tb.addEventListener('click', () => {
    if (!menu.hasAttribute('data-filtering')) return;
    q.value = ''; chips.forEach((c) => c.setAttribute('aria-pressed', 'false')); apply(); select(tb);
  }));
  void total;
}

/* Open now / today's hours (Europe/Amsterdam) */
type Day = { open: string | null; close: string | null; closed: boolean };
const hoursEl = document.querySelector<HTMLElement>('[data-hours]');
if (hoursEl) {
  const days: Day[] = JSON.parse(hoursEl.dataset.hours!);
  const names = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];
  const parts = new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam', weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const today = names.findIndex((n) => n.toLowerCase() === get('weekday').toLowerCase());
  const mins = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
  const now = (Number(get('hour')) % 24) * 60 + Number(get('minute'));

  let text = '';
  const d = days[today];
  if (d && !d.closed && now >= mins(d.open!) && now < mins(d.close!)) {
    text = `Nu open, tot ${d.close}`;
  } else if (d && !d.closed && now < mins(d.open!)) {
    text = `Gesloten, vandaag open vanaf ${d.open}`;
  } else {
    for (let i = 1; i <= 7; i++) {
      const n = days[(today + i) % 7];
      if (!n.closed) { text = `Gesloten, ${i === 1 ? 'morgen' : names[(today + i) % 7].toLowerCase()} open vanaf ${n.open}`; break; }
    }
  }
  $('[data-open-status]').forEach((el) => { el.textContent = text; el.toggleAttribute('data-open', text.startsWith('Nu open')); });
  $('[data-open-dot]').forEach((el) => el.toggleAttribute('data-open', text.startsWith('Nu open')));
  $('[data-day]').forEach((row) => { if (Number(row.getAttribute('data-day')) === today) row.setAttribute('data-today', ''); });
}

/* Quiet scroll moments: rules draw in, photos open once */
if (motion && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.15 });
  $('.rule, .photo, .dots, .reveal').forEach((el) => io.observe(el));
} else {
  $('.rule, .photo, .dots, .reveal').forEach((el) => el.classList.add('is-in'));
}

/* Hero waves drift a little slower than the page */
const wave = document.querySelector<HTMLElement>('[data-parallax]');
if (wave && motion) {
  let ticking = false;
  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { wave.style.translate = `0 ${Math.min(scrollY, 900) * 0.18}px`; ticking = false; });
  }, { passive: true });
}

/* The brand band: the sushi pieces drift a little as it passes */
const bandImg = document.querySelector<HTMLElement>('[data-band-img]');
if (bandImg && motion) {
  let busy = false;
  const move = () => {
    const r = bandImg.getBoundingClientRect();
    const p = (r.top + r.height / 2) / innerHeight; // 1 below the screen, 0 above
    bandImg.style.setProperty('--bx', `${Math.max(-1, Math.min(2, p - 0.5)) * -46}px`);
    busy = false;
  };
  addEventListener('scroll', () => { if (!busy) { busy = true; requestAnimationFrame(move); } }, { passive: true });
  move();
}

/* Mobile CTA bar appears once the hero buttons are out of view */
const bar = document.querySelector<HTMLElement>('[data-ctabar]');
const heroActions = document.querySelector<HTMLElement>('[data-hero-actions]');
if (bar && heroActions && 'IntersectionObserver' in window) {
  bar.dataset.hidden = 'true';
  new IntersectionObserver(([e]) => { bar.dataset.hidden = String(e.isIntersecting); }).observe(heroActions);
}
