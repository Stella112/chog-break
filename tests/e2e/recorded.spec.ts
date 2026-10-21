// Recorded Splice end to end, in a real browser, against the REAL compiled ChogBreakRegistry on a local anvil
// chain (chain id 143). Mock Chog Genesis and mock $CHOG code sit at the real addresses, Multicall3 code is
// copied from Monad, and a test wallet forwards every request to anvil (impersonated account: no keys).
// Needs anvil and `cd contracts && forge build`; skipped otherwise.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
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
import { CHOG_GENESIS, CHOG_TOKEN, MULTICALL3, RPC_URL } from '../../src/config/chain';
import { monad } from '../../src/chain/client';

const OUT = 'contracts/out';
const art = (file: string, name: string) =>
  JSON.parse(readFileSync(`${OUT}/${file}/${name}.json`, 'utf8')) as { abi: Abi; bytecode: { object: Hex }; deployedBytecode: { object: Hex } };
const ready = spawnSync('anvil', ['--version'], { shell: true }).status === 0 && existsSync(`${OUT}/ChogBreakRegistry.sol/ChogBreakRegistry.json`);

// a fresh port per run, so a stale chain from an earlier run can never be reused
const PORT = 20_000 + Math.floor(Math.random() * 20_000);
const URL = `http://127.0.0.1:${PORT}`;
const chain = { ...monad, rpcUrls: { default: { http: [URL] } } };
const user = getAddress('0x00000000000000000000000000000000000A11CE');
const holderB = getAddress('0x00000000000000000000000000000000000000B2');
const admin = getAddress('0x000000000000000000000000000000000000AD31');
const prize = getAddress('0x0000000000000000000000000000000000000922');
const FEE = 100n * 10n ** 18n;

test.describe.configure({ mode: 'serial' });
test.skip(!ready, 'needs anvil + forge build');

let anvil: ChildProcess;
let registry: Address;
const pub = createPublicClient({ chain, transport: http(URL) });

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
  for (const a of [user, admin]) {
    await t.impersonateAccount({ address: a });
    await t.setBalance({ address: a, value: 10n ** 20n });
  }
  // real Multicall3 bytecode from Monad, so the app's ownership scan runs unchanged
  const mainnet = createPublicClient({ transport: http(RPC_URL) });
  await t.setCode({ address: MULTICALL3, bytecode: (await mainnet.getCode({ address: MULTICALL3 }))! });
  await t.setCode({ address: CHOG_GENESIS, bytecode: art('Mocks.sol', 'MockChogs').deployedBytecode.object });
  await t.setCode({ address: CHOG_TOKEN, bytecode: art('Mocks.sol', 'MockChogToken').deployedBytecode.object });
  const w = createWalletClient({ chain, account: admin, transport: http(URL) });
  const send = async (address: Address, abi: Abi, functionName: string, args: unknown[]) =>
    pub.waitForTransactionReceipt({ hash: await w.writeContract({ address, abi, functionName, args } as never) });
  const nftAbi = art('Mocks.sol', 'MockChogs').abi;
  await send(CHOG_GENESIS, nftAbi, 'mint', [user, 1n]); // the user holds token 1 (CHOG #1462)
  await send(CHOG_GENESIS, nftAbi, 'mint', [holderB, 2n]);
  await send(CHOG_TOKEN, art('Mocks.sol', 'MockChogToken').abi, 'mint', [user, 1_000n * 10n ** 18n]);
  const reg = art('ChogBreakRegistry.sol', 'ChogBreakRegistry');
  const hash = await w.deployContract({ abi: reg.abi, bytecode: reg.bytecode.object, args: [CHOG_GENESIS, CHOG_TOKEN, 10_000n * 10n ** 18n, FEE, prize, admin] });
  registry = (await pub.waitForTransactionReceipt({ hash })).contractAddress!;
});

test.afterAll(() => {
  anvil?.kill();
});

/** A wallet that answers accounts/chain itself and forwards everything else (incl. eth_sendTransaction) to anvil. */
function testWallet(rpc: string, account: string, reg: string) {
  return `(() => {
    window.__chogbreakTestChain = { rpc: '${rpc}', registry: '${reg}' };
    window.__sent = [];
    let id = 0;
    window.ethereum = {
      on() {}, removeListener() {},
      request: async ({ method, params }) => {
        if (method === 'eth_requestAccounts' || method === 'eth_accounts') return ['${account}'];
        if (method === 'eth_chainId') return '0x8f';
        if (method === 'wallet_switchEthereumChain') return null;
        if (method === 'eth_sendTransaction') window.__sent.push(params[0]);
        const r = await fetch('${rpc}', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params: params ?? [] }) }).then((x) => x.json());
        if (r.error) { const e = new Error(r.error.message); e.code = r.error.code; e.data = r.error.data; throw e; }
        return r.result;
      },
    };
  })();`;
}

const balanceOf = (a: Address) =>
  pub.readContract({ address: CHOG_TOKEN, abi: art('Mocks.sol', 'MockChogToken').abi, functionName: 'balanceOf', args: [a] }) as Promise<bigint>;

test('Recorded Splice: exact approval, FIRST DISCOVERY!, owners paid, notebook + MY CHOGS show it', async ({ page }) => {
  test.setTimeout(180_000);
  await page.addInitScript(testWallet(URL, user, registry));
  await page.goto('/?test=1');
  await page.getByRole('button', { name: 'CONNECT WALLET' }).first().click();
  await expect(page.getByText(/0x0000…11ce/i).first()).toBeVisible();
  await page.getByRole('button', { name: 'ENTER THE LAB' }).click();

  // no RECORDED SPLICE until two Chogs are loaded
  await expect(page.getByRole('button', { name: 'RECORDED SPLICE' })).toHaveCount(0);
  const search = page.getByPlaceholder('Number or trait (crown, laser…)');
  await search.fill('1');
  await page.locator('.cell').first().click();
  await search.fill('2');
  await page.locator('.cell').first().click();
  await page.getByRole('button', { name: 'RECORDED SPLICE' }).click();

  const panel = page.getByRole('dialog', { name: 'Recorded Splice' });
  await expect(panel.getByText('100 $CHOG', { exact: false }).first()).toBeVisible({ timeout: 30_000 });
  await expect(panel.getByText(/35 → owner of CHOG #1462/)).toBeVisible();
  await expect(panel.getByText('20 → prize pool')).toBeVisible();
  await expect(panel.getByText('10 → sent to the dead address')).toBeVisible();
  await expect(panel.getByText(/Nobody has recorded this pair yet/)).toBeVisible();
  await expect(panel.getByText(/approve exactly 100 \$CHOG, then record/)).toBeVisible();

  const b0 = await balanceOf(holderB);
  await panel.getByRole('button', { name: 'CONFIRM IN WALLET' }).click();
  await expect(page.getByText('FIRST DISCOVERY!')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/ON-CHAIN · first discovered by 0x0000…11ce/i)).toBeVisible({ timeout: 30_000 });

  // two transactions: approve (exact fee, never unlimited) then recordSplice
  const sent = (await page.evaluate(() => (window as any).__sent)) as { to: string; data: string }[];
  expect(sent).toHaveLength(2);
  expect(sent[0]!.to.toLowerCase()).toBe(CHOG_TOKEN.toLowerCase());
  expect(sent[0]!.data.slice(0, 10)).toBe('0x095ea7b3'); // approve(address,uint256)
  expect(BigInt('0x' + sent[0]!.data.slice(74))).toBe(FEE);
  expect(sent[1]!.to.toLowerCase()).toBe(registry.toLowerCase());

  // the user owns token 1, so they get their own 35% back; holder of token 2 gets 35
  expect((await balanceOf(holderB)) - b0).toBe(35n * 10n ** 18n);
  expect(await balanceOf(prize)).toBe(20n * 10n ** 18n);

  await page.getByRole('button', { name: 'NOTEBOOK', exact: true }).click();
  await expect(page.locator('.badge-onchain').first()).toBeVisible();

  await page.getByRole('button', { name: 'MY CHOGS' }).first().click();
  await expect(page.getByText(/used in 1 recorded splice · earned its holders 35 \$CHOG/)).toBeVisible({ timeout: 30_000 });
});

test('recording the same pair again: RECORDED ON MONAD (not a new discovery), no second approval if allowance covers it', async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(testWallet(URL, user, registry));
  await page.goto('/?test=1');
  await page.getByRole('button', { name: 'CONNECT WALLET' }).first().click();
  await page.getByRole('button', { name: 'ENTER THE LAB' }).click();
  const search = page.getByPlaceholder('Number or trait (crown, laser…)');
  await search.fill('2');
  await page.locator('.cell').first().click();
  await search.fill('1');
  await page.locator('.cell').first().click();
  await page.getByRole('button', { name: 'RECORDED SPLICE' }).click();
  const panel = page.getByRole('dialog', { name: 'Recorded Splice' });
  await expect(panel.getByText(/First discovered by 0x0000…11ce · recorded 1 time\./i)).toBeVisible({ timeout: 30_000 });
  await panel.getByRole('button', { name: 'CONFIRM IN WALLET' }).click();
  await expect(page.getByText('RECORDED ON MONAD')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/recorded 2×/)).toBeVisible({ timeout: 30_000 });
});

test('guest (no wallet): no RECORDED SPLICE, the free splice is unchanged', async ({ page }) => {
  // the production registry is deployed, so RECORDED SPLICE exists, but only for a connected wallet
  await page.goto('/play/');
  await page.getByRole('button', { name: 'ENTER THE LAB' }).click();
  await page.locator('.cell').nth(0).click();
  await page.locator('.cell').nth(1).click();
  await expect(page.getByRole('button', { name: 'SPLICE', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'RECORDED SPLICE' })).toHaveCount(0);
});
