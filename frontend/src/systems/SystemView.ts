import * as THREE from 'three';
import { orbitalBodies, exitPlanetView, enterPlanetView, myPlayerId } from '../state/signals';
import { CFG } from '@vantaris/shared';
import type { OrbitalBodyData } from '@vantaris/shared';

// Render scale: 1 Three.js unit = CFG.SYSTEM.VIEW_SCALE_KM km.
const SCALE = CFG.SYSTEM.VIEW_SCALE_KM;

function makeLabelSprite(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const fontSize = 48;
  ctx.font = `${fontSize}px ui-monospace, monospace`;
  const textWidth = ctx.measureText(text).width;
  canvas.width = Math.ceil(textWidth) + 20;
  canvas.height = fontSize + 12;
  ctx.font = `${fontSize}px ui-monospace, monospace`;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#aabbcc';
  ctx.fillText(text, 10, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({ map: texture, depthTest: false });
  const sprite = new THREE.Sprite(material);
  return sprite;
}

export class SystemView {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private canvas: HTMLCanvasElement;
  private container: HTMLDivElement;
  private starField: THREE.Points | null = null;
  private bodyMeshes: Map<string, THREE.Mesh> = new Map();
  private orbitRings: Map<string, THREE.Line> = new Map();
  private labels: Map<string, THREE.Sprite> = new Map();
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private raf: number | null = null;
  private angle = 0;
  private pitch = 0.3;
  private distance = 220;
  private targetDistance = 220;
  private dragging = false;
  private dragButton = 0;
  private lastPointer = { x: 0, y: 0 };
  private knownBodyIds: Set<string> = new Set();
  private onEnterPlanet: ((bodyId?: string) => void) | null = null;
  private onPickBody: ((bodyId: string) => void) | null = null;

  constructor(container: HTMLDivElement) {
    this.container = container;

    this.canvas = document.createElement('canvas');
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.display = 'block';
    container.appendChild(this.canvas);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 5000);
    this.updateCamera();

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setClearColor(0x000005);

    this.createStarfield();
    this.scene.add(this.starField!);

    // Sun light at origin
    const sunLight = new THREE.PointLight(0xfff0cc, 2.5, 0, 1.5);
    sunLight.position.set(0, 0, 0);
    this.scene.add(sunLight);
    this.scene.add(new THREE.AmbientLight(0x222233));

    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointermove', this.onPointerMoveHover);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    this.canvas.addEventListener('click', this.onClick);
    this.canvas.addEventListener('contextmenu', this.onContextMenu);

    this.rebuild();
    this.animate();
  }

  setHandlers(onEnterPlanet: (bodyId?: string) => void, onPickBody: (bodyId: string) => void): void {
    this.onEnterPlanet = onEnterPlanet;
    this.onPickBody = onPickBody;
  }

  // Allow the host to focus a specific body (e.g. when entering from the menu).
  focusBody(bodyId: string): void {
    const body = orbitalBodies.value.get(bodyId);
    if (!body) return;
    if (body.type === 'PLANET' || body.type === 'MOON') {
      this.onEnterPlanet?.(bodyId);
    }
  }

  private createStarfield(): void {
    const count = 1500;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 1500 + Math.random() * 800;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.starField = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: true }));
  }

  private rebuild(): void {
    const bodies = orbitalBodies.value;
    const pid = myPlayerId.value;

    // Detect whether the set of bodies changed. If not, skip the teardown+rebuild
    // (positions update every tick; rebuilding meshes every tick is the lag source).
    const currentIds = new Set<string>(bodies.keys());
    let same = currentIds.size === this.knownBodyIds.size;
    if (same) {
      for (const id of currentIds) {
        if (!this.knownBodyIds.has(id)) { same = false; break; }
      }
    }
    if (same && this.bodyMeshes.size === currentIds.size) return;
    this.knownBodyIds = currentIds;

    // Clear old
    for (const [, m] of this.bodyMeshes) {
      this.scene.remove(m);
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
    this.bodyMeshes.clear();
    for (const [, l] of this.orbitRings) {
      this.scene.remove(l);
      l.geometry.dispose();
      (l.material as THREE.Material).dispose();
    }
    this.orbitRings.clear();
    for (const [, label] of this.labels) {
      this.scene.remove(label);
      (label.material as THREE.SpriteMaterial).map?.dispose();
      (label.material as THREE.Material).dispose();
    }
    this.labels.clear();

    for (const [, body] of bodies) {
      // Spacecraft are not drawn at system scale — they'd be invisible specks
      // and they clutter the planet labels. They appear in the planet view instead.
      if (body.type === 'SPACECRAFT') continue;
      const size = this.bodyDisplaySize(body);
      const color = this.bodyColor(body, pid);
      const geo = body.type === 'STAR'
        ? new THREE.SphereGeometry(size, 32, 32)
        : new THREE.SphereGeometry(size, 24, 24);
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: body.type === 'STAR' ? color : 0x000000,
        emissiveIntensity: body.type === 'STAR' ? 1 : 0,
        roughness: 0.85,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData.bodyId = body.bodyId;
      this.scene.add(mesh);
      this.bodyMeshes.set(body.bodyId, mesh);

      // Orbit ring around parent
      if (body.elements.parent && body.type !== 'STAR') {
        const a = body.elements.semiMajorAxis / SCALE;
        const e = body.elements.eccentricity;
        const pts: THREE.Vector3[] = [];
        const segs = 128;
        for (let i = 0; i <= segs; i++) {
          const E = (i / segs) * Math.PI * 2;
          const x = a * (Math.cos(E) - e);
          const y = a * Math.sqrt(1 - e * e) * Math.sin(E);
          pts.push(new THREE.Vector3(x, 0, y));
        }
        // Apply inclination rotation
        const orbitGeo = new THREE.BufferGeometry().setFromPoints(pts);
        const orbitMat = new THREE.LineBasicMaterial({ color: 0x445566, transparent: true, opacity: 0.5 });
        const orbit = new THREE.Line(orbitGeo, orbitMat);
        orbit.rotation.x = body.elements.inclination;
        orbit.userData.bodyId = body.bodyId;
        this.scene.add(orbit);
        this.orbitRings.set(body.bodyId, orbit);
      }

      // Label — a Three.js sprite rendered into the scene itself, so it moves
      // in lockstep with the body and never jitters against the WebGL render.
      const sprite = makeLabelSprite(body.name);
      sprite.scale.set(28, 7, 1);
      sprite.userData.bodyId = body.bodyId;
      sprite.userData.isLabel = true;
      this.scene.add(sprite);
      this.labels.set(body.bodyId, sprite);
    }
  }

  private bodyDisplaySize(body: OrbitalBodyData): number {
    if (body.type === 'STAR') return body.radius / SCALE;
    if (body.type === 'SPACECRAFT' || body.type === 'STATION') return 1.5; // fixed marker size
    return Math.max(0.8, body.radius / SCALE);
  }

  private bodyColor(body: OrbitalBodyData, myPid: string): number {
    if (body.type === 'STAR') return 0xfff0cc;
    if (body.type === 'PLANET') return 0x4488cc;
    if (body.type === 'SPACECRAFT') return body.ownerId === myPid ? 0x44ff44 : 0xff8844;
    if (body.type === 'STATION') return 0xaaaaaa;
    return 0x888888;
  }

  private updatePositions(): void {
    const bodies = orbitalBodies.value;
    for (const [bodyId, mesh] of this.bodyMeshes) {
      const body = bodies.get(bodyId);
      if (!body) continue;
      mesh.position.set(
        body.position[0] / SCALE,
        body.position[1] / SCALE,
        body.position[2] / SCALE,
      );
    }
    // Update orbit ring positions to parent
    for (const [bodyId, ring] of this.orbitRings) {
      const body = bodies.get(bodyId);
      if (!body || !body.elements.parent) continue;
      const parent = bodies.get(body.elements.parent);
      if (!parent) continue;
      ring.position.set(
        parent.position[0] / SCALE,
        parent.position[1] / SCALE,
        parent.position[2] / SCALE,
      );
    }
  }

  private placeLabels(): void {
    for (const [bodyId, sprite] of this.labels) {
      const mesh = this.bodyMeshes.get(bodyId);
      if (!mesh) { sprite.visible = false; continue; }
      sprite.visible = true;
      // Offset slightly above and to the right of the body so the text doesn't sit on top.
      const off = new THREE.Vector3(2, 2, 0).applyMatrix4(this.camera.matrixWorld);
      sprite.position.copy(mesh.position).add(new THREE.Vector3(0, 2, 0));
    }
  }

  private updateCamera(): void {
    const r = this.distance;
    const cp = Math.cos(this.pitch);
    this.camera.position.set(
      Math.cos(this.angle) * r * cp,
      Math.sin(this.pitch) * r,
      Math.sin(this.angle) * r * cp,
    );
    this.camera.lookAt(0, 0, 0);
  }

  private onPointerDown = (e: PointerEvent) => {
    this.dragging = true;
    this.dragButton = e.button;
    this.lastPointer = { x: e.clientX, y: e.clientY };
    // Prevent the browser context menu so right-drag works.
    if (e.button === 2) e.preventDefault();
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.dragging) return;
    const dx = e.clientX - this.lastPointer.x;
    const dy = e.clientY - this.lastPointer.y;
    this.lastPointer = { x: e.clientX, y: e.clientY };
    // Both left and right drag rotate the system view, like the planet view.
    this.angle += dx * 0.005;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.005, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01);
  };

  private onPointerUp = () => {
    this.dragging = false;
    this.canvas.style.cursor = 'default';
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    // Exponential zoom — feels consistent at any distance.
    const factor = Math.exp(e.deltaY * 0.0015);
    this.targetDistance = THREE.MathUtils.clamp(this.targetDistance * factor, 10, 2000);
  };

  private onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };

  private onClick = (e: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    // Pick against both body meshes and labels so clicking the text works too.
    const pickables: THREE.Object3D[] = [
      ...Array.from(this.bodyMeshes.values()),
      ...Array.from(this.labels.values()),
    ];
    const hits = this.raycaster.intersectObjects(pickables, false);
    if (hits.length > 0) {
      const bodyId = hits[0].object.userData.bodyId as string;
      const body = orbitalBodies.value.get(bodyId);
      if (!body) return;
      if (body.type === 'PLANET' || body.type === 'MOON') {
        this.onEnterPlanet?.(bodyId);
      } else {
        this.onPickBody?.(bodyId);
      }
    }
  };

  private onPointerMoveHover = (e: PointerEvent) => {
    if (this.dragging) {
      this.canvas.style.cursor = 'grabbing';
      return;
    }
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const pickables: THREE.Object3D[] = [
      ...Array.from(this.bodyMeshes.values()),
      ...Array.from(this.labels.values()),
    ];
    const hits = this.raycaster.intersectObjects(pickables, false);
    this.canvas.style.cursor = hits.length > 0 ? 'pointer' : 'default';
  };

  resize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  onBodiesChanged(): void {
    this.rebuild();
  }

  private animate = () => {
    this.raf = requestAnimationFrame(this.animate);
    this.distance += (this.targetDistance - this.distance) * 0.2;
    this.updateCamera();
    this.updatePositions();
    this.placeLabels();
    this.renderer.render(this.scene, this.camera);
  };

  dispose(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointermove', this.onPointerMoveHover);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('wheel', this.onWheel as any);
    this.canvas.removeEventListener('click', this.onClick);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    for (const [, label] of this.labels) {
      this.scene.remove(label);
      (label.material as THREE.SpriteMaterial).map?.dispose();
      (label.material as THREE.Material).dispose();
    }
    this.labels.clear();
    this.renderer.dispose();
    if (this.canvas.parentElement) this.canvas.parentElement.removeChild(this.canvas);
  }
}