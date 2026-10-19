// §D9 wallet: injected provider (window.ethereum) via viem. Read-only in this build: no transactions.
import { createPublicClient, createWalletClient, custom, defineChain, http, type Address, type EIP1193Provider } from 'viem';
import { CHAIN_ID, MULTICALL3, RPC_URL } from '../config/chain';

export const monad = defineChain({
  id: CHAIN_ID,
  name: 'Monad',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  contracts: { multicall3: { address: MULTICALL3 } },
});

/** Reads go straight to the public RPC (CORS-enabled), never through the wallet. */
export const publicClient = createPublicClient({ chain: monad, transport: http(RPC_URL, { retryCount: 2, timeout: 20_000 }) });

type InjectedProvider = EIP1193Provider & {
  on?: (event: string, cb: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, cb: (...args: unknown[]) => void) => void;
};

export function injected(): InjectedProvider | null {
  if (typeof window === 'undefined') return null;
  return ((window as unknown as { ethereum?: InjectedProvider }).ethereum ?? null) as InjectedProvider | null;
}

export async function connectWallet(): Promise<{ address: Address; chainId: number }> {
  const provider = injected();
  if (!provider) throw new Error('NO_WALLET');
  const wallet = createWalletClient({ transport: custom(provider) });
  const [address] = await wallet.requestAddresses();
  if (!address) throw new Error('NO_ACCOUNT');
  const chainId = await wallet.getChainId();
  return { address, chainId };
}

/** "Switch to Monad": switch, or add the chain first if the wallet doesn't know it (EIP-3085). */
export async function switchToMonad(): Promise<void> {
  const provider = injected();
  if (!provider) throw new Error('NO_WALLET');
  const chainIdHex = `0x${CHAIN_ID.toString(16)}`;
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chainIdHex }] });
  } catch (e) {
    const code = (e as { code?: number }).code;
    // 4902: unrecognized chain. (Some wallets wrap it in -32603 with data.originalError.code.)
    const inner = (e as { data?: { originalError?: { code?: number } } }).data?.originalError?.code;
    if (code !== 4902 && inner !== 4902) throw e;
    await provider.request({
      method: 'wallet_addEthereumChain',
      // Verified: chain ID 143, native MON, public RPC answers eth_chainId 0x8f (docs/CHAIN_CHECK.md).
      // No blockExplorerUrls: the explorer is not yet verified.
      params: [{ chainId: chainIdHex, chainName: 'Monad', nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 }, rpcUrls: [RPC_URL] }],
    });
  }
}

export function watchWallet(onAccounts: (a: Address | null) => void, onChain: (id: number) => void): () => void {
  const provider = injected();
  if (!provider?.on) return () => {};
  const acc = (...args: unknown[]) => {
    const list = args[0] as string[] | undefined;
    onAccounts((list?.[0] as Address | undefined) ?? null);
  };
  const ch = (...args: unknown[]) => onChain(parseInt(String(args[0]), 16));
  provider.on('accountsChanged', acc);
  provider.on('chainChanged', ch);
  return () => {
    provider.removeListener?.('accountsChanged', acc);
    provider.removeListener?.('chainChanged', ch);
  };
}

export const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
