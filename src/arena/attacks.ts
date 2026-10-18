import type { AttackSpec } from './rules';

// Base move set (Phase 3: identical for every fighter). Angles: 0 = straight ahead, 90 = straight up.
export type AttackDef = AttackSpec & {
  startupMs: number;
  activeMs: number;
  recoveryMs: number;
  /** Hitbox relative to the fighter centre, facing right. */
  box: { x: number; y: number; w: number; h: number };
  hitstunMs: number;
  hitstopMs: number;
};

export const ATTACKS = {
  punch1: { damage: 3, base: 160, scaling: 2.5, angleDeg: 20, startupMs: 50, activeMs: 70, recoveryMs: 90, box: { x: 52, y: -6, w: 56, h: 40 }, hitstunMs: 220, hitstopMs: 45 },
  punch2: { damage: 4, base: 180, scaling: 3, angleDeg: 25, startupMs: 50, activeMs: 70, recoveryMs: 110, box: { x: 54, y: -6, w: 60, h: 42 }, hitstunMs: 260, hitstopMs: 50 },
  punch3: { damage: 8, base: 360, scaling: 8, angleDeg: 38, startupMs: 90, activeMs: 90, recoveryMs: 240, box: { x: 58, y: -10, w: 70, h: 52 }, hitstunMs: 380, hitstopMs: 75 },
  dash: { damage: 5, base: 260, scaling: 5, angleDeg: 30, startupMs: 0, activeMs: 160, recoveryMs: 120, box: { x: 30, y: 0, w: 70, h: 60 }, hitstunMs: 300, hitstopMs: 55 },
} satisfies Record<string, AttackDef>;

export type AttackId = keyof typeof ATTACKS;
