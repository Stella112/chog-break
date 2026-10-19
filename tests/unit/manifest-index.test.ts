import { describe, expect, it } from 'vitest';
import { normalizeTraits } from '../../src/core/normalize';
import type { ChogRecord, RawAttribute } from '../../src/core/types';
import { buildManifest, searchChogs } from '../../src/data/manifest';

function chog(tokenId: number, n: number, attrs: RawAttribute[]): ChogRecord {
  return {
    tokenId,
    displayName: `CHOG #${n}`,
    displayNumber: n,
    tokenUri: '',
    image: '',
    attributes: attrs,
    traits: normalizeTraits(attrs).traits,
  };
}
const chogs = [
  chog(1, 1462, [
    { trait_type: 'Head', value: 'Crown' },
    { trait_type: 'Eyes', value: 'Purple laser' },
  ]),
  chog(2, 5, [{ trait_type: 'Head', value: 'Mon Cap' }]),
  chog(3, 77, [{ trait_type: 'Head', value: 'crown' }]),
];

describe('manifest index', () => {
  it('builds filters from data (normalized, counted)', () => {
    const m = buildManifest(chogs);
    const head = m.filters.find((f) => f.category === 'Head')!;
    expect(head.values[0]).toMatchObject({ value: 'crown', count: 2 });
  });
  it('searches by token ID, name number and name', () => {
    const m = buildManifest(chogs);
    expect(searchChogs(m, '1', {}).map((c) => c.tokenId)).toEqual([1]);
    expect(searchChogs(m, '#1462', {}).map((c) => c.tokenId)).toEqual([1]);
    expect(searchChogs(m, '77', {}).map((c) => c.tokenId)).toEqual([3]);
    expect(searchChogs(m, '', { Head: 'crown' }).map((c) => c.tokenId)).toEqual([1, 3]);
  });
  it('partial numbers list exact matches first, then prefixes', () => {
    const m = buildManifest(chogs);
    expect(searchChogs(m, '7', {}).map((c) => c.tokenId)).toEqual([3]); // #77
    expect(searchChogs(m, '14', {}).map((c) => c.tokenId)).toEqual([1]); // #1462
    expect(searchChogs(m, '5', {}).map((c) => c.tokenId)).toEqual([2]);
  });
  it('text matches trait values, not just names', () => {
    const m = buildManifest(chogs);
    expect(searchChogs(m, 'crown', {}).map((c) => c.tokenId)).toEqual([1, 3]);
    expect(searchChogs(m, 'LASER', {}).map((c) => c.tokenId)).toEqual([1]);
    expect(searchChogs(m, 'cap', { Head: 'mon cap' }).map((c) => c.tokenId)).toEqual([2]);
  });
  it('drops malformed records instead of crashing', () => {
    const m = buildManifest([...chogs, { tokenId: 'x' } as unknown as ChogRecord]);
    expect(m.chogs.length).toBe(3);
  });
});
