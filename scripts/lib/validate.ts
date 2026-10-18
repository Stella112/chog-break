import { NONE, type ChogRecord, type TraitCategory } from '../../src/core/types';
import { EXPECTED } from './expected';

export function validateManifest(records: ChogRecord[]): string[] {
  const problems: string[] = [];
  const ids = records.map((r) => r.tokenId);
  if (new Set(ids).size !== ids.length) problems.push('duplicate token IDs');
  if (records.length !== EXPECTED.total) problems.push(`expected ${EXPECTED.total} records, got ${records.length}`);
  const expectedIds = Array.from({ length: EXPECTED.total }, (_, i) => i + 1);
  const idSet = new Set(ids);
  const missing = expectedIds.filter((i) => !idSet.has(i));
  const extra = ids.filter((i) => i < 1 || i > EXPECTED.total);
  if (missing.length) problems.push(`missing IDs: ${missing.slice(0, 10).join(',')}${missing.length > 10 ? '…' : ''}`);
  if (extra.length) problems.push(`IDs outside 1..${EXPECTED.total}: ${extra.slice(0, 10).join(',')}`);

  for (const [tier, n] of Object.entries(EXPECTED.tiers)) {
    const got = records.filter((r) => r.traits.Tier === tier).length;
    if (got !== n) problems.push(`tier ${tier}: expected ${n}, got ${got}`);
  }
  for (const [cat, n] of Object.entries(EXPECTED.presentCounts)) {
    const got = records.filter((r) => r.traits[cat as TraitCategory] !== NONE).length;
    if (got !== n) problems.push(`${cat} present: expected ${n}, got ${got}`);
  }
  for (const [cat, n] of Object.entries(EXPECTED.distinctValues)) {
    const vals = new Set(records.map((r) => r.traits[cat as TraitCategory]).filter((v) => v !== NONE));
    if (vals.size !== n) problems.push(`${cat} distinct normalized values: expected ${n}, got ${vals.size}`);
  }
  return problems;
}
