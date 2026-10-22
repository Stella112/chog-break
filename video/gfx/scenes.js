// Motion graphics for the demo video. Every scene is setup() once, then render(t) for any t (seconds from the
// scene's start): a pure function of time, so render.mjs can step it frame by frame. All numbers shown are real:
// the Chog data comes from public/data, the on-chain numbers from the first mainnet recording's receipt.
const stage = document.getElementById('stage');
const params = new URLSearchParams(location.search);

// ---------- helpers ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const eOut = (x) => 1 - Math.pow(1 - x, 3);
const eIn = (x) => x * x * x;
const eInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const eBack = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
/** 0 → 1 between a and a+inDur, back to 0 between b-outDur and b */
const life = (t, a, b, inDur = 0.35, outDur = 0.3) => Math.min(eOut(prog(t, a, a + inDur)), 1 - eIn(prog(t, b - outDur, b)));
function h(tag, cls, parent, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  (parent ?? stage).appendChild(e);
  return e;
}
function place(e, x, y, w, hgt) {
  e.classList.add('abs');
  e.style.left = x + 'px';
  e.style.top = y + 'px';
  if (w != null) e.style.width = w + 'px';
  if (hgt != null) e.style.height = hgt + 'px';
  return e;
}
const set = (e, o, tf = '') => { e.style.opacity = String(clamp(o)); e.style.transform = tf; };
/** slide-in from dx, fade with life() */
const show = (e, t, a, b, dx = -40, dy = 0) => { const k = life(t, a, b); set(e, k, `translate(${(1 - k) * dx}px, ${(1 - k) * dy}px)`); };
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const imgOf = (id) => `/public/chogs/${id}.webp`;
const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

// Chogs whose art prints words that don't belong in a pitch video are left out of the walls.
const HIDE = new Set(['Head:RETARD Cap', 'Head:BOOB Cap', 'Head:Boob Cap', 'Head:Horny Cap', 'Head:Balls Cap', 'Body:BBC', 'Body:Boner', 'Body:MILF Lover', 'Body:Zero THOTS']);
async function loadChogs() {
  const all = await (await fetch('/public/data/chogs.min.json')).json();
  return all
    .filter((c) => !c.attributes.some((a) => HIDE.has(`${a.trait_type}:${a.value}`)))
    .map((c) => ({ id: c.tokenId, n: c.displayNumber, tr: Object.fromEntries(c.attributes.map((a) => [a.trait_type, a.value])) }));
}
async function preload(root) {
  await document.fonts.ready;
  await Promise.all([...root.querySelectorAll('img')].map((i) => (i.complete ? i.decode().catch(() => {}) : new Promise((r) => { i.onload = i.onerror = r; }))));
}

// ---------- the wall (open + close) ----------
const SLOTS = ['Eyes', 'Head', 'Mouth', 'Body', 'Aura', 'Accessory'];
async function buildWall(root, { cols = 22, rows = 12, size = 104, gap = 8, seed = 7 } = {}) {
  const chogs = await loadChogs();
  const r = rng(seed);
  const pool = [...chogs].sort(() => r() - 0.5);
  const wall = h('div', 'wall', root);
  wall.style.gridTemplateColumns = `repeat(${cols}, ${size}px)`;
  wall.style.gridAutoRows = `${size}px`;
  wall.style.gap = `${gap}px`;
  const W = cols * size + (cols - 1) * gap, H = rows * size + (rows - 1) * gap;
  const tiles = [];
  for (let i = 0; i < cols * rows; i++) {
    const c = pool[i];
    const el = h('div', 'tile', wall);
    const img = h('img', null, el);
    img.src = imgOf(c.id);
    // the first slot (rotating per tile) where this Chog actually has something
    let slot = SLOTS[i % SLOTS.length];
    for (let k = 0; k < SLOTS.length; k++) {
      const sl = SLOTS[(i + k) % SLOTS.length];
      if (c.tr[sl] && c.tr[sl].toLowerCase() !== 'none') { slot = sl; break; }
    }
    const val = (c.tr[slot] ?? 'none').toLowerCase();
    const gene = h('div', 'gene', el, `<b>${slot.toUpperCase()}</b><i>${val}</i><u></u>`);
    const col = i % 2 ? 'var(--b)' : 'var(--a)';
    gene.querySelector('i').style.color = col;
    gene.querySelector('u').style.background = col;
    const lx = (i % cols) * (size + gap) + size / 2 - W / 2;
    const ly = Math.floor(i / cols) * (size + gap) + size / 2 - H / 2;
    tiles.push({ el, img, gene, lx, ly, d: Math.hypot(lx / W, ly / H), j: r() });
  }
  return { wall, tiles, W, H };
}
const ROT = (-7 * Math.PI) / 180;
function wallTransform(w, scale) {
  w.wall.style.transform = `translate(${-w.W / 2}px, ${-w.H / 2}px) rotate(${ROT}rad) scale(${scale})`;
  w.wall.style.transformOrigin = `${w.W / 2}px ${w.H / 2}px`;
}
const screenX = (tile, scale) => 960 + scale * (tile.lx * Math.cos(ROT) - tile.ly * Math.sin(ROT));

// ---------- scenes ----------
const SCENES = {};

// 0:00 cold open — the 1,969 real Chogs, then pictures turn into genes, then the logo.
SCENES.open = {
  dur: 13.4,
  async setup(root) {
    document.body.classList.add('opaque');
    h('div', 'grid-bg', root);
    this.w = await buildWall(root);
    this.scan = place(h('div', null, root), 0, -300, 6, 1700);
    this.scan.style.background = 'var(--hazard)';
    this.scan.style.boxShadow = '0 0 40px 12px rgba(255,212,0,0.55)';
    this.panel = place(h('div', 'panel', root), 90, 700, 640);
    h('div', 'tape', this.panel);
    const inner = h('div', null, this.panel);
    inner.style.padding = '18px 30px 26px';
    h('div', 'mono dim', inner, 'CHOG GENESIS · MONAD').style.fontSize = '24px';
    this.count = h('div', 'disp', inner, '0');
    this.count.style.cssText = 'font-size:150px;line-height:1;margin-top:8px;font-variant-numeric:tabular-nums';
    this.logo = place(h('div', 'logo', root, 'CHOG<span>//</span>BREAK'), 0, 380, 1920);
    this.logo.style.cssText += ';font-size:190px;text-align:center';
    this.sub = place(h('div', 'mono dim', root, 'SPLICE REAL CHOGS · FIGHT WHAT WALKS OUT'), 0, 640, 1920);
    this.sub.style.cssText += ';font-size:30px;letter-spacing:0.32em;text-align:center';
    h('div', 'vignette', root);
  },
  render(t) {
    const { w } = this;
    const scale = lerp(1.05, 1.16, t / 13.4) * lerp(1, 1.7, eIn(prog(t, 10.6, 11.6)));
    wallTransform(w, scale);
    w.wall.style.opacity = String(lerp(1, 0.13, eOut(prog(t, 10.7, 11.5))));
    const dimF = lerp(1, 0.42, eOut(prog(t, 6.6, 7.4)));
    const scanX = lerp(-260, 2180, eInOut(prog(t, 7.0, 10.9)));
    set(this.scan, life(t, 6.9, 11.0, 0.2, 0.2), `translateX(${scanX}px) rotate(-7deg)`);
    for (const tl of w.tiles) {
      const d = 0.7 + tl.d * 3.0 + tl.j * 0.6;
      const p = prog(t, d, d + 0.45);
      const passed = clamp((scanX - screenX(tl, scale)) / 140);
      const flip = Math.abs(Math.cos(Math.PI * passed));
      tl.el.style.opacity = String(clamp(p * 4));
      tl.el.style.transform = `scale(${(0.55 + 0.45 * eBack(p)) * Math.max(flip, 0.02)}, ${0.55 + 0.45 * eBack(p)})`;
      const gene = passed > 0.5;
      tl.img.style.display = gene ? 'none' : 'block';
      tl.gene.style.display = gene ? 'flex' : 'none';
      tl.img.style.filter = `brightness(${dimF})`;
    }
    show(this.panel, t, 0.6, 6.7, 0, 60);
    this.count.textContent = fmt(1969 * eOut(prog(t, 0.9, 3.3)));
    const p = eOut(prog(t, 11.15, 11.55));
    const jit = t > 11.55 && t < 11.85 ? (Math.sin(t * 97) * 7) | 0 : 0;
    set(this.logo, p, `translateX(${jit}px) scale(${lerp(1.6, 1, p)})`);
    const split = 3 + (1 - p) * 22;
    this.logo.style.textShadow = `${-split}px 0 rgba(79,240,255,0.8), ${split}px 0 rgba(255,79,216,0.8)`;
    show(this.sub, t, 11.8, 99, 0, 20);
  },
};

// 0:36 the genome — every trait from a parent, every trait a gene; then "same pair, same mutant".
const GENOME = [
  ['Eyes', 'Purple laser', 'B', 'BEAM', 'special · L'],
  ['Head', 'Crown', 'A', 'ROYAL', 'defense'],
  ['Mouth', 'Lip Bite', 'B', 'HEADBUTT', 'close move · I'],
  ['Body', 'Duck Float', 'A', 'SLIPPERY', 'physics'],
  ['Base', 'Origin', 'B', 'NORMAL', 'affinity'],
  ['Accessory', 'none', 'B', '—', 'trinket'],
  ['Aura', 'Cool Aura', 'B', 'FROST', 'element'],
];
const PARENT = { A: { id: 66, n: 1527, c: 'var(--a)' }, B: { id: 100, n: 1561, c: 'var(--b)' } };
SCENES.genes = {
  dur: 14.0,
  async setup(root) {
    document.body.classList.add('opaque');
    h('div', 'grid-bg', root);
    this.head = place(h('div', 'mono dim', root, 'EXPERIMENT #66×100 · <span class="hl">KING BEAM</span>'), 120, 70);
    this.head.style.fontSize = '26px';
    this.cards = {};
    for (const [k, y] of [['A', 150], ['B', 560]]) {
      const P = PARENT[k];
      const c = place(h('div', null, root), 120, y, 320);
      const img = h('img', 'card-img', c);
      img.src = imgOf(P.id);
      img.style.cssText += `;width:300px;height:300px;border:5px solid ${P.c}`;
      const lab = h('div', 'mono', c, `${k} · CHOG #${P.n}`);
      lab.style.cssText = `color:${P.c};font-size:24px;margin-top:12px;font-weight:700`;
      this.cards[k] = c;
    }
    this.svg = place(h('div', null, root), 0, 0, 1920, 1080);
    this.svg.innerHTML = '<svg width="1920" height="1080"></svg>';
    const svg = this.svg.firstChild;
    this.table = place(h('div', 'panel', root), 560, 150, 1240);
    this.rows = GENOME.map(([slot, trait, from, gene, kind], i) => {
      const r = h('div', 'row', this.table);
      const P = PARENT[from];
      h('div', 'mono dim', r, slot.toUpperCase()).style.fontSize = '22px';
      h('div', null, r, trait).style.cssText = 'font-size:34px;font-weight:800';
      const chip = h('div', 'chip', r, `from #${P.n}`);
      chip.style.cssText += `;color:${P.c};justify-self:start;font-size:20px`;
      const g = h('div', null, r, `<span class="disp hl" style="font-size:36px">${gene}</span> <span class="mono dim" style="font-size:20px;margin-left:10px">${kind}</span>`);
      g.style.whiteSpace = 'nowrap';
      // connector from the parent card to this row
      const y0 = (from === 'A' ? 150 : 560) + 150, y1 = 150 + i * 92 + 46;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M 425 ${y0} C 500 ${y0}, 490 ${y1}, 560 ${y1}`);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', from === 'A' ? '#4ff0ff' : '#ff4fd8');
      path.setAttribute('stroke-width', '3');
      svg.appendChild(path);
      const len = path.getTotalLength();
      path.style.strokeDasharray = `${len}`;
      return { r, g, path, len };
    });
    this.callouts = [
      ['PURPLE LASER', 'BEAM', 'special move (L): a charged eye beam'],
      ['CROWN', 'ROYAL', 'defense: takes 10% less knockback'],
    ].map(([a, b, s]) => {
      const c = place(h('div', null, root), 560, 845, 1240);
      c.innerHTML = `<div class="disp" style="font-size:58px;white-space:nowrap">${a} <span class="dim">→</span> <span class="hl">${b}</span></div><div class="mono dim" style="font-size:26px;margin-top:8px">${s}</div>`;
      return c;
    });
    // "same pair, same mutant"
    this.eq = place(h('div', null, root), 0, 0, 1920, 1080);
    const eqRow = (y, first, second) => {
      const row = place(h('div', null, this.eq), 170, y, 900, 260);
      row.style.cssText += ';display:flex;align-items:center;gap:22px';
      for (const [k, i] of [[first, 0], [null, 1], [second, 2]]) {
        if (k === null) { h('div', 'disp dim', row, '×').style.fontSize = '60px'; continue; }
        const P = PARENT[k];
        const im = h('img', 'card-img', row);
        im.src = imgOf(P.id);
        im.style.cssText += `;width:250px;height:250px;border:6px solid ${P.c}`;
        void i;
      }
      const lab = h('div', 'mono', row, `#${PARENT[first].n} × #${PARENT[second].n}`);
      lab.style.cssText = 'font-size:26px;color:var(--dim);margin-left:10px;white-space:nowrap';
      return row;
    };
    this.eq1 = eqRow(170, 'A', 'B');
    this.eq2 = eqRow(560, 'B', 'A');
    this.arrows = place(h('div', null, this.eq), 0, 0, 1920, 1080);
    this.arrows.innerHTML = `<svg width="1920" height="1080"><path d="M 1110 300 C 1220 300, 1220 520, 1300 520" stroke="#ffd400" stroke-width="4" fill="none"/><path d="M 1110 690 C 1220 690, 1220 520, 1300 520" stroke="#ffd400" stroke-width="4" fill="none"/></svg>`;
    this.mut = place(h('div', null, this.eq), 1320, 270, 460);
    this.mut.innerHTML = `<img class="card-img" src="/video/footage/kingbeam.jpg" style="width:460px;height:460px;border:5px solid var(--hazard)"><div class="disp" style="font-size:48px;margin-top:14px;text-align:center">KING BEAM</div>`;
    this.same = place(h('div', 'mono', this.eq, 'SAME PAIR → SAME MUTANT'), 150, 900);
    this.same.style.cssText += ';font-size:30px;letter-spacing:0.18em;color:var(--hazard)';
    this.devs = ['LAPTOP', 'PHONE', 'TABLET', 'NEXT YEAR'].map((d, i) => {
      const c = place(h('div', 'chip', this.eq, `${d} ✓`), 1000 + i * 0, 900);
      c.style.color = 'var(--text)';
      return c;
    });
    let x = 820;
    for (const c of this.devs) { c.style.left = x + 'px'; x += c.offsetWidth + 18; }
    h('div', 'vignette', root);
  },
  render(t) {
    const out = eIn(prog(t, 8.7, 9.2));
    for (const k of ['A', 'B']) set(this.cards[k], life(t, 0, 99) * (1 - out), `translateX(${(1 - eOut(prog(t, 0, 0.5))) * -60 - out * 80}px)`);
    set(this.head, life(t, 0, 99) * (1 - out));
    set(this.table, eOut(prog(t, 0.1, 0.5)) * (1 - out), `translateX(${(1 - eOut(prog(t, 0.1, 0.5))) * 60 + out * 120}px)`);
    const focus = t >= 3.35 && t < 6.35 ? 0 : t >= 6.35 && t < 8.8 ? 1 : -1;
    this.rows.forEach((row, i) => {
      const a = 0.3 + i * 0.3;
      const p = prog(t, a, a + 0.45);
      row.path.style.strokeDashoffset = String(row.len * (1 - eInOut(p)));
      row.path.style.opacity = String(lerp(1, 0.22, prog(t, 2.8, 3.3)) * (1 - out));
      const dim = focus >= 0 && focus !== i ? 0.22 : 1;
      set(row.r, eOut(prog(t, a + 0.2, a + 0.5)) * dim, `translateX(${(1 - eOut(prog(t, a + 0.2, a + 0.5))) * -24}px)`);
      row.r.style.background = focus === i ? 'rgba(255,212,0,0.10)' : 'transparent';
      const g = prog(t, 1.7 + i * 0.16, 2.0 + i * 0.16);
      row.g.style.clipPath = `inset(0 ${100 - g * 100}% 0 0)`;
    });
    show(this.callouts[0], t, 3.45, 6.35, 0, 30);
    show(this.callouts[1], t, 6.45, 8.8, 0, 30);
    // the equation
    set(this.eq, prog(t, 9.0, 9.3));
    show(this.eq1, t, 9.0, 99, -60);
    show(this.eq2, t, 9.75, 99, -60);
    this.arrows.style.clipPath = `inset(0 ${100 - eInOut(prog(t, 9.4, 10.4)) * 100}% 0 0)`;
    const m = eBack(prog(t, 9.3, 9.8));
    set(this.mut, prog(t, 9.3, 9.5), `scale(${lerp(0.8, 1, m)})`);
    show(this.same, t, 10.2, 99, 0, 20);
    this.devs.forEach((d, i) => show(d, t, 10.9 + i * 0.32, 99, 0, 20));
  },
};

// 0:50 labels over the real fight (transparent)
function tagEl(root, n, text, y) {
  const e = place(h('div', 'tag', root, `<small>${n}</small>${text}`), 70, y);
  return e;
}
SCENES.fightfx = {
  dur: 25.9,
  alpha: true,
  async setup(root) {
    this.tags = [
      [2.6, 'HITS RAISE DAMAGE %'],
      [3.95, 'MORE % → FLY FURTHER'],
      [7.55, 'OFF THE STAGE = −1 LIFE'],
    ].map(([a, txt], i) => ({ a, e: tagEl(root, `0${i + 1}`, txt, 210 + i * 92) }));
    this.moves = place(h('div', 'panel', root), 70, 210, 760);
    this.moves.innerHTML = `<div class="tape"></div><div style="padding:22px 28px 26px">
      <div class="mono dim" style="font-size:22px;letter-spacing:0.12em;margin-bottom:16px">KING BEAM'S MOVES = ITS PARENTS' TRAITS</div>
      ${[['L', 'BEAM', 'purple laser', 'B'], ['I', 'HEADBUTT', 'lip bite', 'B'], ['', 'ROYAL', 'crown', 'A']]
        .map(([k, g, tr, p]) => `<div style="display:flex;align-items:center;gap:18px;height:66px">
          ${k ? `<span class="key">${k}</span>` : '<span class="key" style="border-style:dashed;opacity:.5">·</span>'}
          <span class="disp hl" style="font-size:34px;width:250px">${g}</span>
          <span style="font-size:28px;font-weight:800;color:${PARENT[p].c}">← ${tr}</span>
          <span class="mono dim" style="font-size:20px">#${PARENT[p].n}</span></div>`).join('')}</div>`;
    this.rulesHead = tagEl(root, 'ARENA', 'BACKGROUNDS PICK THE RULES', 210);
    this.rules = [
      [15.95, '#a98bff', 'LOW GRAVITY', 'mon / purple backgrounds'],
      [17.1, '#ff8ad8', 'BOUNCY FLOOR', 'pink backgrounds'],
      [18.3, '#8aff4f', 'TOXIC FLOOR', 'radioactive background'],
      [19.1, '#ff5a3c', 'METEOR SHOWER', 'red sky backgrounds'],
    ].map(([a, col, name, src], i) => {
      const e = place(h('div', 'panel', root), 70, 320 + i * 96, 620, 82);
      e.style.cssText += ';display:flex;align-items:center;gap:20px;padding:0 20px';
      e.innerHTML = `<span style="width:44px;height:44px;border-radius:8px;background:${col};flex:none"></span>
        <span><span class="disp" style="font-size:30px;display:block;line-height:1.1">${name}</span><span class="mono dim" style="font-size:19px">← ${src}</span></span>`;
      return { a, e };
    });
    this.both = place(h('div', null, root), 712, 320, 520, 370);
    this.both.innerHTML = `<div style="position:absolute;left:0;top:10px;bottom:10px;width:22px;border:4px solid var(--hazard);border-left:0"></div>
      <div style="position:absolute;left:44px;top:120px">
        <div class="disp hl" style="font-size:38px;line-height:1.1">HITS BOTH<br>FIGHTERS</div>
        <div class="mono" style="font-size:22px;margin-top:12px;background:rgba(11,10,16,.85);padding:6px 10px;display:inline-block">no pay-to-win</div></div>`;
  },
  render(t) {
    for (const g of this.tags) show(g.e, t, g.a, 8.75, -60);
    show(this.moves, t, 8.9, 11.25, -60);
    show(this.rulesHead, t, 11.5, 25.7, -60);
    for (const r of this.rules) show(r.e, t, r.a, 25.7, -60);
    const k = life(t, 20.8, 25.7);
    set(this.both, k, `translateX(${(1 - k) * -30}px)`);
  },
};

// 1:23 almost two million pairs (transparent, over the notebook)
SCENES.pairs = {
  dur: 3.5,
  alpha: true,
  async setup(root) {
    this.shade = place(h('div', null, root), 0, 0, 1920, 1080);
    this.shade.style.background = 'rgba(11,10,16,0.82)';
    this.num = place(h('div', 'disp', root, '0'), 0, 360, 1920);
    this.num.style.cssText += ';font-size:200px;text-align:center;font-variant-numeric:tabular-nums';
    this.lab = place(h('div', 'mono', root, 'POSSIBLE PAIRS · <span class="hl">A × B = B × A</span>'), 0, 640, 1920);
    this.lab.style.cssText += ';font-size:34px;letter-spacing:0.16em;text-align:center';
  },
  render(t) {
    set(this.shade, eOut(prog(t, 0, 0.35)));
    set(this.num, eOut(prog(t, 0.1, 0.4)), `scale(${lerp(1.15, 1, eOut(prog(t, 0.1, 0.5)))})`);
    this.num.textContent = fmt(1937496 * eOut(prog(t, 0.15, 1.7)));
    show(this.lab, t, 0.9, 99, 0, 20);
  },
};

// 1:27 Recorded Splice — the real first mainnet recording, its real receipt, then the free first recording.
SCENES.onchain = {
  dur: 21.8,
  async setup(root) {
    document.body.classList.add('opaque');
    const R = await (await fetch('/video/footage/receipt.json')).json();
    h('div', 'grid-bg', root);
    this.title = place(h('div', null, root), 120, 80);
    this.title.innerHTML = `<div class="disp" style="font-size:64px">RECORDED SPLICE</div><div class="mono" style="font-size:24px;color:var(--monad);letter-spacing:0.14em">OPTIONAL · ON MONAD MAINNET</div>`;
    // A: an open slot, and a real filled one
    this.open = place(h('div', 'panel', root), 120, 380, 760);
    this.open.innerHTML = `<div style="display:flex;gap:28px;padding:28px">
      <img class="card-img" src="/video/footage/kingbeam.jpg" style="width:230px;height:230px;border:4px solid var(--hazard)">
      <div><div class="mono dim" style="font-size:22px">EXPERIMENT #66×100</div><div class="disp" style="font-size:44px;margin:6px 0 26px">KING BEAM</div>
      <div class="mono dim" style="font-size:20px">FIRST DISCOVERER</div><div class="mono" style="font-size:30px;margin-top:6px">open<span class="cursor hl">▌</span></div></div></div>`;
    this.cursor = this.open.querySelector('.cursor');
    const date = new Date(R.timestamp * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    this.real = place(h('div', 'panel', root), 960, 380, 840);
    this.real.style.borderColor = 'var(--monad)';
    this.real.innerHTML = `<div style="background:var(--monad);color:#fff;font:700 20px var(--mono);padding:8px 28px;letter-spacing:0.14em">A REAL MAINNET RECORD</div>
      <div style="padding:24px 28px;display:grid;grid-template-columns:260px 1fr;row-gap:14px;font-size:28px" class="mono">
      <span class="dim">PAIR</span><span>#1562 × #1663</span>
      <span class="dim">DISCOVERER</span><span class="hl">${short(R.splicer)}</span>
      <span class="dim">BLOCK</span><span>${fmt(R.block)}</span>
      <span class="dim">DATE</span><span>${date}</span>
      <span class="dim">REGISTRY</span><span>${short(R.to)}</span></div>
      <div class="mono dim" style="font-size:20px;padding:0 28px 24px">written once; nobody can overwrite it</div>`;
    // B: the fee split from the receipt
    const owners = R.transfers;
    const tot = owners.reduce((s, x) => s + Number(x.value), 0);
    this.total = place(h('div', null, root), 0, 300, 1920);
    this.total.innerHTML = `<div style="text-align:center"><span class="disp" style="font-size:110px">${tot} $CHOG</span><div class="mono dim" style="font-size:26px;margin-top:6px">fee for one recording</div></div>`;
    const segs = [
      ['OWNER OF PARENT A', 'var(--a)', '#000'],
      ['OWNER OF PARENT B', 'var(--b)', '#000'],
      ['PRIZE POOL', 'var(--hazard)', '#000'],
      ['BURNED', '#5b5670', '#fff'],
    ];
    this.bar = place(h('div', null, root), 160, 540, 1600, 130);
    this.segs = owners.map((tr, i) => {
      const v = Number(tr.value);
      const s = h('div', null, this.bar);
      s.style.cssText = `position:absolute;top:0;height:130px;background:${segs[i][1]};color:${segs[i][2]};padding:14px 18px;overflow:hidden`;
      s.innerHTML = `<div class="disp" style="font-size:44px;line-height:1">${Math.round((v / tot) * 100)}%</div><div class="mono" style="font-size:19px;font-weight:700;margin-top:10px;white-space:nowrap">${v} · ${segs[i][0]}</div>`;
      const addr = h('div', 'mono dim', this.bar, i === 3 ? '0x…dEaD' : short(tr.to));
      addr.style.cssText += ';position:absolute;top:146px;font-size:20px';
      return { s, addr, v };
    });
    this.receipt = place(h('div', 'mono dim', root, `from the real receipt · tx ${short(R.tx)} · block ${fmt(R.block)}`), 0, 760, 1920);
    this.receipt.style.cssText += ';font-size:24px;text-align:center';
    this.every = place(h('div', 'mono', root, 'PAID TO THE PARENTS’ OWNERS ON <span class="hl">EVERY</span> RECORDING OF THE PAIR'), 0, 850, 1920);
    this.every.style.cssText += ';font-size:30px;letter-spacing:0.08em;text-align:center';
    // C: free first recording
    this.free = place(h('div', null, root), 120, 300, 1680);
    this.free.innerHTML = `<div class="disp" style="font-size:76px">YOUR FIRST RECORDING <span class="hl">IS FREE</span></div>`;
    this.steps = [
      ['01', 'SIGN A MESSAGE', 'no gas, no tokens'],
      ['02', 'WE PAY', 'the 10 $CHOG fee and the gas'],
      ['03', 'IT’S ON-CHAIN', 'recorded under your address'],
    ].map(([n, a, b], i) => {
      const e = place(h('div', 'panel', root), 120 + i * 570, 470, 540, 220);
      e.innerHTML = `<div class="tape"></div><div style="padding:24px 28px"><div class="mono hl" style="font-size:24px">${n}</div><div class="disp" style="font-size:40px;margin:8px 0">${a}</div><div class="mono dim" style="font-size:22px">${b}</div></div>`;
      return e;
    });
    this.small = place(h('div', 'mono dim', root, 'one per wallet every 48 hours, while the sponsor wallet is funded'), 120, 740);
    this.small.style.fontSize = '22px';
    h('div', 'vignette', root);
  },
  render(t) {
    show(this.title, t, 0, 99, -40);
    show(this.open, t, 0.3, 6.6, -60);
    this.cursor.style.opacity = Math.floor(t * 2.5) % 2 ? '0' : '1';
    show(this.real, t, 2.6, 6.6, 60);
    // split
    const tk = life(t, 6.75, 15.6);
    set(this.total, tk, `translateY(${(1 - eOut(prog(t, 6.75, 7.1))) * 30}px)`);
    const sp = eInOut(prog(t, 8.35, 9.0));
    let x = 0;
    const gap = 14 * sp;
    for (const s of this.segs) {
      const w = (s.v / 10) * (1600 - 3 * 14 * sp);
      s.s.style.left = x + 'px';
      s.s.style.width = w + 'px';
      s.addr.style.left = x + 'px';
      x += w + gap;
    }
    set(this.bar, life(t, 6.9, 15.6) * 1, '');
    this.segs.forEach((s, i) => {
      s.s.firstChild.style.opacity = String(prog(t, i < 2 ? 10.0 : 10.6, i < 2 ? 10.3 : 10.9));
      s.s.lastChild.style.opacity = String(prog(t, 9.0, 9.4));
      s.addr.style.opacity = String(prog(t, 10.9, 11.3));
      const glow = i < 2 ? Math.max(0, Math.sin((t - 12.9) * 5)) * prog(t, 12.9, 13.2) * (1 - prog(t, 15.0, 15.4)) : 0;
      s.s.style.boxShadow = glow ? `0 0 ${40 * glow}px ${8 * glow}px ${i ? 'rgba(255,79,216,.6)' : 'rgba(79,240,255,.6)'}` : 'none';
    });
    this.bar.style.opacity = String(life(t, 6.9, 15.6));
    show(this.receipt, t, 11.0, 15.6, 0, 16);
    show(this.every, t, 12.95, 15.6, 0, 16);
    show(this.free, t, 15.85, 99, -50);
    this.steps.forEach((e, i) => show(e, t, [17.75, 18.9, 19.9][i], 99, 0, 40));
    show(this.small, t, 20.2, 99, 0, 10);
  },
};

// 1:48 the phone (opaque everywhere except the screen, where the real phone footage sits underneath)
const SCREEN = { x: 380, y: 300, w: 1160, h: 652 };
SCENES.phone = {
  dur: 5.8,
  alpha: true,
  async setup(root) {
    const bg = place(h('div', null, root), 0, 0, 1920, 1080);
    // a frame with a transparent hole: the body's huge outer shadow paints the background
    this.body = place(h('div', null, bg), SCREEN.x - 34, SCREEN.y - 34, SCREEN.w + 68, SCREEN.h + 68);
    this.body.style.cssText += ';border-radius:64px;border:34px solid #1c1a25;box-shadow:0 0 0 2400px #0b0a10, inset 0 0 0 2px #3a3650';
    const notch = place(h('div', null, bg), SCREEN.x - 22, SCREEN.y + SCREEN.h / 2 - 50, 10, 100);
    notch.style.cssText += ';background:#2a2735;border-radius:6px';
    this.title = place(h('div', 'disp', root, 'NO WALLET NEEDED TO PLAY'), 0, 110, 1920);
    this.title.style.cssText += ';font-size:62px;text-align:center';
    this.chips = ['BROWSER', 'LAPTOP', 'PHONE', 'TOUCH CONTROLS'].map((c) => {
      const e = h('div', 'chip', root, c);
      e.style.color = 'var(--hazard)';
      return e;
    });
    const wsum = this.chips.reduce((s, e) => s + e.offsetWidth, 0) + 3 * 18;
    let x = 960 - wsum / 2;
    for (const e of this.chips) { place(e, x, 205); x += e.offsetWidth + 18; }
  },
  render(t) {
    show(this.title, t, 0.15, 99, 0, 20);
    this.chips.forEach((e, i) => show(e, t, 1.75 + i * 0.25, 99, 0, 16));
  },
};

// 1:54 close — the wall, pairs lighting up, SPLICE. BREAK. REPEAT., end card
SCENES.close = {
  dur: 13.6,
  async setup(root) {
    document.body.classList.add('opaque');
    h('div', 'grid-bg', root);
    this.w = await buildWall(root, { seed: 11 });
    const r = rng(5);
    this.pairs = Array.from({ length: 30 }, () => [Math.floor(r() * this.w.tiles.length), Math.floor(r() * this.w.tiles.length)]);
    this.pc = place(h('div', 'panel', root), 660, 470, 600);
    this.pc.innerHTML = `<div class="tape"></div><div style="padding:16px 26px;text-align:center"><div class="disp" style="font-size:84px;line-height:1.05">1,937,496</div><div class="mono dim" style="font-size:24px">EXPERIMENTS WAITING</div></div>`;
    this.words = [['SPLICE.', 'var(--a)'], ['BREAK.', 'var(--hazard)'], ['REPEAT.', 'var(--b)']].map(([w, c], i) => {
      const e = place(h('div', 'disp', root, w), 0, 230 + i * 210, 1920);
      e.style.cssText += `;font-size:190px;text-align:center;color:${c};line-height:1`;
      return e;
    });
    this.end = place(h('div', null, root), 0, 330, 1920);
    this.end.innerHTML = `<div class="logo" style="font-size:150px;text-align:center">CHOG<span>//</span>BREAK</div>
      <div style="font-size:52px;font-weight:800;text-align:center;margin-top:34px">chog-break.vercel.app</div>
      <div class="mono dim" style="font-size:28px;text-align:center;margin-top:16px">github.com/Stella112/chog-break</div>
      <div class="mono" style="font-size:24px;text-align:center;margin-top:70px;letter-spacing:0.2em;color:var(--monad)">CHOG GENESIS × MONAD</div>`;
    this.black = place(h('div', null, root), 0, 0, 1920, 1080);
    this.black.style.background = '#000';
    h('div', 'vignette', root);
  },
  render(t) {
    const { w } = this;
    const scale = lerp(1.28, 1.08, eOut(prog(t, 0, 5.4)));
    wallTransform(w, scale);
    const dark = lerp(1, 0.1, eOut(prog(t, 5.2, 5.7)));
    w.wall.style.opacity = String(dark);
    w.tiles.forEach((tl) => {
      const d = tl.d * 0.9 + tl.j * 0.3;
      const p = prog(t, d, d + 0.35);
      tl.el.style.opacity = String(clamp(p * 3));
      tl.el.style.transform = `scale(${0.6 + 0.4 * eBack(p)})`;
      tl.el.classList.remove('pair-a', 'pair-b');
    });
    if (t >= 3.45 && t < 5.3) {
      const k = Math.floor((t - 3.45) / 0.12);
      for (let j = 0; j < 3; j++) {
        const [a, b] = this.pairs[(k * 3 + j) % this.pairs.length];
        w.tiles[a].el.classList.add('pair-a');
        w.tiles[b].el.classList.add('pair-b');
      }
    }
    set(this.pc, life(t, 3.5, 5.35, 0.25, 0.2), `scale(${lerp(0.9, 1, eOut(prog(t, 3.5, 3.8)))})`);
    const hits = [5.51, 6.62, 7.39];
    const wordsOut = eIn(prog(t, 8.5, 8.9));
    this.words.forEach((e, i) => {
      const p = eOut(prog(t, hits[i], hits[i] + 0.22));
      set(e, p * (1 - wordsOut), `scale(${lerp(1.45, 1, p)}) translateY(${-wordsOut * 40}px)`);
    });
    const ep = eOut(prog(t, 8.8, 9.4));
    set(this.end, ep, `translateY(${(1 - ep) * 30}px)`);
    this.black.style.opacity = String(eIn(prog(t, 12.6, 13.6)));
  },
};

// ---------- boot ----------
(async () => {
  const s = SCENES[params.get('scene')];
  window.__meta = { dur: s.dur, alpha: !!s.alpha };
  await s.setup(stage);
  await preload(stage);
  window.__render = (t) => s.render(t);
  s.render(Number(params.get('t') ?? 0));
  window.__ready = true;
})();
