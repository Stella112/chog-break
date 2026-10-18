export const TRAIT_CATEGORIES = [
  'Background',
  'Base',
  'Skin',
  'Side',
  'Body',
  'Mouth',
  'Eyes',
  'Head',
  'Accessory',
  'Aura',
  'Form',
  'Tier',
  'Naked',
] as const;
export type TraitCategory = (typeof TRAIT_CATEGORIES)[number];

/** Internal value for an absent category (§C3: absent ≠ a value called "None"). */
export const NONE = 'none';

export type RawAttribute = { trait_type: string; value: string | number };
export type NormalizedTraits = Record<TraitCategory, string>;

export type ChogRecord = {
  tokenId: number;
  displayName: string;
  displayNumber: number | null;
  tokenUri: string;
  image: string;
  attributes: RawAttribute[];
  traits: NormalizedTraits;
};
