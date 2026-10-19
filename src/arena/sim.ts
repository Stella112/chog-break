// §F Phase 4 balance smoke test: headless bot-vs-bot matches of random real mutants.
// Runs only in test mode (exposed as window.__sim). Steps Phaser manually at a fixed 60 fps.
import Phaser from 'phaser';
import { createArenaRules } from '../core/arenaRules';
import { createMutant } from '../core/splice';
import type { ChogRecord } from '../core/types';
import { drawFallbackSprite } from '../art/fallbackSprite';
import { ArenaScene, type ArenaConfig, type MatchResult } from './ArenaScene';
import type { Difficulty } from './bot';
import { resetProjectileSeed } from './entities';
import { buildKit, type FighterKit } from './kit';
import { STAGE } from './rules';

const STEP = 1000 / 60;
const MAX_STEPS = 60 * 140; // 120 s + sudden death headroom

function lcg(seed: number) {
  let s = seed >>> 0 || 1;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
}

function blankCanvas(tint: string) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  drawFallbackSprite(c.getContext('2d')!, 128, tint);
  return c;
}

/** One headless match. Resolves with the result (or a draw if it never ends). */
export function runHeadlessMatch(
  kits: [FighterKit, FighterKit],
  modifiers: ArenaConfig['modifiers'],
  seed: number,
  difficulty: Difficulty = 'normal',
  difficulties?: [Difficulty, Difficulty],
): Promise<MatchResult & { steps: number }> {
  return new Promise((resolve) => {
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute;left:-9999px;width:10px;height:10px';
    document.body.appendChild(host);
    let result: MatchResult | null = null;
    const cfg: ArenaConfig = {
      fighters: [
        { name: kits[0].name, canvas: blankCanvas('#4ff0ff'), color: 0x4ff0ff, kit: kits[0] },
        { name: kits[1].name, canvas: blankCanvas('#ff4fd8'), color: 0xff4fd8, kit: kits[1] },
      ],
      difficulty,
      difficulties,
      drivers: ['bot', 'bot'],
      reducedMotion: true,
      modifiers,
      instant: true,
      botSeed: seed,
      onEnd: (r) => (result = r),
    };
    const game = new Phaser.Game({
      type: Phaser.HEADLESS,
      parent: host,
      width: STAGE.width,
      height: STAGE.height,
      physics: {
        default: 'arcade',
        arcade: { gravity: { x: 0, y: 1900 }, fps: 60, overlapBias: 20, fixedStep: true },
      },
      banner: false,
      audio: { noAudio: true },
      scene: [],
    });
    game.events.once(Phaser.Core.Events.READY, () => {
      game.loop.stop();
      // The scene clock starts at loop.time (the real browser clock) while we step from 0: zero it, or every
      // timer set during create() would depend on wall-clock time and seeded matches wouldn't repeat.
      game.loop.time = 0;
      game.loop.now = 0;
      resetProjectileSeed(seed);
      game.scene.add('arena', ArenaScene, true, cfg);
      let t = 0;
      let steps = 0;
      while (!result && steps < MAX_STEPS) {
        t += STEP;
        game.headlessStep(t, STEP);
        steps++;
      }
      const r: MatchResult = result ?? {
        winner: null,
        reason: 'time',
        timeMs: steps * STEP,
        fighters: [],
      };
      game.destroy(true);
      host.remove();
      resolve({ ...r, steps });
    });
  });
}

export type GeneRow = { slot: string; gene: string; n: number; wins: number; rate: number };

/** ≥200 seeded matches between random real mutants; per-gene win rates. */
export async function runBalanceSim(
  chogs: ChogRecord[],
  matches = 200,
  seed = 143,
  onProgress?: (i: number) => void,
  difficulty: Difficulty = 'normal',
) {
  const rand = lcg(seed);
  const pick = () => chogs[Math.floor(rand() * chogs.length)]!;
  const tally = new Map<string, GeneRow>();
  let draws = 0;
  let totalMs = 0;
  let kos = 0;
  let timeouts = 0;
  let totalLivesLost = 0;
  const slots = ['special', 'head', 'close', 'physics', 'affinity', 'trinket', 'element'] as const;
  for (let i = 0; i < matches; i++) {
    const pair = () => {
      const a = pick();
      let b = pick();
      while (b.tokenId === a.tokenId) b = pick();
      return createMutant({ parentA: a, parentB: b });
    };
    const m1 = pair();
    const m2 = pair();
    const rules = createArenaRules({ mutants: [m1, m2] });
    const kits: [FighterKit, FighterKit] = [buildKit(m1), buildKit(m2)];
    const r = await runHeadlessMatch(kits, rules.modifiers, seed + i, difficulty);
    totalMs += r.timeMs;
    if (r.winner === null) draws++;
    if (r.reason === 'stocks') kos++;
    else timeouts++;
    totalLivesLost += r.fighters.reduce((n, f) => n + (2 - f.livesLeft), 0);
    kits.forEach((k, side) => {
      for (const slot of slots) {
        const gene = String(k[slot]);
        const key = `${slot}:${gene}`;
        const row = tally.get(key) ?? { slot, gene, n: 0, wins: 0, rate: 0 };
        row.n++;
        if (r.winner === side) row.wins++;
        tally.set(key, row);
      }
      if (k.recipe) {
        const key = `recipe:${k.recipe}`;
        const row = tally.get(key) ?? { slot: 'recipe', gene: k.recipe, n: 0, wins: 0, rate: 0 };
        row.n++;
        if (r.winner === side) row.wins++;
        tally.set(key, row);
      }
    });
    onProgress?.(i + 1);
  }
  const rows = [...tally.values()]
    .map((r) => ({ ...r, rate: r.n ? r.wins / r.n : 0 }))
    .sort((a, b) => b.rate - a.rate);
  return {
    matches,
    draws,
    kos,
    timeouts,
    livesLostPerMatch: totalLivesLost / matches,
    avgMatchMs: Math.round(totalMs / matches),
    rows,
  };
}

/** Difficulty ladder: random real mutants, A's difficulty vs B's, sides swapped every match. */
export async function runLadder(
  chogs: ChogRecord[],
  matches: number,
  a: Difficulty,
  b: Difficulty,
  seed = 7,
) {
  const rand = lcg(seed);
  const pick = () => chogs[Math.floor(rand() * chogs.length)]!;
  const pair = () => {
    const x = pick();
    let y = pick();
    while (y.tokenId === x.tokenId) y = pick();
    return createMutant({ parentA: x, parentB: y });
  };
  let aWins = 0;
  let bWins = 0;
  let livesLost = 0;
  for (let i = 0; i < matches; i++) {
    const m1 = pair();
    const m2 = pair();
    const swap = i % 2 === 1;
    const diffs: [Difficulty, Difficulty] = swap ? [b, a] : [a, b];
    const r = await runHeadlessMatch(
      [buildKit(m1), buildKit(m2)],
      createArenaRules({ mutants: [m1, m2] }).modifiers,
      seed + i,
      'normal',
      diffs,
    );
    livesLost += r.fighters.reduce((n, f) => n + (2 - f.livesLeft), 0);
    if (r.winner === null) continue;
    const aSide = swap ? 1 : 0;
    if (r.winner === aSide) aWins++;
    else bWins++;
  }
  return {
    a,
    b,
    matches,
    aWins,
    bWins,
    aRate: aWins / matches,
    livesLostPerMatch: livesLost / matches,
  };
}
