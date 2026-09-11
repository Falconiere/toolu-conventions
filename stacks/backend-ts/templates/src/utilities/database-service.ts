/** Per-request Turso connection for the Worker runtime. */
import { connect } from '@tursodatabase/serverless';
import { tursoConfig } from '@/constants/env';

/** Creates a fetch-based Turso client from the current Worker bindings. */
export function createDatabase() {
  const { url, authToken } = tursoConfig();
  return connect({ url, authToken });
}
