import * as THREE from 'three';
import type { FishLook, FishShape, Pattern } from '../core/catalog';
import { seeded, type Rng } from '../core/rng';

/**
 * Procedural creature meshes. Every rig faces +Z (so Object3D.lookAt points the
 * nose along the swim direction) and is roughly 2 units long before scaling.
 */
export interface FishRig {
  root: THREE.Group;
  body: THREE.Group;
  /** Materials whose colour can be desaturated when the fish is unwell. */
  tintables: { mat: THREE.MeshStandardMaterial; base: THREE.Color }[];
  glow: THREE.MeshStandardMaterial[];
  upright: boolean;
  animate(t: number, speed: number, dt: number): void;
  puff?: (amount: number) => void;
  radius: number;
}

interface ShapeCfg {
  len: number;
  h: number;
  w: number;
  taper: number;
  flatBelly?: boolean;
  tail: 'fork' | 'fan' | 'flow' | 'round' | 'double';
  tailSize: number;
  dorsal: 'small' | 'tall' | 'sail' | 'flow' | 'none';
  anal?: 'sail' | 'flow';
  whiskers?: boolean;
}

const CFG: Partial<Record<FishShape, ShapeCfg>> = {
  slim: { len: 1, h: 0.3, w: 0.17, taper: 0.85, tail: 'fork', tailSize: 0.5, dorsal: 'small' },
  guppy: { len: 0.85, h: 0.3, w: 0.17, taper: 0.85, tail: 'fan', tailSize: 1.05, dorsal: 'small' },
  round: { len: 0.72, h: 0.58, w: 0.45, taper: 0.7, tail: 'double', tailSize: 0.85, dorsal: 'small' },
  cory: { len: 0.9, h: 0.38, w: 0.3, taper: 0.75, flatBelly: true, tail: 'fork', tailSize: 0.45, dorsal: 'tall', whiskers: true },
  betta: { len: 0.85, h: 0.34, w: 0.2, taper: 0.8, tail: 'flow', tailSize: 1.3, dorsal: 'flow', anal: 'flow' },
  tall: { len: 0.6, h: 0.62, w: 0.12, taper: 0.7, tail: 'fork', tailSize: 0.55, dorsal: 'sail', anal: 'sail' },
  clown: { len: 0.78, h: 0.42, w: 0.25, taper: 0.75, tail: 'round', tailSize: 0.45, dorsal: 'small' },
  puffer: { len: 0.62, h: 0.52, w: 0.5, taper: 0.6, tail: 'round', tailSize: 0.35, dorsal: 'small' },
  koi: { len: 1.25, h: 0.36, w: 0.3, taper: 0.85, tail: 'flow', tailSize: 0.9, dorsal: 'small', whiskers: true },
  angler: { len: 0.75, h: 0.62, w: 0.55, taper: 0.65, tail: 'round', tailSize: 0.4, dorsal: 'none' },
};

const tmpC = new THREE.Color();
const WHITE = new THREE.Color('#ffffff');

function patternColor(pattern: Pattern, body: THREE.Color, accent: THREE.Color, nx: number, ny: number, nz: number, rng: Rng, spots: THREE.Vector3[]): THREE.Color {
  const c = tmpC.copy(body);
  // shading: darker back, lighter belly
  if (ny < 0) c.lerp(WHITE, Math.min(0.55, -ny * 0.7));
  else c.multiplyScalar(1 - ny * 0.18);
  switch (pattern) {
    case 'stripe':
      // neon-style: accent on the lower rear half, a bright lateral line
      if (nz < 0.1 && ny < 0.05) c.lerp(accent, 0.9);
      if (Math.abs(ny - 0.12) < 0.12) c.lerp(WHITE, 0.25);
      break;
    case 'bands': {
      const band = Math.sin((nz + 0.15) * 7.5);
      if (band > 0.72) c.copy(accent);
      break;
    }
    case 'spots':
      for (const s of spots) {
        if (Math.hypot(nx - s.x, ny - s.y, nz - s.z) < 0.16) {
          c.lerp(accent, 0.9);
          break;
        }
      }
      break;
    case 'none':
    default:
      if (nz < -0.3) c.lerp(accent, Math.min(1, (-nz - 0.3) * 1.2));
  }
  void rng;
  return c;
}

function ellipsoidBody(cfg: ShapeCfg, look: FishLook, rng: Rng): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, 36, 22);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const nor = g.attributes.normal as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const body = new THREE.Color(look.body);
  const accent = new THREE.Color(look.accent);
  const spots: THREE.Vector3[] = [];
  for (let i = 0; i < 26; i++) spots.push(new THREE.Vector3(rng() * 2 - 1, rng() * 1.6 - 0.6, rng() * 2 - 1).normalize());
  for (let i = 0; i < pos.count; i++) {
    const ux = pos.getX(i);
    const uy = pos.getY(i);
    const uz = pos.getZ(i);
    let x = ux;
    let y = uy;
    if (uz < 0) {
      const k = 1 - cfg.taper * Math.pow(-uz, 1.6) * 0.78;
      x *= k;
      y *= k;
    }
    if (cfg.flatBelly && y < 0) y *= 0.55;
    pos.setXYZ(i, x * cfg.w, y * cfg.h, uz * cfg.len);
    const n = new THREE.Vector3(ux / cfg.w, uy / cfg.h, uz / cfg.len).normalize();
    nor.setXYZ(i, n.x, n.y, n.z);
    const c = patternColor(look.pattern, body, accent, ux, uy, uz, rng, spots);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

/** A 2D outline drawn with +x = backwards, +y = up, turned into a fin in the YZ plane. */
function finGeo(points: [number, number][], curved = true): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(points[0][0], points[0][1]);
  if (curved && points.length >= 3) {
    for (let i = 1; i < points.length - 1; i += 2) {
      const [cx, cy] = points[i];
      const [x, y] = points[i + 1] ?? points[0];
      s.quadraticCurveTo(cx, cy, x, y);
    }
  } else {
    for (const [x, y] of points.slice(1)) s.lineTo(x, y);
  }
  s.closePath();
  const g = new THREE.ShapeGeometry(s, 10);
  g.rotateY(Math.PI / 2); // shape x → -z
  return g;
}

function finMat(color: THREE.ColorRepresentation, opacity = 0.85): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, side: THREE.DoubleSide, transparent: true, opacity, depthWrite: opacity > 0.95 });
}

function tailGeo(kind: ShapeCfg['tail'], size: number, h: number): THREE.BufferGeometry {
  const s = size;
  switch (kind) {
    case 'fork':
      return finGeo([[0, 0.08 * h], [0.55 * s, 0.75 * h * s + 0.1], [0.42 * s, 0], [0.55 * s, -0.75 * h * s - 0.1], [0, -0.08 * h]], false);
    case 'fan':
      return finGeo([[0, 0.06], [0.5 * s, 0.7 * s], [0.9 * s, 0.1], [0.92 * s, -0.25], [0.5 * s, -0.7 * s], [0, -0.06]], false);
    case 'flow':
      return finGeo([[0, 0.1], [0.6 * s, 0.9 * s], [1.1 * s, 0.4 * s], [1.0 * s, -0.1], [1.15 * s, -0.6 * s], [0.5 * s, -0.85 * s], [0, -0.1]], false);
    case 'double':
      return finGeo([[0, 0.12], [0.5 * s, 0.75 * s], [0.95 * s, 0.55 * s], [0.6 * s, 0], [0.95 * s, -0.55 * s], [0.5 * s, -0.75 * s], [0, -0.12]], false);
    case 'round':
    default:
      return finGeo([[0, 0.1], [0.35 * s, 0.55 * s], [0.62 * s, 0.25 * s], [0.66 * s, 0], [0.62 * s, -0.25 * s], [0.35 * s, -0.55 * s], [0, -0.1]], false);
  }
}

function addEyes(group: THREE.Group, cfg: { len: number; h: number; w: number }, scale = 1, z = 0.62, y = 0.2): void {
  const eyeR = Math.max(0.055, cfg.h * 0.16) * scale;
  const white = new THREE.MeshStandardMaterial({ color: '#f5f7ff', roughness: 0.2 });
  const black = new THREE.MeshStandardMaterial({ color: '#0b0a10', roughness: 0.1, metalness: 0.3 });
  const zz = cfg.len * z;
  const yy = cfg.h * y;
  const rem = Math.max(0.05, 1 - (zz / cfg.len) ** 2 - (yy / cfg.h) ** 2);
  const xx = cfg.w * Math.sqrt(rem) * 0.92;
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(eyeR, 12, 10), white);
    eye.position.set(side * xx, yy, zz);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(eyeR * 0.6, 10, 8), black);
    pupil.position.set(side * eyeR * 0.55, 0, eyeR * 0.25);
    eye.add(pupil);
    group.add(eye);
  }
}

function standardFish(shape: FishShape, look: FishLook, rng: Rng): FishRig {
  const cfg = CFG[shape]!;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.18 });
  const bodyMesh = new THREE.Mesh(ellipsoidBody(cfg, look, rng), bodyMat);
  body.add(bodyMesh);
  const finColor = look.fin ?? look.accent;
  const fMat = finMat(finColor, shape === 'betta' || shape === 'guppy' ? 0.82 : 0.88);
  const tintables: FishRig['tintables'] = [
    { mat: fMat, base: fMat.color.clone() },
    { mat: bodyMat, base: bodyMat.color.clone() },
  ];
  const glow: THREE.MeshStandardMaterial[] = [];

  // Tail (possibly layered for flowing fins)
  const tailPivot = new THREE.Group();
  tailPivot.position.z = -cfg.len * (1 - cfg.taper * 0.12);
  body.add(tailPivot);
  const tailLayers: THREE.Mesh[] = [];
  const layers = cfg.tail === 'flow' ? 3 : 1;
  for (let i = 0; i < layers; i++) {
    const m = new THREE.Mesh(tailGeo(cfg.tail, cfg.tailSize * (1 - i * 0.12), cfg.h), i === 0 ? fMat : finMat(finColor, 0.5));
    m.position.z = -0.02 * i;
    tailLayers.push(m);
    tailPivot.add(m);
  }

  // Dorsal / anal fins
  const extra: THREE.Mesh[] = [];
  const dorsalShapes: Record<string, [number, number][]> = {
    small: [[-0.25, 0], [0.05, 0.22], [0.3, 0]],
    tall: [[-0.2, 0], [-0.05, 0.42], [0.3, 0]],
    sail: [[-0.3, 0], [0.2, 0.75], [0.75, 0.9], [0.2, 0.1], [0.3, 0]],
    flow: [[-0.35, 0], [0.1, 0.5], [0.8, 0.35], [0.3, 0]],
  };
  if (cfg.dorsal !== 'none') {
    const d = new THREE.Mesh(finGeo(dorsalShapes[cfg.dorsal], false), fMat);
    d.position.set(0, cfg.h * 0.88, -cfg.len * 0.05);
    body.add(d);
    extra.push(d);
  }
  if (cfg.anal) {
    const pts = dorsalShapes[cfg.anal].map(([x, y]) => [x, -y] as [number, number]);
    const a = new THREE.Mesh(finGeo(pts, false), fMat);
    a.position.set(0, -cfg.h * 0.85, -cfg.len * 0.2);
    body.add(a);
    extra.push(a);
  }

  // Pectoral fins
  const pecs: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const g = new THREE.CircleGeometry(0.13 + cfg.h * 0.15, 12);
    g.scale(1, 0.55, 1);
    g.translate(0.12, 0, 0);
    const p = new THREE.Mesh(g, fMat);
    p.position.set(side * cfg.w * 0.85, -cfg.h * 0.25, cfg.len * 0.25);
    p.rotation.set(0, side > 0 ? -0.6 : Math.PI + 0.6, 0);
    body.add(p);
    pecs.push(p);
  }

  if (cfg.whiskers) {
    const wMat = new THREE.LineBasicMaterial({ color: look.accent });
    for (const side of [-1, 1]) {
      const pts = [new THREE.Vector3(side * 0.05, -cfg.h * 0.2, cfg.len * 0.95), new THREE.Vector3(side * 0.18, -cfg.h * 0.5, cfg.len * 1.12)];
      body.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wMat));
    }
  }

  addEyes(body, cfg, shape === 'angler' ? 0.7 : 1, shape === 'angler' ? 0.55 : 0.62, shape === 'angler' ? 0.45 : 0.2);

  // Species specials
  let lureLight: THREE.Mesh | null = null;
  if (shape === 'angler') {
    const stalkCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, cfg.h * 0.85, cfg.len * 0.35),
      new THREE.Vector3(0, cfg.h * 1.9, cfg.len * 0.9),
      new THREE.Vector3(0, cfg.h * 1.2, cfg.len * 1.45),
    );
    body.add(new THREE.Mesh(new THREE.TubeGeometry(stalkCurve, 12, 0.02, 6), new THREE.MeshStandardMaterial({ color: look.body, roughness: 0.6 })));
    const lureMat = new THREE.MeshStandardMaterial({ color: look.accent, emissive: look.accent, emissiveIntensity: 2.5 });
    lureLight = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), lureMat);
    lureLight.position.copy(stalkCurve.getPoint(1));
    body.add(lureLight);
    glow.push(lureMat);
    // grumpy mouth + teeth
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(cfg.w * 0.55, 0.05, 8, 20, Math.PI), new THREE.MeshStandardMaterial({ color: '#120d1a' }));
    mouth.position.set(0, -cfg.h * 0.15, cfg.len * 0.82);
    mouth.rotation.set(0, 0, Math.PI);
    body.add(mouth);
    const toothMat = new THREE.MeshStandardMaterial({ color: '#f2f0e6' });
    for (let i = 0; i < 7; i++) {
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.09, 5), toothMat);
      const a = Math.PI * (0.15 + (i / 6) * 0.7);
      tooth.position.set(Math.cos(a) * cfg.w * 0.55, -cfg.h * 0.15 - Math.sin(a) * 0.02 + 0.03, cfg.len * 0.85);
      tooth.rotation.x = Math.PI;
      body.add(tooth);
    }
  }

  // Glowing species: emissive spots/fins
  if (look.glow && shape !== 'angler') {
    bodyMat.emissive = new THREE.Color(look.accent);
    bodyMat.emissiveIntensity = 0;
    glow.push(bodyMat);
    fMat.emissive = new THREE.Color(look.fin ?? look.accent);
    fMat.emissiveIntensity = 0;
    glow.push(fMat);
  }

  // Puffer spikes
  const spikes: THREE.Mesh[] = [];
  if (shape === 'puffer') {
    const spikeMat = new THREE.MeshStandardMaterial({ color: '#efe3b8', roughness: 0.6 });
    for (let i = 0; i < 46; i++) {
      const dir = new THREE.Vector3(rng() * 2 - 1, rng() * 2 - 1, rng() * 1.6 - 0.7).normalize();
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.14, 5), spikeMat);
      spike.position.set(dir.x * cfg.w, dir.y * cfg.h, dir.z * cfg.len);
      spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      spike.scale.setScalar(0.01);
      bodyMesh.add(spike);
      spikes.push(spike);
    }
  }

  let phase = rng() * 10;
  let puffAmt = 0;
  let puffTarget = 0;
  return {
    root,
    body,
    tintables,
    glow,
    upright: false,
    radius: Math.max(cfg.len, cfg.h),
    animate(t, speed, dt) {
      phase += dt * (3 + speed * 9);
      const amp = 0.35 + Math.min(0.4, speed * 0.4);
      tailPivot.rotation.y = Math.sin(phase) * amp;
      tailLayers.forEach((l, i) => (l.rotation.y = Math.sin(phase - (i + 1) * 0.6) * 0.25 * i));
      body.rotation.y = Math.sin(phase + 1.2) * 0.06;
      pecs.forEach((p, i) => (p.rotation.z = Math.sin(t * 6 + i * Math.PI) * 0.35));
      if (cfg.dorsal === 'flow' || cfg.dorsal === 'sail') extra.forEach((e, i) => (e.rotation.y = Math.sin(phase * 0.5 + i) * 0.12));
      if (lureLight) lureLight.position.y = cfg.h * 1.2 + Math.sin(t * 2) * 0.04;
      if (spikes.length) {
        puffAmt += (puffTarget - puffAmt) * Math.min(1, dt * 5);
        if (puffTarget > 0) puffTarget = Math.max(0, puffTarget - dt * 0.25);
        const s = 1 + puffAmt * 0.55;
        bodyMesh.scale.set(s, s * 1.05, 1 + puffAmt * 0.25);
        for (const sp of spikes) sp.scale.setScalar(0.01 + puffAmt);
      }
    },
    puff: shape === 'puffer' ? (a: number) => (puffTarget = a) : undefined,
  };
}

function seahorse(look: FishLook, rng: Rng): FishRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const mat = new THREE.MeshStandardMaterial({ color: look.body, roughness: 0.5, metalness: 0.1 });
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.85, -0.05),
    new THREE.Vector3(0, 0.55, 0.12),
    new THREE.Vector3(0, 0.15, 0.12),
    new THREE.Vector3(0, -0.25, -0.02),
    new THREE.Vector3(0, -0.55, 0.0),
    new THREE.Vector3(0, -0.72, -0.18),
    new THREE.Vector3(0, -0.62, -0.32),
    new THREE.Vector3(0, -0.5, -0.22),
  ]);
  const segs = 22;
  for (let i = 0; i < segs; i++) {
    const t = i / (segs - 1);
    const r = 0.2 * (1 - t) ** 0.9 + 0.035 + (t < 0.25 ? 0.05 * Math.sin(t * 12) : 0);
    const seg = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), i % 3 === 0 ? new THREE.MeshStandardMaterial({ color: look.accent, roughness: 0.5 }) : mat);
    seg.position.copy(curve.getPoint(t));
    seg.scale.set(0.8, 1, 1);
    body.add(seg);
  }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 12), mat);
  head.position.set(0, 0.95, 0.02);
  body.add(head);
  const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.06, 0.38, 8), mat);
  snout.rotation.x = Math.PI / 2 + 0.2;
  snout.position.set(0, 0.9, 0.26);
  body.add(snout);
  const crown = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 6), new THREE.MeshStandardMaterial({ color: look.accent }));
  crown.position.set(0, 1.12, -0.03);
  body.add(crown);
  addEyes(body, { len: 0.17, h: 0.17, w: 0.17 }, 0.9, 0.1, 0.05);
  body.children.slice(-2).forEach((e) => (e.position.y += 0.95));
  const finM = finMat(look.accent, 0.7);
  const fin = new THREE.Mesh(finGeo([[0, 0.15], [0.25, 0.1], [0.28, -0.1], [0, -0.15]], false), finM);
  fin.position.set(0, 0.1, -0.08);
  body.add(fin);
  let phase = rng() * 10;
  return {
    root,
    body,
    tintables: [{ mat, base: mat.color.clone() }],
    glow: [],
    upright: true,
    radius: 1,
    animate(t, _speed, dt) {
      phase += dt * 14;
      fin.rotation.y = Math.sin(phase) * 0.6;
      body.rotation.x = Math.sin(t * 0.8) * 0.06;
    },
  };
}

function jelly(look: FishLook, rng: Rng): FishRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const bellMat = new THREE.MeshStandardMaterial({
    color: look.body,
    emissive: look.body,
    emissiveIntensity: 0.15,
    transparent: true,
    opacity: 0.55,
    roughness: 0.15,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.6, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), bellMat);
  bell.scale.y = 0.75;
  body.add(bell);
  const innerMat = new THREE.MeshStandardMaterial({ color: look.accent, emissive: look.accent, emissiveIntensity: 0.4, transparent: true, opacity: 0.8 });
  for (let i = 0; i < 4; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 8, 16), innerMat);
    const a = (i / 4) * Math.PI * 2;
    ring.position.set(Math.cos(a) * 0.18, 0.18, Math.sin(a) * 0.18);
    ring.rotation.x = Math.PI / 2;
    body.add(ring);
  }
  const tentacleCount = 18;
  const pts = 9;
  const lineGeo = new THREE.BufferGeometry();
  const arr = new Float32Array(tentacleCount * (pts - 1) * 2 * 3);
  lineGeo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const lines = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: look.body, transparent: true, opacity: 0.55 }));
  body.add(lines);
  const armMat = new THREE.MeshStandardMaterial({ color: look.accent, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false });
  const arms: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.PlaneGeometry(0.12, 0.9, 1, 8);
    g.translate(0, -0.45, 0);
    const m = new THREE.Mesh(g, armMat);
    m.rotation.y = (i / 4) * Math.PI;
    body.add(m);
    arms.push(m);
  }
  let phase = rng() * 10;
  return {
    root,
    body,
    tintables: [],
    glow: [bellMat, innerMat],
    upright: true,
    radius: 0.7,
    animate(t, _speed, dt) {
      phase += dt * 2.2;
      const pulse = Math.sin(phase);
      bell.scale.set(1 + pulse * 0.1, 0.75 - pulse * 0.08, 1 + pulse * 0.1);
      let k = 0;
      for (let i = 0; i < tentacleCount; i++) {
        const a = (i / tentacleCount) * Math.PI * 2;
        const r = 0.56 * (1 + pulse * 0.1);
        let px = Math.cos(a) * r;
        let pz = Math.sin(a) * r;
        let py = 0;
        for (let j = 1; j < pts; j++) {
          const nx = Math.cos(a) * r * (1 - j * 0.06) + Math.sin(t * 1.5 + j * 0.7 + i) * 0.05 * j;
          const nz = Math.sin(a) * r * (1 - j * 0.06) + Math.cos(t * 1.3 + j * 0.6 + i) * 0.05 * j;
          const ny = -j * 0.17;
          arr.set([px, py, pz, nx, ny, nz], k);
          k += 6;
          px = nx;
          py = ny;
          pz = nz;
        }
      }
      lineGeo.attributes.position.needsUpdate = true;
      arms.forEach((a, i) => (a.rotation.z = Math.sin(t * 1.2 + i) * 0.15));
    },
  };
}

function ray(look: FishLook, rng: Rng): FishRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const g = new THREE.SphereGeometry(1, 40, 16);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const base = new Float32Array(pos.count * 3);
  const colors = new Float32Array(pos.count * 3);
  const top = new THREE.Color(look.body);
  const accent = new THREE.Color(look.accent);
  const spots = Array.from({ length: 30 }, () => [rng() * 1.8 - 0.9, rng() * 1.4 - 0.7] as const);
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    x *= 1.0;
    z *= 0.72 * (1 - Math.abs(x) * 0.35);
    y *= 0.11 * (1 - Math.abs(x) * 0.6);
    pos.setXYZ(i, x, y, z);
    base.set([x, y, z], i * 3);
    const c = y >= 0 ? top.clone() : new THREE.Color('#e9eef7');
    if (y >= 0 && spots.some(([sx, sz]) => Math.hypot(x - sx, z - sz) < 0.07)) c.copy(accent);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
  body.add(new THREE.Mesh(g, mat));
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.05, 1.3, 6), new THREE.MeshStandardMaterial({ color: look.body }));
  tail.rotation.x = -Math.PI / 2;
  tail.position.z = -1.05;
  body.add(tail);
  addEyes(body, { len: 0.72, h: 0.11, w: 0.3 }, 0.7, 0.55, 0.9);
  let phase = rng() * 10;
  return {
    root,
    body,
    tintables: [],
    glow: [],
    upright: false,
    radius: 1,
    animate(_t, speed, dt) {
      phase += dt * (1.6 + speed * 3);
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3];
        const wing = Math.abs(x);
        pos.setY(i, base[i * 3 + 1] + Math.sin(phase - wing * 2.2) * 0.22 * wing * wing);
      }
      pos.needsUpdate = true;
      g.computeVertexNormals();
      tail.rotation.y = Math.sin(phase * 0.7) * 0.2;
    },
  };
}

export function buildFish(look: FishLook, seed: number): FishRig {
  const rng = seeded(seed);
  switch (look.shape) {
    case 'seahorse':
      return seahorse(look, rng);
    case 'jelly':
      return jelly(look, rng);
    case 'ray':
      return ray(look, rng);
    default:
      return standardFish(look.shape, look, rng);
  }
}
