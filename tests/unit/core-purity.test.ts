import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// §B: src/core must not import React/Phaser/DOM or use Math.random / Date.now.
const dir = 'src/core';
const banned = [/from ['"]react/, /from ['"]phaser/, /Math\.random/, /Date\.now/, /\bwindow\./, /\bdocument\./, /\bfetch\(/, /localStorage/];

describe('core purity', () => {
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
    it(f, () => {
      const src = readFileSync(join(dir, f), 'utf8');
      for (const re of banned) expect(src, `${f} matches ${re}`).not.toMatch(re);
    });
  }
});
