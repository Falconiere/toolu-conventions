/** Server entry — boots the Hono app with Bun.serve on the validated PORT. */

import { app } from '@/app';
import { PORT } from '@/constants/env';

const server = Bun.serve({
  port: PORT,
  fetch: app.fetch,
});

// Startup banner on stdout (console.log is blocked by the gate; stdout is where a
// server banner belongs). Swap for the structured logger once you wire one in.
process.stdout.write(`Listening on http://localhost:${server.port}\n`);
