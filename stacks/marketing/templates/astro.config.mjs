// @ts-check
/** Astro configuration — static output, deployed to Cloudflare Workers. */
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// `output: 'static'` is the default and the point of this stack: a marketing
// site should be HTML on a CDN edge, not a running server. Only switch to
// 'server' (and add the @astrojs/cloudflare adapter) when a page genuinely
// cannot be built ahead of time — see SETUP.md Phase 6.

// `site` feeds canonical URLs and the sitemap, so it has to match the host this
// build is actually served from. SITE_URL lets a staging build override it;
// without it the production domain is baked in and staging would advertise
// canonicals pointing at production.
const site = process.env.SITE_URL ?? 'https://{{TOOLU_SITE_DOMAIN}}';

export default defineConfig({
  site,
  output: 'static',
  integrations: [sitemap()],
  // Tailwind rides Astro's own Vite pipeline. The @astrojs/tailwind integration
  // is the v3 path and is deprecated — v4 ships as a Vite plugin, and this stack
  // shares its stylesheet with the console, which wires the identical plugin.
  vite: {
    plugins: [tailwindcss()],
  },
  build: {
    format: 'directory',
  },
  // Trailing-slash behaviour has to match the host or links 301 on every click.
  // Workers static assets serve /about/ from about/index.html, which is what
  // `format: 'directory'` produces.
  trailingSlash: 'ignore',
});
