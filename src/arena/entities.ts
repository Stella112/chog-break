import Phaser from 'phaser';
import type { ArenaCtx, ProjectileOpts, ZoneOpts } from './ctx';
import type { Fighter } from './fighter';
import { STAGE } from './rules';

const DEPTH_FX = 8;

/** Seeded per-projectile RNG so CHAOS ORB bounces are unpredictable but reproducible. */
function lcg(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}
let projectileSeed = 1;
/** Headless sims reset this per match so a seeded match is reproducible. */
export function resetProjectileSeed(seed = 1) {
  projectileSeed = seed;
}

export class Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dieAt: number;
  bounces: number;
  alive = true;
  private gfx: Phaser.GameObjects.Arc | Phaser.GameObjects.Ellipse;
  private rand = lcg(projectileSeed++);

  constructor(
    scene: Phaser.Scene,
    private ctx: ArenaCtx,
    readonly o: ProjectileOpts,
  ) {
    this.x = o.x;
    this.y = o.y;
    this.vx = o.vx;
    this.vy = o.vy;
    this.dieAt = ctx.now() + o.lifeMs;
    this.bounces = o.bounces ?? 0;
    this.gfx =
      o.shape === 'coin'
        ? scene.add.ellipse(o.x, o.y, o.radius * 2, o.radius * 2, o.color).setStrokeStyle(3, 0xb08a00)
        : scene.add.circle(o.x, o.y, o.radius, o.color).setStrokeStyle(2, 0x000000, 0.6);
    this.gfx.setDepth(DEPTH_FX + 3);
  }

  update(dt: number) {
    if (!this.alive) return;
    const s = dt / 1000;
    const prevY = this.y;
    this.vy += this.o.gravity * s;
    this.x += this.vx * s;
    this.y += this.vy * s;
    if (this.o.shape === 'coin') this.gfx.scaleX = Math.abs(Math.cos(this.ctx.now() / 60));

    // Landing / bouncing on platforms (only while falling onto the top surface).
    if (this.vy > 0) {
      const gy = this.ctx.groundAt(this.x, prevY);
      if (gy !== null && prevY <= gy && this.y >= gy - this.o.radius * 0.2) {
        if (this.bounces > 0) {
          this.bounces--;
          this.y = gy - this.o.radius;
          this.vy = -Math.abs(this.vy) * (0.6 + this.rand() * 0.5);
          this.vx = (this.rand() < 0.35 ? -this.vx : this.vx) * (0.7 + this.rand() * 0.7);
        } else if (this.o.onLand) {
          this.o.onLand(this.x, gy);
          return this.destroy();
        } else if (this.o.gravity > 0) {
          return this.destroy();
        }
      }
    }

    const foe = this.ctx.opponentOf(this.o.owner);
    if (foe.state !== 'ko') {
      const hb = foe.hurtbox();
      const circle = new Phaser.Geom.Circle(this.x, this.y, this.o.radius);
      if (Phaser.Geom.Intersects.CircleToRectangle(circle, hb)) {
        this.ctx.hit(this.o.owner, foe, this.o.spec, (this.vx >= 0 ? 1 : -1) as 1 | -1);
        return this.destroy();
      }
    }
    if (this.ctx.now() >= this.dieAt || this.x < STAGE.blast.left || this.x > STAGE.blast.right || this.y > STAGE.blast.bottom) {
      return this.destroy();
    }
    this.gfx.setPosition(this.x, this.y);
  }

  destroy() {
    this.alive = false;
    this.gfx.destroy();
  }
}

const ZONE_STYLE: Record<ZoneOpts['kind'], { color: number; alpha: number }> = {
  puddle: { color: 0x7fd4ff, alpha: 0.55 },
  fire: { color: 0xff7a1a, alpha: 0.6 },
  rune: { color: 0xb35cff, alpha: 0.5 },
  smoke: { color: 0xc8c8d8, alpha: 0.55 },
  toxic: { color: 0x8aff4f, alpha: 0.35 },
  'floor-toxic': { color: 0x8aff4f, alpha: 0.6 },
  meteor: { color: 0xff4f4f, alpha: 0.35 },
  bite: { color: 0x2fbfbf, alpha: 0.4 },
};

/** Damage-tick zones hit every 500 ms (fire, rune, toxic floor: "1 dmg / 0.5 s"). */
export class Zone {
  readonly rect: Phaser.Geom.Rectangle;
  readonly activeAt: number;
  readonly dieAt: number;
  alive = true;
  private nextTick = new Map<Fighter, number>();
  private gfx: Phaser.GameObjects.Rectangle;

  constructor(
    scene: Phaser.Scene,
    private ctx: ArenaCtx,
    readonly o: ZoneOpts,
  ) {
    const now = ctx.now();
    this.rect = new Phaser.Geom.Rectangle(o.x, o.y, o.w, o.h);
    this.activeAt = now + (o.armMs ?? 0);
    this.dieAt = this.activeAt + o.durationMs;
    const st = ZONE_STYLE[o.kind];
    this.gfx = scene.add.rectangle(o.x + o.w / 2, o.y + o.h / 2, o.w, o.h, st.color, st.alpha).setDepth(DEPTH_FX);
    if (o.kind === 'smoke') this.gfx.setDepth(DEPTH_FX + 5);
    if (o.kind === 'meteor') {
      // Telegraph: a target on the floor, then the rock drops from the sky just as the zone arms.
      this.gfx.setSize(o.w, 8).setPosition(o.x + o.w / 2, o.y + o.h - 4);
      const rock = scene.add.circle(o.x + o.w / 2, -60, 30, 0x6b4a3a).setStrokeStyle(4, 0xff7a1a).setDepth(DEPTH_FX + 4);
      scene.tweens.add({ targets: rock, y: o.y + o.h - 30, duration: o.armMs ?? 1000, ease: 'Quad.In', onComplete: () => rock.destroy() });
    }
  }

  get active() {
    return this.ctx.now() >= this.activeAt;
  }

  affects(f: Fighter) {
    if (f.state === 'ko') return false;
    return this.o.affects === 'all' || (this.o.owner !== null && f !== this.o.owner);
  }

  update(fighters: Fighter[]) {
    if (!this.alive) return;
    const now = this.ctx.now();
    if (now >= this.dieAt) return this.destroy();
    const st = ZONE_STYLE[this.o.kind];
    // Telegraph: flicker while arming, then pulse.
    this.gfx.setAlpha(this.active ? st.alpha * (0.8 + 0.2 * Math.sin(now / 90)) : Math.floor(now / 70) % 2 ? 0.15 : st.alpha * 0.5);
    if (!this.active) return;
    for (const f of fighters) {
      if (!this.affects(f) || !Phaser.Geom.Intersects.RectangleToRectangle(this.rect, f.hurtbox())) continue;
      if (this.o.kind === 'puddle') {
        if (f.grounded) f.slipperyUntil = now + 80;
        continue;
      }
      if (this.o.kind === 'smoke') continue;
      const due = this.nextTick.get(f) ?? 0;
      if (now < due) continue;
      this.nextTick.set(f, this.o.once ? Infinity : now + 500);
      const attacker = this.o.owner;
      const spec = this.o.spec ?? { damage: 1, base: 0, scaling: 0, angleDeg: 0, hitstunMs: 0, hitstopMs: 0, kind: 'zone' as const, noKnockback: true };
      const dir = (f.x >= this.rect.centerX ? 1 : -1) as 1 | -1;
      this.ctx.hit(attacker, f, spec, dir);
    }
  }

  destroy() {
    this.alive = false;
    this.gfx.destroy();
  }
}

/** FWOG helper: a little frog hops at the opponent (2 dmg). */
export class Frog {
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  alive = true;
  private dieAt: number;
  private nextHopAt = 0;
  private gfx: Phaser.GameObjects.Container;

  constructor(
    scene: Phaser.Scene,
    private ctx: ArenaCtx,
    readonly owner: Fighter,
  ) {
    this.x = owner.x;
    this.y = owner.y - 20;
    this.dieAt = ctx.now() + 3500;
    const body = scene.add.ellipse(0, 0, 26, 18, 0x59d68a).setStrokeStyle(2, 0x1c5a32);
    const e1 = scene.add.circle(-6, -9, 4, 0xffffff).setStrokeStyle(1, 0x1c5a32);
    const e2 = scene.add.circle(6, -9, 4, 0xffffff).setStrokeStyle(1, 0x1c5a32);
    this.gfx = scene.add.container(this.x, this.y, [body, e1, e2]).setDepth(DEPTH_FX + 2);
  }

  update(dt: number) {
    if (!this.alive) return;
    const s = dt / 1000;
    const now = this.ctx.now();
    const foe = this.ctx.opponentOf(this.owner);
    this.vy += 1500 * s;
    const prevY = this.y;
    this.x += this.vx * s;
    this.y += this.vy * s;
    const gy = this.ctx.groundAt(this.x, prevY);
    const onGround = gy !== null && this.vy >= 0 && prevY <= gy && this.y >= gy - 9;
    if (onGround) {
      this.y = gy! - 9;
      this.vy = 0;
      this.vx = 0;
      if (now >= this.nextHopAt) {
        this.nextHopAt = now + 380;
        this.vx = Phaser.Math.Clamp(foe.x - this.x, -380, 380);
        this.vy = -560;
      }
    }
    if (foe.state !== 'ko' && Phaser.Geom.Intersects.CircleToRectangle(new Phaser.Geom.Circle(this.x, this.y, 12), foe.hurtbox())) {
      this.ctx.hit(this.owner, foe, { damage: 2, base: 120, scaling: 1.5, angleDeg: 40, hitstunMs: 180, hitstopMs: 30, kind: 'helper' }, (foe.x >= this.x ? 1 : -1) as 1 | -1);
      return this.destroy();
    }
    if (now >= this.dieAt || this.y > STAGE.blast.bottom) return this.destroy();
    this.gfx.setPosition(this.x, this.y);
  }

  destroy() {
    this.alive = false;
    this.gfx.destroy();
  }
}

/** COIN RAIN pickup: falls onto the stage; touching it heals 5%. */
export class Coin {
  x: number;
  y = -30;
  vy = 0;
  alive = true;
  private dieAt: number;
  private gfx: Phaser.GameObjects.Ellipse;

  constructor(
    scene: Phaser.Scene,
    private ctx: ArenaCtx,
    x: number,
  ) {
    this.x = x;
    this.dieAt = ctx.now() + 9000;
    this.gfx = scene.add.ellipse(x, this.y, 26, 26, 0xffd400).setStrokeStyle(3, 0xb08a00).setDepth(DEPTH_FX + 2);
  }

  update(dt: number, fighters: Fighter[]) {
    if (!this.alive) return;
    const now = this.ctx.now();
    const prevY = this.y;
    this.vy = Math.min(this.vy + 900 * (dt / 1000), 420);
    this.y += this.vy * (dt / 1000);
    const gy = this.ctx.groundAt(this.x, prevY);
    if (gy !== null && this.y >= gy - 13) {
      this.y = gy - 13;
      this.vy = 0;
    }
    this.gfx.setPosition(this.x, this.y);
    this.gfx.scaleX = Math.abs(Math.cos(now / 160));
    for (const f of fighters) {
      if (f.state === 'ko') continue;
      if (Phaser.Geom.Intersects.CircleToRectangle(new Phaser.Geom.Circle(this.x, this.y, 14), f.hurtbox())) {
        f.score.damage = Math.max(0, f.score.damage - 5);
        this.ctx.fx('text', f.x, f.y - 80, 0xffd400, 18, '-5%');
        this.ctx.sfx('heal');
        return this.destroy();
      }
    }
    if (now >= this.dieAt || this.y > STAGE.blast.bottom) this.destroy();
  }

  destroy() {
    this.alive = false;
    this.gfx.destroy();
  }
}
