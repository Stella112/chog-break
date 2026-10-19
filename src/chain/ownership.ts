// §D9 ownership: balanceOf first (0 → no scan), then Multicall3 ownerOf over all token IDs in
// chunks of 250 with allowFailure, stopping early once every owned token is found.
// Never fabricates holdings; never trusts a client-claimed owner.
import { parseAbi, type Address } from 'viem';
import { CHOG_GENESIS } from '../config/chain';

const abi = parseAbi(['function balanceOf(address) view returns (uint256)', 'function ownerOf(uint256) view returns (address)']);

/** The slice of a viem public client this module needs (so tests can pass a fake). */
export type OwnershipReader = {
  readContract(args: { address: Address; abi: typeof abi; functionName: 'balanceOf'; args: [Address] }): Promise<bigint>;
  multicall(args: {
    allowFailure: true;
    contracts: { address: Address; abi: typeof abi; functionName: 'ownerOf'; args: [bigint] }[];
  }): Promise<({ status: 'success'; result: Address } | { status: 'failure'; error: Error })[]>;
};

export type ScanProgress = { scanned: number; total: number; found: number; balance: number };

export async function findOwnedChogs(
  client: OwnershipReader,
  owner: Address,
  tokenIds: readonly number[],
  onProgress?: (p: ScanProgress) => void,
  chunk = 250,
): Promise<number[]> {
  const balance = Number(await client.readContract({ address: CHOG_GENESIS, abi, functionName: 'balanceOf', args: [owner] }));
  onProgress?.({ scanned: 0, total: tokenIds.length, found: 0, balance });
  if (balance === 0) return [];
  const me = owner.toLowerCase();
  const found: number[] = [];
  for (let i = 0; i < tokenIds.length; i += chunk) {
    const ids = tokenIds.slice(i, i + chunk);
    const res = await client.multicall({
      allowFailure: true,
      contracts: ids.map((id) => ({ address: CHOG_GENESIS, abi, functionName: 'ownerOf' as const, args: [BigInt(id)] as [bigint] })),
    });
    res.forEach((r, j) => {
      if (r.status === 'success' && r.result.toLowerCase() === me) found.push(ids[j]!);
    });
    onProgress?.({ scanned: Math.min(i + chunk, tokenIds.length), total: tokenIds.length, found: found.length, balance });
    if (found.length >= balance) break;
  }
  return found.sort((a, b) => a - b);
}

// Session cache (§D9 "cache for the session"); every access guarded.
const key = (a: string) => `chogbreak.owned.v1.${a.toLowerCase()}`;
export function cachedOwned(address: string): number[] | null {
  try {
    const raw = sessionStorage.getItem(key(address));
    return raw ? (JSON.parse(raw) as number[]) : null;
  } catch {
    return null;
  }
}
export function cacheOwned(address: string, ids: number[]) {
  try {
    sessionStorage.setItem(key(address), JSON.stringify(ids));
  } catch {
    // storage blocked: just rescan next time
  }
}
export function clearOwned(address: string) {
  try {
    sessionStorage.removeItem(key(address));
  } catch {
    // ignore
  }
}
