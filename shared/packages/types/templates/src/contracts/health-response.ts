/** The example contract. Replace it with your own, or add beside it. */
import * as z from 'zod';

// One schema per concern, its type inferred rather than hand-written beside
// it — a declared interface next to the real thing is a second source of
// truth that drifts the first time a field changes.
export const HealthResponse = z.object({
  status: z.enum(['ok', 'degraded', 'down']),
  checkedAt: z.iso.datetime(),
});

export type HealthResponse = z.infer<typeof HealthResponse>;

/** Validate a caller-supplied payload. Throws on a bad shape — fail at the edge. */
export function parseHealthResponse(input: unknown): HealthResponse {
  return HealthResponse.parse(input);
}
