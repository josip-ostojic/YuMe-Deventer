import takeaway from '../../content-takeaway.json';
import { c } from './data';

export { takeaway };

export type Item = {
  id: number; sku: string; name: string; unit: string; desc: string; note: string;
  price_eur: number; tags: string[]; photo: string | null; has_options_on_platform: boolean; cat: string;
};

export const categories = takeaway.categories as { id: string; name: string; items: Omit<Item, 'cat'>[] }[];
export const items: Item[] = categories.flatMap((cat) => cat.items.map((i) => ({ ...i, cat: cat.id })));

export const TAG_LABEL: Record<string, string> = {
  fish: 'Vis', shellfish: 'Schaaldieren', egg: 'Ei', vegetarian: 'Vegetarisch', halal: 'Halal',
};

export const photoUrl = (key: string) => `/images/order/${key}.webp`;
export const thumbUrl = (key: string) => `/images/order/t/${key}.webp`;

/**
 * The all-you-can-eat card and the takeaway menu share many dishes. This maps a card number to the
 * takeaway product that has the sharp studio photo (Foodtown names on the right).
 */
const AYCE_TO_TAKEAWAY: Record<number, string> = {
  1: 'Sake Nigiri', 4: 'Ebi Nigiri', 5: 'Kani Nigiri', 6: 'Tamago Nigiri', 7: 'Inari Nigiri', 8: 'Unagi Nigiri',
  10: 'Gegrilde Sake Nigiri', 11: 'Sake Cheese Nigiri',
  20: 'Sake Maki', 21: 'Tekka Maki', 22: 'Kappa Maki', 23: 'Kani Maki', 24: 'Avocado Maki', 25: 'California Maki',
  26: 'Wasabi Sake Maki', 27: 'Crispy Roll', 28: 'Banaan Maki', 29: 'Cheese Roll', 30: 'Crispy Ebi Maki',
  31: 'Ebi Maki', 32: 'Ebi Avocado Maki', 33: 'Unagi Maki', 34: 'Tori Maki', 35: 'Spicy Tori Maki',
  36: 'Spicy Sake Maki', 37: 'Spicy Tuna Maki', 38: 'Creamcheese Sake Maki', 39: 'Mango Sake Maki',
  50: 'Sake Temaki', 51: 'Maguro Temaki', 52: 'California Temaki', 53: 'Spicy Sake Temaki', 55: 'Tori Temaki', 57: 'Wakame Temaki',
  60: 'Ebi Fry', 61: 'Dragon Cake', 62: 'Sesamballetjes', 63: 'Chicken Wings', 64: 'Ika Fried', 65: 'Mini Loempia',
  69: 'Yaki Tori', 70: 'Kohitsuji Kushi', 71: 'Tori Teriyaki', 72: 'Tori Curry', 73: 'Tori Karaage',
  76: 'Suzuki Yaki', 77: 'Gyoza', 85: 'Beef Teriyaki', 86: 'Black Pepper Beef', 87: 'Gyuniki Shoga Yaki',
  88: 'Usu Yaki', 89: 'Spicy Tori Teriyaki', 90: 'Kerry Garnalen', 92: 'Sake Teriyaki', 94: 'Yaki Udon',
  95: 'Yaki Meshi', 96: 'Krieltjes', 97: 'Edamame', 99: 'Yaki Mushrooms', 100: 'Yasai Mori',
  101: 'Chicken Curry Rice', 102: 'Beef Curry Rice',
  115: 'Wakame Sarada', 116: 'Kani Sarada', 117: 'Sashimi Sarada', 118: 'Tori Sarada', 119: 'Unagi Sarada',
  120: 'Zoet-zuur Komkommer', 130: 'Sake Sashimi',
};
const byName = new Map(items.map((i) => [i.name, i]));
/** Thumbnail URL (200x160 studio photo) for a card number, or null. */
export const aycePhoto = (n: number): string | null => {
  const hit = byName.get(AYCE_TO_TAKEAWAY[n] ?? '');
  return hit?.photo ? thumbUrl(hit.photo) : null;
};

export { c };
