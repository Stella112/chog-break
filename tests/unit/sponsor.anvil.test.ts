// Sponsor (sponsor/core.mjs) against the REAL compiled ChogBreakRegistry v2 on a local anvil chain (id 143).
// Keys here are generated fresh for each run (test-only, never funded anywhere real).
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createPublicClient,
  createTestClient,
  createWalletClient,
  getAddress,
  http,
  type Abi,
  type Address,
  type Hex,
} from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { CHOG_GENESIS, CHOG_TOKEN } from '../../src/config/chain';
import { monad } from '../../src/chain/client';
import { sponsorMessage as appMessage } from '../../src/chain/sponsorMessage';
// @ts-expect-error plain ESM module without types
import { createSponsor, memoryStore, sponsorMessage, SponsorError, WINDOW_MS } from '../../sponsor/core.mjs';

const OUT = 'contracts/out';
const art = (f: string, n: string) => JSON.parse(readFileSync(`${OUT}/${f}/${n}.json`, 'utf8')) as { abi: Abi; bytecode: { object: Hex }; deployedBytecode: { object: Hex } };
const ready =
  spawnSync('anvil', ['--version']).status === 0 &&
  existsSync(`${OUT}/ChogBreakRegistry.sol/ChogBreakRegistry.json`) &&
  JSON.stringify(art('ChogBreakRegistry.sol', 'ChogBreakRegistry').abi).includes('recordSpliceFor');

const PORT = 20_000 + Math.floor(Math.random() * 20_000);
const URL = `http://127.0.0.1:${PORT}`;
const chain = { ...monad, rpcUrls: { default: { http: [URL] } } };
const FEE = 10n * 10n ** 18n;
const admin = getAddress('0x000000000000000000000000000000000000ad31');
const holderA = getAddress('0x00000000000000000000000000000000000000a1');
const holderB = getAddress('0x00000000000000000000000000000000000000b2');

describe.skipIf(!ready)('sponsor ↔ ChogBreakRegistry v2 on anvil', () => {
  let anvil: ChildProcess;
  const pub = createPublicClient({ chain, transport: http(URL) });
  const test = createTestClient({ chain, mode: 'anvil', transport: http(URL) });
  const relayerAcct = privateKeyToAccount(generatePrivateKey());
  const relayerWallet = createWalletClient({ chain, account: relayerAcct, transport: http(URL) });
  let registry: Address;
  let clock = Date.parse('2026-10-21T12:00:00Z');
  const now = () => clock;
  const tok = () => art('Mocks.sol', 'MockChogToken').abi;
  const bal = (a: Address) => pub.readContract({ address: CHOG_TOKEN, abi: tok(), functionName: 'balanceOf', args: [a] }) as Promise<bigint>;

  const claimBody = async (pk: Hex, a: number, b: number, issuedAt = new Date(clock).toISOString(), signAs?: Hex) => {
    const player = privateKeyToAccount(pk);
    const signer = privateKeyToAccount(signAs ?? pk);
    const signature = await signer.signMessage({ message: sponsorMessage({ address: player.address, a, b, issuedAt }) });
    return { address: player.address, a, b, issuedAt, signature };
  };
  const mk = (dailyCap = 30) =>
    createSponsor({ publicClient: pub, walletClient: relayerWallet, registry, dailyCap, store: memoryStore(), now });

  beforeAll(async () => {
    anvil = spawn('anvil', ['--port', String(PORT), '--chain-id', '143', '--silent'], { stdio: 'ignore' });
    for (let i = 0; i < 80; i++) {
      try {
        if ((await pub.getChainId()) === 143) break;
      } catch {
        await new Promise((r) => setTimeout(r, 250));
      }
    }
    await test.impersonateAccount({ address: admin });
    await test.setBalance({ address: admin, value: 10n ** 20n });
    await test.setBalance({ address: relayerAcct.address, value: 10n ** 19n });
    await test.setCode({ address: CHOG_GENESIS, bytecode: art('Mocks.sol', 'MockChogs').deployedBytecode.object });
    await test.setCode({ address: CHOG_TOKEN, bytecode: art('Mocks.sol', 'MockChogToken').deployedBytecode.object });
    const w = createWalletClient({ chain, account: admin, transport: http(URL) });
    const send = async (address: Address, abi: Abi, functionName: string, args: unknown[]) =>
      pub.waitForTransactionReceipt({ hash: await w.writeContract({ address, abi, functionName, args } as never) });
    for (let id = 1n; id <= 6n; id++) await send(CHOG_GENESIS, art('Mocks.sol', 'MockChogs').abi, 'mint', [id % 2n ? holderA : holderB, id]);
    await send(CHOG_TOKEN, tok(), 'mint', [relayerAcct.address, 30n * FEE]); // enough for 30 recordings
    const reg = art('ChogBreakRegistry.sol', 'ChogBreakRegistry');
    const hash = await w.deployContract({ abi: reg.abi, bytecode: reg.bytecode.object, args: [CHOG_GENESIS, CHOG_TOKEN, 10_000n * 10n ** 18n, FEE, admin, admin] });
    registry = (await pub.waitForTransactionReceipt({ hash })).contractAddress!;
  }, 60_000);

  afterAll(() => {
    anvil?.kill();
  });

  it('the app and the server sign the same text', () => {
    const p = { address: holderA.toLowerCase(), a: 9, b: 3, issuedAt: '2026-10-21T12:00:00.000Z' };
    expect(appMessage(p)).toBe(sponsorMessage(p));
    expect(appMessage(p)).toContain('Pair: token 3 x token 9');
  });

  it('a signed claim records for the player: relayer pays the exact fee, player pays nothing, player is the discoverer', async () => {
    const s = mk();
    const pk = generatePrivateKey();
    const player = privateKeyToAccount(pk).address;
    const r0 = await bal(relayerAcct.address);
    const r = await s.claim(await claimBody(pk, 2, 1), '1.1.1.1');
    expect(r.first).toBe(true);
    expect(r.splicer).toBe(player);
    expect(r.payer).toBe(relayerAcct.address);
    expect([r.lo, r.hi]).toEqual([1, 2]);
    expect(r0 - (await bal(relayerAcct.address))).toBe(FEE);
    expect(await bal(player)).toBe(0n);
    expect(await pub.getBalance({ address: player })).toBe(0n); // never needed gas
    expect(await pub.readContract({ address: CHOG_TOKEN, abi: tok(), functionName: 'allowance', args: [relayerAcct.address, registry] })).toBe(0n);
    expect((await s.status(player, '1.1.1.1')).eligible).toBe(false);
  }, 60_000);

  it('48 h per wallet and per IP; eligible again after the window', async () => {
    const s = mk();
    const pk = generatePrivateKey();
    await s.claim(await claimBody(pk, 3, 4), '2.2.2.2');
    const again = await s.claim(await claimBody(pk, 5, 6), '9.9.9.9').catch((e: SponsorError) => e);
    expect(again.code).toBe('RATE_LIMITED'); // same wallet, new IP
    const sameIp = await s.claim(await claimBody(generatePrivateKey(), 5, 6), '2.2.2.2').catch((e: SponsorError) => e);
    expect(sameIp.code).toBe('RATE_LIMITED'); // same IP, new wallet
    clock += WINDOW_MS + 1000;
    const r = await s.claim(await claimBody(pk, 5, 6), '2.2.2.2');
    expect(r.splicer).toBe(privateKeyToAccount(pk).address);
  }, 60_000);

  it('rejects forged, expired and replayed signatures without spending anything', async () => {
    const s = mk();
    const r0 = await bal(relayerAcct.address);
    const pk = generatePrivateKey();
    const forged = await s.claim(await claimBody(pk, 1, 3, undefined, generatePrivateKey()), '3.3.3.3').catch((e: SponsorError) => e);
    expect(forged.code).toBe('BAD_SIGNATURE');
    const old = await s.claim(await claimBody(pk, 1, 3, new Date(clock - 11 * 60_000).toISOString()), '3.3.3.3').catch((e: SponsorError) => e);
    expect(old.code).toBe('EXPIRED');
    const body = await claimBody(pk, 1, 3);
    const replay = await s.claim({ ...body, a: 1, b: 5 }, '3.3.3.3').catch((e: SponsorError) => e); // signature was for 1×3
    expect(replay.code).toBe('BAD_SIGNATURE');
    const bad = await s.claim({ ...body, a: 7, b: 7 }, '3.3.3.3').catch((e: SponsorError) => e);
    expect(bad.code).toBe('BAD_PAIR');
    expect(await bal(relayerAcct.address)).toBe(r0);
  }, 60_000);

  it('daily cap stops sponsoring for the day', async () => {
    const s = mk(1);
    await s.claim(await claimBody(generatePrivateKey(), 1, 4), '4.4.4.4');
    const capped = await s.claim(await claimBody(generatePrivateKey(), 1, 5), '5.5.5.5').catch((e: SponsorError) => e);
    expect(capped.code).toBe('DAILY_CAP');
    expect((await s.status(undefined, '6.6.6.6')).remainingToday).toBe(0);
  }, 60_000);

  it('an empty relayer answers SPONSOR_EMPTY instead of failing on-chain', async () => {
    const emptyAcct = privateKeyToAccount(generatePrivateKey());
    await test.setBalance({ address: emptyAcct.address, value: 10n ** 18n });
    const s = createSponsor({
      publicClient: pub,
      walletClient: createWalletClient({ chain, account: emptyAcct, transport: http(URL) }),
      registry,
      dailyCap: 30,
      store: memoryStore(),
      now,
    });
    expect(await s.status(undefined, '7.7.7.7')).toMatchObject({ eligible: false, funded: false });
    const e = await s.claim(await claimBody(generatePrivateKey(), 2, 3), '7.7.7.7').catch((x: SponsorError) => x);
    expect(e.code).toBe('SPONSOR_EMPTY');
  }, 60_000);
});
