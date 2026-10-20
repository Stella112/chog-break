// Verifies a deployed ChogBreakRegistry before the app is pointed at it (docs/DEPLOY.md step 7).
//   npm run registry:verify -- <registry address> [--fee <raw>] [--max-fee <raw>] [--prize <addr>] [--owner <addr>] [--rpc <url>]
// Checks: runtime bytecode == this repo's compiled contract (immutables masked) · immutables and settings ·
// pairKeyOf matches the shared TS/Solidity vectors · not paused. Prints PASS/FAIL per row; exit 1 on any FAIL.
// Read-only: sends nothing.
import { readFileSync } from 'node:fs';
import { createPublicClient, getAddress, http, isAddress, type Address, type Hex } from 'viem';
import { CHAIN_ID, CHOG_GENESIS, CHOG_TOKEN, RPC_URL } from '../src/config/chain';
import { REGISTRY_ABI } from '../src/chain/registry';

const argv = process.argv.slice(2);
const flag = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const target = argv.find((a) => isAddress(a));
if (!target) {
  console.error('usage: npm run registry:verify -- <registry address> [--fee <raw>] [--max-fee <raw>] [--prize <addr>] [--owner <addr>]');
  process.exit(2);
}
const registry = getAddress(target);
const client = createPublicClient({ transport: http(flag('rpc') ?? RPC_URL) });

let failed = 0;
const row = (ok: boolean, what: string, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? `  (${detail})` : ''}`);
};

type Artifact = { deployedBytecode: { object: Hex; immutableReferences?: Record<string, { start: number; length: number }[]> } };

/** Zero the immutable slots so on-chain code (immutables filled) compares to the artifact (immutables zero). */
function masked(code: Hex, refs: Artifact['deployedBytecode']['immutableReferences']): string {
  const bytes = Buffer.from(code.slice(2), 'hex');
  for (const list of Object.values(refs ?? {})) for (const { start, length } of list) bytes.fill(0, start, start + length);
  return bytes.toString('hex');
}

const read = <T>(functionName: string, args: unknown[] = []) =>
  client.readContract({ address: registry, abi: REGISTRY_ABI, functionName, args } as never) as Promise<T>;

async function main() {
  const chainId = await client.getChainId();
  row(chainId === CHAIN_ID, 'RPC is Monad mainnet', `chain ${chainId}`);

  const code = await client.getCode({ address: registry });
  row(!!code && code !== '0x', 'registry has code');
  let art: Artifact | null = null;
  try {
    art = JSON.parse(readFileSync('contracts/out/ChogBreakRegistry.sol/ChogBreakRegistry.json', 'utf8')) as Artifact;
  } catch {
    row(false, 'compiled artifact found', 'run `cd contracts && forge build` first');
  }
  if (art && code) {
    const same = masked(code, art.deployedBytecode.immutableReferences) === masked(art.deployedBytecode.object, art.deployedBytecode.immutableReferences);
    row(same, 'runtime bytecode matches this repo (immutables masked)');
  }

  const [nft, token, maxFee, fee, prize, owner, paused] = await Promise.all([
    read<Address>('CHOG_GENESIS'),
    read<Address>('CHOG_TOKEN'),
    read<bigint>('MAX_FEE'),
    read<bigint>('fee'),
    read<Address>('prizeRecipient'),
    read<Address>('owner'),
    read<boolean>('paused'),
  ]);
  row(nft === CHOG_GENESIS, 'CHOG_GENESIS is the real collection', nft);
  row(token === CHOG_TOKEN, 'CHOG_TOKEN is the real $CHOG', token);
  row(fee <= maxFee, 'fee <= MAX_FEE', `${fee} / ${maxFee}`);
  const want = (k: string) => flag(k);
  if (want('fee')) row(fee === BigInt(want('fee')!), 'fee as intended', String(fee));
  if (want('max-fee')) row(maxFee === BigInt(want('max-fee')!), 'MAX_FEE as intended', String(maxFee));
  if (want('prize')) row(prize === getAddress(want('prize')!), 'prize recipient as intended', prize);
  if (want('owner')) row(owner === getAddress(want('owner')!), 'owner as intended', owner);
  console.log(`info  fee ${fee} · MAX_FEE ${maxFee} · prize ${prize} · owner ${owner}`);
  row(!paused, 'not paused');

  const fx = JSON.parse(readFileSync('tests/fixtures/pairkey-vectors.json', 'utf8')) as { vectors: { lo: number; hi: number; pairKey: Hex }[] };
  for (const v of fx.vectors) {
    const k = await read<Hex>('pairKeyOf', [BigInt(v.hi), BigInt(v.lo)]);
    row(k === v.pairKey, `pairKeyOf(${v.hi}, ${v.lo}) matches the app`);
  }

  console.log(failed ? `\n${failed} check(s) FAILED: do not set REGISTRY_ADDRESS.` : '\nAll checks passed.');
  process.exitCode = failed ? 1 : 0;
}

main().catch((e) => {
  console.error('FAIL  could not read the registry:', (e as Error).message);
  process.exitCode = 1; // (not process.exit(): it can crash Node on Windows while sockets close)
});
