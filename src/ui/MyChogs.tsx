import { RECIPES } from '../core/recipes';
import { INHERITED_SLOTS } from '../core/splice';
import { NONE, type ChogRecord } from '../core/types';
import { GENE_INFO } from '../config/geneInfo';
import type { Manifest } from '../data/manifest';
import { shortAddress } from '../chain/client';
import { readNotebook } from '../state/notebook';
import type { WalletState } from '../state/wallet';
import { ChogImage } from './ChogImage';
import { geneForSlot } from './traitGenes';

type Props = {
  manifest: Manifest;
  wallet: WalletState;
  onSplice: (tokenId: number) => void;
  onOpen: (lo: number, hi: number) => void;
};

function OwnedCard({ chog, onSplice, onOpen }: { chog: ChogRecord; onSplice: (id: number) => void; onOpen: (lo: number, hi: number) => void }) {
  const experiments = Object.values(readNotebook()).filter((e) => e.lo === chog.tokenId || e.hi === chog.tokenId);
  const recipes = new Set(experiments.map((e) => e.recipeId).filter(Boolean) as string[]);
  // Teaser only: how many undiscovered recipes this Chog could be half of (never which, never the other half).
  const potential = RECIPES.filter((r) => !recipes.has(r.id) && (r.x(chog.traits) || r.y(chog.traits))).length;
  return (
    <article className="mc-card">
      <div className="mc-head">
        <ChogImage tokenId={chog.tokenId} alt={chog.displayName} />
        <div>
          <h3>{chog.displayName}</h3>
          <p className="mono small dim">
            TOKEN ID {chog.tokenId} · {chog.traits.Tier.toUpperCase()}
          </p>
          <button className="btn btn-primary small" onClick={() => onSplice(chog.tokenId)}>
            SPLICE WITH… ▸
          </button>
        </div>
      </div>
      <table className="genes mc-genes">
        <tbody>
          {INHERITED_SLOTS.map((slot) => {
            const raw = chog.attributes.find((a) => a.trait_type === slot)?.value;
            const gene = geneForSlot(slot, chog.traits);
            return (
              <tr key={slot}>
                <th>{slot}</th>
                <td>{chog.traits[slot] === NONE ? <span className="dim">none</span> : String(raw)}</td>
                <td>
                  <span className="gene">{GENE_INFO[gene]?.label ?? gene}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mc-lab">
        <p className="mono small">
          EXPERIMENTS WITH THIS CHOG: {experiments.length}
          {recipes.size > 0 && ` · SECRETS: ${[...recipes].map((id) => RECIPES.find((r) => r.id === id)?.name ?? id).join(', ')}`}
        </p>
        {experiments.length > 0 && (
          <div className="mc-exp">
            {experiments.slice(0, 6).map((e) => (
              <button key={e.pairKey} className="chip" onClick={() => onOpen(e.lo, e.hi)}>
                {e.name}
              </button>
            ))}
          </div>
        )}
        {potential > 0 && <p className="small dim">This Chog is half of {potential === 1 ? 'a secret mutation' : `${potential} secret mutations`} you haven't found yet.</p>}
      </div>
    </article>
  );
}

export function MyChogs({ manifest, wallet, onSplice, onOpen }: Props) {
  const w = wallet;
  return (
    <section className="mychogs">
      <header className="notebook-head">
        <h2>MY CHOGS</h2>
        <p className="small dim">Read straight from the Chog Genesis contract on Monad. Connecting is optional; the Lab works without it.</p>
      </header>

      {!w.address && (
        <div className="panel mc-connect">
          <p>Connect a wallet to see the Chogs you hold, the genes they carry and the experiments you've run with them. This only reads which Chogs you own; it never asks you to sign or send anything.</p>
          {w.available ? (
            <button className="btn btn-primary" onClick={() => void w.connect()} disabled={w.connecting}>
              {w.connecting ? 'CONNECTING…' : 'CONNECT WALLET'}
            </button>
          ) : (
            <p className="error-text">No browser wallet found. Install one (for example MetaMask or Rabby) to see your Chogs.</p>
          )}
          {w.error && <p className="error-text" role="alert">{w.error}</p>}
        </div>
      )}

      {w.address && (
        <p className="mono small">
          WALLET {shortAddress(w.address)}
          {!w.onMonad && w.chainId !== null && (
            <>
              {' '}
              · wallet is on another network{' '}
              <button className="btn btn-ghost small" onClick={() => void w.switchChain()}>
                SWITCH TO MONAD
              </button>
            </>
          )}
        </p>
      )}

      {w.address && w.owned.status === 'scanning' && (
        <div className="panel mc-scan" role="status">
          <p className="mono">FINDING YOUR CHOGS…</p>
          {w.owned.progress && (
            <>
              <div className="mc-progress">
                <span style={{ width: `${(w.owned.progress.scanned / w.owned.progress.total) * 100}%` }} />
              </div>
              <p className="small dim">
                Checked {w.owned.progress.scanned} / {w.owned.progress.total} · found {w.owned.progress.found} of {w.owned.progress.balance}
              </p>
            </>
          )}
        </div>
      )}

      {w.address && w.owned.status === 'error' && (
        <div className="panel error-panel" role="alert">
          <p>{w.owned.message}</p>
          <button className="btn" onClick={w.rescan}>
            RETRY
          </button>
        </div>
      )}

      {w.address && w.owned.status === 'done' && w.owned.ids.length === 0 && (
        <div className="empty">
          <p>This wallet holds no Chog Genesis NFTs.</p>
          <p className="small">You can still splice any of the 1,969 Chogs in the Lab.</p>
        </div>
      )}

      {w.address && w.owned.status === 'done' && w.owned.ids.length > 0 && (
        <>
          <p className="mono">
            YOU HOLD <span className="hl">{w.owned.ids.length}</span> CHOG{w.owned.ids.length === 1 ? '' : 'S'}{' '}
            <button className="link" onClick={w.rescan}>
              refresh
            </button>
          </p>
          <div className="mc-grid">
            {w.owned.ids.map((id) => {
              const chog = manifest.byId.get(id);
              return chog ? <OwnedCard key={id} chog={chog} onSplice={onSplice} onOpen={onOpen} /> : null;
            })}
          </div>
        </>
      )}
    </section>
  );
}
