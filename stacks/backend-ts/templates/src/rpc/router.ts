/** The API's public surface — the one type every client is generated from. */

import { healthProcedures } from '@/rpc/health-procedures';

// Composed by hand, and NOT a barrel file: a barrel exists only to re-export, so
// it hides where things live. This file builds a value — the router — and its
// shape *is* the API. Reading it should tell you the whole surface, and adding a
// domain means adding one line here.
/** The API surface, one line per domain. Clients are typed from this value. */
export const router = {
  health: healthProcedures,
};

/**
 * What clients are typed against. In a monorepo a client imports this type
 * directly (`import type { AppRouter } from '@acme/api'`); across repos, share a
 * contract instead — see STRUCTURE.md → "Sharing the API type".
 */
export type AppRouter = typeof router;
