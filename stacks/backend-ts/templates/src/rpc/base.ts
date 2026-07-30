/** The base oRPC builder — every procedure in this service starts from it. */

import { os } from '@orpc/server';

/** What every procedure receives: the Worker bindings and the request headers. */
export interface RpcContext {
  readonly env: Env;
  readonly headers: Headers;
}

// Declaring the context ONCE here is what makes `context.env` typed inside every
// handler. Build procedures from `base`, never from a bare `os` — a procedure
// that starts from `os` compiles fine and then has an untyped context.
//
// Shared middleware (auth, rate limiting, logging) is attached here with
// `.use(...)` so it cannot be forgotten on a new procedure.
/** The builder every procedure starts from — carries the context type and shared middleware. */
export const base = os.$context<RpcContext>();
