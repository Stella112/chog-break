import { keccak256, toHex } from 'viem';
import { sfc32FromHex } from './rng';

/** §D12 daily seed. The caller supplies the UTC date (core never reads the clock). */
export function dailySeed(utcDate: string): `0x${string}` {
  return keccak256(toHex(`CHOG_BREAK_DAILY_V1|${utcDate}`));
}

/** §D7 default opponent: a pair seeded by the UTC date, consistent for everyone that day. */
export function dailyOpponentPair(utcDate: string, validIds: readonly number[]): [number, number] {
  const rng = sfc32FromHex(dailySeed(utcDate));
  const a = validIds[rng.int(validIds.length)]!;
  let b = validIds[rng.int(validIds.length)]!;
  if (b === a) b = validIds[(validIds.indexOf(a) + 1) % validIds.length]!;
  return [a, b];
}

export function utcDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}
