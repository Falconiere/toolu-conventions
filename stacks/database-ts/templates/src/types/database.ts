/** The handle type, for callers that pass a database around. */
import type { createDatabase } from '@/client/create-database';

// Derived, never hand-written: a declared interface beside the real thing is a
// second source of truth that drifts the first time a column changes.
export type Database = ReturnType<typeof createDatabase>;
