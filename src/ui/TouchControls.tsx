// On-screen controls for phones and tablets (player 1). Multi-touch: move with the left thumb while
// attacking with the right. Writes to arena/touch.ts, which the P1 keyboard source merges in.
import { useEffect, type PointerEvent as RPointerEvent } from 'react';
import { touchPad, type TouchAction } from '../arena/touch';

function Btn({ action, label, sub, className = '' }: { action: TouchAction; label: string; sub?: string; className?: string }) {
  const down = (e: RPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    touchPad.press(action);
    // keep receiving this finger's events even if it slides off the button (best-effort)
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* the pointer is already gone */
    }
    navigator.vibrate?.(8);
  };
  const up = (e: RPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    touchPad.release(action);
  };
  return (
    <button
      type="button"
      className={`tc-btn ${className}`}
      aria-label={sub ? `${label}: ${sub}` : label}
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={up}
      onLostPointerCapture={() => touchPad.release(action)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span>{label}</span>
      {sub && <small>{sub}</small>}
    </button>
  );
}

export function TouchControls({ special, close, onQuit }: { special: string; close: string; onQuit: () => void }) {
  useEffect(() => {
    document.body.classList.add('arena-touch');
    return () => {
      document.body.classList.remove('arena-touch');
      touchPad.releaseAll();
    };
  }, []);
  return (
    <div className="touch-ui" aria-label="Touch controls">
      <button type="button" className="tc-quit" onClick={onQuit} aria-label="Quit the fight">
        ✕
      </button>
      <div className="tc-move">
        <Btn action="left" label="◀" className="tc-dir" />
        <Btn action="down" label="▼" className="tc-dir tc-down" />
        <Btn action="right" label="▶" className="tc-dir" />
      </div>
      <div className="tc-act">
        <Btn action="close" label="CLOSE" sub={close} className="tc-gene" />
        <Btn action="special" label="SPEC" sub={special} className="tc-gene" />
        <Btn action="dash" label="DASH" />
        <Btn action="punch" label="PUNCH" className="tc-big" />
        <Btn action="jump" label="JUMP" className="tc-big tc-jump" />
      </div>
      <p className="tc-rotate">Turn your phone sideways for a bigger arena.</p>
    </div>
  );
}
