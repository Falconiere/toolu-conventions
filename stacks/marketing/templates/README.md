# {{APP_NAME}}

{{ONE_PARAGRAPH_DESCRIPTION}} — the public marketing site, built with Astro and
deployed as static assets on Cloudflare Workers.

> **New here (human or agent)?** Read [`CLAUDE.md`](./CLAUDE.md) first — it's the
> repo map + conventions. This README is the orientation + run/build guide.

## Quick start

```bash
bun install          # install deps
bun run dev          # start the dev server (http://localhost:4321)
bun run build        # production build → dist/
bun run preview      # serve the build with Astro
bunx wrangler dev    # serve the build through the real Workers runtime
bun run deploy       # build + wrangler deploy
```

## Project layout

| Path | What |
| --- | --- |
| `src/pages/` | Routes — one file per URL. Thin: pick a layout, list sections. |
| `src/layouts/` | Page shells (`<html>`, `<head>`, meta, canonical URL). |
| `src/sections/` | Composed page sections — hero, pricing, faq. One per file. |
| `src/ui/` | Design-system primitives, `globals.css`, and `theme/` tokens. |
| `src/content/` | Content collections (markdown), typed by `src/content.config.ts`. |
| `src/utilities/` | Shared pure helpers. |
| `src/constants/` | `env.ts` (Zod-validated env) + enums. |
| `src/types/` | Cross-cutting types. |
| `public/` | Served verbatim at the site root (favicon, `robots.txt`, OG image). |
| `docs/` | `design-language.md` — the house UI rules. Read before any UI work. |
| `astro.config.mjs` | Astro config — static output, `site` URL, sitemap. |
| `wrangler.jsonc` | Cloudflare Workers deploy config. |
| `.github/workflows/` | `ci.yml` (the gate) + `code-review.yml` (AI review). |

Every `src/*` folder except `pages` has a `README.md` describing its contents.

## Environments

| Env | When |
| --- | --- |
| development | local (`bun run dev`) |
{{STAGING_ROW}}
| production | deployed Worker |

Config is read from `PUBLIC_*` env vars and validated in `src/constants/env.ts`.
**This is a static site** — every value is baked into the HTML that ships, so
nothing in `.env` may be a secret. Copy `.env.example` → `.env` and fill it in.

## Routing

`src/pages/` is the URL map: `index.astro` → `/`, `pricing.astro` → `/pricing`,
`blog/[slug].astro` → `/blog/:slug`. `404.astro` is required — Workers serves it
with a real 404 status so dead URLs are dropped rather than indexed.

## Scripts

| Script | Does |
| --- | --- |
| `bun run check` | Full gate: `astro check` + lint + format-check + structure + unused + dupes + test. |
| `bun run type-check` | `astro check` — types in `.astro` frontmatter and `.ts`. |
| `bun run sync` | `astro sync` — regenerates content-collection types. |
| `bun run lint` / `lint:fix` | oxlint — `.ts`/`.tsx` and `.astro` frontmatter. |
| `bun run fmt` / `fmt:check` | oxfmt — `.ts`/`.tsx`; it cannot parse `.astro`. |
| `bun run check:structure` | Folder tree, the required 404 page, banned deps. |
| `bun run check:unused` | knip — unused files, exports, dependencies. |
| `bun run check:dupes` | jscpd — copy-paste detection. |
| `bun run test` / `test:watch` | Vitest. |
| `bun run build` / `preview` | Production build / local preview. |
| `bun run deploy` | Build, then `wrangler deploy`. |

## CI and review

- **`ci.yml`** — `astro sync`, then type-check, lint, format-check, structure
  check, test, and a production build, on every PR and push to `main`.
- **`code-review.yml`** — AI review of every PR against this repo's own
  convention files (read from the base branch). Needs an `OPENROUTER_API_KEY`
  repository secret.

Both should be required checks on `main`.

## Conventions

Static output, zero JavaScript unless a section earns it, thin pages composing
sections, tokens through `--tone-*` (never a literal hex), no barrel files,
kebab-case filenames, co-located real-data tests. Full rules in
[`CLAUDE.md`](./CLAUDE.md).
