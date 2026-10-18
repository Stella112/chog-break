import { useMemo } from 'react';
import { RECIPES } from '../core/recipes';
import type { Manifest } from '../data/manifest';
import { readNotebook } from '../state/notebook';
import { ChogImage } from './ChogImage';

export function Notebook({ manifest, onOpen }: { manifest: Manifest; onOpen: (lo: number, hi: number) => void }) {
  const entries = useMemo(
    () => Object.values(readNotebook()).sort((a, b) => b.discoveredAt.localeCompare(a.discoveredAt)),
    [],
  );
  const secrets = new Set(entries.map((e) => e.recipeId).filter(Boolean));
  // Only the P0 recipes are live; never reveal the total count.
  const undiscovered = Math.max(0, RECIPES.filter((r) => r.tier === 'P0').length - secrets.size);

  return (
    <section className="notebook">
      <header className="notebook-head">
        <h2>LAB NOTEBOOK</h2>
        <p className="mono">
          SECRET MUTATIONS: {secrets.size} / ??? · EXPERIMENTS: {entries.length}
        </p>
        <p className="small dim">Saved on this device only.</p>
      </header>
      {entries.length === 0 && <p className="empty">No experiments yet. Splice two Chogs to fill this page.</p>}
      <div className="nb-grid">
        {entries.map((e) => {
          const lo = manifest.byId.get(e.lo);
          const hi = manifest.byId.get(e.hi);
          return (
            <button key={e.pairKey} className="nb-card" onClick={() => onOpen(e.lo, e.hi)}>
              <div className="nb-parents">
                <ChogImage tokenId={e.lo} alt={lo?.displayName ?? `Token ${e.lo}`} thumb />
                <span className="mono">×</span>
                <ChogImage tokenId={e.hi} alt={hi?.displayName ?? `Token ${e.hi}`} thumb />
              </div>
              <strong>{e.name}</strong>
              <span className="mono small dim">
                #{e.lo}×{e.hi} · W {e.wins} – L {e.losses}
              </span>
              <span className="badges">
                {e.recipeId && <span className="badge badge-recipe">SECRET</span>}
                {e.unstable && <span className="badge badge-unstable">UNSTABLE</span>}
              </span>
            </button>
          );
        })}
        {Array.from({ length: Math.min(undiscovered, 3) }, (_, i) => (
          <div key={`u${i}`} className="nb-card nb-unknown" aria-label="Undiscovered secret mutation">
            <span className="mono">??? + ??? = UNKNOWN</span>
          </div>
        ))}
      </div>
    </section>
  );
}
