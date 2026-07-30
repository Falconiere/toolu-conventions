/** Runtime-validated environment — the one typed source of truth for config. */

// Workers has no `process.env`. Config arrives as bindings on the request
// context (`c.env`), and `cloudflare:workers` re-exports the same object for
// code that isn't holding a context. Every field is declared as a Zod schema —
// one place to read the shape, one error that names every bad field at once, and
// types inferred from the same declaration instead of restated beside it.
//
// These are FUNCTIONS, not module-level constants, on purpose: a Worker module
// is evaluated once per isolate, before any request, and validating eagerly
// there couples startup to config a test may want to override. Each result is
// memoized, so the schema runs once per isolate, not once per call.
//
// Add a var by declaring it in `wrangler.jsonc` (or `.dev.vars` if it is a
// secret), running `bun run cf-typegen`, and adding it to a schema here.

import { env } from 'cloudflare:workers';
import * as z from 'zod';

const AppSchema = z.object({
  APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
});

// Kept separate from AppSchema so a service with no database still boots. A
// missing Turso binding should fail the first query with a fixable message, not
// every request in a service that never touches the database.
const TursoSchema = z.object({
  TURSO_DATABASE_URL: z.string().min(1),
  TURSO_AUTH_TOKEN: z.string().min(1),
});

/** The logical environment this deploy targets. */
export type AppEnv = z.infer<typeof AppSchema>['APP_ENV'];

function parseOnce<T>(schema: z.ZodType<T>, cache: { value?: T }): T {
  if (cache.value === undefined) {
    const result = schema.safeParse(env);
    if (!result.success) {
      throw new Error(
        `[env] invalid configuration:\n${z.prettifyError(result.error)}\n` +
          `Set it in wrangler.jsonc, .dev.vars, or with 'wrangler secret put'.`,
      );
    }
    cache.value = result.data;
  }
  return cache.value;
}

const appCache: { value?: z.infer<typeof AppSchema> } = {};
const tursoCache: { value?: z.infer<typeof TursoSchema> } = {};

/** The logical environment this deploy targets. Defaults to development. */
export function appEnv(): AppEnv {
  return parseOnce(AppSchema, appCache).APP_ENV;
}

/** True only in the production deploy — never gate a security check on this alone. */
export function isProd(): boolean {
  return appEnv() === 'production';
}

/** Turso connection config. Throws with a fixable message when a value is missing. */
export function tursoConfig(): { readonly url: string; readonly authToken: string } {
  const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } = parseOnce(TursoSchema, tursoCache);
  return { url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN };
}
