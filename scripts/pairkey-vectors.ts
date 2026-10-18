// Writes tests/fixtures/pairkey-vectors.json (shared with the Reviewer's Foundry suite).
import { writeFileSync } from 'node:fs';
import { CHOG_GENESIS } from '../src/config/chain';
import { pairKeyOf } from '../src/core/pair';

const pairs: [number, number][] = [[1, 2], [1, 1969], [1968, 1969], [88, 1053], [500, 1000], [42, 1337], [7, 777]];
const vectors = pairs.map(([lo, hi]) => ({ lo, hi, pairKey: pairKeyOf(lo, hi) }));
writeFileSync('tests/fixtures/pairkey-vectors.json', JSON.stringify({ collection: CHOG_GENESIS, vectors }, null, 2) + '\n');
console.log(vectors);
