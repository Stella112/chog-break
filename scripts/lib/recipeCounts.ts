import { RECIPES, recipeMatches, type RecipeId } from '../../src/core/recipes';
import type { ChogRecord } from '../../src/core/types';

/** Unordered real pairs per recipe (match condition only, ignoring precedence) + first example pair. */
export function countRecipePairs(records: ChogRecord[]) {
  const out = new Map<RecipeId, { count: number; example?: [number, number] }>();
  for (const r of RECIPES) out.set(r.id, { count: 0 });
  for (let i = 0; i < records.length; i++) {
    const a = records[i]!;
    for (let j = i + 1; j < records.length; j++) {
      const b = records[j]!;
      for (const r of RECIPES) {
        if (!recipeMatches(r, a.traits, b.traits)) continue;
        const e = out.get(r.id)!;
        e.count++;
        e.example ??= [a.tokenId, b.tokenId];
      }
    }
  }
  return out;
}
