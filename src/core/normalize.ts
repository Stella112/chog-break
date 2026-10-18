import { NONE, TRAIT_CATEGORIES, type NormalizedTraits, type RawAttribute } from './types';

export function normalizeValue(value: string | number): string {
  return String(value).trim().toLowerCase();
}

/** Absent categories become `none`. Unknown categories are returned separately so callers can STOP. */
export function normalizeTraits(attributes: RawAttribute[]): {
  traits: NormalizedTraits;
  unknownCategories: string[];
} {
  const traits = Object.fromEntries(TRAIT_CATEGORIES.map((c) => [c, NONE])) as NormalizedTraits;
  const unknownCategories: string[] = [];
  for (const attr of attributes) {
    const cat = TRAIT_CATEGORIES.find((c) => c === attr.trait_type);
    if (!cat) unknownCategories.push(attr.trait_type);
    else traits[cat] = normalizeValue(attr.value);
  }
  return { traits, unknownCategories };
}

/** "CHOG #1462" → 1462. Display only; never a token ID (§C1 ID rule). */
export function parseDisplayNumber(name: string): number | null {
  const m = /#\s*(\d+)/.exec(name);
  return m ? Number(m[1]) : null;
}
