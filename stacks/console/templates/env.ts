/** Runtime-validated public environment — one typed source of truth for config. */
import * as z from 'zod';

// All public config flows through here so the app validates env in ONE place,
// with a schema rather than a pile of hand-written guards: one place to read the
// shape, one error that names every bad field at once, and the TypeScript types
// inferred from the same declaration instead of restated next to it.
//
// IMPORTANT: Vite substitutes `import.meta.env.VITE_*` at *direct static
// member-access* sites only. Build the object below by naming each var at its
// full static path — never hand `import.meta.env` to the schema wholesale, and
// never read it through a loop or a dynamic index, or every field collapses to
// undefined in the production bundle.
//
// Only `VITE_`-prefixed vars reach the browser, and this is a static SPA:
// everything here ships to the client. Nothing secret belongs in this file.

/** Treats an unset OR empty var as absent, so `.default()` applies to both. */
function optional(value: string | undefined): string | undefined {
  return value === undefined || value.length === 0 ? undefined : value;
}

const EnvSchema = z.object({
  VITE_ENV: z
    .enum(['development', 'staging', 'production'])
    .default(import.meta.env.PROD ? 'production' : 'development'),
  VITE_API_URL: z.url().default('http://localhost:8787'),
});

/** The logical environment this build targets. */
export type AppEnv = z.infer<typeof EnvSchema>['VITE_ENV'];

const parsed = EnvSchema.safeParse({
  VITE_ENV: optional(import.meta.env.VITE_ENV),
  VITE_API_URL: optional(import.meta.env.VITE_API_URL),
});

if (!parsed.success) {
  // Thrown at import time, on purpose: a misconfigured app should fail loudly at
  // boot rather than at the first request that happens to need the bad value.
  throw new Error(`[env] invalid configuration:\n${z.prettifyError(parsed.error)}`);
}

export const APP_ENV: AppEnv = parsed.data.VITE_ENV;
export const IS_PROD: boolean = APP_ENV === 'production';
export const BASE_API_URL: string = parsed.data.VITE_API_URL;
export const REQUEST_TIMEOUT_MS = 8_000;
