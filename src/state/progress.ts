// Progression: XP and wins for every mutant (on its notebook entry) and for every Chog (here).
// A Chog earns from every fight any of its mutants has, so the Chog is the character that levels up.
// Every storage access is guarded; the app works with storage blocked.
import type { MatchResult } from '../arena/ArenaScene';

export type ChogProgress = { xp: number; wins: number; losses: number; fights: number };

/** XP for one lab-bot match, seen from fighter 0: showing up, winning, and every KO count. */
export function matchXp(r: MatchResult): number {
  const kos = r.fighters[0]?.kos ?? 0;
  const base = r.winner === 0 ? 100 : r.winner === null ? 50 : 30;
  return base + 15 * kos;
}

/** Total XP needed to reach `level` (level 1 starts at 0): 100, 300, 600, 1000, … */
export const xpForLevel = (level: number) => 50 * level * (level - 1);

export function levelOf(xp: number): { level: number; into: number; span: number } {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  const floor = xpForLevel(level);
  return { level, into: xp - floor, span: xpForLevel(level + 1) - floor };
}

const KEY = 'chogbreak.progress.v1';
const EMPTY: ChogProgress = { xp: 0, wins: 0, losses: 0, fights: 0 };
let memory: Record<string, ChogProgress> = {};

function readAll(): Record<string, ChogProgress> {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object') memory = parsed as Record<string, ChogProgress>;
    }
  } catch {
    // storage blocked or corrupted → keep the in-memory copy
  }
  return memory;
}

export const chogProgress = (tokenId: number): ChogProgress => readAll()[tokenId] ?? EMPTY;

/** Credits one match to each parent Chog (a pair of the same Chog twice counts once). */
export function recordChogResult(tokenIds: number[], xp: number, winner: boolean | null) {
  const all = { ...readAll() };
  for (const id of new Set(tokenIds)) {
    const p = all[id] ?? EMPTY;
    all[id] = {
      xp: p.xp + xp,
      wins: p.wins + (winner === true ? 1 : 0),
      losses: p.losses + (winner === false ? 1 : 0),
      fights: p.fights + 1,
    };
  }
  memory = all;
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // storage blocked → in-memory only for this session
  }
}

export function _resetProgressMemory() {
  memory = {};
}
