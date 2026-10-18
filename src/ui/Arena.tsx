import { useEffect, useRef } from 'react';
import type Phaser from 'phaser';
import type { ArenaConfig, MatchResult } from '../arena/ArenaScene';
import { createArenaGame } from '../arena/createGame';

type Props = Omit<ArenaConfig, 'onEnd'> & {
  onEnd: (r: MatchResult) => void;
  matchKey: number;
  onQuit: () => void;
  twoPlayer?: boolean;
};

/** Mounts one Phaser game; destroys it on unmount or rematch (matchKey change). */
export function Arena({ onEnd, matchKey, onQuit, twoPlayer = false, ...cfg }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;

  useEffect(() => {
    if (!host.current) return;
    const game: Phaser.Game = createArenaGame(host.current, {
      ...cfgRef.current,
      onEnd: (r) => onEndRef.current(r),
    });
    host.current.focus();
    return () => game.destroy(true);
  }, [matchKey]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onQuit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onQuit]);

  return (
    <section className="arena-wrap">
      <div
        className="arena-host"
        ref={host}
        tabIndex={-1}
        aria-label="Arena. Use the keyboard to fight."
      />
      <p className="mono small dim arena-hint">
        P1: A/D move · W jump · S drop · J punch · K dash · L special · I close
        {twoPlayer
          ? ' │ P2: ←/→ move · ↑ jump · ↓ drop · , punch · . dash · / special · M close'
          : ''}{' '}
        · ESC quit
      </p>
    </section>
  );
}
