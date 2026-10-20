// Which RPC and registry the app talks to. Production: the facts in src/config/chain.ts.
// Test-only (`?test=1`): e2e can point the app at a local anvil chain (chain id 143) with a deployed registry
// by setting window.__chogbreakTestChain before the app loads. Never used outside test mode.
import { REGISTRY_ADDRESS, RPC_URL } from '../config/chain';

type TestChain = { rpc?: string; registry?: `0x${string}` };

const testChain: TestChain =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('test') === '1'
    ? ((window as unknown as { __chogbreakTestChain?: TestChain }).__chogbreakTestChain ?? {})
    : {};

export const ACTIVE_RPC = testChain.rpc ?? RPC_URL;
export const ACTIVE_REGISTRY: `0x${string}` | null = testChain.registry ?? REGISTRY_ADDRESS;
