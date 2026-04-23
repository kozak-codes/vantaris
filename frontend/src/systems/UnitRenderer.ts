import * as THREE from 'three';
import { clientState, onStateUpdate } from '../state/ClientState';
import { createInfantryIcon, positionOnSurface, offsetOnSurface, orientToSurface, GLOBE_RADIUS } from './IconFactory';

const SURFACE_OFFSET = 1.04;

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
  prevCellId: string;
  targetCellId: string;
}

interface MovingUnitState {
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  totalTicks: number;
  remainingTicks: number;
}

export class UnitRenderer {
  private globe: THREE.Group;
  private grid: any;
  private units: Map<string, UnitVisual> = new Map();
  private prevState: Map<string, { cellId: string; status: string; path: string[]; movementTicksRemaining: number; movementTicksTotal: number }> = new Map();
  private movingUnits: Map<string, MovingUnitState> = new Map();

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

        const prev = this.prevState.get(unitId);
        const prevCellId = prev ? prev.cellId : unit.cellId;

        if (unit.status === 'MOVING' && unit.path && unit.path.length > 0 && prevCellId !== unit.cellId) {
          const fromPos = this.cellCenterToWorld(prevCellId);
          const toPos = this.cellCenterToWorld(unit.cellId);
          this.movingUnits.set(unitId, {
            fromPos,
            toPos,
            totalTicks: unit.movementTicksTotal || 10,
            remainingTicks: unit.movementTicksRemaining,
          });
          uv.prevCellId = prevCellId;
          uv.targetCellId = unit.cellId;
        } else if (unit.status === 'MOVING' && this.movingUnits.has(unitId)) {
          const mu = this.movingUnits.get(unitId)!;
          mu.remainingTicks = unit.movementTicksRemaining;
          mu.totalTicks = unit.movementTicksTotal || 10;
          mu.toPos = this.cellCenterToWorld(unit.cellId);
        } else {
          uv.targetCellId = unit.cellId;
          this.movingUnits.delete(unitId);
        }
      } else {
        const icon = createInfantryIcon(color);
        const worldPos = this.cellCenterToWorld(unit.cellId);
        positionOnSurface(icon, this.getCellCenter(unit.cellId) || [0, GLOBE_RADIUS, 0]);
        icon.userData = { unitId, type: 'unit' };
        this.globe.add(icon);

        this.units.set(unitId, {
          icon,
          prevCellId: unit.cellId,
          targetCellId: unit.cellId,
        });
      }

      this.prevState.set(unitId, {
        cellId: unit.cellId,
        status: unit.status,
        path: unit.path,
        movementTicksRemaining: unit.movementTicksRemaining,
        movementTicksTotal: unit.movementTicksTotal,
      });
    }

    for (const [unitId, uv] of this.units) {
      if (!currentUnitIds.has(unitId)) {
        this.globe.remove(uv.icon);
        uv.icon.geometry.dispose();
        (uv.icon.material as THREE.Material).dispose();
        this.units.delete(unitId);
        this.movingUnits.delete(unitId);
        this.prevState.delete(unitId);
      }
    }

    this.updatePositions();
  }

  private updatePositions(): void {
    const cellUnitCounts = new Map<string, string[]>();

    for (const [unitId, unit] of clientState.units) {
      const cellId = unit.cellId;
      if (!cellUnitCounts.has(cellId)) {
        cellUnitCounts.set(cellId, []);
      }
      cellUnitCounts.get(cellId)!.push(unitId);
    }

    for (const [cellId, unitIds] of cellUnitCounts) {
      for (let i = 0; i < unitIds.length; i++) {
        const unitId = unitIds[i];
        const uv = this.units.get(unitId);
        if (!uv) continue;

        const [dx, dy] = this.getUnitOffset(i, unitIds.length);
        const basePos = this.cellCenterToWorld(cellId);
        const offsetPos = offsetOnSurface(basePos, dx, dy);
        uv.icon.position.copy(offsetPos);
        orientToSurface(uv.icon, offsetPos);
      }
    }
  }

  update(): void {
    for (const [unitId, mu] of this.movingUnits) {
      const uv = this.units.get(unitId);
      if (!uv) continue;

      const total = mu.totalTicks || 10;
      const remaining = mu.remainingTicks;
      const t = 1 - (remaining / total);

      const fromPos = mu.fromPos.clone();
      const toPos = mu.toPos.clone();

      const interpPos = new THREE.Vector3().lerpVectors(fromPos, toPos, Math.max(0, Math.min(1, t)));
      interpPos.normalize().multiplyScalar(GLOBE_RADIUS * SURFACE_OFFSET);

      const cellUnitList: string[] = [];
      const cellId = uv.targetCellId;
      for (const [uid, unit] of clientState.units) {
        if (unit.cellId === cellId) cellUnitList.push(uid);
      }
      const idx = cellUnitList.indexOf(unitId);
      const [dx, dy] = this.getUnitOffset(idx >= 0 ? idx : 0, Math.max(1, cellUnitList.length));
      const offsetPos = offsetOnSurface(interpPos, dx, dy);
      uv.icon.position.copy(offsetPos);
      orientToSurface(uv.icon, offsetPos);
    }

    const movingIds = new Set(this.movingUnits.keys());
    for (const [cellId, unitIds] of this.getCellUnitsMap()) {
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
  }

  private getCellUnitsMap(): Map<string, string[]> {
    const map = new Map<string, string[]>();
    for (const [unitId, unit] of clientState.units) {
      if (!map.has(unit.cellId)) {
        map.set(unit.cellId, []);
      }
      map.get(unit.cellId)!.push(unitId);
    }
    return map;
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