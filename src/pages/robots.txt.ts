import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site, url }) => {
  const base = site ?? url;
  const noindex = process.env.NOINDEX === 'true';
  const body = noindex
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nAllow: /\n\nSitemap: ${new URL('/sitemap.xml', base).href}\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
