import * as THREE from 'three';
import { clientState, onStateUpdate } from '../state/ClientState';
import { createInfantryIcon, positionOnSurface, offsetOnSurface, orientToSurface, GLOBE_RADIUS } from './IconFactory';

const SURFACE_OFFSET = 1.008;
const TICK_INTERVAL_MS = 1000;

const UNIT_OFFSETS = [
  [0, 0],
  [0.09, 0],
  [-0.09, 0],
  [0, 0.09],
  [0, -0.09],
  [0.09, 0.09],
  [-0.09, 0.09],
  [0.09, -0.09],
  [-0.09, -0.09],
];

interface UnitVisual {
  icon: THREE.Mesh;
  selectionRing: THREE.LineSegments | null;
}

interface MovingUnitState {
  fromCellId: string;
  toCellId: string;
  totalTicks: number;
  remainingTicks: number;
  stateTimestamp: number;
}

export class UnitRenderer {
  private globe: THREE.Group;
  private grid: any;
  private units: Map<string, UnitVisual> = new Map();
  private movingUnits: Map<string, MovingUnitState> = new Map();
  private selectionRings: Map<string, THREE.LineSegments> = new Map();

  constructor(globe: THREE.Group, grid: any) {
    this.globe = globe;
    this.grid = grid;

    onStateUpdate(() => this.onStateChange());
  }

  private getCellCenter(cellId: string): [number, number, number] | null {
    const numericId = parseInt(cellId.replace('cell_', ''));
    if (isNaN(numericId) || numericId < 0 || numericId >= this.grid.cells.length) return null;
    return this.grid.cells[numericId].center;
  }

  private cellCenterToWorld(cellId: string): THREE.Vector3 {
    const center = this.getCellCenter(cellId);
    if (!center) return new THREE.Vector3(0, GLOBE_RADIUS * SURFACE_OFFSET, 0);
    return new THREE.Vector3(center[0], center[1], center[2]).normalize().multiplyScalar(GLOBE_RADIUS * SURFACE_OFFSET);
  }

  private getUnitOffset(index: number, total: number): [number, number] {
    if (total <= 1) return [0, 0];
    if (total <= 3) {
      const angles = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
      const a = angles[index % 3];
      return [Math.cos(a) * 0.08, Math.sin(a) * 0.08];
    }
    const pos = UNIT_OFFSETS[index % UNIT_OFFSETS.length];
    return [pos[0] * Math.min(total, 5) * 0.3, pos[1] * Math.min(total, 5) * 0.3];
  }

  private onStateChange(): void {
    const currentUnitIds = new Set<string>();

    for (const [unitId, unit] of clientState.units) {
      if (!clientState.visibleCells.has(unit.cellId)) continue;
      currentUnitIds.add(unitId);

      const player = clientState.players.get(unit.ownerId);
      const color = player ? player.color : '#ffffff';

      if (this.units.has(unitId)) {
        const uv = this.units.get(unitId)!;
        const mat = uv.icon.material as THREE.MeshBasicMaterial;
        mat.color.set(color);

        if (unit.status === 'MOVING' && unit.path && unit.path.length > 0) {
          const nextCellId = unit.path[0];
          this.movingUnits.set(unitId, {
            fromCellId: unit.cellId,
            toCellId: nextCellId,
            totalTicks: unit.movementTicksTotal || 10,
            remainingTicks: unit.movementTicksRemaining,
            stateTimestamp: performance.now(),
          });
        } else {
          this.movingUnits.delete(unitId);
        }
      } else {
        const icon = createInfantryIcon(color);
        positionOnSurface(icon, this.getCellCenter(unit.cellId) || [0, GLOBE_RADIUS, 0], SURFACE_OFFSET);
        icon.userData = { unitId, type: 'unit' };
        this.globe.add(icon);

        this.units.set(unitId, { icon, selectionRing: null });
      }
    }

    for (const [unitId, uv] of this.units) {
      if (!currentUnitIds.has(unitId)) {
        this.globe.remove(uv.icon);
        uv.icon.geometry.dispose();
        (uv.icon.material as THREE.Material).dispose();
        if (uv.selectionRing) {
          this.globe.remove(uv.selectionRing);
          uv.selectionRing.geometry.dispose();
          (uv.selectionRing.material as THREE.Material).dispose();
        }
        this.units.delete(unitId);
        this.movingUnits.delete(unitId);
      }
    }

    this.updateSelectionRings();
  }

  private buildSelectionCircle(cellId: string): THREE.LineSegments | null {
    const center = this.getCellCenter(cellId);
    if (!center) return null;

    const basePos = new THREE.Vector3(center[0], center[1], center[2]).normalize().multiplyScalar(GLOBE_RADIUS * SURFACE_OFFSET);
    const normal = basePos.clone().normalize();
    const up = new THREE.Vector3(0, 1, 0);
    if (Math.abs(normal.dot(up)) > 0.99) {
      up.set(1, 0, 0);
    }
    const tangent = new THREE.Vector3().crossVectors(normal, up).normalize();
    const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();

    const radius = 0.25;
    const segments = 24;
    const positions: number[] = [];

    for (let i = 0; i < segments; i++) {
      const angle1 = (i / segments) * Math.PI * 2;
      const angle2 = ((i + 1) / segments) * Math.PI * 2;
      const p1 = basePos.clone()
        .add(tangent.clone().multiplyScalar(Math.cos(angle1) * radius))
        .add(bitangent.clone().multiplyScalar(Math.sin(angle1) * radius));
      const p2 = basePos.clone()
        .add(tangent.clone().multiplyScalar(Math.cos(angle2) * radius))
        .add(bitangent.clone().multiplyScalar(Math.sin(angle2) * radius));
      p1.normalize().multiplyScalar(GLOBE_RADIUS * 1.012);
      p2.normalize().multiplyScalar(GLOBE_RADIUS * 1.012);
      positions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
    return new THREE.LineSegments(geometry, material);
  }

  private updateSelectionRings(): void {
    const prevRings = new Set(this.selectionRings.keys());
    const ringsToKeep = new Set<string>();

    if (clientState.selectedUnitId) {
      const unit = clientState.units.get(clientState.selectedUnitId);
      if (unit) {
        const cellId = unit.cellId;
        const existing = this.selectionRings.get(clientState.selectedUnitId);
        if (existing) {
          this.globe.remove(existing);
          existing.geometry.dispose();
          (existing.material as THREE.Material).dispose();
          this.selectionRings.delete(clientState.selectedUnitId);
        }
        const ring = this.buildSelectionCircle(cellId);
        if (ring) {
          this.globe.add(ring);
          this.selectionRings.set(clientState.selectedUnitId, ring);
        }
        ringsToKeep.add(clientState.selectedUnitId);
      }
    }

    for (const unitId of prevRings) {
      if (!ringsToKeep.has(unitId)) {
        const ring = this.selectionRings.get(unitId)!;
        this.globe.remove(ring);
        ring.geometry.dispose();
        (ring.material as THREE.Material).dispose();
        this.selectionRings.delete(unitId);
      }
    }
  }

  update(): void {
    const now = performance.now();
    const movingIds = new Set(this.movingUnits.keys());

    const cellUnitCounts = new Map<string, string[]>();
    for (const [unitId, unit] of clientState.units) {
      if (!clientState.visibleCells.has(unit.cellId)) continue;
      const cellId = unit.cellId;
      if (!cellUnitCounts.has(cellId)) cellUnitCounts.set(cellId, []);
      cellUnitCounts.get(cellId)!.push(unitId);
    }

    for (const [unitId, mu] of this.movingUnits) {
      const uv = this.units.get(unitId);
      if (!uv) continue;

      const total = mu.totalTicks || 10;
      const remaining = mu.remainingTicks;
      const stateAge = now - mu.stateTimestamp;

      const progressAtStateArrival = 1 - (remaining / total);
      const interpolatedProgress = Math.max(0, Math.min(1,
        progressAtStateArrival + (stateAge / TICK_INTERVAL_MS / total)
      ));

      const fromPos = this.cellCenterToWorld(mu.fromCellId);
      const toPos = this.cellCenterToWorld(mu.toCellId);

      const interpPos = new THREE.Vector3().lerpVectors(fromPos, toPos, interpolatedProgress);
      interpPos.normalize().multiplyScalar(GLOBE_RADIUS * SURFACE_OFFSET);

      const unit = clientState.units.get(unitId);
      let idx = 0;
      const cellId = unit ? unit.cellId : mu.fromCellId;
      const cellList = cellUnitCounts.get(cellId);
      if (cellList) {
        idx = cellList.indexOf(unitId);
        if (idx < 0) idx = 0;
      }
      const totalUnits = cellList ? cellList.length : 1;

      const [dx, dy] = this.getUnitOffset(idx, totalUnits);
      const offsetPos = offsetOnSurface(interpPos, dx, dy);
      uv.icon.position.copy(offsetPos);
      orientToSurface(uv.icon, offsetPos);
    }

    for (const [cellId, unitIds] of cellUnitCounts) {
      for (let i = 0; i < unitIds.length; i++) {
        const unitId = unitIds[i];
        if (movingIds.has(unitId)) continue;

        const uv = this.units.get(unitId);
        if (!uv) continue;

        const [dx, dy] = this.getUnitOffset(i, unitIds.length);
        const basePos = this.cellCenterToWorld(cellId);
        const offsetPos = offsetOnSurface(basePos, dx, dy);
        uv.icon.position.copy(offsetPos);
        orientToSurface(uv.icon, offsetPos);
      }
    }

    for (const [unitId, ring] of this.selectionRings) {
      const time = performance.now() * 0.003;
      (ring.material as THREE.LineBasicMaterial).opacity = 0.6 + 0.3 * Math.sin(time);
    }
  }

  getMeshes(): THREE.Object3D[] {
    const objects: THREE.Object3D[] = [];
    for (const [, uv] of this.units) {
      objects.push(uv.icon);
    }
    return objects;
  }

  getUnitIdAtIntersection(intersection: THREE.Intersection): string | null {
    if (!intersection.object) return null;
    return intersection.object.userData?.unitId ?? null;
  }
}