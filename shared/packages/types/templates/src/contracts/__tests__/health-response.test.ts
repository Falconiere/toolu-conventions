import { describe, expect, test } from 'vitest';
import { parseHealthResponse } from '@/contracts/health-response';

// Real inputs, no mocks: a zod schema is exercised by parsing values, not by
// stubbing a collaborator.

describe('parseHealthResponse', () => {
  test('accepts a well-formed payload', () => {
    const parsed = parseHealthResponse({
      status: 'ok',
      checkedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(parsed.status).toBe('ok');
    expect(parsed.checkedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  test('rejects a status outside the enum', () => {
    expect(() =>
      parseHealthResponse({ status: 'unknown', checkedAt: '2026-01-01T00:00:00.000Z' }),
    ).toThrow();
  });

  test('rejects a non-ISO checkedAt', () => {
    expect(() => parseHealthResponse({ status: 'ok', checkedAt: 'not-a-date' })).toThrow();
  });

  test('rejects a missing field outright', () => {
    expect(() => parseHealthResponse({ status: 'ok' })).toThrow();
  });
});
