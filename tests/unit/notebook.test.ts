import { beforeEach, describe, expect, it } from 'vitest';
import { _resetNotebookMemory, readNotebook, recordDiscovery, recordResult } from '../../src/state/notebook';

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
