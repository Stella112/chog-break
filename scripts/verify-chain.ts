// §E step 1: check every §C2 row and write docs/CHAIN_CHECK.md.
import { writeFileSync } from 'node:fs';
import { toFunctionSelector } from 'viem';
import { CHOG_GENESIS, CHOG_TOKEN, MULTICALL3 } from '../src/config/chain';
import { erc20Abi, erc721Abi } from './lib/abi';
import { client, fetchWithFallback, ipfsToPaths, rpcUrl } from './lib/net';
import { IPFS_GATEWAYS } from '../src/config/chain';

type Row = { fact: string; status: 'PASS' | 'FAIL' | 'MANUAL'; detail: string };
const rows: Row[] = [];
async function check(fact: string, fn: () => Promise<{ ok: boolean | 'manual'; detail: string }>) {
  try {
    const { ok, detail } = await fn();
    rows.push({ fact, status: ok === 'manual' ? 'MANUAL' : ok ? 'PASS' : 'FAIL', detail });
  } catch (e) {
    rows.push({ fact, status: 'FAIL', detail: (e as Error).message.split('\n')[0]! });
  }
  const r = rows.at(-1)!;
  console.log(`${r.status.padEnd(6)} ${r.fact} — ${r.detail}`);
}

let tokenUri1 = '';
let image1 = '';

await check('Public RPC chainId = 0x8f', async () => {
  const id = await client.getChainId();
  return { ok: id === 143, detail: `${rpcUrl} → ${id}` };
});
for (const [label, addr] of [
  ['NFT deployed', CHOG_GENESIS],
  ['$CHOG deployed', CHOG_TOKEN],
  ['Multicall3 deployed', MULTICALL3],
] as const) {
  await check(label, async () => {
    const code = await client.getCode({ address: addr });
    return { ok: !!code && code !== '0x', detail: `${addr} code ${code ? (code.length - 2) / 2 : 0} bytes` };
  });
}
await check('NFT ownerOf/tokenURI/balanceOf on token 1', async () => {
  const owner = await client.readContract({ address: CHOG_GENESIS, abi: erc721Abi, functionName: 'ownerOf', args: [1n] });
  tokenUri1 = await client.readContract({ address: CHOG_GENESIS, abi: erc721Abi, functionName: 'tokenURI', args: [1n] });
  const bal = await client.readContract({ address: CHOG_GENESIS, abi: erc721Abi, functionName: 'balanceOf', args: [owner] });
  return { ok: bal > 0n, detail: `ownerOf(1)=${owner}, tokenURI(1)=${tokenUri1}, balanceOf(owner)=${bal}` };
});
await check('$CHOG symbol/decimals', async () => {
  const symbol = await client.readContract({ address: CHOG_TOKEN, abi: erc20Abi, functionName: 'symbol' });
  const decimals = await client.readContract({ address: CHOG_TOKEN, abi: erc20Abi, functionName: 'decimals' });
  return { ok: true, detail: `symbol=${symbol}, decimals=${decimals}` };
});
await check('$CHOG has burn()', async () => {
  let code = (await client.getCode({ address: CHOG_TOKEN })) ?? '0x';
  // EIP-1167 minimal proxy: 363d3d373d3d3d363d73 <impl 20 bytes> 5af43d82803e903d91602b57fd5bf3
  const m = /^0x363d3d373d3d3d363d73([0-9a-f]{40})5af43d82803e903d91602b57fd5bf3$/i.exec(code);
  let note = 'not a minimal proxy';
  if (m) {
    const impl = `0x${m[1]}` as `0x${string}`;
    code = (await client.getCode({ address: impl })) ?? '0x';
    note = `EIP-1167 minimal proxy → implementation ${impl} (${(code.length - 2) / 2} bytes)`;
  }
  const sels = ['burn(uint256)', 'burnFrom(address,uint256)'].map((s) => [s, toFunctionSelector(s).slice(2)] as const);
  const found = sels.filter(([, sel]) => code.includes(sel)).map(([s]) => s);
  return {
    ok: 'manual',
    detail: `${note}; selector scan of bytecode: ${found.length ? found.join(', ') : 'none found'} (heuristic only; verified source not checked — assume NO burn per spec)`,
  };
});
await check('$CHOG fee-on-transfer / rebasing', async () => ({
  ok: 'manual',
  detail: 'Reviewer fork test required (transfer X → receiver +X)',
}));
await check('Metadata format (name, image, attributes)', async () => {
  const bytes = await fetchWithFallback(tokenUri1);
  const meta = JSON.parse(new TextDecoder().decode(bytes));
  image1 = meta.image;
  const ok = typeof meta.name === 'string' && typeof meta.image === 'string' && Array.isArray(meta.attributes);
  return { ok, detail: `name=${meta.name}, image=${meta.image}, ${meta.attributes?.length} attributes` };
});
await check('Image URI pattern', async () => {
  const ok = /^ipfs:\/\/bafybeihau2egcccbdxymeckmmbrqytbfor5gkt3en6d5fsbueymdbq7g6e\/\d+\.webp$/.test(image1);
  return { ok, detail: image1 };
});
await check('IPFS gateways (≥1 must work)', async () => {
  const results: string[] = [];
  let any = false;
  for (const gw of IPFS_GATEWAYS) {
    try {
      const res = await fetch(gw + ipfsToPaths(image1), { signal: AbortSignal.timeout(30_000) });
      any ||= res.ok;
      results.push(`${gw} HTTP ${res.status}`);
    } catch (e) {
      results.push(`${gw} ${(e as Error).message}`);
    }
  }
  return { ok: any, detail: results.join('; ') };
});
await check('eth_getLogs max block range', async () => {
  const latest = await client.getBlockNumber();
  let best = 0n;
  const tried: string[] = [];
  for (const span of [100n, 1000n, 10_000n, 100_000n]) {
    try {
      await client.getContractEvents({ address: CHOG_GENESIS, abi: erc721Abi, eventName: 'Transfer', fromBlock: latest - span, toBlock: latest });
      best = span;
      tried.push(`${span}:ok`);
    } catch (e) {
      tried.push(`${span}:fail(${(e as Error).message.split('\n')[0]!.slice(0, 60)})`);
      break;
    }
  }
  return { ok: best > 0n, detail: `latest=${latest}; ${tried.join(' ')}` };
});
await check('Explorer + verification method', async () => ({ ok: 'manual', detail: 'Read official Monad docs (not automatable)' }));

const md = [
  '# CHAIN_CHECK',
  '',
  `Generated by \`npm run data:verify\` on ${new Date().toISOString()}.`,
  '',
  '| Fact | Status | Detail |',
  '|---|---|---|',
  ...rows.map((r) => `| ${r.fact} | ${r.status} | ${r.detail.replaceAll('|', '\\|')} |`),
  '',
].join('\n');
writeFileSync('docs/CHAIN_CHECK.md', md);
console.log('wrote docs/CHAIN_CHECK.md');
process.exitCode = rows.some((r) => r.status === 'FAIL') ? 1 : 0;
