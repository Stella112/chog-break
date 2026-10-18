import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import type { ModifierId } from '../core/arenaRules';
import { MODIFIER_INFO } from '../config/geneInfo';
import { BotSource, type Difficulty } from './bot';
import type { ArenaCtx, HitSpec, ProjectileOpts, ZoneOpts } from './ctx';
import { Frog, Projectile, Zone } from './entities';
import { Fighter, TUNING } from './fighter';
import { EMPTY_CONTROLS, KEYMAP, KeyboardSource, type ControlSource } from './input';
import type { FighterKit } from './kit';
import { modifierPhysics, ToxicFloor } from './modifiers';
import { applyKO, isOutside, knockback, knockbackVector, MATCH, resolveMatch, respawn, STAGE } from './rules';

export type FighterSetup = { name: string; canvas: HTMLCanvasElement; color: number; kit?: FighterKit };
export type MatchResult = {
  winner: 0 | 1 | null;
  reason: 'stocks' | 'time';
  timeMs: number;
  fighters: { name: string; kos: number; damageDealt: number; livesLeft: number }[];
};
export type ArenaConfig = {
  fighters: [FighterSetup, FighterSetup];
  difficulty: Difficulty;
  /** 'human' uses keyboard (P1 keys for fighter 0, P2 keys for fighter 1); 'bot' uses the FSM. */
  drivers: ['human' | 'bot', 'human' | 'bot'];
  reducedMotion: boolean;
  onEnd: (r: MatchResult) => void;
  modifiers?: ModifierId[];
  testMode?: boolean;
  botSeed?: number;
  /** Skip countdown, effects and end-of-match pause (headless sims). */
  instant?: boolean;
};

/** §D4.5 says 60%; tuned in Phase 4 balance (revive was a free extra life in time-outs). */
export const UNDEAD_REVIVE_DAMAGE = 90;

const DEPTH = { bg: 0, platform: 5, fx: 8, fighter: 10, fxTop: 12, hud: 20 };

export class ArenaScene extends Phaser.Scene implements ArenaCtx {
  cfg!: ArenaConfig;
  fighters!: [Fighter, Fighter];
  sources!: [ControlSource, ControlSource];
  mods = { gravity: 1, friction: 1, kb: 1 };
  instant = false;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private floats!: Phaser.Physics.Arcade.StaticGroup;
  private projectiles: Projectile[] = [];
  private zones: Zone[] = [];
  private frogs: Frog[] = [];
  private toxicFloor: ToxicFloor | null = null;
  private hitstopUntil = 0;
  private live = false;
  private ended = false;
  private suddenDeath = false;
  private lastAttacker: [Fighter | null, Fighter | null] = [null, null];
  private hud!: { timer: Phaser.GameObjects.Text; panels: { dmg: Phaser.GameObjects.Text; pips: Phaser.GameObjects.Graphics }[]; banner: Phaser.GameObjects.Text };
  private scanImg: Phaser.GameObjects.Image | null = null;
  private trailAt = 0;
  private elapsedMs = 0;

  constructor() {
    super('arena');
  }

  init(cfg: ArenaConfig) {
    this.cfg = cfg;
    this.instant = !!cfg.instant;
    this.mods = modifierPhysics(cfg.modifiers ?? []);
    this.hitstopUntil = 0;
    this.live = false;
    this.ended = false;
    this.suddenDeath = false;
    this.elapsedMs = 0;
    this.lastAttacker = [null, null];
    this.projectiles = [];
    this.zones = [];
    this.frogs = [];
  }

  create() {
    this.drawBackground();
    this.buildStage();
    this.cfg.fighters.forEach((f, i) => {
      const key = `fighter-${i}`;
      if (this.textures.exists(key)) this.textures.remove(key);
      this.textures.addCanvas(key, f.canvas);
    });
    const spawns = [
      { x: STAGE.mainLeft + 200, y: STAGE.mainY - 60 },
      { x: STAGE.mainRight - 200, y: STAGE.mainY - 60 },
    ];
    this.fighters = [0, 1].map((i) => {
      const setup = this.cfg.fighters[i]!;
      const f = new Fighter(this, i as 0 | 1, `fighter-${i}`, spawns[i]!, setup.color, setup.kit);
      f.ctx = this;
      f.sprite.setDepth(DEPTH.fighter);
      return f;
    }) as [Fighter, Fighter];

    this.physics.add.collider(this.fighters.map((f) => f.sprite), this.platforms);
    this.physics.add.collider(this.fighters.map((f) => f.sprite), this.floats, undefined, (obj, plat) => {
      const body = (obj as Phaser.Physics.Arcade.Sprite).body as Phaser.Physics.Arcade.Body;
      const top = ((plat as Phaser.GameObjects.Rectangle).body as Phaser.Physics.Arcade.StaticBody).top;
      const fighter = this.fighters.find((f) => f.body === body)!;
      return body.velocity.y >= 0 && body.prev.y + body.height <= top + 6 && this.time.now >= fighter.dropUntil;
    });

    this.sources = this.cfg.drivers.map((d, i) => {
      if (d === 'bot') return new BotSource(this.fighters[i as 0 | 1], this.fighters[(1 - i) as 0 | 1], this.cfg.difficulty, (this.cfg.botSeed ?? 7) + i);
      const kb = this.input.keyboard;
      if (!kb) return { read: () => EMPTY_CONTROLS };
      return new KeyboardSource(kb, i === 0 ? KEYMAP.p1 : KEYMAP.p2);
    }) as [ControlSource, ControlSource];

    if (this.cfg.modifiers?.includes('TOXIC_FLOOR')) this.toxicFloor = new ToxicFloor(this);
    else this.toxicFloor = null;

    this.buildHud();
    this.wireFx();
    if (this.cfg.testMode) this.exposeTestHooks();
    if (this.instant) this.go();
    else this.countdown();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.cfg.testMode) delete (window as unknown as { __arena?: unknown }).__arena;
    });
  }

  private countdown() {
    const labels = ['3', '2', '1', 'GO!'];
    labels.forEach((l, i) =>
      this.time.delayedCall(i * 450, () => {
        this.hud.banner.setText(l).setAlpha(1).setScale(1.4);
        this.tweens.add({ targets: this.hud.banner, scale: 1, duration: 200 });
        sfx.countdown(l === 'GO!');
        if (l === 'GO!') {
          this.go();
          this.tweens.add({ targets: this.hud.banner, alpha: 0, delay: 350, duration: 250 });
        }
      }),
    );
  }

  private go() {
    this.live = true;
  }

  update(time: number, delta: number) {
    if (this.scanImg) this.scanImg.y = -6 + ((time / 40) % 6);
    if (!this.live || this.ended) return;
    const dt = Math.min(delta, 50);

    if (time < this.hitstopUntil) {
      this.physics.world.pause();
      return;
    }
    if (this.physics.world.isPaused) this.physics.world.resume();
    this.elapsedMs += dt;

    const [a, b] = this.fighters;
    const ca = this.sources[0].read();
    const cb = this.sources[1].read();
    a.update(time, dt, ca, b);
    b.update(time, dt, cb, a);

    this.toxicFloor?.update(time);
    for (const p of this.projectiles) p.update(dt);
    for (const z of this.zones) z.update(this.fighters);
    for (const fr of this.frogs) fr.update(dt);
    this.projectiles = this.projectiles.filter((p) => p.alive);
    this.zones = this.zones.filter((z) => z.alive);
    this.frogs = this.frogs.filter((f) => f.alive);

    for (const f of this.fighters) {
      if (f.state !== 'ko' && isOutside(f.x, f.y)) this.onBlast(f);
      if (!this.instant && f.state === 'hitstun' && Math.hypot(f.body.velocity.x, f.body.velocity.y) > 650 && time > this.trailAt) {
        this.trailAt = time + 28;
        const dot = this.add.circle(f.x, f.y, 14, 0xffffff, 0.5).setDepth(DEPTH.fx);
        this.tweens.add({ targets: dot, alpha: 0, scale: 0.2, duration: 260, onComplete: () => dot.destroy() });
      }
    }
    this.updateHud();
    const outcome = resolveMatch([a.score, b.score], this.elapsedMs, this.suddenDeath);
    if (outcome.over) this.finish(outcome.winner, outcome.reason);
    else if ('suddenDeath' in outcome) this.startSuddenDeath();
  }

  // ---------- ArenaCtx ----------

  now() {
    return this.time.now;
  }

  opponentOf(f: Fighter): Fighter {
    return this.fighters[f.index === 0 ? 1 : 0];
  }

  /** The one damage pipeline: every gene's defensive/elemental rule lives here. Returns damage dealt. */
  hit(attacker: Fighter | null, target: Fighter, spec: HitSpec, dir: 1 | -1): number {
    const now = this.time.now;
    if (target.isInvulnerable(now)) return 0;
    const tick = spec.kind === 'zone';

    // BUBBLE shield absorbs everything except piercing beams and damage ticks.
    if (!spec.pierce && !tick && now < target.bubbleUntil) {
      this.fx('ring', target.x, target.y, 0xff9fd8, 50);
      this.sfx('block');
      return 0;
    }

    let dmg = spec.damage * (attacker?.damageDealtMul ?? 1) * target.damageTakenMul;
    if (target.kit.element === 'SHIELD' && target.shieldReady && !tick) {
      dmg *= 0.5;
      target.shieldReady = false;
      this.fx('text', target.x, target.y - 90, 0x4fa3ff, 16, 'SHIELD');
    }
    let blocked = false;
    if (target.blocking && !spec.pierce && !tick) {
      blocked = true;
      target.guardHp -= dmg;
      dmg *= 0.3;
      if (target.guardHp <= 0) {
        target.guardBrokenUntil = now + 3000;
        target.blocking = false;
        target.stun(600, now);
        this.fx('text', target.x, target.y - 90, 0xff4f4f, 20, 'GUARD BREAK');
      }
    }
    dmg = Math.round(dmg * 10) / 10;
    target.score.damage += dmg;
    if (attacker && attacker !== target) {
      attacker.score.damageDealt += dmg;
      this.lastAttacker[target.index] = attacker;
    }

    if (tick || spec.noKnockback) {
      if (!this.instant) {
        target.sprite.setTintFill(0x8aff4f);
        this.time.delayedCall(50, () => target.sprite.clearTint());
      }
      return dmg;
    }

    let big = false;
    if (blocked) {
      target.body.setVelocityX(dir * 160);
      this.sfx('block');
    } else if (!target.hasArmor(now)) {
      if (spec.stunMs) {
        target.stun(spec.stunMs, now);
        this.fx('text', target.x, target.y - 90, 0xffffff, 18, 'STUNNED');
      } else {
        const force = knockback(spec, target.score.damage, target.weight, this.mods.kb * target.kit.kbTaken);
        const { vx, vy } = knockbackVector(force, spec.angleDeg, dir);
        let stun = spec.hitstunMs + force * 0.12;
        if (spec.comboEnder && attacker?.kit.element === 'SHOCK') {
          stun += 200;
          this.fx('burst', target.x, target.y, 0xffe94f, 10);
          this.sfx('zap');
        }
        target.takeHit(vx, vy, stun, now);
        big = force > 900;
      }
      if (attacker?.kit.element === 'FROST') {
        target.slowUntil = now + 800;
        this.fx('burst', target.x, target.y, 0x9fe8ff, 6);
      }
    }

    // feel: hitstop, flash, particles, number, sound, shake
    this.hitstopUntil = now + spec.hitstopMs + (big ? 30 : 0);
    if (!this.instant) {
      target.sprite.setTintFill(0xffffff);
      this.time.delayedCall(70, () => target.sprite.clearTint());
      this.burst(target.x, target.y, big ? 14 : 8, big ? 0xffd400 : 0xffffff);
      this.damageNumber(target.x, target.y - 60, Math.round(dmg), big);
      if (big) {
        sfx.bigHit();
        this.shake(160, 0.012);
      } else sfx.punch(attacker?.comboStep ?? 1);
    }
    return dmg;
  }

  spawnProjectile(o: ProjectileOpts) {
    this.projectiles.push(new Projectile(this, this, o));
  }

  spawnZone(o: ZoneOpts) {
    this.zones.push(new Zone(this, this, o));
  }

  spawnFrog(owner: Fighter) {
    if (owner.state === 'ko') return;
    this.frogs.push(new Frog(this, this, owner));
    this.fx('text', owner.x, owner.y - 80, 0x59d68a, 16, 'FWOG!');
  }

  beam(owner: Fighter, o: { y: number; color: number; width: number; spec: HitSpec; pierce: boolean; fireTrail: boolean }) {
    const x0 = owner.x + owner.facing * 30;
    const x1 = owner.facing === 1 ? STAGE.width + 100 : -100;
    const rect = new Phaser.Geom.Rectangle(Math.min(x0, x1), o.y - o.width / 2, Math.abs(x1 - x0), o.width);
    const foe = this.opponentOf(owner);
    if (foe.state !== 'ko' && Phaser.Geom.Intersects.RectangleToRectangle(rect, foe.hurtbox())) {
      this.hit(owner, foe, o.spec, owner.facing);
    }
    if (o.fireTrail) {
      for (let x = Math.min(x0, x1); x < Math.max(x0, x1); x += 110) {
        const gy = this.groundAt(x + 55, o.y);
        if (gy !== null && gy - o.y < 140) {
          this.spawnZone({ owner, x, y: gy - 22, w: 110, h: 22, kind: 'fire', durationMs: 2000, armMs: 200, affects: 'opponent' });
        }
      }
    }
    if (this.instant) return;
    const g = this.add.rectangle(rect.centerX, rect.centerY, rect.width, o.width, o.color, 0.9).setDepth(DEPTH.fxTop);
    const core = this.add.rectangle(rect.centerX, rect.centerY, rect.width, o.width * 0.35, 0xffffff, 0.95).setDepth(DEPTH.fxTop);
    this.tweens.add({ targets: [g, core], scaleY: 0, alpha: 0, duration: 220, onComplete: () => (g.destroy(), core.destroy()) });
    this.shake(120, 0.006);
  }

  fx(kind: 'burst' | 'ring' | 'text' | 'shake', x: number, y: number, color = 0xffffff, size = 10, text?: string) {
    if (this.instant) return;
    if (kind === 'burst') this.burst(x, y, size, color);
    else if (kind === 'shake') this.shake(size * 10, 0.008);
    else if (kind === 'ring') {
      const r = this.add.circle(x, y, size, color, 0).setStrokeStyle(4, color, 0.9).setDepth(DEPTH.fxTop);
      this.tweens.add({ targets: r, scale: 1.6, alpha: 0, duration: 320, onComplete: () => r.destroy() });
    } else if (kind === 'text' && text) {
      const t = this.add.text(x, y, text, { fontFamily: 'Bungee, Impact, sans-serif', fontSize: `${size}px`, color: Phaser.Display.Color.IntegerToColor(color).rgba, stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setDepth(DEPTH.fxTop);
      this.tweens.add({ targets: t, y: y - 36, alpha: 0, duration: 800, ease: 'Quad.Out', onComplete: () => t.destroy() });
    }
  }

  sfx(kind: 'special' | 'close' | 'heal' | 'block' | 'zap' | 'honk' | 'warp') {
    if (this.instant) return;
    sfx.move(kind);
  }

  /** Top of the nearest platform at or below y under x. */
  groundAt(x: number, y: number): number | null {
    let best: number | null = null;
    if (x >= STAGE.mainLeft && x <= STAGE.mainRight && y <= STAGE.mainY + 4) best = STAGE.mainY;
    for (const [fx, fy, fw] of STAGE.floats) {
      if (x >= fx && x <= fx + fw && y <= fy + 4 && (best === null || fy < best)) best = fy;
    }
    return best;
  }

  // ---------- match flow ----------

  private onBlast(f: Fighter) {
    const now = this.time.now;
    // UNDEAD: first KO each match revives on stage at 60% instead of losing a life.
    if (f.kit.affinity === 'UNDEAD' && f.undeadReady && !this.suddenDeath) {
      f.undeadReady = false;
      const x = Phaser.Math.Clamp(f.x, STAGE.mainLeft + 80, STAGE.mainRight - 80);
      f.score.damage = UNDEAD_REVIVE_DAMAGE;
      f.respawnAt(now, x, STAGE.mainY - 260);
      this.fx('text', x, STAGE.mainY - 330, 0xc8ffc8, 26, 'UNDEAD REVIVE');
      this.fx('ring', x, STAGE.mainY - 260, 0xc8ffc8, 70);
      sfx.ko();
      if (f.kit.recipe === 'NUCLEAR_UNDEAD') {
        const foe = this.opponentOf(f);
        this.fx('ring', x, STAGE.mainY - 260, 0x8aff4f, 200);
        if (foe.state !== 'ko' && Math.hypot(foe.x - x, foe.y - (STAGE.mainY - 260)) < 260) {
          this.hit(f, foe, { damage: 8, base: 380, scaling: 4, angleDeg: 60, hitstunMs: 360, hitstopMs: 80, kind: 'melee' }, (foe.x >= x ? 1 : -1) as 1 | -1);
        }
      }
      return;
    }
    const attacker = this.lastAttacker[f.index];
    if (!applyKO(f.score, attacker ? attacker.score : null)) return;
    if (!this.instant) {
      sfx.ko();
      this.shake(320, 0.02);
      const x = Phaser.Math.Clamp(f.x, 0, STAGE.width);
      const y = Phaser.Math.Clamp(f.y, 0, STAGE.height);
      const flash = this.add.circle(x, y, 40, f.color, 0.9).setDepth(DEPTH.fxTop);
      this.tweens.add({ targets: flash, scale: 9, alpha: 0, duration: 520, onComplete: () => flash.destroy() });
      this.burst(x, y, 24, f.color);
    }
    f.ko();
    this.lastAttacker[f.index] = null;
    if (f.score.lives > 0)
      this.time.delayedCall(this.instant ? 300 : 1100, () => {
        if (this.ended) return;
        respawn(f.score);
        f.respawnAt(this.time.now);
      });
  }

  private startSuddenDeath() {
    this.suddenDeath = true;
    for (const f of this.fighters) {
      f.score.lives = 1;
      f.score.damage = MATCH.suddenDeathDamage;
      f.score.koPending = false;
      f.respawnAt(this.time.now);
    }
    this.flashBanner('SUDDEN DEATH');
  }

  private finish(winner: 0 | 1 | null, reason: 'stocks' | 'time') {
    if (this.ended) return;
    this.ended = true;
    this.physics.world.pause();
    const result: MatchResult = {
      winner,
      reason,
      timeMs: Math.round(this.elapsedMs),
      fighters: this.fighters.map((f, i) => ({
        name: this.cfg.fighters[i]!.name,
        kos: f.score.kos,
        damageDealt: Math.round(f.score.damageDealt),
        livesLeft: f.score.lives,
      })),
    };
    if (this.instant) {
      this.cfg.onEnd(result);
      return;
    }
    const humanWon = winner !== null && this.cfg.drivers[winner] === 'human';
    if (humanWon) sfx.victory();
    else sfx.defeat();
    this.hud.banner.setText('GAME!').setAlpha(1).setScale(1.6);
    this.tweens.add({ targets: this.hud.banner, scale: 1, duration: 300, ease: 'Back.Out' });
    this.time.delayedCall(1300, () => this.cfg.onEnd(result));
  }

  // ---------- visuals ----------

  /** Draws static vector art once and replaces it with a single baked image (cheap per frame). */
  private bake(key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void) {
    if (!this.textures.exists(key)) {
      const g = this.make.graphics({}, false);
      draw(g);
      g.generateTexture(key, w, h);
      g.destroy();
    }
    return this.add.image(0, 0, key).setOrigin(0, 0);
  }

  private drawBackground() {
    // Headless sims have no renderer to bake textures with; there is nothing to see anyway.
    if (!this.game.renderer) return;
    this.bake('arena-bg', STAGE.width, STAGE.height, (g) => this.paintBackground(g)).setDepth(DEPTH.bg);
    const scanImg = this.bake('arena-scan', STAGE.width, STAGE.height + 12, (g) => {
      g.fillStyle(0xffffff, 1);
      for (let y = 0; y < STAGE.height + 12; y += 6) g.fillRect(0, y, STAGE.width, 2);
    });
    scanImg.setDepth(DEPTH.hud - 1).setAlpha(0.06).setY(-6);
    this.scanImg = scanImg;
  }

  private paintBackground(g: Phaser.GameObjects.Graphics) {
    g.fillGradientStyle(0x1a1530, 0x1a1530, 0x07060b, 0x07060b, 1);
    g.fillRect(0, 0, STAGE.width, STAGE.height);
    g.lineStyle(1, 0x2e2a3d, 0.5);
    for (let x = 0; x <= STAGE.width; x += 64) g.lineBetween(x, 0, x, STAGE.height);
    for (let y = 0; y <= STAGE.height; y += 64) g.lineBetween(0, y, STAGE.width, y);
    for (const [x, h] of [[90, 260], [1190, 300], [150, 180], [1120, 200]] as const) {
      g.fillStyle(0x0f2a2a, 0.6).fillRoundedRect(x - 34, STAGE.height - h - 40, 68, h, 18);
      g.lineStyle(2, 0x2e6a6a, 0.6).strokeRoundedRect(x - 34, STAGE.height - h - 40, 68, h, 18);
    }
  }

  private buildStage() {
    this.platforms = this.physics.add.staticGroup();
    this.floats = this.physics.add.staticGroup();
    const mainW = STAGE.mainRight - STAGE.mainLeft;
    const slippery = this.cfg.modifiers?.includes('SLIPPERY_FLOOR');
    const main = this.add.rectangle(STAGE.mainLeft + mainW / 2, STAGE.mainY + 40, mainW, 80, slippery ? 0x1d3a4a : 0x221d30).setDepth(DEPTH.platform);
    this.platforms.add(main);
    const g = this.add.graphics().setDepth(DEPTH.platform + 1);
    g.fillStyle(slippery ? 0x7fd4ff : 0xffd400, 1);
    for (let x = STAGE.mainLeft; x < STAGE.mainRight; x += 32) g.fillRect(x, STAGE.mainY, 16, 6);
    g.fillStyle(0x15121f, 1).fillRect(STAGE.mainLeft + 20, STAGE.mainY + 80, mainW - 40, 30);
    for (const [x, y, w] of STAGE.floats) {
      const r = this.add.rectangle(x + w / 2, y + 7, w, 14, 0x3a3346).setDepth(DEPTH.platform);
      this.floats.add(r);
      g.fillStyle(0x4ff0ff, 0.8).fillRect(x, y, w, 3);
    }
  }

  private buildHud() {
    const font = { fontFamily: 'Bungee, Impact, sans-serif' };
    const mono = { fontFamily: '"JetBrains Mono", monospace' };
    const timer = this.add.text(STAGE.width / 2, 34, '2:00', { ...font, fontSize: '36px', color: '#f1eef7', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5).setDepth(DEPTH.hud);
    const panels = this.cfg.fighters.map((f, i) => {
      const x = i === 0 ? 300 : STAGE.width - 300;
      const bg = this.add.graphics().setDepth(DEPTH.hud);
      bg.fillStyle(0x000000, 0.55).fillRect(x - 150, 640, 300, 70);
      bg.fillStyle(f.color, 1).fillRect(x - 150, 640, 6, 70);
      this.add.text(x - 136, 646, f.name.toUpperCase(), { ...mono, fontSize: '14px', color: '#a59fb8' }).setDepth(DEPTH.hud);
      const dmg = this.add.text(x + 136, 676, '0%', { ...font, fontSize: '40px', color: '#ffffff', stroke: '#000', strokeThickness: 6 }).setOrigin(1, 0.5).setDepth(DEPTH.hud);
      const pips = this.add.graphics().setDepth(DEPTH.hud);
      const who = this.cfg.drivers[i] === 'bot' ? `BOT · ${this.cfg.difficulty.toUpperCase()}` : i === 0 ? 'P1' : 'P2';
      this.add.text(x - 136, 690, who, { ...mono, fontSize: '11px', color: '#a59fb8' }).setDepth(DEPTH.hud);
      return { dmg, pips, x };
    });
    const mods = this.cfg.modifiers ?? [];
    const modText = mods.length ? mods.map((m) => `⚠ ${MODIFIER_INFO[m]?.label ?? m}`).join('   ') : 'STABLE… FOR NOW';
    this.add.text(STAGE.width / 2, 70, modText, { ...mono, fontSize: '14px', color: mods.length ? '#ffd400' : '#a59fb8', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setDepth(DEPTH.hud);
    const banner = this.add.text(STAGE.width / 2, STAGE.height / 2 - 60, '', { ...font, fontSize: '96px', color: '#ffd400', stroke: '#000', strokeThickness: 10 }).setOrigin(0.5).setDepth(DEPTH.hud).setAlpha(0);
    this.hud = { timer, panels, banner };
    this.updateHud();
  }

  private updateHud() {
    const left = Math.max(0, MATCH.durationMs - this.elapsedMs);
    this.hud.timer.setText(this.suddenDeath ? 'SUDDEN DEATH' : `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}`);
    this.hud.timer.setColor(left < 10_000 && !this.suddenDeath ? '#ff4f4f' : '#f1eef7');
    this.fighters?.forEach((f, i) => {
      const p = this.hud.panels[i]!;
      const d = Math.round(f.score.damage);
      p.dmg.setText(`${d}%`);
      const t = Math.min(1, d / 150);
      const col = Phaser.Display.Color.Interpolate.ColorWithColor(new Phaser.Display.Color(255, 255, 255), new Phaser.Display.Color(255, 60, 60), 100, t * 100);
      p.dmg.setColor(Phaser.Display.Color.RGBToString(col.r, col.g, col.b));
      p.pips.clear();
      const x0 = (i === 0 ? 300 : STAGE.width - 300) - 136;
      for (let l = 0; l < MATCH.lives; l++) {
        p.pips.fillStyle(l < f.score.lives ? this.cfg.fighters[i]!.color : 0x333333, 1).fillCircle(x0 + 6 + l * 18 + 80, 696, 6);
      }
    });
  }

  private flashBanner(text: string) {
    this.hud.banner.setText(text).setAlpha(1).setScale(1.3);
    this.tweens.add({ targets: this.hud.banner, scale: 1, duration: 200 });
    this.tweens.add({ targets: this.hud.banner, alpha: 0, delay: 1000, duration: 300 });
  }

  private burst(x: number, y: number, n: number, color: number) {
    if (this.instant) return;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const d = 40 + Math.random() * 50;
      const p = this.add.circle(x, y, 3 + Math.random() * 4, color).setDepth(DEPTH.fxTop);
      this.tweens.add({ targets: p, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, alpha: 0, duration: 260 + Math.random() * 160, ease: 'Quad.Out', onComplete: () => p.destroy() });
    }
  }

  private damageNumber(x: number, y: number, dmg: number, big: boolean) {
    if (this.instant) return;
    const t = this.add.text(x, y, `${dmg}`, { fontFamily: 'Bungee, Impact, sans-serif', fontSize: big ? '34px' : '24px', color: big ? '#ffd400' : '#ffffff', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5).setDepth(DEPTH.fxTop);
    this.tweens.add({ targets: t, y: y - 50, alpha: 0, duration: 650, ease: 'Quad.Out', onComplete: () => t.destroy() });
  }

  private shake(ms: number, intensity: number) {
    if (this.instant) return;
    this.cameras.main.shake(ms, this.cfg.reducedMotion ? intensity * 0.25 : intensity);
  }

  private wireFx() {
    this.events.on('fx:swing', () => !this.instant && sfx.whoosh());
    this.events.on('fx:dash', (f: Fighter) => {
      if (this.instant) return;
      sfx.whoosh();
      this.burst(f.x - f.facing * 30, f.y + 30, 6, 0xa59fb8);
    });
    this.events.on('fx:recovery', (f: Fighter) => {
      if (this.instant) return;
      sfx.jump();
      this.burst(f.x, f.y + 40, 8, 0x4ff0ff);
    });
  }

  // ---------- test hooks (only with ?test=1) ----------
  private exposeTestHooks() {
    (window as unknown as { __arena: unknown }).__arena = {
      forceKO: (i: 0 | 1) => {
        const f = this.fighters[i];
        f.body.reset(STAGE.blast.right + 50, 300);
      },
      launch: (i: 0 | 1, x: number, y: number, vx: number, vy: number) => {
        const f = this.fighters[i];
        f.state = 'free';
        f.action = null;
        f.jumpsUsed = 1;
        f.recoveryUsed = false;
        f.airDashUsed = false;
        f.body.reset(x, y);
        f.body.setVelocity(vx, vy);
      },
      idle: (i: 0 | 1, x = 640) => {
        this.sources[i] = { read: () => EMPTY_CONTROLS };
        this.fighters[i].body.reset(x, STAGE.mainY - 60);
      },
      press: (i: 0 | 1, key: 'special' | 'close' | 'punch' | 'dash') => {
        // One-frame press: restores the real source only after the press has been read.
        const src = this.sources[i];
        this.sources[i] = {
          read: () => {
            this.sources[i] = src;
            return { ...EMPTY_CONTROLS, [key]: true };
          },
        };
      },
      state: () => ({
        live: this.live,
        ended: this.ended,
        modifiers: this.cfg.modifiers ?? [],
        mods: this.mods,
        entities: { projectiles: this.projectiles.length, zones: this.zones.map((z) => z.o.kind), frogs: this.frogs.length },
        fighters: this.fighters.map((f) => ({
          x: f.x,
          y: f.y,
          lives: f.score.lives,
          damage: f.score.damage,
          state: f.state,
          kit: { special: f.kit.special, close: f.kit.close, head: f.kit.head, physics: f.kit.physics, affinity: f.kit.affinity, trinket: f.kit.trinket, element: f.kit.element, recipe: f.kit.recipe ?? null, weight: f.weight },
          rage: f.rageUntil > this.time.now,
          bubble: f.bubbleUntil > this.time.now,
          size: f.sizeMode,
        })),
      }),
      setKit: (i: 0 | 1, patch: Partial<FighterKit>) => {
        const f = this.fighters[i];
        f.kit = { ...f.kit, ...patch, profile: { ...f.kit.profile, ...(patch.profile ?? {}) } };
        f.specialReadyAt = 0;
        f.closeReadyAt = 0;
      },
      scene: this,
      fps: () => this.game.loop.actualFps,
      tuning: TUNING,
    };
  }
}
