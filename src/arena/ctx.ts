import type { AttackSpec } from './rules';
import type { Fighter } from './fighter';

/** Everything that can hurt: melee, projectiles, beams, zones, helpers. */
export type HitSpec = AttackSpec & {
  hitstunMs: number;
  hitstopMs: number;
  kind: 'melee' | 'projectile' | 'beam' | 'zone' | 'helper';
  /** KING BEAM: ignores BUBBLE and GUARD. */
  pierce?: boolean;
  /** Damage only (zones, auras). */
  noKnockback?: boolean;
  /** Extra stun without knockback (HONK). */
  stunMs?: number;
  /** Third punch of the combo (SHOCK, SKULL & BONES). */
  comboEnder?: boolean;
};

export type ZoneKind = 'puddle' | 'fire' | 'rune' | 'smoke' | 'toxic' | 'floor-toxic' | 'meteor' | 'bite';

export type ZoneOpts = {
  owner: Fighter | null;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: ZoneKind;
  durationMs: number;
  /** Delay before it becomes active (telegraph). */
  armMs?: number;
  /** Who it affects: the owner's opponents, or everyone (arena modifiers). */
  affects: 'opponent' | 'all';
  /** Custom hit (METEOR SHOWER) instead of the 1 dmg / 0.5 s tick. */
  spec?: HitSpec;
  /** Hit each fighter at most once (meteors). */
  once?: boolean;
};

export type ProjectileOpts = {
  owner: Fighter;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  radius: number;
  color: number;
  spec: HitSpec;
  lifeMs: number;
  /** CHAOS ORB: bounces with seeded random deflection. */
  bounces?: number;
  /** Called where it lands on a platform (TEARS puddles). */
  onLand?: (x: number, y: number) => void;
  shape?: 'circle' | 'coin' | 'tear';
};

/** The arena services a fighter or move may use. Implemented by ArenaScene. */
export interface ArenaCtx {
  now(): number;
  opponentOf(f: Fighter): Fighter;
  hit(attacker: Fighter | null, target: Fighter, spec: HitSpec, dir: 1 | -1): number;
  spawnProjectile(o: ProjectileOpts): void;
  spawnZone(o: ZoneOpts): void;
  spawnFrog(owner: Fighter): void;
  beam(owner: Fighter, opts: { y: number; color: number; width: number; spec: HitSpec; pierce: boolean; fireTrail: boolean }): void;
  fx(kind: 'burst' | 'ring' | 'text' | 'shake', x: number, y: number, color?: number, size?: number, text?: string): void;
  /** Visible swing arc in front of a fighter (punch, headbutt, horn charge). */
  slash(f: Fighter, reach: number, color: number, delayMs?: number): void;
  /** Growing glow at the eyes while a beam charges. */
  charge(f: Fighter, color: number, ms: number): void;
  sfx(kind: 'special' | 'close' | 'heal' | 'block' | 'zap' | 'honk' | 'warp'): void;
  /** Ground y under a point (main platform or a float), or null if none. */
  groundAt(x: number, y: number): number | null;
  mods: { gravity: number; friction: number; kb: number; speed: number; bounce: boolean };
  instant: boolean;
}
