import * as THREE from 'three';
import type { ThemeDef } from '../core/catalog';
import { algaeTexture, backdropMaterial, shared, std, withCaustics } from './materials';

export const TANK_HEIGHT = 4.4;
export const WATER_Y = 4.05;
const BASE_WIDTH = 8;
const BASE_DEPTH = 3.8;
const MURK = new THREE.Color('#5a6a2c');

function valueNoise(x: number, z: number): number {
  return (
    Math.sin(x * 1.7 + Math.cos(z * 1.3)) * 0.5 +
    Math.sin(z * 2.3 + x * 0.6) * 0.3 +
    Math.sin((x + z) * 4.1) * 0.12 +
    Math.cos(x * 7.3 - z * 5.1) * 0.05
  );
}

export interface TankEnv {
  light: number; // 0 night .. 1 day
  murk: number; // 0 clean .. 1 filthy
  clean: number; // 0..1 cleaning wipe animation
}

/** Glass tank, water, sand, backdrop and stand. Rebuilt when the tank is upgraded. */
export class Tank {
  readonly group = new THREE.Group();
  width = BASE_WIDTH;
  depth = BASE_DEPTH;
  readonly height = TANK_HEIGHT;
  readonly waterY = WATER_Y;
  sand!: THREE.Mesh;
  surface!: THREE.Mesh;
  private built = new THREE.Group();
  private backdropMat = backdropMaterial();
  private sandMat = withCaustics(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), 0.45);
  private surfaceMat = new THREE.MeshStandardMaterial({
    color: '#cfefff',
    transparent: true,
    opacity: 0.38,
    roughness: 0.08,
    metalness: 0.2,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  private tintMat = new THREE.MeshBasicMaterial({ color: '#3fa7c9', transparent: true, opacity: 0.08, depthWrite: false, fog: false });
  private algaeMat = new THREE.MeshBasicMaterial({ color: '#4f6b1f', transparent: true, opacity: 0, depthWrite: false, fog: false, alphaMap: algaeTexture() });
  private lampMat = new THREE.MeshStandardMaterial({ color: '#16141f', emissive: '#fff4d6', emissiveIntensity: 1, roughness: 0.4, fog: false });
  private theme!: ThemeDef;
  private sandBase = new THREE.Color('#e2cf9f');
  private surfaceBase!: Float32Array;

  constructor() {
    this.group.add(this.built);
  }

  get innerW() {
    return this.width - 0.2;
  }
  get innerD() {
    return this.depth - 0.2;
  }

  sandHeight(x: number, z: number): number {
    const back = (-z / this.depth + 0.5) * 0.35; // sand slopes up towards the back
    return 0.28 + back + valueNoise(x * 0.8, z * 0.8) * 0.07;
  }

  /** Normalised floor coordinates ([-0.5, 0.5]) to a world point on the sand. */
  toWorld(nx: number, nz: number, out = new THREE.Vector3()): THREE.Vector3 {
    const x = nx * this.innerW;
    const z = nz * this.innerD;
    return out.set(x, this.sandHeight(x, z), z);
  }

  toNorm(x: number, z: number): { x: number; z: number } {
    return { x: x / this.innerW, z: z / this.innerD };
  }

  /** Box fish can swim in. */
  swimBox(margin = 0.35): THREE.Box3 {
    return new THREE.Box3(
      new THREE.Vector3(-this.innerW / 2 + margin, 0.75, -this.innerD / 2 + margin),
      new THREE.Vector3(this.innerW / 2 - margin, this.waterY - 0.3, this.innerD / 2 - margin),
    );
  }

  build(widthScale: number): void {
    this.width = BASE_WIDTH * widthScale;
    this.depth = BASE_DEPTH * (1 + (widthScale - 1) * 0.4);
    this.built.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    this.group.remove(this.built);
    this.built = new THREE.Group();
    this.group.add(this.built);
    const W = this.width;
    const D = this.depth;
    const H = this.height;
    const iw = this.innerW;
    const id = this.innerD;

    // Sand
    const sandGeo = new THREE.PlaneGeometry(iw, id, Math.round(iw * 12), Math.round(id * 12));
    sandGeo.rotateX(-Math.PI / 2);
    const pos = sandGeo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, this.sandHeight(x, z));
    }
    sandGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    sandGeo.computeVertexNormals();
    this.sand = new THREE.Mesh(sandGeo, this.sandMat);
    this.sand.name = 'sand';
    this.built.add(this.sand);
    // Sand "skirt" visible through the front glass
    const skirtGeo = new THREE.PlaneGeometry(iw, 1, Math.round(iw * 12), 1);
    const sp = skirtGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < sp.count; i++) {
      const x = sp.getX(i);
      sp.setY(i, sp.getY(i) > 0 ? this.sandHeight(x, id / 2) : 0);
    }
    const skirt = new THREE.Mesh(skirtGeo, std('#b39b6c', { roughness: 1 }));
    skirt.position.z = id / 2 - 0.001;
    skirt.userData.skirt = true;
    this.built.add(skirt);

    // Backdrop
    const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(iw, H), this.backdropMat);
    backdrop.position.set(0, H / 2, -id / 2 + 0.01);
    this.built.add(backdrop);

    // Water volume tint + surface
    const tint = new THREE.Mesh(new THREE.BoxGeometry(iw - 0.02, this.waterY, id - 0.02), this.tintMat);
    tint.position.y = this.waterY / 2;
    tint.renderOrder = 10;
    this.built.add(tint);

    const surfGeo = new THREE.PlaneGeometry(iw, id, 48, 24);
    surfGeo.rotateX(-Math.PI / 2);
    this.surfaceBase = Float32Array.from((surfGeo.attributes.position as THREE.BufferAttribute).array as Float32Array);
    this.surface = new THREE.Mesh(surfGeo, this.surfaceMat);
    this.surface.position.y = this.waterY;
    this.surface.renderOrder = 11;
    this.built.add(this.surface);

    // Glass panes
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: '#d8f4ff',
      transparent: true,
      opacity: 0.07,
      roughness: 0.04,
      metalness: 0,
      clearcoat: 0.3,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    });
    const edgeMat = new THREE.MeshStandardMaterial({ color: '#9fe7d8', transparent: true, opacity: 0.35, roughness: 0.1, fog: false, depthWrite: false });
    const panes: [number, number, number, number, number][] = [
      // w, h, x, z, rotY
      [W, H, 0, D / 2, 0],
      [W, H, 0, -D / 2, 0],
      [D, H, W / 2, 0, Math.PI / 2],
      [D, H, -W / 2, 0, Math.PI / 2],
    ];
    for (const [w, h, x, z, r] of panes) {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glassMat);
      pane.position.set(x, h / 2, z);
      pane.rotation.y = r;
      pane.renderOrder = 20;
      this.built.add(pane);
    }
    // Algae on the inside of front + sides
    const algaeFront = new THREE.Mesh(new THREE.PlaneGeometry(iw, this.waterY), this.algaeMat);
    algaeFront.position.set(0, this.waterY / 2, id / 2 - 0.02);
    algaeFront.renderOrder = 15;
    this.built.add(algaeFront);
    for (const side of [-1, 1]) {
      const a = new THREE.Mesh(new THREE.PlaneGeometry(id, this.waterY), this.algaeMat);
      a.position.set(side * (iw / 2 - 0.02), this.waterY / 2, 0);
      a.rotation.y = Math.PI / 2;
      a.renderOrder = 15;
      this.built.add(a);
    }
    // Glass edges
    for (const [x, z] of [
      [W / 2, D / 2],
      [-W / 2, D / 2],
      [W / 2, -D / 2],
      [-W / 2, -D / 2],
    ]) {
      const e = new THREE.Mesh(new THREE.BoxGeometry(0.05, H, 0.05), edgeMat);
      e.position.set(x, H / 2, z);
      this.built.add(e);
    }

    // Frame rims
    const frameMat = std('#1c1a27', { roughness: 0.35, metalness: 0.4, fog: false });
    const rim = (y: number, t: number) => {
      const g = new THREE.Group();
      const front = new THREE.Mesh(new THREE.BoxGeometry(W + 0.12, t, 0.12), frameMat);
      front.position.set(0, y, D / 2);
      const back = front.clone();
      back.position.z = -D / 2;
      const left = new THREE.Mesh(new THREE.BoxGeometry(0.12, t, D + 0.12), frameMat);
      left.position.set(-W / 2, y, 0);
      const right = left.clone();
      right.position.x = W / 2;
      g.add(front, back, left, right);
      return g;
    };
    this.built.add(rim(0.06, 0.18), rim(H, 0.14));

    // Lamp hood on top
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(W * 0.86, 0.12, 0.5), [frameMat, frameMat, frameMat, this.lampMat, frameMat, frameMat]);
    lamp.position.set(0, H + 0.12, -0.2);
    this.built.add(lamp);

    // Stand
    const standMat = std('#15131d', { roughness: 0.55, metalness: 0.15, fog: false });
    const stand = new THREE.Mesh(new THREE.BoxGeometry(W + 0.5, 2.6, D + 0.4), standMat);
    stand.position.y = -1.3;
    this.built.add(stand);
    const top = new THREE.Mesh(new THREE.BoxGeometry(W + 0.7, 0.12, D + 0.6), std('#211e2d', { roughness: 0.4, metalness: 0.2, fog: false }));
    top.position.y = -0.04;
    this.built.add(top);
    const logo = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 0.375),
      new THREE.MeshBasicMaterial({ map: Tank.logoTexture(), transparent: true, opacity: 0.85, fog: false, toneMapped: false }),
    );
    logo.position.set(0, -1.3, (D + 0.4) / 2 + 0.01);
    this.built.add(logo);

    if (this.theme) this.setTheme(this.theme);
  }

  private static logoTex: THREE.Texture | null = null;
  private static logoTexture(): THREE.Texture {
    if (!Tank.logoTex) {
      Tank.logoTex = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}retrac-space-logo.png`);
      Tank.logoTex.colorSpace = THREE.SRGBColorSpace;
    }
    return Tank.logoTex;
  }

  setTheme(theme: ThemeDef): void {
    this.theme = theme;
    const u = this.backdropMat.uniforms;
    (u.uTop.value as THREE.Color).set(theme.top);
    (u.uBottom.value as THREE.Color).set(theme.bottom);
    u.uStars.value = theme.stars ? 1 : 0;
    this.sandBase.set(theme.sand);
    this.tintMat.color.set(theme.water);
    if (!this.sand) return;
    const geo = this.sand.geometry;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const col = geo.attributes.color as THREE.BufferAttribute;
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const n = valueNoise(x * 6.1, z * 6.7) * 0.5 + 0.5;
      c.copy(this.sandBase).multiplyScalar(0.8 + n * 0.28);
      if (Math.sin(x * 23.1 + z * 17.3) > 0.97) c.multiplyScalar(0.7); // pebbles
      col.setXYZ(i, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
  }

  get themeWater(): THREE.Color {
    return new THREE.Color(this.theme?.water ?? '#3fa7c9');
  }

  update(time: number, env: TankEnv): void {
    // Surface waves
    const geo = this.surface.geometry;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const base = this.surfaceBase;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3];
      const z = base[i * 3 + 2];
      pos.setY(i, Math.sin(x * 1.4 + time * 1.1) * 0.035 + Math.cos(z * 2.1 + time * 0.8 + x * 0.5) * 0.03);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();

    const u = this.backdropMat.uniforms;
    u.uLight.value = env.light;
    u.uMurk.value = env.murk;
    this.tintMat.color.copy(this.themeWater).lerp(MURK, env.murk * 0.8);
    this.tintMat.opacity = 0.06 + env.murk * 0.32;
    this.algaeMat.opacity = Math.max(0, env.murk * 0.85 - env.clean);
    this.surfaceMat.opacity = 0.3 + env.murk * 0.25;
    this.lampMat.emissiveIntensity = 0.15 + env.light * 0.9;
    this.lampMat.emissive.set(env.light > 0.4 ? '#fff4d6' : '#8fa8ff');
    shared.uCaustics.value = 0.25 + env.light * 0.75 * (1 - env.murk * 0.7);
  }
}
