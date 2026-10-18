import Phaser from 'phaser';
import type { ModifierId } from '../core/arenaRules';
import { MODIFIER_INFO } from '../config/geneInfo';
import type { ArenaScene } from './ArenaScene';
import { MATCH, STAGE } from './rules';
import { Coach } from './coach';

/** Fixed overlay drawn above the zooming arena camera: timer, damage panels, banners, modifiers. */
export class HudScene extends Phaser.Scene {
  private arena!: ArenaScene;
  private timer!: Phaser.GameObjects.Text;
  private panels: { dmg: Phaser.GameObjects.Text; pips: Phaser.GameObjects.Graphics; shownDmg: number }[] = [];
  private bannerText!: Phaser.GameObjects.Text;
  private modText!: Phaser.GameObjects.Text;
  private coach: Coach | null = null;
  private coachPending = false;

  constructor() {
    super('hud');
  }

  init(data: { arena: ArenaScene }) {
    this.arena = data.arena;
    this.panels = [];
    this.coach = null;
    this.coachPending = !!data.arena.cfg.showControls && data.arena.cfg.drivers[0] === 'human';
  }

  create() {
    const cfg = this.arena.cfg;
    const font = { fontFamily: 'Bungee, Impact, sans-serif' };
    const mono = { fontFamily: '"JetBrains Mono", monospace' };
    this.timer = this.add.text(STAGE.width / 2, 34, '2:00', { ...font, fontSize: '36px', color: '#f1eef7', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5);
    cfg.fighters.forEach((f, i) => {
      const x = i === 0 ? 300 : STAGE.width - 300;
      const bg = this.add.graphics();
      bg.fillStyle(0x000000, 0.6).fillRect(x - 150, 640, 300, 70);
      bg.fillStyle(f.color, 1).fillRect(x - 150, 640, 6, 70);
      this.add.text(x - 136, 646, f.name.toUpperCase(), { ...mono, fontSize: '14px', color: '#a59fb8' });
      const dmg = this.add.text(x + 136, 676, '0%', { ...font, fontSize: '40px', color: '#ffffff', stroke: '#000', strokeThickness: 6 }).setOrigin(1, 0.5);
      const who = cfg.drivers[i] === 'bot' ? `BOT · ${cfg.difficulty.toUpperCase()}` : i === 0 ? 'P1' : 'P2';
      this.add.text(x - 136, 690, who, { ...mono, fontSize: '11px', color: '#a59fb8' });
      this.panels.push({ dmg, pips: this.add.graphics(), shownDmg: 0 });
    });
    this.modText = this.add.text(STAGE.width / 2, 70, '', { ...mono, fontSize: '14px', color: '#ffd400', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5);
    this.setModifiers(cfg.modifiers ?? []);
    this.bannerText = this.add.text(STAGE.width / 2, STAGE.height / 2 - 60, '', { ...font, fontSize: '96px', color: '#ffd400', stroke: '#000', strokeThickness: 10 }).setOrigin(0.5).setAlpha(0);
  }

  setModifiers(mods: ModifierId[]) {
    if (!this.modText) return;
    this.modText.setText(mods.length ? mods.map((m) => `⚠ ${MODIFIER_INFO[m]?.label ?? m}`).join('   ') : 'STABLE… FOR NOW');
    this.modText.setColor(mods.length ? '#ffd400' : '#a59fb8');
  }

  /** Big centre text. `hold` ms before fading; 0 keeps it. */
  banner(text: string, from = 1.3, hold = 1000) {
    if (!this.bannerText) return;
    this.tweens.killTweensOf(this.bannerText);
    this.bannerText.setText(text).setAlpha(1).setScale(from);
    this.tweens.add({ targets: this.bannerText, scale: 1, duration: 220, ease: 'Back.Out' });
    if (hold > 0) this.tweens.add({ targets: this.bannerText, alpha: 0, delay: hold, duration: 300 });
  }

  update() {
    const a = this.arena;
    if (!a.fighters || !this.timer) return;
    // First fight: start coaching once the arena is live (fighters exist).
    if (this.coachPending) {
      this.coachPending = false;
      this.coach = new Coach(this, a.fighters[0], a.fighters[1]);
    }
    this.coach?.update();
    const left = Math.max(0, MATCH.durationMs - a.elapsedMs);
    this.timer.setText(a.suddenDeath ? 'SUDDEN DEATH' : `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}`);
    this.timer.setColor(left < 10_000 && !a.suddenDeath ? '#ff4f4f' : '#f1eef7');
    a.fighters.forEach((f, i) => {
      const p = this.panels[i];
      if (!p) return;
      const d = Math.round(f.score.damage);
      if (d !== p.shownDmg) {
        // punch the number when it goes up
        if (d > p.shownDmg) {
          this.tweens.killTweensOf(p.dmg);
          p.dmg.setScale(1.35);
          this.tweens.add({ targets: p.dmg, scale: 1, duration: 180, ease: 'Back.Out' });
        }
        p.shownDmg = d;
      }
      p.dmg.setText(`${d}%`);
      const t = Math.min(1, d / 150);
      const col = Phaser.Display.Color.Interpolate.ColorWithColor(new Phaser.Display.Color(255, 255, 255), new Phaser.Display.Color(255, 60, 60), 100, t * 100);
      p.dmg.setColor(Phaser.Display.Color.RGBToString(col.r, col.g, col.b));
      p.pips.clear();
      const x0 = (i === 0 ? 300 : STAGE.width - 300) - 136;
      for (let l = 0; l < MATCH.lives; l++) {
        const alive = l < f.score.lives;
        p.pips.fillStyle(alive ? a.cfg.fighters[i]!.color : 0x333333, 1).fillCircle(x0 + 86 + l * 18, 696, 6);
        if (!alive) p.pips.lineStyle(2, 0x888888, 1).lineBetween(x0 + 81 + l * 18, 691, x0 + 91 + l * 18, 701);
      }
    });
  }
}
