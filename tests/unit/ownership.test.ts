import { describe, expect, it } from 'vitest';
import type { Address } from 'viem';
import { findOwnedChogs, type OwnershipReader } from '../../src/chain/ownership';

const ME = '0x00000000000000000000000000000000000000aA' as Address;
const OTHER = '0x00000000000000000000000000000000000000bB' as Address;

/** Test-only fake chain: token → owner map. */
function fakeChain(owners: Record<number, Address>) {
  const calls = { balance: 0, multicall: 0, batchSizes: [] as number[] };
  const reader: OwnershipReader = {
    async readContract({ args }) {
      calls.balance++;
      return BigInt(Object.values(owners).filter((o) => o.toLowerCase() === args[0].toLowerCase()).length);
    },
    async multicall({ contracts }) {
      calls.multicall++;
      calls.batchSizes.push(contracts.length);
      return contracts.map((c) => {
        const id = Number(c.args[0]);
        const o = owners[id];
        return o ? { status: 'success' as const, result: o } : { status: 'failure' as const, error: new Error('nonexistent token') };
      });
    },
  };
  return { reader, calls };
}

const ids = Array.from({ length: 1969 }, (_, i) => i + 1);

describe('findOwnedChogs', () => {
  it('balance 0 → no scan at all', async () => {
    const { reader, calls } = fakeChain({ 5: OTHER });
    expect(await findOwnedChogs(reader, ME, ids)).toEqual([]);
    expect(calls.multicall).toBe(0);
  });

  it('finds exactly the owned tokens, in chunks of 250, and stops early', async () => {
    const { reader, calls } = fakeChain({ 3: ME, 260: ME, 400: OTHER, 1900: OTHER });
    const progress: number[] = [];
    const found = await findOwnedChogs(reader, ME, ids, (p) => progress.push(p.scanned));
    expect(found).toEqual([3, 260]);
    expect(calls.batchSizes).toEqual([250, 250]); // stopped after the second chunk: balance (2) reached
    expect(progress.at(-1)).toBe(500);
  });

  it('is case-insensitive on addresses and ignores failed ownerOf calls', async () => {
    const { reader } = fakeChain({ 1969: ME.toLowerCase() as Address });
    expect(await findOwnedChogs(reader, ME, ids)).toEqual([1969]);
  });
});
