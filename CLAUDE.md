# YuMe Sushi & Grill Deventer: concept redesign

Concept website to show the owner what a modern site could look like. **Not the official site**; the footer says so ("Concept design, not the official website."). Dutch only.

The owner did not want a long page: the home page is a one-screen **hub** where the visitor picks an area, and every area has its own page. Goal order: (1) reserve / order online, (2) make all-you-can-eat instantly clear, (3) hours + address + parking + map, (4) food looks good, menu with search.

Chosen direction: **B, "Yoru"** (black + gold from the logo, evening mood, light "paper" panels only where long lists or white-background dish photos need them).

## Source of truth

- `content.json`: restaurant facts (all-you-can-eat prices, menu card, wine list, hours, address, parking). Never invent prices, dishes, reviews or hours. Missing info is `[TODO]` and shows as a dashed `[TODO]` tag on the page. `_meta.open_questions_for_owner` lists conflicts found on the old site.
- `content-takeaway.json`: the takeaway/delivery menu, generated from the Foodtown order page (see Order page).

## Stack and commands

Astro 7 (static, multi-page) + Tailwind v4 (`@tailwindcss/vite`), fonts self-hosted via Fontsource (Cormorant Garamond for headings, Jost for text). Node is installed at `C:\Program Files\nodejs`; in a fresh shell refresh PATH first.

```
npm run dev        dev server
npm run build      static site in dist/
npm run preview    serve dist/
npm run assets     logo variants, favicon, home-screen icons, OG image (scripts/make-assets.mjs)
node scripts/process-photos.mjs          supplied photos to WebP (native size)
node scripts/crop-thumbs.mjs [--sheet]   one photo per dish, cut out of the menu-card scans (--sheet writes a numbered check sheet to assets-src/)
node scripts/import-foodtown.mjs         takeaway menu + photos from assets-src/foodtown.html
```

Deploy: any static host (Vercel/Netlify). Set `SITE_URL` (picked up automatically on Vercel/Netlify) so canonical URLs, sitemap and Open Graph are right. Set `NOINDEX=true` to add `noindex` and disallow everything in robots.txt if the concept should not show up next to the real site.

## Pages

| URL | File | What |
| --- | --- | --- |
| `/` | `src/pages/index.astro` + `src/styles/hub.css` | The hub: one screen on desktop (hero left, 7 tiles right), hero + tile rows on phones. Transparent header over the table photo. |
| `/all-you-can-eat/` | `components/Ayce.astro`, `scripts/ayce.ts` | Prices per day, kids pricing, **price calculator** (day, adults, kids by age, from the real prices), studio-photo band. |
| `/menu/` | `components/Menu.astro` | Full card: tabs, search by name/description/number, Vegetarisch/Halal filters, a photo per dish. |
| `/bestellen/` | `pages/bestellen.astro`, `components/order/*` | Takeaway/delivery concept, see below. |
| `/wijnkaart/` | `components/Wine.astro` | Accordions per section, drawn bottle per wine coloured by type. |
| `/over-ons/` | `components/About.astro` | Story, "uit onze keuken" dish band, brand banner. |
| `/parkeren/` | `components/Parking.astro` | Discounted rates with the saving, Google Maps "parkeren in de buurt", Q-Park link. |
| `/contact/` | `components/Contact.astro` | Phone, mail, live open status + hours, address, route, dark map. |
| `/privacy/` | `pages/privacy.astro` | What the site does and doesn't store (no cookies; cart in localStorage; Google map). Controller/KvK is a TODO. |
| `/404.html` | `pages/404.astro` | Links to every area. |
| `/sitemap.xml`, `/robots.txt` | `pages/*.ts` | Generated from `src/lib/areas.ts`. |
| `/site.webmanifest` | `public/` | Add to home screen (icons from make-assets). |

Every area page uses `layouts/Page.astro` (header, content, "Verder kijken" strip with 3 suggested next areas, footer, mobile call bar). The footer has the hours, today highlighted, and the live open/closed line, so those work on every page. `src/lib/areas.ts` is the one list of areas (title, blurb, description, next pages): header, hub tiles, footer, 404 and the page titles all read from it. To add an area: add it there, add a page file.

Page-to-page: cross-document View Transitions (`@view-transition` in `styles/pages.css`, a quiet fade; the header has its own transition name so it stays put). The hub entrance plays once per visit (`html.seen` via sessionStorage).

Header: solid on every area page; transparent over the photo on `/` until you scroll (`solid` prop, `data-always-solid`). Phones and tablets use the full-screen list menu (<1280px).

## Structure

```
content.json, content-takeaway.json   data
src/layouts/Base.astro                head, SEO, Open Graph, per-page canonical, Restaurant + BreadcrumbList JSON-LD (hasMenu), manifest
src/layouts/Page.astro                area page shell
src/components/                       Header, Footer, More, CtaBar, Ayce, Menu, Wine, WineBottle, About, Band, Parking, Contact, TagIcon, order/{Hero,Shop,Cart}
src/lib/                              data.ts (content.json, prices, URLs), areas.ts, order.ts (takeaway data, studio photo lookup)
src/scripts/                          main.ts (all pages), ayce.ts, order.ts
src/styles/                           global.css (tokens, buttons), pages.css (nav, calculator, dish strips, transitions, print), hub.css, order.css
public/images/                        logo, owner photos, dish/<nr>.webp (card crops), order/<id>.webp + order/t/ (Foodtown studio photos), icons, og-image
assets-src/                           logo original, photo-*.png, menu-1/2.jpg (card scans), foodtown.html (+ foodtown/ photos, gitignored)
```

## Design tokens (global.css `@theme`)

`ink #0e0e0e`, `ink-2 #171512`, `gold #cfa862` (from the logo), `gold-deep #76591f` (gold text on paper, AA), `paper #f2eee4`, `muted #b7b1a3`, `muted-paper #5a5448`. Do not add colours. Square corners, hairline gold borders, no shadows, no rounded cards. Studio dish photos have white backgrounds: only show them on `paper` with `mix-blend-mode: multiply` and do not put a `z-index` or transform on the element that holds them (it traps the blend).

## Order page (/bestellen/)

A concept of the takeaway/delivery ordering at https://foodtown.nl/boreel-cj/ (Foodtown). Nothing is ordered or paid here: the receipt says so and links to Foodtown.

- **Data**: `node scripts/import-foodtown.mjs` reads `assets-src/foodtown.html` (re-download the page to refresh) and writes `content-takeaway.json` (98 products, 11 categories, prices, tags, delivery zones, pickup hours), `public/images/order/<id>.webp` (640px) and `order/t/<id>.webp` (thumbs). Foodtown's allergen icons are incomplete, so tags are shown but never used to hide dishes. Foodtown says "Veganistisch"; some dishes contain egg or cheese, so the page says "Vegetarisch".
- **Rules copied**: Gebied 1 (7411-7419, 7421-7425 and a few more) EUR 2,50, min EUR 15; Gebied 2 EUR 5, min EUR 20; pickup no minimum. Delivery checkout stays disabled until the postcode is covered and the minimum is met.
- **Beyond Foodtown**: studio photo cards (compact rows on phones), product dialog, cart saved in localStorage (`yume-order-concept`), photo flies into the cart, animated totals, minimum progress bar, postcode check with a drawn tick/cross, search + filters, sticky category bar with scroll-tracking underline (position-based; the root has `scroll-padding-top: 5rem`, so section offsets must not add the header again), extras suggestions, till-slip receipt with copy button, bottom-sheet cart on phones.
- The main menu uses the studio photo when the dish is also on the takeaway menu (`AYCE_TO_TAKEAWAY` in `src/lib/order.ts`), otherwise the crop from the printed card.
- Foodtown lists Boreelplein 48 (C&J Horeca B.V. | Yume Boreel); the site says 52. Takeaway times on Foodtown (Di 16:30, Wo-Zo 16:00, to 21:45) differ from restaurant hours.

## Behaviour to keep

- **Reserveer** links to `tel:` until `business.reservation_url` in content.json is a real `https://` link. **Bestel online** goes to `/bestellen/` everywhere (`orderHref`); the only links to Foodtown are the concept note and the receipt (`foodtownHref`).
- Mobile (<768px): fixed bottom bar with Reserveer + Bestel online on area pages (on the hub it appears once the hero buttons scroll away; the order page has its own cart bar).
- No claim about how long all-you-can-eat lasts: the old site says two hours, a former employee says it is longer. The site says only "onbeperkt".
- Do NOT show waste fees (EUR 1 sushi / EUR 3 warm) or "verspilling wordt niet gewaardeerd": the old site says it, but a former employee says it does not apply in Deventer. Same for the rule "pas bestellen als alles op is" (volgende bestelling pas na het opeten van alles). Removed Oct 2026.
- No bestelronde explainer on the site: the owner says it is explained in the restaurant. (Known facts if ever needed: 3 gerechten per persoon per ronde, and a wait between rounds; length unknown.)
- Calculator uses EUR 2,50 per year for kids (website); the printed card says EUR 2,60 on Fri-Sun. Open question.
- "Nu open / Gesloten" is computed in the browser (Europe/Amsterdam) from `content.json` hours; the footer carries the hours JSON on every page.
- Motion only under `html.motion` (JS on, no `prefers-reduced-motion`): only transform / opacity / clip-path. Hub tiles enter once, hero photo eases in, gold rules draw in, about photos open with a clip, dish strips reveal, band sushi drifts. Reduced motion: everything static and visible.
- Map: Google embed (no API key), lazy, dark via CSS filter.
- Print: header, filters, tabs and map hide; all menu tabs print.

## Checked (Oct 2026)

Lighthouse (local preview), all 9 pages mobile + desktop: accessibility 100, best practices 100, SEO 100, performance 97-100, CLS <= 0.04. No horizontal scroll at 375 / 768 / 1440, one h1 per page, no console errors, all internal links 200. Hub on desktop is exactly one screen (900px). Calculator, tiles, "verder kijken", back button and search were tested with Playwright. Screenshots in `screenshots/`.

## Open / TODO

- All-you-can-eat time limit; kids price Fri-Sun; opening hours conflict (site vs menu card); tagline ("Sushi & Grill" vs "Sushi Grill & Tapas"); address 48 vs 52; takeaway hours vs restaurant hours.
- Reservation link or system; KvK number; privacy controller details; beer/soft drinks/other drinks; exact Q-Park garage, walking distance and how the parking discount works.
- Better photos: the supplied ones are small (table 1024px, napkin 500px, sign 250px, platter 300px) and the card crops come from print scans. Ask for a sharp hero photo (2000px+), interior, sushi and grill close-ups. Replace files in `public/images/` under the same names.
- Foodtown has no photo for Sushi Box A-D, Sushibox Spicy/Yummy, Ebi Temaki, Classic bowl ebi fry (wave tile); Carpaccio Maki and Beef Maki use a card crop.
- Real wine bottle photos for the 2025 list (the older cards show a different selection).
- Vector logo (SVG): the supplied one is ~235px wide and looks soft on retina screens.
- Real hand-off to Foodtown (no per-product deep links; it links to the shop).
