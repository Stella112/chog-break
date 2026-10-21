// On-screen touch controls for player 1. The React overlay (ui/TouchControls.tsx) writes here; the P1
// KeyboardSource ORs this into its Controls, so touch and keys behave identically and fighters can't tell.

export type TouchAction = 'left' | 'right' | 'down' | 'jump' | 'punch' | 'dash' | 'special' | 'close';
type Edge = 'jump' | 'punch' | 'dash' | 'special' | 'close';
const EDGES: Edge[] = ['jump', 'punch', 'dash', 'special', 'close'];

export class TouchPad {
  readonly held: Record<TouchAction, boolean> = { left: false, right: false, down: false, jump: false, punch: false, dash: false, special: false, close: false };
  /** A tap that goes down and up inside one frame still counts (same rule as the keyboard). */
  private pending: Record<Edge, boolean> = { jump: false, punch: false, dash: false, special: false, close: false };

  press(a: TouchAction) {
    if (!this.held[a] && (EDGES as string[]).includes(a)) this.pending[a as Edge] = true;
    this.held[a] = true;
  }

  release(a: TouchAction) {
    this.held[a] = false;
  }

  releaseAll() {
    for (const k of Object.keys(this.held) as TouchAction[]) this.held[k] = false;
  }

  /** Consume this frame's taps. */
  takeEdges(): Record<Edge, boolean> {
    const p = this.pending;
    this.pending = { jump: false, punch: false, dash: false, special: false, close: false };
    return p;
  }
}

/** One pad per page: only one arena runs at a time. */
export const touchPad = new TouchPad();

export const IS_TOUCH_DEVICE = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
