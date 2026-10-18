// Real-manifest checks (§F Phase 1). Skipped until public/data/chogs.json is complete.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { accessoryGene, auraGene, baseGene, bodyGene, eyesGene, headGene, mouthGene } from '../../src/core/genes';
import { RECIPES, recipeMatches } from '../../src/core/recipes';
import { createMutant } from '../../src/core/splice';
import type { ChogRecord } from '../../src/core/types';

const path = 'public/data/chogs.json';
const records: ChogRecord[] = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : [];
const complete = records.length === 1969;

function tally<T extends string>(fn: (r: ChogRecord) => T): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of records) out[fn(r)] = (out[fn(r)] ?? 0) + 1;
  return out;
}

describe.skipIf(!complete)('real manifest → genes (§D4 distributions)', () => {
  it('Eyes', () =>
    expect(tally((r) => eyesGene(r.traits.Eyes))).toEqual({ SPIT: 711, BLINK: 386, BEAM: 277, TEARS: 245, CHAOS_ORB: 186, RAGE: 92, LEECH: 72 }));
  it('Head', () =>
    expect(tally((r) => headGene(r.traits.Head))).toEqual({ ROYAL: 68, GUARD: 90, WARP: 81, HORNS: 71, LIGHTWEIGHT: 253, STEADY: 1406 }));
  it('Mouth', () =>
    expect(tally((r) => mouthGene(r.traits.Mouth))).toEqual({ HEADBUTT: 1179, COIN_TOSS: 236, DROOL: 184, BUBBLE: 168, PUKE: 145, HONK: 57 }));
  it('Body', () =>
    expect(tally((r) => bodyGene(r.traits.Body, r.traits.Naked === 'yes'))).toEqual({ BALANCED: 1505, LIGHT: 207, HEAVY: 116, SLIPPERY: 54, DASHER: 48, FLOATY: 39 }));
  it('Base', () => expect(tally((r) => baseGene(r.traits.Base))).toEqual({ NORMAL: 1869, UNDEAD: 60, TOXIC: 30, ANOMALY: 10 }));
  it('Accessory', () =>
    expect(tally((r) => accessoryGene(r.traits.Accessory))).toEqual({ NONE: 1774, CHARM: 90, FWOG: 28, PUMP: 23, SHIV: 18, REGEN: 18, DUMP: 18 }));
  it('Aura', () =>
    expect(tally((r) => auraGene(r.traits.Aura))).toEqual({ NONE: 995, GLOW: 303, BURN: 202, FROST: 123, SHIELD: 105, BLOOM: 73, GUST: 60, SMOKE: 57, SHOCK: 51 }));
});

describe.skipIf(!complete)('real manifest → recipes', () => {
  it('every recipe has at least one real pair', { timeout: 120_000 }, () => {
    for (const r of RECIPES) {
      const xs = records.filter((c) => r.x(c.traits));
      const found = xs.some((a) => records.some((b) => a.tokenId !== b.tokenId && recipeMatches(r, a.traits, b.traits)));
      expect(found, r.id).toBe(true);
    }
  });
});

describe.skipIf(!complete)('stability snapshot', () => {
  it('20 fixed pairs', () => {
    const byId = new Map(records.map((r) => [r.tokenId, r]));
    const pairs = [[1, 2], [1, 1969], [1968, 1969], [88, 1053], [500, 1000], [42, 1337], [7, 777], [10, 20], [100, 200], [300, 301],
      [999, 1001], [1500, 1600], [3, 1900], [55, 66], [123, 321], [400, 1400], [600, 1700], [800, 900], [1111, 1222], [1333, 1444]];
    const snap = pairs.map(([a, b]) => {
      const m = createMutant({ parentA: byId.get(a!)!, parentB: byId.get(b!)! });
      return { pair: `${m.lo}x${m.hi}`, name: m.name, special: m.special, head: m.head, close: m.close, physics: m.physics, affinity: m.affinity, trinket: m.trinket, element: m.element, recipe: m.recipe?.id ?? null, unstable: m.unstable, power: m.power };
    });
    expect(snap).toMatchSnapshot();
  });
});
