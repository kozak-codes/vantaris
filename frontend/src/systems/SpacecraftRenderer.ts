import * as THREE from 'three';
import { clientState, onStateUpdate } from '../state/ClientState';
import { GLOBE_RADIUS } from './IconFactory';
import { orbitalBodies, myPlayerId } from '../state/signals';
import { CFG, sampleWorldTerrain, generateSubHexCoords, subHexSize, type HexGrid } from '@vantaris/shared';
import type { OrbitalBodyData, OrbitalElements } from '@vantaris/shared';
import { LabelRenderer } from './LabelRenderer';

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
  private grid: HexGrid | null = null;
  private spacecraft: Map<string, SpacecraftMesh> = new Map();
  private materialOwn: THREE.MeshStandardMaterial;
  private materialOther: THREE.MeshStandardMaterial;
  private labelRenderer = new LabelRenderer();

  constructor(globeGroup: THREE.Group) {
    this.globeGroup = globeGroup;

    this.materialOwn = new THREE.MeshStandardMaterial({ color: 0x44ff44, emissive: 0x226622, roughness: 0.6 });
    this.materialOther = new THREE.MeshStandardMaterial({ color: 0xff8844, emissive: 0x663311, roughness: 0.6 });

    onStateUpdate(() => this.onStateChange());
  }

  setGrid(grid: HexGrid): void {
    this.grid = grid;
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
        this.labelRenderer.unregisterLabel(sc.label);
        sc.label.material.map?.dispose();
        sc.label.material.dispose();
        this.spacecraft.delete(bodyId);
      }
    }
  }

  private buildSpacecraftMesh(body: OrbitalBodyData, pid: string): SpacecraftMesh {
    const group = new THREE.Group();
    group.userData.bodyId = body.bodyId;

    const isOwn = body.ownerId === pid;
    const mat = isOwn ? this.materialOwn : this.materialOther;

    // Body: a small capsule (cylinder + cone nose). Scaled small so it
    // reads as a lander at both orbit and surface zoom levels.
    const s = 0.5;
    const bodyGeo = new THREE.CylinderGeometry(0.04 * s, 0.04 * s, 0.12 * s, 12);
    const bodyMesh = new THREE.Mesh(bodyGeo, mat);
    bodyMesh.raycast = () => {};
    group.add(bodyMesh);

    // Nose cone.
    const noseGeo = new THREE.ConeGeometry(0.04 * s, 0.06 * s, 12);
    const nose = new THREE.Mesh(noseGeo, mat);
    nose.position.y = 0.09 * s;
    nose.raycast = () => {};
    group.add(nose);

    // Four landing legs.
    const legGeo = new THREE.CylinderGeometry(0.005 * s, 0.005 * s, 0.1 * s, 6);
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const leg = new THREE.Mesh(legGeo, mat);
      leg.position.set(Math.cos(angle) * 0.05 * s, -0.05 * s, Math.sin(angle) * 0.05 * s);
      leg.rotation.z = Math.cos(angle) * 0.3;
      leg.rotation.x = -Math.sin(angle) * 0.3;
      leg.raycast = () => {};
      group.add(leg);
    }

    group.raycast = () => {};

    const isOwnLabel = isOwn;
    const label = LabelRenderer.createLabel(body.name, {
      color: isOwnLabel ? '#88cc88' : '#cc9966',
      background: 'rgba(0,0,0,0.55)',
      fontSize: 16,
    });
    label.userData.bodyId = body.bodyId;
    label.raycast = () => {};
    // targetWorldHeight is the label height in world units at the reference
    // distance (20). The lander mesh is ~0.12 units tall, so 0.15 keeps the
    // label just above the lander without dwarfing it. The LabelRenderer
    // scales this with camera distance for constant on-screen size.
    this.labelRenderer.registerLabel(label, { targetWorldHeight: 0.15, minScale: 0.05 });

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
        // Place lander on the exact sub-hex terrain position.
        const numericId = parseInt(body.landedCellId.replace('cell_', ''));
        if (!isNaN(numericId) && this.grid && numericId >= 0 && numericId < this.grid.cells.length) {
          const cellCenterArr = this.grid.cells[numericId].center;
          const cellCenter = new THREE.Vector3(cellCenterArr[0], cellCenterArr[1], cellCenterArr[2]);
          const normal = cellCenter.clone().normalize();

          // Compute sub-hex world position.
          const subHexIdx = body.landedSubHex >= 0 ? body.landedSubHex : 0;
          const radius = CFG.SUBHEX.radius;
          const coords = generateSubHexCoords(radius);
          const macroCircumradius = 0.3;
          const subSize = subHexSize(macroCircumradius, radius);
          const coord = coords[subHexIdx] || { q: 0, r: 0 };
          const SQRT3 = Math.sqrt(3);
          const px = subSize * (SQRT3 * coord.q + (SQRT3 / 2) * coord.r);
          const py = subSize * (3 / 2) * coord.r;

          // Build tangent plane basis at cell center.
          const nx = normal.x, ny = normal.y, nz = normal.z;
          let upX = 0, upY = 0, upZ = 1;
          if (Math.abs(nz) > 0.9) { upX = 1; upY = 0; upZ = 0; }
          let uX = ny * upZ - nz * upY;
          let uY = nz * upX - nx * upZ;
          let uZ = nx * upY - ny * upX;
          const uLen = Math.sqrt(uX * uX + uY * uY + uZ * uZ) || 1;
          uX /= uLen; uY /= uLen; uZ /= uLen;
          const vX = ny * uZ - nz * uY;
          const vY = nz * uX - nx * uZ;
          const vZ = nx * uY - ny * uX;

          const tx = cellCenter.x + uX * px + vX * py;
          const ty = cellCenter.y + uY * px + vY * py;
          const tz = cellCenter.z + uZ * px + vZ * py;
          const tLen = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
          const worldPos: [number, number, number] = [
            (tx / tLen) * GLOBE_RADIUS,
            (ty / tLen) * GLOBE_RADIUS,
            (tz / tLen) * GLOBE_RADIUS,
          ];

          // Sample terrain height at this position.
          const { height } = sampleWorldTerrain(worldPos, clientState.worldSeed);
          const surfaceRadius = GLOBE_RADIUS + height + 0.05;
          const surfaceNormal = new THREE.Vector3(worldPos[0], worldPos[1], worldPos[2]).normalize();

          sc.mesh.position.copy(surfaceNormal.clone().multiplyScalar(surfaceRadius));
          // Stand the lander upright on the surface: lookAt makes -Z face
          // outward along the normal, then rotateX(-90°) turns +Y (the
          // capsule's long axis) to align with -Z (outward = up).
          sc.mesh.lookAt(surfaceNormal.clone().multiplyScalar(GLOBE_RADIUS * 2));
          sc.mesh.rotateX(-Math.PI / 2);
          sc.label.position.copy(surfaceNormal.clone().multiplyScalar(surfaceRadius + 0.15));
        }
      } else {
        const relX = (body.position[0] - parentPos.x) / KM_PER_UNIT;
        const relY = (body.position[1] - parentPos.y) / KM_PER_UNIT;
        const relZ = (body.position[2] - parentPos.z) / KM_PER_UNIT;
        sc.mesh.position.set(relX, relY, relZ);
        sc.label.position.set(relX, relY + 0.25, relZ);
      }

      // Hide orbit line when landed.
      if (sc.orbitLine) {
        sc.orbitLine.visible = !body.landedCellId;
      }

      // Scale labels with camera distance so they stay a constant on-screen size.
      if (camera) {
        this.labelRenderer.update(camera);
      }
    }
  }
}