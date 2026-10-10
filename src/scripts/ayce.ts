// Price calculator for the all-you-can-eat page. Prices come from data-* attributes (content.json), nothing is hard-coded here.
const root = document.querySelector<HTMLElement>('[data-calc]');
if (root) {
  const price = { weekday: Number(root.dataset.weekday), weekend: Number(root.dataset.weekend) };
  const perYear = Number(root.dataset.kid);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const money = (n: number) => '€ ' + n.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // default day: today in Amsterdam (Fri/Sat/Sun = weekend)
  const wd = new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam', weekday: 'long' }).format(new Date()).toLowerCase();
  let day: 'weekday' | 'weekend' = ['vrijdag', 'zaterdag', 'zondag'].includes(wd) ? 'weekend' : 'weekday';
  let adults = 0;
  let kids: number[] = [];

  const pill = root.querySelector<HTMLElement>('.calc-pill')!;
  const dayBtns = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-day]'));
  const adultsOut = root.querySelector<HTMLElement>('[data-adults-out]')!;
  const kidsEl = root.querySelector<HTMLElement>('[data-kids]')!;
  const totalEl = root.querySelector<HTMLElement>('[data-total]')!;
  const linesEl = root.querySelector<HTMLElement>('[data-lines]')!;

  let shown = 0;
  const tween = (to: number) => {
    const from = shown; shown = to;
    if (reduce || from === to) { totalEl.textContent = money(to); return; }
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 420), e = 1 - Math.pow(1 - k, 3);
      totalEl.textContent = money(from + (to - from) * e);
      if (k < 1 && shown === to) requestAnimationFrame(step); else totalEl.textContent = money(to);
    };
    requestAnimationFrame(step);
  };

  const render = () => {
    dayBtns.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.day === day)));
    root.dataset.mode = day;
    adultsOut.textContent = String(adults);
    const p = price[day];
    const lines: string[] = [];
    if (adults > 0) lines.push(`<li><span>${adults} × volwassene</span><span>${money(adults * p)}</span></li>`);
    kids.forEach((age) => lines.push(`<li><span>Kind van ${age} jaar</span><span>${money(age * perYear)}</span></li>`));
    linesEl.innerHTML = lines.join('') || '<li><span>Nog niemand toegevoegd</span><span></span></li>';
    tween(adults * p + kids.reduce((s, a) => s + a * perYear, 0));
  };

  const renderKids = (focusLast = false) => {
    kidsEl.innerHTML = kids.map((age, i) => `
      <li>
        <label for="kid-${i}">Kind ${i + 1}</label>
        <select id="kid-${i}" data-kid-age="${i}">${Array.from({ length: 9 }, (_, k) => k + 3).map((a) => `<option value="${a}"${a === age ? ' selected' : ''}>${a} jaar</option>`).join('')}</select>
        <button type="button" data-kid-remove="${i}" aria-label="Verwijder kind ${i + 1}"><span aria-hidden="true">×</span></button>
      </li>`).join('');
    if (focusLast) kidsEl.querySelector<HTMLSelectElement>(`#kid-${kids.length - 1}`)?.focus();
  };

  root.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const d = t.closest<HTMLElement>('[data-day]'); if (d) { day = d.dataset.day as typeof day; render(); return; }
    const ad = t.closest<HTMLElement>('[data-adults]'); if (ad) { adults = Math.max(0, Math.min(30, adults + Number(ad.dataset.adults))); render(); return; }
    if (t.closest('[data-kid-add]')) { if (kids.length < 20) { kids.push(8); renderKids(true); render(); } return; }
    const rm = t.closest<HTMLElement>('[data-kid-remove]'); if (rm) { kids.splice(Number(rm.dataset.kidRemove), 1); renderKids(); render(); }
  });
  root.addEventListener('change', (e) => {
    const s = (e.target as HTMLElement).closest<HTMLSelectElement>('[data-kid-age]');
    if (s) { kids[Number(s.dataset.kidAge)] = Number(s.value); render(); }
  });
  shown = 0;
  render();
}
