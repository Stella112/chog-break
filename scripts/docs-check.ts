// Submission honesty check (§G3a): description length and forbidden overclaims in README/SUBMISSION.
import { readFileSync } from 'node:fs';

const sub = readFileSync('docs/SUBMISSION.md', 'utf8');
const readme = readFileSync('README.md', 'utf8');
const desc = sub.slice(sub.indexOf('## Description') + '## Description'.length, sub.indexOf("## What's new")).trim();
const problems: string[] = [];
if (desc.length > 8000) problems.push(`description is ${desc.length} chars (limit 8,000)`);

// Claims the spec forbids unless they are true in this build.
const forbidden: [RegExp, string][] = [
  [/secure random|provably fair|cryptographically random/i, 'claims secure randomness'],
  [/\bburn(ed|t)?\b(?!\s*gene)(?! aura)(?!:)/i, 'mentions burning tokens'],
  [/(?<!no )online multiplayer|play online now/i, 'claims live online multiplayer'],
  [/fully decentralized|100% on-chain/i, 'claims full decentralization'],
  [/(?<!not grant )copyright|(?<!no )royalt/i, 'claims copyright or royalties'],
];
for (const [re, why] of forbidden) {
  for (const [name, text] of [['README.md', readme], ['SUBMISSION.md', sub]] as const) {
    const m = re.exec(text);
    if (m) problems.push(`${name}: "${m[0]}" (${why})`);
  }
}
console.log(`description: ${desc.length} / 8000 chars`);
if (problems.length) {
  console.log('Review these lines:');
  for (const p of problems) console.log('  -', p);
} else console.log('no flagged claims');
