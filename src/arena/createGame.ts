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
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 1900 }, debug: false } },
    fps: { target: 60 },
    banner: false,
    audio: { noAudio: true },
    scene: [],
  });
  game.scene.add('arena', ArenaScene, true, cfg);
  return game;
}
