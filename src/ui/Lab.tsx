import type { Manifest } from '../data/manifest';
import { sfx } from '../audio/sfx';
import { ChogImage } from './ChogImage';
import { CollectionBrowser } from './CollectionBrowser';

type Props = {
  manifest: Manifest;
  a: number | null;
  b: number | null;
  error: string | null;
  onLoad: (slot: 'A' | 'B', id: number) => void;
  onClear: (slot: 'A' | 'B') => void;
  onSplice: () => void;
};

function Chamber({ slot, id, manifest, onClear }: { slot: 'A' | 'B'; id: number | null; manifest: Manifest; onClear: () => void }) {
  const chog = id !== null ? manifest.byId.get(id) : undefined;
  return (
    <div className={`chamber chamber-${slot.toLowerCase()}${chog ? ' is-loaded' : ''}`}>
      <div className="chamber-tag mono">PARENT {slot}</div>
      <div className="chamber-glass">
        {chog ? <ChogImage tokenId={chog.tokenId} alt={chog.displayName} /> : <span className="mono dim">EMPTY</span>}
      </div>
      <div className="chamber-plate">
        {chog ? (
          <>
            <strong>{chog.displayName}</strong>
            <span className="mono small dim">TOKEN ID {chog.tokenId}</span>
            <button className="link" onClick={onClear} aria-label={`Empty chamber ${slot}`}>
              eject
            </button>
          </>
        ) : (
          <span className="small dim">Pick a Chog below</span>
        )}
      </div>
    </div>
  );
}

export function Lab({ manifest, a, b, error, onLoad, onClear, onSplice }: Props) {
  const ready = a !== null && b !== null && a !== b;
  return (
    <div className="lab">
      <div className="lab-bench">
        <Chamber slot="A" id={a} manifest={manifest} onClear={() => onClear('A')} />
        <div className="splice-col">
          <button
            className="btn-splice"
            disabled={!ready}
            onClick={() => {
              sfx.click();
              onSplice();
            }}
          >
            SPLICE
          </button>
          <span className="mono small">FREE EXPERIMENT</span>
          {a !== null && a === b && <p className="error-text">A Chog can't be spliced with itself.</p>}
          {error && <p className="error-text" role="alert">{error}</p>}
        </div>
        <Chamber slot="B" id={b} manifest={manifest} onClear={() => onClear('B')} />
      </div>
      <CollectionBrowser
        manifest={manifest}
        selectedA={a}
        selectedB={b}
        onLoad={(slot, id) => {
          sfx.select();
          onLoad(slot, id);
        }}
      />
    </div>
  );
}
