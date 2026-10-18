// §D7 bot: transparent finite-state machine. No ML, no external AI.
import { EMPTY_CONTROLS, type ControlSource, type Controls } from './input';
import type { Fighter } from './fighter';
import { STAGE } from './rules';

export type Difficulty = 'easy' | 'normal' | 'hard';
export type BotState = 'APPROACH' | 'ATTACK' | 'SPACE' | 'RECOVER' | 'EDGEGUARD';

export const BOT_LEVELS: Record<
  Difficulty,
  { reactionMs: number; attackGapMs: number; mistake: number; dashChance: number; lateRecovery: number; spaceMs: number; ability: number }
> = {
  easy: { reactionMs: 400, attackGapMs: 650, mistake: 0.3, dashChance: 0.05, lateRecovery: 0.35, spaceMs: 0, ability: 0.12 },
  normal: { reactionMs: 220, attackGapMs: 330, mistake: 0.1, dashChance: 0.2, lateRecovery: 0.05, spaceMs: 250, ability: 0.35 },
  hard: { reactionMs: 110, attackGapMs: 170, mistake: 0.03, dashChance: 0.35, lateRecovery: 0, spaceMs: 380, ability: 0.65 },
};

/** Tiny seeded PRNG so bot behaviour is reproducible in headless tests. */
function lcg(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

export class BotSource implements ControlSource {
  state: BotState = 'APPROACH';
  private rand: () => number;
  private history: { t: number; x: number; y: number }[] = [];
  private lastAttackAt = -9999;
  private lastAbilityThink = 0;
  private lastJumpAt = -9999;
  private spaceUntil = 0;
  private stuckSince = 0;
  private stuckX = 0;
  private now = 0;
  private skipRecoveryThisFall = false;
  private wasOffstage = false;

  constructor(
    private self: Fighter,
    private foe: Fighter,
    readonly difficulty: Difficulty = 'normal',
    seed = 1,
    private clock: () => number = () => self.scene.time.now,
  ) {
    this.rand = lcg(seed);
  }

  private get L() {
    return BOT_LEVELS[this.difficulty];
  }

  /** Opponent position as seen `reactionMs` ago. */
  private seenFoe() {
    const target = this.now - this.L.reactionMs;
    for (let i = this.history.length - 1; i >= 0; i--) if (this.history[i]!.t <= target) return this.history[i]!;
    return this.history[0] ?? { t: this.now, x: this.foe.x, y: this.foe.y };
  }

  read(): Controls {
    this.now = this.clock();
    if (this.now >= this.foe.hiddenUntil || this.history.length === 0) this.history.push({ t: this.now, x: this.foe.x, y: this.foe.y });
    while (this.history.length > 2 && this.history[1]!.t < this.now - 600) this.history.shift();

    const c: Controls = { ...EMPTY_CONTROLS };
    const me = this.self;
    if (me.state === 'ko') return c;
    const foe = this.seenFoe();
    const dx = foe.x - me.x;
    const dy = foe.y - me.y;
    const offstage = isOffstage(me.x, me.y);
    const foeOffstage = isOffstage(foe.x, foe.y);

    if (offstage && !this.wasOffstage) this.skipRecoveryThisFall = this.rand() < this.L.lateRecovery;
    this.wasOffstage = offstage;

    if (offstage) this.state = 'RECOVER';
    else if (foeOffstage && this.foe.state !== 'ko') this.state = 'EDGEGUARD';
    else if (this.now < this.spaceUntil) this.state = 'SPACE';
    else if (Math.abs(dx) < 90 && Math.abs(dy) < 70) this.state = 'ATTACK';
    else this.state = 'APPROACH';

    switch (this.state) {
      case 'RECOVER':
        this.recover(c);
        break;
      case 'EDGEGUARD': {
        const edge = foe.x < STAGE.mainLeft ? STAGE.mainLeft + 40 : STAGE.mainRight - 40;
        this.moveTo(c, edge, 12);
        if (Math.abs(dx) < 100 && Math.abs(dy) < 90) this.attack(c, dx);
        break;
      }
      case 'SPACE':
        this.moveTo(c, me.x - Math.sign(dx || 1) * 200, 10);
        break;
      case 'ATTACK':
        this.attack(c, dx);
        break;
      case 'APPROACH': {
        this.moveTo(c, foe.x, 50);
        const grounded = me.grounded;
        if (dy < -110 && Math.abs(dx) < 260 && grounded) this.jump(c);
        if (dy > 110 && grounded && me.y < STAGE.mainY - 40) c.down = true;
        if (grounded && Math.abs(dx) > 150 && Math.abs(dx) < 270 && Math.abs(dy) < 60 && this.rand() < this.L.dashChance * 0.1) {
          c.dash = true;
        }
        // Never freeze against anything: if barely moving while chasing, hop.
        if (Math.abs(me.x - this.stuckX) > 6) {
          this.stuckX = me.x;
          this.stuckSince = this.now;
        } else if (this.now - this.stuckSince > 900 && Math.abs(dx) > 100) {
          this.jump(c);
          this.stuckSince = this.now;
        }
        break;
      }
    }
    if (this.state !== 'RECOVER' && this.state !== 'SPACE') this.abilities(c, dx, dy);
    // GUARD heads hold K when the opponent swings close by.
    if (me.kit.head === 'GUARD' && me.grounded && Math.abs(dx) < 130 && Math.abs(dy) < 80 && (this.foe.state === 'attack' || this.foe.state === 'action' || this.foe.state === 'dash') && this.rand() < this.L.ability + 0.25) {
      c.dashHeld = true;
      c.dash = false;
    }
    this.guardEdges(c);
    return c;
  }

  /** Uses the mutant's real moves: Eyes special (L) and Mouth close move (I). */
  private abilities(c: Controls, dx: number, dy: number) {
    const me = this.self;
    if (me.state !== 'free' || this.now - this.lastAbilityThink < 250) return;
    this.lastAbilityThink = this.now;
    if (this.rand() > this.L.ability) return;
    const facingFoe = Math.sign(dx) === me.facing;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    if (this.now >= me.specialReadyAt) {
      const sp = me.kit.special;
      const ranged = (sp === 'SPIT' || sp === 'BEAM' || sp === 'CHAOS_ORB') && facingFoe && ady < 60 && adx > 140 && adx < 800;
      const lob = sp === 'TEARS' && facingFoe && adx > 150 && adx < 450;
      const close = (sp === 'LEECH' || sp === 'RAGE') && facingFoe && adx < 220 && ady < 70;
      const blink = sp === 'BLINK' && facingFoe && adx > 250 && adx < 500 && ady < 60;
      if (ranged || lob || close || blink) {
        c.special = true;
        return;
      }
    }
    if (this.now >= me.closeReadyAt) {
      const cl = me.kit.close;
      const near = adx < 110 && ady < 70;
      const shield = cl === 'BUBBLE' && adx < 140 && (this.foe.state === 'attack' || this.foe.state === 'action');
      const coin = cl === 'COIN_TOSS' && facingFoe && adx > 250 && adx < 420;
      const melee = (cl === 'HEADBUTT' || cl === 'PUKE' || cl === 'HONK' || cl === 'DROOL') && near && (cl === 'HONK' || cl === 'DROOL' || facingFoe);
      if (shield || coin || melee) c.close = true;
    }
  }

  private moveTo(c: Controls, x: number, dead: number) {
    if (x > this.self.x + dead) c.right = true;
    else if (x < this.self.x - dead) c.left = true;
  }

  private jump(c: Controls) {
    if (this.now - this.lastJumpAt < 170) return;
    c.jump = true;
    this.lastJumpAt = this.now;
  }

  private attack(c: Controls, dx: number) {
    // face the target first
    if (Math.sign(dx) !== this.self.facing && Math.abs(dx) > 8) {
      if (dx > 0) c.right = true;
      else c.left = true;
      return;
    }
    if (this.now - this.lastAttackAt < this.L.attackGapMs) return;
    this.lastAttackAt = this.now;
    if (this.rand() < this.L.mistake) {
      // whiff: step the wrong way
      if (dx > 0) c.left = true;
      else c.right = true;
      return;
    }
    // Hard gets aggressive when the player is heavily damaged.
    const finisher = this.difficulty === 'hard' && this.foe.score.damage > 90;
    c.punch = true;
    if (this.self.comboStep === 3 || finisher) this.spaceUntil = this.now + this.L.spaceMs;
  }

  private recover(c: Controls) {
    const me = this.self;
    const centre = (STAGE.mainLeft + STAGE.mainRight) / 2;
    this.moveTo(c, centre, 0);
    const falling = me.body.velocity.y > -50;
    const below = me.y > STAGE.mainY - 30;
    const farX = me.x < STAGE.mainLeft - 220 || me.x > STAGE.mainRight + 220;
    if (this.skipRecoveryThisFall && me.y < STAGE.mainY + 80) return; // easy: waits too long
    if (me.kit.special === 'BLINK' && this.now >= me.specialReadyAt && me.state === 'free' && me.y < STAGE.mainY + 60 && Math.sign(centre - me.x) === me.facing && (me.x < STAGE.mainLeft - 120 || me.x > STAGE.mainRight + 120)) {
      c.special = true;
      return;
    }
    if (falling && me.jumpsUsed < 2) this.jump(c);
    else if (falling && below && !me.recoveryUsed) this.jump(c);
    else if (farX && !me.airDashUsed && this.difficulty !== 'easy' && falling && me.state === 'free') {
      // face stage then air-dash toward it
      c.dash = Math.sign(centre - me.x) === me.facing;
    }
  }

  /** Don't walk off the main platform unless already recovering. */
  private guardEdges(c: Controls) {
    const me = this.self;
    if (!me.grounded || me.y < STAGE.mainY - 60) return;
    if (c.left && me.x < STAGE.mainLeft + 30) c.left = false;
    if (c.right && me.x > STAGE.mainRight - 30) c.right = false;
  }
}

export function isOffstage(x: number, y: number) {
  return x < STAGE.mainLeft - 6 || x > STAGE.mainRight + 6 || y > STAGE.mainY + 10;
}
