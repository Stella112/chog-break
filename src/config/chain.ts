// Single home for chain facts (§A2.3). Anything not proven in docs/CHAIN_CHECK.md is marked UNVERIFIED.

// VERIFIED (§C1)
export const CHAIN_ID = 143;
export const CHOG_GENESIS = '0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763' as const;
export const CHOG_TOKEN = '0x350035555E10d9AfAF1566AaebfCeD5BA6C27777' as const;

// UNVERIFIED: public RPC — confirm in official Monad docs + eth_chainId check (scripts/verify-chain.ts)
export const RPC_URL = 'https://rpc.monad.xyz';
// UNVERIFIED: canonical Multicall3 address — confirm eth_getCode on chain 143
export const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11' as const;
// UNVERIFIED: IPFS gateways, tried in order
// (pinata/ipfs.io/dweb.link rate-limit bulk fetches with HTTP 429; filebase served them on 2026-10-18)
export const IPFS_GATEWAYS = [
  'https://ipfs.filebase.io/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://dweb.link/ipfs/',
];
