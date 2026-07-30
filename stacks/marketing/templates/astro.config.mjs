// @ts-check
/** Astro configuration — static output, deployed to Cloudflare Workers. */
import { defineConfig } from 'astro/config';

// `output: 'static'` is the default and the point of this stack: a marketing
// site should be HTML on a CDN edge, not a running server. Only switch to
// 'server' (and add the @astrojs/cloudflare adapter) when a page genuinely
// cannot be built ahead of time — see SETUP.md Phase 6.
export default defineConfig({
  site: 'https://{{SITE_DOMAIN}}',
  output: 'static',
  build: {
    format: 'directory',
  },
  // Trailing-slash behaviour has to match the host or links 301 on every click.
  // Workers static assets serve /about/ from about/index.html, which is what
  // `format: 'directory'` produces.
  trailingSlash: 'ignore',
});
