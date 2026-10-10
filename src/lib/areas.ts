import { c, eur } from './data';

/** The areas of the site. One page each. Used by the home page tiles, the header, the footer and the "verder kijken" strip. */
const ayceFrom = Math.min(...c.all_you_can_eat.dinner.map((d) => d.adult_price_eur));
const wineCount = c.wine_list.sections.reduce((n, s) => n + s.subsections.reduce((m, sub) => m + sub.items.length, 0), 0);
const parkingFrom = Math.min(...c.parking.rates.map((r) => r.with_yume_eur));

export type Area = { id: string; href: string; title: string; blurb: string; description: string };

export const areas: Area[] = [
  {
    id: 'all-you-can-eat', href: '/all-you-can-eat/', title: 'All you can eat', blurb: `Diner vanaf ${eur(ayceFrom)}`,
    description: 'Prijzen per dag, kinderprijzen, hoe een bestelronde werkt en wat er allemaal op de kaart staat. Met een rekenhulp voor uw gezelschap.',
  },
  {
    id: 'menu', href: '/menu/', title: 'Menu', blurb: 'Meer dan 100 gerechten, met foto',
    description: 'De hele menukaart van YuMe in Deventer: sushi, grill, wok, soep, salade en dessert. Zoek op naam of nummer en filter op vegetarisch of halal.',
  },
  {
    id: 'bestellen', href: '/bestellen/', title: 'Bestel online', blurb: 'Afhalen of bezorgen',
    description: 'Bestel sushi, grill en meer bij YuMe in Deventer: afhalen of laten bezorgen. Kies uit de afhaalkaart met foto\'s.',
  },
  {
    id: 'wijnkaart', href: '/wijnkaart/', title: 'Wijnkaart', blurb: `${wineCount} wijnen`,
    description: 'De wijnkaart van YuMe in Deventer: huiswijnen, exclusieve wijnen, mousserend, dessertwijn en kaartwijnen, per glas of per fles.',
  },
  {
    id: 'over-ons', href: '/over-ons/', title: 'Over ons', blurb: 'YuMe betekent droom',
    description: 'Over YuMe Sushi & Grill in Deventer: een licht, fris en trendy restaurant met Oosterse invloeden en een verfijnde, traditionele Japanse keuken.',
  },
  {
    id: 'parkeren', href: '/parkeren/', title: 'Parkeren', blurb: `Met korting vanaf ${eur(parkingFrom)}`,
    description: 'Parkeren bij YuMe in Deventer: gasten van het restaurant betalen minder voor parkeren. Bekijk de tarieven.',
  },
  {
    id: 'contact', href: '/contact/', title: 'Contact', blurb: 'Adres, tijden en route',
    description: 'Contact met YuMe Sushi & Grill in Deventer: telefoonnummer, e-mail, openingstijden, adres aan het Boreelplein 52 en route.',
  },
];

export const area = (id: string) => areas.find((a) => a.id === id)!;

/** Where to go next from each page. */
export const next: Record<string, string[]> = {
  'all-you-can-eat': ['menu', 'wijnkaart', 'contact'],
  menu: ['all-you-can-eat', 'bestellen', 'wijnkaart'],
  bestellen: ['menu', 'parkeren', 'contact'],
  wijnkaart: ['menu', 'all-you-can-eat', 'contact'],
  'over-ons': ['all-you-can-eat', 'menu', 'contact'],
  parkeren: ['contact', 'all-you-can-eat', 'menu'],
  contact: ['all-you-can-eat', 'menu', 'bestellen'],
};
