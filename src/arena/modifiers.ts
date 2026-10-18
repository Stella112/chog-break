// §D7 P0 arena modifiers. They affect everyone, including the player who brought them.
import type { ModifierId } from '../core/arenaRules';
import type { ArenaCtx } from './ctx';
import { STAGE } from './rules';

export function modifierPhysics(mods: readonly ModifierId[]) {
  return {
    gravity: mods.includes('LOW_GRAVITY') ? 0.7 : 1,
    friction: mods.includes('SLIPPERY_FLOOR') ? 0.3 : 1,
    kb: mods.includes('UNSTABLE_KNOCKBACK') ? 1.35 : 1,
  };
}

/**
 * TOXIC FLOOR: the main platform is split into 4 segments. Every 5 s one segment glows
 * (1.5 s telegraph), then hurts anyone standing on it (1 dmg / 0.5 s) for 3 s. Rotating.
 * Counterplay: step off the glowing segment or stand on a floating platform.
 */
export class ToxicFloor {
  private nextAt = 0;
  private step = 0;
  private static ORDER = [0, 2, 1, 3, 2, 0, 3, 1];
  constructor(private ctx: ArenaCtx) {}

  update(now: number) {
    if (!this.nextAt) this.nextAt = now + 3000;
    if (now < this.nextAt) return;
    this.nextAt = now + 5000;
    const w = (STAGE.mainRight - STAGE.mainLeft) / 4;
    const seg = ToxicFloor.ORDER[this.step++ % ToxicFloor.ORDER.length]!;
    const x = STAGE.mainLeft + seg * w;
    this.ctx.spawnZone({ owner: null, x, y: STAGE.mainY - 34, w, h: 34, kind: 'floor-toxic', durationMs: 3000, armMs: 1500, affects: 'all' });
  }
}
