/** drizzle-kit config — schema in, migrations out. */
import { defineConfig } from 'drizzle-kit';

// better-auth owns its own tables and runs its own migrator
// (`npx auth migrate`). Both tools point at the SAME Turso database, so
// without this filter `drizzle-kit push` reads the auth tables as drift and
// offers to drop them. Keep this list in step with the auth schema if you
// change providers.
const AUTH_TABLES = ['!user', '!session', '!account', '!verification'];

export default defineConfig({
  dialect: 'turso',
  schema: './src/schema/tables.ts',
  out: './drizzle',
  tablesFilter: AUTH_TABLES,
  dbCredentials: {
    url: process.env.TURSO_URL ?? '',
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
});
