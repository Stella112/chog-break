import { encodeAbiParameters, keccak256, type Hex } from 'viem';
import { CHOG_GENESIS } from '../config/chain';

export type Pair = { lo: number; hi: number; pairKey: Hex };

export class PairError extends Error {}

/** §D3: order-independent pair. Throws PairError with a player-facing message. */
export function makePair(a: number, b: number): Pair {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 1 || b < 1) {
    throw new PairError('That is not a valid Chog token ID.');
  }
  if (a === b) throw new PairError("A Chog can't be spliced with itself.");
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return { lo, hi, pairKey: pairKeyOf(lo, hi) };
}

/** keccak256(abi.encode(address CHOG_GENESIS, uint256 lo, uint256 hi)) — must equal the contract. */
export function pairKeyOf(lo: number, hi: number): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: 'address' }, { type: 'uint256' }, { type: 'uint256' }],
      [CHOG_GENESIS, BigInt(lo), BigInt(hi)],
    ),
  );
}
