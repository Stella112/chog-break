import Phaser from 'phaser';
import { ATTACKS, type AttackDef, type AttackId } from './attacks';
import type { ArenaCtx, HitSpec } from './ctx';
import type { Controls } from './input';
import { baselineKit, type FighterKit, type PhysicsProfile } from './kit';
import { MATCH, newScore, type FighterScore } from './rules';
import { startClose, startSpecial } from './moves';
import { TUNING } from './tuning';

export type { PhysicsProfile };

export { TUNING };

type State = 'free' | 'attack' | 'dash' | 'hitstun' | 'action' | 'ko';

/** A timed move (special, close move, recovery). While running, the fighter is in state 'action'. */
export type Action = {
  until: number;
  /** Horizontal control while the action runs (0..1). */
  control: number;
  tick?: (now: number) => void;
  end?: () => void;
};

export class Fighter {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  readonly body: Phaser.Physics.Arcade.Body;
  readonly score: FighterScore = newScore();
  facing: 1 | -1;
  state: State = 'free';
  kit: FighterKit;
  ctx!: ArenaCtx;

  jumpsUsed = 0;
  recoveryUsed = false;
  airDashUsed = false;
  dropUntil = 0;
  invulnUntil = 0;
  stateUntil = 0;
  dashReadyAt = 0;
  specialReadyAt = 0;
  closeReadyAt = 0;
  attackId: AttackId | null = null;
  attackStart = 0;
  attackHit = false;
  comboStep = 0;
  lastAttackEnd = -9999;
  wasGrounded = false;
  action: Action | null = null;

  // gene state
  rageUntil = 0;
  bubbleUntil = 0;
  slowUntil = 0;
  hiddenUntil = 0;
  superArmorUntil = 0;
  shieldReady = true;
  undeadReady = true;
  blocking = false;
  guardHp = TUNING.guardHp;
  guardBrokenUntil = 0;
  tauntStart = 0;
  sizeMul = 1;
  sizeMode: 'none' | 'grow' | 'shrink' = 'none';
  slipperyUntil = 0;
  private nextPassiveTick = 0;
  private nextFrogAt = 0;
  private nextPulseAt = 0;
  private pulseEndAt = 0;
  private volatilityGrow = true;
  private baseScale = 1;
  private shadow: Phaser.GameObjects.Ellipse;
  private ring: Phaser.GameObjects.Ellipse;
  private tag: Phaser.GameObjects.Text;
  private lastFallSpeed = 0;

  constructor(
    readonly scene: Phaser.Scene,
    readonly index: 0 | 1,
    textureKey: string,
    readonly spawn: { x: number; y: number },
    readonly color: number,
    kit?: FighterKit,
  ) {
    this.kit = kit ?? baselineKit(`P${index + 1}`);
    this.facing = index === 0 ? 1 : -1;
    this.sprite = scene.physics.add.sprite(spawn.x, spawn.y, textureKey);
    this.sprite.setDisplaySize(TUNING.displaySize, TUNING.displaySize);
    this.baseScale = this.sprite.scaleX;
    this.body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const k = this.sprite.width / TUNING.displaySize;
    this.body.setSize(TUNING.bodyW * k, TUNING.bodyH * k);
    this.body.setOffset((this.sprite.width - TUNING.bodyW * k) / 2, this.sprite.height - TUNING.bodyH * k - 6 * k);
    this.body.setMaxVelocityY(TUNING.maxFall * 1.8);
    this.body.setAllowGravity(true);
    this.applyFacing();
    // Readability: ground shadow, player-colour ring under the feet, and a P1/P2/CPU tag.
    this.shadow = scene.add.ellipse(spawn.x, spawn.y, 76, 16, 0x000000, 0.35).setDepth(9);
    this.ring = scene.add.ellipse(spawn.x, spawn.y, 84, 20).setStrokeStyle(3, color, 0.9).setDepth(9);
    this.tag = scene.add
      .text(spawn.x, spawn.y - 80, '', { fontFamily: '"JetBrains Mono", monospace', fontSize: '14px', color: '#' + color.toString(16).padStart(6, '0'), stroke: '#000', strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(11);
  }

  setTag(text: string) {
    this.tag.setText(text);
  }

  get profile(): PhysicsProfile {
    return this.kit.profile;
  }
  get x() {
    return this.body.center.x;
  }
  get y() {
    return this.body.center.y;
  }
  /**
   * Arcade sets blocked/touching only on frames with a collision step, so a resting body can
   * read as airborne for a frame. Back it up with geometry: feet within 4 px of a platform top.
   */
  get grounded() {
    const b = this.body;
    if (b.blocked.down || b.touching.down) return true;
    if (b.velocity.y < -1 || !this.ctx) return false;
    const gy = this.ctx.groundAt(this.x, b.bottom - 8);
    return gy !== null && Math.abs(b.bottom - gy) <= 4;
  }
  /** Current weight including PUMP/DUMP pulses. */
  get weight() {
    const w = this.profile.weight;
    return this.sizeMode === 'grow' ? w + 0.2 : this.sizeMode === 'shrink' ? Math.max(0.6, w - 0.15) : w;
  }
  get reach() {
    return this.sizeMode === 'grow' ? 1.2 : 1;
  }
  get damageDealtMul() {
    return this.scene.time.now < this.rageUntil ? 1.3 : 1;
  }
  get damageTakenMul() {
    return this.scene.time.now < this.rageUntil ? 1.15 : 1;
  }
  hasArmor(now: number) {
    // GOLDEN BULL: the dash has super armor.
    return now < this.superArmorUntil || (this.kit.recipe === 'GOLDEN_BULL' && this.state === 'dash');
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
    if (this.state === 'ko') return;
    const mods = this.ctx.mods;
    b.setGravityY(T.gravity * (p.gravity * mods.gravity - 1));

    const grounded = this.grounded;
    if (grounded) {
      this.jumpsUsed = 0;
      this.recoveryUsed = false;
      this.airDashUsed = false;
    }

    this.passives(now, opponent);

    // state timers
    if (this.state === 'hitstun' && now >= this.stateUntil) this.state = 'free';
    if (this.state === 'dash' && now >= this.stateUntil) {
      this.state = 'free';
      b.setVelocityX(b.velocity.x * 0.35);
    }
    if (this.state === 'attack' && this.attackId) {
      const a = ATTACKS[this.attackId];
      const t = now - this.attackStart;
      if (t >= a.startupMs && t < a.startupMs + a.activeMs && !this.attackHit) this.tryMelee(a, opponent, this.attackId === 'punch3');
      if (t >= a.startupMs + a.activeMs + a.recoveryMs) {
        this.state = 'free';
        this.attackId = null;
        this.lastAttackEnd = now;
      }
    }
    if (this.state === 'action' && this.action) {
      this.action.tick?.(now);
      if (this.state === 'action' && now >= this.action.until) this.endAction();
    }

    const free = this.state === 'free';
    const dir = (c.right ? 1 : 0) - (c.left ? 1 : 0);

    // GUARD heads: holding K on the ground blocks instead of dashing.
    this.blocking =
      this.kit.head === 'GUARD' && free && grounded && c.dashHeld && now >= this.guardBrokenUntil && this.guardHp > 0;
    if (!this.blocking && this.guardHp < TUNING.guardHp) this.guardHp = Math.min(TUNING.guardHp, this.guardHp + 6 * s);

    // horizontal movement
    if (this.state === 'hitstun') {
      b.setVelocityX(approach(b.velocity.x, 0, T.hitstunDrag * s));
    } else if (this.state === 'dash') {
      if (!this.attackHit) this.tryMelee(ATTACKS.dash, opponent, false);
    } else if (this.blocking) {
      b.setVelocityX(approach(b.velocity.x, 0, T.groundFriction * s));
    } else {
      const slow = now < this.slowUntil ? 0.85 : 1;
      const shrinkFast = this.sizeMode === 'shrink' ? 1.15 : 1;
      const max = T.runSpeed * p.speed * slow * shrinkFast * mods.speed;
      const control = this.state === 'attack' ? 0.35 : this.state === 'action' ? (this.action?.control ?? 0.35) : 1;
      if (dir !== 0 && control > 0) {
        const accel = (grounded ? T.groundAccel : T.airAccel) * control;
        b.setVelocityX(approach(b.velocity.x, dir * max, accel * s));
        if (free) {
          this.facing = dir as 1 | -1;
          this.applyFacing();
        }
      } else if (control > 0 || this.state !== 'action') {
        const slippery = now < this.slipperyUntil && this.kit.physics !== 'SLIPPERY' ? 0.25 : 1;
        const fr = grounded ? T.groundFriction * p.friction * mods.friction * slippery : T.airDrag;
        b.setVelocityX(approach(b.velocity.x, 0, fr * s));
      }
    }

    if (free && !this.blocking) {
      if (c.jump) this.jumpOrRecover(now, dir);
      if (c.down) {
        if (grounded) this.dropUntil = now + 220;
        else if (b.velocity.y > -100) b.setVelocityY(Math.max(b.velocity.y, T.fastFall));
      }
      if (c.punch) this.startPunch(now);
      else if (c.special && now >= this.specialReadyAt) {
        this.specialReadyAt = now + this.kit.specialCd;
        startSpecial(this, now);
      } else if (c.close && now >= this.closeReadyAt) {
        this.closeReadyAt = now + this.kit.closeCd;
        startClose(this, now);
      } else if (c.dash && now >= this.dashReadyAt && (grounded || !this.airDashUsed) && !(this.kit.head === 'GUARD' && grounded)) {
        this.startDash(now);
      }
    }

    // THE NAKED KING: hold I for 1 s while standing → 2 s super armor.
    if (this.kit.recipe === 'THE_NAKED_KING') {
      if (c.closeHeld && grounded && dir === 0 && (free || this.state === 'action')) {
        if (!this.tauntStart) this.tauntStart = now;
        else if (now - this.tauntStart >= 1000) {
          this.superArmorUntil = now + 2000;
          this.tauntStart = 0;
          this.ctx.fx('text', this.x, this.y - 80, 0xffd400, 22, 'SUPER ARMOR');
        }
      } else this.tauntStart = 0;
    }

    const maxFall = now < this.bubbleUntil ? T.maxFall * 0.35 : T.maxFall;
    if (b.velocity.y > maxFall && this.state !== 'hitstun') b.setVelocityY(maxFall);

    if (grounded && !this.wasGrounded) {
      this.squash(1.2, 0.82);
      // BOUNCY FLOOR: hard landings bounce back up (hold S to stick the landing).
      if (mods.bounce && this.lastFallSpeed > 380 && !c.down) b.setVelocityY(-this.lastFallSpeed * 0.6);
    }
    this.wasGrounded = grounded;
    this.lastFallSpeed = grounded ? 0 : Math.max(0, b.velocity.y);
    this.visuals(now);
  }

  private jumpOrRecover(now: number, dir: number) {
    const b = this.body;
    const T = TUNING;
    const p = this.profile;
    if (this.grounded) {
      b.setVelocityY(-T.jumpVelocity * p.jump);
      this.jumpsUsed = 1;
      this.squash(0.8, 1.2);
    } else if (this.jumpsUsed < this.kit.maxJumps) {
      b.setVelocityY(-T.doubleJumpVelocity * p.jump);
      this.jumpsUsed++;
      this.squash(0.85, 1.15);
    } else if (!this.recoveryUsed) {
      this.recoveryUsed = true;
      this.recover(now, dir);
    }
  }

  /** Recovery (W after the double jump). WARP heads teleport; HORNS heads charge upward and hit. */
  private recover(now: number, dir: number) {
    const b = this.body;
    const side = (dir || this.facing) as 1 | -1;
    if (this.kit.head === 'WARP') {
      const fromX = this.x;
      const fromY = this.y;
      b.reset(this.x + side * 150, this.y - 190);
      b.setVelocity(side * 120, -260);
      this.invulnUntil = Math.max(this.invulnUntil, now + 200);
      this.ctx.fx('ring', fromX, fromY, 0xb35cff, 40);
      this.ctx.fx('ring', this.x, this.y, 0xb35cff, 40);
      this.ctx.sfx('warp');
      if (this.kit.recipe === 'ARCHMAGE') {
        this.ctx.spawnZone({ owner: this, x: fromX - 45, y: fromY - 45, w: 90, h: 90, kind: 'rune', durationMs: 2000, armMs: 250, affects: 'opponent' });
      }
      return;
    }
    if (this.kit.head === 'HORNS') {
      b.setVelocity(side * 160, -TUNING.recoveryVelocity * 1.05);
      let hit = false;
      const spec: HitSpec = { damage: 6, base: 280, scaling: 4.5, angleDeg: 80, hitstunMs: 300, hitstopMs: 60, kind: 'melee' };
      this.startAction({
        until: now + 300,
        control: 0.6,
        tick: () => {
          if (hit) return;
          const foe = this.ctx.opponentOf(this);
          const box = new Phaser.Geom.Rectangle(this.x - 40, this.y - 70, 80, 70);
          if (Phaser.Geom.Intersects.RectangleToRectangle(box, foe.hurtbox())) {
            hit = this.ctx.hit(this, foe, spec, side) > 0 || true;
          }
        },
      });
      this.ctx.fx('burst', this.x, this.y - 40, 0xff4f4f, 8);
      return;
    }
    b.setVelocityY(-TUNING.recoveryVelocity);
    b.setVelocityX(side * TUNING.recoveryDrift);
    this.scene.events.emit('fx:recovery', this);
  }

  private startPunch(now: number) {
    this.comboStep = now - this.lastAttackEnd < TUNING.comboWindowMs ? (this.comboStep % 3) + 1 : 1;
    this.attackId = (['punch1', 'punch2', 'punch3'] as const)[this.comboStep - 1]!;
    this.attackStart = now;
    this.attackHit = false;
    this.state = 'attack';
    this.scene.events.emit('fx:swing', this, this.comboStep, this.attackId);
  }

  private startDash(now: number) {
    this.state = 'dash';
    this.stateUntil = now + TUNING.dashMs * this.profile.dashDistance;
    this.dashReadyAt = now + TUNING.dashCooldownMs * this.profile.dashCooldown;
    if (!this.grounded) this.airDashUsed = true;
    this.attackHit = false;
    this.body.setVelocity(this.facing * TUNING.dashSpeed, this.grounded ? 0 : -60);
    this.scene.events.emit('fx:dash', this);
    this.dashElement(now);
  }

  /** Aura genes that trigger on dash (§D4.8). */
  private dashElement(now: number) {
    const foe = this.ctx.opponentOf(this);
    switch (this.kit.element) {
      case 'BURN': {
        const gy = this.ctx.groundAt(this.x, this.y);
        if (gy !== null) {
          const len = TUNING.dashSpeed * (TUNING.dashMs * this.profile.dashDistance) / 1000;
          const x0 = this.facing === 1 ? this.x : this.x - len;
          this.ctx.spawnZone({ owner: this, x: x0, y: gy - 22, w: len, h: 22, kind: 'fire', durationMs: 2000, armMs: 300, affects: 'opponent' });
        }
        break;
      }
      case 'GUST':
        if (Math.hypot(foe.x - this.x, foe.y - this.y) < 180 && foe.state !== 'ko' && !foe.hasArmor(now)) {
          foe.body.setVelocity(Math.sign(foe.x - this.x || this.facing) * 760, -220);
          this.ctx.fx('ring', this.x, this.y, 0xdfe8ff, 70);
        }
        break;
      case 'SMOKE':
        this.ctx.spawnZone({ owner: this, x: this.x - 60, y: this.y - 60, w: 120, h: 120, kind: 'smoke', durationMs: 1000, affects: 'opponent' });
        this.hiddenUntil = now + 1000;
        break;
      default:
        break;
    }
  }

  hitbox(a: AttackDef): Phaser.Geom.Rectangle {
    const r = this.reach;
    const cx = this.x + a.box.x * r * this.facing;
    const cy = this.y + a.box.y;
    return new Phaser.Geom.Rectangle(cx - (a.box.w * r) / 2, cy - (a.box.h * r) / 2, a.box.w * r, a.box.h * r);
  }

  hurtbox(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(this.body.x, this.body.y, this.body.width, this.body.height);
  }

  /** Melee hit check for punches and dash. */
  tryMelee(a: AttackDef, target: Fighter, comboEnder: boolean) {
    const now = this.scene.time.now;
    if (target.isInvulnerable(now)) return;
    if (!Phaser.Geom.Intersects.RectangleToRectangle(this.hitbox(a), target.hurtbox())) return;
    this.attackHit = true;
    const shiv = this.kit.trinket === 'SHIV' && this.state === 'attack' ? 1.15 : 1;
    const spec: HitSpec = { ...a, damage: a.damage * shiv, kind: 'melee', comboEnder };
    if (comboEnder && this.kit.recipe === 'SKULL_AND_BONES') spec.angleDeg = 80;
    this.ctx.hit(this, target, spec, (target.x >= this.x ? 1 : -1) as 1 | -1);
  }

  takeHit(vx: number, vy: number, hitstunMs: number, now: number) {
    this.endAction();
    this.body.setVelocity(vx, vy);
    this.state = 'hitstun';
    this.attackId = null;
    this.blocking = false;
    this.stateUntil = now + hitstunMs;
    // Getting hit restores the recovery so a juggled fighter can still make it back.
    this.recoveryUsed = false;
    if (this.jumpsUsed > 1) this.jumpsUsed = 1;
  }

  stun(ms: number, now: number) {
    this.endAction();
    this.state = 'hitstun';
    this.attackId = null;
    this.stateUntil = Math.max(this.stateUntil, now + ms);
    this.body.setVelocityX(0);
  }

  startAction(a: Action) {
    this.endAction();
    this.action = a;
    this.state = 'action';
    this.attackId = null;
  }

  endAction() {
    const a = this.action;
    this.action = null;
    if (this.state === 'action') this.state = 'free';
    a?.end?.();
  }

  /** Timed passives: REGEN/BLOOM heal, TOXIC aura, FWOG helpers, PUMP/DUMP/VOLATILITY pulses. */
  private passives(now: number, foe: Fighter) {
    const k = this.kit;
    if (!this.nextPassiveTick) {
      this.nextPassiveTick = now + 1000;
      this.nextFrogAt = now + 6000;
      this.nextPulseAt = now + (k.recipe === 'VOLATILITY' ? 5000 : 10000);
    }
    if (now >= this.nextPassiveTick) {
      this.nextPassiveTick = now + 1000;
      const second = Math.floor(now / 1000);
      const heals = (k.trinket === 'REGEN' ? 1 : 0) + (k.element === 'BLOOM' ? 1 : 0);
      // §D4 says 1% every 2 s; tuned to every 3 s (healing dominated 120 s time-outs in the balance sim).
      if (heals && second % 3 === 0 && this.score.damage > 0) {
        this.score.damage = Math.max(0, this.score.damage - heals);
        this.ctx.fx('text', this.x, this.y - 70, 0x8aff4f, 16, `-${heals}%`);
      }
      if (k.affinity === 'TOXIC' && foe.state !== 'ko' && Math.hypot(foe.x - this.x, foe.y - this.y) < 90) {
        this.ctx.hit(this, foe, { damage: 1, base: 0, scaling: 0, angleDeg: 0, hitstunMs: 0, hitstopMs: 0, kind: 'zone', noKnockback: true }, 1);
      }
    }
    if (k.trinket === 'FWOG' && now >= this.nextFrogAt) {
      this.nextFrogAt = now + 6000;
      this.ctx.spawnFrog(this);
      if (k.recipe === 'FWOG_LORD') this.scene.time.delayedCall(350, () => this.state !== 'ko' && this.ctx.spawnFrog(this));
    }
    const pulses = k.trinket === 'PUMP' || k.trinket === 'DUMP' || k.recipe === 'VOLATILITY';
    if (pulses) {
      if (this.sizeMode !== 'none' && now >= this.pulseEndAt) this.setSize('none');
      if (now >= this.nextPulseAt) {
        const period = k.recipe === 'VOLATILITY' ? 5000 : 10000;
        this.nextPulseAt = now + period;
        this.pulseEndAt = now + 3000;
        let mode: 'grow' | 'shrink' = k.trinket === 'DUMP' ? 'shrink' : 'grow';
        if (k.recipe === 'VOLATILITY') {
          mode = this.volatilityGrow ? 'grow' : 'shrink';
          this.volatilityGrow = !this.volatilityGrow;
        }
        this.setSize(mode);
      }
    }
  }

  private setSize(mode: 'none' | 'grow' | 'shrink') {
    this.sizeMode = mode;
    this.sizeMul = mode === 'grow' ? 1.2 : mode === 'shrink' ? 0.8 : 1;
    if (mode !== 'none') this.ctx.fx('text', this.x, this.y - 80, mode === 'grow' ? 0x59ff6a : 0xff4f4f, 18, mode === 'grow' ? 'PUMP!' : 'DUMP!');
  }

  private visuals(now: number) {
    const b = this.body;
    const gy = this.ctx.groundAt(this.x, b.bottom - 4);
    const visible = this.state !== 'ko';
    if (gy !== null && visible) {
      const h = Math.max(0, gy - b.bottom);
      const s = Phaser.Math.Clamp(1 - h / 400, 0.3, 1);
      this.shadow.setPosition(this.x, gy).setScale(s * this.sizeMul).setAlpha(0.35 * s).setVisible(true);
      this.ring.setPosition(this.x, gy).setScale(s * this.sizeMul).setVisible(h < 6);
    } else {
      this.shadow.setVisible(false);
      this.ring.setVisible(false);
    }
    this.tag.setPosition(this.x, b.y - 22 * this.sizeMul - 10).setVisible(visible);
    const lean = this.state === 'hitstun' ? b.velocity.x * 0.02 : (b.velocity.x / TUNING.runSpeed) * 7;
    this.sprite.setAngle(Phaser.Math.Clamp(lean, -25, 25));
    let alpha = 1;
    if (now < this.invulnUntil) alpha = Math.floor(now / 80) % 2 ? 0.35 : 1;
    if (now < this.hiddenUntil) alpha = 0.15;
    this.sprite.setAlpha(alpha);
    if (!this.scene.tweens.isTweening(this.sprite)) this.sprite.setScale(this.baseScale * this.sizeMul);
    if (now < this.rageUntil) this.sprite.setTint(0xff8080);
    else if (now < this.superArmorUntil) this.sprite.setTint(0xffe680);
    else if (this.blocking) this.sprite.setTint(0x9fd8ff);
    else if (this.kit.unstable) this.sprite.setTint(Phaser.Display.Color.HSVToRGB(((now / 1500) % 1), 0.25, 1).color);
    else if (this.sprite.isTinted && !this.sprite.tintFill) this.sprite.clearTint();
  }

  ko() {
    this.endAction();
    this.state = 'ko';
    this.body.setVelocity(0, 0);
    this.body.setAllowGravity(false);
    this.sprite.setVisible(false);
    this.shadow.setVisible(false);
    this.ring.setVisible(false);
    this.tag.setVisible(false);
  }

  respawnAt(now: number, x = this.spawn.x, y = this.spawn.y - 220) {
    this.state = 'free';
    this.attackId = null;
    this.action = null;
    this.sprite.setVisible(true);
    this.body.setAllowGravity(true);
    this.body.reset(x, y);
    this.body.setVelocity(0, 0);
    this.invulnUntil = now + MATCH.respawnInvulnMs;
    this.jumpsUsed = 1;
    this.recoveryUsed = false;
    this.shieldReady = true;
    this.rageUntil = 0;
    this.bubbleUntil = 0;
  }

  private squash(sx: number, sy: number) {
    const base = this.baseScale * this.sizeMul;
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.setScale(base * sx, base * sy);
    this.scene.tweens.add({ targets: this.sprite, scaleX: base, scaleY: base, duration: 140, ease: 'Back.Out' });
  }
}

function approach(v: number, target: number, step: number) {
  return v < target ? Math.min(v + step, target) : Math.max(v - step, target);
}
