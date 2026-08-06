import { env } from 'cloudflare:test';
import { eq } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';
import { createDatabase } from '@/client/create-database';
import { profiles } from '@/schema/profiles-table';

// Real data, no mocks. The round-trip runs inside workerd against the Turso
// database named in .dev.vars, which the pool loads as bindings. A mocked
// client would prove the mock works and hide every integration break — the
// exact failure mode CORE rule 7 exists for.

describe('config validation', () => {
  test('rejects a URL that is not libsql://', () => {
    expect(() => createDatabase({ url: 'https://example.com' })).toThrow();
  });

  test('rejects a missing url outright', () => {
    expect(() => createDatabase({})).toThrow();
  });

  test('accepts a well-formed config, with and without a token', () => {
    expect(() => createDatabase({ url: 'libsql://example.turso.io' })).not.toThrow();
    expect(() =>
      createDatabase({ url: 'libsql://example.turso.io', authToken: 'token' }),
    ).not.toThrow();
  });
});

// SKIPPED, not mocked, when there are no credentials. A fresh scaffold has no
// .dev.vars yet — filling it is on the human checklist — and `bun run check`
// has to be runnable before that, or the gate blocks the setup that would make
// it pass. Skipping says so out loud; a mock would report green over a database
// nobody reached.
const hasCredentials = Boolean(env.TURSO_URL);

describe.skipIf(!hasCredentials)('against the real database', () => {
  test('round-trips a row', async () => {
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
});
