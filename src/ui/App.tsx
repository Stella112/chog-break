import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PairError, makePair } from '../core/pair';
import { createMutant, type Mutant } from '../core/splice';
import { dailyOpponentPair, utcDateString } from '../core/daily';
import { createArenaRules, type ModifierId } from '../core/arenaRules';
import { buildKit } from '../arena/kit';
import { SECRET_PAIRS } from '../config/game';
import { loadManifest, type Manifest } from '../data/manifest';
import { isMuted, setMuted, sfx } from '../audio/sfx';
import { readNotebook, recordDiscovery, recordResult } from '../state/notebook';
import { needsJar, renderMutant } from '../art/mutantRenderer';
import type { Difficulty } from '../arena/bot';
import type { MatchResult } from '../arena/ArenaScene';
import { Lab } from './Lab';
import { Notebook } from './Notebook';
import { PreMatch } from './PreMatch';
import { Results } from './Results';
import { Reveal } from './Reveal';
import { ErrorBoundary } from './ErrorBoundary';

// Phaser is only needed in the arena: load it lazily so the Lab is interactive fast (§D13).
const loadArena = () => import('./Arena');
const Arena = lazy(() => loadArena().then((m) => ({ default: m.Arena })));

type Screen = 'home' | 'lab' | 'reveal' | 'notebook' | 'prematch' | 'arena' | 'results';

const TEST_MODE =
  typeof location !== 'undefined' && new URLSearchParams(location.search).get('test') === '1';
const IS_TOUCH = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

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
  const q = new URLSearchParams(params ?? {});
  if (TEST_MODE) {
    q.set('test', '1');
    const mods = new URLSearchParams(location.search).get('mods');
    if (mods !== null) q.set('mods', mods);
  }
  const s = q.toString();
  history.replaceState(null, '', s ? `/?${s}` : '/');
}

async function fighterCanvas(m: Mutant, sprites: Manifest['sprites']): Promise<HTMLCanvasElement> {
  const c = document.createElement('canvas');
  await renderMutant(c, m.visualRecipe, 256, needsJar(sprites, m.visualRecipe));
  return c;
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
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [mode, setMode] = useState<'bot' | '2p'>('bot');
  const [canvases, setCanvases] = useState<[HTMLCanvasElement, HTMLCanvasElement] | null>(null);
  const [matchKey, setMatchKey] = useState(0);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [starting, setStarting] = useState(false);
  const reducedMotion = useReducedMotion();
  const deepLinkHandled = useRef(false);

  const load = useCallback(() => {
    setLoadError(null);
    loadManifest().then(setManifest, () =>
      setLoadError('The Chog archive failed to load. Check your connection and retry.'),
    );
  }, []);
  useEffect(load, [load]);

  // Test mode only: headless balance simulator for e2e (§F Phase 4 balance smoke test).
  useEffect(() => {
    if (!TEST_MODE || !manifest) return;
    void import('../arena/sim').then(({ runBalanceSim, runHeadlessMatch }) => {
      (window as unknown as { __sim: unknown }).__sim = {
        run: (n: number, seed: number) => runBalanceSim(manifest.chogs, n, seed),
        match: runHeadlessMatch,
      };
    });
  }, [manifest]);

  // §D7 default opponent: a mutant from a pair seeded by the UTC date (same for everyone today).
  const opponent = useMemo(() => {
    if (!manifest) return null;
    const ids = manifest.chogs.map((c) => c.tokenId);
    const [x, y0] = dailyOpponentPair(utcDateString(new Date()), ids);
    let y = y0;
    if (mutant && Math.min(x, y) === mutant.lo && Math.max(x, y) === mutant.hi)
      y = ids[(ids.indexOf(y) + 1) % ids.length]!;
    return createMutant({ parentA: manifest.byId.get(x)!, parentB: manifest.byId.get(y)! });
  }, [manifest, mutant]);

  // §D7: the arena mutates too — modifiers from all four parents' Backgrounds + tier/Unstable rule.
  const arenaRules = useMemo(() => {
    if (!mutant || !opponent) return null;
    // Test-only override (?test=1&mods=LOW_GRAVITY,TOXIC_FLOOR) so e2e can exercise each modifier.
    const forced = TEST_MODE ? new URLSearchParams(location.search).get('mods') : null;
    if (forced !== null) {
      const modifiers = forced.split(',').filter(Boolean) as ModifierId[];
      return { modifiers, stable: modifiers.length === 0 };
    }
    return createArenaRules({ mutants: [mutant, opponent] });
  }, [mutant, opponent]);

  const splice = useCallback((m: Manifest, x: number, y: number, toFight = false) => {
    try {
      makePair(x, y);
      const pa = m.byId.get(x);
      const pb = m.byId.get(y);
      if (!pa || !pb)
        throw new PairError(`No Chog with token ID ${!pa ? x : y}. Pick one from the collection.`);
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
      setScreen(toFight ? 'prematch' : 'reveal');
      setUrl({ a: String(mt.lo), b: String(mt.hi), ...(toFight ? { fight: '1' } : {}) });
    } catch (e) {
      setLabError(
        e instanceof PairError ? e.message : 'That experiment failed to start. Try another pair.',
      );
      setScreen('lab');
    }
  }, []);

  // Deep links: /?a=1053&b=88 (token IDs), &fight=1 → pre-match. Invalid → friendly error, Lab still works.
  useEffect(() => {
    if (!manifest || deepLinkHandled.current) return;
    deepLinkHandled.current = true;
    const p = new URLSearchParams(location.search);
    if (p.get('view') === 'notebook') {
      setScreen('notebook');
      return;
    }
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
    splice(manifest, x, y, p.get('fight') === '1');
  }, [manifest, splice]);

  const secretMutation = () => {
    if (!manifest || SECRET_PAIRS.length === 0) return;
    const p = SECRET_PAIRS[Math.floor(Math.random() * SECRET_PAIRS.length)]!;
    splice(manifest, p.a, p.b);
  };

  const notebookCount = useMemo(() => Object.keys(readNotebook()).length, [screen]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (s: Screen) => {
    sfx.click();
    if (s === 'home' || s === 'lab') setUrl(null);
    if (s === 'notebook') setUrl({ view: 'notebook' });
    if (screen === 'reveal') setRevealsSeen((n) => n + 1);
    setScreen(s);
  };

  useEffect(() => {
    if (screen === 'prematch' || screen === 'reveal') void loadArena();
  }, [screen]);

  const startFight = async () => {
    if (!mutant || !opponent || !manifest || starting) return;
    setStarting(true);
    sfx.click();
    try {
      setCanvases(
        await Promise.all([
          fighterCanvas(mutant, manifest.sprites),
          fighterCanvas(opponent, manifest.sprites),
        ]),
      );
      setResult(null);
      setMatchKey((k) => k + 1);
      setScreen('arena');
    } finally {
      setStarting(false);
    }
  };

  const onMatchEnd = (r: MatchResult) => {
    // The notebook W–L tracks your mutant against the lab bot only.
    if (mutant && mode === 'bot') recordResult(mutant.pairKey, r.winner === 0);
    setResult(r);
    setScreen('results');
  };

  const changeParent = (slot: 'A' | 'B') => {
    if (!mutant) return;
    setA(slot === 'B' ? mutant.lo : null);
    setB(slot === 'A' ? mutant.hi : null);
    go('lab');
  };

  const newExperiment = () => {
    setA(null);
    setB(null);
    go('lab');
  };

  const label = (id: number) => `#${manifest?.byId.get(id)?.displayNumber ?? id}`;

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
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
            aria-label="Mute sound"
            onClick={() => {
              setMuted(!muted);
              setMutedState(!muted);
            }}
          >
            {muted ? 'SOUND OFF' : 'SOUND ON'}
          </button>
        </nav>
      </header>

      <main id="main">
        <ErrorBoundary key={screen} onReset={() => setScreen('lab')}>
          <div className="screen">
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
                <p className="subline">
                  Pick two Chogs. Splice them. See what goes wrong. Then fight it.
                </p>
                <div className="home-actions">
                  <button
                    className="btn btn-primary"
                    disabled={!manifest}
                    onClick={() => go('lab')}
                  >
                    ENTER THE LAB
                  </button>
                  {SECRET_PAIRS.length > 0 && (
                    <button className="btn btn-ghost" disabled={!manifest} onClick={secretMutation}>
                      TRY A SECRET MUTATION
                    </button>
                  )}
                </div>
                <p className="mono dim small">
                  {manifest
                    ? '1,969 real Chogs. 1,937,496 possible pairings.'
                    : loadError
                      ? ''
                      : 'LOADING SPECIMENS…'}
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
                onChange={changeParent}
                onNew={newExperiment}
                onNotebook={() => go('notebook')}
                onFight={() => {
                  go('prematch');
                  setUrl({ a: String(mutant.lo), b: String(mutant.hi), fight: '1' });
                }}
              />
            )}

            {manifest && screen === 'prematch' && mutant && opponent && (
              <PreMatch
                player={mutant}
                opponent={opponent}
                modifiers={arenaRules?.modifiers ?? []}
                difficulty={difficulty}
                mode={mode}
                onMode={setMode}
                onDifficulty={setDifficulty}
                onFight={startFight}
                onBack={() => go('reveal')}
                touch={IS_TOUCH}
                sprites={manifest.sprites}
              />
            )}

            {screen === 'arena' && mutant && opponent && canvases && (
              <Suspense fallback={<p className="empty">POWERING UP THE ARENA…</p>}>
                <Arena
                  matchKey={matchKey}
                  fighters={[
                    {
                      name: mutant.name,
                      canvas: canvases[0],
                      color: 0x4ff0ff,
                      kit: buildKit(mutant),
                    },
                    {
                      name: opponent.name,
                      canvas: canvases[1],
                      color: 0xff4fd8,
                      kit: buildKit(opponent),
                    },
                  ]}
                  modifiers={arenaRules?.modifiers ?? []}
                  drivers={mode === 'bot' ? ['human', 'bot'] : ['human', 'human']}
                  difficulty={difficulty}
                  reducedMotion={reducedMotion}
                  testMode={TEST_MODE}
                  onEnd={onMatchEnd}
                  onQuit={() => go('prematch')}
                  twoPlayer={mode === '2p'}
                />
              </Suspense>
            )}

            {manifest && screen === 'results' && result && mutant && (
              <Results
                result={result}
                onRematch={() => {
                  setResult(null);
                  setMatchKey((k) => k + 1);
                  setScreen('arena');
                }}
                onChange={changeParent}
                onNew={newExperiment}
                twoPlayer={mode === '2p'}
                mutant={mutant}
                manifest={manifest}
                loLabel={label(mutant.lo)}
                hiLabel={label(mutant.hi)}
              />
            )}

            {manifest && screen === 'notebook' && (
              <Notebook manifest={manifest} onOpen={(lo, hi) => splice(manifest, lo, hi)} />
            )}
          </div>
        </ErrorBoundary>
      </main>
    </div>
  );
}
