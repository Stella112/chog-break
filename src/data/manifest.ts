// Loads the build-time manifest (same-origin) and builds indexes for the collection browser.
import { NONE, TRAIT_CATEGORIES, type ChogRecord, type TraitCategory } from '../core/types';

export type SpriteInfo = { bgRemoved: boolean };
export type Manifest = {
  chogs: ChogRecord[];
  byId: Map<number, ChogRecord>;
  sprites: Record<string, SpriteInfo>;
  /** Filter options generated from the data, never hard-coded (§D2). */
  filters: { category: TraitCategory; values: { value: string; label: string; count: number }[] }[];
};

const FILTER_CATEGORIES: TraitCategory[] = TRAIT_CATEGORIES.filter((c) => c !== 'Side');

export function buildManifest(
  chogs: ChogRecord[],
  sprites: Record<string, SpriteInfo> = {},
): Manifest {
  const valid = chogs.filter(
    (c) => Number.isInteger(c.tokenId) && c.traits && typeof c.displayName === 'string',
  );
  const filters = FILTER_CATEGORIES.map((category) => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const c of valid) {
      const v = c.traits[category];
      if (v === NONE) continue;
      const raw = c.attributes?.find((a) => a.trait_type === category)?.value;
      const entry = counts.get(v) ?? { label: raw !== undefined ? String(raw) : v, count: 0 };
      entry.count++;
      counts.set(v, entry);
    }
    return {
      category,
      values: [...counts.entries()]
        .map(([value, e]) => ({ value, label: e.label, count: e.count }))
        .sort((a, b) => b.count - a.count),
    };
  });
  return { chogs: valid, byId: new Map(valid.map((c) => [c.tokenId, c])), sprites, filters };
}

export async function loadManifest(): Promise<Manifest> {
  // Both files load in parallel; the slim client manifest omits tokenUri/image (unused in the browser).
  const spritesP = fetch('/data/sprites.json')
    .then((s) => (s.ok ? (s.json() as Promise<Record<string, SpriteInfo>>) : {}))
    .catch(() => ({}) as Record<string, SpriteInfo>); // optional; art falls back per image
  const res = await fetch('/data/chogs.min.json');
  if (!res.ok) throw new Error(`manifest HTTP ${res.status}`);
  const chogs = (await res.json()) as ChogRecord[];
  return buildManifest(chogs, await spritesP);
}

export function searchChogs(
  m: Manifest,
  query: string,
  filters: Partial<Record<TraitCategory, string>>,
): ChogRecord[] {
  const q = query.trim().toLowerCase().replace(/^#/, '');
  const active = Object.entries(filters).filter(([, v]) => v) as [TraitCategory, string][];
  const pool = active.length
    ? m.chogs.filter((c) => active.every(([cat, v]) => c.traits[cat] === v))
    : m.chogs;
  if (!q) return pool;
  // Numbers: exact token ID / #number first, then IDs and numbers that start with what was typed.
  if (/^\d+$/.test(q)) {
    const ids = (c: ChogRecord) => [
      String(c.tokenId),
      c.displayNumber === null ? '' : String(c.displayNumber),
    ];
    const exact = pool.filter((c) => ids(c).includes(q));
    const prefix = pool.filter((c) => !exact.includes(c) && ids(c).some((s) => s.startsWith(q)));
    return [...exact, ...prefix];
  }
  // Text: the name or any trait value ("crown", "laser", "skull"…).
  return pool.filter(
    (c) =>
      c.displayName.toLowerCase().includes(q) ||
      c.attributes.some((a) => String(a.value).toLowerCase().includes(q)),
  );
}

export const spriteUrl = (tokenId: number) => `/chogs/${tokenId}.webp`;
export const thumbUrl = (tokenId: number) => `/chogs/thumbs/${tokenId}.webp`;
