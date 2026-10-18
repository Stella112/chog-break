// §E step 2–3: prove minted IDs, fetch metadata, write public/data/chogs.json + valid-token-ids.json, validate.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { CHOG_GENESIS } from '../src/config/chain';
import { normalizeTraits, parseDisplayNumber } from '../src/core/normalize';
import type { ChogRecord, RawAttribute } from '../src/core/types';
import { erc721Abi } from './lib/abi';
import { client, fetchWithFallback, pool } from './lib/net';
import { validateManifest } from './lib/validate';

const CACHE = '.cache/meta';
mkdirSync(CACHE, { recursive: true });
mkdirSync('public/data', { recursive: true });

// Logs are limited to ~100-block ranges on the public RPC (docs/CHAIN_CHECK.md) → use ownerOf over a padded range.
const PROBE_MAX = 2100;
const ids = Array.from({ length: PROBE_MAX + 1 }, (_, i) => i);

async function multicall(fn: 'ownerOf' | 'tokenURI', tokenIds: number[]) {
  const out: { id: number; ok: boolean; result?: string }[] = [];
  for (let i = 0; i < tokenIds.length; i += 250) {
    const chunk = tokenIds.slice(i, i + 250);
    const res = await client.multicall({
      allowFailure: true,
      contracts: chunk.map((id) => ({ address: CHOG_GENESIS, abi: erc721Abi, functionName: fn, args: [BigInt(id)] }) as const),
    });
    res.forEach((r, j) => out.push({ id: chunk[j]!, ok: r.status === 'success', result: r.status === 'success' ? String(r.result) : undefined }));
  }
  return out;
}

console.log(`ownerOf scan 0..${PROBE_MAX}…`);
const owners = await multicall('ownerOf', ids);
const minted = owners.filter((o) => o.ok).map((o) => o.id);
console.log(`minted: ${minted.length} (min ${minted[0]}, max ${minted.at(-1)})`);
writeFileSync('public/data/valid-token-ids.json', JSON.stringify(minted) + '\n');

console.log('tokenURI…');
const uris = await multicall('tokenURI', minted);
const failedUri = uris.filter((u) => !u.ok).map((u) => u.id);

let done = 0;
const records = await pool(
  uris.filter((u) => u.ok),
  8,
  async ({ id, result: tokenUri }): Promise<ChogRecord | { tokenId: number; error: string }> => {
    const cacheFile = `${CACHE}/${id}.json`;
    try {
      let json: string;
      if (existsSync(cacheFile)) json = readFileSync(cacheFile, 'utf8');
      else {
        json = new TextDecoder().decode(await fetchWithFallback(tokenUri!));
        JSON.parse(json);
        writeFileSync(cacheFile, json);
      }
      const meta = JSON.parse(json) as { name: string; image: string; attributes: RawAttribute[] };
      const { traits, unknownCategories } = normalizeTraits(meta.attributes ?? []);
      if (unknownCategories.length) throw new Error(`unknown categories: ${unknownCategories.join(',')}`);
      if (++done % 200 === 0) console.log(`  metadata ${done}`);
      return {
        tokenId: id,
        displayName: meta.name,
        displayNumber: parseDisplayNumber(meta.name),
        tokenUri: tokenUri!,
        image: meta.image,
        attributes: meta.attributes,
        traits,
      };
    } catch (e) {
      return { tokenId: id, error: (e as Error).message.split('\n')[0]! };
    }
  },
);

const good = records.filter((r): r is ChogRecord => !('error' in r)).sort((a, b) => a.tokenId - b.tokenId);
const bad = records.filter((r) => 'error' in r);
writeFileSync('public/data/chogs.json', JSON.stringify(good));
// Client copy without fields the browser never uses (tokenUri, IPFS image): smaller first load.
writeFileSync(
  'public/data/chogs.min.json',
  JSON.stringify(good.map((r) => ({ tokenId: r.tokenId, displayName: r.displayName, displayNumber: r.displayNumber, attributes: r.attributes, traits: r.traits }))),
);
console.log(`wrote public/data/chogs.json: ${good.length} records; failed metadata ${bad.length}; failed tokenURI ${failedUri.length}`);
for (const b of bad.slice(0, 20)) console.log('  FAIL', b);

const problems = validateManifest(good);
if (bad.length || failedUri.length) problems.push(`${bad.length + failedUri.length} tokens without metadata (rerun to resume)`);
if (problems.length) {
  console.error('VALIDATION FAILED (STOP 6 if not a transient fetch failure):');
  for (const p of problems) console.error('  -', p);
  process.exitCode = 1;
} else console.log('VALIDATION PASS: manifest matches §C3');
