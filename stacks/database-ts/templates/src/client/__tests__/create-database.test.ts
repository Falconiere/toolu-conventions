import { env } from 'cloudflare:test';
import { eq } from 'drizzle-orm';
import { expect, test } from 'vitest';
import { createDatabase } from '@/client/create-database';
import { profiles } from '@/schema/profiles-table';

// Real data, no mocks. These run inside workerd against the Turso database
// named in .dev.vars, which the pool loads as bindings. A mocked client would
// prove the mock works and hide every integration break — the exact failure
// mode CORE rule 6 exists for.
//
// The round-trip cleans up after itself, so the suite can run repeatedly
// against a shared development database instead of needing a fresh one.

test('rejects config that is not a Turso URL', () => {
  expect(() => createDatabase({ url: 'https://example.com' })).toThrow();
});

test('round-trips a row through the real database', async () => {
  const database = createDatabase({
    url: env.TURSO_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  });
  const id = `test-${crypto.randomUUID()}`;

  await database.insert(profiles).values({ id, displayName: 'round trip' });
  const found = await database.select().from(profiles).where(eq(profiles.id, id));

  expect(found).toHaveLength(1);
  expect(found[0]?.displayName).toBe('round trip');

  await database.delete(profiles).where(eq(profiles.id, id));
});
