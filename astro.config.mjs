import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// Set SITE_URL when deploying (Vercel/Netlify env vars are picked up automatically).
const site =
  process.env.SITE_URL ||
  process.env.URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '') ||
  'http://localhost:4321';

export default defineConfig({
  site,
  // The whole stylesheet is small: inline it so nothing blocks the first paint.
  build: { inlineStylesheets: 'always' },
  vite: { plugins: [tailwindcss()] },
});
