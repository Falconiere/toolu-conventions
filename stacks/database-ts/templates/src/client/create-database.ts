/** Build a database handle for one request. Never call this at module scope. */
import { createClient } from '@libsql/client/web';
import { drizzle } from 'drizzle-orm/libsql/web';
import { parseDatabaseConfig } from '@/constants/env';
import { tables } from '@/schema/tables';

// Per request, not per isolate. A Worker evaluates a module once and shares
// that isolate across every request it serves, so a handle built at module
// scope outlives the request that made it and carries whatever config existed
// at startup. `house/no-module-scope-database` fails the lint if you try.
//
// The `/web` entries are mandatory: the default `@libsql/client` and
// `drizzle-orm/libsql` exports are Node-native and will not run on workerd.
export function createDatabase(config: unknown) {
  const { url, authToken } = parseDatabaseConfig(config);
  return drizzle(createClient({ url, authToken }), { schema: tables });
}
