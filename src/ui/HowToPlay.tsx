import type { Mutant } from '../core/splice';
import { GENE_INFO } from '../config/geneInfo';

type Key = { k: string; label: string; kind: 'move' | 'attack' | 'gene' };

function Cap({ k, label, kind }: Key) {
  return (
    <div className={`kcap kcap-${kind}`}>
      <span className="kcap-key">{k}</span>
      <span className="kcap-label">{label}</span>
    </div>
  );
}

/** Visual keyboard + how to win (§D7 controls overlay, always shown before the fight). */
export function HowToPlay({ player, twoPlayer, touch = false }: { player: Mutant; twoPlayer: boolean; touch?: boolean }) {
  const t = touch && !twoPlayer;
  const special = GENE_INFO[player.special]?.label ?? player.special;
  const close = GENE_INFO[player.close]?.label ?? player.close;
  return (
    <section className="panel howto" aria-label="How to play">
      <div className="howto-win">
        <h3 className="mono">HOW TO WIN</h3>
        <ol>
          <li>
            <strong>Hit them</strong> to raise their <strong>damage %</strong>.
          </li>
          <li>
            The higher the %, the <strong>further they fly</strong>.
          </li>
          <li>
            Knock them <strong>off the screen</strong>. 2 lives each.
          </li>
        </ol>
        <p className="small dim">Fell off? Press jump in the air (up to 3 times) to fly back.</p>
      </div>
      <div className="howto-keys">
        <div className="kb-group">
          <span className="label">{twoPlayer ? 'PLAYER 1: MOVE' : 'MOVE'}</span>
          <div className="kb-cluster">
            <div className="kb-row">
              <Cap k={t ? 'JUMP' : 'W'} label={t ? 'right thumb' : 'jump'} kind="move" />
            </div>
            <div className="kb-row">
              <Cap k={t ? '◀' : 'A'} label="left" kind="move" />
              <Cap k={t ? '▼' : 'S'} label="drop" kind="move" />
              <Cap k={t ? '▶' : 'D'} label="right" kind="move" />
            </div>
          </div>
        </div>
        <div className="kb-group">
          <span className="label">FIGHT</span>
          <div className="kb-cluster">
            <div className="kb-row">
              <Cap k={t ? 'CLOSE' : 'I'} label={close} kind="gene" />
            </div>
            <div className="kb-row">
              <Cap k={t ? 'PUNCH' : 'J'} label="punch" kind="attack" />
              <Cap k={t ? 'DASH' : 'K'} label="dash" kind="attack" />
              <Cap k={t ? 'SPEC' : 'L'} label={special} kind="gene" />
            </div>
          </div>
        </div>
        {twoPlayer && (
          <div className="kb-group">
            <span className="label">PLAYER 2</span>
            <p className="mono small">
              ← → move · ↑ jump · ↓ drop
              <br />, punch · . dash · / special · M close
            </p>
          </div>
        )}
      </div>
      <p className="small dim howto-gene">
        {t ? 'On-screen buttons: move on the left, attacks on the right. ' : ''}Yellow keys come from your mutant's genes: they change with every splice.
      </p>
    </section>
  );
}
