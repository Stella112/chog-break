import { keccak256 } from 'viem';
import { describe, expect, it } from 'vitest';
import { createArenaRules } from '../../src/core/arenaRules';
import {
  AFFINITIES,
  CLOSES,
  ELEMENTS,
  HEADS,
  PHYSICS,
  POWER_MAX,
  POWER_MIN,
  SPECIALS,
  TRINKETS,
  powerOf,
} from '../../src/core/genes';
import { NOUNS, PREFIXES } from '../../src/core/naming';
import { PairError, makePair, pairKeyOf } from '../../src/core/pair';
import { RECIPES, recipeMatches } from '../../src/core/recipes';
import { sfc32FromHex, streamFor } from '../../src/core/rng';
import { createMutant, type Parent } from '../../src/core/splice';
import { NONE, TRAIT_CATEGORIES, type NormalizedTraits } from '../../src/core/types';
import { isUnstable } from '../../src/core/unstable';
import vectors from '../fixtures/pairkey-vectors.json';

// Synthetic parents from §C3 value pools (test-only). Real-manifest checks live in manifest.test.ts.
const POOLS: Record<string, string[]> = {
  Background: ['light purple', 'aqua', 'radioactive', 'mon', 'lemon', NONE],
  Base: ['origin', 'skull', 'radioactive', '1:1'],
  Skin: ['pink', 'metal', 'red', NONE],
  Side: ['right', 'left'],
  Body: ['tuxedo', 'golden armor', 'astro suit', 'shark suit', 'banana suit', 'wizard', NONE],
  Mouth: ['smile', 'rainbow puke', 'drooling', 'bubblegum', 'gold tooth', 'clown mouth', 'sad', NONE],
  Eyes: ['happy', 'purple laser', 'fire laser', 'gradient visor', 'teary', 'heart', 'angry', 'dead', 'frog', NONE],
  Head: ['mon cap', 'crown', 'spartan helmet', 'wizard hat', 'red horn', '10k tps cap', NONE],
  Accessory: [NONE, NONE, 'knife', 'fwog', 'green candle', 'red candle', 'heart', 'cigar'],
  Aura: [NONE, 'burning aura', 'aqua aura', 'wind', 'smoke', 'electric shock', 'royal aura', 'rose aura', 'purple'],
  Form: ['chog', 'skull'],
  Tier: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
  Naked: ['no', 'yes'],
};
const rng = sfc32FromHex(keccak256('0x01'));
function randomParent(tokenId: number): Parent {
  const traits = Object.fromEntries(TRAIT_CATEGORIES.map((c) => [c, rng.pick(POOLS[c]!)])) as NormalizedTraits;
  return { tokenId, traits };
}
function randomPair(): [Parent, Parent] {
  const a = 1 + rng.int(1969);
  let b = 1 + rng.int(1969);
  if (b === a) b = (a % 1969) + 1;
  return [randomParent(a), randomParent(b)];
}

describe('pair', () => {
  it('is order-independent and rejects self-splice', () => {
    expect(makePair(1053, 88)).toEqual(makePair(88, 1053));
    expect(() => makePair(5, 5)).toThrow(PairError);
    expect(() => makePair(0, 5)).toThrow(PairError);
  });
  it('matches the shared pairKey vectors', () => {
    expect(vectors.vectors.length).toBeGreaterThanOrEqual(6);
    for (const v of vectors.vectors) expect(pairKeyOf(v.lo, v.hi)).toBe(v.pairKey);
  });
});

describe('rng', () => {
  it('is deterministic and streams are independent', () => {
    const k = pairKeyOf(1, 2);
    const a = streamFor(k, 'genes');
    const b = streamFor(k, 'genes');
    const seqA = Array.from({ length: 5 }, () => a.next());
    expect(Array.from({ length: 5 }, () => b.next())).toEqual(seqA);
    const n = streamFor(k, 'name');
    expect(Array.from({ length: 5 }, () => n.next())).not.toEqual(seqA);
    for (const x of seqA) expect(x >= 0 && x < 1).toBe(true);
  });
});

describe('createMutant', () => {
  it('createMutant(A,B) deep-equals createMutant(B,A) for 1,000 seeded pairs', () => {
    for (let i = 0; i < 1000; i++) {
      const [a, b] = randomPair();
      expect(createMutant({ parentA: a, parentB: b })).toEqual(createMutant({ parentA: b, parentB: a }));
    }
  });
  it('recessive rule: a none slot inherits the other parent value', () => {
    const a = randomParent(10);
    const b = randomParent(20);
    a.traits.Head = NONE;
    b.traits.Head = 'crown';
    expect(createMutant({ parentA: a, parentB: b }).inherited.Head).toEqual({ value: 'crown', from: 20 });
  });
  it('tier never changes stats', () => {
    for (let i = 0; i < 200; i++) {
      const [a, b] = randomPair();
      const base = createMutant({ parentA: a, parentB: b });
      for (const tier of POOLS.Tier!) {
        const m = createMutant({ parentA: { ...a, traits: { ...a.traits, Tier: tier } }, parentB: b });
        const strip = (x: typeof m) => ({ ...x, parents: null, visualRecipe: null });
        expect(strip(m)).toEqual(strip(base));
      }
    }
  });
  it('v2 (P-1): the parent that gave the Head is the top half of the art', () => {
    let checked = 0;
    for (let i = 0; i < 1000; i++) {
      const [a, b] = randomPair();
      const m = createMutant({ parentA: a, parentB: b });
      expect(m.coreVersion).toBe(2);
      if (m.inherited.Head.value !== NONE) {
        expect(m.visualRecipe.topParent).toBe(m.inherited.Head.from);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(500);
  });
  it('v1 stays reproducible and differs from v2 only in topParent', () => {
    let differs = 0;
    for (let i = 0; i < 300; i++) {
      const [a, b] = randomPair();
      const v1 = createMutant({ parentA: a, parentB: b, version: 1 });
      const v2 = createMutant({ parentA: a, parentB: b });
      expect(v1).toEqual(createMutant({ parentA: b, parentB: a, version: 1 }));
      expect({ ...v1, coreVersion: 0, visualRecipe: { ...v1.visualRecipe, topParent: 0 } }).toEqual({
        ...v2,
        coreVersion: 0,
        visualRecipe: { ...v2.visualRecipe, topParent: 0 },
      });
      if (v1.visualRecipe.topParent !== v2.visualRecipe.topParent) differs++;
    }
    expect(differs).toBeGreaterThan(0);
  });
  it('stays inside visual bounds', () => {
    for (let i = 0; i < 300; i++) {
      const [a, b] = randomPair();
      const v = createMutant({ parentA: a, parentB: b }).visualRecipe;
      expect(v.seamY).toBeGreaterThanOrEqual(0.4);
      expect(v.seamY).toBeLessThanOrEqual(0.6);
      expect(Math.abs(v.hueShift)).toBeLessThanOrEqual(25);
      expect(v.baseParent).not.toBe(v.insertParent);
    }
  });
});

describe('power budget (§D4.9)', () => {
  it('every gene combination stays in [-2, +5]', { timeout: 60_000 }, () => {
    let n = 0;
    let lo = Infinity;
    let hi = -Infinity;
    for (const special of SPECIALS)
      for (const head of HEADS)
        for (const close of CLOSES)
          for (const physics of PHYSICS)
            for (const affinity of AFFINITIES)
              for (const trinket of TRINKETS)
                for (const element of ELEMENTS)
                  for (const metal of [false, true])
                    for (const recipe of [false, true]) {
                      const p = powerOf({ special, head, close, physics, affinity, trinket, element, metal }, recipe);
                      if (p < lo) lo = p;
                      if (p > hi) hi = p;
                      n++;
                    }
    expect(lo).toBeGreaterThanOrEqual(POWER_MIN);
    expect(hi).toBeLessThanOrEqual(POWER_MAX);
    expect(n).toBe(7 * 6 * 6 * 6 * 4 * 7 * 9 * 2 * 2);
  });
});

describe('recipes', () => {
  it('detection is order-independent', () => {
    for (let i = 0; i < 1000; i++) {
      const [a, b] = randomPair();
      for (const r of RECIPES) expect(recipeMatches(r, a.traits, b.traits)).toBe(recipeMatches(r, b.traits, a.traits));
    }
  });
  it('KING BEAM overrides the name', () => {
    const a = randomParent(1);
    const b = randomParent(2);
    a.traits.Eyes = 'fire laser';
    b.traits.Head = 'crown';
    b.traits.Naked = 'no';
    a.traits.Aura = NONE;
    expect(createMutant({ parentA: a, parentB: b }).name).toBe('KING BEAM');
  });
  it('recipes pin their ingredient genes (perk always has its move)', () => {
    let checked = 0;
    for (let i = 0; i < 3000; i++) {
      const [a, b] = randomPair();
      const m = createMutant({ parentA: a, parentB: b, recipeTiers: ['P0', 'P1'] });
      if (m.recipe?.id === 'KING_BEAM') {
        expect(m.special).toBe('BEAM');
        expect(m.head).toBe('ROYAL');
        checked++;
      }
      if (m.recipe?.id === 'WILDFIRE') expect(m.special).toBe('BEAM');
      if (m.recipe?.id === 'FWOG_LORD') expect(m.trinket).toBe('FWOG');
      if (m.recipe?.id === 'NUCLEAR_UNDEAD') expect(m.affinity).toBe('UNDEAD');
      if (m.recipe?.id === 'ARCHMAGE') expect(m.head).toBe('WARP');
      if (m.recipe?.id === 'THE_NAKED_KING') expect(m.physics).toBe('LIGHT');
    }
    expect(checked).toBeGreaterThan(0);
  });
  it('P1 recipes are live; restricting tiers still works', () => {
    const a = randomParent(1);
    const b = randomParent(2);
    Object.assign(a.traits, { Eyes: 'btc glass', Head: 'mon cap', Aura: NONE, Accessory: NONE, Base: 'origin', Naked: 'no', Body: 'tuxedo', Mouth: 'smile' });
    Object.assign(b.traits, { Eyes: 'happy', Head: 'btc cap', Aura: NONE, Accessory: NONE, Base: 'origin', Naked: 'no', Body: 'tuxedo', Mouth: 'smile' });
    expect(createMutant({ parentA: a, parentB: b, recipeTiers: ['P0'] }).recipe).toBeUndefined();
    expect(createMutant({ parentA: a, parentB: b }).recipe?.id).toBe('BTC_MAXI');
  });
});

describe('naming', () => {
  it('has ≥ 12 words per list and no banned words', () => {
    const banned = /nexus|quantum|neural|cyber|omni|hyperion/i;
    for (const list of [...Object.values(PREFIXES), ...Object.values(NOUNS)]) {
      expect(list.length).toBeGreaterThanOrEqual(12);
      for (const w of list) expect(w).not.toMatch(banned);
    }
  });
});

describe('unstable', () => {
  it('hits roughly 5% of pairs', () => {
    let n = 0;
    for (let i = 1; i <= 4000; i++) if (isUnstable(pairKeyOf(i, i + 1))) n++;
    expect(n / 4000).toBeGreaterThan(0.035);
    expect(n / 4000).toBeLessThan(0.065);
  });
});

describe('arena rules', () => {
  it('are order-independent and capped at 3', () => {
    for (let i = 0; i < 300; i++) {
      const m1 = createMutant({ parentA: randomParent(1 + i), parentB: randomParent(1000 + i) });
      const m2 = createMutant({ parentA: randomParent(500 + i), parentB: randomParent(1500 + i) });
      const r = createArenaRules({ mutants: [m1, m2] });
      expect(r).toEqual(createArenaRules({ mutants: [m2, m1] }));
      expect(r.modifiers.length).toBeLessThanOrEqual(3);
      expect(r.stable).toBe(r.modifiers.length === 0);
    }
  });
});

