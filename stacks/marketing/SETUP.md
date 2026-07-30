# SETUP — New Marketing Site (Astro)

**You are an AI coding agent. Your job is to scaffold a new marketing site by
following this guide top to bottom.** Work through the phases in order. Phase 0
gathers everything you need; after that, prefer acting over asking. When a step
references a template, read it from this kit's `templates/` directory and adapt
it (replace `{{PLACEHOLDERS}}`) — do not invent config from memory.

**Target baseline (non-negotiable):** Astro (static output) · TypeScript
(strictest) · bun · Vitest · oxlint + oxfmt + `astro check` · Lefthook ·
Cloudflare Workers as the deploy target · the layout and conventions in
[`STRUCTURE.md`](./STRUCTURE.md) · the lean library set in
[`LIBRARIES.md`](./LIBRARIES.md).

Read [`../../CORE.md`](../../CORE.md), then [`STRUCTURE.md`](./STRUCTURE.md),
[`LIBRARIES.md`](./LIBRARIES.md), and [`../../DESIGN.md`](../../DESIGN.md) before
you start. This site shares the house design language with the console, so the
two read as one product.

**A note on vibe:** keep it light and a little silly with the user as you go —
never at the expense of the work. Configs, code, and honest status reports stay
rock-solid. Welcome to the bit. 🎬

---

## Phase 0 — Prerequisites & intake

### 0.1 Check the toolchain

```bash
node --version   # >= 20
bun --version    # package manager for this project
git --version
```

### 0.2 Intake questions (ask the user, then proceed)

**Identity**
- Site **display name** and a kebab-case **project name** (directory,
  `package.json` name, Cloudflare Worker name).
- The **production domain** (e.g. `example.com`) — it goes in `astro.config.mjs`
  as `site`, and canonical URLs and the sitemap depend on it.
- The **console URL** this site links to (e.g. `https://app.example.com`), or
  leave the local default.

**Environments**
- development and production always exist. **Is a STAGING environment needed?**
  (default: no.)

**Content & pages**
- Which **pages** exist at launch (home, pricing, about, contact…)?
- Is there a **blog / changelog**? If yes, wire a content collection (Phase 5).

**Optional integrations** (each defaults to *no*):
- **SSR?** Only if a page cannot be built ahead of time. Default **no** — static.
- **Analytics?** Which product, if any.
- **Interactive island?** A section that genuinely needs client-side state.

**Design context** (optional — feeds the theme tokens + `CLAUDE.md`):
- Audience, tone, palette direction, reference sites.
- Signal temperature: Jade (default) · Blueprint · Ion · Chalk.
- Does the design call for **Tailwind CSS**? (default: no.)

Echo back a short summary before scaffolding.

---

## Phase 1 — Scaffold the Astro site

From an empty working directory:

```bash
bun create astro@latest . -- --template minimal --typescript strictest --no-git --install
```

If the CLI prompts despite the flags: **minimal** template, **strictest**
TypeScript, install dependencies **yes**, git **no** (the repo already exists or
you'll init it yourself).

Then remove the demo content the template ships:

```bash
rm -rf src/pages/index.astro src/components src/assets public/favicon.svg
```

---

## Phase 2 — Baseline dependencies & tooling

```bash
# Type-checking for .astro files + the sitemap.
# typescript is pinned to 6.x ON PURPOSE: `astro check` drives the TypeScript
# programmatic API, and TS 7's native compiler does not ship it yet. An
# unpinned `bun add -d typescript` resolves to 7.x today and `astro check`
# hard-errors before checking a single file — so `bun run check` is red on a
# fresh scaffold. Drop the pin once astro check supports TS 7
# (https://github.com/withastro/roadmap/discussions/1321).
bun add -d @astrojs/check 'typescript@^6'
bunx astro add sitemap --yes

# Self-hosted fonts named by the design language
bun add @fontsource-variable/archivo @fontsource-variable/jetbrains-mono

# The one validator (env, and any data the build fetches)
bun add zod

# Testing
bun add -d vitest

# Lint / format / gate + git hooks + deploy CLI
bun add -d oxlint oxfmt oxlint-tsgolint knip jscpd lefthook wrangler
```

Copy and adapt these templates into the project root, **overwriting** what the
Astro template generated where they overlap:

- `templates/astro.config.mjs` → `astro.config.mjs` (replace `{{SITE_DOMAIN}}`
  with the production domain; keep the `sitemap()` integration `astro add` just
  wrote). A staging build can override the domain with a `SITE_URL` env var, so
  staging never advertises canonical URLs pointing at production.
- `templates/tsconfig.json` → `tsconfig.json` (strictest + `@/*` alias)
- `templates/vitest.config.ts` → `vitest.config.ts`
- `templates/.oxlintrc.json` → `.oxlintrc.json`
- `templates/.oxfmtrc.json` → `.oxfmtrc.json` (sets `singleQuote: true` — oxfmt
  defaults to double quotes, so without this the templates fail `oxfmt --check`)
- `templates/knip.json` → `knip.json` (unused files/exports/dependencies)
- `templates/.jscpd.json` → `.jscpd.json` (copy-paste detection). **Keep
  `"exitCode": 1`** — jscpd 5.x already exits 1 on a threshold breach, so this
  pins the behaviour rather than enabling it; 4.x exited 0 by default.
- `templates/lefthook.yml` → `lefthook.yml` **before** running the installer —
  use the `.yml` name (lefthook 2.x's `install` writes a stub `lefthook.yml`
  that silently shadows a `lefthook.yaml`, so hooks never fire). Then run
  `bunx lefthook install`.
- `templates/scripts/check-structure.sh` → `scripts/check-structure.sh`
  (`mkdir -p scripts` first)

Set the `package.json` scripts:

```json
{
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "deploy": "bun run build && wrangler deploy",
    "sync": "astro sync",
    "type-check": "astro check",
    "lint": "oxlint --deny-warnings",
    "lint:fix": "oxlint --fix --deny-warnings",
    "fmt": "oxfmt",
    "fmt:check": "oxfmt --check",
    "test": "vitest run",
    "test:watch": "vitest",
    "check:structure": "bash scripts/check-structure.sh",
    "check:unused": "knip",
    "check:dupes": "jscpd",
    "check": "bun run type-check && bun run lint && bun run fmt:check && bun run check:structure && bun run check:unused && bun run check:dupes && bun run test",
    "prepare": "lefthook install --force || true"
  }
}
```

`bun run check` is the single quality gate. Note that `type-check` is
**`astro check`**, not bare `tsc` — it is the only tool that type-checks
`.astro` frontmatter and templates, and it is what keeps this stack honest about
the CORE no-`any` rule inside components.

---

## Phase 3 — Create the folder structure

```bash
mkdir -p src/pages src/layouts src/sections src/ui/theme src/utilities \
         src/constants src/types docs
```

Then:

1. Copy the theme tokens from the console kit —
   `../console/templates/theme/{colors,spacing,typography,motion,icons}.ts` →
   `src/ui/theme/`. **The console and the marketing site share one token set on
   purpose**: they are the same product, and a visitor who signs up should not
   feel a seam. Copy, don't fork.
2. Copy the band-seam stylesheet from the console kit —
   `../console/templates/globals.css` (or `globals.tailwind.css` if the design
   called for Tailwind) → `src/ui/globals.css`. Read its header comment before
   writing any component.
3. Copy [`../../DESIGN.md`](../../DESIGN.md) → `docs/design-language.md`
   **verbatim**. The kit is not on disk once this site is scaffolded, so without
   this copy the design rules never reach the agents who build here.
4. Copy `templates/env.ts` → `src/constants/env.ts`. It validates `PUBLIC_*`
   vars with a Zod schema. **Keep the static member-access pattern** —
   Astro only substitutes `import.meta.env.PUBLIC_X` at direct access sites.
5. Copy `templates/src/layouts/base-layout.astro` → `src/layouts/`,
   `templates/src/sections/hero-section.astro` → `src/sections/`, and
   `templates/src/pages/{index,404}.astro` → `src/pages/`. Fill in the
   placeholders. `404.astro` is **required** — `check-structure.sh` fails
   without it.
6. Drop a `README.md` into each of `src/layouts`, `src/sections`, `src/ui`,
   `src/utilities`, `src/constants`, and `src/types`, generated from
   `templates/folder-README.md`. Every `src/` directory except `src/pages`
   carries one — the structure gate fails without it.
7. Copy `templates/CLAUDE.md.template` → `CLAUDE.md` and fill in the specifics.

**Conventions reminder while you build:** pages compose sections and hold no
markup of their own; one section per file; tokens through `--tone-*`, never a
literal hex; no `client:*` directive without a reason in a comment.

---

## Phase 4 — Environments

1. Copy `templates/.env.example` → `.env.example`; create a local `.env`. Ensure
   `.gitignore` ignores `.env*` **except** `.env.example`.
2. Public vars are prefixed `PUBLIC_` and validated in `src/constants/env.ts`.
   **This is a static site — every value is baked into shipped HTML.** There is
   no server-only half; a secret here is a published secret.
3. If **STAGING** was requested, staging is a Worker environment built with
   `PUBLIC_ENV=staging`; `APP_ENV` in `env.ts` already recognizes it, and
   Phase 7 shows the `wrangler.jsonc` block.

---

## Phase 5 — Pages and content

1. Build the pages the intake named, one file per URL in `src/pages/`. Each one
   picks `BaseLayout`, passes a real `title` + `description`, and lists sections.
2. Build each section as its own file in `src/sections/`, named for what it is
   (`pricing-section.astro`, `faq-section.astro`).
3. If there is a **blog or changelog**, create `src/content.config.ts` with a
   `defineCollection` per collection and put the markdown under `src/content/`.
   See the example in [`STRUCTURE.md`](./STRUCTURE.md). Run `bunx astro sync`
   afterwards so the generated types exist.
4. Put `favicon.svg`, `robots.txt`, and the Open Graph image in `public/`.

---

## Phase 6 — Optional integrations (only what Phase 0 selected)

**SSR** — only if a page cannot be built ahead of time.
`bunx astro add cloudflare --yes`, set `output: 'server'` in `astro.config.mjs`,
and switch the pages that must stay static to `export const prerender = true`.
In `wrangler.jsonc`, point `"main"` at the adapter's Worker entry, add
`"binding": "ASSETS"` to `assets`, and add `"compatibility_flags":
["nodejs_compat"]`. This changes the cost and failure model of the whole site —
record *which page* forced it, and why, in `CLAUDE.md`.

**Interactive island** — `bunx astro add react --yes`, build the component under
`src/ui/`, and hydrate it from a section with the narrowest directive that works
(`client:visible` before `client:idle` before `client:load`). Add a comment
saying why it can't be static.

**Analytics** — add the tag in `base-layout.astro`, deferred, and note the
product in `CLAUDE.md`. Never a blocking script in `<head>`.

---

## Phase 7 — Cloudflare Workers deploy config

Copy `templates/wrangler.jsonc` → `wrangler.jsonc` and set `"name"` to the
project name.

`not_found_handling` is **`"404-page"`**, not `"single-page-application"` — this
is a multi-page site, and an unmatched URL must return a real 404 so crawlers
drop it instead of indexing a soft-200. (The console stack is the opposite case;
that is the one meaningful difference between the two `wrangler.jsonc` files.)

If **STAGING** was requested, uncomment the `env.staging` block. Verify through
the real runtime before calling this done:

```bash
bun run build
bunx wrangler dev          # check a real page AND a made-up URL (must 404)
```

---

## Phase 8 — CI and the review guard rails

```bash
mkdir -p .github/workflows
```

1. Copy `templates/.github/workflows/ci.yml` → `.github/workflows/ci.yml`. It
   runs `astro sync` (so `astro check` has generated types on a fresh clone),
   then type-check + lint + fmt:check + check:structure + knip + jscpd + test +
   build.
2. Copy `templates/.github/workflows/code-review.yml` →
   `.github/workflows/code-review.yml`. It reviews every PR against this repo's
   own convention files, read from the **base** ref. Needs an
   `DEEPSEEK_API_KEY` repository secret.

See [`../../CORE.md`](../../CORE.md) → "Quality gates & guardrails" for how the
four layers fit together.

---

## Phase 9 — Top-level README

Generate the project `README.md` from `templates/README.md`: description, layout
table, environments, scripts, deploy, CI. Cross-link `CLAUDE.md`.

---

## Phase 10 — Verify (run the gate)

```bash
bun run sync       # generate .astro/types.d.ts first
bun run check      # astro check + oxlint + oxfmt + check-structure + knip + jscpd + vitest
bun run build      # production build succeeds
```

`bun run check` must exit 0. Report the results honestly — do not mark setup
complete with any gate failing.

---

## Phase 11 — Human-only checklist (print this for the user)

- [ ] **Cloudflare account**: `wrangler login`, confirm the account id, run the
      first `bun run deploy`.
- [ ] **Domain**: point the apex (and `www`) at the Worker, provision TLS, and
      pick one canonical host — then confirm the other redirects to it.
- [ ] **`site` in `astro.config.mjs`** matches that canonical host, or every
      canonical URL and sitemap entry is wrong.
- [ ] **Environment variables**: set `PUBLIC_*` per environment. They are public
      — never put a secret in one.
- [ ] **Search Console / Bing Webmaster**: verify the domain and submit
      `/sitemap-index.xml`.
- [ ] **GitHub repo**: create it, push, add the `DEEPSEEK_API_KEY` secret.
- [ ] **Branch protection**: require the **CI** check and a passing **Code
      Review** on PRs to `main`.

> Once these are done, the site is ready to deploy.
