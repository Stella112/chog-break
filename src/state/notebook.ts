// §D8 Lab Notebook. Every storage access is guarded; the app works with storage blocked.
export type NotebookEntry = {
  pairKey: string;
  lo: number;
  hi: number;
  name: string;
  recipeId?: string;
  unstable: boolean;
  discoveredAt: string;
  wins: number;
  losses: number;
  recordedTx?: string;
};

const KEY = 'chogbreak.notebook.v1';
let memory: Record<string, NotebookEntry> = {};

export function readNotebook(): Record<string, NotebookEntry> {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object') memory = parsed as Record<string, NotebookEntry>;
    }
  } catch {
    // storage blocked or corrupted → keep the in-memory copy
  }
  return memory;
}

function write(nb: Record<string, NotebookEntry>) {
  memory = nb;
  try {
    localStorage.setItem(KEY, JSON.stringify(nb));
  } catch {
    // storage blocked → in-memory only for this session
  }
}

/** Adds the mutant if new. Keyed by pairKey, so reversed pairs never duplicate. Returns true if new. */
export function recordDiscovery(
  e: Omit<NotebookEntry, 'wins' | 'losses' | 'discoveredAt'>,
  now: Date = new Date(),
): boolean {
  const nb = { ...readNotebook() };
  if (nb[e.pairKey]) return false;
  nb[e.pairKey] = { ...e, discoveredAt: now.toISOString(), wins: 0, losses: 0 };
  write(nb);
  return true;
}

export function recordResult(pairKey: string, won: boolean) {
  const nb = { ...readNotebook() };
  const entry = nb[pairKey];
  if (!entry) return;
  nb[pairKey] = { ...entry, wins: entry.wins + (won ? 1 : 0), losses: entry.losses + (won ? 0 : 1) };
  write(nb);
}

/** Recorded Splice: remember the transaction that recorded this pair on-chain. */
export function setRecordedTx(pairKey: string, tx: string) {
  const nb = { ...readNotebook() };
  const entry = nb[pairKey];
  if (!entry) return;
  nb[pairKey] = { ...entry, recordedTx: tx };
  write(nb);
}

export function _resetNotebookMemory() {
  memory = {};
}
