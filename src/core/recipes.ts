// §D5 secret recipes. Order matters: if two match, the one listed first wins.
import type { NormalizedTraits } from './types';

type Slot = 'Eyes' | 'Head' | 'Mouth' | 'Body' | 'Base' | 'Accessory' | 'Aura';

export type RecipeTier = 'P0' | 'P1';
export type RecipeId =
  | 'KING_BEAM'
  | 'NUCLEAR_UNDEAD'
  | 'THE_NAKED_KING'
  | 'ARCHMAGE'
  | 'VOLATILITY'
  | 'FWOG_LORD'
  | 'ESCAPE_VELOCITY'
  | 'WILDFIRE'
  | 'LASER_SHOW'
  | 'GOLDEN_BULL'
  | 'BEAR_MARKET'
  | 'SKULL_AND_BONES'
  | 'SHARK_WEEK'
  | 'HONK_LORD'
  | 'DOUBLE_RAINBOW'
  | 'BTC_MAXI';

type Test = (t: NormalizedTraits) => boolean;
export type Recipe = {
  id: RecipeId;
  name: string;
  tier: RecipeTier;
  perk: string;
  /** Matches when one parent passes x and the other passes y (either order). */
  x: Test;
  y: Test;
  /** Slots forced to come from the parent that satisfied x / y, so the perk always has its genes. */
  pinX?: Slot;
  pinY?: Slot;
  /** Extra condition on the ordered pair (used by LASER_SHOW). */
  extra?: (a: NormalizedTraits, b: NormalizedTraits) => boolean;
};

const isLaser: Test = (t) => t.Eyes.includes('laser');
const isFireAura: Test = (t) => ['burning aura', 'fiery aura', 'fire'].includes(t.Aura);

export const RECIPES: readonly Recipe[] = [
  { id: 'KING_BEAM', pinX: 'Eyes', pinY: 'Head', name: 'KING BEAM', tier: 'P0', perk: 'Beam pierces and is 20% wider', x: isLaser, y: (t) => t.Head === 'crown' },
  { id: 'NUCLEAR_UNDEAD', pinX: 'Base', name: 'NUCLEAR UNDEAD', tier: 'P0', perk: 'Undead revive also releases a toxic burst', x: (t) => t.Base === 'skull', y: (t) => t.Base === 'radioactive' },
  { id: 'THE_NAKED_KING', pinX: 'Body', pinY: 'Head', name: 'THE NAKED KING', tier: 'P0', perk: 'Taunt (hold I 1 s) → 2 s super armor', x: (t) => t.Naked === 'yes', y: (t) => t.Head === 'crown' },
  { id: 'ARCHMAGE', pinX: 'Head', pinY: 'Body', name: 'ARCHMAGE', tier: 'P0', perk: 'Warp leaves a damaging rune', x: (t) => t.Head === 'wizard hat' || t.Head === 'wizard beanie', y: (t) => t.Body === 'wizard' || t.Body === 'wizard cape' },
  { id: 'VOLATILITY', name: 'VOLATILITY', tier: 'P0', perk: 'Grows/shrinks every 5 s', x: (t) => t.Accessory === 'green candle', y: (t) => t.Accessory === 'red candle' },
  { id: 'FWOG_LORD', pinX: 'Accessory', pinY: 'Eyes', name: 'FWOG LORD', tier: 'P0', perk: 'Two frog helpers', x: (t) => t.Accessory === 'fwog', y: (t) => t.Eyes === 'frog' },
  { id: 'ESCAPE_VELOCITY', pinX: 'Body', pinY: 'Head', name: 'ESCAPE VELOCITY', tier: 'P0', perk: 'Triple jump', x: (t) => t.Body === 'astro suit', y: (t) => t.Head === '10k tps cap' },
  { id: 'WILDFIRE', pinX: 'Aura', pinY: 'Eyes', name: 'WILDFIRE', tier: 'P0', perk: 'Beam leaves a fire trail', x: isFireAura, y: (t) => t.Eyes === 'fire laser' },
  { id: 'LASER_SHOW', pinX: 'Eyes', name: 'LASER SHOW', tier: 'P1', perk: 'Beam fires twice, both colours', x: isLaser, y: isLaser, extra: (a, b) => a.Eyes !== b.Eyes },
  { id: 'GOLDEN_BULL', pinX: 'Body', pinY: 'Accessory', name: 'GOLDEN BULL', tier: 'P1', perk: 'Dash has super armor', x: (t) => t.Body === 'golden armor', y: (t) => t.Accessory === 'green candle' },
  { id: 'BEAR_MARKET', pinX: 'Accessory', pinY: 'Mouth', name: 'BEAR MARKET', tier: 'P1', perk: "Opponent takes +5% damage while you're above 100%", x: (t) => t.Accessory === 'red candle', y: (t) => t.Mouth === 'sad' },
  { id: 'SKULL_AND_BONES', pinX: 'Base', pinY: 'Accessory', name: 'SKULL & BONES', tier: 'P1', perk: 'Combo ender launches upward', x: (t) => t.Base === 'skull', y: (t) => t.Accessory === 'knife' },
  { id: 'SHARK_WEEK', pinX: 'Body', pinY: 'Mouth', name: 'SHARK WEEK', tier: 'P1', perk: 'Drool puddle bites', x: (t) => t.Body === 'shark suit', y: (t) => t.Mouth === 'drooling' },
  { id: 'HONK_LORD', pinX: 'Mouth', pinY: 'Head', name: 'HONK LORD', tier: 'P1', perk: 'Honk stun +0.2 s', x: (t) => t.Mouth === 'clown mouth', y: (t) => t.Head === 'clown nose' },
  { id: 'DOUBLE_RAINBOW', pinX: 'Mouth', pinY: 'Head', name: 'DOUBLE RAINBOW', tier: 'P1', perk: 'Longer puke cone', x: (t) => t.Mouth === 'rainbow puke', y: (t) => t.Head === 'rainbow wig' },
  { id: 'BTC_MAXI', pinX: 'Eyes', pinY: 'Head', name: 'BTC MAXI', tier: 'P1', perk: '+10% speed', x: (t) => t.Eyes === 'btc glass', y: (t) => t.Head === 'btc cap' || t.Head === 'btc beanie' },
];

const matchesOrdered = (r: Recipe, x: NormalizedTraits, y: NormalizedTraits) =>
  r.x(x) && r.y(y) && (!r.extra || r.extra(x, y));

export function recipeMatches(r: Recipe, a: NormalizedTraits, b: NormalizedTraits): boolean {
  return matchesOrdered(r, a, b) || matchesOrdered(r, b, a);
}

/**
 * First matching recipe among the enabled tiers (P1 recipes stay off until their perks exist).
 * Call with (lo, hi) traits; `xIsLo` says which parent satisfied x (lo preferred when both orders match).
 */
export function findRecipe(
  lo: NormalizedTraits,
  hi: NormalizedTraits,
  tiers: readonly RecipeTier[] = ['P0'],
): { recipe: Recipe; xIsLo: boolean } | undefined {
  for (const recipe of RECIPES) {
    if (!tiers.includes(recipe.tier)) continue;
    if (matchesOrdered(recipe, lo, hi)) return { recipe, xIsLo: true };
    if (matchesOrdered(recipe, hi, lo)) return { recipe, xIsLo: false };
  }
  return undefined;
}
