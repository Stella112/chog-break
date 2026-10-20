import { useEffect, useRef, useState } from 'react';
import { INHERITED_SLOTS, type Mutant } from '../core/splice';
import { NONE } from '../core/types';
import { GENE_INFO, SLOT_ROLE } from '../config/geneInfo';
import type { Manifest } from '../data/manifest';
import { needsJar, renderMutant } from '../art/mutantRenderer';
import { sfx } from '../audio/sfx';
import { ChogImage } from './ChogImage';
import { geneForSlot } from './traitGenes';
import { ShareButtons } from './ShareButtons';
import { ownedParents, useOwned } from '../state/owned';

/** Jittering lightning arcs from both parent tubes into the chamber (redrawn every 70 ms). */
function Arcs({ active }: { active: boolean }) {
  const [seed, setSeed] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setSeed((n) => n + 1), 70);
    return () => clearInterval(t);
  }, [active]);
  if (!active) return null;
  const bolt = (x0: number, x1: number) => {
    const pts: string[] = [];
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      const y =
        50 +
        (i === 0 || i === n
          ? 0
          : (Math.sin(seed * 7.3 + i * 12.9) * 0.5 + (Math.random() - 0.5)) * 26);
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return pts.join(' ');
  };
  return (
    <svg className="arcs" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      {[0, 1].map((k) => (
        <g key={k}>
          <polyline points={bolt(10, 38)} className={`bolt bolt-${k ? 'b' : 'a'}`} />
          <polyline points={bolt(90, 62)} className={`bolt bolt-${k ? 'a' : 'b'}`} />
          <polyline points={bolt(10, 38)} className="bolt-core" />
          <polyline points={bolt(90, 62)} className="bolt-core" />
        </g>
      ))}
    </svg>
  );
}

// §D6 reveal timeline (ms). Reduced motion → 1 s crossfade.
const STEPS = [
  ['lock', 0],
  ['warning', 350],
  ['spike', 900],
  ['flash', 1300],
  ['glitch', 2300],
  ['smoke', 2800],
  ['open', 3300],
  ['done', 3900],
] as const;
type Step = (typeof STEPS)[number][0];

type Props = {
  mutant: Mutant;
  manifest: Manifest;
  canSkip: boolean;
  reducedMotion: boolean;
  onChange: (slot: 'A' | 'B') => void;
  onNew: () => void;
  onNotebook: () => void;
  onFight: () => void;
  isNewDiscovery: boolean;
};

export function Reveal({
  mutant,
  manifest,
  canSkip,
  reducedMotion,
  onChange,
  onNew,
  onNotebook,
  onFight,
  isNewDiscovery,
}: Props) {
  const [step, setStep] = useState<Step>(reducedMotion ? 'open' : 'lock');
  const canvas = useRef<HTMLCanvasElement>(null);
  const [artReady, setArtReady] = useState(false);
  const mine = ownedParents(useOwned(), mutant.lo, mutant.hi);
  const lo = manifest.byId.get(mutant.lo)!;
  const hi = manifest.byId.get(mutant.hi)!;

  useEffect(() => {
    let alive = true;
    setArtReady(false);
    if (canvas.current)
      void renderMutant(
        canvas.current,
        mutant.visualRecipe,
        256,
        needsJar(manifest.sprites, mutant.visualRecipe),
      ).then(() => alive && setArtReady(true));
    return () => {
      alive = false;
    };
  }, [mutant, manifest.sprites]);

  useEffect(() => {
    if (reducedMotion) {
      setStep('open');
      const t = setTimeout(() => setStep('done'), 1000);
      sfx.impact();
      return () => clearTimeout(t);
    }
    const timers = STEPS.map(([s, at]) =>
      setTimeout(() => {
        setStep(s);
        if (s === 'warning') sfx.alarm();
        if (s === 'spike') {
          sfx.electricity();
          sfx.spinUp(1.4);
        }
        if (s === 'open') sfx.impact();
        if (s === 'done' && mutant.recipe) sfx.discovery();
      }, at),
    );
    return () => timers.forEach(clearTimeout);
  }, [mutant, reducedMotion]);

  const opened = step === 'open' || step === 'done';
  const done = step === 'done';
  const flashA = step === 'flash' || step === 'glitch';
  const charging = step === 'spike' || step === 'flash' || step === 'glitch';
  // tubes drain into the chamber, then refill at the end so A + B sit beside the result
  const drained = step === 'glitch' || step === 'smoke' || step === 'open';

  return (
    <section className={`reveal step-${step}${reducedMotion ? ' reduced' : ''}`} aria-live="polite">
      <div className="reveal-stage">
        {step === 'open' && !reducedMotion && <div className="reveal-flash" aria-hidden />}
        <div className="splice-rig">
          <div
            className={`tube tube-a${charging ? ' charging' : ''}${drained ? ' drained' : ''}`}
            aria-hidden
          >
            <div className="tube-liquid" />
            <ChogImage tokenId={mutant.lo} alt="" thumb />
            <span className="tube-label mono">A</span>
          </div>
          <Arcs active={charging && !reducedMotion} />
          <div className="chamber-frame">
            <div className="warning-light" aria-hidden />
            <div className="reveal-window">
              {!opened && (
                <div className="flasher" aria-hidden>
                  <div className={`flash-img ${flashA ? 'flash-a' : ''}`}>
                    <ChogImage tokenId={mutant.lo} alt="" />
                  </div>
                  <div className={`flash-img ${flashA ? 'flash-b' : ''}`}>
                    <ChogImage tokenId={mutant.hi} alt="" />
                  </div>
                </div>
              )}
              <canvas
                ref={canvas}
                className={`mutant-canvas${opened && artReady ? ' visible' : ''}${mutant.unstable ? ' holo' : ''}`}
                role="img"
                aria-label={`Mutant ${mutant.name}, spliced from ${lo.displayName} and ${hi.displayName}`}
              />
              {mutant.unstable && opened && <div className="stamp stamp-unstable">UNSTABLE</div>}
              <div className="doors" aria-hidden>
                <span />
                <span />
              </div>
              <div className="smoke" aria-hidden />
            </div>
            <div className="specimen-label mono">{mutant.experimentLabel}</div>
          </div>
          <div
            className={`tube tube-b${charging ? ' charging' : ''}${drained ? ' drained' : ''}`}
            aria-hidden
          >
            <div className="tube-liquid" />
            <ChogImage tokenId={mutant.hi} alt="" thumb />
            <span className="tube-label mono">B</span>
          </div>
        </div>
        {!done && canSkip && (
          <button className="btn btn-ghost skip" onClick={() => setStep('done')}>
            SKIP ▸
          </button>
        )}
      </div>

      {done && (
        <div className="reveal-info">
          {mutant.recipe && (
            <div className="recipe-banner" role="status">
              <span className="mono">SECRET MUTATION DISCOVERED</span>
              <strong>{mutant.recipe.name}</strong>
              <span className="small">{mutant.recipe.perk}</span>
            </div>
          )}
          <h2 className="mutant-name glitch-in" data-text={mutant.name}>
            {mutant.name}
          </h2>
          <p className="mono dim">
            {lo.displayName} (ID {lo.tokenId}) × {hi.displayName} (ID {hi.tokenId})
            {isNewDiscovery ? ' · NEW ENTRY IN NOTEBOOK' : ' · ALREADY IN NOTEBOOK'}
          </p>
          {mine.length > 0 && (
            <p className="holder-chip mono small">
              HOLDER SPLICE · you hold {mine.map((id) => manifest.byId.get(id)?.displayName ?? `#${id}`).join(' and ')}
            </p>
          )}

          <table className="genes inherit">
            <thead>
              <tr>
                <th>SLOT</th>
                <th>TRAIT</th>
                <th>FROM</th>
                <th>GENE</th>
              </tr>
            </thead>
            <tbody>
              {INHERITED_SLOTS.map((slot, rowIndex) => {
                const inh = mutant.inherited[slot];
                const src = inh.from === lo.tokenId ? lo : hi;
                const raw = src.attributes.find((a) => a.trait_type === slot)?.value;
                const gene = slot === 'Body' ? mutant.physics : geneForSlot(slot, src.traits);
                const side = inh.from === lo.tokenId ? 'a' : 'b';
                return (
                  <tr
                    key={slot}
                    className="row-in"
                    style={{ animationDelay: `${120 + rowIndex * 80}ms` }}
                  >
                    <th>{slot}</th>
                    <td>{inh.value === NONE ? <span className="dim">none</span> : String(raw)}</td>
                    <td>
                      <span className={`from from-${side}`}>
                        from #{src.displayNumber ?? src.tokenId}
                      </span>
                    </td>
                    <td>
                      <span className="gene" title={GENE_INFO[gene]?.desc}>
                        {GENE_INFO[gene]?.label ?? gene}
                      </span>
                      <span className="dim small"> {SLOT_ROLE[slot]}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {mutant.naked && (
            <p className="small dim">Body came from a naked parent → LIGHT physics.</p>
          )}
          {mutant.metal && <p className="small dim">Metal skin in the bloodline → heavier.</p>}

          <div className="reveal-actions">
            <button className="btn btn-primary" onClick={onFight}>
              FIGHT ▸
            </button>
            <button className="btn btn-a" onClick={() => onChange('A')}>
              CHANGE #{lo.displayNumber}
            </button>
            <button className="btn btn-b" onClick={() => onChange('B')}>
              CHANGE #{hi.displayNumber}
            </button>
            <button className="btn btn-ghost" onClick={onNew}>
              NEW EXPERIMENT
            </button>
            <button className="btn btn-ghost" onClick={onNotebook}>
              NOTEBOOK
            </button>
            <ShareButtons mutant={mutant} manifest={manifest} />
          </div>
        </div>
      )}
    </section>
  );
}
