/** drizzle-kit config — schema in, migrations out. */
import { defineConfig } from 'drizzle-kit';

// better-auth owns its own tables and runs its own migrator
// (`npx auth migrate`). Both tools point at the SAME Turso database, so
// without this filter `drizzle-kit push` reads the auth tables as drift and
// offers to drop them. Keep this list in step with the auth schema if you
// change providers.
const AUTH_TABLES = ['!user', '!session', '!account', '!verification'];
// A syntactically valid, unreachable default lets type-checkers and Knip load
// this configuration. Real migration commands still require TURSO_URL.
const databaseUrl = process.env.TURSO_URL ?? 'libsql://configuration-required.invalid';
const authToken = process.env.TURSO_AUTH_TOKEN;

export default defineConfig({
  dialect: 'turso',
  schema: './src/schema/tables.ts',
  out: './drizzle',
  tablesFilter: AUTH_TABLES,
  // Deliberately not `?? ''`. An empty URL makes drizzle-kit fail somewhere
  // deep with a parse error; an absent one makes it say the credential is
  // missing, which is the thing that is actually wrong.
  dbCredentials: {
    url: databaseUrl,
    ...(authToken === undefined ? {} : { authToken }),
  },
});
