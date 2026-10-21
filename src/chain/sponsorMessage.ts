// The exact text a player signs to claim a free (sponsored) Recorded Splice.
// Must match sponsorMessage() in sponsor/core.mjs: tests/unit/sponsor.anvil.test.ts checks they agree.
import { getAddress } from 'viem';
import { CHAIN_ID } from '../config/chain';

export function sponsorMessage({ address, a, b, issuedAt }: { address: string; a: number; b: number; issuedAt: string }): string {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return [
    'CHOG//BREAK free recording',
    `Pair: token ${lo} x token ${hi}`,
    `Wallet: ${getAddress(address)}`,
    `Chain: ${CHAIN_ID}`,
    `Issued: ${issuedAt}`,
    'Signing is free. It lets the CHOG//BREAK sponsor pay the fee and gas to record this pair for you.',
  ].join('\n');
}
