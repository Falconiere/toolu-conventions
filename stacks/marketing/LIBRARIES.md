# Library Reference

The curated toolbox for marketing sites in this kit. The philosophy is **lean**,
and here it is also **literal**: every dependency you add to a static site either
ships to a visitor's browser or slows a build that runs on every deploy. Astro
sends zero JavaScript by default. Protect that.

Install with **`bun add`** (runtime) or **`bun add -d`** (dev). Lockfile is
committed; CI installs with `--frozen-lockfile`.

---

## Baseline — installed by `SETUP.md` in every site

| Concern | Library | Notes |
| --- | --- | --- |
| Framework | `astro` | File-based pages, content collections, islands. Static output by default. |
| Type-checking | `@astrojs/check` + **`typescript@^6`** | `astro check` type-checks `.astro` frontmatter and templates — oxlint cannot. **Keep the 6.x pin:** `astro check` needs TypeScript's programmatic API, which TS 7's native compiler does not ship yet, so an unpinned install makes the gate hard-error before it checks anything. |
| Styling | `tailwindcss` (v4) + `@tailwindcss/vite` | **The** styling system, not an option. Wired through `vite.plugins` in `astro.config.mjs` — **not** `@astrojs/tailwind`, which is the deprecated v3 integration. CSS-first: the tokens are `@theme` blocks in `src/ui/theme/*.css`, shared verbatim with the console. `tailwindcss` is in `knip.json`'s `ignoreDependencies` on purpose — only `globals.css` imports it, and knip does not follow CSS. |
| Fonts | `@fontsource-variable/archivo` + `@fontsource-variable/jetbrains-mono` | The two families the design language names, self-hosted — no runtime request to Google. |
| Sitemap | `@astrojs/sitemap` | A marketing site without a sitemap is a marketing site with a slower crawl. Needs `site` set in `astro.config.mjs`. |
| Validation | `zod` (v4) | Every boundary: env, anything the build fetches. Content collections use `astro/zod`, the same library re-exported. |
| Testing | `vitest` | Via `getViteConfig()` from `astro/config`, so tests see the real build config. |
| Dead code / unused deps | TypeScript + oxlint + `knip` | Astro's compiler and lint reject unused locals/parameters (including `_name`); knip rejects unused files, exports, and dependencies. |
| Copy-paste detection | `jscpd` | Gate step, `threshold: 0` + `exitCode: 1`. |
| Lint / format | `oxlint` + `oxfmt` (+ `oxlint-tsgolint` for type-aware) | oxlint reads `.astro` frontmatter too; oxfmt handles `.ts`/`.tsx` (JSX included) but cannot parse `.astro` component syntax. The template body is `astro check`'s job. |
| Git hooks | `lefthook` | Pre-commit lint + format on staged files. |
| Deploy | `wrangler` (dev dependency) | Cloudflare Workers CLI — the house deploy target. |

---

## Reach-for-these — add when the site needs them

| Concern | Library | When / why |
| --- | --- | --- |
| Markdown authoring with components | `@astrojs/mdx` | When writers need to drop a component into a post. Plain `.md` is enough for most content — add MDX when someone actually asks. |
| RSS feed | `@astrojs/rss` | For a blog or changelog collection. |
| An interactive island | `@astrojs/react` | **Only** when a section genuinely needs client state (a pricing calculator, a filterable table). Reuse the console's component patterns; hydrate with the narrowest `client:*` directive that works (`client:visible` before `client:load`). |
| SSR on Cloudflare | `@astrojs/cloudflare` | Only for a page that cannot be built ahead of time (personalised content, form POST handling). Adding it changes the deploy shape — see SETUP.md Phase 6. |
| Images | `astro:assets` (built in) | Use `<Image />` from `astro:assets` rather than a raw `<img>`: it sizes, formats and lazy-loads at build time, with no dependency. |
| Dates | `Intl.DateTimeFormat` | Built in. Add `date-fns` only if you need real date math, which a marketing site rarely does. |
| HTTP (build time) | `src/utilities/http.ts` | Copy it from the console kit if the build fetches from a CMS or API. Same rule as everywhere: no axios. |

---

## AVOID — and why

| Library | Avoid because | Use instead |
| --- | --- | --- |
| **`axios`** | A dependency for something the platform already does, and here it would be a dependency in a *static build*. | `src/utilities/http.ts` (the kit's fetch client), copied from the console kit. Blocked by lint and by `guardrails`. |
| A React/Vue/Svelte integration "so components are reusable" | Pulling a framework in to render static markup ships a runtime to every visitor and throws away the reason this stack exists. | `.astro` components. Add a framework integration for one genuinely interactive island, not as the default component model. |
| `client:load` by reflex | Hydrates on first paint and blocks the main thread for markup that was already correct as HTML. | `client:visible` / `client:idle`, or no directive at all. |
| A second styling system — another CSS framework, CSS Modules, `styled-components`/`emotion` | Two styling systems fight the band seam and double the payload. | Tailwind utilities. The CSS-in-JS packages are `bannedDeps` in `guardrails.config.json`. |
| **`@astrojs/tailwind`** | The v3-era integration, deprecated since Tailwind v4. Installing it alongside `@tailwindcss/vite` runs two Tailwind pipelines over one stylesheet. | `vite: { plugins: [tailwindcss()] }` in `astro.config.mjs`. Blocked as a `bannedDep`. |
| An Astro scoped `<style>` block | It was the old house answer here, and it is now the seam a second styling system walks back in through: one `<style>` becomes twelve, each restating tokens the utilities already carry. | Utilities. If a rule genuinely cannot be one, add an `@utility` to `src/ui/theme/scale.css` so it stays composable and variant-aware. |
| A `tailwind.config.js` / `tailwind.config.ts` | v4 is CSS-first: a JS config is a second token file next to the `@theme` blocks, and the two drift silently. | `@theme` in `src/ui/theme/palette.css` and `scale.css`. |
| `yup` / `valibot` / `joi`, or hand-written type guards | The kit has one validator. A second one means two ways to describe the same shape. | **`zod`** — and `astro/zod` inside `content.config.ts`, which is the same library re-exported so Astro can generate collection types. |
| A headless CMS SDK, by default | Most marketing sites are better served by markdown in the repo: version-controlled, reviewable in the same PR, and zero build-time network calls. | Content collections. Reach for a CMS when a non-engineer genuinely needs to publish without a PR. |
| Analytics scripts in `<head>` | A third-party blocking script is usually the single biggest thing between a visitor and your first paint. | A deferred/async tag, or an edge-side analytics product. Either way it is a per-project decision. |

---

## Product integrations (opt-in, not baseline)

Add per project when the need exists: **PostHog / Plausible / Fathom**
(analytics), **Sentry** (errors), **Resend** (email capture), **Stripe** (pricing
links). Each is a setup-time question, not a default dependency — and on a static
site each one has a measurable cost in bytes.

---

## Vendoring vs. installing

Prefer **vendoring** (copying a small, well-understood source file into
`src/utilities/` with attribution + a test) over an npm dependency when the
library is tiny, unmaintained, or you only need a slice of it. Treat vendored
code as ours: lint it, type it, test it.
