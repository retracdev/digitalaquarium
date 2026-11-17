import * as THREE from 'three';
import { seeded, type Rng } from '../core/rng';
import { std, withSway } from './materials';

export interface PlantRig {
  group: THREE.Group;
  glow: THREE.MeshStandardMaterial[];
  height: number;
  update(t: number): void;
}

function leafShape(len: number, wid: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(wid, len * 0.4, 0, len);
  s.quadraticCurveTo(-wid, len * 0.4, 0, 0);
  return s;
}

function swayMat(color: THREE.ColorRepresentation, height: number, amp: number, rng: Rng, extra: THREE.MeshStandardMaterialParameters = {}) {
  return withSway(std(color, { side: THREE.DoubleSide, roughness: 0.8, ...extra }), { height, amp, phase: rng() * 10, speed: 0.8 + rng() * 0.4 });
}

function javaFern(rng: Rng): PlantRig {
  const group = new THREE.Group();
  const h = 1.0;
  const mat = swayMat('#2f7d3a', h, 0.12, rng);
  const mat2 = swayMat('#3f9a47', h, 0.12, rng);
  for (let i = 0; i < 9; i++) {
    const len = 0.6 + rng() * 0.45;
    const g = new THREE.ShapeGeometry(leafShape(len, 0.13), 6);
    const leaf = new THREE.Mesh(g, i % 2 ? mat : mat2);
    leaf.rotation.y = (i / 9) * Math.PI * 2 + rng() * 0.4;
    leaf.rotation.x = -0.25 - rng() * 0.35;
    group.add(leaf);
  }
  // rhizome nub
  group.add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), std('#5a4630')));
  return { group, glow: [], height: h, update() {} };
}

function eelgrass(rng: Rng): PlantRig {
  const group = new THREE.Group();
  const h = 2.6;
  const mat = swayMat('#5fae4a', h, 0.45, rng);
  const mat2 = swayMat('#7cc35a', h, 0.5, rng);
  for (let i = 0; i < 14; i++) {
    const len = 1.5 + rng() * 1.1;
    const g = new THREE.PlaneGeometry(0.07, len, 1, 14);
    g.translate(0, len / 2, 0);
    const blade = new THREE.Mesh(g, i % 3 ? mat : mat2);
    blade.position.set((rng() - 0.5) * 0.4, 0, (rng() - 0.5) * 0.3);
    blade.rotation.y = rng() * Math.PI;
    blade.rotation.z = (rng() - 0.5) * 0.2;
    group.add(blade);
  }
  return { group, glow: [], height: h, update() {} };
}

function mossBall(rng: Rng): PlantRig {
  const group = new THREE.Group();
  const g = new THREE.IcosahedronGeometry(0.3, 4);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = Math.sin(v.x * 40) * Math.sin(v.y * 37) * Math.sin(v.z * 43);
    v.multiplyScalar(1 + n * 0.06 + rng() * 0.03);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const ball = new THREE.Mesh(g, std('#2f6b2a', { roughness: 1, flatShading: true }));
  ball.position.y = 0.26;
  group.add(ball);
  const off = rng() * 10;
  return {
    group,
    glow: [],
    height: 0.6,
    update(t) {
      ball.rotation.y = Math.sin(t * 0.2 + off) * 0.3;
      ball.position.y = 0.26 + Math.sin(t * 0.7 + off) * 0.015;
    },
  };
}

function ludwigia(rng: Rng): PlantRig {
  const group = new THREE.Group();
  const h = 1.6;
  const stemMat = swayMat('#4d7a35', h, 0.18, rng);
  const leafMats = ['#6aa83f', '#b8613a', '#d0453c', '#e0523f'].map((c) => swayMat(c, h, 0.18, rng));
  for (let s = 0; s < 5; s++) {
    const sh = 1.0 + rng() * 0.6;
    const sx = (rng() - 0.5) * 0.35;
    const sz = (rng() - 0.5) * 0.35;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.025, sh, 5, 6).translate(0, sh / 2, 0), stemMat);
    stem.position.set(sx, 0, sz);
    group.add(stem);
    for (let y = 0.2; y < sh; y += 0.16) {
      const k = y / sh;
      const mat = leafMats[Math.min(3, Math.floor(k * 4))];
      for (const side of [-1, 1]) {
        const g = new THREE.ShapeGeometry(leafShape(0.18, 0.06), 3);
        g.rotateZ(side * (Math.PI / 2 - 0.4));
        g.rotateY(y * 7 + s);
        g.translate(sx, y, sz);
        group.add(new THREE.Mesh(g, mat));
      }
    }
  }
  return { group, glow: [], height: h, update() {} };
}

function kelp(rng: Rng): PlantRig {
  const group = new THREE.Group();
  const h = 3.3;
  const mat = swayMat('#7a7a2e', h, 0.6, rng);
  const mat2 = swayMat('#8f8a3a', h, 0.55, rng);
  const bulbMat = swayMat('#a39a45', h, 0.6, rng);
  for (let i = 0; i < 4; i++) {
    const len = 2.4 + rng() * 0.9;
    const g = new THREE.PlaneGeometry(0.28, len, 2, 20);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let j = 0; j < pos.count; j++) {
      const y = pos.getY(j) + len / 2;
      pos.setX(j, pos.getX(j) * (0.6 + 0.4 * Math.sin((y / len) * Math.PI)) + Math.sin(y * 3) * 0.04);
      pos.setZ(j, Math.sin(y * 5 + pos.getX(j) * 20) * 0.03);
    }
    g.translate(0, len / 2, 0);
    g.computeVertexNormals();
    const blade = new THREE.Mesh(g, i % 2 ? mat : mat2);
    blade.position.set((rng() - 0.5) * 0.35, 0, (rng() - 0.5) * 0.25);
    blade.rotation.y = rng() * Math.PI;
    group.add(blade);
    for (let b = 0; b < 3; b++) {
      const bulbGeo = new THREE.SphereGeometry(0.05, 8, 6).translate(blade.position.x, 0.6 + b * 0.7 + rng() * 0.3, blade.position.z);
      group.add(new THREE.Mesh(bulbGeo, bulbMat));
    }
  }
  return { group, glow: [], height: h, update() {} };
}

function glowCoral(rng: Rng): PlantRig {
  const group = new THREE.Group();
  const palette = rng() > 0.5 ? ['#ff5fa2', '#ffb3d6'] : ['#3ef2d0', '#b7fff1'];
  const mat = std(palette[0], { emissive: palette[0], emissiveIntensity: 0.2, roughness: 0.5 });
  const tipMat = std(palette[1], { emissive: palette[1], emissiveIntensity: 0.5 });
  const branch = (parent: THREE.Object3D, len: number, rad: number, depth: number) => {
    const g = new THREE.CylinderGeometry(rad * 0.7, rad, len, 6).translate(0, len / 2, 0);
    const m = new THREE.Mesh(g, mat);
    parent.add(m);
    if (depth === 0) {
      const tip = new THREE.Mesh(new THREE.SphereGeometry(rad * 1.3, 8, 6), tipMat);
      tip.position.y = len;
      m.add(tip);
      return;
    }
    const kids = 2 + Math.floor(rng() * 2);
    for (let i = 0; i < kids; i++) {
      const pivot = new THREE.Group();
      pivot.position.y = len;
      pivot.rotation.set((rng() - 0.5) * 1.2, rng() * Math.PI * 2, (rng() - 0.5) * 1.2);
      m.add(pivot);
      branch(pivot, len * 0.72, rad * 0.7, depth - 1);
    }
  };
  branch(group, 0.45, 0.09, 3);
  const off = rng() * 10;
  return {
    group,
    glow: [mat, tipMat],
    height: 1.2,
    update(t) {
      group.rotation.z = Math.sin(t * 0.5 + off) * 0.02;
    },
  };
}

function anemone(rng: Rng): PlantRig {
  const group = new THREE.Group();
  const h = 0.9;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.3, 16).translate(0, 0.15, 0), std('#8a3d6e', { roughness: 0.6 }));
  group.add(base);
  const mat = swayMat('#d16bb5', h, 0.18, rng, { emissive: '#ff8fd8', emissiveIntensity: 0.12 });
  for (let i = 0; i < 46; i++) {
    const len = 0.45 + rng() * 0.35;
    const g = new THREE.CylinderGeometry(0.012, 0.035, len, 5).translate(0, len / 2, 0);
    const a = rng() * Math.PI * 2;
    const r = rng() * 0.25;
    const tilt = 0.2 + r * 2;
    g.rotateZ(-tilt);
    g.rotateY(-a);
    g.translate(Math.cos(a) * r, 0.28, Math.sin(a) * r);
    group.add(new THREE.Mesh(g, mat));
  }
  return { group, glow: [mat], height: h, update() {} };
}

function starbloom(rng: Rng): PlantRig {
  const group = new THREE.Group();
  const h = 1.3;
  const stemMat = swayMat('#3c7a5a', h, 0.15, rng);
  const petalMat = std('#ffd36b', { emissive: '#ffcf5a', emissiveIntensity: 0.6, side: THREE.DoubleSide });
  const heads: THREE.Group[] = [];
  for (let i = 0; i < 3; i++) {
    const sh = 0.8 + rng() * 0.5;
    const sx = (rng() - 0.5) * 0.4;
    const sz = (rng() - 0.5) * 0.3;
    group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.025, sh, 5, 6).translate(sx, sh / 2, sz), stemMat));
    const star = new THREE.Shape();
    for (let k = 0; k < 10; k++) {
      const r = k % 2 ? 0.07 : 0.18;
      const a = (k / 10) * Math.PI * 2;
      if (k === 0) star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const head = new THREE.Group();
    head.add(new THREE.Mesh(new THREE.ShapeGeometry(star), petalMat));
    head.position.set(sx, sh, sz);
    head.rotation.x = -0.5;
    group.add(head);
    heads.push(head);
  }
  return {
    group,
    glow: [petalMat],
    height: h,
    update(t) {
      heads.forEach((hd, i) => (hd.rotation.z = t * 0.3 + i));
    },
  };
}

const BUILDERS: Record<string, (rng: Rng) => PlantRig> = {
  java_fern: javaFern,
  eelgrass,
  moss_ball: mossBall,
  red_ludwigia: ludwigia,
  kelp,
  glow_coral: glowCoral,
  anemone,
  starbloom,
};

export function buildPlant(type: string, seed: number): PlantRig {
  return (BUILDERS[type] ?? javaFern)(seeded(seed));
}
