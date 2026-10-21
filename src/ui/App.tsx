import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './styles.css';
import './arena.css';
import { PairError, makePair } from '../core/pair';
import { createMutant, type Mutant } from '../core/splice';
import { dailyOpponentPair, utcDateString } from '../core/daily';
import { createArenaRules, type ModifierId } from '../core/arenaRules';
import { buildKit } from '../arena/kit';
import { SECRET_PAIRS } from '../config/game';
import { loadManifest, type Manifest } from '../data/manifest';
import { isMuted, setMuted, sfx } from '../audio/sfx';
import { isMusicMuted, music, setMusicMuted } from '../audio/music';
import { readNotebook, recordDiscovery, recordResult, setRecordedTx } from '../state/notebook';
import { needsJar, renderMutant } from '../art/mutantRenderer';
import { SKIN_TINT } from '../config/geneInfo';
import type { Difficulty } from '../arena/bot';
import type { MatchResult } from '../arena/ArenaScene';
import { Lab } from './Lab';
import { Notebook } from './Notebook';
import { PreMatch } from './PreMatch';
import { Results } from './Results';
import { Reveal } from './Reveal';
import { ErrorBoundary } from './ErrorBoundary';
import { MyChogs } from './MyChogs';
import { useWallet } from '../state/wallet';
import { OwnedContext } from '../state/owned';
import { RecordedSplice } from './RecordedSplice';
import { RecordBanner } from './OnChain';
import { ACTIVE_REGISTRY } from '../chain/active';
import type { RecordResult } from '../chain/registry';
import { shortAddress } from '../chain/client';

// Phaser is only needed in the arena: load it lazily so the Lab is interactive fast (§D13).
const loadArena = () => import('./Arena');
const Arena = lazy(() => loadArena().then((m) => ({ default: m.Arena })));

type Screen = 'home' | 'lab' | 'reveal' | 'notebook' | 'prematch' | 'arena' | 'results' | 'mychogs';

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
  // Keep the 2D-arena fallback switch across in-app navigation.
  if (new URLSearchParams(location.search).get('arena') === '2d') q.set('arena', '2d');
  if (TEST_MODE) {
    q.set('test', '1');
    const mods = new URLSearchParams(location.search).get('mods');
    if (mods !== null) q.set('mods', mods);
  }
  const s = q.toString();
  history.replaceState(null, '', s ? `/play/?${s}` : '/play/');
}

/** Body colour for the arena rig: blend of both parents' skin tints. */
function bodyColorOf(m: Mutant): number {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [a, b] = m.visualRecipe.skins.map((k) => p(SKIN_TINT[k] ?? SKIN_TINT.none!));
  const [r, g, bl] = a!.map((c, i) => Math.round((c + b![i]!) / 2));
  return (r! << 16) | (g! << 8) | bl!;
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
  const [lastRecord, setLastRecord] = useState<(RecordResult & { decimals: number }) | null>(null);
  const [labError, setLabError] = useState<string | null>(null);
  const [muted, setMutedState] = useState(isMuted());
  const [musicOff, setMusicOff] = useState(isMusicMuted());
  const [revealsSeen, setRevealsSeen] = useState(0);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [mode, setMode] = useState<'bot' | '2p'>('bot');
  const [canvases, setCanvases] = useState<[HTMLCanvasElement, HTMLCanvasElement] | null>(null);
  const [matchKey, setMatchKey] = useState(0);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [starting, setStarting] = useState(false);
  const [fightsStarted, setFightsStarted] = useState(0);
  const reducedMotion = useReducedMotion();
  const deepLinkHandled = useRef(false);
  const tokenIds = useMemo(
    () => (manifest ? manifest.chogs.map((c) => c.tokenId) : null),
    [manifest],
  );
  const wallet = useWallet(tokenIds);
  const ownedIds = wallet.owned.status === 'done' ? wallet.owned.ids : null;

  // Background music: driving loop in the arena, mellow lab loop everywhere else.
  useEffect(() => {
    music.setTrack(screen === 'arena' ? 'arena' : 'lab');
  }, [screen]);

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
    void import('../arena/sim').then(({ runBalanceSim, runHeadlessMatch, runLadder }) => {
      (window as unknown as { __sim: unknown }).__sim = {
        run: (n: number, seed: number, difficulty?: 'easy' | 'normal' | 'hard') =>
          runBalanceSim(manifest.chogs, n, seed, undefined, difficulty),
        match: runHeadlessMatch,
        ladder: (n: number, a: 'easy' | 'normal' | 'hard', b: 'easy' | 'normal' | 'hard') =>
          runLadder(manifest.chogs, n, a, b),
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
    setLastRecord(null);
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
    if (p.get('view') === 'lab') {
      setScreen('lab');
      return;
    }
    if (p.get('view') === 'notebook') {
      setScreen('notebook');
      return;
    }
    if (p.get('view') === 'mychogs') {
      setScreen('mychogs');
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
    if (s === 'mychogs') setUrl({ view: 'mychogs' });
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
      setFightsStarted((n) => n + 1);
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
          {wallet.address ? (
            <span className="wallet-chip">
              <button
                className="btn btn-ghost small"
                onClick={() => go('mychogs')}
                aria-label="My Chogs"
              >
                <span className={`wallet-dot${wallet.onMonad ? '' : ' off'}`} />{' '}
                {shortAddress(wallet.address)}
              </button>
              {!wallet.onMonad && wallet.chainId !== null && (
                <button className="btn btn-ghost small" onClick={() => void wallet.switchChain()}>
                  SWITCH TO MONAD
                </button>
              )}
            </span>
          ) : (
            <button
              className="btn btn-ghost small"
              onClick={() => (wallet.available ? void wallet.connect() : go('mychogs'))}
              disabled={wallet.connecting}
            >
              {wallet.connecting ? 'CONNECTING…' : 'CONNECT WALLET'}
            </button>
          )}
          <button className="btn btn-ghost small" onClick={() => go('notebook')}>
            NOTEBOOK{notebookCount ? ` (${notebookCount})` : ''}
          </button>
          <button
            className="btn btn-ghost small"
            aria-pressed={musicOff}
            aria-label="Mute music"
            disabled={muted}
            title={muted ? 'Sound is off' : undefined}
            onClick={() => {
              setMusicMuted(!musicOff);
              setMusicOff(!musicOff);
            }}
          >
            {musicOff || muted ? 'MUSIC OFF' : 'MUSIC ON'}
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

      {wallet.error && screen !== 'mychogs' && (
        <p className="toast" role="alert">
          {wallet.error}
        </p>
      )}
      <OwnedContext.Provider value={ownedIds}>
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
                  <button className="btn btn-ghost" onClick={() => go('mychogs')}>
                    MY CHOGS
                  </button>
                  {SECRET_PAIRS.length > 0 && (
                    <button className="btn btn-ghost" disabled={!manifest} onClick={secretMutation}>
                      TRY A SECRET MUTATION
                    </button>
                  )}
                </div>
                <ol className="home-steps" aria-label="How it works">
                  <li>
                    <span className="step-n">1</span>
                    <strong>PICK TWO CHOGS</strong>
                    <span>Any of the 1,969 real Chogs.</span>
                  </li>
                  <li>
                    <span className="step-n">2</span>
                    <strong>SPLICE</strong>
                    <span>Their real traits become a mutant with its own moves.</span>
                  </li>
                  <li>
                    <span className="step-n">3</span>
                    <strong>FIGHT</strong>
                    <span>Knock the lab bot off the screen. Then try another pair.</span>
                  </li>
                </ol>
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
                ownedIds={ownedIds}
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
                recorded={
                  ACTIVE_REGISTRY && wallet.address
                    ? (x, y) => (
                        <RecordedSplice
                          key={`${x}-${y}`}
                          manifest={manifest}
                          a={x}
                          b={y}
                          address={wallet.address!}
                          onMonad={wallet.onMonad}
                          onSwitchChain={() => void wallet.switchChain()}
                          onRecorded={(r) => {
                            splice(manifest, x, y);
                            setRecordedTx(r.pairKey, r.txHash);
                            setLastRecord(r);
                          }}
                        />
                      )
                    : undefined
                }
              />
            )}

            {manifest && screen === 'reveal' && mutant && (
              <Reveal
                record={
                  lastRecord && lastRecord.lo === mutant.lo && lastRecord.hi === mutant.hi ? (
                    <RecordBanner
                      record={lastRecord}
                      loName={manifest.byId.get(mutant.lo)?.displayName ?? `#${mutant.lo}`}
                      hiName={manifest.byId.get(mutant.hi)?.displayName ?? `#${mutant.hi}`}
                    />
                  ) : undefined
                }
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
                      bodyColor: bodyColorOf(mutant),
                    },
                    {
                      name: opponent.name,
                      canvas: canvases[1],
                      color: 0xff4fd8,
                      kit: buildKit(opponent),
                      bodyColor: bodyColorOf(opponent),
                    },
                  ]}
                  modifiers={arenaRules?.modifiers ?? []}
                  drivers={mode === 'bot' ? ['human', 'bot'] : ['human', 'human']}
                  difficulty={difficulty}
                  reducedMotion={reducedMotion}
                  testMode={TEST_MODE}
                  onEnd={onMatchEnd}
                  showControls={fightsStarted <= 1}
                  onQuit={() => go('prematch')}
                  twoPlayer={mode === '2p'}
                />
              </Suspense>
            )}

            {manifest && screen === 'results' && result && mutant && opponent && (
              <Results
                result={result}
                onRematch={() => {
                  setResult(null);
                  setFightsStarted((n) => n + 1);
                  setMatchKey((k) => k + 1);
                  setScreen('arena');
                }}
                onChange={changeParent}
                onNew={newExperiment}
                twoPlayer={mode === '2p'}
                mutant={mutant}
                opponent={opponent}
                manifest={manifest}
                loLabel={label(mutant.lo)}
                hiLabel={label(mutant.hi)}
              />
            )}

            {manifest && screen === 'mychogs' && (
              <MyChogs
                manifest={manifest}
                wallet={wallet}
                onSplice={(id) => {
                  setA(id);
                  setB(null);
                  go('lab');
                }}
                onOpen={(lo, hi) => splice(manifest, lo, hi)}
              />
            )}

            {manifest && screen === 'notebook' && (
              <Notebook
                manifest={manifest}
                onOpen={(lo, hi) => splice(manifest, lo, hi)}
                onFight={(lo, hi) => splice(manifest, lo, hi, true)}
              />
            )}
          </div>
        </ErrorBoundary>
      </main>
      </OwnedContext.Provider>
    </div>
  );
}
