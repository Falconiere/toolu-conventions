# Project Structure & Conventions

The canonical layout every new marketing site in this kit produces. It inherits
every rule in [`../../CORE.md`](../../CORE.md) and adds the Astro-specific rules
below — it never relaxes a CORE rule.

> **Marketing, not console.** This stack builds the **public site**: the pages a
> stranger and a search crawler see. It is static HTML by default, ships almost
> no JavaScript, and holds no session. The authenticated product lives in
> [`../console/`](../console/). If a page needs a logged-in user, it is not a
> marketing page.

## Folder tree

```
<site>/
├── src/
│   ├── pages/                # ROUTES — one file per URL. Thin: compose sections
│   │   ├── index.astro       # `/`
│   │   ├── 404.astro         # required; Workers serves it with a real 404
│   │   └── blog/[slug].astro # dynamic route over a content collection
│   ├── layouts/              # Page shells (<html>, <head>, meta). README.md
│   │   └── base-layout.astro
│   ├── sections/             # Composed page sections — hero, pricing, faq. README.md
│   ├── ui/                   # Design system — primitives + theme + globals.css. README.md
│   │   ├── globals.css       # The ONE stylesheet: imports Tailwind + the tokens; imported by base-layout
│   │   └── theme/            # palette.css (what swaps) · scale.css (what doesn't) · icons.ts
│   ├── content/              # Content collections (markdown + assets). README.md
│   ├── content.config.ts     # defineCollection() — the collection schemas
│   ├── utilities/            # Shared pure helpers. README.md
│   ├── constants/            # env.ts (Zod-validated), enums. README.md
│   └── types/                # cross-cutting TS types. README.md
├── public/                   # served verbatim at the site root (favicon, robots.txt, og image)
├── docs/                     # design-language.md — house UI rules, read before UI work
├── scripts/                  # guardrails/run.sh — folder-tree half of the gate
├── astro.config.mjs          # Astro config (static output, site URL, Tailwind via vite.plugins)
├── wrangler.jsonc            # Cloudflare Workers deploy config (static assets)
├── tsconfig.json             # astro/tsconfigs/strictest + `@/*` path alias
├── vitest.config.ts          # getViteConfig() — reuses the Astro config
├── .oxlintrc.json · .oxfmtrc.json · lefthook.yml
├── .env.example
├── .github/workflows/        # ci.yml (the gate) + code-review.yml (AI review)
├── CLAUDE.md                 # agent rules + repo map (read first)
└── README.md                 # human + agent entry point
```

> Folder vocabulary (`ui`, `utilities`, `constants`, `types`) is shared with the
> other stacks in this kit. `pages`, `layouts` and `content` are Astro's;
> `sections` is this stack's answer to the console's `features`.

## Path alias

`@/*` → `src/*`, configured in `tsconfig.json` and understood by Astro's Vite
pipeline in `.astro` frontmatter and `.ts` files alike. Deep relative imports
(`../../…`) are a lint error; use the alias.

```astro
---
import BaseLayout from '@/layouts/base-layout.astro';
import { CONSOLE_URL } from '@/constants/env';
---
```

## Two configs, and why that's fine here

Unlike the console stack (one `vite.config.ts` carrying the Vitest block), Astro
owns its build config in `astro.config.mjs`, and `vitest.config.ts` pulls that
same config in through `getViteConfig()`. There is still exactly one source of
truth — the test config *derives* from the build config rather than replacing it.

## Hard conventions (marketing — added on top of CORE)

1. **Static by default.** `output: 'static'`. A marketing page should be HTML on
   an edge cache — no adapter, no cold start, no per-view compute. Switching to
   SSR is a deliberate, documented decision for a specific page, not a default.
   _Enforced by:_ review + the `astro.config.mjs` comment.
2. **Pages are thin.** A file in `src/pages/` picks a layout and lists sections.
   No markup of its own beyond composition, no data munging, no styling — a page
   carries no utility classes either; the sections own their own layout.
   _Enforced by:_ review.
3. **Sections own the markup.** One section per file in `src/sections/`, named
   after what it is (`pricing-section.astro`). A page is a readable list of them.
   _Enforced by:_ `unicorn/filename-case` (kebab-case) + review.
4. **Ship no JavaScript you don't need.** Astro sends zero JS by default; a
   `client:*` directive on an island is an explicit, justified choice. If a
   section needs a framework component to be interactive, it earns a comment
   saying why.
   _Enforced by:_ review (and the Lighthouse number, eventually).
5. **A real `404.astro`.** `wrangler.jsonc` uses `not_found_handling: "404-page"`
   so dead URLs return a genuine 404 rather than a soft-200 that crawlers index.
   _Enforced by:_ `guardrails` (fails if the page is missing).
6. **Every page sets `title` + `description`,** and the layout emits a canonical
   URL. These are the site's product surface, not decoration.
   _Enforced by:_ `Props` on `base-layout.astro` (both are required) + review.
7. **TailwindCSS, and nothing else.** Every section is styled with utility
   classes. `src/ui/globals.css` is the only stylesheet on the site: **no Astro
   scoped `<style>` block**, no CSS Modules, no CSS-in-JS, no `style` attribute.
   Values live in `src/ui/theme/palette.css` and `scale.css` and reach a section
   only as generated utilities, which resolve through `--tone-*` and therefore
   work in either band. A hex literal in a section is a bug; so is a `<style>`
   block, because the moment one exists there are two places to look for why a
   thing is 12px.
   _Enforced by:_ `guardrails` (the three CSS files are `requiredFiles`; the
   CSS-in-JS packages and `@astrojs/tailwind` are `bannedDeps`) +
   `no-restricted-imports` (`*.module.css`) + review for a `<style>` block,
   which is the one part oxlint cannot see — it does not read an `.astro`
   template body.
8. **Type is applied by role, never by size.** One `type-*` class carries family,
   size, leading, weight, tracking, case and numerals together (`type-display`,
   `type-body`, `type-marker`, …). The token stylesheets reset Tailwind's stock
   scales to `initial`, so `text-sm`, `font-bold`, `rounded-2xl` and the stock
   colour ramps do not exist here — a magic number is a class that was never
   generated, not a review note.
   _Enforced by:_ the `@theme` resets in `src/ui/theme/scale.css`.
9. **Named exports, no barrels, kebab-case filenames, co-located real-data
   tests, no `any`, no `console.log`, `max-lines: 300`** — the CORE rules.
   _Enforced by:_ oxlint + `guardrails`. oxlint **does** read `.astro`
   frontmatter, so the import and TypeScript rules apply there too — the entry
   layouts carry a scoped `import/no-unassigned-import` override because a
   side-effect `import '@/ui/globals.css'` is the whole point of that file.
   What oxlint cannot see is the template body below the frontmatter; that is
   `astro check`'s job, and the conventions in it are review-enforced.

## Routes (Astro file-based)

`src/pages/` is the URL map: `index.astro` → `/`, `pricing.astro` → `/pricing`,
`blog/[slug].astro` → `/blog/:slug`, `404.astro` → the not-found page. A dynamic
static route declares its URLs at build time with `getStaticPaths`:

```astro
---
import { getCollection } from 'astro:content';

export async function getStaticPaths() {
  const posts = await getCollection('blog');
  return posts.map((post) => ({ params: { slug: post.id }, props: { post } }));
}
---
```

## Content collections

Long-form content (blog, changelog, docs) lives in `src/content/` as markdown,
with its shape declared in `src/content.config.ts`:

```ts
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
  }),
});

export const collections = { blog };
```

> `astro/zod` here rather than a direct `zod` import: it is Astro's own
> re-export, and it is what lets Astro generate the collection types that
> `astro check` validates. It is the same library the rest of the project uses
> for env and parsed data (CORE rule 13) — one validator, imported the way each
> tool expects.

Run `bunx astro sync` after changing `content.config.ts` (and in CI before
`astro check`) so the generated types exist.

## LLM-indexability strategy

An agent should answer "where does X live / is there already a section for Y?"
without reading the whole tree. We get that from:

- **A README in every `src/*` folder** except `pages` (whose structure *is* the
  documentation), from [`templates/folder-README.md`](./templates/folder-README.md).
- **`CLAUDE.md` at the root** as the map + rulebook, read first by agents.
- **No barrels + filename ↔ content** — grep for a symbol lands on its definition.
- **The `@/` alias** makes import sites self-describing.

When you add a notable section/util/collection, add a one-line entry to that
folder's README so the index stays current.
