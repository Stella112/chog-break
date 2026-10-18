import Phaser from 'phaser';
import { ATTACKS, type AttackDef, type AttackId } from './attacks';
import type { Controls } from './input';
import { knockback, knockbackVector, MATCH, newScore, type FighterScore } from './rules';

/** Per-fighter physics profile. Phase 3: everyone is BALANCED; Phase 4 maps Body genes here. */
export type PhysicsProfile = {
  weight: number;
  speed: number;
  gravity: number;
  jump: number;
  friction: number;
  dashDistance: number;
  dashCooldown: number;
};

export const BALANCED: PhysicsProfile = { weight: 1, speed: 1, gravity: 1, jump: 1, friction: 1, dashDistance: 1, dashCooldown: 1 };

export const TUNING = {
  gravity: 1900,
  runSpeed: 390,
  groundAccel: 3600,
  airAccel: 1700,
  groundFriction: 2800,
  airDrag: 260,
  hitstunDrag: 520,
  jumpVelocity: 780,
  doubleJumpVelocity: 720,
  recoveryVelocity: 860,
  recoveryDrift: 260,
  fastFall: 1300,
  maxFall: 1150,
  dashSpeed: 820,
  dashMs: 160,
  dashCooldownMs: 650,
  comboWindowMs: 380,
  bodyW: 58,
  bodyH: 78,
  displaySize: 112,
};

type State = 'free' | 'attack' | 'dash' | 'hitstun' | 'ko';

export type HitEvent = { attacker: Fighter; target: Fighter; attack: AttackDef; damage: number; force: number };

export class Fighter {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  readonly body: Phaser.Physics.Arcade.Body;
  readonly score: FighterScore = newScore();
  facing: 1 | -1;
  state: State = 'free';
  profile: PhysicsProfile = BALANCED;

  jumpsUsed = 0;
  recoveryUsed = false;
  airDashUsed = false;
  dropUntil = 0;
  invulnUntil = 0;
  stateUntil = 0;
  dashReadyAt = 0;
  attackId: AttackId | null = null;
  attackStart = 0;
  attackHit = false;
  comboStep = 0;
  lastAttackEnd = -9999;
  wasGrounded = false;
  /** Damage dealt by this fighter's attack this frame (read by the scene). */
  pendingHits: HitEvent[] = [];

  constructor(
    readonly scene: Phaser.Scene,
    readonly index: 0 | 1,
    textureKey: string,
    readonly spawn: { x: number; y: number },
    readonly color: number,
  ) {
    this.facing = index === 0 ? 1 : -1;
    this.sprite = scene.physics.add.sprite(spawn.x, spawn.y, textureKey);
    this.sprite.setDisplaySize(TUNING.displaySize, TUNING.displaySize);
    this.body = this.sprite.body as Phaser.Physics.Arcade.Body;
    // Body size is in texture pixels; convert from display size.
    const k = this.sprite.width / TUNING.displaySize;
    this.body.setSize(TUNING.bodyW * k, TUNING.bodyH * k);
    this.body.setOffset((this.sprite.width - TUNING.bodyW * k) / 2, this.sprite.height - TUNING.bodyH * k - 6 * k);
    this.body.setMaxVelocityY(TUNING.maxFall * 1.8);
    this.body.setAllowGravity(true);
    this.applyFacing();
  }

  get x() {
    return this.body.center.x;
  }
  get y() {
    return this.body.center.y;
  }
  get grounded() {
    return this.body.blocked.down || this.body.touching.down;
  }
  isInvulnerable(now: number) {
    return now < this.invulnUntil || this.state === 'ko';
  }

  private applyFacing() {
    this.sprite.setFlipX(this.facing === -1);
  }

  update(now: number, dt: number, c: Controls, opponent: Fighter) {
    const b = this.body;
    const T = TUNING;
    const p = this.profile;
    const s = dt / 1000;
    this.pendingHits = [];
    if (this.state === 'ko') return;
    b.setGravityY(T.gravity * (p.gravity - 1));

    const grounded = this.grounded;
    if (grounded) {
      this.jumpsUsed = 0;
      this.recoveryUsed = false;
      this.airDashUsed = false;
    }

    // state timers
    if (this.state === 'hitstun' && now >= this.stateUntil) this.state = 'free';
    if (this.state === 'dash' && now >= this.stateUntil) {
      this.state = 'free';
      b.setVelocityX(b.velocity.x * 0.35);
    }
    if (this.state === 'attack' && this.attackId) {
      const a = ATTACKS[this.attackId];
      const t = now - this.attackStart;
      if (t >= a.startupMs && t < a.startupMs + a.activeMs && !this.attackHit) this.tryHit(a, opponent, now);
      if (t >= a.startupMs + a.activeMs + a.recoveryMs) {
        this.state = 'free';
        this.attackId = null;
        this.lastAttackEnd = now;
      }
    }

    const free = this.state === 'free';
    const dir = (c.right ? 1 : 0) - (c.left ? 1 : 0);

    // horizontal movement
    if (this.state === 'hitstun') {
      b.setVelocityX(approach(b.velocity.x, 0, T.hitstunDrag * s));
    } else if (this.state === 'dash') {
      if (this.attackHit === false) this.tryHit(ATTACKS.dash, opponent, now);
    } else {
      const max = T.runSpeed * p.speed;
      const control = this.state === 'attack' ? 0.35 : 1;
      if (dir !== 0) {
        const accel = (grounded ? T.groundAccel : T.airAccel) * control;
        b.setVelocityX(approach(b.velocity.x, dir * max, accel * s));
        if (free) {
          this.facing = dir as 1 | -1;
          this.applyFacing();
        }
      } else {
        const fr = grounded ? T.groundFriction * p.friction : T.airDrag;
        b.setVelocityX(approach(b.velocity.x, 0, fr * s));
      }
    }

    if (free) {
      // jump / double jump / recovery (W after double jump)
      if (c.jump) {
        if (grounded) {
          b.setVelocityY(-T.jumpVelocity * p.jump);
          this.jumpsUsed = 1;
          this.squash(0.8, 1.2);
        } else if (this.jumpsUsed < 2) {
          b.setVelocityY(-T.doubleJumpVelocity * p.jump);
          this.jumpsUsed = 2;
          this.squash(0.85, 1.15);
        } else if (!this.recoveryUsed) {
          this.recoveryUsed = true;
          b.setVelocityY(-T.recoveryVelocity);
          b.setVelocityX(this.facing * T.recoveryDrift);
          this.scene.events.emit('fx:recovery', this);
        }
      }
      // drop through platforms / fast fall
      if (c.down) {
        if (grounded) this.dropUntil = now + 220;
        else if (b.velocity.y > -100) b.setVelocityY(Math.max(b.velocity.y, T.fastFall));
      }
      if (c.punch) this.startPunch(now);
      else if (c.dash && now >= this.dashReadyAt && (grounded || !this.airDashUsed)) this.startDash(now);
    }

    if (b.velocity.y > T.maxFall && this.state !== 'hitstun') b.setVelocityY(T.maxFall);

    // landing squash + run lean
    if (grounded && !this.wasGrounded) this.squash(1.2, 0.82);
    this.wasGrounded = grounded;
    const lean = this.state === 'hitstun' ? b.velocity.x * 0.02 : (b.velocity.x / T.runSpeed) * 7;
    this.sprite.setAngle(Phaser.Math.Clamp(lean, -25, 25));
    this.sprite.setAlpha(now < this.invulnUntil ? (Math.floor(now / 80) % 2 ? 0.35 : 1) : 1);
  }

  private startPunch(now: number) {
    this.comboStep = now - this.lastAttackEnd < TUNING.comboWindowMs ? (this.comboStep % 3) + 1 : 1;
    this.attackId = (['punch1', 'punch2', 'punch3'] as const)[this.comboStep - 1]!;
    this.attackStart = now;
    this.attackHit = false;
    this.state = 'attack';
    this.scene.events.emit('fx:swing', this, this.comboStep);
  }

  private startDash(now: number) {
    this.state = 'dash';
    this.stateUntil = now + TUNING.dashMs * this.profile.dashDistance;
    this.dashReadyAt = now + TUNING.dashCooldownMs * this.profile.dashCooldown;
    if (!this.grounded) this.airDashUsed = true;
    this.attackHit = false;
    this.body.setVelocity(this.facing * TUNING.dashSpeed, this.grounded ? 0 : -60);
    this.scene.events.emit('fx:dash', this);
  }

  hitbox(a: AttackDef): Phaser.Geom.Rectangle {
    const cx = this.x + a.box.x * this.facing;
    const cy = this.y + a.box.y;
    return new Phaser.Geom.Rectangle(cx - a.box.w / 2, cy - a.box.h / 2, a.box.w, a.box.h);
  }

  hurtbox(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(this.body.x, this.body.y, this.body.width, this.body.height);
  }

  private tryHit(a: AttackDef, target: Fighter, now: number) {
    if (target.isInvulnerable(now)) return;
    if (!Phaser.Geom.Intersects.RectangleToRectangle(this.hitbox(a), target.hurtbox())) return;
    this.attackHit = true;
    const damage = a.damage;
    target.score.damage += damage;
    this.score.damageDealt += damage;
    const force = knockback(a, target.score.damage, target.profile.weight, this.scene.registry.get('kbMod') ?? 1);
    const facing = (target.x >= this.x ? 1 : -1) as 1 | -1;
    target.takeHit(force, a, facing, now);
    this.pendingHits.push({ attacker: this, target, attack: a, damage, force });
  }

  takeHit(force: number, a: AttackDef, facing: 1 | -1, now: number) {
    const { vx, vy } = knockbackVector(force, a.angleDeg, facing);
    this.body.setVelocity(vx, vy);
    this.state = 'hitstun';
    this.attackId = null;
    this.stateUntil = now + a.hitstunMs + force * 0.12;
    // Getting hit restores the recovery so a juggled fighter can still make it back.
    this.recoveryUsed = false;
    if (this.jumpsUsed > 1) this.jumpsUsed = 1;
  }

  ko() {
    this.state = 'ko';
    this.body.setVelocity(0, 0);
    this.body.setAllowGravity(false);
    this.sprite.setVisible(false);
  }

  respawnAt(now: number) {
    this.state = 'free';
    this.attackId = null;
    this.sprite.setVisible(true);
    this.body.setAllowGravity(true);
    this.body.reset(this.spawn.x, this.spawn.y - 220);
    this.body.setVelocity(0, 0);
    this.invulnUntil = now + MATCH.respawnInvulnMs;
    this.jumpsUsed = 1;
    this.recoveryUsed = false;
  }

  private squash(sx: number, sy: number) {
    const base = TUNING.displaySize / this.sprite.width;
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.setScale(base * sx, base * sy);
    this.scene.tweens.add({ targets: this.sprite, scaleX: base, scaleY: base, duration: 140, ease: 'Back.Out' });
  }
}

function approach(v: number, target: number, step: number) {
  return v < target ? Math.min(v + step, target) : Math.max(v - step, target);
}
