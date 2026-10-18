// Player-facing gene labels (§D4). Arena/reveal headlines use these, never raw trait values.
import type { InheritedSlot } from '../core/splice';

export const SLOT_ROLE: Record<InheritedSlot, string> = {
  Eyes: 'SPECIAL · L',
  Head: 'DEFENSE',
  Mouth: 'CLOSE MOVE · I',
  Body: 'PHYSICS',
  Base: 'AFFINITY',
  Accessory: 'TRINKET',
  Aura: 'ELEMENT',
};

export const GENE_INFO: Record<string, { label: string; desc: string }> = {
  // Eyes
  BEAM: { label: 'BEAM', desc: 'Charged horizontal laser' },
  BLINK: { label: 'BLINK', desc: 'Invulnerable dash-teleport' },
  TEARS: { label: 'TEARS', desc: 'Lobs tears that leave slippery puddles' },
  LEECH: { label: 'LEECH', desc: 'Lunge punch that heals' },
  RAGE: { label: 'RAGE', desc: 'Hit harder, take more, for 4 s' },
  CHAOS_ORB: { label: 'CHAOS ORB', desc: 'Orb with unpredictable bounces' },
  SPIT: { label: 'SPIT', desc: 'Straight projectile' },
  // Head
  ROYAL: { label: 'ROYAL', desc: '10% less knockback taken' },
  GUARD: { label: 'GUARD', desc: 'Hold K on the ground to block' },
  WARP: { label: 'WARP', desc: 'Recovery is a teleport' },
  HORNS: { label: 'HORNS', desc: 'Recovery is a horn charge that hits' },
  LIGHTWEIGHT: { label: 'LIGHTWEIGHT', desc: 'Faster, but flies further' },
  STEADY: { label: 'STEADY', desc: 'Baseline defense' },
  // Mouth
  PUKE: { label: 'PUKE', desc: 'Multi-hit rainbow cone' },
  DROOL: { label: 'DROOL', desc: 'Slippery puddle at your feet' },
  BUBBLE: { label: 'BUBBLE', desc: 'Bubble shield; slows falling' },
  COIN_TOSS: { label: 'COIN TOSS', desc: 'Arcing coin projectile' },
  HONK: { label: 'HONK', desc: 'Close-range stun' },
  HEADBUTT: { label: 'HEADBUTT', desc: 'Quick headbutt' },
  // Body
  HEAVY: { label: 'HEAVY', desc: 'Hard to launch, slower' },
  FLOATY: { label: 'FLOATY', desc: 'Low gravity, high jumps' },
  DASHER: { label: 'DASHER', desc: 'Longer, faster dashes' },
  SLIPPERY: { label: 'SLIPPERY', desc: 'Slides around, immune to puddles' },
  LIGHT: { label: 'LIGHT', desc: 'Fast and fragile' },
  BALANCED: { label: 'BALANCED', desc: 'Baseline physics' },
  // Base
  UNDEAD: { label: 'UNDEAD', desc: 'Revives once per match' },
  TOXIC: { label: 'TOXIC', desc: 'Hurts nearby opponents' },
  ANOMALY: { label: 'ANOMALY', desc: 'Glitched; faster special cooldown' },
  NORMAL: { label: 'NORMAL', desc: 'No affinity' },
  // Accessory
  SHIV: { label: 'SHIV', desc: 'Punches hit harder' },
  FWOG: { label: 'FWOG', desc: 'A frog helper attacks' },
  PUMP: { label: 'PUMP', desc: 'Grows bigger every 10 s' },
  DUMP: { label: 'DUMP', desc: 'Shrinks and speeds up every 10 s' },
  REGEN: { label: 'REGEN', desc: 'Heals 1% every 3 s' },
  CHARM: { label: 'CHARM', desc: 'Cosmetic sparkle' },
  // Aura
  BURN: { label: 'BURN', desc: 'Dashes leave fire' },
  FROST: { label: 'FROST', desc: 'Hits slow the target' },
  GUST: { label: 'GUST', desc: 'Dashes push opponents' },
  SMOKE: { label: 'SMOKE', desc: 'Dashes leave smoke cover' },
  SHOCK: { label: 'SHOCK', desc: 'Combo finisher stuns' },
  SHIELD: { label: 'SHIELD', desc: 'First hit each life is halved' },
  BLOOM: { label: 'BLOOM', desc: 'Heals 1% every 3 s' },
  GLOW: { label: 'GLOW', desc: 'Cosmetic glow' },
  NONE: { label: '—', desc: 'Nothing' },
};

export const MODIFIER_INFO: Record<string, { label: string; desc: string }> = {
  TOXIC_FLOOR: { label: 'TOXIC FLOOR', desc: 'Floor segments glow, then hurt' },
  SLIPPERY_FLOOR: { label: 'SLIPPERY FLOOR', desc: 'Everyone slides' },
  LOW_GRAVITY: { label: 'LOW GRAVITY', desc: 'Everyone floats' },
  UNSTABLE_KNOCKBACK: { label: 'UNSTABLE KNOCKBACK', desc: 'Knockback ×1.35' },
  OVERCLOCK: { label: 'OVERCLOCK', desc: 'Everyone runs 20% faster' },
  BOUNCY_FLOOR: { label: 'BOUNCY FLOOR', desc: 'Hard landings bounce you back up' },
  SHRINKING_STAGE: { label: 'SHRINKING STAGE', desc: 'The main platform shrinks after 60 s' },
  METEOR_SHOWER: { label: 'METEOR SHOWER', desc: 'Red targets mark falling rocks' },
  COIN_RAIN: { label: 'COIN RAIN', desc: 'Grab falling coins to heal 5%' },
  GLITCH: { label: 'GLITCH', desc: 'A new random modifier every 20 s' },
};

export const SKIN_TINT: Record<string, string> = {
  pink: '#ff8fc7',
  origin: '#b48cff',
  red: '#ff5a4f',
  black: '#3b3646',
  yellow: '#ffd84a',
  blue: '#4fa3ff',
  white: '#f1eef7',
  green: '#59d68a',
  jade: '#3fbf9f',
  purple: '#9a5cff',
  'multi colored': '#ff9f3f',
  beige: '#e8cfa6',
  metal: '#b9c3cc',
  grey: '#9a9aa6',
  none: '#b48cff',
};
