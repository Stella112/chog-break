import { useEffect, useMemo, useRef } from 'react';
import type { MatchResult } from '../arena/ArenaScene';
import { RECIPES } from '../core/recipes';
import type { Mutant } from '../core/splice';
import type { Manifest } from '../data/manifest';
import { needsJar, renderMutant } from '../art/mutantRenderer';
import { readNotebook } from '../state/notebook';
import { ShareButtons } from './ShareButtons';

type Props = {
  result: MatchResult;
  onRematch: () => void;
  onChange: (slot: 'A' | 'B') => void;
  onNew: () => void;
  loLabel: string;
  hiLabel: string;
  twoPlayer?: boolean;
  mutant: Mutant;
  opponent: Mutant;
  manifest: Manifest;
};

function Fighter({
  m,
  framed,
  side,
  outcome,
  label,
}: {
  m: Mutant;
  framed: boolean;
  side: 'a' | 'b';
  outcome: 'win' | 'lose' | 'draw';
  label: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) void renderMutant(ref.current, m.visualRecipe, 220, framed);
  }, [m, framed]);
  return (
    <figure className={`rs-fighter rs-${side} rs-${outcome}`}>
      <span className="mono small">{label}</span>
      <div className="rs-art">
        <canvas ref={ref} role="img" aria-label={m.name} />
        {outcome === 'win' && <span className="rs-stamp rs-stamp-win">WINNER</span>}
        {outcome === 'lose' && <span className="rs-stamp rs-stamp-ko">K.O.</span>}
      </div>
      <figcaption>{m.name}</figcaption>
    </figure>
  );
}

/**
 * Lab tip: if a parent is half of a secret recipe the player hasn't found yet, say so
 * without naming the recipe or the missing ingredient. Feeds "splice again".
 */
function labTip(m: Mutant, manifest: Manifest): string {
  const found = new Set(Object.values(readNotebook()).map((e) => e.recipeId));
  const parents = [m.parents.lo, m.parents.hi];
  for (const r of RECIPES) {
    if (found.has(r.id)) continue;
    for (const p of parents) {
      if (r.x(p.traits) || r.y(p.traits)) {
        const name = manifest.byId.get(p.tokenId)?.displayName ?? `#${p.tokenId}`;
        return `${name} carries half of a secret mutation you haven't found. Keep it and try new partners.`;
      }
    }
  }
  return 'Change one parent: every gene swap changes the moves, the physics and even the arena.';
}

export function Results({
  result,
  onRematch,
  onChange,
  onNew,
  loLabel,
  hiLabel,
  twoPlayer = false,
  mutant,
  opponent,
  manifest,
}: Props) {
  const won = result.winner === 0;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key.toLowerCase() === 'r') onRematch();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onRematch]);
  const t = Math.round(result.timeMs / 1000);
  const [me, foe] = result.fighters;
  const record = readNotebook()[mutant.pairKey];
  const tip = useMemo(() => labTip(mutant, manifest), [mutant, manifest]);
  const outcome = (i: 0 | 1) =>
    result.winner === null ? 'draw' : result.winner === i ? 'win' : 'lose';
  const dmgTotal = Math.max(1, (me?.damageDealt ?? 0) + (foe?.damageDealt ?? 0));

  return (
    <section className={`results ${won || twoPlayer ? 'is-win' : 'is-lose'}`}>
      {won && !twoPlayer && (
        <div className="confetti" aria-hidden>
          {Array.from({ length: 28 }, (_, i) => (
            <span
              key={i}
              style={{
                left: `${(i * 37) % 100}%`,
                animationDelay: `${(i % 7) * 0.12}s`,
                background: ['#ffd400', '#4ff0ff', '#ff4fd8', '#8aff4f'][i % 4],
              }}
            />
          ))}
        </div>
      )}
      <h2 className={`results-title ${won || twoPlayer ? 'win' : 'lose'}`}>
        {result.winner === null
          ? 'DRAW'
          : twoPlayer
            ? `PLAYER ${result.winner + 1} WINS`
            : won
              ? 'EXPERIMENT SURVIVED'
              : 'EXPERIMENT FAILED'}
      </h2>
      <p className="mono dim">
        {result.winner !== null && `${result.fighters[result.winner]!.name} wins`} ·{' '}
        {result.reason === 'time' ? 'time up' : 'knockout'} · {Math.floor(t / 60)}:
        {String(t % 60).padStart(2, '0')}
      </p>

      <div className="rs-versus">
        <Fighter
          m={mutant}
          framed={needsJar(manifest.sprites, mutant.visualRecipe)}
          side="a"
          outcome={outcome(0)}
          label={twoPlayer ? 'PLAYER 1' : 'YOUR MUTANT'}
        />
        <div
          className="rs-score"
          aria-label={`Lives left ${me?.livesLeft ?? 0} to ${foe?.livesLeft ?? 0}`}
        >
          <span className="rs-lives">
            {me?.livesLeft ?? 0}
            <small>–</small>
            {foe?.livesLeft ?? 0}
          </span>
          <span className="mono small dim">LIVES LEFT</span>
        </div>
        <Fighter
          m={opponent}
          framed={needsJar(manifest.sprites, opponent.visualRecipe)}
          side="b"
          outcome={outcome(1)}
          label={twoPlayer ? 'PLAYER 2' : 'LAB OPPONENT'}
        />
      </div>

      <div className="rs-stats">
        <div className="rs-tile">
          <span className="label">KOs</span>
          <strong>
            {me?.kos ?? 0} <small>vs</small> {foe?.kos ?? 0}
          </strong>
        </div>
        <div className="rs-tile rs-tile-wide">
          <span className="label">DAMAGE DEALT</span>
          <div className="rs-dmg">
            <span className="mono">{me?.damageDealt ?? 0}%</span>
            <span className="rs-dmgbar">
              <span
                className="rs-dmg-a"
                style={{ width: `${((me?.damageDealt ?? 0) / dmgTotal) * 100}%` }}
              />
              <span
                className="rs-dmg-b"
                style={{ width: `${((foe?.damageDealt ?? 0) / dmgTotal) * 100}%` }}
              />
            </span>
            <span className="mono">{foe?.damageDealt ?? 0}%</span>
          </div>
        </div>
        <div className="rs-tile">
          <span className="label">TIME</span>
          <strong>
            {Math.floor(t / 60)}:{String(t % 60).padStart(2, '0')}
          </strong>
        </div>
        {!twoPlayer && record && (
          <div className="rs-tile">
            <span className="label">RECORD</span>
            <strong>
              W {record.wins} – L {record.losses}
            </strong>
          </div>
        )}
      </div>

      <div className="reveal-actions">
        <button className="btn btn-primary" onClick={onRematch}>
          REMATCH
        </button>
        <button className="btn btn-a" onClick={() => onChange('A')}>
          CHANGE {loLabel}
        </button>
        <button className="btn btn-b" onClick={() => onChange('B')}>
          CHANGE {hiLabel}
        </button>
        <button className="btn btn-ghost" onClick={onNew}>
          NEW EXPERIMENT
        </button>
        <ShareButtons mutant={mutant} manifest={manifest} />
      </div>
      <p className="lab-tip">
        <span className="mono">LAB TIP</span> {tip}
      </p>
      <p className="small dim">
        {twoPlayer
          ? 'Local match: not counted in the notebook record.'
          : 'Saved to your Lab Notebook.'}
      </p>
    </section>
  );
}
