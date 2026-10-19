import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import type { Stage3D } from '../arena/three/Stage3D';
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
    const el = host.current;
    if (!el) return;
    let game: Phaser.Game | null = null;
    let stage: Stage3D | null = null;
    let cancelled = false;
    const start = (view3d: Stage3D | null) => {
      if (cancelled) return view3d?.dispose();
      stage = view3d;
      const g = createArenaGame(el, {
        ...cfgRef.current,
        view3d: view3d ?? undefined,
        onEnd: (r) => onEndRef.current(r),
      });
      game = g;
      if (view3d) {
        el.prepend(view3d.canvas);
        // Phaser FIT-scales and centres its canvas; keep the 3D canvas exactly underneath it.
        const sync = () => {
          const c = g.canvas;
          if (!c) return;
          Object.assign(view3d.canvas.style, {
            width: c.style.width,
            height: c.style.height,
            left: `${c.offsetLeft}px`,
            top: `${c.offsetTop}px`,
          });
        };
        g.scale.on(Phaser.Scale.Events.RESIZE, sync);
        g.events.once(Phaser.Core.Events.READY, sync);
        requestAnimationFrame(sync);
      }
      el.focus();
    };
    // 2.5D by default; `?arena=2d` (or no WebGL) keeps the 2D arena.
    const mods = cfgRef.current.modifiers ?? [];
    const floor = mods.includes('SLIPPERY_FLOOR') ? 'slippery' : mods.includes('BOUNCY_FLOOR') ? 'bouncy' : 'normal';
    if (new URLSearchParams(window.location.search).get('arena') === '2d') start(null);
    else
      import('../arena/three/Stage3D').then(
        (m) => start(m.createStage3D(floor)),
        () => start(null),
      );
    return () => {
      cancelled = true;
      game?.destroy(true);
      stage?.dispose();
    };
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
