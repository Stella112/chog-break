import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PairError, makePair } from '../core/pair';
import { createMutant, type Mutant } from '../core/splice';
import { SECRET_PAIRS } from '../config/game';
import { loadManifest, type Manifest } from '../data/manifest';
import { isMuted, setMuted, sfx } from '../audio/sfx';
import { readNotebook, recordDiscovery } from '../state/notebook';
import { Lab } from './Lab';
import { Notebook } from './Notebook';
import { Reveal } from './Reveal';

type Screen = 'home' | 'lab' | 'reveal' | 'notebook';

function useReducedMotion() {
  const q = '(prefers-reduced-motion: reduce)';
  const [r, setR] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(q).matches);
  useEffect(() => {
    const m = matchMedia(q);
    const on = () => setR(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return r;
}

function setUrl(params: Record<string, string> | null) {
  const url = params ? `/?${new URLSearchParams(params)}` : '/';
  history.replaceState(null, '', url);
}

export function App() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>('home');
  const [a, setA] = useState<number | null>(null);
  const [b, setB] = useState<number | null>(null);
  const [mutant, setMutant] = useState<Mutant | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [labError, setLabError] = useState<string | null>(null);
  const [muted, setMutedState] = useState(isMuted());
  const [revealsSeen, setRevealsSeen] = useState(0);
  const reducedMotion = useReducedMotion();
  const deepLinkHandled = useRef(false);

  const load = useCallback(() => {
    setLoadError(null);
    loadManifest().then(setManifest, () =>
      setLoadError('The Chog archive failed to load. Check your connection and retry.'),
    );
  }, []);
  useEffect(load, [load]);

  const splice = useCallback(
    (m: Manifest, x: number, y: number) => {
      try {
        makePair(x, y);
        const pa = m.byId.get(x);
        const pb = m.byId.get(y);
        if (!pa || !pb) throw new PairError(`No Chog with token ID ${!pa ? x : y}. Pick one from the collection.`);
        const mt = createMutant({ parentA: pa, parentB: pb });
        setIsNew(
          recordDiscovery({
            pairKey: mt.pairKey,
            lo: mt.lo,
            hi: mt.hi,
            name: mt.name,
            recipeId: mt.recipe?.id,
            unstable: mt.unstable,
          }),
        );
        setA(x);
        setB(y);
        setMutant(mt);
        setLabError(null);
        setScreen('reveal');
        setUrl({ a: String(mt.lo), b: String(mt.hi) });
      } catch (e) {
        setLabError(e instanceof PairError ? e.message : 'That experiment failed to start. Try another pair.');
        setScreen('lab');
      }
    },
    [],
  );

  // Deep links: /?a=1053&b=88 (token IDs). Invalid → friendly error, Lab still works.
  useEffect(() => {
    if (!manifest || deepLinkHandled.current) return;
    deepLinkHandled.current = true;
    const p = new URLSearchParams(location.search);
    const qa = p.get('a');
    const qb = p.get('b');
    if (qa === null && qb === null) return;
    const x = Number(qa);
    const y = Number(qb);
    if (!Number.isInteger(x) || !Number.isInteger(y)) {
      setLabError('That experiment link is broken. Pick two Chogs instead.');
      setScreen('lab');
      return;
    }
    splice(manifest, x, y);
  }, [manifest, splice]);

  const secretMutation = () => {
    if (!manifest || SECRET_PAIRS.length === 0) return;
    const p = SECRET_PAIRS[Math.floor(Math.random() * SECRET_PAIRS.length)]!;
    splice(manifest, p.a, p.b);
  };

  const notebookCount = useMemo(() => Object.keys(readNotebook()).length, [screen]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (s: Screen) => {
    sfx.click();
    if (s === 'home' || s === 'notebook') setUrl(null);
    if (screen === 'reveal') setRevealsSeen((n) => n + 1);
    setScreen(s);
  };

  return (
    <div className="app">
      <header className="topbar">
        <button className="wordmark" onClick={() => go('home')} aria-label="CHOG//BREAK home">
          CHOG<span>//</span>BREAK
        </button>
        <nav>
          {screen !== 'home' && (
            <button className="btn btn-ghost small" onClick={() => go('lab')}>
              LAB
            </button>
          )}
          <button className="btn btn-ghost small" onClick={() => go('notebook')}>
            NOTEBOOK{notebookCount ? ` (${notebookCount})` : ''}
          </button>
          <button
            className="btn btn-ghost small"
            aria-pressed={muted}
            onClick={() => {
              setMuted(!muted);
              setMutedState(!muted);
            }}
          >
            {muted ? 'SOUND OFF' : 'SOUND ON'}
          </button>
        </nav>
      </header>

      <main>
        {loadError && (
          <div className="panel error-panel" role="alert">
            <p>{loadError}</p>
            <button className="btn" onClick={load}>
              RETRY
            </button>
          </div>
        )}

        {screen === 'home' && (
          <section className="home">
            <div className="hazard" aria-hidden />
            <h1 className="hero">
              CHOG<span>//</span>BREAK
            </h1>
            <p className="subline">Pick two Chogs. Splice them. See what goes wrong. Then fight it.</p>
            <div className="home-actions">
              <button className="btn btn-primary" disabled={!manifest} onClick={() => go('lab')}>
                ENTER THE LAB
              </button>
              {SECRET_PAIRS.length > 0 && (
                <button className="btn btn-ghost" disabled={!manifest} onClick={secretMutation}>
                  TRY A SECRET MUTATION
                </button>
              )}
            </div>
            <p className="mono dim small">
              {manifest ? '1,969 real Chogs. 1,937,496 possible pairings.' : loadError ? '' : 'LOADING SPECIMENS…'}
            </p>
          </section>
        )}

        {manifest && screen === 'lab' && (
          <Lab
            manifest={manifest}
            a={a}
            b={b}
            error={labError}
            onLoad={(slot, id) => {
              setLabError(null);
              if (slot === 'A') setA(id);
              else setB(id);
            }}
            onClear={(slot) => (slot === 'A' ? setA(null) : setB(null))}
            onSplice={() => a !== null && b !== null && splice(manifest, a, b)}
          />
        )}

        {manifest && screen === 'reveal' && mutant && (
          <Reveal
            key={mutant.pairKey}
            mutant={mutant}
            manifest={manifest}
            canSkip={revealsSeen > 0}
            reducedMotion={reducedMotion}
            isNewDiscovery={isNew}
            onChange={(slot) => {
              // keep the other parent; empty the chosen chamber
              const keepA = slot === 'B' ? mutant.lo : null;
              const keepB = slot === 'A' ? mutant.hi : null;
              setA(keepA);
              setB(keepB);
              go('lab');
            }}
            onNew={() => {
              setA(null);
              setB(null);
              go('lab');
            }}
            onNotebook={() => go('notebook')}
          />
        )}

        {manifest && screen === 'notebook' && (
          <Notebook manifest={manifest} onOpen={(lo, hi) => splice(manifest, lo, hi)} />
        )}
      </main>
    </div>
  );
}
