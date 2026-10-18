// §D4.1 Eyes specials (L) and §D4.3 Mouth close moves (I).
import Phaser from 'phaser';
import type { HitSpec } from './ctx';
import type { Fighter } from './fighter';

const proj = (damage: number, base: number, scaling: number, angleDeg: number, hitstunMs = 260): HitSpec => ({
  damage,
  base,
  scaling,
  angleDeg,
  hitstunMs,
  hitstopMs: 40,
  kind: 'projectile',
});

/** A short "move recovery" so specials can't be chained instantly. */
function recoveryAction(f: Fighter, now: number, ms: number, control = 0.4) {
  f.startAction({ until: now + ms, control });
}

export function startSpecial(f: Fighter, now: number) {
  const ctx = f.ctx;
  const k = f.kit;
  ctx.sfx('special');
  switch (k.special) {
    case 'SPIT':
      ctx.spawnProjectile({ owner: f, x: f.x + f.facing * 40, y: f.y - 10, vx: f.facing * 900, vy: 0, gravity: 0, radius: 10, color: 0xc8ff8a, spec: proj(6, 220, 4, 20), lifeMs: 900 });
      recoveryAction(f, now, 220);
      break;

    case 'TEARS':
      for (const [vx, vy] of [[520, -520], [380, -640]] as const) {
        ctx.spawnProjectile({
          owner: f,
          x: f.x + f.facing * 30,
          y: f.y - 30,
          vx: f.facing * vx,
          vy,
          gravity: 1500,
          radius: 9,
          color: 0x7fd4ff,
          shape: 'tear',
          spec: proj(4, 180, 3, 30),
          lifeMs: 2000,
          onLand: (x, y) => ctx.spawnZone({ owner: f, x: x - 50, y: y - 10, w: 100, h: 10, kind: 'puddle', durationMs: 4000, affects: 'opponent' }),
        });
      }
      recoveryAction(f, now, 260);
      break;

    case 'CHAOS_ORB':
      ctx.spawnProjectile({ owner: f, x: f.x + f.facing * 40, y: f.y - 20, vx: f.facing * 520, vy: -260, gravity: 900, radius: 14, color: 0xff4fd8, spec: proj(7, 260, 5, 40, 300), lifeMs: 2600, bounces: 4 });
      recoveryAction(f, now, 260);
      break;

    case 'BLINK': {
      const fromX = f.x;
      const fromY = f.y;
      const dirX = f.facing;
      f.body.reset(Phaser.Math.Clamp(f.x + dirX * 220, -150, 1430), f.y - 10);
      f.body.setVelocity(dirX * 200, Math.min(f.body.velocity.y, 0));
      f.invulnUntil = Math.max(f.invulnUntil, now + 260);
      ctx.fx('ring', fromX, fromY, 0x4ff0ff, 36);
      ctx.fx('ring', f.x, f.y, 0x4ff0ff, 36);
      ctx.sfx('warp');
      recoveryAction(f, now, 120, 1);
      break;
    }

    case 'LEECH': {
      let done = false;
      f.body.setVelocityX(f.facing * 700);
      const spec: HitSpec = { damage: 7, base: 260, scaling: 5, angleDeg: 30, hitstunMs: 300, hitstopMs: 60, kind: 'melee' };
      f.startAction({
        until: now + 260,
        control: 0,
        tick: () => {
          if (done) return;
          const foe = ctx.opponentOf(f);
          const box = new Phaser.Geom.Rectangle(f.x + (f.facing === 1 ? 10 : -80), f.y - 35, 70, 70);
          if (Phaser.Geom.Intersects.RectangleToRectangle(box, foe.hurtbox())) {
            done = true;
            const dealt = ctx.hit(f, foe, spec, f.facing);
            if (dealt > 0) {
              const heal = dealt * 0.25;
              f.score.damage = Math.max(0, f.score.damage - heal);
              ctx.fx('text', f.x, f.y - 80, 0x8aff4f, 18, `+${Math.round(heal)} HEAL`);
              ctx.sfx('heal');
            }
          }
        },
      });
      break;
    }

    case 'RAGE':
      f.rageUntil = now + 4000;
      ctx.fx('ring', f.x, f.y, 0xff4f4f, 60);
      ctx.fx('text', f.x, f.y - 80, 0xff4f4f, 22, 'RAGE');
      recoveryAction(f, now, 150, 1);
      break;

    case 'BEAM': {
      // 0.3 s telegraphed charge, then a horizontal laser.
      const y = f.y - 12;
      const king = k.recipe === 'KING_BEAM';
      const width = king ? 26 * 1.2 : 26;
      const spec: HitSpec = { damage: 9, base: 300, scaling: 6, angleDeg: 15, hitstunMs: 320, hitstopMs: 60, kind: 'beam', pierce: king };
      ctx.charge(f, k.beamColor, 300);
      let fired = false;
      let fired2 = false;
      const laserShow = k.recipe === 'LASER_SHOW';
      f.startAction({
        until: now + 300 + 180 + (laserShow ? 160 : 0),
        control: 0,
        tick: (t) => {
          f.body.setVelocity(0, Math.min(f.body.velocity.y, 60));
          if (t - now >= 300 && !fired) {
            fired = true;
            ctx.beam(f, { y: f.y - 12, color: k.beamColor, width, spec, pierce: king, fireTrail: k.recipe === 'WILDFIRE' });
            ctx.sfx('zap');
          }
          // LASER SHOW: a second beam in the other parent's colour.
          if (laserShow && t - now >= 460 && !fired2) {
            fired2 = true;
            ctx.beam(f, { y: f.y - 12, color: k.beamColor2, width, spec, pierce: false, fireTrail: false });
            ctx.sfx('zap');
          }
        },
      });
      ctx.fx('burst', f.x + f.facing * 40, y, k.beamColor, 6);
      break;
    }
  }
}

export function startClose(f: Fighter, now: number) {
  const ctx = f.ctx;
  ctx.sfx('close');
  switch (f.kit.close) {
    case 'HEADBUTT': {
      let done = false;
      f.body.setVelocityX(f.facing * 260);
      const spec: HitSpec = { damage: 7, base: 280, scaling: 6, angleDeg: 45, hitstunMs: 320, hitstopMs: 60, kind: 'melee' };
      ctx.slash(f, 60, 0xffd400, 60);
      f.startAction({
        until: now + 240,
        control: 0.2,
        tick: (t) => {
          if (done || t - now < 60) return;
          const foe = ctx.opponentOf(f);
          const box = new Phaser.Geom.Rectangle(f.x + (f.facing === 1 ? 10 : -70), f.y - 50, 60, 50);
          if (Phaser.Geom.Intersects.RectangleToRectangle(box, foe.hurtbox())) {
            done = true;
            ctx.hit(f, foe, spec, f.facing);
          }
        },
      });
      break;
    }

    case 'PUKE': {
      // Short rainbow cone, multi-hit: 4 ticks over 0.4 s.
      const hits = new Set<number>();
      const len = f.kit.recipe === 'DOUBLE_RAINBOW' ? 200 : 140;
      const spec: HitSpec = { damage: 1.5, base: 90, scaling: 1.2, angleDeg: 25, hitstunMs: 140, hitstopMs: 20, kind: 'melee' };
      f.startAction({
        until: now + 420,
        control: 0.2,
        tick: (t) => {
          const step = Math.floor((t - now) / 100);
          ctx.fx('burst', f.x + f.facing * (50 + Math.random() * len * 0.7), f.y - 5 + (Math.random() - 0.5) * 40, [0xff4f4f, 0xffd400, 0x59ff6a, 0x4fa3ff, 0xb35cff][step % 5], 2);
          if (hits.has(step)) return;
          const foe = ctx.opponentOf(f);
          const x0 = f.facing === 1 ? f.x + 20 : f.x - 20 - len;
          const box = new Phaser.Geom.Rectangle(x0, f.y - 45, len, 80);
          if (Phaser.Geom.Intersects.RectangleToRectangle(box, foe.hurtbox())) {
            hits.add(step);
            ctx.hit(f, foe, spec, f.facing);
          }
        },
      });
      break;
    }

    case 'DROOL': {
      const gy = ctx.groundAt(f.x, f.y);
      if (gy !== null) ctx.spawnZone({ owner: f, x: f.x - 110, y: gy - 10, w: 220, h: 10, kind: 'puddle', durationMs: 5000, affects: 'opponent' });
      if (f.kit.recipe === 'SHARK_WEEK' && gy !== null) ctx.spawnZone({ owner: f, x: f.x - 110, y: gy - 30, w: 220, h: 30, kind: 'bite', durationMs: 5000, armMs: 300, affects: 'opponent' });
      recoveryAction(f, now, 200);
      break;
    }

    case 'BUBBLE':
      f.bubbleUntil = now + 1200;
      ctx.fx('ring', f.x, f.y, 0xff9fd8, 60);
      recoveryAction(f, now, 120, 1);
      break;

    case 'COIN_TOSS':
      ctx.spawnProjectile({ owner: f, x: f.x + f.facing * 30, y: f.y - 30, vx: f.facing * 520, vy: -450, gravity: 1400, radius: 11, color: 0xffd400, shape: 'coin', spec: proj(7, 240, 5, 50), lifeMs: 1800 });
      recoveryAction(f, now, 220);
      break;

    case 'HONK': {
      const foe = ctx.opponentOf(f);
      ctx.fx('ring', f.x, f.y, 0xffffff, 120);
      ctx.sfx('honk');
      if (Math.hypot(foe.x - f.x, foe.y - f.y) < 130) {
        const extra = f.kit.recipe === 'HONK_LORD' ? 200 : 0;
        ctx.hit(f, foe, { damage: 3, base: 120, scaling: 1, angleDeg: 30, hitstunMs: 0, hitstopMs: 50, kind: 'melee', stunMs: 400 + extra }, (foe.x >= f.x ? 1 : -1) as 1 | -1);
      }
      recoveryAction(f, now, 300, 0);
      break;
    }
  }
}
