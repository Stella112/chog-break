// Single home for chain facts (§A2.3). Anything not proven in docs/CHAIN_CHECK.md is marked UNVERIFIED.

// VERIFIED (§C1)
export const CHAIN_ID = 143;
export const CHOG_GENESIS = '0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763' as const;
export const CHOG_TOKEN = '0x350035555E10d9AfAF1566AaebfCeD5BA6C27777' as const;

// VERIFIED 2026-10-20: listed as the mainnet public RPC in the official docs
// (docs.monad.xyz/developer-essentials/network-information) and answers eth_chainId 0x8f.
export const RPC_URL = 'https://rpc.monad.xyz';
// VERIFIED 2026-10-20: Monadscan is listed in the official docs; /address/<CHOG_GENESIS> shows "Chog Genesis (CHOG)"
// and /tx/<hash> showed the same block as the RPC for a live transaction.
export const EXPLORER_URL = 'https://monadscan.com';
export const explorerTx = (hash: string) => `${EXPLORER_URL}/tx/${hash}`;
export const explorerAddress = (address: string) => `${EXPLORER_URL}/address/${address}`;
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

// Recorded Splice registry v2 (§D10 + recordSpliceFor). VERIFIED 2026-10-21: deployed by Maris (deployer
// 0x17f2…13FC) in tx 0x41642ca43c6b63be4f0d3d97e84cf2b1c4274a61ec971e6fc6cfa14f55869f0d (block 115344795);
// `npm run registry:verify` passes (code, immutables, fee 10 / max 10,000 $CHOG, owner, pair keys); source verified
// on Sourcify/MonadVision (exact match). v1 (0xB435a54816Cb32B70F08C34fF388B9A718Ba3Db1, no recordings) is retired.
// Set to null to hide Recorded Splice again.
export const REGISTRY_ADDRESS: `0x${string}` | null = '0x0EBe620530E604E6D05E0ffE7589c807E9e91527';
// Sponsor service for free, gasless recordings (sponsor/ on the VPS, systemd chogbreak-sponsor, behind Caddy).
// RECORD FREE only shows while the sponsor says the relayer is funded and the player is eligible.
export const SPONSOR_URL: string | null = 'https://chogbreak-api.38-49-209-149.sslip.io';
/** The registry sends 10% of each fee here (disclosed as "sent to the dead address", never "burned"). */
export const DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD' as const;
