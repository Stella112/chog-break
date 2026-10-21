import { useEffect, useRef } from 'react';
import type { Difficulty } from '../arena/bot';
import { buildKit } from '../arena/kit';
import type { ModifierId } from '../core/arenaRules';
import type { Mutant } from '../core/splice';
import { GENE_INFO, MODIFIER_INFO } from '../config/geneInfo';
import { needsJar, renderMutant } from '../art/mutantRenderer';
import { HowToPlay } from './HowToPlay';

function MoveList({ m }: { m: Mutant }) {
  // The kit is what actually plays, so labels always match real effects (§F Phase 4 fallback rule).
  const k = buildKit(m);
  const rows: [string, string][] = [
    ['L', k.special],
    ['I', k.close],
    ['HEAD', k.head],
    ['BODY', k.physics],
  ];
  if (k.affinity !== 'NORMAL') rows.push(['BASE', k.affinity]);
  if (k.trinket !== 'NONE') rows.push(['TRINKET', k.trinket]);
  if (k.element !== 'NONE') rows.push(['AURA', k.element]);
  return (
    <ul className="pm-moves">
      {rows.map(([slot, gene]) => (
        <li key={slot}>
          <span className="mono small dim">{slot}</span>{' '}
          <span className="gene">{GENE_INFO[gene]?.label ?? gene}</span>{' '}
          <span className="small dim">{GENE_INFO[gene]?.desc}</span>
        </li>
      ))}
      {m.recipe && (
        <li>
          <span className="mono small dim">PERK</span> <span className="gene">{m.recipe.name}</span>{' '}
          <span className="small dim">{m.recipe.perk}</span>
        </li>
      )}
    </ul>
  );
}

function MutantCard({
  m,
  side,
  label,
  framed,
}: {
  m: Mutant;
  side: 'a' | 'b';
  label: string;
  framed: boolean;
}) {
  const c = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (c.current) void renderMutant(c.current, m.visualRecipe, 256, framed);
  }, [m, framed]);
  return (
    <div className={`pm-card pm-${side}`}>
      <span className="mono small">{label}</span>
      <canvas ref={c} role="img" aria-label={m.name} />
      <strong>{m.name}</strong>
      <span className="mono small dim">
        {m.experimentLabel}
        {m.unstable ? ' · UNSTABLE' : ''}
      </span>
      <MoveList m={m} />
    </div>
  );
}

type Props = {
  player: Mutant;
  opponent: Mutant;
  modifiers: ModifierId[];
  difficulty: Difficulty;
  onDifficulty: (d: Difficulty) => void;
  mode: 'bot' | '2p';
  onMode: (m: 'bot' | '2p') => void;
  onFight: () => void;
  onBack: () => void;
  touch: boolean;
  sprites: Record<string, { bgRemoved: boolean }>;
};

export function PreMatch({
  player,
  opponent,
  modifiers,
  difficulty,
  onDifficulty,
  mode,
  onMode,
  onFight,
  onBack,
  touch,
  sprites,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') onFight();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onFight]);

  return (
    <section className="prematch">
      <div className="pm-versus">
        <MutantCard
          m={player}
          side="a"
          label={mode === '2p' ? 'PLAYER 1' : 'YOUR MUTANT'}
          framed={needsJar(sprites, player.visualRecipe)}
        />
        <span className="pm-vs">VS</span>
        <MutantCard
          m={opponent}
          side="b"
          label={mode === '2p' ? "PLAYER 2 · TODAY'S LAB OPPONENT" : "TODAY'S LAB OPPONENT"}
          framed={needsJar(sprites, opponent.visualRecipe)}
        />
      </div>
      <div className="panel pm-setup pm-bar">
        <div className="pm-bar-group">
          <span className="label">MODE</span>
          <div className="seg" role="radiogroup" aria-label="Mode">
            {(['bot', '2p'] as const).map((m) => (
              <button
                key={m}
                role="radio"
                aria-checked={mode === m}
                className={mode === m ? 'on' : ''}
                onClick={() => onMode(m)}
              >
                {m === 'bot' ? 'VS BOT' : 'LOCAL 2P'}
              </button>
            ))}
          </div>
        </div>
        {mode === 'bot' && (
          <div className="pm-bar-group">
            <span className="label">BOT DIFFICULTY</span>
            <div className="seg" role="radiogroup" aria-label="Bot difficulty">
              {(['easy', 'normal', 'hard'] as const).map((d) => (
                <button
                  key={d}
                  role="radio"
                  aria-checked={difficulty === d}
                  className={difficulty === d ? 'on' : ''}
                  onClick={() => onDifficulty(d)}
                >
                  {d.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="pm-bar-go">
          {touch && <p className="small dim">On-screen buttons appear in the fight. Sideways works best.</p>}
          <button className="btn btn-primary" onClick={onFight}>
            FIGHT ▸
          </button>
          <button className="link" onClick={onBack}>
            back to the reveal
          </button>
        </div>
      </div>
      <HowToPlay player={player} twoPlayer={mode === '2p'} touch={touch} />
      {modifiers.length === 0 ? (
        <p className="stable mono">STABLE… FOR NOW</p>
      ) : (
        <div className="pm-mods" role="status">
          <p className="mono">⚠ THIS EXPERIMENT IS UNSTABLE: THE ARENA MUTATES TOO</p>
          <ul>
            {modifiers.map((m) => (
              <li key={m}>
                <strong className="mono">{MODIFIER_INFO[m]?.label ?? m}</strong>{' '}
                <span className="small">{MODIFIER_INFO[m]?.desc}</span>
              </li>
            ))}
          </ul>
          <p className="small dim">
            Modifiers come from the Chogs in this match and affect both fighters.
          </p>
        </div>
      )}
    </section>
  );
}
