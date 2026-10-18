import { useEffect } from 'react';
import type { MatchResult } from '../arena/ArenaScene';

type Props = {
  result: MatchResult;
  onRematch: () => void;
  onChange: (slot: 'A' | 'B') => void;
  onNew: () => void;
  loLabel: string;
  hiLabel: string;
};

export function Results({ result, onRematch, onChange, onNew, loLabel, hiLabel }: Props) {
  const won = result.winner === 0;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key.toLowerCase() === 'r') onRematch();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onRematch]);
  const t = Math.round(result.timeMs / 1000);
  return (
    <section className="results">
      <h2 className={`results-title ${won ? 'win' : 'lose'}`}>{result.winner === null ? 'DRAW' : won ? 'EXPERIMENT SURVIVED' : 'EXPERIMENT FAILED'}</h2>
      <p className="mono dim">
        {result.winner !== null && `${result.fighters[result.winner]!.name} wins`} · {result.reason === 'time' ? 'time up' : 'knockout'} · {Math.floor(t / 60)}:{String(t % 60).padStart(2, '0')}
      </p>
      <table className="genes results-table">
        <thead>
          <tr>
            <th />
            <th>KOs</th>
            <th>DAMAGE DEALT</th>
            <th>LIVES LEFT</th>
          </tr>
        </thead>
        <tbody>
          {result.fighters.map((f, i) => (
            <tr key={i}>
              <th>{f.name}</th>
              <td>{f.kos}</td>
              <td>{f.damageDealt}%</td>
              <td>{f.livesLeft}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
      </div>
      <p className="small dim">Saved to your Lab Notebook.</p>
    </section>
  );
}
