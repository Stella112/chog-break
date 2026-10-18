import { useEffect, useRef } from 'react';
import type { Difficulty } from '../arena/bot';
import type { Mutant } from '../core/splice';
import { renderMutant } from '../art/mutantRenderer';

function MutantCard({ m, side, label }: { m: Mutant; side: 'a' | 'b'; label: string }) {
  const c = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (c.current) void renderMutant(c.current, m.visualRecipe);
  }, [m]);
  return (
    <div className={`pm-card pm-${side}`}>
      <span className="mono small">{label}</span>
      <canvas ref={c} role="img" aria-label={m.name} />
      <strong>{m.name}</strong>
      <span className="mono small dim">{m.experimentLabel}</span>
    </div>
  );
}

const CONTROLS: [string, string][] = [
  ['A / D', 'Move'],
  ['W', 'Jump · double jump · recovery'],
  ['S', 'Drop through platform / fast fall'],
  ['J', 'Punch (3-hit combo)'],
  ['K', 'Dash (hits!)'],
];

type Props = {
  player: Mutant;
  opponent: Mutant;
  difficulty: Difficulty;
  onDifficulty: (d: Difficulty) => void;
  onFight: () => void;
  onBack: () => void;
  touch: boolean;
};

export function PreMatch({ player, opponent, difficulty, onDifficulty, onFight, onBack, touch }: Props) {
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
        <MutantCard m={player} side="a" label="YOUR MUTANT" />
        <span className="pm-vs">VS</span>
        <MutantCard m={opponent} side="b" label="TODAY'S LAB OPPONENT" />
      </div>
      <p className="stable mono">STABLE… FOR NOW</p>
      <div className="pm-row">
        <div className="panel pm-controls">
          <h3 className="mono">CONTROLS</h3>
          <table>
            <tbody>
              {CONTROLS.map(([k, v]) => (
                <tr key={k}>
                  <th>
                    <kbd>{k}</kbd>
                  </th>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="small dim">Knock your opponent past the edge of the screen. 2 lives each. The more damage, the further they fly.</p>
        </div>
        <div className="panel pm-setup">
          <h3 className="mono">BOT DIFFICULTY</h3>
          <div className="seg" role="radiogroup" aria-label="Bot difficulty">
            {(['easy', 'normal', 'hard'] as const).map((d) => (
              <button key={d} role="radio" aria-checked={difficulty === d} className={difficulty === d ? 'on' : ''} onClick={() => onDifficulty(d)}>
                {d.toUpperCase()}
              </button>
            ))}
          </div>
          {touch && <p className="error-text">Best on desktop with a keyboard.</p>}
          <button className="btn btn-primary" onClick={onFight}>
            FIGHT ▸
          </button>
          <button className="link" onClick={onBack}>
            back to the reveal
          </button>
        </div>
      </div>
    </section>
  );
}
