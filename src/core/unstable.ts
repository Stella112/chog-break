import { concat, keccak256, toHex, type Hex } from 'viem';

/** §D5: deterministic 5% of pairs. Not random, not lucky, not secure — just a fixed hash rule. */
export function unstableScore(pairKey: Hex): number {
  const h = keccak256(concat([toHex('CHOG_BREAK_UNSTABLE_V1'), pairKey]));
  return (parseInt(h.slice(2, 10), 16) >>> 0) % 1000;
}

export function isUnstable(pairKey: Hex): boolean {
  return unstableScore(pairKey) < 50;
}
