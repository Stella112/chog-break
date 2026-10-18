import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { BotSource, type Difficulty } from './bot';
import { Fighter, TUNING, type HitEvent } from './fighter';
import { EMPTY_CONTROLS, KEYMAP, KeyboardSource, type ControlSource } from './input';
import { applyKO, isOutside, MATCH, resolveMatch, respawn, STAGE } from './rules';

export type FighterSetup = { name: string; canvas: HTMLCanvasElement; color: number };
export type MatchResult = {
  winner: 0 | 1 | null;
  reason: 'stocks' | 'time';
  timeMs: number;
  fighters: { name: string; kos: number; damageDealt: number; livesLeft: number }[];
};
export type ArenaConfig = {
  fighters: [FighterSetup, FighterSetup];
  difficulty: Difficulty;
  /** 'human' uses P1 keys; 'bot' uses the FSM. Phase 3: P1 human vs bot. */
  drivers: ['human' | 'bot', 'human' | 'bot'];
  reducedMotion: boolean;
  onEnd: (r: MatchResult) => void;
  testMode?: boolean;
  botSeed?: number;
  /** Skip countdown and end-of-match pause (headless sims). */
  instant?: boolean;
};

const DEPTH = { bg: 0, platform: 5, fx: 8, fighter: 10, fxTop: 12, hud: 20 };

export class ArenaScene extends Phaser.Scene {
  cfg!: ArenaConfig;
  fighters!: [Fighter, Fighter];
  sources!: [ControlSource, ControlSource];
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private floats!: Phaser.Physics.Arcade.StaticGroup;
  private hitstopUntil = 0;
  private live = false;
  private ended = false;
  private suddenDeath = false;
  private lastAttacker: [Fighter | null, Fighter | null] = [null, null];
  private hud!: { timer: Phaser.GameObjects.Text; panels: { dmg: Phaser.GameObjects.Text; pips: Phaser.GameObjects.Graphics }[]; banner: Phaser.GameObjects.Text };
  private scanImg!: Phaser.GameObjects.Image;
  private trailAt = 0;
  private elapsedMs = 0;

  constructor() {
    super('arena');
  }

  init(cfg: ArenaConfig) {
    this.cfg = cfg;
    this.hitstopUntil = 0;
    this.live = false;
    this.ended = false;
    this.suddenDeath = false;
    this.elapsedMs = 0;
    this.lastAttacker = [null, null];
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
    this.fighters = [0, 1].map((i) => new Fighter(this, i as 0 | 1, `fighter-${i}`, spawns[i]!, this.cfg.fighters[i]!.color)) as [Fighter, Fighter];
    this.fighters.forEach((f) => f.sprite.setDepth(DEPTH.fighter));

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

    this.registry.set('kbMod', 1);
    this.buildHud();
    this.wireFx();
    if (this.cfg.testMode) this.exposeTestHooks();
    if (this.cfg.instant) this.go();
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
    this.scanImg.y = -6 + ((time / 40) % 6);
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
    for (const f of this.fighters) for (const h of f.pendingHits) this.onHit(h);

    for (const f of this.fighters) {
      if (f.state !== 'ko' && isOutside(f.x, f.y)) this.onBlast(f);
      if (f.state === 'hitstun' && Math.hypot(f.body.velocity.x, f.body.velocity.y) > 650 && time > this.trailAt) {
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

  private onHit(h: HitEvent) {
    const big = h.force > 900;
    this.lastAttacker[h.target.index] = h.attacker;
    this.hitstopUntil = this.time.now + h.attack.hitstopMs + (big ? 30 : 0);
    h.target.sprite.setTintFill(0xffffff);
    this.time.delayedCall(70, () => h.target.sprite.clearTint());
    this.burst(h.target.x, h.target.y, big ? 14 : 8, big ? 0xffd400 : 0xffffff);
    this.damageNumber(h.target.x, h.target.y - 60, h.damage, big);
    if (big) {
      sfx.bigHit();
      this.shake(160, 0.012);
    } else sfx.punch(h.attacker.comboStep);
  }

  private onBlast(f: Fighter) {
    const attacker = this.lastAttacker[f.index];
    if (!applyKO(f.score, attacker ? attacker.score : null)) return;
    sfx.ko();
    this.shake(320, 0.02);
    const x = Phaser.Math.Clamp(f.x, 0, STAGE.width);
    const y = Phaser.Math.Clamp(f.y, 0, STAGE.height);
    const flash = this.add.circle(x, y, 40, f.color, 0.9).setDepth(DEPTH.fxTop);
    this.tweens.add({ targets: flash, scale: 9, alpha: 0, duration: 520, onComplete: () => flash.destroy() });
    this.burst(x, y, 24, f.color);
    f.ko();
    this.lastAttacker[f.index] = null;
    if (f.score.lives > 0)
      this.time.delayedCall(this.cfg.instant ? 0 : 1100, () => {
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
    if (this.cfg.instant) {
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
    // lab tanks in the background
    for (const [x, h] of [[90, 260], [1190, 300], [150, 180], [1120, 200]] as const) {
      g.fillStyle(0x0f2a2a, 0.6).fillRoundedRect(x - 34, STAGE.height - h - 40, 68, h, 18);
      g.lineStyle(2, 0x2e6a6a, 0.6).strokeRoundedRect(x - 34, STAGE.height - h - 40, 68, h, 18);
    }
  }

  private buildStage() {
    this.platforms = this.physics.add.staticGroup();
    this.floats = this.physics.add.staticGroup();
    const mainW = STAGE.mainRight - STAGE.mainLeft;
    const main = this.add.rectangle(STAGE.mainLeft + mainW / 2, STAGE.mainY + 40, mainW, 80, 0x221d30).setDepth(DEPTH.platform);
    this.platforms.add(main);
    const g = this.add.graphics().setDepth(DEPTH.platform + 1);
    g.fillStyle(0xffd400, 1);
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
      this.add.text(x - 136, 690, i === 0 ? 'P1' : this.cfg.drivers[1] === 'bot' ? `BOT · ${this.cfg.difficulty.toUpperCase()}` : 'P2', { ...mono, fontSize: '11px', color: '#a59fb8' }).setDepth(DEPTH.hud);
      return { dmg, pips, x };
    });
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
    if (this.cfg.instant) return;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const d = 40 + Math.random() * 50;
      const p = this.add.circle(x, y, 3 + Math.random() * 4, color).setDepth(DEPTH.fxTop);
      this.tweens.add({ targets: p, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, alpha: 0, duration: 260 + Math.random() * 160, ease: 'Quad.Out', onComplete: () => p.destroy() });
    }
  }

  private damageNumber(x: number, y: number, dmg: number, big: boolean) {
    if (this.cfg.instant) return;
    const t = this.add.text(x, y, `${dmg}`, { fontFamily: 'Bungee, Impact, sans-serif', fontSize: big ? '34px' : '24px', color: big ? '#ffd400' : '#ffffff', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5).setDepth(DEPTH.fxTop);
    this.tweens.add({ targets: t, y: y - 50, alpha: 0, duration: 650, ease: 'Quad.Out', onComplete: () => t.destroy() });
  }

  private shake(ms: number, intensity: number) {
    if (this.cfg.instant) return;
    this.cameras.main.shake(ms, this.cfg.reducedMotion ? intensity * 0.25 : intensity);
  }

  private wireFx() {
    this.events.on('fx:swing', () => sfx.whoosh());
    this.events.on('fx:dash', (f: Fighter) => {
      sfx.whoosh();
      this.burst(f.x - f.facing * 30, f.y + 30, 6, 0xa59fb8);
    });
    this.events.on('fx:recovery', (f: Fighter) => {
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
      state: () => ({
        live: this.live,
        ended: this.ended,
        fighters: this.fighters.map((f) => ({ x: f.x, y: f.y, lives: f.score.lives, damage: f.score.damage, state: f.state })),
      }),
      fps: () => this.game.loop.actualFps,
      tuning: TUNING,
    };
  }
}
