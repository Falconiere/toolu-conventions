/** The Hono application — every route and middleware is mounted here. */

import { Hono } from 'hono';

/**
 * The assembled app. `index.ts` serves it; tests import it and call `app.request(...)`.
 * Mount one route module per resource here (see routes/README.md); keep this file
 * to wiring — no business logic.
 */
export const app = new Hono();

// Liveness probe — returns 200 while the process is up. Replace/extend with your
// own resource routes; keep handlers thin and push logic into services/.
app.get('/health', (c) => c.json({ status: 'ok' }));
