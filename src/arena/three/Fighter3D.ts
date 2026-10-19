// 3D fighter (2.5D arena): the same rig as the 2D FighterRig, built from three.js meshes. The mutant's
// portrait is the face of a coin-shaped head; body, legs and floating fists are lit 3D shapes with
// inverted-hull outlines for a cartoon look. Purely visual: physics stays on the invisible Phaser sprite.
import * as THREE from 'three';
import { RIG_SCALE, type Rig, type RigPose } from '../rig';
import { STAGE } from '../rules';

const OUTLINE = 0x0b0a10;
/** Three-quarter view: the character turns this far toward the camera. */
const YAW = 0.42;

const wx = (x: number) => x - STAGE.width / 2;
const wy = (y: number) => STAGE.height / 2 - y;

function shade(color: number, f: number) {
  const c = new THREE.Color(color);
  return new THREE.Color(Math.min(1, c.r * f), Math.min(1, c.g * f), Math.min(1, c.b * f));
}

export class Fighter3D implements Rig {
  readonly root = new THREE.Group();
  private body = new THREE.Group();
  private head = new THREE.Group();
  private legs: THREE.Group[] = [];
  private fists: THREE.Mesh[] = [];
  private mats: THREE.MeshStandardMaterial[] = [];
  private outlineMats: THREE.MeshBasicMaterial[] = [];
  private bodyMat: THREE.MeshStandardMaterial;
  private fistMat: THREE.MeshStandardMaterial;
  private faceMat: THREE.MeshBasicMaterial;
  private disposables: { dispose(): void }[] = [];
  private runPhase = 0;
  private sx = 1;
  private sy = 1;
  private spin = 0;
  private flashUntil = 0;
  private flashMs = 0;
  private flashColor = 0xffffff;
  private lastNow = 0;
  private tint: number | null = null;
  private alpha = 1;
  private shown = true;

  constructor(
    readonly headKey: string,
    headCanvas: HTMLCanvasElement,
    bodyColor: number,
    playerColor: number,
  ) {
    this.bodyMat = this.mat({ color: bodyColor, roughness: 0.45, metalness: 0.05 });
    this.fistMat = this.mat({ color: shade(bodyColor, 1.15).getHex(), roughness: 0.4 });
    const legMat = this.mat({ color: shade(bodyColor, 0.55).getHex(), roughness: 0.6 });
    const footMat = this.mat({ color: OUTLINE, roughness: 0.7 });
    const beltMat = this.mat({ color: playerColor, emissive: playerColor, emissiveIntensity: 0.35, roughness: 0.4 });

    // torso: a squashed sphere with an outline hull and a player-colour belt
    const torsoGeo = this.track(new THREE.SphereGeometry(1, 28, 20));
    const torso = new THREE.Mesh(torsoGeo, this.bodyMat);
    torso.scale.set(22, 16, 17);
    this.body.add(torso, this.hull(torsoGeo, [24.5, 18.5, 19.5]));
    const belt = new THREE.Mesh(this.track(new THREE.TorusGeometry(1, 0.12, 8, 32)), beltMat);
    belt.rotation.x = Math.PI / 2;
    belt.scale.set(20.5, 16.5, 20);
    belt.position.y = -6;
    this.body.add(belt);
    this.root.add(this.body);

    // legs: pivots at the hips, a capsule hanging down, a dark shoe
    for (const hx of [-9, 9]) {
      const pivot = new THREE.Group();
      pivot.position.set(hx, 24, hx < 0 ? -4 : 4);
      const leg = new THREE.Mesh(this.track(new THREE.CapsuleGeometry(3.6, 15, 4, 10)), legMat);
      leg.position.y = -11;
      const shoe = new THREE.Mesh(this.track(new THREE.SphereGeometry(1, 16, 10)), footMat);
      shoe.scale.set(8, 4.5, 6);
      shoe.position.set(3, -22, 0);
      pivot.add(leg, shoe);
      this.legs.push(pivot);
      this.root.add(pivot);
    }

    // floating fists (back one sits behind the body)
    for (const z of [-12, 12]) {
      const g = this.track(new THREE.SphereGeometry(7.5, 18, 12));
      const fist = new THREE.Mesh(g, this.fistMat);
      fist.add(this.hull(g, [1.32, 1.32, 1.32]));
      fist.position.z = z;
      this.fists.push(fist);
      this.root.add(fist);
    }

    // head: a thick coin with the portrait on its face, a dark rim and an outline
    const tex = this.track(new THREE.CanvasTexture(headCanvas));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    // the NFT art is shown unlit and without tone mapping, so its colours stay true
    this.faceMat = this.track(new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }));
    const rimMat = this.mat({ color: 0x1d1a28, roughness: 0.5, metalness: 0.3 });
    const ringMat = this.mat({ color: playerColor, emissive: playerColor, emissiveIntensity: 0.5 });
    const coinGeo = this.track(new THREE.CylinderGeometry(39, 39, 16, 48));
    // CylinderGeometry groups: 0 side, 1 top cap, 2 bottom cap. Rotated so the top cap faces the camera (+z).
    const coin = new THREE.Mesh(coinGeo, rimMat);
    coin.rotation.x = Math.PI / 2;
    const face = new THREE.Mesh(this.track(new THREE.CircleGeometry(38, 48)), this.faceMat);
    face.position.z = 8.3;
    const ring = new THREE.Mesh(this.track(new THREE.TorusGeometry(39, 2.2, 8, 48)), ringMat);
    ring.position.z = 8;
    const back = new THREE.Mesh(this.track(new THREE.SphereGeometry(37, 28, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), rimMat);
    back.rotation.x = Math.PI / 2;
    back.scale.set(1, 1, 0.55);
    back.position.z = -8;
    const outline = this.hull(coinGeo, [1.06, 1.06, 1.06]);
    outline.rotation.x = Math.PI / 2;
    this.head.add(coin, face, ring, back, outline);
    this.root.add(this.head);

    this.root.rotation.y = YAW;
  }

  private track<T extends { dispose(): void }>(x: T): T {
    this.disposables.push(x);
    return x;
  }

  private mat(p: THREE.MeshStandardMaterialParameters) {
    const m = this.track(new THREE.MeshStandardMaterial({ transparent: true, ...p }));
    m.userData.base = (p.color !== undefined ? new THREE.Color(p.color as THREE.ColorRepresentation) : new THREE.Color(0xffffff)).getHex();
    m.userData.emissive = m.emissive.getHex();
    m.userData.emissiveIntensity = m.emissiveIntensity;
    this.mats.push(m);
    return m;
  }

  /** Inverted-hull outline: a slightly bigger black copy rendered from the inside. */
  private hull(geo: THREE.BufferGeometry, scale: [number, number, number]) {
    const m = this.track(new THREE.MeshBasicMaterial({ color: OUTLINE, side: THREE.BackSide, transparent: true }));
    this.outlineMats.push(m);
    const h = new THREE.Mesh(geo, m);
    h.scale.set(...scale);
    return h;
  }

  squash(sx: number, sy: number) {
    this.sx = sx;
    this.sy = sy;
  }

  flash(color: number, ms: number) {
    this.flashColor = color;
    this.flashMs = ms;
    this.flashUntil = this.lastNow + ms;
  }

  setTint(color: number | null) {
    this.tint = color;
  }

  setVisible(v: boolean) {
    this.shown = v;
    this.root.visible = v;
  }

  setAlpha(a: number) {
    this.alpha = a;
  }

  update(x: number, feetY: number, p: RigPose, now: number, dt: number) {
    // a flash requested before the first update starts now
    if (this.flashMs && this.flashUntil < now - this.flashMs) this.flashUntil = now + this.flashMs;
    this.flashMs = 0;
    this.lastNow = now;
    this.root.visible = this.shown;
    const s = dt / 1000;
    const flashing = now < this.flashUntil;

    this.sx += (1 - this.sx) * Math.min(1, s * 12);
    this.sy += (1 - this.sy) * Math.min(1, s * 12);
    let sx = this.sx;
    let sy = this.sy;
    if (p.state === 'dash') {
      sx *= 1.25;
      sy *= 0.85;
    }

    const speed = Math.min(1, Math.abs(p.vx) / p.runSpeed);
    if (p.grounded) this.runPhase += Math.abs(p.vx) * s * 0.045;
    const bob = p.grounded ? (speed > 0.1 ? Math.abs(Math.sin(this.runPhase)) * 4 : Math.sin(now / 320) * 1.5) : 0;
    if (p.state === 'hitstun' && Math.hypot(p.vx, p.vy) > 900) this.spin += p.facing * s * 14;
    else this.spin *= Math.max(0, 1 - s * 10);
    const lean = p.state === 'hitstun' ? Math.max(-0.5, Math.min(0.5, p.vx * 0.0006)) : (p.vx / p.runSpeed) * 0.14;

    const k = p.sizeMul * RIG_SCALE;
    this.root.position.set(wx(x), wy(feetY), 0);
    this.root.scale.set(p.facing * sx * k, sy * k, k);
    // 2D rotation is clockwise with y down; in 3D (y up) the same lean is a negative z rotation.
    this.root.rotation.set(0, YAW, -(lean + this.spin) * p.facing, 'YXZ');

    // legs
    let la: number;
    let lb: number;
    if (!p.grounded) {
      const tuck = p.vy < 0 ? 0.6 : -0.35;
      la = tuck;
      lb = -tuck * 0.6;
    } else if (speed > 0.1) {
      la = Math.sin(this.runPhase) * 0.8 * speed;
      lb = -la;
    } else {
      la = 0.08;
      lb = -0.08;
    }
    const hipY = 24 + bob;
    this.legs[0]!.position.y = hipY;
    this.legs[1]!.position.y = hipY;
    this.legs[0]!.rotation.z = la;
    this.legs[1]!.rotation.z = lb;

    // body
    const breathe = p.grounded && speed < 0.1 ? Math.sin(now / 320) * 0.05 : 0;
    this.body.position.y = 40 + bob;
    this.body.scale.set(1, 1 + breathe, 1);

    // fists (2D rig coordinates: x forward, y down from the feet)
    const shoulderY = -40 - bob - 4;
    let front = { x: 22, y: shoulderY + 8 };
    let back = { x: -20, y: shoulderY + 10 };
    if (p.blocking) {
      front = { x: 20, y: shoulderY - 18 };
      back = { x: 14, y: shoulderY - 6 };
    } else if (p.punch >= 0) {
      const ext = Math.sin(Math.min(1, p.punch) * Math.PI);
      const hit = p.punchStep === 3 ? { x: 22 + ext * 34, y: shoulderY + 6 - ext * 40 } : { x: 22 + ext * 46, y: shoulderY + 2 };
      if (p.punchStep === 2) back = hit;
      else front = hit;
    } else if (p.grounded && speed > 0.1) {
      front.x += Math.sin(this.runPhase) * 8 * speed;
      back.x -= Math.sin(this.runPhase) * 8 * speed;
    } else if (!p.grounded) {
      front.y -= 10;
      back.y -= 14;
    }
    this.fists[0]!.position.set(back.x, -back.y, -12);
    this.fists[1]!.position.set(front.x, -front.y, 12);

    // head
    const headBob = p.state === 'hitstun' ? Math.sin(now / 35) * 0.25 : p.state === 'action' ? -0.12 : 0;
    this.head.position.set(p.state === 'action' ? 6 : 0, 82 + bob, 4);
    this.head.rotation.z = -headBob;

    // colour: hit flash > state tint > base colour; alpha for respawn blink / smoke
    for (const m of this.mats) {
      if (flashing) {
        m.emissive.setHex(this.flashColor);
        m.emissiveIntensity = 0.9;
      } else if (m.userData.flashed) {
        m.emissive.setHex(m.userData.emissive);
        m.emissiveIntensity = m.userData.emissiveIntensity;
      }
      m.userData.flashed = flashing;
      if (m === this.bodyMat || m === this.fistMat) m.color.setHex(this.tint ?? m.userData.base);
      m.opacity = this.alpha;
    }
    for (const m of this.outlineMats) m.opacity = this.alpha;
    this.faceMat.color.setHex(flashing ? this.flashColor : (this.tint ?? 0xffffff));
    this.faceMat.opacity = this.alpha;
  }

  dispose() {
    this.root.removeFromParent();
    for (const d of this.disposables) d.dispose();
  }

  destroy() {
    this.dispose();
  }
}
