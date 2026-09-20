import { describe, expect, test } from 'vitest';
import { classNames } from '@/utilities/class-names';

describe('classNames', () => {
  test('joins truthy strings with a space', () => {
    expect(classNames('a', 'b', 'c')).toBe('a b c');
  });

  test('drops false, null, and undefined', () => {
    expect(classNames('a', false, null, undefined, 'b')).toBe('a b');
  });

  test('returns an empty string when nothing is truthy', () => {
    expect(classNames(false, null, undefined)).toBe('');
  });

  test('supports conditional usage', () => {
    // Typed as boolean rather than literal true/false: a literal would make the
    // conditions statically known and the example would stop resembling real use.
    const state: { active: boolean; disabled: boolean } = { active: true, disabled: false };
    expect(classNames('base', state.active && 'active', state.disabled && 'disabled')).toBe(
      'base active',
    );
  });
});
