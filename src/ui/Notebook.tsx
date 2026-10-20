import { useEffect, useMemo, useRef, useState } from 'react';
import { RECIPES } from '../core/recipes';
import { createMutant, type Mutant } from '../core/splice';
import type { Manifest } from '../data/manifest';
import { needsJar, renderMutant } from '../art/mutantRenderer';
import { readNotebook, type NotebookEntry } from '../state/notebook';
import { ChogImage } from './ChogImage';
import { ShareButtons } from './ShareButtons';
import { useOwned } from '../state/owned';

type Filter = 'all' | 'secret' | 'unstable';
type Sort = 'newest' | 'wins';

/** Small rendered mutant (lazy: drawn when scrolled into view). */
function MutantThumb({ mutant, framed }: { mutant: Mutant; framed: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let drawn = false;
    const draw = () => {
      if (drawn) return;
      drawn = true;
      void renderMutant(el, mutant.visualRecipe, 160, framed);
    };
    if (typeof IntersectionObserver === 'undefined') return draw();
    const io = new IntersectionObserver(
      (es) => es.some((e) => e.isIntersecting) && (draw(), io.disconnect()),
    );
    io.observe(el);
    return () => io.disconnect();
  }, [mutant, framed]);
  return <canvas ref={ref} className="nb-art" role="img" aria-label={`Mutant ${mutant.name}`} />;
}

function WinBar({ wins, losses }: { wins: number; losses: number }) {
  const total = wins + losses;
  return (
    <div className="nb-record" aria-label={`Record: ${wins} wins, ${losses} losses`}>
      <span className="mono small">
        W {wins} – L {losses}
      </span>
      <span className="nb-bar">
        <span style={{ width: total ? `${(wins / total) * 100}%` : '0%' }} />
      </span>
    </div>
  );
}

type Props = {
  manifest: Manifest;
  onOpen: (lo: number, hi: number) => void;
  onFight: (lo: number, hi: number) => void;
};

export function Notebook({ manifest, onOpen, onFight }: Props) {
  const owned = useOwned();
  const entries = useMemo(() => Object.values(readNotebook()), []);
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('newest');
  const secrets = new Set(entries.map((e) => e.recipeId).filter(Boolean));
  // Never reveal the total count; just tease a few unknown slots.
  const undiscovered = Math.max(0, RECIPES.length - secrets.size);

  const shown = useMemo(() => {
    const list = entries.filter((e) =>
      filter === 'secret' ? !!e.recipeId : filter === 'unstable' ? e.unstable : true,
    );
    return list.sort((a, b) =>
      sort === 'wins'
        ? b.wins - a.wins || a.losses - b.losses
        : b.discoveredAt.localeCompare(a.discoveredAt),
    );
  }, [entries, filter, sort]);

  const mutantOf = (e: NotebookEntry): Mutant | null => {
    const a = manifest.byId.get(e.lo);
    const b = manifest.byId.get(e.hi);
    return a && b ? createMutant({ parentA: a, parentB: b }) : null;
  };

  return (
    <section className="notebook">
      <header className="notebook-head">
        <h2>LAB NOTEBOOK</h2>
        <p className="mono">
          SECRET MUTATIONS: <span className="hl">{secrets.size}</span> / ??? · EXPERIMENTS:{' '}
          {entries.length}
        </p>
        <p className="small dim">Saved on this device only.</p>
      </header>

      {entries.length > 0 && (
        <div className="nb-tools">
          <div className="seg" role="radiogroup" aria-label="Filter">
            {(
              [
                ['all', 'ALL'],
                ['secret', 'SECRETS'],
                ['unstable', 'UNSTABLE'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                role="radio"
                aria-checked={filter === k}
                className={filter === k ? 'on' : ''}
                onClick={() => setFilter(k)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="seg" role="radiogroup" aria-label="Sort">
            {(
              [
                ['newest', 'NEWEST'],
                ['wins', 'MOST WINS'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                role="radio"
                aria-checked={sort === k}
                className={sort === k ? 'on' : ''}
                onClick={() => setSort(k)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {entries.length === 0 && (
        <div className="empty nb-empty">
          <p>No experiments yet.</p>
          <p className="small">
            Splice two Chogs in the Lab and every mutant you make lands here, with its fight record.
          </p>
        </div>
      )}
      {entries.length > 0 && shown.length === 0 && (
        <p className="empty">Nothing matches this filter yet.</p>
      )}

      <div className="nb-grid">
        {shown.map((e) => {
          const m = mutantOf(e);
          const lo = manifest.byId.get(e.lo);
          const hi = manifest.byId.get(e.hi);
          return (
            <article key={e.pairKey} className={`nb-card${e.recipeId ? ' is-secret' : ''}`}>
              <button
                className="nb-open"
                onClick={() => onOpen(e.lo, e.hi)}
                aria-label={`Open ${e.name}`}
              >
                {m ? (
                  <MutantThumb mutant={m} framed={needsJar(manifest.sprites, m.visualRecipe)} />
                ) : (
                  <div className="art-offline" />
                )}
                {e.unstable && <span className="nb-stamp">UNSTABLE</span>}
              </button>
              <div className="nb-body">
                <strong className="nb-name">{e.name}</strong>
                <div className="nb-parents">
                  <ChogImage tokenId={e.lo} alt={lo?.displayName ?? `Token ${e.lo}`} thumb />
                  <span className="mono small">×</span>
                  <ChogImage tokenId={e.hi} alt={hi?.displayName ?? `Token ${e.hi}`} thumb />
                  <span className="mono small dim">
                    #{e.lo}×{e.hi}
                  </span>
                </div>
                <WinBar wins={e.wins} losses={e.losses} />
                <span className="badges">
                  {e.recipeId && <span className="badge badge-recipe">SECRET</span>}
                  {e.unstable && <span className="badge badge-unstable">UNSTABLE</span>}
                  {owned && (owned.includes(e.lo) || owned.includes(e.hi)) && <span className="badge badge-holder">YOUR CHOG</span>}
                </span>
                <div className="nb-actions">
                  <button className="btn btn-primary small" onClick={() => onFight(e.lo, e.hi)}>
                    FIGHT ▸
                  </button>
                  {m && <ShareButtons mutant={m} manifest={manifest} compact />}
                </div>
              </div>
            </article>
          );
        })}
        {filter !== 'unstable' &&
          Array.from({ length: Math.min(undiscovered, 3) }, (_, i) => (
            <div
              key={`u${i}`}
              className="nb-card nb-unknown"
              aria-label="Undiscovered secret mutation"
            >
              <span className="nb-q">?</span>
              <span className="mono">??? + ??? = UNKNOWN</span>
            </div>
          ))}
      </div>
    </section>
  );
}
