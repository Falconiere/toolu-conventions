/** Worker entry — the Cloudflare runtime calls this default export for every request. */

import { app } from '@/app';

// The ONE default export in this codebase. The Workers runtime requires the
// module's fetch handler to be the default export, so `src/index.ts` is the
// single sanctioned exception to the named-exports-only rule (the lint config
// turns `import/no-default-export` off for this file and nowhere else).
//
// A Hono app is already a valid Worker handler — it has a `fetch` method — so
// there is nothing to wrap. Keep this file exactly this size: routing,
// middleware and logic all belong in `src/app.ts` and below.
export default app;
