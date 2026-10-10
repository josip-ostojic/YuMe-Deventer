import content from '../../content.json';

export const c = content;
export const biz = content.business;

export const eur = (n: number) =>
  '€ ' + n.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const num = (n: number) => n.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "Reserveer" goes to a booking page once content.json has a reservation_url, otherwise it calls. */
export const reserveHref = biz.reservation_url.startsWith('http') ? biz.reservation_url : `tel:${biz.phone_tel}`;
/** Our own order page. The real ordering system (Foodtown) is the link behind it. */
export const orderHref = '/bestellen/';
export const foodtownHref = biz.order_online_url;
const addr = `${biz.address.street}, ${biz.address.postalCode} ${biz.address.city}`;
export const routeHref = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(addr);
export const mapEmbed = 'https://www.google.com/maps?output=embed&q=' + encodeURIComponent(addr);

export const hours = content.opening_hours.days;
