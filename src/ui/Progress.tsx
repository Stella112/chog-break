import { useEffect, useRef, useState } from 'react';
import { chogProgress, levelOf } from '../state/progress';

const FILL_DELAY = 700; // ms after the bar comes into view, so the player sees it move

/**
 * "LV 3" plus a bar to the next level. With `gained`, the bar starts at the old XP and fills;
 * crossing a level fills it to the end, then LEVEL UP pops and the new level starts.
 */
export function LevelBar({ xp, gained = 0 }: { xp: number; gained?: number }) {
  const now = levelOf(xp);
  const before = levelOf(Math.max(0, xp - gained));
  const leveledUp = gained > 0 && before.level < now.level;
  // 0: old XP · 1: filled (to the end, if leveling up) · 2: new level shown
  const [stage, setStage] = useState(gained > 0 ? 0 : 2);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (gained <= 0) return setStage(2);
    setStage(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    const play = () => {
      timers.push(setTimeout(() => setStage(1), FILL_DELAY));
      timers.push(setTimeout(() => setStage(2), FILL_DELAY + (leveledUp ? 750 : 0)));
    };
    // fill once the bar is on screen (the results panel can start below the fold)
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      play();
      return () => timers.forEach(clearTimeout);
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        play();
      }
    });
    io.observe(el);
    return () => {
      io.disconnect();
      timers.forEach(clearTimeout);
    };
  }, [xp, gained, leveledUp]);

  const shown = stage === 2 || !leveledUp ? now : before;
  const width =
    stage === 0 ? before.into / before.span : stage === 1 && leveledUp ? 1 : now.into / now.span;
  return (
    <div
      ref={ref}
      className="lv"
      aria-label={`Level ${now.level}, ${xp} XP, ${now.span - now.into} XP to level ${now.level + 1}`}
    >
      <span className={`lv-num mono${leveledUp && stage === 2 ? ' is-new' : ''}`}>LV {shown.level}</span>
      <span className="lv-bar">
        {/* a level-up restarts the bar from empty without animating backwards */}
        <span key={shown.level} style={{ width: `${width * 100}%` }} />
      </span>
      <span className="mono small dim">{stage === 0 ? xp - gained : xp} XP</span>
      {gained > 0 && <span className="lv-gain mono small">+{gained}</span>}
      {leveledUp && stage === 2 && <span className="lv-up mono small">LEVEL UP</span>}
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
