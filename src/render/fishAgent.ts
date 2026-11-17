import * as THREE from 'three';
import type { SpeciesDef } from '../core/catalog';
import { hashString } from '../core/rng';
import type { Fish } from '../core/state';
import type { Flake } from './effects';
import { buildFish, type FishRig } from './fishModels';

const UP = new THREE.Vector3(0, 1, 0);
const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpSep = new THREE.Vector3();
const SICK = new THREE.Color('#7d8571');

const MAX_SPEED: Record<SpeciesDef['behavior'], number> = {
  school: 1.25,
  wander: 0.85,
  glide: 0.55,
  bottom: 0.5,
  hover: 0.18,
  jelly: 0.22,
  ray: 0.6,
};

export interface SwimContext {
  box: THREE.Box3;
  floorAt: (x: number, z: number) => number;
  agents: FishAgent[];
  food: Flake[];
  plantSpots: THREE.Vector3[];
  /** called when a flake is eaten */
  onEat: (flake: Flake, agent: FishAgent) => void;
}

export class FishAgent {
  readonly rig: FishRig;
  readonly pos = new THREE.Vector3();
  readonly vel = new THREE.Vector3();
  private target = new THREE.Vector3();
  private retarget = 0;
  private burst = 0;
  private idle = 0;
  dying = 0; // >0 while playing the death float animation
  leaving = 0; // >0 while swimming off to the sanctuary
  scale = 1;
  private displayScale = 0.01;

  constructor(
    public data: Fish,
    readonly def: SpeciesDef,
    box: THREE.Box3,
  ) {
    this.rig = buildFish(def.look, hashString(data.id));
    this.rig.root.userData.fishId = data.id;
    this.rig.root.traverse((o) => (o.userData.fishId = data.id));
    this.pos.set(
      THREE.MathUtils.lerp(box.min.x, box.max.x, Math.random()),
      THREE.MathUtils.lerp(box.min.y, box.max.y, Math.random()),
      THREE.MathUtils.lerp(box.min.z, box.max.z, Math.random()),
    );
    this.vel.set(Math.random() - 0.5, 0, Math.random() - 0.5).multiplyScalar(0.3);
    this.pickTarget(box, null);
    this.rig.root.position.copy(this.pos);
  }

  get id() {
    return this.data.id;
  }

  startle(): void {
    this.burst = 1.2;
    this.retarget = 0;
    this.rig.puff?.(1);
  }

  private zoneY(box: THREE.Box3, floor: number): [number, number] {
    const h = box.max.y - box.min.y;
    switch (this.def.zone) {
      case 'top':
        return [box.min.y + h * 0.55, box.max.y];
      case 'bottom':
        return [floor + 0.25, Math.min(box.max.y, floor + 0.8)];
      case 'middle':
        return [box.min.y + h * 0.2, box.min.y + h * 0.85];
      default:
        return [box.min.y, box.max.y];
    }
  }

  private pickTarget(box: THREE.Box3, ctx: SwimContext | null): void {
    const x = THREE.MathUtils.lerp(box.min.x, box.max.x, Math.random());
    const z = THREE.MathUtils.lerp(box.min.z, box.max.z, Math.random());
    const floor = ctx ? ctx.floorAt(x, z) : 0.5;
    const [lo, hi] = this.zoneY(box, floor);
    this.target.set(x, THREE.MathUtils.lerp(lo, hi, Math.random()), z);
    if (this.def.behavior === 'hover' && ctx?.plantSpots.length) {
      const p = ctx.plantSpots[Math.floor(Math.random() * ctx.plantSpots.length)];
      this.target.set(p.x + (Math.random() - 0.5) * 0.6, p.y + 0.6 + Math.random() * 0.8, p.z + 0.3);
    }
    if (this.def.behavior === 'ray' || this.def.behavior === 'bottom') this.target.y = floor + (this.def.behavior === 'ray' ? 0.35 : 0.22);
    this.retarget = 3 + Math.random() * 6;
  }

  update(dt: number, t: number, ctx: SwimContext, growth: number): void {
    const def = this.def;
    const box = ctx.box;
    const hunger = this.data.hunger;
    const health = this.data.health;

    // Scale: fry grow into adults
    this.scale = def.look.size * (0.45 + 0.55 * growth);
    this.displayScale += (this.scale - this.displayScale) * Math.min(1, dt * 2);

    if (this.dying > 0) {
      // Belly-up float to the surface, then fade away.
      this.dying += dt;
      this.pos.y = Math.min(box.max.y + 0.25, this.pos.y + dt * 0.35);
      this.vel.multiplyScalar(0.9);
      const roll = Math.min(Math.PI, this.dying * 1.5);
      this.rig.root.position.copy(this.pos);
      this.rig.body.rotation.z = roll;
      this.rig.root.scale.setScalar(this.displayScale * Math.max(0, 1 - Math.max(0, this.dying - 5) / 2));
      this.rig.animate(t, 0, dt * 0.1);
      return;
    }

    let maxSpeed = MAX_SPEED[def.behavior] * (0.75 + def.look.size * 0.5);
    if (hunger > 70) maxSpeed *= 0.8;
    if (health < 40) maxSpeed *= 0.55;
    if (this.burst > 0) {
      maxSpeed *= 2.6;
      this.burst -= dt;
    }
    if (this.leaving > 0) {
      this.leaving += dt;
      maxSpeed *= 2;
    }

    const steer = tmpV.set(0, 0, 0);

    // Food!
    let chasing: Flake | null = null;
    if (ctx.food.length && this.leaving === 0 && def.behavior !== 'jelly') {
      let best = Infinity;
      for (const f of ctx.food) {
        const d = f.pos.distanceToSquared(this.pos);
        if (d < best) {
          best = d;
          chasing = f;
        }
      }
      if (chasing) {
        this.target.copy(chasing.pos);
        if (Math.sqrt(best) < 0.18 + this.displayScale * 0.4) {
          ctx.onEat(chasing, this);
          chasing = null;
          this.retarget = 0;
        }
        maxSpeed *= 1.35;
      }
    }

    this.retarget -= dt;
    if (!chasing && (this.retarget <= 0 || this.pos.distanceToSquared(this.target) < 0.09)) {
      if (def.behavior === 'bottom' && Math.random() < 0.4) this.idle = 1 + Math.random() * 2.5;
      this.pickTarget(box, ctx);
    }
    if (this.leaving > 0) this.target.set(box.max.x + 3, box.max.y, this.pos.z);

    const desired = tmpV2.copy(this.target).sub(this.pos);
    const dist = desired.length();
    if (dist > 0.001) desired.multiplyScalar(Math.min(maxSpeed, dist * 1.2) / dist);
    if (this.idle > 0) {
      this.idle -= dt;
      desired.set(0, 0, 0);
    }
    steer.copy(desired).sub(this.vel).multiplyScalar(def.behavior === 'glide' || def.behavior === 'ray' ? 0.9 : 1.8);

    // Schooling: cohesion + alignment with same species, separation from everyone.
    let n = 0;
    const coh = new THREE.Vector3();
    const ali = new THREE.Vector3();
    const sep = new THREE.Vector3();
    for (const other of ctx.agents) {
      if (other === this || other.dying) continue;
      const d = other.pos.distanceTo(this.pos);
      const minD = (this.displayScale + other.displayScale) * 0.9;
      if (d < minD && d > 0.0001) sep.add(tmpSep.copy(this.pos).sub(other.pos).multiplyScalar((minD - d) / d));
      if (def.behavior === 'school' && other.def.id === def.id && d < 1.8) {
        coh.add(other.pos);
        ali.add(other.vel);
        n++;
      }
    }
    if (n > 0 && !chasing) {
      coh.divideScalar(n).sub(this.pos).multiplyScalar(0.6);
      ali.divideScalar(n).sub(this.vel).multiplyScalar(0.8);
      steer.add(coh).add(ali);
    }
    steer.addScaledVector(sep, 4);

    // Jellies pulse upward and sink gently.
    if (def.behavior === 'jelly') {
      const pulse = Math.max(0, Math.sin(t * 2.2 + this.pos.x));
      steer.y += pulse * 0.25 - 0.06;
    }
    if (def.behavior === 'hover') steer.y += Math.sin(t * 1.3 + this.pos.x * 3) * 0.08;

    this.vel.addScaledVector(steer, dt);
    if (this.vel.length() > maxSpeed) this.vel.setLength(maxSpeed);
    this.pos.addScaledVector(this.vel, dt);

    // Walls, floor and surface
    const floor = ctx.floorAt(this.pos.x, this.pos.z) + 0.15 + this.displayScale * 0.25;
    if (this.leaving === 0) {
      this.pos.x = THREE.MathUtils.clamp(this.pos.x, box.min.x, box.max.x);
      this.pos.z = THREE.MathUtils.clamp(this.pos.z, box.min.z, box.max.z);
    }
    this.pos.y = THREE.MathUtils.clamp(this.pos.y, Math.max(box.min.y * 0.5, floor), box.max.y);

    // Orientation
    const root = this.rig.root;
    root.position.copy(this.pos);
    root.scale.setScalar(this.displayScale * (this.leaving > 0 ? Math.max(0, 1 - this.leaving / 2.5) : 1));
    const speed = this.vel.length();
    if (this.rig.upright) {
      if (speed > 0.02) {
        const yaw = Math.atan2(this.vel.x, this.vel.z);
        tmpQ.setFromAxisAngle(UP, yaw);
        root.quaternion.slerp(tmpQ, 1 - Math.exp(-dt * 2));
      }
    } else if (speed > 0.01) {
      const horiz = Math.hypot(this.vel.x, this.vel.z);
      const look = tmpV.set(this.vel.x, THREE.MathUtils.clamp(this.vel.y, -horiz * 0.7, horiz * 0.7), this.vel.z);
      if (look.lengthSq() > 1e-6) {
        // Matrix4.lookAt(eye, target): +Z ends up pointing from target to eye, i.e. along `look`.
        tmpM.lookAt(tmpV2.copy(this.pos).add(look), this.pos, UP);
        tmpQ.setFromRotationMatrix(tmpM);
        root.quaternion.slerp(tmpQ, 1 - Math.exp(-dt * 4));
      }
    }
    // Weak fish list to the side.
    this.rig.body.rotation.z = health < 40 ? (1 - health / 40) * 0.9 : 0;

    // Colour: desaturate when unwell; glow at night handled by the scene.
    const sick = THREE.MathUtils.clamp((60 - health) / 60, 0, 1);
    for (const tnt of this.rig.tintables) tnt.mat.color.copy(tnt.base).lerp(SICK, sick * 0.7);

    this.rig.animate(t, speed / Math.max(0.1, maxSpeed), dt);
  }
}
