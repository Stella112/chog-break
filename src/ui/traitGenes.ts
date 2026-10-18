import { accessoryGene, auraGene, baseGene, bodyGene, eyesGene, headGene, mouthGene } from '../core/genes';
import type { InheritedSlot } from '../core/splice';
import type { NormalizedTraits } from '../core/types';

/** The gene a single Chog's trait would give in each slot (for the browser detail panel). */
export function geneForSlot(slot: InheritedSlot, t: NormalizedTraits, nakedOverride?: boolean): string {
  switch (slot) {
    case 'Eyes':
      return eyesGene(t.Eyes);
    case 'Head':
      return headGene(t.Head);
    case 'Mouth':
      return mouthGene(t.Mouth);
    case 'Body':
      return bodyGene(t.Body, nakedOverride ?? t.Naked === 'yes');
    case 'Base':
      return baseGene(t.Base);
    case 'Accessory':
      return accessoryGene(t.Accessory);
    case 'Aura':
      return auraGene(t.Aura);
  }
}
