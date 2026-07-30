/** The typed API client and its TanStack Query bindings — created once, used everywhere. */

import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import { createTanstackQueryUtils } from '@orpc/tanstack-query';
import type { RouterClient } from '@orpc/server';
import type { AppRouter } from '@acme/api-contract';
import { BASE_API_URL } from '@/constants/env';

// `AppRouter` is a TYPE-ONLY import: it is erased at build time, so nothing from
// the server ends up in this bundle. Where it comes from depends on your layout —
// a workspace package in a monorepo, or a published contract package across
// repos. Point the import at yours; the rest of this file does not change.

const link = new RPCLink({
  url: `${BASE_API_URL}/rpc`,
  // Resolved per request — the place to attach the session token. Returning it
  // from a function (not a static object) means a token refreshed mid-session is
  // picked up without rebuilding the client.
  headers: () => ({}),
});

const client: RouterClient<AppRouter> = createORPCClient(link);

/**
 * TanStack Query bindings for every procedure, mirroring the router's shape:
 *
 *   useQuery(orpc.shifts.list.queryOptions({ input: { locationId } }))
 *   useMutation(orpc.shifts.create.mutationOptions())
 *   queryClient.invalidateQueries({ queryKey: orpc.shifts.key() })
 *
 * Query keys come from the procedure path, so there is no key factory to write
 * and no key to get wrong — that is the point of using this over hand-rolled
 * `queryKey` arrays.
 */
export const orpc = createTanstackQueryUtils(client);
