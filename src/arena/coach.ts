// First-fight coaching: one prompt at a time, each cleared by actually doing it.
import Phaser from 'phaser';
import { GENE_INFO } from '../config/geneInfo';
import type { Fighter } from './fighter';
import { STAGE } from './rules';

type Step = { key: string; text: string; done: (f: Fighter, foe: Fighter) => boolean };

export class Coach {
  private steps: Step[];
  private i = 0;
  private box: Phaser.GameObjects.Container;
  private keyText: Phaser.GameObjects.Text;
  private bodyText: Phaser.GameObjects.Text;
  private progress: Phaser.GameObjects.Text;
  private startX: number;
  private dealtAtStart = 0;
  private stepShownAt = 0;
  private finished = false;

  constructor(
    private scene: Phaser.Scene,
    private me: Fighter,
    private foe: Fighter,
    touch = false,
  ) {
    this.startX = me.x;
    const special = GENE_INFO[me.kit.special]?.label ?? me.kit.special;
    const close = GENE_INFO[me.kit.close]?.label ?? me.kit.close;
    this.steps = [
      { key: touch ? '◀ ▶' : 'A  D', text: 'Move left and right', done: (f) => Math.abs(f.x - this.startX) > 70 },
      { key: touch ? 'JUMP' : 'W', text: 'Jump. Press again in the air to double jump', done: (f) => f.jumpsUsed >= 2 },
      { key: touch ? 'PUNCH' : 'J', text: 'Punch. Tap three times for a combo', done: (f) => f.comboStep >= 2 },
      { key: touch ? 'SPEC' : 'L', text: `Your special from the Eyes: ${special}`, done: (f) => f.specialReadyAt > 0 },
      { key: touch ? 'CLOSE' : 'I', text: `Your close move from the Mouth: ${close}`, done: (f) => f.closeReadyAt > 0 },
      { key: touch ? 'DASH' : 'K', text: 'Dash. It hits too', done: (f) => f.dashReadyAt > 0 },
      {
        key: '!',
        text: 'Knock them off the screen. More damage % = they fly further',
        done: (f) => f.score.kos > 0 || f.score.damageDealt - this.dealtAtStart > 40,
      },
    ];
    this.box = scene.add.container(STAGE.width / 2, 178);
    const bg = scene.add.rectangle(0, 0, 720, 64, 0x000000, 0.8).setStrokeStyle(3, 0xffd400);
    const cap = scene.add.rectangle(-300, 0, 84, 46, 0xf1eef7).setStrokeStyle(3, 0x0b0a10);
    this.keyText = scene.add.text(-300, 0, '', { fontFamily: 'Bungee, Impact, sans-serif', fontSize: '24px', color: '#0b0a10' }).setOrigin(0.5);
    this.bodyText = scene.add.text(-244, 0, '', { fontFamily: '"JetBrains Mono", monospace', fontSize: '18px', color: '#f1eef7', wordWrap: { width: 560 } }).setOrigin(0, 0.5);
    this.progress = scene.add.text(344, -24, '', { fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', color: '#a59fb8' }).setOrigin(1, 0.5);
    this.box.add([bg, cap, this.keyText, this.bodyText, this.progress]);
    this.show(0);
  }

  private show(i: number) {
    const s = this.steps[i]!;
    this.keyText.setText(s.key).setFontSize(s.key.length > 4 ? 15 : s.key.length > 3 ? 18 : 24);
    this.bodyText.setText(s.text);
    this.progress.setText(`HOW TO PLAY ${i + 1}/${this.steps.length}`);
    this.stepShownAt = this.scene.time.now;
    this.box.setScale(1.08).setAlpha(1);
    this.scene.tweens.add({ targets: this.box, scale: 1, duration: 200, ease: 'Back.Out' });
    if (s.key === '!') this.dealtAtStart = this.me.score.damageDealt;
  }

  update() {
    if (this.finished) return;
    const step = this.steps[this.i]!;
    // Never block play: a step also clears itself after 9 s.
    if (step.done(this.me, this.foe) || this.scene.time.now - this.stepShownAt > 9000) {
      this.i++;
      if (this.i >= this.steps.length) {
        this.finished = true;
        this.bodyText.setText('You got it. Good luck!');
        this.keyText.setText('✓');
        this.scene.tweens.add({ targets: this.box, alpha: 0, delay: 1200, duration: 500, onComplete: () => this.box.destroy() });
        return;
      }
      this.show(this.i);
    }
  }
}
