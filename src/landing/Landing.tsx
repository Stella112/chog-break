// Landing page at "/": what CHOG//BREAK is, in one scroll. Light on purpose: no game engine, no chain client.
// Everything here is true of the current build; figures come from the real collection and the game code.
import { explorerAddress, REGISTRY_ADDRESS, SPONSOR_URL } from '../config/chain';
import './landing.css';

const PLAY = '/play/';
const LAB = '/play/?view=lab';
const KING_BEAM = '/play/?a=18&b=66';
/** Set when the repository is public (judges need the link). */
const REPO_URL: string | null = null;

// real Chog Genesis tokens (art served from this site, fetched from the collection's metadata)
const STRIP = [18, 66, 70, 352, 1, 2, 5, 9, 100, 500, 7, 1900, 33, 777, 1337, 1969];

const GENES: [string, string, string][] = [
  ['Eyes', 'laser eyes', 'BEAM special: a charged horizontal laser'],
  ['Head', 'crown', 'ROYAL: harder to launch'],
  ['Mouth', 'rainbow puke', 'PUKE: a multi-hit rainbow cone'],
  ['Base', 'skull', 'UNDEAD: revive once per match'],
  ['Accessory', 'knife', 'SHIV: sharper punches'],
  ['Aura', 'wind', 'GUST: your dash shoves the opponent'],
];

function Thumb({ id }: { id: number }) {
  return <img src={`/chogs/thumbs/${id}.webp`} alt={`Chog Genesis token ${id}`} width={96} height={96} loading="lazy" decoding="async" />;
}

export function Landing() {
  return (
    <div className="ld">
      <header className="ld-top">
        <a className="ld-logo" href="/">
          CHOG<span>//</span>BREAK
        </a>
        <nav>
          <a href="#how">How it works</a>
          <a href="#onchain">On Monad</a>
          <a className="ld-btn ld-btn-small" href={PLAY}>
            PLAY
          </a>
        </nav>
      </header>

      <section className="ld-hero">
        <div className="ld-hazard" aria-hidden />
        <p className="ld-kicker">A CHOG GENESIS SPLICING LAB · MONAD</p>
        <h1>
          Pick two Chogs.
          <br />
          Splice them.
          <br />
          <em>See what goes wrong.</em>
          <br />
          Then fight it.
        </h1>
        <p className="ld-sub">
          Every one of the 1,969 real Chog Genesis NFTs is genetic material. Two of them make a mutant whose moves come from their
          real traits, and then you knock it off the screen.
        </p>
        <div className="ld-cta">
          <a className="ld-btn" href={LAB}>
            ENTER THE LAB
          </a>
          <a className="ld-btn ld-btn-ghost" href={KING_BEAM}>
            TRY A SECRET MUTATION
          </a>
        </div>
        <p className="ld-note">No wallet needed to play. Runs in the browser.</p>
      </section>

      <div className="ld-strip" aria-label="Some of the real Chogs">
        <div className="ld-strip-track">
          {[...STRIP, ...STRIP].map((id, i) => (
            <Thumb key={`${id}-${i}`} id={id} />
          ))}
        </div>
      </div>

      <section className="ld-stats" aria-label="By the numbers">
        <div>
          <strong>1,969</strong>
          <span>real Chogs</span>
        </div>
        <div>
          <strong>1,937,496</strong>
          <span>possible pairs</span>
        </div>
        <div>
          <strong>16</strong>
          <span>secret recipes</span>
        </div>
        <div>
          <strong>10</strong>
          <span>arena mutations</span>
        </div>
      </section>

      <section id="how" className="ld-steps">
        <h2>How it works</h2>
        <ol>
          <li>
            <b>01 · PICK</b>
            <p>Browse and filter every real Chog by trait. Load two into the lab chambers.</p>
          </li>
          <li>
            <b>02 · SPLICE</b>
            <p>
              Each of seven trait slots comes from one parent. The same pair always gives the same mutant, on every device, for
              everyone.
            </p>
          </li>
          <li>
            <b>03 · FIGHT</b>
            <p>A Smash-style 2.5D arena: damage builds, knockback grows. Fight the lab bot or a friend on one keyboard.</p>
          </li>
          <li>
            <b>04 · DISCOVER</b>
            <p>Your notebook keeps every mutant. Somewhere in 1.9 million pairs, 16 secret mutations are waiting.</p>
          </li>
        </ol>
      </section>

      <section className="ld-genes">
        <h2>The NFT is the ingredient</h2>
        <p className="ld-lede">Real metadata decides everything. A few of the rules:</p>
        <table>
          <tbody>
            {GENES.map(([slot, trait, gene]) => (
              <tr key={slot}>
                <th>{slot}</th>
                <td className="ld-trait">{trait}</td>
                <td>→ {gene}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="ld-cards">
          <div className="ld-card">
            <span className="ld-tag">SECRET RECIPE</span>
            <h3>KING BEAM</h3>
            <p>Laser eyes on one parent, a crown on the other: the beam pierces and grows 20% wider.</p>
            <div className="ld-pair">
              <Thumb id={18} />
              <span>×</span>
              <Thumb id={66} />
            </div>
            <a href={KING_BEAM}>Splice it ▸</a>
          </div>
          <div className="ld-card">
            <span className="ld-tag">THE ARENA MUTATES TOO</span>
            <h3>Backgrounds set the rules</h3>
            <p>
              The four parents' Backgrounds pick the arena: a rotating toxic floor, low gravity, slippery or bouncy floors, meteor
              showers, coin rain, a shrinking stage. They hit both fighters, so an NFT changes the rules rather than buying power.
            </p>
          </div>
          <div className="ld-card">
            <span className="ld-tag">FAIR BY TEST</span>
            <h3>Rarity ≠ strength</h3>
            <p>
              Tier changes no stat. A test checks every gene combination, and a 300-match bot-vs-bot simulation keeps every gene under
              a 65% win rate.
            </p>
          </div>
        </div>
      </section>

      <section id="onchain" className="ld-chain">
        <h2>Record it on Monad</h2>
        <p className="ld-lede">
          Splicing is free forever. If you want the credit, record the experiment on-chain: the first wallet to record a pair is its
          permanent first discoverer, and the small $CHOG fee is split on the spot.
        </p>
        <div className="ld-split" role="img" aria-label="Fee split: 35% to each parent's owner, 20% prize pool, 10% dead address">
          <span style={{ flex: 35 }}>35% owner of parent A</span>
          <span style={{ flex: 35 }}>35% owner of parent B</span>
          <span style={{ flex: 20 }}>20% prize</span>
          <span style={{ flex: 10 }}>10%</span>
        </div>
        <p className="small-print">
          The 10% is sent to the dead address. Owners are read on-chain at the moment of recording, so holding a popular Chog earns
          $CHOG whenever anyone records a splice with it.
        </p>
        {SPONSOR_URL && (
          <p className="ld-free">
            <b>First one's on us:</b> connect a wallet, sign a free message, and the game pays the fee and gas for one recording every
            48 hours.
          </p>
        )}
        {REGISTRY_ADDRESS && (
          <p className="small-print">
            Registry contract:{' '}
            <a href={explorerAddress(REGISTRY_ADDRESS)} target="_blank" rel="noopener noreferrer">
              {REGISTRY_ADDRESS}
            </a>{' '}
            (source verified).
          </p>
        )}
      </section>

      <section className="ld-final">
        <h2>1,969 Chogs. Millions of experiments.</h2>
        <a className="ld-btn" href={LAB}>
          SPLICE. BREAK. REPEAT.
        </a>
      </section>

      <footer className="ld-foot">
        <span>Built for Chogathon 2026 on Monad. Art from the Chog Genesis collection's own metadata.</span>
        <span>
          <a href={PLAY}>Play</a>
          {REPO_URL && (
            <>
              {' · '}
              <a href={REPO_URL}>Source</a>
            </>
          )}
        </span>
      </footer>
    </div>
  );
}
