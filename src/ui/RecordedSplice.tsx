// §D9 RECORDED SPLICE: optional, wallet on Monad, pays the $CHOG fee, records the pair on-chain, first valid
// recording gets first-discoverer credit, and the two parent owners are paid. FREE EXPERIMENT stays the default.
import { useState } from 'react';
import { parseAbi, type Address } from 'viem';
import { CHOG_GENESIS, explorerAddress } from '../config/chain';
import type { Manifest } from '../data/manifest';
import { ACTIVE_REGISTRY, ACTIVE_SPONSOR } from '../chain/active';
import { claimFreeRecording, SponsorClientError, sponsorErrorMessage, sponsorStatus, type SponsorStatus } from '../chain/sponsor';
import { publicClient, shortAddress, walletClientFor } from '../chain/client';
import {
  formatChog,
  readPairRecord,
  readQuote,
  RecordError,
  recordErrorMessage,
  recordSplice,
  type PairRecord,
  type RecordQuote,
  type RecordResult,
  type RecordStep,
  type RegistryReader,
  type RegistryWriter,
} from '../chain/registry';

const OWNER_OF = parseAbi(['function ownerOf(uint256) view returns (address)']);

type Quote = RecordQuote & { ownerLo: Address; ownerHi: Address; pair: PairRecord };

const STEP_COPY: Record<RecordStep, string> = {
  checking: 'Checking your wallet and the fee…',
  approve: 'Preparing the approval…',
  approving: 'Approve the exact fee in your wallet…',
  record: 'Preparing the recording…',
  recording: 'Confirm in your wallet, then wait for Monad…',
  done: 'Recorded.',
};

type Props = {
  manifest: Manifest;
  a: number;
  b: number;
  address: Address;
  onMonad: boolean;
  onSwitchChain: () => void;
  onRecorded: (r: RecordResult & { decimals: number }) => void;
};

export function RecordedSplice({ manifest, a, b, address, onMonad, onSwitchChain, onRecorded }: Props) {
  const registry = ACTIVE_REGISTRY;
  const [open, setOpen] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [step, setStep] = useState<RecordStep | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [free, setFree] = useState<SponsorStatus | null>(null);
  const [freeBusy, setFreeBusy] = useState(false);
  if (!registry) return null;
  const read = publicClient as unknown as RegistryReader;
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const name = (id: number) => manifest.byId.get(id)?.displayName ?? `#${id}`;

  const load = async () => {
    setOpen(true);
    setError(null);
    setQuote(null);
    setFree(null);
    if (ACTIVE_SPONSOR) sponsorStatus(ACTIVE_SPONSOR, address).then(setFree, () => setFree(null));
    try {
      const [q, ownerLo, ownerHi, pair] = await Promise.all([
        readQuote(read, registry, address),
        publicClient.readContract({ address: CHOG_GENESIS, abi: OWNER_OF, functionName: 'ownerOf', args: [BigInt(lo)] }),
        publicClient.readContract({ address: CHOG_GENESIS, abi: OWNER_OF, functionName: 'ownerOf', args: [BigInt(hi)] }),
        readPairRecord(read, registry, lo, hi),
      ]);
      setQuote({ ...q, ownerLo, ownerHi, pair });
    } catch (e) {
      setError(recordErrorMessage(e instanceof RecordError ? e : new RecordError('NETWORK')));
    }
  };

  const confirm = async () => {
    if (!quote) return;
    setError(null);
    try {
      const w = walletClientFor(address);
      const writer: RegistryWriter = {
        getChainId: () => w.getChainId(),
        writeContract: (req) => w.writeContract(req as Parameters<typeof w.writeContract>[0]),
      };
      const r = await recordSplice(read, writer, registry, address, a, b, setStep);
      onRecorded({ ...r, decimals: quote.decimals });
    } catch (e) {
      setStep(null);
      setError(recordErrorMessage(e instanceof RecordError ? e : new RecordError('NETWORK')));
    }
  };

  const recordFree = async () => {
    if (!ACTIVE_SPONSOR) return;
    setError(null);
    setFreeBusy(true);
    try {
      const w = walletClientFor(address);
      const r = await claimFreeRecording(ACTIVE_SPONSOR, address, a, b, (message) => w.signMessage({ account: address, message }));
      onRecorded({ ...r, decimals: quote?.decimals ?? 18 });
    } catch (e) {
      setError(sponsorErrorMessage(e instanceof SponsorClientError ? e : new SponsorClientError('RELAY_FAILED')));
      if (ACTIVE_SPONSOR) sponsorStatus(ACTIVE_SPONSOR, address).then(setFree, () => {});
    } finally {
      setFreeBusy(false);
    }
  };

  if (!open) {
    return (
      <button className="btn btn-record" onClick={() => void load()}>
        RECORDED SPLICE
      </button>
    );
  }

  const d = quote?.decimals ?? 18;
  const pct = (bps: bigint) => (quote ? formatChog((quote.fee * bps) / 10_000n, d) : '');
  const busy = step !== null && step !== 'done';
  return (
    <div className="panel record-panel" role="dialog" aria-label="Recorded Splice">
      <p className="mono small">RECORD THIS EXPERIMENT ON MONAD</p>
      {!quote && !error && <p className="small dim">Reading the fee and the parents' owners…</p>}
      {quote && (
        <>
          <p>
            Fee <strong className="hl">{formatChog(quote.fee, d)} $CHOG</strong>{' '}
            <span className="small dim">(you have {formatChog(quote.balance, d)})</span>
          </p>
          <ul className="record-split small">
            <li>
              {pct(3500n)} → owner of {name(lo)} ({shortAddress(quote.ownerLo)})
            </li>
            <li>
              {pct(3500n)} → owner of {name(hi)} ({shortAddress(quote.ownerHi)})
            </li>
            <li>{pct(2000n)} → prize pool</li>
            <li>{pct(1000n)} → sent to the dead address</li>
          </ul>
          <p className="small">
            {quote.pair.discoverer
              ? `First discovered by ${shortAddress(quote.pair.discoverer)} · recorded ${quote.pair.count} time${quote.pair.count === 1 ? '' : 's'}.`
              : "Nobody has recorded this pair yet. Record it and you're its first discoverer, permanently."}
          </p>
          {quote.allowance < quote.fee && quote.fee > 0n && (
            <p className="small dim">
              Your wallet asks twice: approve exactly {formatChog(quote.fee, d)} $CHOG, then record.
            </p>
          )}
        </>
      )}
      {free?.eligible && (
        <div className="record-free">
          <button className="btn btn-primary small" onClick={() => void recordFree()} disabled={freeBusy || busy}>
            {freeBusy ? 'RECORDING ON MONAD…' : 'RECORD FREE'}
          </button>
          <span className="small">
            Sign a free message and we pay the fee and gas. One free recording every 48 hours. You still get the
            first-discoverer credit.
          </span>
        </div>
      )}
      {free && !free.eligible && free.nextAt && (
        <p className="small dim">Free recording used. The next one unlocks {new Date(free.nextAt).toLocaleString()}.</p>
      )}
      {step && <p className="mono small" role="status">{STEP_COPY[step]}</p>}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      <div className="record-actions">
        {!onMonad ? (
          <button className="btn btn-primary small" onClick={onSwitchChain}>
            SWITCH TO MONAD
          </button>
        ) : (
          <button
            className={`btn small ${free?.eligible ? 'btn-ghost' : 'btn-primary'}`}
            onClick={() => void confirm()}
            disabled={!quote || busy || freeBusy}
          >
            {busy ? 'WORKING…' : free?.eligible ? 'PAY THE FEE MYSELF' : 'CONFIRM IN WALLET'}
          </button>
        )}
        <button
          className="btn btn-ghost small"
          onClick={() => {
            setOpen(false);
            setStep(null);
            setError(null);
          }}
          disabled={busy}
        >
          CANCEL
        </button>
        {error && !busy && (
          <button className="btn btn-ghost small" onClick={() => void load()}>
            RETRY
          </button>
        )}
      </div>
      <p className="small dim">
        The free experiment needs none of this. Registry:{' '}
        <a href={explorerAddress(registry)} target="_blank" rel="noopener noreferrer">
          {shortAddress(registry)}
        </a>
      </p>
    </div>
  );
}
