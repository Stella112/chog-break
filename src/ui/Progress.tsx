import { chogProgress, levelOf } from '../state/progress';

/** "LV 3" plus a thin bar to the next level. */
export function LevelBar({ xp, gained = 0 }: { xp: number; gained?: number }) {
  const { level, into, span } = levelOf(xp);
  const leveledUp = gained > 0 && levelOf(xp - gained).level < level;
  return (
    <div className="lv" aria-label={`Level ${level}, ${xp} XP, ${span - into} XP to level ${level + 1}`}>
      <span className="lv-num mono">LV {level}</span>
      <span className="lv-bar">
        <span style={{ width: `${(into / span) * 100}%` }} />
      </span>
      <span className="mono small dim">{xp} XP</span>
      {gained > 0 && <span className="lv-gain mono small">+{gained}</span>}
      {leveledUp && <span className="lv-up mono small">LEVEL UP</span>}
    </div>
  );
}

/** A Chog's career across every mutant it has parented: level, XP and record. */
export function ChogRank({ tokenId, gained = 0 }: { tokenId: number; gained?: number }) {
  const p = chogProgress(tokenId);
  return (
    <div className="chog-rank">
      <LevelBar xp={p.xp} gained={gained} />
      <span className="mono small">
        {p.wins} {p.wins === 1 ? 'WIN' : 'WINS'} · {p.fights} {p.fights === 1 ? 'FIGHT' : 'FIGHTS'}
      </span>
    </div>
  );
}
