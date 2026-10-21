// Client for the CHOG//BREAK sponsor (sponsor/): one free, gasless Recorded Splice per wallet and per IP every
// 48 h. The player signs a plain message (no gas, no tokens); the sponsor pays the fee and gas.
import type { Address, Hash } from 'viem';
import { sponsorMessage } from './sponsorMessage';
import type { RecordResult } from './registry';

export type SponsorStatus = { eligible: boolean; nextAt: number | null; remainingToday: number; paused: boolean; fee: string };

export class SponsorClientError extends Error {
  constructor(
    readonly code: string,
    readonly nextAt: number | null = null,
  ) {
    super(code);
  }
}

export async function sponsorStatus(base: string, address: Address): Promise<SponsorStatus> {
  const r = await fetch(`${base}/api/sponsor/status?address=${address}`, { signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new SponsorClientError('UNAVAILABLE');
  return (await r.json()) as SponsorStatus;
}

type Wire = Record<string, string | number | boolean | null>;

/** Ask the wallet to sign the claim (free), then let the sponsor record the pair for this player. */
export async function claimFreeRecording(
  base: string,
  address: Address,
  a: number,
  b: number,
  sign: (message: string) => Promise<Hash>,
  now: Date = new Date(),
): Promise<RecordResult> {
  const issuedAt = now.toISOString();
  let signature: Hash;
  try {
    signature = await sign(sponsorMessage({ address, a, b, issuedAt }));
  } catch (e) {
    const err = e as { code?: number; message?: string };
    if (err?.code === 4001 || /rejected|denied/i.test(err?.message ?? '')) throw new SponsorClientError('REJECTED');
    throw new SponsorClientError('SIGN_FAILED');
  }
  let r: Response;
  try {
    r = await fetch(`${base}/api/sponsor/record`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ address, a, b, issuedAt, signature }),
      signal: AbortSignal.timeout(180_000),
    });
  } catch {
    throw new SponsorClientError('UNAVAILABLE');
  }
  const body = (await r.json().catch(() => ({}))) as Wire;
  if (!r.ok) throw new SponsorClientError(String(body.error ?? 'RELAY_FAILED'), (body.nextAt as number | null) ?? null);
  const big = (k: string) => BigInt(String(body[k]));
  return {
    txHash: body.txHash as Hash,
    approveTx: (body.approveTx as Hash | null) ?? null,
    first: Boolean(body.first),
    lo: Number(body.lo),
    hi: Number(body.hi),
    pairKey: body.pairKey as Hash,
    ownerLo: body.ownerLo as Address,
    ownerHi: body.ownerHi as Address,
    fee: big('fee'),
    shareLo: big('shareLo'),
    shareHi: big('shareHi'),
    prize: big('prize'),
    burned: big('burned'),
  };
}

const when = (t: number | null) => (t ? new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'later');

export function sponsorErrorMessage(e: SponsorClientError): string {
  switch (e.code) {
    case 'REJECTED':
      return 'Experiment cancelled. Nothing was recorded.';
    case 'RATE_LIMITED':
      return `You've used your free recording. The next one unlocks ${when(e.nextAt)}.`;
    case 'IN_PROGRESS':
      return 'Your free recording is already on its way.';
    case 'DAILY_CAP':
      return "Today's free recordings are used up. Come back tomorrow, or pay the fee yourself.";
    case 'SPONSOR_EMPTY':
      return 'The free-recording budget is empty right now. You can still pay the fee yourself.';
    case 'EXPIRED':
    case 'BAD_SIGNATURE':
    case 'SIGN_FAILED':
      return "The signature didn't check out. Try again.";
    case 'PAUSED':
      return 'Recording is paused right now. Free experiments still work.';
    case 'UNAVAILABLE':
      return "Couldn't reach the free-recording service. Retry in a moment.";
    default:
      return 'The free recording failed. Nothing was recorded.';
  }
}
