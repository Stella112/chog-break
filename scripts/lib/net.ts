import { createPublicClient, defineChain, http } from 'viem';
import { CHAIN_ID, IPFS_GATEWAYS, MULTICALL3, RPC_URL } from '../../src/config/chain';

export const rpcUrl = process.env.MONAD_RPC_URL || RPC_URL;

export const monad = defineChain({
  id: CHAIN_ID,
  name: 'Monad',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
  contracts: { multicall3: { address: MULTICALL3 } },
});

export const client = createPublicClient({ chain: monad, transport: http(rpcUrl, { retryCount: 4, timeout: 30_000 }) });

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function ipfsToPaths(uri: string): string | null {
  return uri.startsWith('ipfs://') ? uri.slice('ipfs://'.length) : null;
}

type FetchFn = (url: string) => Promise<Response>;

/** Gateway fallback + exponential backoff. Returns the response body bytes. */
export async function fetchWithFallback(
  uri: string,
  { fetchFn = fetch as FetchFn, gateways = IPFS_GATEWAYS, attempts = 4, baseDelay = 500 } = {},
): Promise<Uint8Array> {
  const path = ipfsToPaths(uri);
  const urls = path ? gateways.map((g) => g + path) : [uri];
  let lastErr: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    for (const url of urls) {
      try {
        const res = await fetchFn(url);
        if (res.ok) return new Uint8Array(await res.arrayBuffer());
        lastErr = new Error(`${res.status} ${url}`);
      } catch (e) {
        lastErr = e;
      }
    }
    await sleep(baseDelay * 2 ** attempt);
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]!);
      }
    }),
  );
  return out;
}
