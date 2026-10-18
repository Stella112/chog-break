import { concat, keccak256, toHex, type Hex } from 'viem';

export type Rng = {
  /** uniform float in [0, 1) */
  next(): number;
  /** integer in [0, n) */
  int(n: number): number;
  bit(): 0 | 1;
  pick<T>(items: readonly T[]): T;
};

export type StreamLabel = 'genes' | 'name' | 'visual' | 'arena';

/** sfc32 seeded with four big-endian uint32 from the first 16 bytes of `seed` (§D3). */
export function sfc32FromHex(seed: Hex): Rng {
  const words = [0, 1, 2, 3].map((i) => parseInt(seed.slice(2 + i * 8, 10 + i * 8), 16) >>> 0);
  let [a, b, c, d] = words as [number, number, number, number];
  const nextU32 = () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return t >>> 0;
  };
  // Discard the first outputs so similar seeds diverge.
  for (let i = 0; i < 12; i++) nextU32();
  const next = () => nextU32() / 4294967296;
  return {
    next,
    int: (n) => Math.floor(next() * n),
    bit: () => (nextU32() & 1) as 0 | 1,
    pick: (items) => {
      if (items.length === 0) throw new Error('pick from empty list');
      return items[Math.floor(next() * items.length)]!;
    },
  };
}

/** seedFor(label) = keccak256(concat(pairKey, toHex(label))) */
export function seedFor(pairKey: Hex, label: StreamLabel): Hex {
  return keccak256(concat([pairKey, toHex(label)]));
}

export function streamFor(pairKey: Hex, label: StreamLabel): Rng {
  return sfc32FromHex(seedFor(pairKey, label));
}
