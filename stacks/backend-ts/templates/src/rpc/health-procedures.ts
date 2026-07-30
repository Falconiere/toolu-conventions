/** Procedures under `health.*` — the template for every other domain. */

import * as z from 'zod';
import { base } from '@/rpc/base';

const HealthStatus = z.object({
  status: z.literal('ok'),
});

// A procedure declares its input and output as Zod schemas, and oRPC validates
// BOTH — the input before the handler runs, the output before it leaves. The
// client's types are derived from these same schemas, so the contract cannot
// drift from the implementation.
//
// Keep handlers thin, exactly like a route: parse, call a service, shape the
// result. The real work lives in src/services/.
/** `health.check` — liveness, callable by a typed client. */
export const check = base.output(HealthStatus).handler(() => {
  return { status: 'ok' };
});

/** The `health.*` namespace, mounted into the router. */
export const healthProcedures = { check };
