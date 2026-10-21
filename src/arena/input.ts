import Phaser from 'phaser';
import type { TouchPad } from './touch';

/** One frame of intent. Bot and keyboard both produce this, so fighters never know who drives them. */
export type Controls = {
  left: boolean;
  right: boolean;
  down: boolean;
  /** Edge-triggered (true only on the frame pressed). */
  jump: boolean;
  punch: boolean;
  dash: boolean;
  special: boolean;
  close: boolean;
  /** Held state (for GUARD / taunt later). */
  dashHeld: boolean;
  closeHeld: boolean;
};

export const EMPTY_CONTROLS: Controls = {
  left: false,
  right: false,
  down: false,
  jump: false,
  punch: false,
  dash: false,
  special: false,
  close: false,
  dashHeld: false,
  closeHeld: false,
};

export interface ControlSource {
  read(): Controls;
}

// §D7 controls. P2 keys avoid the numpad (laptops).
export const KEYMAP = {
  p1: { left: 'A', right: 'D', jump: 'W', down: 'S', punch: 'J', dash: 'K', special: 'L', close: 'I' },
  p2: { left: 'LEFT', right: 'RIGHT', jump: 'UP', down: 'DOWN', punch: 'COMMA', dash: 'PERIOD', special: 'FORWARD_SLASH', close: 'M' },
} as const;

export class KeyboardSource implements ControlSource {
  private keys: Record<keyof (typeof KEYMAP)['p1'], Phaser.Input.Keyboard.Key>;
  /**
   * Presses are queued from the keydown event and consumed on the next read, so a tap that
   * goes down and up inside one frame is never lost (Phaser clears JustDown on keyup).
   */
  private pending = { jump: false, punch: false, dash: false, special: false, close: false };

  constructor(
    kb: Phaser.Input.Keyboard.KeyboardPlugin,
    map: (typeof KEYMAP)['p1'] | (typeof KEYMAP)['p2'],
    /** On-screen touch controls merged into these keys (player 1 on touch devices). */
    private touch?: TouchPad,
  ) {
    const K = Phaser.Input.Keyboard.KeyCodes;
    const make = (name: string) => kb.addKey(K[name as keyof typeof K], true, false);
    this.keys = {
      left: make(map.left),
      right: make(map.right),
      jump: make(map.jump),
      down: make(map.down),
      punch: make(map.punch),
      dash: make(map.dash),
      special: make(map.special),
      close: make(map.close),
    };
    for (const action of ['jump', 'punch', 'dash', 'special', 'close'] as const) {
      this.keys[action].on(Phaser.Input.Keyboard.Events.DOWN, () => (this.pending[action] = true));
    }
  }

  read(): Controls {
    const k = this.keys;
    const p = this.pending;
    const c: Controls = {
      left: k.left.isDown,
      right: k.right.isDown,
      down: k.down.isDown,
      jump: p.jump,
      punch: p.punch,
      dash: p.dash,
      special: p.special,
      close: p.close,
      dashHeld: k.dash.isDown,
      closeHeld: k.close.isDown,
    };
    this.pending = { jump: false, punch: false, dash: false, special: false, close: false };
    const t = this.touch;
    if (t) {
      const e = t.takeEdges();
      c.left ||= t.held.left;
      c.right ||= t.held.right;
      c.down ||= t.held.down;
      c.jump ||= e.jump;
      c.punch ||= e.punch;
      c.dash ||= e.dash;
      c.special ||= e.special;
      c.close ||= e.close;
      c.dashHeld ||= t.held.dash;
      c.closeHeld ||= t.held.close;
    }
    return c;
  }
}
