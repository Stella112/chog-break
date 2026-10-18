// Mutant genes → concrete fighter numbers (§D4). Pure: no Phaser, unit-tested.
import type { Mutant } from '../core/splice';
import type { AffinityGene, CloseGene, ElementGene, HeadGene, PhysicsGene, SpecialGene, TrinketGene } from '../core/genes';
import type { RecipeId } from '../core/recipes';

export type PhysicsProfile = {
  weight: number;
  speed: number;
  gravity: number;
  jump: number;
  friction: number;
  dashDistance: number;
  dashCooldown: number;
};

export const BALANCED: PhysicsProfile = { weight: 1, speed: 1, gravity: 1, jump: 1, friction: 1, dashDistance: 1, dashCooldown: 1 };

const PHYSICS: Record<PhysicsGene, Partial<PhysicsProfile>> = {
  HEAVY: { weight: 1.3, speed: 0.88 },
  FLOATY: { gravity: 0.8, jump: 1.1 },
  DASHER: { dashDistance: 1.4, dashCooldown: 0.7 },
  SLIPPERY: { friction: 0.4 },
  LIGHT: { weight: 0.8, speed: 1.15 },
  BALANCED: {},
};

/** Cooldowns (ms). Spec ranges: special 3–6 s, close 1.5–4 s. */
export const SPECIAL_CD: Record<SpecialGene, number> = {
  BEAM: 5000,
  BLINK: 3000,
  TEARS: 4000,
  LEECH: 4000,
  RAGE: 6000,
  CHAOS_ORB: 4000,
  SPIT: 3000,
};
export const CLOSE_CD: Record<CloseGene, number> = {
  PUKE: 3000,
  DROOL: 4000,
  BUBBLE: 4000,
  COIN_TOSS: 2500,
  HONK: 4000,
  HEADBUTT: 1500,
};

/** Beam colour from the real Eyes trait (§D4.1 "Colour from trait"). */
export function beamColor(eyesValue: string): number {
  if (eyesValue.includes('purple')) return 0xb35cff;
  if (eyesValue.includes('fire')) return 0xff7a1a;
  if (eyesValue.includes('green')) return 0x59ff6a;
  if (eyesValue.includes('cyan')) return 0x4ff0ff;
  return 0xff4fd8;
}

/**
 * Genes whose arena effect exists. §F Phase 4: an unimplemented gene falls back to its slot
 * default AND shows the default's name. Every gene is implemented, so the sets are complete;
 * shrinking one here is the single switch for a fallback.
 */
export const IMPLEMENTED = {
  special: new Set<SpecialGene>(['BEAM', 'BLINK', 'TEARS', 'SPIT', 'LEECH', 'RAGE', 'CHAOS_ORB']),
  head: new Set<HeadGene>(['ROYAL', 'WARP', 'LIGHTWEIGHT', 'STEADY', 'GUARD', 'HORNS']),
  close: new Set<CloseGene>(['PUKE', 'BUBBLE', 'COIN_TOSS', 'HEADBUTT', 'DROOL', 'HONK']),
  affinity: new Set<AffinityGene>(['UNDEAD', 'TOXIC', 'NORMAL', 'ANOMALY']),
  trinket: new Set<TrinketGene>(['SHIV', 'FWOG', 'PUMP', 'DUMP', 'REGEN', 'CHARM', 'NONE']),
  element: new Set<ElementGene>(['BURN', 'FROST', 'GUST', 'SMOKE', 'SHOCK', 'SHIELD', 'BLOOM', 'GLOW', 'NONE']),
};

export type FighterKit = {
  name: string;
  profile: PhysicsProfile;
  /** Multiplier on knockback this fighter receives (ROYAL 0.85, LIGHTWEIGHT 1.1). */
  kbTaken: number;
  special: SpecialGene;
  specialCd: number;
  close: CloseGene;
  closeCd: number;
  head: HeadGene;
  affinity: AffinityGene;
  trinket: TrinketGene;
  element: ElementGene;
  physics: PhysicsGene;
  recipe?: RecipeId;
  /** Jumps before the recovery (ESCAPE VELOCITY: 3). */
  maxJumps: number;
  beamColor: number;
  /** LASER SHOW: the other parent's laser colour for the second beam. */
  beamColor2: number;
  unstable: boolean;
  glitch: number;
};

export function buildKit(m: Mutant): FighterKit {
  const special = IMPLEMENTED.special.has(m.special) ? m.special : 'SPIT';
  const head = IMPLEMENTED.head.has(m.head) ? m.head : 'STEADY';
  const close = IMPLEMENTED.close.has(m.close) ? m.close : 'HEADBUTT';
  const affinity = IMPLEMENTED.affinity.has(m.affinity) ? m.affinity : 'NORMAL';
  const trinket = IMPLEMENTED.trinket.has(m.trinket) ? m.trinket : 'NONE';
  const element = IMPLEMENTED.element.has(m.element) ? m.element : 'NONE';

  const profile: PhysicsProfile = { ...BALANCED, ...PHYSICS[m.physics] };
  if (m.metal) profile.weight += 0.1; // §D4.6
  if (head === 'LIGHTWEIGHT') profile.speed *= 1.1;
  if (m.recipe?.id === 'BTC_MAXI') profile.speed *= 1.1;

  const kbTaken = head === 'ROYAL' ? 0.9 : head === 'LIGHTWEIGHT' ? 1.1 : 1;
  const anomaly = affinity === 'ANOMALY' ? 0.85 : 1;

  return {
    name: m.name,
    profile,
    kbTaken,
    special,
    specialCd: Math.round(SPECIAL_CD[special] * anomaly),
    close,
    closeCd: CLOSE_CD[close],
    head,
    affinity,
    trinket,
    element,
    physics: m.physics,
    recipe: m.recipe?.id,
    maxJumps: m.recipe?.id === 'ESCAPE_VELOCITY' ? 3 : 2,
    beamColor: beamColor(m.inherited.Eyes.value),
    beamColor2: beamColor(m.inherited.Eyes.from === m.lo ? m.parents.hi.traits.Eyes : m.parents.lo.traits.Eyes),
    unstable: m.unstable,
    glitch: m.visualRecipe.glitchIntensity,
  };
}

/** Phase 3 baseline kit (no abilities) — used by tests and as a safe default. */
export function baselineKit(name: string): FighterKit {
  return {
    name,
    profile: { ...BALANCED },
    kbTaken: 1,
    special: 'SPIT',
    specialCd: SPECIAL_CD.SPIT,
    close: 'HEADBUTT',
    closeCd: CLOSE_CD.HEADBUTT,
    head: 'STEADY',
    affinity: 'NORMAL',
    trinket: 'NONE',
    element: 'NONE',
    physics: 'BALANCED',
    maxJumps: 2,
    beamColor: 0xff4fd8,
    beamColor2: 0x4ff0ff,
    unstable: false,
    glitch: 0.15,
  };
}
