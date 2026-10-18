// §D3/§D4: createMutant(A, B) — pure, order-independent, stable forever for CORE_VERSION 1.
import type { Hex } from 'viem';
import {
  accessoryGene,
  auraGene,
  baseGene,
  bodyGene,
  eyesGene,
  headGene,
  mouthGene,
  powerOf,
  type GeneSet,
} from './genes';
import { generateName } from './naming';
import { makePair } from './pair';
import { findRecipe, type Recipe, type RecipeTier } from './recipes';
import { streamFor } from './rng';
import { NONE, type NormalizedTraits } from './types';
import { isUnstable } from './unstable';

export const CORE_VERSION = 1;

export const INHERITED_SLOTS = ['Eyes', 'Head', 'Mouth', 'Body', 'Base', 'Accessory', 'Aura'] as const;
export type InheritedSlot = (typeof INHERITED_SLOTS)[number];

export type Parent = { tokenId: number; traits: NormalizedTraits };
export type Inherited = { value: string; from: number };

export type VisualRecipe = {
  /** Parent whose art is the base layer (A) and the inserted parent (B). */
  baseParent: number;
  insertParent: number;
  /** Which parent occupies the top half of the seam. */
  topParent: number;
  /** Seam height as a fraction of the canvas, 0.40–0.60. */
  seamY: number;
  /** Jagged seam: offsets in [-1, 1], scaled by the renderer. */
  seamJags: number[];
  /** Glitch band rows near the seam: [offsetFraction, heightFraction, shiftFraction]. */
  glitchBands: [number, number, number][];
  /** Hue shift in degrees, |x| ≤ 25. */
  hueShift: number;
  skins: [string, string];
  /** 0–1, from the parents' tiers. Visual only. */
  glitchIntensity: number;
  recipeId?: string;
  unstable: boolean;
  anomaly: boolean;
};

export type Mutant = GeneSet & {
  coreVersion: number;
  pairKey: Hex;
  lo: number;
  hi: number;
  name: string;
  experimentLabel: string;
  parents: { lo: Parent; hi: Parent };
  inherited: Record<InheritedSlot, Inherited>;
  naked: boolean;
  recipe?: { id: Recipe['id']; name: string; perk: string };
  unstable: boolean;
  power: number;
  visualRecipe: VisualRecipe;
};

const TIER_GLITCH: Record<string, number> = { common: 0.15, uncommon: 0.3, rare: 0.5, epic: 0.7, legendary: 0.9 };

export function createMutant({
  parentA,
  parentB,
  recipeTiers = ['P0', 'P1'],
}: {
  parentA: Parent;
  parentB: Parent;
  recipeTiers?: readonly RecipeTier[];
}): Mutant {
  const { lo, hi, pairKey } = makePair(parentA.tokenId, parentB.tokenId);
  const pLo = parentA.tokenId === lo ? parentA : parentB;
  const pHi = parentA.tokenId === lo ? parentB : parentA;

  const found = findRecipe(pLo.traits, pHi.traits, recipeTiers);
  const recipe = found?.recipe;

  // Inheritance: always draw one bit per slot (keeps the stream stable), then apply the recessive rule.
  const genes = streamFor(pairKey, 'genes');
  const inherited = {} as Record<InheritedSlot, Inherited>;
  for (const slot of INHERITED_SLOTS) {
    const bit = genes.bit();
    let chosen = bit === 0 ? pLo : pHi;
    const other = chosen === pLo ? pHi : pLo;
    if (chosen.traits[slot] === NONE && other.traits[slot] !== NONE) chosen = other;
    inherited[slot] = { value: chosen.traits[slot], from: chosen.tokenId };
  }
  // Recipes pin their ingredient slots to the parent that supplied them (bits above are still drawn).
  if (found) {
    const px = found.xIsLo ? pLo : pHi;
    const py = found.xIsLo ? pHi : pLo;
    if (found.recipe.pinX) inherited[found.recipe.pinX] = { value: px.traits[found.recipe.pinX], from: px.tokenId };
    if (found.recipe.pinY) inherited[found.recipe.pinY] = { value: py.traits[found.recipe.pinY], from: py.tokenId };
  }
  const bodyParent = inherited.Body.from === lo ? pLo : pHi;
  const naked = bodyParent.traits.Naked === 'yes';

  const geneSet: GeneSet = {
    special: eyesGene(inherited.Eyes.value),
    head: headGene(inherited.Head.value),
    close: mouthGene(inherited.Mouth.value),
    physics: bodyGene(inherited.Body.value, naked),
    affinity: baseGene(inherited.Base.value),
    trinket: accessoryGene(inherited.Accessory.value),
    element: auraGene(inherited.Aura.value),
    metal: pLo.traits.Skin === 'metal' || pHi.traits.Skin === 'metal',
  };

  const unstable = isUnstable(pairKey);
  const name = recipe ? recipe.name : generateName(streamFor(pairKey, 'name'), geneSet.special, geneSet.physics);

  const v = streamFor(pairKey, 'visual');
  const baseIsLo = v.bit() === 0;
  const topIsLo = v.bit() === 0;
  const seamY = 0.4 + v.next() * 0.2;
  const seamJags = Array.from({ length: 9 }, () => v.next() * 2 - 1);
  const glitchBands = Array.from({ length: 3 + v.int(3) }, (): [number, number, number] => [
    v.next() * 0.16 - 0.08,
    0.01 + v.next() * 0.03,
    v.next() * 0.1 - 0.05,
  ]);
  const hueShift = Math.round((v.next() * 50 - 25) * 10) / 10;
  const glitchIntensity = Math.max(TIER_GLITCH[pLo.traits.Tier] ?? 0.15, TIER_GLITCH[pHi.traits.Tier] ?? 0.15);

  return {
    coreVersion: CORE_VERSION,
    pairKey,
    lo,
    hi,
    name,
    experimentLabel: `EXPERIMENT #${lo}×${hi}`,
    parents: { lo: pLo, hi: pHi },
    inherited,
    naked,
    ...geneSet,
    recipe: recipe ? { id: recipe.id, name: recipe.name, perk: recipe.perk } : undefined,
    unstable,
    power: powerOf(geneSet, !!recipe),
    visualRecipe: {
      baseParent: baseIsLo ? lo : hi,
      insertParent: baseIsLo ? hi : lo,
      topParent: topIsLo ? lo : hi,
      seamY,
      seamJags,
      glitchBands,
      hueShift,
      skins: [pLo.traits.Skin, pHi.traits.Skin],
      glitchIntensity,
      recipeId: recipe?.id,
      unstable,
      anomaly: geneSet.affinity === 'ANOMALY',
    },
  };
}
