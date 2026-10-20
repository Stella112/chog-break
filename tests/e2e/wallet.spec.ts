import { createPublicClient, http, parseAbi } from 'viem';
import { expect, test } from '@playwright/test';
import { CHOG_GENESIS, RPC_URL } from '../../src/config/chain';

// Holder mode with a mock EIP-1193 wallet (test-only). The address is a REAL current holder,
// looked up on Monad at test time, so the app must find its real Chog on-chain.

const client = createPublicClient({ transport: http(RPC_URL) });
const abi = parseAbi(['function ownerOf(uint256) view returns (address)']);

function mockWallet(address: string, startChain: string) {
  return `(() => {
    let chainId = '${startChain}';
    const listeners = {};
    const emit = (ev, v) => (listeners[ev] || []).forEach((cb) => cb(v));
    window.__walletCalls = [];
    window.ethereum = {
      isMock: true,
      on: (ev, cb) => ((listeners[ev] = listeners[ev] || []).push(cb)),
      removeListener: (ev, cb) => (listeners[ev] = (listeners[ev] || []).filter((x) => x !== cb)),
      request: async ({ method, params }) => {
        window.__walletCalls.push(method);
        if (method === 'eth_requestAccounts' || method === 'eth_accounts') return ['${address}'];
        if (method === 'eth_chainId') return chainId;
        if (method === 'wallet_switchEthereumChain') {
          if (chainId !== '0x8f' && !window.__monadKnown) { const e = new Error('Unrecognized chain'); e.code = 4902; throw e; }
          chainId = params[0].chainId; emit('chainChanged', chainId); return null;
        }
        if (method === 'wallet_addEthereumChain') { window.__addedChain = params[0]; window.__monadKnown = true; chainId = params[0].chainId; emit('chainChanged', chainId); return null; }
        throw new Error('unsupported in mock: ' + method);
      },
    };
  })();`;
}

test('connect → wrong network → Switch to Monad (adds chain) → MY CHOGS lists the real holding', async ({ page }) => {
  test.setTimeout(120_000);
  const owner = await client.readContract({ address: CHOG_GENESIS, abi, functionName: 'ownerOf', args: [1n] });
  await page.addInitScript(mockWallet(owner, '0x1'));
  await page.goto('/');
  await page.getByRole('button', { name: 'MY CHOGS' }).click();
  await page.getByRole('button', { name: 'CONNECT WALLET' }).first().click();
  await expect(page.getByText(/WALLET 0x/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'SWITCH TO MONAD' }).first()).toBeVisible();
  // Ownership is read from Monad directly, so it works even before switching.
  await expect(page.getByText(/YOU HOLD \d+ CHOG/)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('heading', { name: 'CHOG #1462' })).toBeVisible(); // token 1 is named "CHOG #1462"
  await page.getByRole('button', { name: 'SWITCH TO MONAD' }).first().click();
  await expect(page.getByRole('button', { name: 'SWITCH TO MONAD' })).toHaveCount(0);
  const added = await page.evaluate(() => (window as any).__addedChain);
  expect(added).toMatchObject({ chainId: '0x8f', chainName: 'Monad', nativeCurrency: { symbol: 'MON', decimals: 18 } });
  expect(await page.evaluate(() => (window as any).__walletCalls)).not.toContain('eth_sendTransaction');

  // Holder can splice their own Chog: SPLICE WITH… loads it into chamber A, and the Lab shows a MY CHOGS tab.
  await page.getByRole('button', { name: 'SPLICE WITH… ▸' }).first().click();
  await expect(page.locator('.chamber-a.is-loaded')).toBeVisible();
  await page.getByRole('radio', { name: /MY CHOGS \(\d+\)/ }).click();
  await expect(page.locator('.cell').first()).toBeVisible();

  // Holder perks (cosmetic): YOURS tag in the grid, HOLDER SPLICE on the reveal, YOUR CHOG in the notebook.
  await expect(page.locator('.cell .cell-own').first()).toBeVisible();
  await page.getByRole('radio', { name: 'ALL CHOGS' }).click();
  await page.getByPlaceholder('Number or trait (crown, laser…)').fill('1500');
  await page.locator('.cell').first().click();
  await page.getByRole('button', { name: 'SPLICE' }).click();
  await expect(page.getByText(/HOLDER SPLICE · you hold CHOG #1462/)).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'NOTEBOOK', exact: true }).click();
  await expect(page.locator('.badge-holder').first()).toBeVisible();
});

test('no wallet installed: friendly message, guest flow untouched', async ({ page }) => {
  await page.goto('/?view=mychogs');
  await expect(page.getByText('No browser wallet found', { exact: false }).first()).toBeVisible();
  await page.getByRole('button', { name: 'LAB' }).click();
  await expect(page.getByPlaceholder('Number or trait (crown, laser…)')).toBeVisible();
});

test('rejected connection shows "Request cancelled"', async ({ page }) => {
  await page.addInitScript(`window.ethereum = { on() {}, removeListener() {}, request: async ({ method }) => { if (method === 'eth_requestAccounts') { const e = new Error('User rejected the request.'); e.code = 4001; throw e; } return null; } };`);
  await page.goto('/?view=mychogs');
  await page.getByRole('button', { name: 'CONNECT WALLET' }).last().click();
  await expect(page.getByText('Request cancelled. Nothing changed.').first()).toBeVisible();
});
