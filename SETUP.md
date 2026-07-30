# SETUP — Project Scaffold Router

You are a coding agent scaffolding a new project from this kit. Follow this
file top to bottom. It routes you to a stack kit; the stack kit's `SETUP.md`
does the heavy lifting.

## 0. Prerequisites (verify before intake)

Run and confirm each; stop and report anything missing:

```bash
git --version
bun --version          # TS stacks only
cargo --version        # rust only
gh --version           # optional — repo creation
```

Read [`CORE.md`](./CORE.md) now. Every rule in it binds the project you are
about to create — including the platform defaults (Cloudflare Workers, Turso,
better-auth, the kit's own `http.ts` instead of axios) and the four guard-rail
layers. If the stack is `expo`, `console`, or `marketing`, read
[`DESIGN.md`](./DESIGN.md) too — the theme tokens ship pre-filled with that
language.

## 1. Intake questions (fixed order — ask all up front, don't trickle)

1. **Stack** — one of: `console` · `marketing` · `backend-ts` · `expo` · `rust`.

   | Stack | Builds | Runs on |
   | --- | --- | --- |
   | `console` | The authenticated product app (SPA) | React + Vite + TanStack Router → Cloudflare Workers static assets |
   | `marketing` | The public website | Astro (static) → Cloudflare Workers static assets |
   | `backend-ts` | The HTTP API | Hono → Cloudflare Workers (workerd) + Turso |
   | `expo` | The mobile app | Expo / React Native |
   | `rust` | A CLI or service in Rust | Single crate |

   > A full product is usually **three** of these — `marketing`, `console`, and
   > `backend-ts` — each its own repo. If the user describes a whole product,
   > say so and scaffold them one at a time rather than merging them.

2. **Project name** — kebab-case; used for the directory, package/crate name,
   the Cloudflare Worker name, and bundle/app identifiers where applicable.
3. **Staging environment?** — ask for every stack except `rust`. Default: no
   (DEV + PRODUCTION only). On the Workers stacks, staging is one more
   `wrangler` environment, not another codebase.
4. **Optional integrations** — offer the menu for the chosen stack; each is
   opt-in:

   | Stack | Integration options (option → what it wires) |
   | --- | --- |
   | console | API layer (oRPC client + TanStack Query bindings) · auth client (better-auth) · same-project Worker API (`@cloudflare/vite-plugin` + Turso; default no) |
   | marketing | Content collections (blog/changelog) · SSR via `@astrojs/cloudflare` (default no — static) · an interactive island · analytics |
   | backend-ts | Database (**Turso**, default yes) · auth (better-auth, server half) · structured logging · Drizzle ORM over Turso |
   | expo | API layer (oRPC client + TanStack Query bindings; the kit's `http.ts` for everything else) · auth (better-auth client + `expo-secure-store`) · local storage (`@react-native-async-storage/async-storage`) |
   | rust | CLI parsing (`clap`) · HTTP service (`axum` + `tokio`) · serialization (`serde`/`serde_json`) |

   Note what is **not** a question: the validator (always **Zod**, at every
   boundary, with types from `z.infer`), how our own apps talk to our own API
   (always **oRPC + TanStack Query**), the HTTP client for everything else
   (always the kit's `src/utilities/http.ts` — axios is banned), the database
   (always **Turso**), the auth library (always **better-auth**), the host
   (always **Cloudflare Workers**), and the gate steps (**knip** and **jscpd**
   are not optional). See CORE.md → "Platform defaults".

5. **Design context** — `console`, `marketing`, and `expo` only: free-text
   brand/look description (colors, tone, reference apps). The theme tokens
   already ship the house language ([`DESIGN.md`](./DESIGN.md)); ask whether to
   **keep it as-is** (default), pick a different **signal temperature** (Jade ·
   Blueprint · Ion · Chalk — a one-line change, nothing else moves), or override
   the brand outright. If overridden, feed the description into the token
   templates (`colors.ts`/`typography.ts` values) keeping their structure, and
   record the direction — and the deviation — in the generated `CLAUDE.md`
   design-notes section.

   > If this project is the sibling of one you already built (a `marketing` site
   > next to a `console`, say), **copy that project's tokens rather than
   > re-deriving them**. They are one product; a visitor who signs up should not
   > feel a seam.

## 2. Dispatch

Open `stacks/<stack>/SETUP.md` and execute it end to end with the intake
answers. Templates referenced there live in `stacks/<stack>/templates/` under
their real filenames (only `CLAUDE.md.template` is suffixed — rename it to
`CLAUDE.md` when copying). Placeholder style is per-stack — each stack's
SETUP.md documents its own substitution convention; follow it as written.

Two stacks deliberately reach across the kit: `marketing` copies its theme
tokens and `globals.css` from `stacks/console/templates/`, and `expo` copies
`utilities/http.ts` and `src/api/orpc.ts` from there too. That is not a mistake
to "fix" by duplicating — one source, on purpose.

## 3. Finish — human-only checklist

After the stack SETUP completes and its gate is green, print the checklist the
stack kit defines (Cloudflare login, Turso database creation, secrets, store
logins, EAS setup, branch protection — things only a human can do). Do not
attempt them yourself.

Every TS stack's checklist includes adding the `DEEPSEEK_API_KEY` repository
secret and requiring both **CI** and **Code Review** on `main`. Without those,
two of the four guard-rail layers in `CORE.md` are decorative.
