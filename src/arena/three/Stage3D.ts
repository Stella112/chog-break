// 2.5D arena (approved by Maris, 2026-10-19): three.js renders the lab, the stage and the lighting in 3D
// behind the Phaser canvas. Gameplay stays on the 2D plane (z = 0); the 3D camera copies the Phaser camera
// every frame so the 3D platform tops line up exactly with the physics bodies. All art is drawn in code.
import * as THREE from 'three';
import { STAGE } from '../rules';
import { Fighter3D } from './Fighter3D';

const W = STAGE.width;
const H = STAGE.height;
/** A fairly wide lens: the camera sits close, so platform tops and the room recede with real perspective. */
const FOV = 44;
const TAN = Math.tan(((FOV / 2) * Math.PI) / 180);

/** Logical 2D (x right, y down) → world (X right, Y up), gameplay plane at Z = 0. */
const wx = (x: number) => x - W / 2;
const wy = (y: number) => H / 2 - y;

export type View3DFrame = {
  /** Phaser camera centre (logical px) and zoom. */
  cx: number;
  cy: number;
  zoom: number;
  /** Phaser shake offset in screen px. */
  shakeX: number;
  shakeY: number;
  /** Fighters' feet, for blob shadows. */
  fighters: { x: number; feet: number; visible: boolean }[];
  timeMs: number;
};

export type FloorStyle = 'normal' | 'slippery' | 'bouncy';

function canvasTexture(
  w: number,
  h: number,
  draw: (g: CanvasRenderingContext2D) => void,
  repeat?: [number, number],
) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

const STRIPE: Record<FloorStyle, string> = {
  normal: '#ffd400',
  slippery: '#7fd4ff',
  bouncy: '#ff8fc7',
};
const STRIPE_HEX: Record<FloorStyle, number> = {
  normal: 0xffd400,
  slippery: 0x7fd4ff,
  bouncy: 0xff8fc7,
};

/** Main stage depth (z from +FRONT back to FRONT - MAIN_DEPTH). Fighters stand on the plane z = 0. */
const FRONT = 70;
const MAIN_DEPTH = 420;

export class Stage3D {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FOV, W / H, 10, 8000);
  private main = new THREE.Group();
  private liquids: THREE.MeshStandardMaterial[] = [];
  private beacons: THREE.MeshStandardMaterial[] = [];
  private shadows: THREE.Mesh[] = [];
  private flashes: { light: THREE.PointLight; until: number; peak: number }[] = [];
  private disposables: { dispose(): void }[] = [];
  private edges = { left: STAGE.mainLeft, right: STAGE.mainRight };
  private nowMs = 0;

  constructor(floor: FloorStyle = 'normal') {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'arena-3d';
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(W, H, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.scene.background = new THREE.Color(0x0b0914);
    this.scene.fog = new THREE.Fog(0x0b0914, 1400, 3400);
    this.buildRoom();
    this.buildStage(floor);
    this.buildLights();
  }

  private track<T extends { dispose(): void }>(x: T): T {
    this.disposables.push(x);
    return x;
  }

  private mesh(
    geo: THREE.BufferGeometry,
    mat: THREE.Material | THREE.Material[],
    parent: THREE.Object3D = this.scene,
  ) {
    this.track(geo);
    for (const m of Array.isArray(mat) ? mat : [mat]) this.track(m);
    const m = new THREE.Mesh(geo, mat);
    parent.add(m);
    return m;
  }

  private glow(color: number, intensity = 1.6) {
    return new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: color,
      emissiveIntensity: intensity,
    });
  }

  private buildRoom() {
    // Back wall: lab panels with a faint grid.
    const wallTex = this.track(
      canvasTexture(
        256,
        256,
        (g) => {
          g.fillStyle = '#151126';
          g.fillRect(0, 0, 256, 256);
          g.strokeStyle = '#2c2648';
          g.lineWidth = 3;
          g.strokeRect(2, 2, 252, 252);
          g.strokeStyle = 'rgba(79,240,255,0.12)';
          g.lineWidth = 1;
          for (let i = 32; i < 256; i += 32) {
            g.beginPath();
            g.moveTo(i, 0);
            g.lineTo(i, 256);
            g.moveTo(0, i);
            g.lineTo(256, i);
            g.stroke();
          }
          g.fillStyle = '#0f0c1c';
          for (const [x, y] of [
            [14, 14],
            [234, 14],
            [14, 234],
            [234, 234],
          ])
            g.fillRect(x!, y!, 8, 8);
        },
        [16, 9],
      ),
    );
    const wall = this.mesh(
      new THREE.PlaneGeometry(4800, 2700),
      new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.85, metalness: 0.2 }),
    );
    wall.position.set(0, 150, -900);

    // Lab floor far below the stage, with a glowing grid that recedes into the dark.
    const floorTex = this.track(
      canvasTexture(
        128,
        128,
        (g) => {
          g.fillStyle = '#0c0a16';
          g.fillRect(0, 0, 128, 128);
          g.strokeStyle = 'rgba(180,140,255,0.55)';
          g.lineWidth = 3;
          g.strokeRect(0, 0, 128, 128);
        },
        [34, 16],
      ),
    );
    const floorY = wy(860);
    const floor = this.mesh(
      new THREE.PlaneGeometry(4800, 2000),
      new THREE.MeshStandardMaterial({
        map: floorTex,
        roughness: 0.6,
        metalness: 0.3,
        emissive: 0x231640,
        emissiveIntensity: 0.7,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, floorY, -100);

    // Structural columns between the wall and the stage, each with a light strip.
    const colMat = new THREE.MeshStandardMaterial({
      color: 0x2a2440,
      roughness: 0.55,
      metalness: 0.6,
    });
    for (const [x, z, c] of [
      [-1120, -760, 0x4ff0ff],
      [-600, -820, 0xff4fd8],
      [600, -820, 0x4ff0ff],
      [1120, -760, 0xff4fd8],
    ] as const) {
      const col = this.mesh(new THREE.BoxGeometry(70, 1800, 70), colMat);
      col.position.set(x, floorY + 900, z);
      const strip = this.mesh(new THREE.BoxGeometry(6, 1500, 6), this.glow(c, 1.8));
      strip.position.set(x, floorY + 900, z + 38);
    }
    // Ceiling girder with warning beacons.
    const girder = this.mesh(new THREE.BoxGeometry(3000, 50, 90), colMat);
    girder.position.set(0, wy(-120), -500);
    for (const x of [-900, -300, 300, 900]) {
      const m = this.glow(0xff3b3b, 1);
      this.beacons.push(m);
      const b = this.mesh(new THREE.SphereGeometry(14, 16, 12), m);
      b.position.set(x, wy(-120) - 34, -470);
    }

    // Specimen tanks standing on the lab floor (the 2D arena's tanks, now glass cylinders with glowing liquid).
    for (const [x, h, z] of [
      [-30, 760, -560],
      [1310, 820, -560],
      [120, 560, -380],
      [1160, 600, -380],
    ] as const) {
      const liquid = new THREE.MeshStandardMaterial({
        color: 0x0a2428,
        emissive: 0x1aa8a8,
        emissiveIntensity: 0.5,
        roughness: 0.3,
      });
      this.liquids.push(liquid);
      const l = this.mesh(new THREE.CylinderGeometry(42, 42, h * 0.78, 28), liquid);
      l.position.set(wx(x), floorY + h * 0.39, z);
      const glass = this.mesh(
        new THREE.CylinderGeometry(50, 50, h, 28, 1, true),
        new THREE.MeshStandardMaterial({
          color: 0xbfe8f2,
          transparent: true,
          opacity: 0.14,
          roughness: 0.05,
          metalness: 0.2,
          side: THREE.DoubleSide,
        }),
      );
      glass.position.set(wx(x), floorY + h / 2, z);
      const cap = this.mesh(
        new THREE.CylinderGeometry(58, 58, 26, 28),
        new THREE.MeshStandardMaterial({ color: 0x8a8fa8, metalness: 0.85, roughness: 0.3 }),
      );
      cap.position.set(wx(x), floorY + h + 13, z);
      const ring = this.mesh(new THREE.TorusGeometry(52, 3, 8, 32), this.glow(0x4ff0ff, 1.4));
      ring.rotation.x = Math.PI / 2;
      ring.position.set(wx(x), floorY + h - 4, z);
    }
  }

  private buildStage(floor: FloorStyle) {
    const mainW = STAGE.mainRight - STAGE.mainLeft;
    const topTex = this.track(
      canvasTexture(512, 256, (g) => {
        g.fillStyle = '#2d2742';
        g.fillRect(0, 0, 512, 256);
        g.strokeStyle = '#41395c';
        g.lineWidth = 3;
        for (let x = 0; x <= 512; x += 64) {
          g.beginPath();
          g.moveTo(x, 0);
          g.lineTo(x, 256);
          g.stroke();
        }
        for (let y = 0; y <= 256; y += 64) {
          g.beginPath();
          g.moveTo(0, y);
          g.lineTo(512, y);
          g.stroke();
        }
        // front hazard strip (the edge nearest the camera is the bottom of this texture)
        g.fillStyle = '#111';
        g.fillRect(0, 226, 512, 30);
        g.fillStyle = STRIPE[floor];
        for (let x = -30; x < 512; x += 36) {
          g.beginPath();
          g.moveTo(x, 256);
          g.lineTo(x + 18, 256);
          g.lineTo(x + 48, 226);
          g.lineTo(x + 30, 226);
          g.fill();
        }
      }),
    );
    const sideTex = this.track(
      canvasTexture(512, 64, (g) => {
        g.fillStyle = '#2a2438';
        g.fillRect(0, 0, 512, 64);
        g.fillStyle = '#3d3552';
        g.fillRect(0, 0, 512, 8);
        g.fillStyle = '#5a5170';
        for (let x = 16; x < 512; x += 48) g.fillRect(x, 28, 7, 7);
      }),
    );
    const top = new THREE.MeshStandardMaterial({
      map: topTex,
      roughness: floor === 'slippery' ? 0.12 : 0.55,
      metalness: floor === 'slippery' ? 0.7 : 0.35,
    });
    const side = new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.5, metalness: 0.55 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x15111f, roughness: 0.9 });
    // BoxGeometry face order: +x, -x, +y (top), -y, +z (front), -z
    const slab = this.mesh(
      new THREE.BoxGeometry(mainW, 80, MAIN_DEPTH),
      [side, side, top, dark, side, dark],
      this.main,
    );
    slab.position.set(0, 0, FRONT - MAIN_DEPTH / 2);
    // Glowing edges: the front lip in the floor colour, a cyan line along the bottom.
    const lip = this.mesh(
      new THREE.BoxGeometry(mainW, 4, 4),
      this.glow(STRIPE_HEX[floor], 1.2),
      this.main,
    );
    lip.position.set(0, 40, FRONT + 1);
    const under = this.mesh(
      new THREE.BoxGeometry(mainW, 3, 3),
      this.glow(0x4ff0ff, 1.8),
      this.main,
    );
    under.position.set(0, -40, FRONT + 1);
    // Under-structure: a narrower rig with a reactor glow, so the stage reads as floating machinery.
    const rig = this.mesh(
      new THREE.BoxGeometry(mainW - 160, 220, MAIN_DEPTH - 120),
      new THREE.MeshStandardMaterial({ color: 0x1b1728, roughness: 0.7, metalness: 0.5 }),
      this.main,
    );
    rig.position.set(0, -150, FRONT - MAIN_DEPTH / 2 - 20);
    const core = this.mesh(
      new THREE.CylinderGeometry(70, 40, 60, 24),
      this.glow(0xb48cff, 1.3),
      this.main,
    );
    core.position.set(0, -290, FRONT - MAIN_DEPTH / 2);
    this.main.position.set(wx(STAGE.mainLeft + mainW / 2), wy(STAGE.mainY + 40), 0);
    this.scene.add(this.main);

    for (const [x, y, w] of STAGE.floats) {
      const plat = this.mesh(
        new THREE.BoxGeometry(w, 14, 170),
        new THREE.MeshStandardMaterial({ color: 0x4a4260, roughness: 0.45, metalness: 0.55 }),
      );
      plat.position.set(wx(x + w / 2), wy(y + 7), -25);
      const strip = this.mesh(new THREE.BoxGeometry(w, 3, 3), this.glow(0x4ff0ff, 2));
      strip.position.set(wx(x + w / 2), wy(y + 1), 61);
      // Thin hanger rods up into the dark: they float, but they're clearly part of the rig.
      for (const dx of [-w / 2 + 12, w / 2 - 12]) {
        const rod = this.mesh(
          new THREE.CylinderGeometry(2, 2, 900, 6),
          new THREE.MeshStandardMaterial({ color: 0x3a3346, metalness: 0.8, roughness: 0.4 }),
        );
        rod.position.set(wx(x + w / 2) + dx, wy(y) + 450, -80);
      }
    }

    const shadowTex = this.track(
      canvasTexture(64, 64, (g) => {
        const r = g.createRadialGradient(32, 32, 2, 32, 32, 32);
        r.addColorStop(0, 'rgba(0,0,0,0.8)');
        r.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = r;
        g.fillRect(0, 0, 64, 64);
      }),
    );
    for (let i = 0; i < 2; i++) {
      const s = this.mesh(
        new THREE.PlaneGeometry(120, 70),
        new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
      );
      s.rotation.x = -Math.PI / 2;
      s.renderOrder = 2;
      this.shadows.push(s);
    }
  }

  private buildLights() {
    this.scene.add(new THREE.AmbientLight(0x8070b0, 0.9));
    this.scene.add(new THREE.HemisphereLight(0xb8a8ff, 0x140f22, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(-400, 900, 1100);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x9fe8ff, 0.9);
    fill.position.set(600, 200, 900);
    this.scene.add(fill);
    const teal = new THREE.PointLight(0x4ff0ff, 4, 1800, 1.1);
    teal.position.set(-760, 80, -300);
    const pink = new THREE.PointLight(0xff4fd8, 4, 1800, 1.1);
    pink.position.set(760, 80, -300);
    const under = new THREE.PointLight(0xb48cff, 3, 900, 1.3);
    under.position.set(0, wy(STAGE.mainY + 300), -100);
    this.scene.add(teal, pink, under);
    for (let i = 0; i < 3; i++) {
      const light = new THREE.PointLight(0xffffff, 0, 800, 1.3);
      light.position.z = 160;
      this.scene.add(light);
      this.flashes.push({ light, until: 0, peak: 0 });
    }
  }

  /** A 3D fighter rig living in this scene (disposed with the stage). */
  createFighter(headKey: string, headCanvas: HTMLCanvasElement, bodyColor: number, playerColor: number): Fighter3D {
    const f = new Fighter3D(headKey, headCanvas, bodyColor, playerColor);
    this.scene.add(f.root);
    this.disposables.push(f);
    return f;
  }

  /** Main platform edges (SHRINKING STAGE). */
  setEdges(left: number, right: number) {
    this.edges = { left, right };
    const w = Math.max(1, right - left);
    this.main.scale.x = w / (STAGE.mainRight - STAGE.mainLeft);
    this.main.position.x = wx((left + right) / 2);
  }

  /** Short coloured light at a hit (logical coords). */
  flash(x: number, y: number, color: number, strength = 1) {
    const slot = this.flashes.reduce((a, b) => (a.until < b.until ? a : b));
    slot.light.color.setHex(color);
    slot.light.position.set(wx(x), wy(y), 160);
    slot.peak = 8 * strength;
    slot.until = this.nowMs + 220;
  }

  private topBelow(x: number, feet: number): number | null {
    let best: number | null = null;
    const consider = (top: number) => {
      if (top >= feet - 6 && (best === null || top < best)) best = top;
    };
    if (x >= this.edges.left && x <= this.edges.right) consider(STAGE.mainY);
    for (const [fx, fy, fw] of STAGE.floats) if (x >= fx && x <= fx + fw) consider(fy);
    return best;
  }

  render(f: View3DFrame) {
    this.nowMs = f.timeMs;
    const zoom = Math.max(0.2, f.zoom);
    const dist = H / zoom / 2 / TAN;
    const camX = wx(f.cx) - f.shakeX / zoom;
    const camY = wy(f.cy) + f.shakeY / zoom;
    this.camera.position.set(camX, camY, dist);
    this.camera.lookAt(camX, camY, 0);

    f.fighters.forEach((p, i) => {
      const s = this.shadows[i];
      if (!s) return;
      const top = p.visible ? this.topBelow(p.x, p.feet) : null;
      s.visible = top !== null;
      if (top === null) return;
      const lift = Math.min(1, Math.max(0, (top - p.feet) / 360));
      s.position.set(wx(p.x), wy(top) + 0.6, top === STAGE.mainY ? 12 : 0);
      s.scale.setScalar(1 - lift * 0.6);
      (s.material as THREE.MeshBasicMaterial).opacity = 1 - lift * 0.7;
    });

    for (const fl of this.flashes) {
      const left = fl.until - f.timeMs;
      fl.light.intensity = left > 0 ? fl.peak * (left / 220) : 0;
    }
    const pulse = 0.45 + 0.15 * Math.sin(f.timeMs / 600);
    for (const l of this.liquids) l.emissiveIntensity = pulse;
    const blink = Math.sin(f.timeMs / 300) > 0.4 ? 2.2 : 0.3;
    for (const b of this.beacons) b.emissiveIntensity = blink;

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    for (const d of this.disposables) d.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }
}

/** Builds the 3D stage, or returns null (→ 2D arena) when WebGL isn't available. */
export function createStage3D(floor: FloorStyle): Stage3D | null {
  try {
    return new Stage3D(floor);
  } catch {
    return null;
  }
}
