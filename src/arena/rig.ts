// Code-drawn character rig: the mutant's portrait as a round head on an animated body.
// Purely visual; the Arcade physics body (on the invisible sprite) is unchanged.
import Phaser from 'phaser';

export type RigPose = {
  vx: number;
  vy: number;
  grounded: boolean;
  facing: 1 | -1;
  state: 'free' | 'attack' | 'dash' | 'hitstun' | 'action' | 'ko';
  /** 0..1 progress of the current punch, or -1. */
  punch: number;
  punchStep: number;
  blocking: boolean;
  sizeMul: number;
  runSpeed: number;
};

const OUTLINE = 0x0b0a10;
/** Visual scale of the whole character (the physics hitbox is unchanged). */
export const RIG_SCALE = 1.25;

function shade(color: number, f: number) {
  const c = Phaser.Display.Color.IntegerToColor(color);
  return Phaser.Display.Color.GetColor(Math.min(255, c.red * f), Math.min(255, c.green * f), Math.min(255, c.blue * f));
}

export class FighterRig {
  readonly root: Phaser.GameObjects.Container;
  private g: Phaser.GameObjects.Graphics;
  private head: Phaser.GameObjects.Image;
  private runPhase = 0;
  private sx = 1;
  private sy = 1;
  private flashUntil = 0;
  private flashColor = 0xffffff;
  private spin = 0;
  private headTint: number | null = null;

  constructor(
    private scene: Phaser.Scene,
    headKey: string,
    private bodyColor: number,
    private playerColor: number,
  ) {
    this.g = scene.add.graphics();
    this.head = scene.add.image(0, -80, headKey).setDisplaySize(78, 78);
    this.root = scene.add.container(0, 0, [this.g, this.head]).setDepth(10);
  }

  get headKey() {
    return this.head.texture.key;
  }

  /** Squash & stretch impulse that eases back to 1. */
  squash(sx: number, sy: number) {
    this.sx = sx;
    this.sy = sy;
  }

  flash(color: number, ms: number) {
    this.flashColor = color;
    this.flashUntil = this.scene.time.now + ms;
  }

  setTint(color: number | null) {
    this.headTint = color;
  }

  setVisible(v: boolean) {
    this.root.setVisible(v);
  }

  setAlpha(a: number) {
    this.root.setAlpha(a);
  }

  update(x: number, feetY: number, p: RigPose, now: number, dt: number) {
    const s = dt / 1000;
    const g = this.g;
    const flashing = now < this.flashUntil;

    // ease squash back
    this.sx += (1 - this.sx) * Math.min(1, s * 12);
    this.sy += (1 - this.sy) * Math.min(1, s * 12);
    let sx = this.sx;
    let sy = this.sy;
    if (p.state === 'dash') {
      sx *= 1.25;
      sy *= 0.85;
    }

    const speed = Math.min(1, Math.abs(p.vx) / p.runSpeed);
    if (p.grounded) this.runPhase += Math.abs(p.vx) * s * 0.045;
    const bob = p.grounded ? (speed > 0.1 ? Math.abs(Math.sin(this.runPhase)) * 4 : Math.sin(now / 320) * 1.5) : 0;

    // launched fighters tumble; everyone else leans into their run
    if (p.state === 'hitstun' && Math.hypot(p.vx, p.vy) > 900) this.spin += p.facing * s * 14;
    else this.spin *= Math.max(0, 1 - s * 10);
    const lean = p.state === 'hitstun' ? Phaser.Math.Clamp(p.vx * 0.0006, -0.5, 0.5) : (p.vx / p.runSpeed) * 0.14;

    this.root.setPosition(x, feetY);
    this.root.setRotation(lean + this.spin);
    this.root.setScale(p.facing * sx * p.sizeMul * RIG_SCALE, sy * p.sizeMul * RIG_SCALE);

    // --- legs ---
    g.clear();
    const legColor = shade(this.bodyColor, 0.55);
    const hipY = -24 - bob;
    let la: number;
    let lb: number;
    if (!p.grounded) {
      const tuck = p.vy < 0 ? 0.6 : -0.35;
      la = tuck;
      lb = -tuck * 0.6;
    } else if (speed > 0.1) {
      la = Math.sin(this.runPhase) * 0.8 * speed;
      lb = -la;
    } else {
      la = 0.08;
      lb = -0.08;
    }
    for (const [hx, a] of [
      [-9, la],
      [9, lb],
    ] as const) {
      const fx = hx + Math.sin(a) * 22;
      const fy = hipY + Math.cos(a) * 22;
      g.lineStyle(10, OUTLINE, 1).lineBetween(hx, hipY, fx, fy);
      g.lineStyle(6, legColor, 1).lineBetween(hx, hipY, fx, fy);
      g.fillStyle(OUTLINE, 1).fillEllipse(fx + 3, fy + 1, 16, 9);
    }

    // --- body ---
    const bodyY = -40 - bob;
    const breathe = p.grounded && speed < 0.1 ? Math.sin(now / 320) * 1.5 : 0;
    g.fillStyle(OUTLINE, 1).fillEllipse(0, bodyY, 50, 38 + breathe);
    g.fillStyle(flashing ? this.flashColor : this.bodyColor, 1).fillEllipse(0, bodyY, 44, 32 + breathe);
    g.fillStyle(0xffffff, 0.18).fillEllipse(-8, bodyY - 7, 16, 9);
    // player-colour belt so it is always clear who is who
    g.fillStyle(this.playerColor, 1).fillRect(-20, bodyY + 6, 40, 4);

    // --- fists ---
    const shoulderY = bodyY - 4;
    let front = { x: 22, y: shoulderY + 8 };
    let back = { x: -20, y: shoulderY + 10 };
    if (p.blocking) {
      front = { x: 20, y: shoulderY - 18 };
      back = { x: 14, y: shoulderY - 6 };
    } else if (p.punch >= 0) {
      const ext = Math.sin(Math.min(1, p.punch) * Math.PI);
      // jab, cross (other hand), uppercut
      const hit = p.punchStep === 3 ? { x: 22 + ext * 34, y: shoulderY + 6 - ext * 40 } : { x: 22 + ext * 46, y: shoulderY + 2 };
      if (p.punchStep === 2) back = hit;
      else front = hit;
    } else if (p.grounded && speed > 0.1) {
      front.x += Math.sin(this.runPhase) * 8 * speed;
      back.x -= Math.sin(this.runPhase) * 8 * speed;
    } else if (!p.grounded) {
      front.y -= 10;
      back.y -= 14;
    }
    for (const f of [back, front]) {
      g.fillStyle(OUTLINE, 1).fillCircle(f.x, f.y, 10);
      g.fillStyle(flashing ? this.flashColor : shade(this.bodyColor, 1.15), 1).fillCircle(f.x, f.y, 7);
    }

    // --- head ---
    const headBob = p.state === 'hitstun' ? Math.sin(now / 35) * 0.25 : p.state === 'action' ? -0.12 : 0;
    this.head.setPosition(p.state === 'action' ? 6 : 0, -82 - bob);
    this.head.setRotation(headBob);
    if (flashing) this.head.setTintFill(this.flashColor);
    else if (this.headTint !== null) this.head.setTint(this.headTint);
    else this.head.clearTint();
  }

  destroy() {
    this.root.destroy();
  }
}

/** Crop the composited mutant into a round head (face sits ~45% down the portrait). */
export function makeHeadCanvas(mutant: HTMLCanvasElement, ring: number): HTMLCanvasElement {
  const size = 200;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const r = size / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(r, r, r - 6, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#1d1a28';
  ctx.fillRect(0, 0, size, size);
  // zoom in on the face: source square centred at (0.5, 0.45) of the portrait
  const sw = mutant.width * 0.82;
  ctx.drawImage(mutant, mutant.width * 0.5 - sw / 2, mutant.height * 0.42 - sw / 2, sw, sw, 0, 0, size, size);
  ctx.restore();
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#0b0a10';
  ctx.beginPath();
  ctx.arc(r, r, r - 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#' + ring.toString(16).padStart(6, '0');
  ctx.beginPath();
  ctx.arc(r, r, r - 9, 0, Math.PI * 2);
  ctx.stroke();
  return c;
}
