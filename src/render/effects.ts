import * as THREE from 'three';
import { lightShaftMaterial } from './materials';
import type { Tank } from './tank';

const dummy = new THREE.Object3D();

/** Rising bubbles from emitters (air stones, castles...) plus a few ambient ones. */
export class Bubbles {
  readonly mesh: THREE.InstancedMesh;
  private items: { pos: THREE.Vector3; speed: number; size: number; phase: number; alive: boolean }[] = [];
  emitters: { pos: THREE.Vector3; rate: number; acc: number }[] = [];
  private ambientAcc = 0;

  constructor(
    private tank: Tank,
    readonly capacity = 500,
  ) {
    const mat = new THREE.MeshStandardMaterial({
      color: '#e8fbff',
      emissive: '#9fe8ff',
      emissiveIntensity: 0.15,
      transparent: true,
      opacity: 0.55,
      roughness: 0.05,
      metalness: 0.1,
      depthWrite: false,
    });
    this.mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), mat, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    for (let i = 0; i < capacity; i++) this.items.push({ pos: new THREE.Vector3(), speed: 0, size: 0, phase: 0, alive: false });
  }

  spawn(at: THREE.Vector3, size = 0.03 + Math.random() * 0.05): void {
    const slot = this.items.find((b) => !b.alive);
    if (!slot) return;
    slot.alive = true;
    slot.pos.copy(at).add(new THREE.Vector3((Math.random() - 0.5) * 0.06, 0, (Math.random() - 0.5) * 0.06));
    slot.size = size;
    slot.speed = 0.6 + size * 8 + Math.random() * 0.3;
    slot.phase = Math.random() * 10;
  }

  burst(at: THREE.Vector3, n: number): void {
    for (let i = 0; i < n; i++) this.spawn(at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, Math.random() * 0.2, (Math.random() - 0.5) * 0.3)), 0.02 + Math.random() * 0.04);
  }

  update(dt: number, t: number): void {
    for (const e of this.emitters) {
      e.acc += dt * e.rate;
      while (e.acc > 1) {
        e.acc -= 1;
        this.spawn(e.pos);
      }
    }
    this.ambientAcc += dt * 0.8;
    while (this.ambientAcc > 1) {
      this.ambientAcc -= 1;
      const p = this.tank.toWorld(Math.random() - 0.5, Math.random() - 0.5);
      this.spawn(p, 0.015 + Math.random() * 0.02);
    }
    const top = this.tank.waterY;
    for (let i = 0; i < this.items.length; i++) {
      const b = this.items[i];
      if (b.alive) {
        b.pos.y += b.speed * dt;
        b.pos.x += Math.sin(t * 3 + b.phase) * dt * 0.12;
        if (b.pos.y > top) b.alive = false;
      }
      dummy.position.copy(b.pos);
      dummy.scale.setScalar(b.alive ? b.size : 0);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export interface Flake {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  alive: boolean;
  rot: number;
}

/** Food flakes that drift down from the surface. Fish chase and eat them. */
export class Food {
  readonly mesh: THREE.InstancedMesh;
  readonly flakes: Flake[] = [];

  constructor(
    private tank: Tank,
    capacity = 160,
  ) {
    const mat = new THREE.MeshStandardMaterial({ color: '#e08a3c', roughness: 0.8 });
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 0.015, 0.06), mat, capacity);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    const palette = ['#e08a3c', '#c8553d', '#e8c26a', '#8fbf5a'].map((c) => new THREE.Color(c));
    for (let i = 0; i < capacity; i++) {
      this.mesh.setColorAt(i, palette[i % palette.length]);
      this.flakes.push({ pos: new THREE.Vector3(), vel: new THREE.Vector3(), life: 0, alive: false, rot: Math.random() * 6 });
    }
    this.mesh.frustumCulled = false;
  }

  drop(count: number, center?: THREE.Vector3): void {
    const box = this.tank.swimBox(0.6);
    for (let i = 0; i < count; i++) {
      const f = this.flakes.find((x) => !x.alive);
      if (!f) return;
      f.alive = true;
      f.life = 25;
      const cx = center ? center.x : THREE.MathUtils.lerp(box.min.x, box.max.x, 0.3 + Math.random() * 0.4);
      const cz = center ? center.z : 0;
      f.pos.set(cx + (Math.random() - 0.5) * 1.6, this.tank.waterY - 0.02, cz + (Math.random() - 0.5) * 1.2);
      f.vel.set((Math.random() - 0.5) * 0.1, -0.12 - Math.random() * 0.15, (Math.random() - 0.5) * 0.1);
    }
  }

  get active(): Flake[] {
    return this.flakes.filter((f) => f.alive);
  }

  update(dt: number, t: number): void {
    this.flakes.forEach((f, i) => {
      if (f.alive) {
        f.life -= dt;
        const floor = this.tank.sandHeight(f.pos.x, f.pos.z) + 0.02;
        if (f.pos.y > floor) {
          f.pos.addScaledVector(f.vel, dt);
          f.pos.x += Math.sin(t * 2 + i) * dt * 0.08;
          f.rot += dt * 2;
        } else f.pos.y = floor;
        if (f.life <= 0) f.alive = false;
      }
      dummy.position.copy(f.pos);
      dummy.rotation.set(Math.sin(f.rot) * 0.6, f.rot, 0);
      dummy.scale.setScalar(f.alive ? Math.min(1, f.life) : 0);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** Drifting specks in the water for depth and atmosphere. */
export class Motes {
  readonly points: THREE.Points;
  private base: Float32Array;
  constructor(tank: Tank, count = 260) {
    const box = tank.swimBox(0.1);
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = THREE.MathUtils.lerp(box.min.x, box.max.x, Math.random());
      arr[i * 3 + 1] = THREE.MathUtils.lerp(0.4, tank.waterY, Math.random());
      arr[i * 3 + 2] = THREE.MathUtils.lerp(box.min.z, box.max.z, Math.random());
    }
    this.base = arr.slice();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    this.points = new THREE.Points(
      g,
      new THREE.PointsMaterial({ color: '#d6f3ff', size: 0.025, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
  }
  update(t: number, murk: number): void {
    const pos = this.points.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      pos.setX(i, this.base[i * 3] + Math.sin(t * 0.13 + i) * 0.15);
      pos.setY(i, this.base[i * 3 + 1] + Math.sin(t * 0.21 + i * 1.7) * 0.1);
    }
    pos.needsUpdate = true;
    const m = this.points.material as THREE.PointsMaterial;
    m.color.set(murk > 0.3 ? '#c9d69a' : '#d6f3ff');
    m.opacity = 0.35 + murk * 0.5;
  }
}

/** Sunbeams slanting down through the water. */
export class LightShafts {
  readonly group = new THREE.Group();
  private mats: THREE.ShaderMaterial[] = [];
  constructor(tank: Tank) {
    const n = Math.round(tank.innerW / 1.3);
    for (let i = 0; i < n; i++) {
      const mat = lightShaftMaterial();
      mat.uniforms.uSeed.value = Math.random();
      const w = 0.5 + Math.random() * 0.7;
      const h = tank.waterY + 0.2;
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      plane.position.set(-tank.innerW / 2 + (i + 0.5) * (tank.innerW / n) + (Math.random() - 0.5) * 0.4, h / 2, (Math.random() - 0.5) * tank.innerD * 0.6);
      plane.rotation.z = 0.25;
      plane.renderOrder = 12;
      this.group.add(plane);
      this.mats.push(mat);
    }
  }
  update(t: number, light: number, murk: number): void {
    this.group.children.forEach((c, i) => (c.rotation.z = 0.22 + Math.sin(t * 0.15 + i) * 0.05));
    for (const m of this.mats) m.uniforms.uIntensity.value = 0.13 * light * (1 - murk * 0.6);
  }
}

/** Short-lived sparkle bursts (hatching, collecting, cleaning). */
export class Sparkles {
  readonly points: THREE.Points;
  private parts: { pos: THREE.Vector3; vel: THREE.Vector3; life: number }[] = [];
  constructor(capacity = 300) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(capacity * 3), 3));
    this.points = new THREE.Points(
      g,
      new THREE.PointsMaterial({ color: '#fff3c4', size: 0.09, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this.points.frustumCulled = false;
    for (let i = 0; i < capacity; i++) this.parts.push({ pos: new THREE.Vector3(0, -99, 0), vel: new THREE.Vector3(), life: 0 });
  }
  burst(at: THREE.Vector3, n = 40, color?: THREE.ColorRepresentation): void {
    if (color) (this.points.material as THREE.PointsMaterial).color.set(color);
    let k = 0;
    for (const p of this.parts) {
      if (p.life > 0) continue;
      p.pos.copy(at);
      p.vel.set(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).multiplyScalar(1.4);
      p.life = 0.8 + Math.random() * 0.8;
      if (++k >= n) break;
    }
  }
  update(dt: number): void {
    const pos = this.points.geometry.attributes.position as THREE.BufferAttribute;
    this.parts.forEach((p, i) => {
      if (p.life > 0) {
        p.life -= dt;
        p.pos.addScaledVector(p.vel, dt);
        p.vel.multiplyScalar(1 - dt * 1.5);
        if (p.life <= 0) p.pos.set(0, -99, 0);
      }
      pos.setXYZ(i, p.pos.x, p.pos.y, p.pos.z);
    });
    pos.needsUpdate = true;
  }
}
