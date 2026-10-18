// §D6 art pipeline: download each token image, remove the flat background, write 256px + 96px webp.
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import type { ChogRecord } from '../src/core/types';
import { removeFlatBackground } from './lib/bgremove';
import { fetchWithFallback, pool } from './lib/net';

const CACHE = '.cache/img';
const OUT = 'public/chogs';
for (const d of [CACHE, OUT, `${OUT}/thumbs`]) mkdirSync(d, { recursive: true });

const records = JSON.parse(readFileSync('public/data/chogs.json', 'utf8')) as ChogRecord[];
type SpriteMeta = { bgRemoved: boolean; opaqueRatio: number; srcWidth: number; srcHeight: number };
const meta: Record<number, SpriteMeta> = {};
const failed: { tokenId: number; error: string }[] = [];
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
let done = 0;

await pool(records, 8, async (r) => {
  try {
    const cacheFile = `${CACHE}/${r.tokenId}.bin`;
    let src: Buffer;
    if (existsSync(cacheFile)) src = readFileSync(cacheFile);
    else {
      src = Buffer.from(await fetchWithFallback(r.image));
      writeFileSync(cacheFile, src);
    }
    const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { out, opaqueRatio } = removeFlatBackground(new Uint8Array(data), info.width, info.height);
    // §D6: keep the original if removal clearly failed; renderer frames it in a specimen jar.
    const bgRemoved = opaqueRatio >= 0.25 && opaqueRatio <= 0.85;
    const base = bgRemoved
      ? sharp(Buffer.from(out), { raw: { width: info.width, height: info.height, channels: 4 } })
      : sharp(src).ensureAlpha();
    const png = await base.png().toBuffer();
    await sharp(png)
      .resize(256, 256, { fit: 'contain', background: transparent })
      .webp({ quality: 82, alphaQuality: 90 })
      .toFile(`${OUT}/${r.tokenId}.webp`);
    await sharp(png)
      .resize(96, 96, { fit: 'contain', background: transparent })
      .webp({ quality: 75 })
      .toFile(`${OUT}/thumbs/${r.tokenId}.webp`);
    meta[r.tokenId] = {
      bgRemoved,
      opaqueRatio: Math.round(opaqueRatio * 1000) / 1000,
      srcWidth: info.width,
      srcHeight: info.height,
    };
    if (++done % 100 === 0) console.log(`  sprites ${done}/${records.length}`);
  } catch (e) {
    failed.push({ tokenId: r.tokenId, error: (e as Error).message.split('\n')[0]! });
  }
});

const sorted = Object.fromEntries(Object.entries(meta).sort((a, b) => Number(a[0]) - Number(b[0])));
writeFileSync('public/data/sprites.json', JSON.stringify(sorted));
const size = (dir: string) =>
  readdirSync(dir)
    .filter((f) => f.endsWith('.webp'))
    .reduce((s, f) => s + statSync(`${dir}/${f}`).size, 0);
const total = size(OUT) + size(`${OUT}/thumbs`);
const removed = Object.values(meta).filter((m) => m.bgRemoved).length;
console.log(
  `sprites: ${done} ok, ${failed.length} failed, bgRemoved ${removed}/${done}, total ${(total / 1e6).toFixed(1)} MB (target < 40 MB)`,
);
for (const f of failed.slice(0, 20)) console.log('  FAIL', f);
process.exitCode = failed.length ? 1 : 0;
