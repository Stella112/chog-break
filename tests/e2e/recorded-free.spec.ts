// RECORD FREE end to end: real browser → real sponsor server (sponsor/server.mjs) → real compiled registry v2 on
// a local anvil chain (id 143). The player has 0 MON and 0 $CHOG and only signs a message; the sponsor pays.
// The player is anvil's well-known dev account #0 (unlocked by anvil, so personal_sign works; not a real key).
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { createPublicClient, createTestClient, createWalletClient, getAddress, http, type Abi, type Address, type Hex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { CHOG_GENESIS, CHOG_TOKEN, MULTICALL3, RPC_URL } from '../../src/config/chain';
import { monad } from '../../src/chain/client';

const OUT = 'contracts/out';
const art = (f: string, n: string) => JSON.parse(readFileSync(`${OUT}/${f}/${n}.json`, 'utf8')) as { abi: Abi; bytecode: { object: Hex }; deployedBytecode: { object: Hex } };
const ready =
  spawnSync('anvil', ['--version']).status === 0 &&
  existsSync(`${OUT}/ChogBreakRegistry.sol/ChogBreakRegistry.json`) &&
  JSON.stringify(art('ChogBreakRegistry.sol', 'ChogBreakRegistry').abi).includes('recordSpliceFor');

const PORT = 20_000 + Math.floor(Math.random() * 20_000);
const SPONSOR_PORT = PORT + 1;
const URL = `http://127.0.0.1:${PORT}`;
const SPONSOR = `http://127.0.0.1:${SPONSOR_PORT}`;
const chain = { ...monad, rpcUrls: { default: { http: [URL] } } };
const player = getAddress('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'); // anvil dev account #0
const holderA = getAddress('0x00000000000000000000000000000000000000a1');
const holderB = getAddress('0x00000000000000000000000000000000000000b2');
const admin = getAddress('0x000000000000000000000000000000000000ad31');
const FEE = 10n * 10n ** 18n;

test.describe.configure({ mode: 'serial' });
test.skip(!ready, 'needs anvil + forge build (registry v2)');

let anvil: ChildProcess;
let sponsor: ChildProcess;
let registry: Address;
const relayerKey = generatePrivateKey(); // test-only, local chain
const relayer = privateKeyToAccount(relayerKey);
const pub = createPublicClient({ chain, transport: http(URL) });
const tokAbi = () => art('Mocks.sol', 'MockChogToken').abi;
const bal = (a: Address) => pub.readContract({ address: CHOG_TOKEN, abi: tokAbi(), functionName: 'balanceOf', args: [a] }) as Promise<bigint>;

test.beforeAll(async () => {
  test.setTimeout(120_000);
  anvil = spawn('anvil', ['--port', String(PORT), '--chain-id', '143', '--silent'], { stdio: 'ignore' });
  for (let i = 0; i < 80; i++) {
    try {
      if ((await pub.getChainId()) === 143) break;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  const t = createTestClient({ chain, mode: 'anvil', transport: http(URL) });
  await t.impersonateAccount({ address: admin });
  await t.setBalance({ address: admin, value: 10n ** 20n });
  await t.setBalance({ address: relayer.address, value: 10n ** 19n });
  await t.setBalance({ address: player, value: 0n }); // the player has no MON at all
  const mainnet = createPublicClient({ transport: http(RPC_URL) });
  await t.setCode({ address: MULTICALL3, bytecode: (await mainnet.getCode({ address: MULTICALL3 }))! });
  await t.setCode({ address: CHOG_GENESIS, bytecode: art('Mocks.sol', 'MockChogs').deployedBytecode.object });
  await t.setCode({ address: CHOG_TOKEN, bytecode: art('Mocks.sol', 'MockChogToken').deployedBytecode.object });
  const w = createWalletClient({ chain, account: admin, transport: http(URL) });
  const send = async (address: Address, abi: Abi, functionName: string, args: unknown[]) =>
    pub.waitForTransactionReceipt({ hash: await w.writeContract({ address, abi, functionName, args } as never) });
  const nft = art('Mocks.sol', 'MockChogs').abi;
  for (const [to, id] of [[holderA, 1n], [holderB, 2n], [holderA, 3n], [holderB, 4n]] as const) await send(CHOG_GENESIS, nft, 'mint', [to, id]);
  await send(CHOG_TOKEN, tokAbi(), 'mint', [relayer.address, 100n * FEE]);
  const reg = art('ChogBreakRegistry.sol', 'ChogBreakRegistry');
  const hash = await w.deployContract({ abi: reg.abi, bytecode: reg.bytecode.object, args: [CHOG_GENESIS, CHOG_TOKEN, 10_000n * 10n ** 18n, FEE, admin, admin] });
  registry = (await pub.waitForTransactionReceipt({ hash })).contractAddress!;

  // the real sponsor HTTP server, exactly as it runs on the VPS
  sponsor = spawn(process.execPath, ['sponsor/server.mjs'], {
    stdio: 'ignore',
    env: {
      ...process.env,
      RELAYER_PRIVATE_KEY: relayerKey,
      REGISTRY: registry,
      RPC_URL: URL,
      PORT: String(SPONSOR_PORT),
      DAILY_CAP: '30',
      ALLOWED_ORIGINS: 'http://localhost:4173',
      STATE_DIRECTORY: mkdtempSync(join(tmpdir(), 'cb-sponsor-')),
    },
  });
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(`${SPONSOR}/health`)).ok) break;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
});

test.afterAll(() => {
  sponsor?.kill();
  anvil?.kill();
});

function testWallet() {
  return `(() => {
    window.__chogbreakTestChain = { rpc: '${URL}', registry: '${registry}', sponsor: '${SPONSOR}' };
    window.__sent = [];
    let id = 0;
    window.ethereum = {
      on() {}, removeListener() {},
      request: async ({ method, params }) => {
        if (method === 'eth_requestAccounts' || method === 'eth_accounts') return ['${player}'];
        if (method === 'eth_chainId') return '0x8f';
        if (method === 'eth_sendTransaction') window.__sent.push(params[0]);
        const r = await fetch('${URL}', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params: params ?? [] }) }).then((x) => x.json());
        if (r.error) { const e = new Error(r.error.message); e.code = r.error.code; throw e; }
        return r.result;
      },
    };
  })();`;
}

async function openPanel(page: import('@playwright/test').Page, x: string, y: string) {
  await page.addInitScript(testWallet());
  await page.goto('/?test=1');
  await page.getByRole('button', { name: 'CONNECT WALLET' }).first().click();
  await page.getByRole('button', { name: 'ENTER THE LAB' }).click();
  const search = page.getByPlaceholder('Number or trait (crown, laser…)');
  await search.fill(x);
  await page.locator('.cell').first().click();
  await search.fill(y);
  await page.locator('.cell').first().click();
  await page.getByRole('button', { name: 'RECORDED SPLICE' }).click();
  return page.getByRole('dialog', { name: 'Recorded Splice' });
}

test('RECORD FREE: the player only signs; the sponsor pays fee and gas; FIRST DISCOVERY for the player', async ({ page }) => {
  test.setTimeout(180_000);
  const panel = await openPanel(page, '1', '2');
  await expect(panel.getByRole('button', { name: 'RECORD FREE' })).toBeVisible({ timeout: 30_000 });
  await expect(panel.getByRole('button', { name: 'PAY THE FEE MYSELF' })).toBeVisible();
  const r0 = await bal(relayer.address);
  await panel.getByRole('button', { name: 'RECORD FREE' }).click();
  await expect(page.getByText('FIRST DISCOVERY!')).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText(/ON-CHAIN · first discovered by 0xf39F…2266/i)).toBeVisible({ timeout: 30_000 });
  // the player sent no transaction and still has no MON and no $CHOG
  expect(await page.evaluate(() => (window as any).__sent)).toHaveLength(0);
  expect(await pub.getTransactionCount({ address: player })).toBe(0);
  expect(await pub.getBalance({ address: player })).toBe(0n);
  expect(await bal(player)).toBe(0n);
  // the sponsor paid exactly the fee and the parent owners got their 35%
  expect(r0 - (await bal(relayer.address))).toBe(FEE);
  expect(await bal(holderA)).toBe((FEE * 35n) / 100n);
  expect(await bal(holderB)).toBe((FEE * 35n) / 100n);
});

test('a second free recording within 48 h is refused politely', async ({ page }) => {
  test.setTimeout(120_000);
  const panel = await openPanel(page, '3', '4');
  await expect(panel.getByText(/Free recording used\. The next one unlocks/)).toBeVisible({ timeout: 30_000 });
  await expect(panel.getByRole('button', { name: 'RECORD FREE' })).toHaveCount(0);
});
