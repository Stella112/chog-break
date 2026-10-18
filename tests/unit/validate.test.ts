import { describe, expect, it } from 'vitest';
import { validateManifest } from '../../scripts/lib/validate';

describe('validateManifest', () => {
  it('reports a wrong-size manifest (STOP 6 guard)', () => {
    const problems = validateManifest([]);
    expect(problems.some((p) => p.includes('expected 1969 records'))).toBe(true);
  });
});
