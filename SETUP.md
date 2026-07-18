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
about to create.

## 1. Intake questions (fixed order — ask all up front, don't trickle)

1. **Stack** — one of: `expo` · `web` · `backend-ts` · `rust`.
2. **Project name** — kebab-case; used for the directory, package/crate name,
   and bundle/app identifiers where applicable.
3. **Staging environment?** — ask for `expo`, `web`, `backend-ts`. Never ask
   for `rust`. Default: no (DEV + PRODUCTION only).
4. **Optional integrations** — offer the menu for the chosen stack; each is
   opt-in:

   | Stack | Integration options (option → what it wires) |
   | --- | --- |
   | expo | API layer (`src/api/` clients + React Query hooks) · auth scaffold (`expo-secure-store` token storage + auth provider) · local storage (`@react-native-async-storage/async-storage`) |
   | web | API layer (`src/api/` clients + React Query hooks) · auth scaffold (Auth.js) · DB client (none by default; named at intake) |
   | backend-ts | DB client (named at intake, e.g. postgres via `bun:sql` or drizzle) · auth middleware (bearer-token skeleton) · structured logging (pino) |
   | rust | CLI parsing (`clap`) · HTTP service (`axum` + `tokio`) · serialization (`serde`/`serde_json`) |

5. **Design context** — `expo` and `web` only: free-text brand/look description
   (colors, tone, reference apps). Feed it into the theme token templates
   (`colors.ts`/`typography.ts` values) and record it in the generated
   `CLAUDE.md` design-notes section.

## 2. Dispatch

Open `stacks/<stack>/SETUP.md` and execute it end to end with the intake
answers. Templates referenced there live in `stacks/<stack>/templates/` under
their real filenames (only `CLAUDE.md.template` is suffixed — rename it to
`CLAUDE.md` when copying). Placeholder style is per-stack — each stack's
SETUP.md documents its own substitution convention; follow it as written.

## 3. Finish — human-only checklist

After the stack SETUP completes and its gate is green, print the checklist the
stack kit defines (credentials, store logins, secrets, EAS/hosting setup —
things only a human can do). Do not attempt them yourself.
