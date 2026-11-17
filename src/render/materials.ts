import * as THREE from 'three';

/** Uniforms shared by every animated material in the tank. */
export const shared = {
  uTime: { value: 0 },
  uCaustics: { value: 1 },
};

const CAUSTIC_GLSL = /* glsl */ `
uniform float uTime;
uniform float uCaustics;
varying vec3 vCausticPos;
float causticPattern(vec2 p, float t) {
  vec2 i = p;
  float c = 1.0;
  float inten = 0.005;
  for (int n = 0; n < 4; n++) {
    float tt = t * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
  }
  c /= 4.0;
  c = 1.17 - pow(c, 1.4);
  return clamp(pow(abs(c), 8.0), 0.0, 1.0);
}
`;

/**
 * Adds animated light caustics to a standard material, projected from above
 * (world xz) and fading with depth below the surface.
 */
export function withCaustics<T extends THREE.MeshStandardMaterial>(mat: T, strength = 0.55): T {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = shared.uTime;
    shader.uniforms.uCaustics = shared.uCaustics;
    shader.uniforms.uCausticStrength = { value: strength };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCausticPos;\nvarying vec3 vCausticN;')
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nvCausticPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvCausticN = normalize(mat3(modelMatrix) * objectNormal);',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${CAUSTIC_GLSL}\nuniform float uCausticStrength;\nvarying vec3 vCausticN;`)
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float cst = causticPattern(vCausticPos.xz * 1.35 + vec2(7.0, 3.0), uTime * 0.45);
        float up = clamp(normalize(vCausticN).y * 0.5 + 0.6, 0.0, 1.0);
        totalEmissiveRadiance += diffuseColor.rgb * cst * uCausticStrength * uCaustics * up;`,
      );
  };
  mat.customProgramCacheKey = () => `caustics`;
  return mat;
}

export interface SwayOptions {
  height: number;
  amp: number;
  speed?: number;
  phase?: number;
}

/**
 * Plant sway: vertices bend sideways proportional to (y / height)^1.6, so the
 * base stays planted while tips drift in the current.
 */
export function withSway<T extends THREE.MeshStandardMaterial>(mat: T, opts: SwayOptions): T {
  const uniforms = {
    uSwayHeight: { value: opts.height },
    uSwayAmp: { value: opts.amp },
    uSwaySpeed: { value: opts.speed ?? 1 },
    uSwayPhase: { value: opts.phase ?? 0 },
  };
  mat.userData.sway = uniforms;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, { uTime: shared.uTime });
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime; uniform float uSwayHeight; uniform float uSwayAmp; uniform float uSwaySpeed; uniform float uSwayPhase;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          float h = clamp(position.y / uSwayHeight, 0.0, 1.0);
          float bend = pow(h, 1.6) * uSwayAmp;
          float t = uTime * uSwaySpeed + uSwayPhase;
          transformed.x += sin(t * 1.3 + wp.x * 0.7 + wp.z * 0.4) * bend;
          transformed.z += cos(t * 0.9 + wp.z * 0.6) * bend * 0.6;
        }`,
      );
  };
  mat.customProgramCacheKey = () => 'sway';
  return mat;
}

/** Soft additive gradient used for light shafts. */
export function lightShaftMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uTime: shared.uTime, uIntensity: { value: 0.2 }, uSeed: { value: 0 }, uColor: { value: new THREE.Color('#fff6dc') } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uIntensity; uniform float uSeed; uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        float edge = smoothstep(0.0, 0.35, vUv.x) * smoothstep(1.0, 0.65, vUv.x);
        float fall = pow(vUv.y, 1.6);
        float flicker = 0.75 + 0.25 * sin(uTime * 0.7 + uSeed * 6.0);
        gl_FragColor = vec4(uColor * edge * fall * flicker * uIntensity, 1.0);
      }`,
  });
}

/** Back wall of the tank: vertical gradient, optional starfield (nebula theme). */
export function backdropMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: shared.uTime,
      uTop: { value: new THREE.Color('#4fb6d8') },
      uBottom: { value: new THREE.Color('#0b3a5c') },
      uLight: { value: 1 },
      uStars: { value: 0 },
      uMurk: { value: 0 },
      uMurkColor: { value: new THREE.Color('#4d5b2a') },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uTop; uniform vec3 uBottom; uniform float uLight; uniform float uStars;
      uniform float uMurk; uniform vec3 uMurkColor;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        vec3 col = mix(uBottom, uTop, smoothstep(0.0, 1.0, vUv.y));
        // soft wavering light bands from the surface
        float band = sin(vUv.x * 9.0 + uTime * 0.3 + sin(vUv.y * 3.0 + uTime * 0.2)) * 0.5 + 0.5;
        col += uTop * band * 0.08 * vUv.y;
        col *= mix(0.22, 1.0, uLight);
        if (uStars > 0.5) {
          vec2 g = floor(vUv * vec2(160.0, 90.0));
          float h = hash(g);
          float star = step(0.985, h) * (0.5 + 0.5 * sin(uTime * (1.0 + h * 3.0) + h * 40.0));
          col += vec3(0.95, 0.93, 1.0) * star * 0.9;
          // faint nebula wisps
          float neb = sin(vUv.x * 4.0 + 1.3) * sin(vUv.y * 3.0 + vUv.x * 2.0 + uTime * 0.05);
          col += vec3(0.55, 0.35, 0.8) * max(0.0, neb) * 0.18;
        }
        col = mix(col, uMurkColor * mix(0.3, 1.0, uLight), uMurk * 0.55);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

/** Procedural algae smudges for the glass, used as an alpha map. */
export function algaeTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 140; i++) {
    const x = Math.random() * 256;
    const y = 256 - Math.pow(Math.random(), 0.6) * 256;
    const r = 6 + Math.random() * 30;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    const a = 0.15 + Math.random() * 0.35;
    grad.addColorStop(0, `rgba(255,255,255,${a})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  // baseline haze, heavier near the bottom
  const lin = g.createLinearGradient(0, 0, 0, 256);
  lin.addColorStop(0, 'rgba(255,255,255,0.08)');
  lin.addColorStop(1, 'rgba(255,255,255,0.35)');
  g.fillStyle = lin;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function std(color: THREE.ColorRepresentation, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0, ...extra });
}
