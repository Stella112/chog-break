// §D7 pure combat rules — no Phaser, unit-tested.

export const STAGE = {
  width: 1280,
  height: 720,
  mainY: 560,
  mainLeft: 240,
  mainRight: 1040,
  /** Pass-through floating platforms: [x, y, width]. */
  floats: [
    [330, 420, 200],
    [750, 420, 200],
    [540, 290, 200],
  ] as [number, number, number][],
  /** Kill zones: 200 px beyond the sides and top, and below the stage. */
  blast: { left: -200, right: 1480, top: -200, bottom: 920 },
};

export const MATCH = {
  lives: 2,
  durationMs: 120_000,
  respawnInvulnMs: 2000,
  suddenDeathDamage: 150,
};

export type AttackSpec = { damage: number; base: number; scaling: number; angleDeg: number };

export const KNOCKBACK = {
  cap: 2600,
  /** Global multiplier mapping formula units → px/s. Tuned 1 → 1.2: bot-vs-bot lost 0.85 lives per 120 s at 1.0, 1.55 at 1.1. */
  unit: 1.2,
};

/**
 * knockback = (base × attackPower + damage% × scaling) × modifiers ÷ weight, capped.
 * `damagePct` is the target's damage AFTER the hit lands.
 */
export function knockback(atk: AttackSpec, damagePct: number, weight: number, modifiers = 1, attackPower = 1): number {
  const raw = ((atk.base * attackPower + damagePct * atk.scaling) * modifiers) / weight;
  return Math.min(KNOCKBACK.cap, raw * KNOCKBACK.unit);
}

export function knockbackVector(force: number, angleDeg: number, facing: 1 | -1): { vx: number; vy: number } {
  const a = (angleDeg * Math.PI) / 180;
  return { vx: Math.cos(a) * force * facing, vy: -Math.sin(a) * force };
}

export type FighterScore = {
  lives: number;
  damage: number;
  kos: number;
  damageDealt: number;
  /** True while waiting to respawn — guards against double KO from the same exit. */
  koPending: boolean;
};

export function newScore(lives = MATCH.lives): FighterScore {
  return { lives, damage: 0, kos: 0, damageDealt: 0, koPending: false };
}

/**
 * Handles a blast-zone exit. Returns true only for the first call per life,
 * so a fighter lingering outside the zone loses exactly one life.
 */
export function applyKO(victim: FighterScore, attacker: FighterScore | null): boolean {
  if (victim.koPending || victim.lives <= 0) return false;
  victim.koPending = true;
  victim.lives -= 1;
  if (attacker) attacker.kos += 1;
  return true;
}

/** Called when the fighter is placed back on stage. */
export function respawn(s: FighterScore) {
  s.koPending = false;
  s.damage = 0;
}

export function isOutside(x: number, y: number): boolean {
  const b = STAGE.blast;
  return x < b.left || x > b.right || y < b.top || y > b.bottom;
}

export type MatchOutcome = { over: false } | { over: true; winner: 0 | 1 | null; reason: 'stocks' | 'time' } | { over: false; suddenDeath: true };

/** §D7: lives out → winner. Time out → more lives, then lower damage, else sudden death. */
export function resolveMatch(scores: [FighterScore, FighterScore], elapsedMs: number, suddenDeath: boolean): MatchOutcome {
  const [a, b] = scores;
  if (a.lives <= 0 || b.lives <= 0) return { over: true, winner: a.lives > 0 ? 0 : b.lives > 0 ? 1 : null, reason: 'stocks' };
  if (suddenDeath || elapsedMs < MATCH.durationMs) return { over: false };
  if (a.lives !== b.lives) return { over: true, winner: a.lives > b.lives ? 0 : 1, reason: 'time' };
  if (Math.round(a.damage) !== Math.round(b.damage)) return { over: true, winner: a.damage < b.damage ? 0 : 1, reason: 'time' };
  return { over: false, suddenDeath: true };
}
