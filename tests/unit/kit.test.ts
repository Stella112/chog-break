import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildKit, IMPLEMENTED, SPECIAL_CD } from '../../src/arena/kit';
import { AFFINITIES, CLOSES, ELEMENTS, HEADS, SPECIALS, TRINKETS } from '../../src/core/genes';
import { createMutant } from '../../src/core/splice';
import type { ChogRecord } from '../../src/core/types';
import secretPairs from '../../src/config/secretPairs.json';

const records = JSON.parse(readFileSync('public/data/chogs.json', 'utf8')) as ChogRecord[];
const byId = new Map(records.map((r) => [r.tokenId, r]));
const mutant = (a: number, b: number) => createMutant({ parentA: byId.get(a)!, parentB: byId.get(b)! });

describe('kit', () => {
  it('every gene has an arena effect (no fallbacks needed)', () => {
    for (const g of SPECIALS) expect(IMPLEMENTED.special.has(g)).toBe(true);
    for (const g of HEADS) expect(IMPLEMENTED.head.has(g)).toBe(true);
    for (const g of CLOSES) expect(IMPLEMENTED.close.has(g)).toBe(true);
    for (const g of AFFINITIES) expect(IMPLEMENTED.affinity.has(g)).toBe(true);
    for (const g of TRINKETS) expect(IMPLEMENTED.trinket.has(g)).toBe(true);
    for (const g of ELEMENTS) expect(IMPLEMENTED.element.has(g)).toBe(true);
  });

  it('maps genes to numbers per §D4', () => {
    for (let a = 1; a <= 400; a += 7) {
      const m = mutant(a, a + 900);
      const k = buildKit(m);
      expect(k.special).toBe(m.special);
      if (m.physics === 'HEAVY') expect(k.profile.weight).toBeCloseTo(m.metal ? 1.4 : 1.3);
      if (m.physics === 'LIGHT') expect(k.profile.speed).toBeGreaterThanOrEqual(1.15);
      if (m.head === 'ROYAL') expect(k.kbTaken).toBe(0.85);
      if (m.head === 'LIGHTWEIGHT') expect(k.kbTaken).toBe(1.1);
      if (m.affinity === 'ANOMALY') expect(k.specialCd).toBe(Math.round(SPECIAL_CD[m.special] * 0.85));
      expect(k.specialCd).toBeGreaterThanOrEqual(2500);
      expect(k.specialCd).toBeLessThanOrEqual(6000);
    }
  });

  it('P0 recipe perks reach the kit', () => {
    for (const p of secretPairs) {
      const k = buildKit(mutant(p.a, p.b));
      expect(k.recipe).toBe(p.recipe);
      if (p.recipe === 'ESCAPE_VELOCITY') expect(k.maxJumps).toBe(3);
      if (p.recipe === 'KING_BEAM') expect(k.special).toBe('BEAM');
      if (p.recipe === 'FWOG_LORD') expect(k.trinket).toBe('FWOG');
    }
  });

  it('tier never changes a fighter number (rarity ≠ strength)', () => {
    for (let a = 1; a <= 300; a += 11) {
      const pa = byId.get(a)!;
      const pb = byId.get(a + 1000)!;
      const base = buildKit(createMutant({ parentA: pa, parentB: pb }));
      for (const tier of ['common', 'legendary']) {
        const k = buildKit(createMutant({ parentA: { ...pa, traits: { ...pa.traits, Tier: tier } }, parentB: pb }));
        expect({ ...k, glitch: 0 }).toEqual({ ...base, glitch: 0 });
      }
    }
  });
});
