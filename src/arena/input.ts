import Phaser from 'phaser';

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

  constructor(kb: Phaser.Input.Keyboard.KeyboardPlugin, map: (typeof KEYMAP)['p1'] | (typeof KEYMAP)['p2']) {
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
  }

  read(): Controls {
    const k = this.keys;
    const J = Phaser.Input.Keyboard.JustDown;
    return {
      left: k.left.isDown,
      right: k.right.isDown,
      down: k.down.isDown,
      jump: J(k.jump),
      punch: J(k.punch),
      dash: J(k.dash),
      special: J(k.special),
      close: J(k.close),
      dashHeld: k.dash.isDown,
      closeHeld: k.close.isDown,
    };
  }
}
