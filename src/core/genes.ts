// §D4: real traits → gameplay genes. Matching is on normalized values only.
import { NONE } from './types';

export const SPECIALS = ['BEAM', 'BLINK', 'TEARS', 'LEECH', 'RAGE', 'CHAOS_ORB', 'SPIT'] as const;
export const HEADS = ['ROYAL', 'GUARD', 'WARP', 'HORNS', 'LIGHTWEIGHT', 'STEADY'] as const;
export const CLOSES = ['PUKE', 'DROOL', 'BUBBLE', 'COIN_TOSS', 'HONK', 'HEADBUTT'] as const;
export const PHYSICS = ['HEAVY', 'FLOATY', 'DASHER', 'SLIPPERY', 'LIGHT', 'BALANCED'] as const;
export const AFFINITIES = ['UNDEAD', 'TOXIC', 'ANOMALY', 'NORMAL'] as const;
export const TRINKETS = ['SHIV', 'FWOG', 'PUMP', 'DUMP', 'REGEN', 'CHARM', 'NONE'] as const;
export const ELEMENTS = ['BURN', 'FROST', 'GUST', 'SMOKE', 'SHOCK', 'SHIELD', 'BLOOM', 'GLOW', 'NONE'] as const;

export type SpecialGene = (typeof SPECIALS)[number];
export type HeadGene = (typeof HEADS)[number];
export type CloseGene = (typeof CLOSES)[number];
export type PhysicsGene = (typeof PHYSICS)[number];
export type AffinityGene = (typeof AFFINITIES)[number];
export type TrinketGene = (typeof TRINKETS)[number];
export type ElementGene = (typeof ELEMENTS)[number];

const set = (...v: string[]) => new Set(v);

const BLINK_EYES = set('gradient visor', 'sunset visor', 'plasma visor', 'modern vr', 'classic vr', 'anime glass', 'retro glass', '3d glass', 'btc glass', 'thug');
const TEARS_EYES = set('round crying', 'round tear', 'closed eye crying', 'teary');
const RAGE_EYES = set('angry', 'mog', 'chog viper');
const CHAOS_EYES = set('dead', 'xd', 'clown eye', 'clown eye mix');

export function eyesGene(v: string): SpecialGene {
  if (v.includes('laser')) return 'BEAM';
  if (BLINK_EYES.has(v)) return 'BLINK';
  if (TEARS_EYES.has(v)) return 'TEARS';
  if (v === 'heart') return 'LEECH';
  if (RAGE_EYES.has(v)) return 'RAGE';
  if (CHAOS_EYES.has(v) || v.includes('retard')) return 'CHAOS_ORB';
  return 'SPIT';
}

const ROYAL_HEADS = set('crown', 'silver wreath', 'gold thorn', 'silver thorn', 'holy seal', 'diamond');
const GUARD_HEADS = set('spartan helmet', 'plumber', 'robber', 'mafia hat');
const WARP_HEADS = set('wizard hat', 'wizard beanie', '3rd eye');
const HORN_HEADS = set('red horn', 'demon horn', 'purple horn', 'void horn', 'devil horn', 'horny cap');

export function headGene(v: string): HeadGene {
  if (v === NONE) return 'LIGHTWEIGHT';
  if (ROYAL_HEADS.has(v)) return 'ROYAL';
  if (GUARD_HEADS.has(v)) return 'GUARD';
  if (WARP_HEADS.has(v)) return 'WARP';
  if (HORN_HEADS.has(v)) return 'HORNS';
  return 'STEADY';
}

export function mouthGene(v: string): CloseGene {
  if (v === 'rainbow puke') return 'PUKE';
  if (v === 'drooling') return 'DROOL';
  if (v === 'bubblegum') return 'BUBBLE';
  if (v === 'gold tooth' || v === 'btc coin' || v === 'mon coin') return 'COIN_TOSS';
  if (v === 'clown mouth') return 'HONK';
  return 'HEADBUTT';
}

const HEAVY_BODIES = set('golden armor', 'mummy', 'kings robe', 'wizard', 'wizard cape', 'jesus', 'jesus robe');

export function bodyGene(v: string, naked: boolean): PhysicsGene {
  if (v === NONE || naked) return 'LIGHT';
  if (HEAVY_BODIES.has(v)) return 'HEAVY';
  if (v === 'astro suit' || v === 'sci fi') return 'FLOATY';
  if (v === 'shark suit' || v === 'dragon suit') return 'DASHER';
  if (v === 'banana suit' || v === 'duck float') return 'SLIPPERY';
  return 'BALANCED';
}

export function baseGene(v: string): AffinityGene {
  if (v === 'skull') return 'UNDEAD';
  if (v === 'radioactive') return 'TOXIC';
  if (v === '1:1') return 'ANOMALY';
  return 'NORMAL';
}

export function accessoryGene(v: string): TrinketGene {
  if (v === NONE) return 'NONE';
  if (v === 'knife') return 'SHIV';
  if (v === 'fwog') return 'FWOG';
  if (v === 'green candle') return 'PUMP';
  if (v === 'red candle') return 'DUMP';
  if (v === 'heart') return 'REGEN';
  return 'CHARM';
}

export function auraGene(v: string): ElementGene {
  if (v === NONE) return 'NONE';
  if (v === 'burning aura' || v === 'fiery aura' || v === 'fire') return 'BURN';
  if (v === 'aqua aura' || v === 'cool aura') return 'FROST';
  if (v === 'wind') return 'GUST';
  if (v === 'smoke') return 'SMOKE';
  if (v === 'electric shock' || v === 'yellow aura') return 'SHOCK';
  if (v === 'royal aura' || v === 'royal blue aura' || v === 'royal blue') return 'SHIELD';
  if (v === 'rose aura' || v === 'rose scent' || v === 'pink mist') return 'BLOOM';
  return 'GLOW';
}

// §D4.9 power budget. Specials and close moves are "one move each", so all sit at 0;
// passives that add an edge are +1, LIGHT (fragile) is −1. Recipe perks add +1.
// Max = head 1 + affinity 1 + trinket 1 + element 1 + recipe 1 = 5; min = −1.
export const POWER = {
  special: Object.fromEntries(SPECIALS.map((g) => [g, 0])) as Record<SpecialGene, number>,
  head: { ROYAL: 1, GUARD: 1, WARP: 1, HORNS: 1, LIGHTWEIGHT: 0, STEADY: 0 } satisfies Record<HeadGene, number>,
  close: Object.fromEntries(CLOSES.map((g) => [g, 0])) as Record<CloseGene, number>,
  physics: { HEAVY: 0, FLOATY: 0, DASHER: 0, SLIPPERY: 0, LIGHT: -1, BALANCED: 0 } satisfies Record<PhysicsGene, number>,
  affinity: { UNDEAD: 1, TOXIC: 1, ANOMALY: 1, NORMAL: 0 } satisfies Record<AffinityGene, number>,
  trinket: { SHIV: 1, FWOG: 1, PUMP: 1, DUMP: 1, REGEN: 1, CHARM: 0, NONE: 0 } satisfies Record<TrinketGene, number>,
  element: { BURN: 1, FROST: 1, GUST: 1, SMOKE: 1, SHOCK: 1, SHIELD: 1, BLOOM: 1, GLOW: 0, NONE: 0 } satisfies Record<ElementGene, number>,
  metal: 0,
  recipe: 1,
} as const;

export const POWER_MIN = -2;
export const POWER_MAX = 5;

export type GeneSet = {
  special: SpecialGene;
  head: HeadGene;
  close: CloseGene;
  physics: PhysicsGene;
  affinity: AffinityGene;
  trinket: TrinketGene;
  element: ElementGene;
  metal: boolean;
};

export function powerOf(g: GeneSet, hasRecipe: boolean): number {
  return (
    POWER.special[g.special] +
    POWER.head[g.head] +
    POWER.close[g.close] +
    POWER.physics[g.physics] +
    POWER.affinity[g.affinity] +
    POWER.trinket[g.trinket] +
    POWER.element[g.element] +
    (g.metal ? POWER.metal : 0) +
    (hasRecipe ? POWER.recipe : 0)
  );
}
