// Read-only on-chain facts from the Recorded Splice registry. Render nothing until a registry exists.
import { useEffect, useState } from 'react';
import { ACTIVE_REGISTRY } from '../chain/active';
import { explorerAddress, explorerTx } from '../config/chain';
import { publicClient, shortAddress } from '../chain/client';
import { formatChog, readPairRecord, readTokenStats, type PairRecord, type RecordResult, type RegistryReader } from '../chain/registry';

const read = publicClient as unknown as RegistryReader;

/** "First discovered on-chain by 0xabc… on 20 Oct 2026 · 3 recordings" or "Not recorded on-chain yet." */
export function PairOnChain({ lo, hi, refresh = 0 }: { lo: number; hi: number; refresh?: number }) {
  const [rec, setRec] = useState<PairRecord | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!ACTIVE_REGISTRY) return;
    let live = true;
    setFailed(false);
    readPairRecord(read, ACTIVE_REGISTRY, lo, hi).then(
      (r) => live && setRec(r),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [lo, hi, refresh]);
  if (!ACTIVE_REGISTRY || failed || !rec) return null;
  return (
    <p className="mono small onchain-line">
      {rec.discoverer ? (
        <>
          ON-CHAIN · first discovered by{' '}
          <a href={explorerAddress(rec.discoverer)} target="_blank" rel="noopener noreferrer">
            {shortAddress(rec.discoverer)}
          </a>
          {rec.discoveredAt ? ` on ${new Date(rec.discoveredAt * 1000).toLocaleDateString()}` : ''} · recorded {rec.count}×
        </>
      ) : (
        'ON-CHAIN · not recorded yet: its first discoverer slot is open'
      )}
    </p>
  );
}

/** Banner after a successful Recorded Splice. */
export function RecordBanner({ record, loName, hiName }: { record: RecordResult & { decimals: number }; loName: string; hiName: string }) {
  const d = record.decimals;
  return (
    <div className={`record-banner${record.first ? ' is-first' : ''}`} role="status">
      <strong>{record.first ? 'FIRST DISCOVERY!' : 'RECORDED ON MONAD'}</strong>
      <span className="small">
        {record.first
          ? "You're the first to record this pair. That credit is permanent."
          : 'Someone recorded this pair before you; your recording still counts.'}
      </span>
      <span className="small">
        {formatChog(record.shareLo, d)} $CHOG to the owner of {loName} · {formatChog(record.shareHi, d)} $CHOG to the owner of{' '}
        {hiName} · {formatChog(record.prize, d)} to the prize pool · {formatChog(record.burned, d)} sent to the dead address
      </span>
      <a className="mono small" href={explorerTx(record.txHash)} target="_blank" rel="noopener noreferrer">
        View transaction {shortAddress(record.txHash)} on Monadscan ↗
      </a>
    </div>
  );
}

/** MY CHOGS: how often this Chog was used in recorded splices and what it earned its holders. */
export function TokenOnChain({ id }: { id: number }) {
  const [s, setS] = useState<{ uses: number; earned: bigint } | null>(null);
  useEffect(() => {
    if (!ACTIVE_REGISTRY) return;
    let live = true;
    readTokenStats(read, ACTIVE_REGISTRY, id).then(
      (r) => live && setS(r),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [id]);
  if (!ACTIVE_REGISTRY || !s) return null;
  return (
    <p className="mono small onchain-line">
      ON-CHAIN · used in {s.uses} recorded splice{s.uses === 1 ? '' : 's'} · earned its holders {formatChog(s.earned, 18)} $CHOG
    </p>
  );
}
