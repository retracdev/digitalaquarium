import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { AquariumController } from '../app/controller';
import { DECOR_BY_ID, SPECIES_BY_ID, TANK_TIERS, THEMES, THEMES_BY_ID } from '../core/catalog';
import { hashString } from '../core/rng';
import { hourOfDay } from '../core/time';
import { fishGrowth, plantProgress } from '../core/sim';
import type { SaveData } from '../core/state';
import { buildDecor, type DecorRig } from './decorModels';
import { Bubbles, Food, LightShafts, Motes, Sparkles, type Flake } from './effects';
import { FishAgent, type SwimContext } from './fishAgent';
import { shared } from './materials';
import { buildPlant, type PlantRig } from './plantModels';
import { Tank } from './tank';

export type Quality = 'high' | 'low';

export interface PickResult {
  kind: 'fish' | 'plant' | 'decor';
  id: string;
}

export interface PlacementRequest {
  kind: 'plant' | 'decor';
  type: string;
  moveId?: string;
}

interface ItemView<T> {
  rig: T;
  type: string;
  /** Rough footprint radius on the sand, used to stop items being stacked inside each other. */
  radius: number;
}

const boxSize = new THREE.Vector3();
/** Footprint radius of a freshly built (unscaled, unrotated) model. */
function footprint(group: THREE.Object3D): number {
  new THREE.Box3().setFromObject(group).getSize(boxSize);
  return THREE.MathUtils.clamp(Math.max(boxSize.x, boxSize.z) * 0.35, 0.1, 1.1);
}
const BLOCKED_TINT = new THREE.Color('#ff5a6e');

const MURK_FOG = new THREE.Color('#4e5a2a');

function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Daylight 0..1 from the hour of the simulation clock in the tank's time zone. */
export function daylightAt(time: number, tz = ''): number {
  const h = hourOfDay(time, tz);
  return smoothstep(6, 8, h) * (1 - smoothstep(19, 21, h));
}

export class AquariumScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  quality: Quality = 'high';

  readonly tank = new Tank();
  private bubbles: Bubbles;
  private food: Food;
  private motes: Motes;
  private shafts: LightShafts;
  private sparkles = new Sparkles();
  private tankScale = -1;
  private themeId = '';

  private hemi = new THREE.HemisphereLight('#cdeeff', '#5a4a33', 1);
  private sun = new THREE.DirectionalLight('#fff1d6', 2.4);
  private moon = new THREE.DirectionalLight('#7088ff', 0);
  private room = new THREE.AmbientLight('#8a86a8', 0.35);
  private fill = new THREE.DirectionalLight('#c9c4ff', 0.35);
  private tankGlow: THREE.Mesh;

  private fish = new Map<string, FishAgent>();
  private plants = new Map<string, ItemView<PlantRig>>();
  private decor = new Map<string, ItemView<DecorRig>>();
  private dyingIds = new Set<string>();
  private leavingIds = new Set<string>();
  private spawnFx = new Set<string>();
  private plantSpots: THREE.Vector3[] = [];

  private lastFrame = performance.now();
  private time = 0;
  private light = 1;
  private murk = 0;
  private cleanWipe = 0;
  private syncedVersion = -1;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2(-9, -9);
  private pointerDown: { x: number; y: number } | null = null;
  private marker: THREE.Mesh;

  selectedFish: string | null = null;
  followId: string | null = null;
  /** Title-screen mode: the camera drifts slowly instead of following input. */
  attract = false;
  private placement: (PlacementRequest & { ghost: THREE.Group; rot: number; valid: boolean; blocked: boolean; radius: number; nx: number; nz: number }) | null = null;

  /** UI hooks */
  onPick: (p: PickResult | null) => void = () => {};
  onHover: (info: { text: string; x: number; y: number } | null) => void = () => {};
  onPlace: (req: PlacementRequest, nx: number, nz: number, rot: number) => void = () => {};
  onPlacementEnd: () => void = () => {};
  /** The player clicked the sand somewhere another item is in the way. */
  onPlaceBlocked: () => void = () => {};

  constructor(
    private host: HTMLElement,
    private ctrl: AquariumController,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
    this.camera.position.set(0, 3.2, 13.5);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 2.0, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 24;
    this.controls.minPolarAngle = 0.35;
    this.controls.maxPolarAngle = 1.72;
    this.controls.minAzimuthAngle = -1.2;
    this.controls.maxAzimuthAngle = 1.2;

    this.scene.background = new THREE.Color('#0d0c14');
    this.scene.fog = new THREE.Fog('#1d5f80', 12, 30);
    this.scene.add(this.tank.group, this.hemi, this.sun, this.sun.target, this.moon, this.room, this.fill);
    this.sun.position.set(2, 12, 3);
    this.moon.position.set(-3, 12, 2);
    this.fill.position.set(0, 2, 15);

    // Floor under the stand + soft light spill from the tank
    const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 48), new THREE.MeshStandardMaterial({ color: '#100f18', roughness: 0.9, fog: false }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.6;
    this.scene.add(floor);
    this.tankGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(22, 12),
      new THREE.MeshBasicMaterial({ map: radialTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.6 }),
    );
    this.tankGlow.rotation.x = -Math.PI / 2;
    this.tankGlow.position.set(0, -2.59, 2.5);
    this.scene.add(this.tankGlow);

    this.tank.build(1);
    this.bubbles = new Bubbles(this.tank);
    this.food = new Food(this.tank);
    this.motes = new Motes(this.tank);
    this.shafts = new LightShafts(this.tank);
    this.scene.add(this.bubbles.mesh, this.food.mesh, this.motes.points, this.shafts.group, this.sparkles.points);

    this.marker = new THREE.Mesh(
      new THREE.ConeGeometry(0.09, 0.2, 4),
      new THREE.MeshStandardMaterial({ color: '#f1effa', emissive: '#b9b2ff', emissiveIntensity: 1.2 }),
    );
    this.marker.rotation.x = Math.PI;
    this.marker.visible = false;
    this.scene.add(this.marker);

    this.setQuality('high');
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.bindPointer();
  }

  setQuality(q: Quality): void {
    this.quality = q;
    this.renderer.setPixelRatio(q === 'high' ? Math.min(devicePixelRatio, 2) : 1);
    if (q === 'high') {
      const size = this.renderer.getSize(new THREE.Vector2());
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x || 1, size.y || 1), 0.4, 0.5, 0.9);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
    } else {
      this.composer?.dispose();
      this.composer = null;
      this.bloom = null;
    }
    this.resize();
  }

  resize(): void {
    const w = this.host.clientWidth || window.innerWidth;
    const h = this.host.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    // Pull back on narrow (phone) screens so the whole tank fits.
    this.camera.fov = w / h < 0.8 ? 60 : 42;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer?.setSize(w, h);
  }

  resetCamera(): void {
    this.followId = null;
    this.camera.position.set(0, 3.2, 13.5 * Math.max(1, this.tank.width / 8) ** 0.8);
    this.controls.target.set(0, 2, 0);
  }

  // ---------------------------------------------------------------- sync

  clear(): void {
    for (const a of this.fish.values()) this.scene.remove(a.rig.root);
    for (const p of this.plants.values()) this.tank.group.remove(p.rig.group);
    for (const d of this.decor.values()) this.tank.group.remove(d.rig.group);
    this.fish.clear();
    this.plants.clear();
    this.decor.clear();
    this.dyingIds.clear();
    this.leavingIds.clear();
    this.selectedFish = null;
    this.followId = null;
    this.syncedVersion = -1;
    this.cancelPlacement();
  }

  markDying(id: string): void {
    this.dyingIds.add(id);
  }
  markLeaving(id: string): void {
    this.leavingIds.add(id);
  }
  markHatched(id: string): void {
    this.spawnFx.add(id);
  }

  private sync(save: SaveData): void {
    const tier = TANK_TIERS[save.upgrades.tank] ?? TANK_TIERS[0];
    if (tier.widthScale !== this.tankScale) {
      this.tankScale = tier.widthScale;
      this.tank.build(tier.widthScale);
      this.scene.remove(this.motes.points, this.shafts.group);
      this.motes = new Motes(this.tank);
      this.shafts = new LightShafts(this.tank);
      this.scene.add(this.motes.points, this.shafts.group);
      this.tankGlow.scale.set(tier.widthScale, 1, 1);
      this.resetCamera();
    }
    if (save.theme !== this.themeId) {
      this.themeId = save.theme;
      this.tank.setTheme(THEMES_BY_ID.get(save.theme) ?? THEMES[0]);
    }

    const box = this.tank.swimBox();
    const alive = new Set(save.fish.map((f) => f.id));
    for (const f of save.fish) {
      let agent = this.fish.get(f.id);
      if (!agent) {
        const def = SPECIES_BY_ID.get(f.species);
        if (!def) continue;
        agent = new FishAgent(f, def, box);
        if (this.spawnFx.has(f.id)) {
          agent.pos.set(0, box.max.y - 0.3, box.max.z - 0.2);
          this.sparkles.burst(agent.pos, 60, '#fff3c4');
          this.bubbles.burst(agent.pos, 14);
          this.spawnFx.delete(f.id);
        }
        this.fish.set(f.id, agent);
        this.scene.add(agent.rig.root);
      }
      agent.data = f;
    }
    for (const [id, agent] of this.fish) {
      if (alive.has(id) || agent.dying || agent.leaving) continue;
      if (this.dyingIds.has(id)) agent.dying = 0.001;
      else if (this.leavingIds.has(id)) agent.leaving = 0.001;
      else {
        this.scene.remove(agent.rig.root);
        this.fish.delete(id);
      }
      if (this.selectedFish === id) this.selectedFish = null;
      if (this.followId === id) this.followId = null;
    }

    // Plants
    const plantIds = new Set(save.plants.map((p) => p.id));
    for (const [id, view] of this.plants)
      if (!plantIds.has(id)) {
        this.tank.group.remove(view.rig.group);
        this.plants.delete(id);
      }
    this.plantSpots = [];
    for (const p of save.plants) {
      let view = this.plants.get(p.id);
      if (!view) {
        const rig = buildPlant(p.type, hashString(p.id));
        view = { rig, type: p.type, radius: footprint(rig.group) };
        view.rig.group.userData.pick = { kind: 'plant', id: p.id };
        for (const m of view.rig.glow) m.userData.baseGlow = m.emissiveIntensity;
        this.plants.set(p.id, view);
        this.tank.group.add(view.rig.group);
      }
      this.tank.toWorld(p.x, p.z, view.rig.group.position);
      view.rig.group.position.y -= 0.05;
      this.plantSpots.push(view.rig.group.position);
    }

    // Decor
    const decorIds = new Set(save.decor.map((d) => d.id));
    for (const [id, view] of this.decor)
      if (!decorIds.has(id)) {
        this.tank.group.remove(view.rig.group);
        this.decor.delete(id);
      }
    this.bubbles.emitters = [];
    for (const d of save.decor) {
      let view = this.decor.get(d.id);
      if (!view) {
        const rig = buildDecor(d.type, hashString(d.id));
        view = { rig, type: d.type, radius: footprint(rig.group) };
        view.rig.group.userData.pick = { kind: 'decor', id: d.id };
        for (const m of view.rig.glow) m.userData.baseGlow = m.emissiveIntensity;
        this.decor.set(d.id, view);
        this.tank.group.add(view.rig.group);
      }
      const g = view.rig.group;
      this.tank.toWorld(d.x, d.z, g.position);
      g.position.y -= 0.08;
      g.rotation.y = d.rot;
      g.updateMatrixWorld();
      const rate = d.type === 'airstone' ? 14 : d.type === 'volcano' ? 6 : 1.2;
      for (const b of view.rig.bubblers) this.bubbles.emitters.push({ pos: b.clone().applyMatrix4(g.matrixWorld), rate, acc: 0 });
    }
  }

  // ---------------------------------------------------------- reactions

  dropFood(): void {
    this.food.drop(18 + Math.min(40, this.fish.size * 3));
  }

  cleanEffect(): void {
    this.cleanWipe = 1;
    const box = this.tank.swimBox();
    for (let i = 0; i < 6; i++) {
      const p = new THREE.Vector3(THREE.MathUtils.lerp(box.min.x, box.max.x, Math.random()), THREE.MathUtils.lerp(box.min.y, box.max.y, Math.random()), box.max.z);
      this.sparkles.burst(p, 18, '#c9fbff');
    }
  }

  collectEffect(): void {
    for (const a of this.fish.values()) this.sparkles.burst(a.pos, 6, '#ffe7a3');
  }

  burstAtItem(id: string): void {
    const view = this.decor.get(id) ?? this.plants.get(id);
    if (!view) return;
    const p = view.rig.group.position.clone().add(new THREE.Vector3(0, 0.5, 0));
    this.sparkles.burst(p, 70, '#ffd36b');
    this.bubbles.burst(p, 20);
  }

  focusFish(id: string | null): void {
    this.selectedFish = id;
  }

  follow(id: string | null): void {
    this.followId = id;
  }

  // ---------------------------------------------------------- placement

  beginPlacement(req: PlacementRequest): void {
    this.cancelPlacement(false);
    const rig = req.kind === 'plant' ? buildPlant(req.type, 7) : buildDecor(req.type, 7);
    const ghost = rig.group;
    const radius = footprint(ghost);
    ghost.traverse((o) => {
      if (o instanceof THREE.Mesh && !Array.isArray(o.material)) {
        const m = (o.material as THREE.Material).clone();
        m.transparent = true;
        m.opacity = 0.6;
        m.depthWrite = false;
        const c = (m as THREE.MeshStandardMaterial).color;
        if (c) m.userData.baseColor = c.clone();
        o.material = m;
      }
    });
    this.tank.group.add(ghost);
    ghost.visible = false;
    const existing = req.moveId ? this.ctrl.save.decor.find((d) => d.id === req.moveId) : undefined;
    this.placement = { ...req, ghost, radius, rot: existing?.rot ?? Math.random() * Math.PI * 2, valid: false, blocked: false, nx: 0, nz: 0 };
    if (req.moveId) {
      const view = this.decor.get(req.moveId) ?? this.plants.get(req.moveId);
      if (view) view.rig.group.visible = false;
    }
  }

  rotatePlacement(): void {
    if (this.placement) this.placement.rot += Math.PI / 6;
  }

  cancelPlacement(notify = true): void {
    if (!this.placement) return;
    this.tank.group.remove(this.placement.ghost);
    if (this.placement.moveId) {
      const view = this.decor.get(this.placement.moveId) ?? this.plants.get(this.placement.moveId);
      if (view) view.rig.group.visible = true;
    }
    this.placement = null;
    if (notify) this.onPlacementEnd();
  }

  get placing(): boolean {
    return !!this.placement;
  }

  // ---------------------------------------------------------- pointer

  private bindPointer(): void {
    const el = this.renderer.domElement;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      this.hoverClient = { x: e.clientX, y: e.clientY };
    });
    el.addEventListener('pointerleave', () => {
      this.pointer.set(-9, -9);
      this.onHover(null);
    });
    el.addEventListener('pointerdown', (e) => (this.pointerDown = { x: e.clientX, y: e.clientY }));
    el.addEventListener('pointerup', (e) => {
      if (!this.pointerDown) return;
      const moved = Math.hypot(e.clientX - this.pointerDown.x, e.clientY - this.pointerDown.y);
      this.pointerDown = null;
      if (moved > 6) return;
      const r = el.getBoundingClientRect();
      this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      this.click();
    });
    el.addEventListener('dblclick', () => {
      if (!this.placement) this.resetCamera();
    });
  }
  private hoverClient = { x: 0, y: 0 };

  private pickAt(): PickResult | null {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const targets: THREE.Object3D[] = [];
    for (const a of this.fish.values()) if (!a.dying && !a.leaving) targets.push(a.rig.root);
    for (const p of this.plants.values()) targets.push(p.rig.group);
    for (const d of this.decor.values()) targets.push(d.rig.group);
    const hits = this.raycaster.intersectObjects(targets, true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o) {
        if (o.userData.fishId) return { kind: 'fish', id: o.userData.fishId };
        if (o.userData.pick) return o.userData.pick as PickResult;
        o = o.parent;
      }
    }
    return null;
  }

  private click(): void {
    if (this.placement) {
      this.updatePlacement();
      if (this.placement.valid) {
        const p = this.placement;
        this.onPlace({ kind: p.kind, type: p.type, moveId: p.moveId }, p.nx, p.nz, p.rot);
        this.cancelPlacement();
      } else if (this.placement.blocked) this.onPlaceBlocked();
      return;
    }
    const pick = this.pickAt();
    if (pick?.kind === 'fish') {
      const agent = this.fish.get(pick.id);
      agent?.startle();
      if (agent) this.bubbles.burst(agent.pos, 4);
    }
    this.onPick(pick);
  }

  private updatePlacement(): void {
    const p = this.placement;
    if (!p) return;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObject(this.tank.sand, false)[0];
    p.valid = false;
    p.blocked = false;
    p.ghost.visible = !!hit;
    if (!hit) return;
    const local = this.tank.group.worldToLocal(hit.point.clone());
    const n = this.tank.toNorm(local.x, local.z);
    // Keep the whole model inside the glass, not just its centre.
    const limX = THREE.MathUtils.clamp(0.5 - p.radius / this.tank.innerW, 0.05, 0.46);
    const limZ = THREE.MathUtils.clamp(0.5 - p.radius / this.tank.innerD, 0.05, 0.46);
    p.nx = THREE.MathUtils.clamp(n.x, -limX, limX);
    p.nz = THREE.MathUtils.clamp(n.z, -limZ, limZ);
    this.tank.toWorld(p.nx, p.nz, p.ghost.position);
    p.blocked = this.overlaps(p.ghost.position, p.radius, p.kind, p.moveId);
    p.valid = !p.blocked;
    p.ghost.rotation.y = p.rot;
    p.ghost.position.y += Math.sin(this.time * 4) * 0.03;
    if (p.ghost.userData.blocked !== p.blocked) {
      p.ghost.userData.blocked = p.blocked;
      p.ghost.traverse((o) => {
        const m = o instanceof THREE.Mesh && !Array.isArray(o.material) ? (o.material as THREE.MeshStandardMaterial) : null;
        const base = m?.userData.baseColor as THREE.Color | undefined;
        if (m && base) m.color.copy(base).lerp(BLOCKED_TINT, p.blocked ? 0.75 : 0);
      });
    }
  }

  /** Would an item of this size at `pos` sit inside another plant or decoration? */
  private overlaps(pos: THREE.Vector3, radius: number, kind: 'plant' | 'decor', ignoreId?: string): boolean {
    const hit = (views: Map<string, ItemView<PlantRig | DecorRig>>, slack: number) => {
      for (const [id, v] of views) {
        if (id === ignoreId) continue;
        const o = v.rig.group.position;
        if (Math.hypot(o.x - pos.x, o.z - pos.z) < (radius + v.radius) * slack) return true;
      }
      return false;
    };
    // Plants may grow in tight clumps; anything involving decor needs real clearance.
    return hit(this.plants, kind === 'plant' ? 0.4 : 0.85) || hit(this.decor, 0.85);
  }

  // ---------------------------------------------------------- frame

  capture(): string {
    this.renderFrame();
    return this.renderer.domElement.toDataURL('image/png');
  }

  private renderFrame(): void {
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  frame(): void {
    const nowMs = performance.now();
    const dt = Math.min(0.05, (nowMs - this.lastFrame) / 1000);
    this.lastFrame = nowMs;
    this.time += dt;
    const t = this.time;
    shared.uTime.value = t;
    const save = this.ctrl.loaded ? this.ctrl.save : null;
    if (save && this.ctrl.version !== this.syncedVersion) {
      this.syncedVersion = this.ctrl.version;
      this.sync(save);
    }
    const now = this.ctrl.loaded ? this.ctrl.now() : Date.now();

    // Environment
    const targetLight = !save || save.lights === 'auto' ? daylightAt(now, save?.timeZone) : save.lights === 'day' ? 1 : 0;
    this.light += (targetLight - this.light) * Math.min(1, dt * 1.5);
    const targetMurk = save ? THREE.MathUtils.clamp((75 - save.water) / 70, 0, 1) : 0;
    this.murk += (targetMurk - this.murk) * Math.min(1, dt * 2);
    this.cleanWipe = Math.max(0, this.cleanWipe - dt * 0.7);
    const night = 1 - this.light;
    this.hemi.intensity = 0.3 + this.light * 0.55;
    this.sun.intensity = this.light * 1.5;
    this.moon.intensity = night * 0.9;
    this.room.intensity = 0.2 + this.light * 0.1;
    this.tank.update(t, { light: this.light, murk: this.murk, clean: this.cleanWipe });
    const fog = this.scene.fog as THREE.Fog;
    fog.color.copy(this.tank.themeWater).multiplyScalar(0.25 + this.light * 0.6).lerp(MURK_FOG, this.murk * 0.7);
    const camDist = this.camera.position.distanceTo(this.controls.target);
    fog.near = Math.max(1, camDist - 3);
    fog.far = camDist + 18 - this.murk * 11;
    (this.tankGlow.material as THREE.MeshBasicMaterial).color.copy(this.tank.themeWater).multiplyScalar(0.25 + this.light * 0.35);
    if (this.bloom) this.bloom.strength = 0.18 + night * 0.6;

    // Creatures
    const box = this.tank.swimBox();
    const food = this.food.active;
    const ctx: SwimContext = {
      box,
      floorAt: (x, z) => this.tank.sandHeight(x, z),
      agents: [...this.fish.values()],
      food,
      plantSpots: this.plantSpots,
      onEat: (flake: Flake) => {
        flake.alive = false;
        this.bubbles.spawn(flake.pos.clone(), 0.025);
      },
    };
    for (const [id, agent] of this.fish) {
      const growth = fishGrowth(agent.data, now);
      agent.update(dt, t, ctx, growth);
      const glowAmt = night * 1.4 + 0.08;
      for (const m of agent.rig.glow) m.emissiveIntensity = m === agent.rig.glow[0] && agent.def.look.shape === 'angler' ? 1.5 + night * 2 : glowAmt * (agent.def.look.shape === 'jelly' ? 0.9 : 0.5);
      if ((agent.dying && agent.dying > 7.5) || (agent.leaving && agent.leaving > 2.6)) {
        this.scene.remove(agent.rig.root);
        this.fish.delete(id);
        this.dyingIds.delete(id);
        this.leavingIds.delete(id);
      }
    }

    // Plants & decor
    if (save) {
      for (const p of save.plants) {
        const view = this.plants.get(p.id);
        if (!view) continue;
        const prog = plantProgress(p, now);
        const s = 0.25 + 0.75 * prog;
        view.rig.group.scale.set(s, s * (0.9 + 0.1 * prog), s);
        view.rig.update(t);
        for (const m of view.rig.glow) m.emissiveIntensity = (m.userData.baseGlow ?? 0.3) * (0.4 + night * 2.2);
      }
      for (const d of save.decor) {
        const view = this.decor.get(d.id);
        if (!view) continue;
        const ready = DECOR_BY_ID.get(d.type)?.lootEveryMs !== undefined && d.lootAt !== undefined && d.lootAt <= now;
        view.rig.update(t, { ready, night });
        for (const m of view.rig.glow) m.emissiveIntensity = (m.userData.baseGlow ?? 0.3) * (0.5 + night * 2);
      }
    }

    this.bubbles.update(dt, t);
    this.food.update(dt, t);
    this.motes.update(t, this.murk);
    this.shafts.update(t, this.light, this.murk);
    this.sparkles.update(dt);
    this.updatePlacement();
    this.tank.setHoodFade(this.camera.position.y);

    // Selection marker + follow cam
    const sel = this.selectedFish ? this.fish.get(this.selectedFish) : undefined;
    this.marker.visible = !!sel;
    if (sel) {
      this.marker.position.copy(sel.pos).add(new THREE.Vector3(0, 0.45 + sel.scale * 0.6 + Math.sin(t * 4) * 0.05, 0));
      this.marker.rotation.y = t * 2;
    }
    const followed = this.followId ? this.fish.get(this.followId) : undefined;
    if (followed) {
      const delta = followed.pos.clone().sub(this.controls.target).multiplyScalar(Math.min(1, dt * 2.5));
      this.controls.target.add(delta);
      this.camera.position.add(delta);
    }
    if (this.attract) {
      // Behind the title screen: a slow, hands-off drift around the front of the tank.
      const a = Math.sin(t * 0.11) * 0.42;
      const d = 13.5 * Math.max(1, this.tank.width / 8) ** 0.8;
      this.controls.target.set(0, 2, 0);
      this.camera.position.set(Math.sin(a) * d, 3.2, Math.cos(a) * d);
    }
    this.controls.update();

    // Hover label
    if (!this.placement && this.pointer.x > -2) {
      const pick = this.pickAt();
      if (pick?.kind === 'fish') {
        const a = this.fish.get(pick.id);
        if (a) this.onHover({ text: `${a.data.name} · ${a.def.name}`, x: this.hoverClient.x, y: this.hoverClient.y });
      } else if (pick?.kind === 'decor' && save) {
        const d = save.decor.find((x) => x.id === pick.id);
        const def = d && DECOR_BY_ID.get(d.type);
        const ready = d?.lootAt !== undefined && d.lootAt <= now;
        this.onHover(def ? { text: ready ? `${def.name} · tap to open!` : def.name, x: this.hoverClient.x, y: this.hoverClient.y } : null);
      } else this.onHover(null);
      this.renderer.domElement.style.cursor = pick ? 'pointer' : 'grab';
    } else if (this.placement) this.renderer.domElement.style.cursor = this.placement.valid ? 'copy' : 'not-allowed';

    this.renderFrame();
  }

  start(): void {
    const loop = () => {
      this.frame();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

function radialTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
