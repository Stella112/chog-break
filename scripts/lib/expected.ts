// §C3 sanity numbers. The generated manifest is the final authority; mismatches are STOP 6.
export const EXPECTED = {
  total: 1969,
  tiers: { common: 1279, uncommon: 590, rare: 60, epic: 30, legendary: 10 },
  presentCounts: { Aura: 974, Accessory: 195, Body: 1762, Head: 1716, Mouth: 1804, Background: 1959, Eyes: 1959 },
  distinctValues: { Background: 32, Base: 4, Skin: 14, Side: 2, Body: 96, Mouth: 15, Eyes: 58, Head: 66, Accessory: 9, Aura: 22, Form: 2, Tier: 5, Naked: 2 },
} as const;
