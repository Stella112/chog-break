import { beforeEach, describe, expect, it } from 'vitest';
import { _resetNotebookMemory, readNotebook, recordDiscovery, recordResult } from '../../src/state/notebook';
import { _resetProgressMemory, chogProgress, levelOf, matchXp, recordChogResult } from '../../src/state/progress';
import type { MatchResult } from '../../src/arena/ArenaScene';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  _resetNotebookMemory();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  } as Storage;
});
const entry = { pairKey: '0xabc', lo: 1, hi: 2, name: 'Laser Goblin', unstable: false };

describe('notebook', () => {
  it('records once per pairKey and tracks results', () => {
    expect(recordDiscovery(entry)).toBe(true);
    expect(recordDiscovery(entry)).toBe(false);
    recordResult('0xabc', true);
    recordResult('0xabc', false);
    expect(readNotebook()['0xabc']).toMatchObject({ wins: 1, losses: 1 });
    expect(JSON.parse(store.get('chogbreak.notebook.v1')!)['0xabc'].name).toBe('Laser Goblin');
  });
  it('works with storage blocked', () => {
    globalThis.localStorage = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
    } as unknown as Storage;
    expect(recordDiscovery(entry)).toBe(true);
    expect(readNotebook()['0xabc']?.name).toBe('Laser Goblin');
  });
  it('survives corrupted storage', () => {
    store.set('chogbreak.notebook.v1', '{not json');
    expect(readNotebook()).toEqual({});
  });
});

describe('progression', () => {
  const fight = (winner: 0 | 1 | null, kos: number): MatchResult =>
    ({ winner, reason: 'stocks', timeMs: 60000, fighters: [{ name: 'a', kos, damageDealt: 0, livesLeft: 1 }, { name: 'b', kos: 0, damageDealt: 0, livesLeft: 0 }] });
  beforeEach(() => _resetProgressMemory());

  it('gives more XP for winning and for KOs', () => {
    expect(matchXp(fight(0, 2))).toBe(130);
    expect(matchXp(fight(1, 0))).toBe(30);
    expect(matchXp(fight(null, 1))).toBe(65);
  });
  it('levels at 100, 300, 600 XP', () => {
    expect(levelOf(0).level).toBe(1);
    expect(levelOf(99).level).toBe(1);
    expect(levelOf(100)).toEqual({ level: 2, into: 0, span: 200 });
    expect(levelOf(650).level).toBe(4);
  });
  it('credits both parent Chogs, once each, and the mutant entry', () => {
    recordDiscovery(entry);
    recordResult('0xabc', true, 130);
    recordChogResult([1, 2], 130, true);
    recordChogResult([1, 1], 30, false);
    expect(readNotebook()['0xabc']?.xp).toBe(130);
    expect(chogProgress(1)).toEqual({ xp: 160, wins: 1, losses: 1, fights: 2 });
    expect(chogProgress(2)).toEqual({ xp: 130, wins: 1, losses: 0, fights: 1 });
    expect(chogProgress(3).fights).toBe(0);
  });
});
