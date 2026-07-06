import * as THREE from 'three';
import { clientState, onStateUpdate } from '../state/ClientState';
import { GLOBE_RADIUS } from './IconFactory';
import { orbitalBodies, myPlayerId } from '../state/signals';
import { CFG } from '@vantaris/shared';
import type { OrbitalBodyData, OrbitalElements } from '@vantaris/shared';

// Scale orbital positions (km) to globe units (globe radius 5 = PLANET_RADIUS_KM km).
const KM_PER_UNIT = CFG.SYSTEM.PLANET_RADIUS_KM / GLOBE_RADIUS;

interface SpacecraftMesh {
  bodyId: string;
  parentBodyId: string;
  mesh: THREE.Group;
  label: THREE.Sprite;
  orbitLine: THREE.Line | null;
}

/**
 * Renders any spacecraft orbiting or landed on the planet currently being viewed.
 * Works for landers, stations, freighters, or any future SPACECRAFT-typed body,
 * around any planet or moon — not just Vantaris.
 */
export class SpacecraftRenderer {
  private globeGroup: THREE.Group;
  private spacecraft: Map<string, SpacecraftMesh> = new Map();
  private materialOwn: THREE.MeshStandardMaterial;
  private materialOther: THREE.MeshStandardMaterial;

  constructor(globeGroup: THREE.Group) {
    this.globeGroup = globeGroup;

    this.materialOwn = new THREE.MeshStandardMaterial({ color: 0x44ff44, emissive: 0x226622, roughness: 0.6 });
    this.materialOther = new THREE.MeshStandardMaterial({ color: 0xff8844, emissive: 0x663311, roughness: 0.6 });

    onStateUpdate(() => this.onStateChange());
  }

  private onStateChange(): void {
    this.rebuild();
  }

  private rebuild(): void {
    const bodies = orbitalBodies.value;
    const pid = myPlayerId.value;
    const currentIds = new Set<string>();

    for (const [, body] of bodies) {
      if (body.type !== 'SPACECRAFT') continue;
      const parent = bodies.get(body.elements.parent);
      if (!parent || (parent.type !== 'PLANET' && parent.type !== 'MOON')) continue;
      currentIds.add(body.bodyId);

      if (!this.spacecraft.has(body.bodyId)) {
        const mesh = this.buildSpacecraftMesh(body, pid);
        this.globeGroup.add(mesh.mesh);
        this.globeGroup.add(mesh.label);
        if (mesh.orbitLine) this.globeGroup.add(mesh.orbitLine);
        this.spacecraft.set(body.bodyId, mesh);
      } else {
        // Update orbit line if elements changed.
        const existing = this.spacecraft.get(body.bodyId)!;
        const newLine = this.buildOrbitLine(body.elements);
        if (existing.orbitLine) {
          this.globeGroup.remove(existing.orbitLine);
          existing.orbitLine.geometry.dispose();
          (existing.orbitLine.material as THREE.Material).dispose();
        }
        if (newLine) {
          this.globeGroup.add(newLine);
        }
        existing.orbitLine = newLine;
      }

      // Update material color if ownership changed.
      const existing = this.spacecraft.get(body.bodyId)!;
      const isOwn = body.ownerId === pid;
      const desiredMat = isOwn ? this.materialOwn : this.materialOther;
      existing.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material !== desiredMat) {
          child.material = desiredMat;
        }
      });
    }

    // Remove spacecraft that no longer exist.
    for (const [bodyId, sc] of this.spacecraft) {
      if (!currentIds.has(bodyId)) {
        this.globeGroup.remove(sc.mesh);
        this.globeGroup.remove(sc.label);
        if (sc.orbitLine) {
          this.globeGroup.remove(sc.orbitLine);
          sc.orbitLine.geometry.dispose();
          (sc.orbitLine.material as THREE.Material).dispose();
        }
        (sc.label.material as THREE.SpriteMaterial).map?.dispose();
        (sc.label.material as THREE.Material).dispose();
        this.spacecraft.delete(bodyId);
      }
    }
  }

  private buildSpacecraftMesh(body: OrbitalBodyData, pid: string): SpacecraftMesh {
    const group = new THREE.Group();
    group.userData.bodyId = body.bodyId;

    const isOwn = body.ownerId === pid;
    const mat = isOwn ? this.materialOwn : this.materialOther;

    // Body: a small capsule (cylinder + cone nose).
    const bodyGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.12, 12);
    const bodyMesh = new THREE.Mesh(bodyGeo, mat);
    bodyMesh.raycast = () => {};
    group.add(bodyMesh);

    // Nose cone.
    const noseGeo = new THREE.ConeGeometry(0.04, 0.06, 12);
    const nose = new THREE.Mesh(noseGeo, mat);
    nose.position.y = 0.09;
    nose.raycast = () => {};
    group.add(nose);

    // Four landing legs.
    const legGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.1, 6);
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const leg = new THREE.Mesh(legGeo, mat);
      leg.position.set(Math.cos(angle) * 0.05, -0.05, Math.sin(angle) * 0.05);
      leg.rotation.z = Math.cos(angle) * 0.3;
      leg.rotation.x = -Math.sin(angle) * 0.3;
      leg.raycast = () => {};
      group.add(leg);
    }

    group.raycast = () => {};

    const label = makeSpacecraftLabel(body.name);
    label.userData.bodyId = body.bodyId;
    label.raycast = () => {};

    const orbitLine = this.buildOrbitLine(body.elements);

    return { bodyId: body.bodyId, parentBodyId: body.elements.parent, mesh: group, label, orbitLine };
  }

  /**
   * Build a line loop representing the spacecraft's orbital ellipse around its
   * parent, in globe-local coordinates (parent at origin). Returns null for
   * landed spacecraft or those with no parent.
   */
  private buildOrbitLine(el: OrbitalElements): THREE.Line | null {
    if (!el.parent || el.semiMajorAxis <= 0) return null;

    const a = el.semiMajorAxis / KM_PER_UNIT;
    const e = el.eccentricity;
    const b = a * Math.sqrt(1 - e * e);

    const cosW = Math.cos(el.argumentOfPeriapsis);
    const sinW = Math.sin(el.argumentOfPeriapsis);
    const cosI = Math.cos(el.inclination);
    const sinI = Math.sin(el.inclination);
    const cosO = Math.cos(el.longitudeOfAscendingNode);
    const sinO = Math.sin(el.longitudeOfAscendingNode);

    const segs = 128;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= segs; i++) {
      const E = (i / segs) * Math.PI * 2;
      const x_pf = a * (Math.cos(E) - e);
      const y_pf = b * Math.sin(E);

      const x = (cosO * cosW - sinO * sinW * cosI) * x_pf + (-cosO * sinW - sinO * cosW * cosI) * y_pf;
      const y = (sinO * cosW + cosO * sinW * cosI) * x_pf + (-sinO * sinW + cosO * cosW * cosI) * y_pf;
      const z = (sinW * sinI) * x_pf + (cosW * sinI) * y_pf;

      pts.push(new THREE.Vector3(x, y, z));
    }

    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: 0x44aaff, transparent: true, opacity: 0.4 });
    const line = new THREE.Line(geo, mat);
    line.raycast = () => {};
    return line;
  }

  update(camera?: THREE.Camera): void {
    const bodies = orbitalBodies.value;

    // Cache planet/moon positions by bodyId so we can compute each spacecraft's
    // position relative to its own parent (whatever that is).
    const parentPositions = new Map<string, THREE.Vector3>();
    for (const [, b] of bodies) {
      if (b.type === 'PLANET' || b.type === 'MOON') {
        parentPositions.set(b.bodyId, new THREE.Vector3(b.position[0], b.position[1], b.position[2]));
      }
    }

    for (const [bodyId, sc] of this.spacecraft) {
      const body = bodies.get(bodyId);
      if (!body) continue;
      const parentPos = parentPositions.get(body.elements.parent);
      if (!parentPos) continue;

      if (body.landedCellId) {
        const numericId = parseInt(body.landedCellId.replace('cell_', ''));
        if (!isNaN(numericId)) {
          let cellMesh: THREE.Mesh | null = null;
          this.globeGroup.traverse((child) => {
            if (child instanceof THREE.Mesh && child.userData.cellId === numericId) {
              cellMesh = child as THREE.Mesh;
            }
          });
          const cell = cellMesh;
          if (cell) {
            const normal = (cell as THREE.Mesh).position.clone().normalize();
            // Place lander well above terrain. Max terrain height is 0.8,
            // so GLOBE_RADIUS + 1.0 ensures it's always above the surface.
            const landerHeight = GLOBE_RADIUS + 1.5;
            sc.mesh.position.copy(normal.clone().multiplyScalar(landerHeight));
            sc.mesh.lookAt(normal.clone().multiplyScalar(GLOBE_RADIUS * 2));
            sc.mesh.rotateX(Math.PI / 2);
            sc.label.position.copy(normal.clone().multiplyScalar(landerHeight + 0.15));
          }
        }
      } else {
        const relX = (body.position[0] - parentPos.x) / KM_PER_UNIT;
        const relY = (body.position[1] - parentPos.y) / KM_PER_UNIT;
        const relZ = (body.position[2] - parentPos.z) / KM_PER_UNIT;
        sc.mesh.position.set(relX, relY, relZ);
        sc.label.position.set(relX, relY + 0.15, relZ);
      }

      // Hide orbit line when landed.
      if (sc.orbitLine) {
        sc.orbitLine.visible = !body.landedCellId;
      }

      // Scale label with camera distance so it stays a reasonable on-screen size.
      if (camera) {
        const dist = sc.label.position.distanceTo(camera.position);
        const s = THREE.MathUtils.clamp(dist * 0.06, 0.4, 2);
        sc.label.scale.set(s, s * 0.3, 1);
      }
    }
  }
}

function makeSpacecraftLabel(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const fontSize = 16;
  ctx.font = `${fontSize}px ui-monospace, monospace`;
  const textWidth = ctx.measureText(text).width;
  canvas.width = Math.ceil(textWidth) + 8;
  canvas.height = fontSize + 4;
  ctx.font = `${fontSize}px ui-monospace, monospace`;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#88cc88';
  ctx.fillText(text, 4, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({ map: texture, depthTest: false });
  return new THREE.Sprite(material);
}