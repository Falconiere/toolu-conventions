/** Runtime-validated public environment — one typed source of truth for config. */
import * as z from 'zod';

// All public config flows through here so the site validates env in ONE place,
// with a schema rather than a pile of hand-written guards: one place to read the
// shape, one error that names every bad field at once, and the TypeScript types
// inferred from the same declaration instead of restated next to it.
//
// IMPORTANT: Astro substitutes `import.meta.env.PUBLIC_*` at *direct static
// member-access* sites only. Build the object below by naming each var at its
// full static path — never hand `import.meta.env` to the schema wholesale, and
// never read it through a loop or a dynamic index, or every field collapses to
// undefined in the production build.
//
// This is a STATIC site: every value here is baked into shipped HTML. Only
// PUBLIC_-prefixed vars belong in this file, and none of them may be a secret.

/** Treats an unset OR empty var as absent, so `.default()` applies to both. */
function optional(value: string | undefined): string | undefined {
  return value === undefined || value.length === 0 ? undefined : value;
}

const EnvSchema = z.object({
  PUBLIC_ENV: z
    .enum(['development', 'staging', 'production'])
    .default(import.meta.env.PROD ? 'production' : 'development'),
  /** Where every "Log in" / "Get started" link points — the console app. */
  PUBLIC_CONSOLE_URL: z.url().default('http://localhost:5173'),
});

/** The logical environment this build targets. */
export type AppEnv = z.infer<typeof EnvSchema>['PUBLIC_ENV'];

const parsed = EnvSchema.safeParse({
  PUBLIC_ENV: optional(import.meta.env.PUBLIC_ENV),
  PUBLIC_CONSOLE_URL: optional(import.meta.env.PUBLIC_CONSOLE_URL),
});

if (!parsed.success) {
  // Thrown at build time, on purpose: a misconfigured site should fail the build
  // rather than ship a page with a broken "Get started" link.
  throw new Error(`[env] invalid configuration:\n${z.prettifyError(parsed.error)}`);
}

export const APP_ENV: AppEnv = parsed.data.PUBLIC_ENV;
export const IS_PROD: boolean = APP_ENV === 'production';
export const CONSOLE_URL: string = parsed.data.PUBLIC_CONSOLE_URL;
