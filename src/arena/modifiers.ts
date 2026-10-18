// §D7 arena modifiers. They affect everyone, including the player who brought them.
// Every modifier has a telegraph, a readable effect, counterplay, and no unavoidable instant death.
import type { ModifierId } from '../core/arenaRules';
import { IMPLEMENTED_MODIFIERS } from '../core/arenaRules';
import type { ArenaCtx, HitSpec } from './ctx';
import { STAGE } from './rules';

export type ModPhysics = { gravity: number; friction: number; kb: number; speed: number; bounce: boolean };

export function modifierPhysics(mods: readonly ModifierId[]): ModPhysics {
  return {
    gravity: mods.includes('LOW_GRAVITY') ? 0.7 : 1,
    friction: mods.includes('SLIPPERY_FLOOR') ? 0.3 : 1,
    kb: mods.includes('UNSTABLE_KNOCKBACK') ? 1.35 : 1,
    speed: mods.includes('OVERCLOCK') ? 1.2 : 1,
    bounce: mods.includes('BOUNCY_FLOOR'),
  };
}

/** Background modifiers GLITCH may cycle through (UNSTABLE KNOCKBACK and GLITCH itself excluded). */
const GLITCH_POOL = IMPLEMENTED_MODIFIERS.filter((m) => m !== 'GLITCH' && m !== 'UNSTABLE_KNOCKBACK');

export interface ModifierHost extends ArenaCtx {
  /** Live main-platform edges (SHRINKING STAGE moves them). */
  edges: { left: number; right: number };
  setMainEdges(left: number, right: number): void;
  spawnCoin(x: number): void;
  banner(text: string): void;
  applyModifiers(mods: ModifierId[]): void;
}

function lcg(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

const METEOR: HitSpec = { damage: 8, base: 300, scaling: 4, angleDeg: 70, hitstunMs: 340, hitstopMs: 70, kind: 'melee' };

/**
 * Runs the timed modifiers. `base` is what the match rolled; GLITCH swaps in one extra
 * implemented modifier every 20 s (announced with a banner).
 */
export class ModifierRuntime {
  private rand: () => number;
  private toxicNext = 0;
  private toxicStep = 0;
  private meteorNext = 0;
  private coinNext = 0;
  private glitchNext = 0;
  private glitchCurrent: ModifierId | null = null;
  private shrinkWarned = false;
  private static TOXIC_ORDER = [0, 2, 1, 3, 2, 0, 3, 1];

  constructor(
    private host: ModifierHost,
    private base: ModifierId[],
    seed: number,
  ) {
    this.rand = lcg(seed);
  }

  get active(): ModifierId[] {
    return this.glitchCurrent && !this.base.includes(this.glitchCurrent) ? [...this.base, this.glitchCurrent] : this.base;
  }

  private has(m: ModifierId) {
    return this.active.includes(m);
  }

  update(now: number, elapsedMs: number) {
    if (this.base.includes('GLITCH')) this.glitch(now);
    if (this.has('TOXIC_FLOOR')) this.toxicFloor(now);
    if (this.has('METEOR_SHOWER')) this.meteors(now);
    if (this.has('COIN_RAIN')) this.coins(now);
    if (this.has('SHRINKING_STAGE')) this.shrink(elapsedMs);
  }

  /** GLITCH: a random implemented modifier every 20 s. */
  private glitch(now: number) {
    if (!this.glitchNext) this.glitchNext = now + 5000;
    if (now < this.glitchNext) return;
    this.glitchNext = now + 20_000;
    const pool = GLITCH_POOL.filter((m) => m !== this.glitchCurrent);
    this.glitchCurrent = pool[Math.floor(this.rand() * pool.length)] ?? null;
    this.host.applyModifiers(this.active);
    this.host.banner(`GLITCH → ${(this.glitchCurrent ?? '').replace(/_/g, ' ')}`);
  }

  /** TOXIC FLOOR: a segment glows 1.5 s, then hurts (1 dmg / 0.5 s) for 3 s. Rotating. */
  private toxicFloor(now: number) {
    if (!this.toxicNext) this.toxicNext = now + 3000;
    if (now < this.toxicNext) return;
    this.toxicNext = now + 5000;
    const { left, right } = this.host.edges;
    const w = (right - left) / 4;
    const seg = ModifierRuntime.TOXIC_ORDER[this.toxicStep++ % ModifierRuntime.TOXIC_ORDER.length]!;
    this.host.spawnZone({ owner: null, x: left + seg * w, y: STAGE.mainY - 34, w, h: 34, kind: 'floor-toxic', durationMs: 3000, armMs: 1500, affects: 'all' });
  }

  /** METEOR SHOWER: a red target marks the landing spot 1.2 s before the rock hits (8 dmg). */
  private meteors(now: number) {
    if (!this.meteorNext) this.meteorNext = now + 4000;
    if (now < this.meteorNext) return;
    this.meteorNext = now + 3500;
    const { left, right } = this.host.edges;
    const x = left + 40 + this.rand() * (right - left - 80);
    this.host.spawnZone({ owner: null, x: x - 55, y: STAGE.mainY - 140, w: 110, h: 140, kind: 'meteor', durationMs: 120, armMs: 1200, affects: 'all', spec: METEOR, once: true });
  }

  /** COIN RAIN: coins fall from the top; grab one to heal 5%. */
  private coins(now: number) {
    if (!this.coinNext) this.coinNext = now + 5000;
    if (now < this.coinNext) return;
    this.coinNext = now + 6000;
    const { left, right } = this.host.edges;
    this.host.spawnCoin(left + 40 + this.rand() * (right - left - 80));
  }

  /** SHRINKING STAGE: warned at 57 s; from 60 s the main platform loses 120 px per side over 15 s. */
  private shrink(elapsedMs: number) {
    if (elapsedMs >= 57_000 && !this.shrinkWarned) {
      this.shrinkWarned = true;
      this.host.banner('STAGE SHRINKING');
    }
    if (elapsedMs < 60_000) return;
    const t = Math.min(1, (elapsedMs - 60_000) / 15_000);
    const cut = 120 * t;
    const { left } = this.host.edges;
    const nl = STAGE.mainLeft + cut;
    const nr = STAGE.mainRight - cut;
    if (Math.abs(nl - left) >= 2 || t === 1) this.host.setMainEdges(nl, nr);
  }
}
