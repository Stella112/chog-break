import { describe, expect, it } from 'vitest';
import { normalizeTraits, normalizeValue, parseDisplayNumber } from '../../src/core/normalize';
import { NONE } from '../../src/core/types';

describe('normalize', () => {
  it('trims and lowercases values', () => {
    expect(normalizeValue('  Purple laser ')).toBe('purple laser');
    expect(normalizeValue('fire laser')).toBe('fire laser');
  });
  it('maps absent categories to none and flags unknown ones', () => {
    const { traits, unknownCategories } = normalizeTraits([
      { trait_type: 'Base', value: '1:1' },
      { trait_type: 'Tier', value: 'Legendary' },
      { trait_type: 'Hat', value: 'x' },
    ]);
    expect(traits.Base).toBe('1:1');
    expect(traits.Tier).toBe('legendary');
    expect(traits.Eyes).toBe(NONE);
    expect(unknownCategories).toEqual(['Hat']);
  });
  it('parses display number but it is not the token id', () => {
    expect(parseDisplayNumber('CHOG #1462')).toBe(1462);
    expect(parseDisplayNumber('weird')).toBeNull();
  });
});
