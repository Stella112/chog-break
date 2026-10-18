// §D5 names: `{prefix} {noun}` — prefix keyed by Eyes gene, noun keyed by Body gene.
import type { PhysicsGene, SpecialGene } from './genes';
import type { Rng } from './rng';

export const PREFIXES: Record<SpecialGene, readonly string[]> = {
  BEAM: ['Laser', 'Zappy', 'Beamy', 'Scorchy', 'Blasty', 'Sizzle', 'Ray', 'Glare', 'Burny', 'Photon', 'Lens', 'Flare'],
  BLINK: ['Blinky', 'Shifty', 'Visor', 'Glitchy', 'Poof', 'Zippy', 'Flicker', 'Warpy', 'Shady', 'Ghosty', 'Skippy', 'Sneaky'],
  TEARS: ['Soggy', 'Weepy', 'Drippy', 'Sobbing', 'Damp', 'Moist', 'Leaky', 'Teary', 'Puddle', 'Sniffly', 'Misty', 'Sulky'],
  LEECH: ['Clingy', 'Hungry', 'Suckle', 'Thirsty', 'Lovesick', 'Needy', 'Smitten', 'Gobbly', 'Leechy', 'Smoochy', 'Greedy', 'Crushy'],
  RAGE: ['Angry', 'Furious', 'Grumpy', 'Huffy', 'Fuming', 'Seething', 'Cranky', 'Livid', 'Mad', 'Snarly', 'Ragey', 'Steamy'],
  CHAOS_ORB: ['Chaotic', 'Wonky', 'Bonkers', 'Loopy', 'Dizzy', 'Goofy', 'Zany', 'Kooky', 'Bouncy', 'Janky', 'Twitchy', 'Feral'],
  SPIT: ['Spitty', 'Gooey', 'Slimy', 'Hocky', 'Sloppy', 'Gunky', 'Splatty', 'Phlegmy', 'Gloopy', 'Snotty', 'Spewy', 'Drooly'],
};

export const NOUNS: Record<PhysicsGene, readonly string[]> = {
  HEAVY: ['Brute', 'Tank', 'Boulder', 'Chonk', 'Slab', 'Golem', 'Hulk', 'Lump', 'Fridge', 'Anvil', 'Bulk', 'Titan'],
  FLOATY: ['Drifter', 'Balloon', 'Floater', 'Spacer', 'Comet', 'Bubble', 'Kite', 'Puff', 'Orbiter', 'Moonling', 'Cloud', 'Glider'],
  DASHER: ['Zoomer', 'Rocket', 'Dart', 'Bolt', 'Streak', 'Torpedo', 'Racer', 'Sprinter', 'Missile', 'Whip', 'Blur', 'Jet'],
  SLIPPERY: ['Slider', 'Greaser', 'Skater', 'Eel', 'Banana', 'Slick', 'Glider', 'Squeegee', 'Noodle', 'Wobbler', 'Slip', 'Soap'],
  LIGHT: ['Goblin', 'Twig', 'Gremlin', 'Pipsqueak', 'Shrimp', 'Noodle', 'Imp', 'Sprout', 'Critter', 'Runt', 'Speck', 'Peanut'],
  BALANCED: ['Chog', 'Mutant', 'Thing', 'Specimen', 'Freak', 'Critter', 'Blob', 'Hybrid', 'Beast', 'Gizmo', 'Creature', 'Oddity'],
};

export function generateName(rng: Rng, special: SpecialGene, physics: PhysicsGene): string {
  return `${rng.pick(PREFIXES[special])} ${rng.pick(NOUNS[physics])}`;
}
