/**
 * Three.js scene + procedural avatars for the lobby and playback stage.
 *
 * Avatars are stylised "bean" characters built from a handful of shared primitive geometries
 * (no GLB download needed, ~0KB of model data, renders well on mid-range phones). Geometries and
 * base materials are created once and reused by every avatar; only the tinted body material is
 * per-avatar. If GLB models are added later (public/models), load them in createAvatar().
 */
import * as THREE from 'three';
import type { AvatarModel, AvatarOutfit } from '@/types/database';

export type AvatarAnimState = 'idle' | 'ready' | 'speaking' | 'listening' | 'celebrate';

export interface AvatarSpec {
  id: string;
  model: AvatarModel;
  color: string;
  outfit: AvatarOutfit;
  state: AvatarAnimState;
  /** Optional ring colour under the avatar (character colour). */
  accent?: string;
}

// ---------- shared resources ----------
let shared: ReturnType<typeof createShared> | null = null;

function createShared() {
  return {
    body: new THREE.CapsuleGeometry(0.5, 0.7, 8, 20),
    blobBody: new THREE.SphereGeometry(0.75, 24, 18),
    head: new THREE.SphereGeometry(0.42, 24, 18),
    robotHead: new THREE.BoxGeometry(0.75, 0.6, 0.6),
    eye: new THREE.SphereGeometry(0.075, 12, 10),
    mouth: new THREE.CapsuleGeometry(0.05, 0.14, 4, 8),
    hairCap: new THREE.SphereGeometry(0.45, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2.1),
    ponytail: new THREE.SphereGeometry(0.16, 12, 10),
    antenna: new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8),
    antennaTip: new THREE.SphereGeometry(0.07, 10, 8),
    band: new THREE.CylinderGeometry(0.52, 0.52, 0.45, 24, 1, true),
    skirt: new THREE.ConeGeometry(0.75, 0.7, 24, 1, true),
    hood: new THREE.TorusGeometry(0.32, 0.1, 10, 24),
    tie: new THREE.ConeGeometry(0.08, 0.35, 4),
    stripe: new THREE.CylinderGeometry(0.525, 0.525, 0.07, 24, 1, true),
    ring: new THREE.RingGeometry(0.62, 0.78, 40),
    shadow: new THREE.CircleGeometry(0.62, 32),
    eyeMat: new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.3 }),
    whiteMat: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 }),
    darkMat: new THREE.MeshStandardMaterial({ color: '#1f2433', roughness: 0.7 }),
    hairMat: new THREE.MeshStandardMaterial({ color: '#3b2416', roughness: 0.8 }),
    metalMat: new THREE.MeshStandardMaterial({ color: '#c7ccd6', metalness: 0.6, roughness: 0.3 }),
    redMat: new THREE.MeshStandardMaterial({ color: '#e11d48', roughness: 0.5 }),
    shadowMat: new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.35, depthWrite: false }),
  };
}

function res() {
  if (!shared) shared = createShared();
  return shared;
}

const OUTFIT_COLORS: Record<AvatarOutfit, string> = {
  tee: '#f8fafc',
  hoodie: '#6366f1',
  suit: '#1f2433',
  dress: '#ec4899',
  jersey: '#f59e0b',
};

export interface AvatarHandle {
  group: THREE.Group;
  spec: AvatarSpec;
  setSpec: (spec: AvatarSpec) => void;
  update: (t: number, dt: number) => void;
  dispose: () => void;
}

/** Build one procedural avatar. */
export function createAvatar(initial: AvatarSpec): AvatarHandle {
  const r = res();
  const group = new THREE.Group();
  const rig = new THREE.Group(); // animated part
  group.add(rig);
  const owned: THREE.Material[] = [];
  const mat = (color: string, opts: THREE.MeshStandardMaterialParameters = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...opts });
    owned.push(m);
    return m;
  };

  let spec = initial;
  let headPivot: THREE.Group;
  let mouth: THREE.Mesh;
  let ring: THREE.Mesh;

  function build() {
    rig.clear();
    owned.splice(0).forEach((m) => m.dispose());
    const bodyMat = mat(spec.color);
    const isBlob = spec.model === 'blob';
    const isRobot = spec.model === 'robot';
    const female = spec.model === 'casual_f' || spec.model === 'formal_f';
    const formal = spec.model === 'formal_m' || spec.model === 'formal_f';

    const body = new THREE.Mesh(isBlob ? r.blobBody : r.body, isRobot ? r.metalMat : bodyMat);
    body.position.y = isBlob ? 0.75 : 0.85;
    body.castShadow = true;
    rig.add(body);

    // Outfit
    const outfitMat = mat(formal && spec.outfit === 'tee' ? '#1f2433' : OUTFIT_COLORS[spec.outfit], { side: THREE.DoubleSide });
    if (!isBlob) {
      if (spec.outfit === 'dress') {
        const skirt = new THREE.Mesh(r.skirt, outfitMat);
        skirt.position.y = 0.55;
        rig.add(skirt);
      } else {
        const band = new THREE.Mesh(r.band, outfitMat);
        band.position.y = 0.8;
        rig.add(band);
      }
      if (spec.outfit === 'jersey') {
        for (const y of [0.68, 0.92]) {
          const s = new THREE.Mesh(r.stripe, r.whiteMat);
          s.position.y = y;
          rig.add(s);
        }
      }
      if (spec.outfit === 'suit' || formal) {
        const tie = new THREE.Mesh(r.tie, r.redMat);
        tie.rotation.x = Math.PI;
        tie.position.set(0, 0.92, 0.5);
        rig.add(tie);
      }
    }

    // Head
    headPivot = new THREE.Group();
    headPivot.position.y = isBlob ? 1.35 : 1.62;
    rig.add(headPivot);
    const head = new THREE.Mesh(isRobot ? r.robotHead : r.head, isRobot ? r.metalMat : bodyMat);
    head.castShadow = true;
    headPivot.add(head);
    if (spec.outfit === 'hoodie' && !isRobot) {
      const hood = new THREE.Mesh(r.hood, outfitMat);
      hood.rotation.x = Math.PI / 2;
      hood.position.y = -0.32;
      headPivot.add(hood);
    }
    if (!isRobot && !isBlob) {
      const hair = new THREE.Mesh(r.hairCap, r.hairMat);
      hair.position.y = 0.04;
      hair.rotation.x = -0.25;
      headPivot.add(hair);
      if (female) {
        const tail = new THREE.Mesh(r.ponytail, r.hairMat);
        tail.position.set(0, 0.1, -0.45);
        headPivot.add(tail);
      }
    }
    if (isRobot) {
      const antenna = new THREE.Mesh(r.antenna, r.darkMat);
      antenna.position.y = 0.45;
      const tip = new THREE.Mesh(r.antennaTip, r.redMat);
      tip.position.y = 0.62;
      headPivot.add(antenna, tip);
    }
    const eyeZ = isRobot ? 0.31 : 0.37;
    for (const x of [-0.14, 0.14]) {
      const eye = new THREE.Mesh(r.eye, r.eyeMat);
      eye.position.set(x, 0.05, eyeZ);
      headPivot.add(eye);
    }
    mouth = new THREE.Mesh(r.mouth, r.eyeMat);
    mouth.rotation.z = Math.PI / 2;
    mouth.position.set(0, -0.14, eyeZ - 0.02);
    headPivot.add(mouth);

    // Ground: shadow blob + accent ring
    const shadow = new THREE.Mesh(r.shadow, r.shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.01;
    group.add(shadow);
    ring = new THREE.Mesh(r.ring, mat(spec.accent ?? '#ffffff', { emissive: spec.accent ?? '#000000', emissiveIntensity: 0.6, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    ring.visible = !!spec.accent;
    group.add(ring);
  }

  build();
  const phase = Math.random() * Math.PI * 2;

  return {
    group,
    get spec() {
      return spec;
    },
    setSpec(next) {
      const rebuild = next.model !== spec.model || next.color !== spec.color || next.outfit !== spec.outfit || next.accent !== spec.accent;
      spec = next;
      if (rebuild) {
        // remove previous ground meshes too
        group.children.filter((c) => c !== rig).forEach((c) => group.remove(c));
        build();
      }
    },
    update(t) {
      const p = t * 1 + phase;
      let bob = Math.sin(p * 2) * 0.03;
      let squash = 1;
      let headTilt = 0;
      let mouthOpen = 1;
      switch (spec.state) {
        case 'ready':
          bob = Math.abs(Math.sin(p * 4)) * 0.18;
          squash = 1 - Math.abs(Math.cos(p * 4)) * 0.05;
          break;
        case 'speaking':
          bob = Math.abs(Math.sin(p * 7)) * 0.06;
          mouthOpen = 1.5 + Math.abs(Math.sin(t * 18)) * 2.5;
          rig.rotation.y = Math.sin(p * 1.5) * 0.15;
          break;
        case 'listening':
          headTilt = Math.sin(p * 0.8) * 0.18;
          break;
        case 'celebrate':
          bob = Math.abs(Math.sin(p * 5)) * 0.35;
          rig.rotation.y += 0.05;
          break;
        default:
          rig.rotation.y *= 0.9;
      }
      rig.position.y = bob;
      rig.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
      headPivot.rotation.z = headTilt;
      mouth.scale.set(1, mouthOpen, 1);
      if (ring.visible) (ring.material as THREE.MeshStandardMaterial).emissiveIntensity = spec.state === 'speaking' ? 1.2 + Math.sin(t * 8) * 0.4 : 0.5;
    },
    dispose() {
      owned.forEach((m) => m.dispose());
    },
  };
}

export interface Stage {
  setAvatars: (specs: AvatarSpec[]) => void;
  /** Screen-space x (0-1) of each avatar, for HTML labels. */
  positions: () => Array<{ id: string; x: number; y: number }>;
  dispose: () => void;
}

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

/**
 * Create a renderer + scene in `container`. Renders on demand at up to 60fps, pauses when the tab is
 * hidden, caps pixel ratio at 2 and disables shadows on low-power devices.
 */
export function createStage(container: HTMLElement, opts: { variant: 'lobby' | 'stage' }): Stage {
  const lowPower = (navigator.hardwareConcurrency ?? 4) <= 4 || window.matchMedia?.('(pointer: coarse)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: !lowPower, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowPower ? 1.5 : 2));
  renderer.shadowMap.enabled = !lowPower;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  renderer.domElement.style.display = 'block';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(opts.variant === 'stage' ? 38 : 35, 1, 0.1, 100);
  camera.position.set(0, opts.variant === 'stage' ? 2.4 : 2.2, opts.variant === 'stage' ? 8 : 7.5);
  camera.lookAt(0, 1, 0);

  scene.add(new THREE.HemisphereLight('#ffffff', '#3b2f6b', 1.1));
  const key = new THREE.DirectionalLight('#ffffff', 1.6);
  key.position.set(3, 6, 5);
  key.castShadow = !lowPower;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#ff2e6e', 0.8);
  rim.position.set(-4, 3, -3);
  scene.add(rim);

  const floorMat = new THREE.MeshStandardMaterial({ color: opts.variant === 'stage' ? '#2e2852' : '#211c3b', roughness: 0.9 });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(opts.variant === 'stage' ? 7 : 5, 48), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  if (opts.variant === 'stage') {
    // Simple stage: back curtain + spotlights.
    const curtain = new THREE.Mesh(new THREE.PlaneGeometry(16, 7), new THREE.MeshStandardMaterial({ color: '#7f1d3a', roughness: 1 }));
    curtain.position.set(0, 3.5, -3.5);
    scene.add(curtain);
    const spot = new THREE.SpotLight('#fff3d6', 30, 20, 0.5, 0.6);
    spot.position.set(0, 7, 4);
    spot.target.position.set(0, 0, 0);
    scene.add(spot, spot.target);
  }

  const avatars = new Map<string, AvatarHandle>();
  let order: string[] = [];

  function layout() {
    const n = order.length;
    const spacing = n <= 2 ? 2.2 : 1.8;
    order.forEach((id, i) => {
      const a = avatars.get(id)!;
      const x = (i - (n - 1) / 2) * spacing;
      a.group.position.set(x, 0, -Math.abs(x) * 0.25);
      a.group.rotation.y = -x * 0.08;
    });
  }

  function resize() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    camera.aspect = w / h;
    // Pull the camera back on narrow screens so 4 avatars still fit.
    camera.position.z = (opts.variant === 'stage' ? 8 : 7.5) * Math.max(1, 1.4 / camera.aspect);
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  const clock = new THREE.Clock();
  let raf = 0;
  const loop = () => {
    raf = requestAnimationFrame(loop);
    if (document.hidden) return;
    const dt = clock.getDelta();
    const t = clock.elapsedTime;
    avatars.forEach((a) => a.update(t, dt));
    renderer.render(scene, camera);
  };
  loop();

  return {
    setAvatars(specs) {
      const ids = new Set(specs.map((s) => s.id));
      for (const [id, a] of avatars) {
        if (!ids.has(id)) {
          scene.remove(a.group);
          a.dispose();
          avatars.delete(id);
        }
      }
      for (const s of specs) {
        const existing = avatars.get(s.id);
        if (existing) existing.setSpec(s);
        else {
          const a = createAvatar(s);
          avatars.set(s.id, a);
          scene.add(a.group);
        }
      }
      order = specs.map((s) => s.id);
      layout();
    },
    positions() {
      const v = new THREE.Vector3();
      return order.map((id) => {
        const a = avatars.get(id)!;
        v.set(a.group.position.x, 0, a.group.position.z).project(camera);
        return { id, x: (v.x + 1) / 2, y: (1 - v.y) / 2 };
      });
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      avatars.forEach((a) => a.dispose());
      floor.geometry.dispose();
      floorMat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
