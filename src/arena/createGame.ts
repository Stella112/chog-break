import Phaser from 'phaser';
import { ArenaScene, type ArenaConfig } from './ArenaScene';
import { STAGE } from './rules';

/** One Phaser instance per fight; React destroys it on unmount (§B). */
export function createArenaGame(parent: HTMLElement, cfg: ArenaConfig): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: STAGE.width,
    height: STAGE.height,
    backgroundColor: '#07060b',
    // 2.5D: the three.js stage shows through a transparent Phaser canvas.
    transparent: !!cfg.view3d,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    // overlapBias 20 (default 4): at low frame rates a resting fighter sank > 4 px per step and fell through the floor.
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 1900 }, debug: false, overlapBias: 20, fixedStep: true } },
    fps: { target: 60 },
    banner: false,
    audio: { noAudio: true },
    scene: [],
  });
  game.scene.add('arena', ArenaScene, true, cfg);
  return game;
}
