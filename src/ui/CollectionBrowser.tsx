import { useEffect, useMemo, useRef, useState } from 'react';
import { INHERITED_SLOTS } from '../core/splice';
import type { ChogRecord, TraitCategory } from '../core/types';
import { NONE } from '../core/types';
import { GENE_INFO, SLOT_ROLE } from '../config/geneInfo';
import { searchChogs, type Manifest } from '../data/manifest';
import { sfx } from '../audio/sfx';
import { ChogImage } from './ChogImage';
import { geneForSlot } from './traitGenes';

const CELL = 112;
const GAP = 8;

type Props = {
  manifest: Manifest;
  onLoad: (slot: 'A' | 'B', tokenId: number) => void;
  selectedA: number | null;
  selectedB: number | null;
};

export function CollectionBrowser({ manifest, onLoad, selectedA, selectedB }: Props) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Partial<Record<TraitCategory, string>>>({});
  const [filterCat, setFilterCat] = useState<TraitCategory>('Head');
  const [detail, setDetail] = useState<ChogRecord | null>(null);
  const results = useMemo(() => searchChogs(manifest, query, filters), [manifest, query, filters]);

  // Hand-rolled windowed grid (thumbnails only, §D13 performance).
  const scroller = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [scrollTop, setScrollTop] = useState(0);
  const viewH = 520;
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth - 16)); // minus padding
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
    setScrollTop(0);
  }, [query, filters]);
  const cols = Math.max(2, Math.floor((width + GAP) / (CELL + GAP)));
  const rows = Math.ceil(results.length / cols);
  const rowH = CELL + 28 + GAP;
  const first = Math.max(0, Math.floor(scrollTop / rowH) - 2);
  const last = Math.min(rows, Math.ceil((scrollTop + viewH) / rowH) + 2);
  const visible = results.slice(first * cols, last * cols);

  const catValues = manifest.filters.find((f) => f.category === filterCat)?.values ?? [];
  const activeFilters = Object.entries(filters).filter(([, v]) => v) as [TraitCategory, string][];

  const random = () => {
    const pool = results.length ? results : manifest.chogs;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick) {
      sfx.select();
      setDetail(pick);
    }
  };

  return (
    <section className="browser" aria-label="Chog collection">
      <div className="browser-controls">
        <label className="field">
          <span className="label">SEARCH</span>
          <input
            type="search"
            placeholder="Name, #number or token ID"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="label">FILTER BY</span>
          <select value={filterCat} onChange={(e) => setFilterCat(e.target.value as TraitCategory)}>
            {manifest.filters.map((f) => (
              <option key={f.category} value={f.category}>
                {f.category}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">VALUE</span>
          <select
            value={filters[filterCat] ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, [filterCat]: e.target.value || undefined }))}
          >
            <option value="">Any</option>
            {catValues.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label} ({v.count})
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn-ghost" onClick={random}>
          RANDOM
        </button>
      </div>
      <div className="chips" aria-live="polite">
        <span className="mono dim">{results.length} CHOGS</span>
        {activeFilters.map(([cat, v]) => (
          <button
            key={cat}
            className="chip"
            onClick={() => setFilters((f) => ({ ...f, [cat]: undefined }))}
            aria-label={`Remove filter ${cat}`}
          >
            {cat}: {manifest.filters.find((f) => f.category === cat)?.values.find((x) => x.value === v)?.label ?? v} ✕
          </button>
        ))}
      </div>

      <div className="browser-body">
        <div
          className="grid-scroller"
          ref={scroller}
          style={{ height: viewH }}
          onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        >
          {results.length === 0 ? (
            <p className="empty">No Chogs match. Clear a filter.</p>
          ) : (
            <div style={{ height: rows * rowH, position: 'relative' }}>
              {visible.map((c, i) => {
                const idx = first * cols + i;
                const tag = c.tokenId === selectedA ? 'A' : c.tokenId === selectedB ? 'B' : null;
                return (
                  <button
                    key={c.tokenId}
                    className={`cell${detail?.tokenId === c.tokenId ? ' is-active' : ''}${tag ? ' is-picked' : ''}`}
                    style={{
                      position: 'absolute',
                      width: CELL,
                      top: Math.floor(idx / cols) * rowH,
                      left: (idx % cols) * (CELL + GAP),
                    }}
                    onClick={() => {
                      sfx.click();
                      setDetail(c);
                    }}
                  >
                    <ChogImage tokenId={c.tokenId} alt={c.displayName} thumb />
                    <span className="cell-name">{c.displayName}</span>
                    {tag && <span className="cell-tag">{tag}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {detail && (
          <aside className="detail" aria-label={`${detail.displayName} details`}>
            <div className="detail-head">
              <ChogImage tokenId={detail.tokenId} alt={detail.displayName} />
              <div>
                <h3>{detail.displayName}</h3>
                <p className="mono dim">TOKEN ID {detail.tokenId} · {detail.traits.Tier.toUpperCase()}</p>
                <div className="detail-actions">
                  <button className="btn btn-a" onClick={() => onLoad('A', detail.tokenId)}>
                    LOAD INTO A
                  </button>
                  <button className="btn btn-b" onClick={() => onLoad('B', detail.tokenId)}>
                    LOAD INTO B
                  </button>
                </div>
              </div>
            </div>
            <table className="genes">
              <tbody>
                {INHERITED_SLOTS.map((slot) => {
                  const raw = detail.attributes.find((a) => a.trait_type === slot)?.value;
                  const gene = geneForSlot(slot, detail.traits);
                  return (
                    <tr key={slot}>
                      <th>{slot}</th>
                      <td>{detail.traits[slot] === NONE ? <span className="dim">none</span> : String(raw)}</td>
                      <td>
                        <span className="gene">{GENE_INFO[gene]?.label ?? gene}</span>
                        <span className="dim small"> {SLOT_ROLE[slot]}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </aside>
        )}
      </div>
    </section>
  );
}
