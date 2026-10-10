import type { APIRoute } from 'astro';
import { areas } from '../lib/areas';

export const GET: APIRoute = ({ site, url }) => {
  const base = site ?? url;
  const paths = ['/', ...areas.map((a) => a.href), '/privacy/'];
  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    paths.map((p) => `  <url><loc>${new URL(p, base).href}</loc></url>`).join('\n') +
    '\n</urlset>\n';
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
