import { describe, expect, it } from 'vitest';
import { applyKO, isOutside, knockback, KNOCKBACK, MATCH, newScore, resolveMatch, respawn } from '../../src/arena/rules';
import { ATTACKS } from '../../src/arena/attacks';
import { TUNING } from '../../src/arena/tuning';

describe('KO handler', () => {
  it('decrements lives exactly once per KO even if called every frame', () => {
    const v = newScore();
    const a = newScore();
    for (let i = 0; i < 30; i++) applyKO(v, a);
    expect(v.lives).toBe(MATCH.lives - 1);
    expect(a.kos).toBe(1);
    respawn(v);
    expect(applyKO(v, a)).toBe(true);
    expect(v.lives).toBe(MATCH.lives - 2);
    expect(applyKO(v, a)).toBe(false);
    expect(v.lives).toBe(0);
  });
  it('respawn resets damage', () => {
    const v = newScore();
    v.damage = 88;
    applyKO(v, null);
    respawn(v);
    expect(v.damage).toBe(0);
  });
});

describe('blast zones', () => {
  it('are 200 px beyond the stage', () => {
    expect(isOutside(-201, 300)).toBe(true);
    expect(isOutside(640, -201)).toBe(true);
    expect(isOutside(640, 921)).toBe(true);
    expect(isOutside(640, 300)).toBe(false);
  });
});

describe('knockback', () => {
  it('grows with damage, shrinks with weight, and is capped', () => {
    const atk = ATTACKS.punch3;
    expect(knockback(atk, 100, 1)).toBeGreaterThan(knockback(atk, 20, 1));
    expect(knockback(atk, 50, 1.3)).toBeLessThan(knockback(atk, 50, 1));
    expect(knockback(atk, 9999, 0.5, 2)).toBe(KNOCKBACK.cap);
  });
  it('no single hit can carry a normal-weight fighter from mid-stage to the blast zone below 60%', () => {
    // During hitstun horizontal speed decays at TUNING.hitstunDrag px/s², so travel = vx² / (2·drag).
    // Mid-stage (x = 640) to the side blast zone (x = 1480) is 840 px.
    const drag = TUNING.hitstunDrag;
    for (const a of Object.values(ATTACKS)) {
      const v = knockback(a, 60, 1, 1);
      const vx = v * Math.cos((a.angleDeg * Math.PI) / 180);
      expect(vx ** 2 / (2 * drag), JSON.stringify(a)).toBeLessThan(840);
    }
  });
});

describe('match resolution', () => {
  it('ends on stocks, then time, then sudden death', () => {
    const a = newScore();
    const b = newScore();
    expect(resolveMatch([a, b], 1000, false)).toEqual({ over: false });
    b.lives = 0;
    expect(resolveMatch([a, b], 1000, false)).toMatchObject({ over: true, winner: 0, reason: 'stocks' });
    b.lives = 2;
    a.damage = 40;
    b.damage = 80;
    expect(resolveMatch([a, b], MATCH.durationMs, false)).toMatchObject({ over: true, winner: 0, reason: 'time' });
    b.damage = 40;
    expect(resolveMatch([a, b], MATCH.durationMs, false)).toEqual({ over: false, suddenDeath: true });
  });
});
