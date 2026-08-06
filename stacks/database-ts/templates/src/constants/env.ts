/** The database's own config boundary — parsed, never trusted raw. */
import * as z from 'zod';

// The package takes config as an argument rather than reading it. It has no
// bindings of its own: on workerd `process.env` does not exist, and the API is
// the one holding `c.env`. Passing the values in is also what lets a test point
// at a scratch database without touching a module-level constant.
const DatabaseConfig = z.object({
  url: z.string().startsWith('libsql://', 'a Turso URL, not an HTTP one'),
  authToken: z.string().min(1).optional(),
});

export type DatabaseConfig = z.infer<typeof DatabaseConfig>;

/** Validate caller-supplied config. Throws on a bad shape — fail at the edge. */
export function parseDatabaseConfig(input: unknown): DatabaseConfig {
  return DatabaseConfig.parse(input);
}
