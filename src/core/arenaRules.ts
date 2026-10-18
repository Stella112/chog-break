// §D7 arena modifiers: from all four parents' Backgrounds + the tier/Unstable rule. Affect everyone.
import { concat, keccak256, toHex } from 'viem';
import { sfc32FromHex } from './rng';
import type { Mutant } from './splice';

export type ModifierId =
  | 'TOXIC_FLOOR'
  | 'SLIPPERY_FLOOR'
  | 'LOW_GRAVITY'
  | 'UNSTABLE_KNOCKBACK'
  | 'OVERCLOCK'
  | 'BOUNCY_FLOOR'
  | 'SHRINKING_STAGE'
  | 'METEOR_SHOWER'
  | 'COIN_RAIN'
  | 'GLITCH';

const BACKGROUND_SOURCES: [ModifierId, string[]][] = [
  ['TOXIC_FLOOR', ['radioactive']],
  ['SLIPPERY_FLOOR', ['aqua', 'aqua mint', 'aqua blue', 'deep aqua', 'deep blue', 'sky blue', 'royal blue', 'noble blue']],
  ['LOW_GRAVITY', ['mon', 'light purple', 'soft lavender', 'deep purple', 'supreme purple']],
  ['OVERCLOCK', ['lemon', 'lemon yellow', 'bright yellow', 'sunlight']],
  ['BOUNCY_FLOOR', ['rosie', 'coral pink', 'peach pink', 'rosy pink', 'rose pink', 'light magenta', 'magenta']],
  ['SHRINKING_STAGE', ['mint', 'fresh green', 'lime green']],
  ['METEOR_SHOWER', ['red sky', 'blood red', 'afternoon orange']],
  ['COIN_RAIN', ['gold']],
  ['GLITCH', ['none']],
];

/** Only implemented modifiers may ever be shown (§D7). P1 modifiers are added here when they exist. */
export const IMPLEMENTED_MODIFIERS: readonly ModifierId[] = [
  'TOXIC_FLOOR',
  'SLIPPERY_FLOOR',
  'LOW_GRAVITY',
  'UNSTABLE_KNOCKBACK',
  'OVERCLOCK',
  'BOUNCY_FLOOR',
  'SHRINKING_STAGE',
  'METEOR_SHOWER',
  'COIN_RAIN',
  'GLITCH',
];

export function backgroundModifier(bg: string): ModifierId | undefined {
  return BACKGROUND_SOURCES.find(([, vals]) => vals.includes(bg))?.[0];
}

export type ArenaRules = { modifiers: ModifierId[]; stable: boolean };

export function createArenaRules({
  mutants,
  implemented = IMPLEMENTED_MODIFIERS,
}: {
  mutants: [Mutant, Mutant];
  implemented?: readonly ModifierId[];
}): ArenaRules {
  const parents = mutants.flatMap((m) => [m.parents.lo, m.parents.hi]);
  const candidates = [...new Set(parents.map((p) => backgroundModifier(p.traits.Background)))]
    .filter((m): m is ModifierId => !!m && implemented.includes(m))
    .sort();

  // Order-independent seed from both pairKeys.
  const keys = mutants.map((m) => m.pairKey).sort();
  const rng = sfc32FromHex(keccak256(concat([keys[0]!, keys[1]!, toHex('arena')])));
  const pool = [...candidates];
  const modifiers: ModifierId[] = [];
  while (pool.length && modifiers.length < 2) modifiers.push(pool.splice(rng.int(pool.length), 1)[0]!);

  const highTier = parents.some((p) => p.traits.Tier === 'epic' || p.traits.Tier === 'legendary');
  if ((highTier || mutants.some((m) => m.unstable)) && implemented.includes('UNSTABLE_KNOCKBACK')) {
    modifiers.push('UNSTABLE_KNOCKBACK');
  }
  return { modifiers, stable: modifiers.length === 0 };
}
