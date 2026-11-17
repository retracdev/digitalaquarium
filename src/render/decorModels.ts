import * as THREE from 'three';
import { seeded, type Rng } from '../core/rng';
import { std, withCaustics } from './materials';

export interface DecorRig {
  group: THREE.Group;
  glow: THREE.MeshStandardMaterial[];
  /** Local points that emit bubble streams. */
  bubblers: THREE.Vector3[];
  update(t: number, opts: { ready: boolean; night: number }): void;
}

const cstd = (color: THREE.ColorRepresentation, extra: THREE.MeshStandardMaterialParameters = {}) => withCaustics(std(color, extra), 0.45);

function rock(rng: Rng, size: number, color: string): THREE.Mesh {
  const g = new THREE.DodecahedronGeometry(size, 1);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    v.multiplyScalar(0.85 + rng() * 0.3);
    v.y *= 0.65;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, cstd(color, { flatShading: true, roughness: 0.9 }));
  m.rotation.y = rng() * Math.PI;
  return m;
}

function rocks(rng: Rng): DecorRig {
  const group = new THREE.Group();
  const shades = ['#7d7f88', '#8e8a80', '#6b6e78', '#a09a8c'];
  for (let i = 0; i < 4; i++) {
    const r = rock(rng, 0.18 + rng() * 0.22, shades[i % shades.length]);
    r.position.set((rng() - 0.5) * 0.7, 0.05, (rng() - 0.5) * 0.5);
    group.add(r);
  }
  return { group, glow: [], bubblers: [], update() {} };
}

function driftwood(rng: Rng): DecorRig {
  const group = new THREE.Group();
  const mat = cstd('#6b4a2f', { roughness: 0.95 });
  const limb = (from: THREE.Vector3, to: THREE.Vector3, r: number) => {
    const curve = new THREE.QuadraticBezierCurve3(from, from.clone().lerp(to, 0.5).add(new THREE.Vector3(0, 0.15, (rng() - 0.5) * 0.3)), to);
    const g = new THREE.TubeGeometry(curve, 10, r, 7);
    group.add(new THREE.Mesh(g, mat));
  };
  limb(new THREE.Vector3(-0.8, 0.05, 0), new THREE.Vector3(0.7, 0.35, 0.1), 0.09);
  limb(new THREE.Vector3(-0.1, 0.15, 0), new THREE.Vector3(0.1, 0.95, -0.2), 0.06);
  limb(new THREE.Vector3(0.3, 0.25, 0.05), new THREE.Vector3(0.75, 0.8, 0.25), 0.045);
  limb(new THREE.Vector3(-0.5, 0.1, 0), new THREE.Vector3(-0.85, 0.6, -0.15), 0.05);
  return { group, glow: [], bubblers: [], update() {} };
}

function airstone(): DecorRig {
  const group = new THREE.Group();
  const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.1, 16), cstd('#3d5a73', { roughness: 0.95 }));
  stone.position.y = 0.05;
  group.add(stone);
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.15, 0.06, 0), new THREE.Vector3(0.4, 0.05, -0.2), new THREE.Vector3(0.5, 0.05, -0.8)]), 12, 0.02, 6),
    std('#c9d6dd', { transparent: true, opacity: 0.6 }),
  );
  group.add(tube);
  return { group, glow: [], bubblers: [new THREE.Vector3(0, 0.1, 0)], update() {} };
}

function chest(): DecorRig {
  const group = new THREE.Group();
  const wood = cstd('#7a4a26', { roughness: 0.8 });
  const gold = std('#e3b341', { metalness: 0.8, roughness: 0.3 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.36, 0.45), wood);
  base.position.y = 0.18;
  group.add(base);
  for (const x of [-0.25, 0.25]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.37, 0.46), gold);
    band.position.set(x, 0.18, 0);
    group.add(band);
  }
  const glowMat = std('#ffd36b', { emissive: '#ffcf5a', emissiveIntensity: 0, metalness: 0.6, roughness: 0.3 });
  const loot = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), glowMat);
  loot.scale.set(1.4, 0.5, 0.9);
  loot.position.y = 0.34;
  group.add(loot);
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 0.36, -0.225);
  group.add(lidPivot);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.7, 16, 1, false, 0, Math.PI), wood);
  lid.rotation.z = Math.PI / 2;
  lid.rotation.y = Math.PI / 2;
  lid.position.z = 0.225;
  lidPivot.add(lid);
  const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.03), gold);
  clasp.position.set(0, 0.0, 0.45);
  lidPivot.add(clasp);
  let open = 0;
  return {
    group,
    glow: [],
    bubblers: [],
    update(t, { ready }) {
      const target = ready ? 0.55 + Math.sin(t * 2) * 0.08 : 0;
      open += (target - open) * 0.08;
      lidPivot.rotation.x = -open;
      glowMat.emissiveIntensity = ready ? 1.4 + Math.sin(t * 3) * 0.5 : 0;
    },
  };
}

function castle(rng: Rng): DecorRig {
  const group = new THREE.Group();
  const stone = cstd('#b8b2a6', { roughness: 0.9 });
  const roof = cstd('#7d4e8f', { roughness: 0.6 });
  const keep = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.55), stone);
  keep.position.y = 0.35;
  group.add(keep);
  const door = new THREE.Mesh(new THREE.CircleGeometry(0.13, 16, 0, Math.PI), std('#1b1622'));
  door.position.set(0, 0.0, 0.28);
  door.scale.y = 1.8;
  group.add(door);
  for (const [x, z, h] of [
    [-0.42, 0.25, 1.1],
    [0.42, 0.25, 1.1],
    [-0.42, -0.25, 0.95],
    [0.42, -0.25, 1.25],
  ]) {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, h, 12), stone);
    tower.position.set(x, h / 2, z);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.35, 12), roof);
    cone.position.set(x, h + 0.17, z);
    group.add(tower, cone);
  }
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), stone);
    m.position.set(-0.3 + i * 0.15, 0.75, 0.25);
    group.add(m);
  }
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.12), std('#ff6b6b', { side: THREE.DoubleSide }));
  flag.position.set(0.52, 1.6, -0.25);
  group.add(flag);
  const off = rng() * 10;
  return {
    group,
    glow: [],
    bubblers: [new THREE.Vector3(0.42, 1.45, -0.25)],
    update(t) {
      flag.rotation.y = Math.sin(t * 2 + off) * 0.4;
    },
  };
}

function arch(rng: Rng): DecorRig {
  const group = new THREE.Group();
  const g = new THREE.TorusGeometry(0.75, 0.2, 10, 24, Math.PI);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i) * (0.95 + rng() * 0.1), pos.getY(i) * (0.95 + rng() * 0.1), pos.getZ(i) * (0.9 + rng() * 0.2));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, cstd('#8d7f6e', { flatShading: true, roughness: 0.95 }));
  m.scale.set(1, 1.15, 1.4);
  group.add(m);
  for (const x of [-0.75, 0.75]) {
    const r = rock(rng, 0.28, '#7e7365');
    r.position.set(x, 0.05, 0);
    group.add(r);
  }
  return { group, glow: [], bubblers: [], update() {} };
}

function amphora(): DecorRig {
  const group = new THREE.Group();
  const pts = [
    [0.0, 0],
    [0.14, 0.02],
    [0.3, 0.25],
    [0.33, 0.5],
    [0.24, 0.8],
    [0.1, 0.95],
    [0.1, 1.08],
    [0.15, 1.12],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const g = new THREE.LatheGeometry(pts, 20);
  const m = new THREE.Mesh(g, cstd('#b8643a', { roughness: 0.8, side: THREE.DoubleSide }));
  m.rotation.z = Math.PI / 2 - 0.25;
  m.position.set(0.45, 0.3, 0);
  group.add(m);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.02, 6, 20), std('#2d1d15'));
  band.rotation.copy(m.rotation);
  band.rotateX(Math.PI / 2);
  band.position.set(0.2, 0.36, 0);
  group.add(band);
  return { group, glow: [], bubblers: [new THREE.Vector3(-0.55, 0.55, 0)], update() {} };
}

function geode(rng: Rng): DecorRig {
  const group = new THREE.Group();
  const shell = rock(rng, 0.45, '#5b5566');
  shell.scale.set(1.2, 0.8, 1);
  group.add(shell);
  const mat = std('#b77cff', { emissive: '#a065ff', emissiveIntensity: 0.4, roughness: 0.15, metalness: 0.1, flatShading: true });
  for (let i = 0; i < 9; i++) {
    const h = 0.3 + rng() * 0.5;
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.07 + rng() * 0.05, h, 6), mat);
    c.position.set((rng() - 0.5) * 0.5, 0.25 + h / 2, (rng() - 0.5) * 0.35);
    c.rotation.set((rng() - 0.5) * 0.6, 0, (rng() - 0.5) * 0.6);
    group.add(c);
  }
  return { group, glow: [mat], bubblers: [], update() {} };
}

function volcano(): DecorRig {
  const group = new THREE.Group();
  const g = new THREE.CylinderGeometry(0.18, 0.75, 0.9, 20, 4, true);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const s = 1 + Math.sin(i * 1.7) * 0.06;
    pos.setX(i, pos.getX(i) * s);
    pos.setZ(i, pos.getZ(i) * s);
  }
  g.computeVertexNormals();
  const cone = new THREE.Mesh(g, cstd('#4a3b3b', { roughness: 0.95, flatShading: true }));
  cone.position.y = 0.45;
  group.add(cone);
  const lava = std('#ff6a2b', { emissive: '#ff4d1a', emissiveIntensity: 1.2 });
  const crater = new THREE.Mesh(new THREE.CircleGeometry(0.17, 16), lava);
  crater.rotation.x = -Math.PI / 2;
  crater.position.y = 0.88;
  group.add(crater);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const streak = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.45, 0.02), lava);
    streak.position.set(Math.cos(a) * 0.38, 0.6, Math.sin(a) * 0.38);
    streak.lookAt(0, 2, 0);
    streak.rotation.z += 0.0;
    group.add(streak);
  }
  return {
    group,
    glow: [lava],
    bubblers: [new THREE.Vector3(0, 0.9, 0)],
    update(t) {
      lava.emissiveIntensity = 1 + Math.sin(t * 1.7) * 0.3;
    },
  };
}

function satellite(): DecorRig {
  const group = new THREE.Group();
  const pivot = new THREE.Group();
  pivot.rotation.set(0.35, 0.4, -0.5);
  pivot.position.y = 0.45;
  group.add(pivot);
  const bodyMat = std('#d9d4c4', { metalness: 0.6, roughness: 0.35 });
  const foil = std('#d6a63a', { metalness: 0.9, roughness: 0.25 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.6), foil);
  pivot.add(body);
  const panelMat = std('#2a3f8f', { metalness: 0.5, roughness: 0.3, emissive: '#1d2f80', emissiveIntensity: 0.2 });
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 6), bodyMat);
    arm.rotation.z = Math.PI / 2;
    arm.position.x = side * 0.42;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.02, 0.4), panelMat);
    panel.position.x = side * 0.98;
    pivot.add(arm, panel);
  }
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3), std('#f0eee8', { side: THREE.DoubleSide, metalness: 0.3 }));
  dish.position.z = 0.42;
  dish.rotation.x = -Math.PI / 2;
  pivot.add(dish);
  const blinkMat = std('#ff3355', { emissive: '#ff3355', emissiveIntensity: 2 });
  const blink = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), blinkMat);
  blink.position.set(0, 0.26, 0);
  pivot.add(blink);
  return {
    group,
    glow: [panelMat],
    bubblers: [new THREE.Vector3(0.2, 0.7, 0)],
    update(t) {
      blinkMat.emissiveIntensity = Math.sin(t * 3) > 0.6 ? 3 : 0.1;
    },
  };
}

const BUILDERS: Record<string, (rng: Rng) => DecorRig> = {
  rocks,
  driftwood,
  airstone: () => airstone(),
  treasure_chest: () => chest(),
  castle,
  arch,
  amphora: () => amphora(),
  geode,
  volcano: () => volcano(),
  satellite: () => satellite(),
};

export function buildDecor(type: string, seed: number): DecorRig {
  return (BUILDERS[type] ?? rocks)(seeded(seed));
}
