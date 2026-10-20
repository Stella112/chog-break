// Integration test: src/chain/registry.ts against the REAL compiled ChogBreakRegistry on a local anvil chain
// (chain id 143, mock $CHOG code placed at the real $CHOG address). No keys: accounts are impersonated.
// Needs `forge build` (contracts/out) and anvil; skipped with a note when either is missing.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createPublicClient,
  createTestClient,
  createWalletClient,
  getAddress,
  http,
  parseEventLogs,
  toFunctionSignature,
  type Abi,
  type Address,
  type Hex,
} from 'viem';
import { CHOG_TOKEN, DEAD_ADDRESS } from '../../src/config/chain';
import { monad } from '../../src/chain/client';
import {
  ERC20_ABI,
  RecordError,
  REGISTRY_ABI,
  readPairRecord,
  readTokenStats,
  recordSplice,
  recordErrorMessage,
  type RegistryReader,
  type RegistryWriter,
} from '../../src/chain/registry';

const OUT = 'contracts/out';
const art = (file: string, name: string) => JSON.parse(readFileSync(`${OUT}/${file}/${name}.json`, 'utf8')) as { abi: Abi; bytecode: { object: Hex }; deployedBytecode: { object: Hex } };
const hasAnvil = spawnSync('anvil', ['--version'], { shell: true }).status === 0;
const ready = hasAnvil && existsSync(`${OUT}/ChogBreakRegistry.sol/ChogBreakRegistry.json`);
if (!ready) console.warn('registry.anvil.test: skipped (run `cd contracts && forge build` and install Foundry anvil)');

// a fresh port per run, so a stale chain from an earlier run can never be reused
const PORT = 20_000 + Math.floor(Math.random() * 20_000);
const URL = `http://127.0.0.1:${PORT}`;
const chain = { ...monad, rpcUrls: { default: { http: [URL] } } };
const FEE = 100n * 10n ** 18n;

const splicer = getAddress('0x00000000000000000000000000000000000A11CE');
const holderA = getAddress('0x00000000000000000000000000000000000000A1');
const holderB = getAddress('0x00000000000000000000000000000000000000B2');
const poor = getAddress('0x0000000000000000000000000000000000000B0B');
const admin = getAddress('0x000000000000000000000000000000000000AD31');
const prize = getAddress('0x0000000000000000000000000000000000000922');

describe.skipIf(!ready)('registry client ↔ ChogBreakRegistry on anvil (chain 143)', () => {
  let anvil: ChildProcess;
  const pub = createPublicClient({ chain, transport: http(URL) });
  const test = createTestClient({ chain, mode: 'anvil', transport: http(URL) });
  const walletFor = (account: Address): RegistryWriter => {
    const w = createWalletClient({ chain, account, transport: http(URL) });
    return { getChainId: () => w.getChainId(), writeContract: (req) => w.writeContract(req as Parameters<typeof w.writeContract>[0]) };
  };
  const read = pub as unknown as RegistryReader;
  let registry: Address;

  beforeAll(async () => {
    anvil = spawn('anvil', ['--port', String(PORT), '--chain-id', '143', '--silent'], { stdio: 'ignore' });
    for (let i = 0; i < 60; i++) {
      try {
        if ((await pub.getChainId()) === 143) break;
      } catch {
        await new Promise((r) => setTimeout(r, 250));
      }
    }
    for (const a of [splicer, poor, admin]) {
      await test.impersonateAccount({ address: a });
      await test.setBalance({ address: a, value: 10n ** 20n });
    }
    const deploy = async (file: string, name: string, args: unknown[] = []) => {
      const a = art(file, name);
      const w = createWalletClient({ chain, account: admin, transport: http(URL) });
      const hash = await w.deployContract({ abi: a.abi, bytecode: a.bytecode.object, args });
      const r = await pub.waitForTransactionReceipt({ hash });
      return r.contractAddress!;
    };
    const nft = await deploy('Mocks.sol', 'MockChogs');
    // mock $CHOG code at the REAL $CHOG address, so the app's CHOG_TOKEN constant is exercised as-is
    await test.setCode({ address: CHOG_TOKEN, bytecode: art('Mocks.sol', 'MockChogToken').deployedBytecode.object });
    const adminW = createWalletClient({ chain, account: admin, transport: http(URL) });
    const mocks = art('Mocks.sol', 'MockChogs').abi;
    const tok = art('Mocks.sol', 'MockChogToken').abi;
    for (const [to, id] of [[holderA, 1n], [holderB, 2n], [holderA, 3n]] as const) {
      await pub.waitForTransactionReceipt({ hash: await adminW.writeContract({ address: nft, abi: mocks, functionName: 'mint', args: [to, id] }) });
    }
    await pub.waitForTransactionReceipt({ hash: await adminW.writeContract({ address: CHOG_TOKEN, abi: tok, functionName: 'mint', args: [splicer, 1_000n * 10n ** 18n] }) });
    await pub.waitForTransactionReceipt({ hash: await adminW.writeContract({ address: CHOG_TOKEN, abi: tok, functionName: 'mint', args: [poor, 5n * 10n ** 18n] }) });
    registry = await deploy('ChogBreakRegistry.sol', 'ChogBreakRegistry', [nft, CHOG_TOKEN, 10_000n * 10n ** 18n, FEE, prize, admin]);
  }, 60_000);

  afterAll(() => {
    anvil?.kill();
  });

  it('the app ABI matches the compiled contract', () => {
    const compiled = art('ChogBreakRegistry.sol', 'ChogBreakRegistry').abi;
    const sigs = (abi: Abi) => new Set(abi.filter((x) => x.type === 'function' || x.type === 'event' || x.type === 'error').map((x) => toFunctionSignature(x as never)));
    const theirs = sigs(compiled);
    for (const s of sigs(REGISTRY_ABI as unknown as Abi)) expect(theirs.has(s), s).toBe(true);
  });

  it('first record: approves EXACTLY the fee, pays both owners, reports FIRST DISCOVERY', async () => {
    const steps: string[] = [];
    const r = await recordSplice(read, walletFor(splicer), registry, splicer, 2, 1, (s) => steps.push(s));
    expect(steps).toEqual(['checking', 'approve', 'approving', 'record', 'recording', 'done']);
    expect(r.first).toBe(true);
    expect([r.lo, r.hi]).toEqual([1, 2]);
    expect([r.ownerLo, r.ownerHi]).toEqual([holderA, holderB]);
    expect([r.shareLo, r.shareHi, r.prize, r.burned]).toEqual([35n * 10n ** 18n, 35n * 10n ** 18n, 20n * 10n ** 18n, 10n * 10n ** 18n]);
    // the approval was for the exact fee, never unlimited
    const approveReceipt = await pub.getTransactionReceipt({ hash: r.approveTx! });
    const [approval] = parseEventLogs({ abi: art('Mocks.sol', 'MockChogToken').abi, logs: approveReceipt.logs, eventName: 'Approval' }) as unknown as { args: { value: bigint } }[];
    expect(approval!.args.value).toBe(FEE);
    const bal = (a: Address) => pub.readContract({ address: CHOG_TOKEN, abi: ERC20_ABI, functionName: 'balanceOf', args: [a] });
    expect(await bal(holderA)).toBe(35n * 10n ** 18n);
    expect(await bal(holderB)).toBe(35n * 10n ** 18n);
    expect(await bal(prize)).toBe(20n * 10n ** 18n);
    expect(await bal(DEAD_ADDRESS)).toBe(10n * 10n ** 18n);
    expect(await pub.readContract({ address: CHOG_TOKEN, abi: ERC20_ABI, functionName: 'allowance', args: [splicer, registry] })).toBe(0n);
  }, 30_000);

  it('second record of the same pair: no new discovery; pair and token stats readable', async () => {
    const r = await recordSplice(read, walletFor(splicer), registry, splicer, 1, 2);
    expect(r.first).toBe(false);
    const p = await readPairRecord(read, registry, 2, 1);
    expect(p.discoverer).toBe(splicer);
    expect(p.count).toBe(2);
    expect(p.discoveredAt).toBeGreaterThan(0);
    expect(await readTokenStats(read, registry, 1)).toEqual({ uses: 2, earned: 70n * 10n ** 18n });
    expect(await readPairRecord(read, registry, 1, 3)).toEqual({ discoverer: null, discoveredAt: null, count: 0 });
  }, 30_000);

  it('not enough $CHOG: shows required vs available, nothing sent', async () => {
    const err = await recordSplice(read, walletFor(poor), registry, poor, 1, 3).catch((e) => e);
    expect(err).toBeInstanceOf(RecordError);
    expect(err.code).toBe('INSUFFICIENT_CHOG');
    expect(recordErrorMessage(err)).toBe('You need 100 $CHOG and have 5.');
  });

  it('wallet on another chain: WRONG_CHAIN before anything else', async () => {
    const w: RegistryWriter = { getChainId: async () => 1, writeContract: async () => { throw new Error('must not be called'); } };
    const err = await recordSplice(read, w, registry, splicer, 1, 3).catch((e) => e);
    expect(err.code).toBe('WRONG_CHAIN');
  });

  it('user rejects in the wallet: "Experiment cancelled. Nothing was recorded."', async () => {
    const w: RegistryWriter = {
      getChainId: async () => 143,
      writeContract: async () => {
        throw Object.assign(new Error('User rejected the request.'), { code: 4001 });
      },
    };
    const err = await recordSplice(read, w, registry, splicer, 1, 3).catch((e) => e);
    expect(err.code).toBe('REJECTED');
    expect(recordErrorMessage(err)).toBe('Experiment cancelled. Nothing was recorded.');
  });
});
